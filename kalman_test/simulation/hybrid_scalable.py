# # ==========================================
# # hybrid_scalable.py
# # 3D Hybrid Solver (Paper-style) + LM Stable
# # Input : anchors (4x Vec3), s = [Δd2, Δd3, Δd4, d01, d02]
# # Output: Vec3(x,y,z)
# # Includes validation tests (random, edge, stress)
# # ==========================================
#
# from dataclasses import dataclass
# import math
# import random
# import time
# from typing import Sequence, Tuple, Optional
#
# C0 = 299792458.0
#
#
# # ---------- Basic vector utils ----------
#
# @dataclass
# class Vec3:
#     x: float
#     y: float
#     z: float
#
#
# def dist(a: Vec3, b: Vec3) -> float:
#     return math.sqrt(
#         (a.x - b.x) ** 2 +
#         (a.y - b.y) ** 2 +
#         (a.z - b.z) ** 2
#     )
#
#
# def unit(a: Vec3, b: Vec3) -> Vec3:
#     d = dist(a, b)
#     if d < 1e-12:
#         return Vec3(0.0, 0.0, 0.0)
#     return Vec3((a.x - b.x) / d, (a.y - b.y) / d, (a.z - b.z) / d)
#
#
# # ---------- Solve 3x3 linear system ----------
#
# def solve_3x3(A, b):
#     """
#     Solve A x = b for 3x3 A using explicit inverse.
#     Return list[3]; if singular, return zero step.
#     """
#     det = (
#         A[0][0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1])
#         - A[0][1]*(A[1][0]*A[2][2] - A[1][2]*A[2][0])
#         + A[0][2]*(A[1][0]*A[2][1] - A[1][1]*A[2][0])
#     )
#
#     if abs(det) < 1e-12:
#         return [0.0, 0.0, 0.0]
#
#     inv_det = 1.0 / det
#     inv = [[0.0]*3 for _ in range(3)]
#
#     inv[0][0] =  (A[1][1]*A[2][2] - A[1][2]*A[2][1]) * inv_det
#     inv[0][1] = -(A[0][1]*A[2][2] - A[0][2]*A[2][1]) * inv_det
#     inv[0][2] =  (A[0][1]*A[1][2] - A[0][2]*A[1][1]) * inv_det
#
#     inv[1][0] = -(A[1][0]*A[2][2] - A[1][2]*A[2][0]) * inv_det
#     inv[1][1] =  (A[0][0]*A[2][2] - A[0][2]*A[2][0]) * inv_det
#     inv[1][2] = -(A[0][0]*A[1][2] - A[0][2]*A[1][0]) * inv_det
#
#     inv[2][0] =  (A[1][0]*A[2][1] - A[1][1]*A[2][0]) * inv_det
#     inv[2][1] = -(A[0][0]*A[2][1] - A[0][1]*A[2][0]) * inv_det
#     inv[2][2] =  (A[0][0]*A[1][1] - A[0][1]*A[1][0]) * inv_det
#
#     x = [
#         inv[0][0]*b[0] + inv[0][1]*b[1] + inv[0][2]*b[2],
#         inv[1][0]*b[0] + inv[1][1]*b[1] + inv[1][2]*b[2],
#         inv[2][0]*b[0] + inv[2][1]*b[1] + inv[2][2]*b[2],
#     ]
#     return x
#
#
# # ---------- LM Hybrid Solver (s-vector) ----------
#
# def residual_and_jacobian_s(
#     anchors: Sequence[Vec3],
#     s: Sequence[float],
#     x: Vec3,
# ):
#     """
#     anchors: 4 anchors x1..x4
#     s = [Δd2, Δd3, Δd4, d01, d02]
#     return: (f[5], J[5x3])
#     """
#     x1, x2, x3, x4 = anchors
#     d2, d3, d4, d01, d02 = s
#
#     r1 = dist(x, x1)
#     r2 = dist(x, x2)
#     r3 = dist(x, x3)
#     r4 = dist(x, x4)
#
#     # residuals
#     f1 = (r2 - r1) - d2
#     f2 = (r3 - r1) - d3
#     f3 = (r4 - r1) - d4
#     f4 = r1 - d01
#     f5 = r2 - d02
#
#     f = [f1, f2, f3, f4, f5]
#
#     # Jacobian rows (paper-style)
#     u1 = unit(x, x1)
#     u2 = unit(x, x2)
#     u3 = unit(x, x3)
#     u4 = unit(x, x4)
#
#     J = [
#         [u2.x - u1.x, u2.y - u1.y, u2.z - u1.z],  # df1/dx
#         [u3.x - u1.x, u3.y - u1.y, u3.z - u1.z],  # df2/dx
#         [u4.x - u1.x, u4.y - u1.y, u4.z - u1.z],  # df3/dx
#         [u1.x,         u1.y,         u1.z       ],  # df4/dx
#         [u2.x,         u2.y,         u2.z       ],  # df5/dx
#     ]
#
#     return f, J
#
#
# def hybrid_solve_LM(
#     anchors: Sequence[Vec3],
#     s: Sequence[float],
#     init: Vec3 | None = None,
#     max_iter: int = 120,
#     lambda_init: float = 1e-2,
#     tol_step: float = 1e-4,
#     tol_res: float = 1e-6,
#     z_min: float = 0.2,
#     z_max: float = 3.5,
# ) -> Tuple[Vec3, int, bool]:
#
#     if init is None:
#         x0 = Vec3(
#             (anchors[0].x + anchors[-1].x) * 0.5,
#             (anchors[0].y + anchors[-1].y) * 0.5,
#             1.5
#         )
#     else:
#         x0 = Vec3(init.x, init.y, init.z)
#
#     lam = lambda_init
#
#     f, J = residual_and_jacobian_s(anchors, s, x0)
#     chi2 = sum(fi*fi for fi in f)
#     converged = False
#     last_good = x0
#     last_good_cost = chi2
#
#     for it in range(max_iter):
#         JTJ = [[0.0]*3 for _ in range(3)]
#         JTf = [0.0,0.0,0.0]
#
#         for i in range(5):
#             g0,g1,g2 = J[i]
#             fi = f[i]
#
#             JTJ[0][0] += g0*g0
#             JTJ[0][1] += g0*g1
#             JTJ[0][2] += g0*g2
#             JTJ[1][0] += g1*g0
#             JTJ[1][1] += g1*g1
#             JTJ[1][2] += g1*g2
#             JTJ[2][0] += g2*g0
#             JTJ[2][1] += g2*g1
#             JTJ[2][2] += g2*g2
#
#             JTf[0] += g0*fi
#             JTf[1] += g1*fi
#             JTf[2] += g2*fi
#
#         # stronger damping
#         for k in range(3):
#             JTJ[k][k] += lam
#
#         delta = solve_3x3(JTJ, [-JTf[0],-JTf[1],-JTf[2]])
#
#         step_norm = math.sqrt(delta[0]**2 + delta[1]**2 + delta[2]**2)
#
#         # trust region: smaller but safer max step
#         max_step = 0.6
#         if step_norm > max_step:
#             scale = max_step / step_norm
#             delta = [d*scale for d in delta]
#
#         if step_norm < tol_step and chi2 < last_good_cost + 1e-6:
#             converged = True
#             break
#
#         x_candidate = Vec3(
#             x0.x + delta[0],
#             x0.y + delta[1],
#             x0.z + delta[2]
#         )
#
#         # soft clamp Z + slight pull to valid band
#         if x_candidate.z < z_min:
#             x_candidate.z = (x_candidate.z + z_min) * 0.5
#         if x_candidate.z > z_max:
#             x_candidate.z = (x_candidate.z + z_max) * 0.5
#
#         f_new, J_new = residual_and_jacobian_s(anchors, s, x_candidate)
#         chi2_new = sum(fi*fi for fi in f_new)
#
#         if chi2_new < chi2:
#             last_good = x_candidate
#             last_good_cost = chi2_new
#             x0 = x_candidate
#             f, J = f_new, J_new
#             chi2 = chi2_new
#
#             lam *= 0.5
#             if lam < 1e-7:
#                 lam = 1e-7
#
#             if chi2 < tol_res:
#                 converged = True
#                 break
#         else:
#             lam *= 3.0
#             if lam > 1e7:
#                 break
#
#     # fallback:
#     if not converged:
#         if last_good_cost < 0.25:  # residual nhỏ -> vẫn chấp nhận
#             converged = True
#             return last_good, max_iter, True, last_good_cost
#
#     return last_good, it+1, converged, last_good_cost
#
#
#
# # ---------- Forward model: GT -> s (for testing) ----------
#
# def s_from_groundtruth(anchors: Sequence[Vec3], tag: Vec3, noise_std_m: float = 0.0):
#     """
#     Từ vị trí thật -> s vector, đúng theo định nghĩa paper:
#       Δd2 = r2 - r1
#       Δd3 = r3 - r1
#       Δd4 = r4 - r1
#       d01 = r1
#       d02 = r2
#     Có thể thêm noise (đơn vị mét)
#     """
#     r1 = dist(tag, anchors[0])
#     r2 = dist(tag, anchors[1])
#     r3 = dist(tag, anchors[2])
#     r4 = dist(tag, anchors[3])
#
#     d2 = r2 - r1
#     d3 = r3 - r1
#     d4 = r4 - r1
#     d01 = r1
#     d02 = r2
#
#     if noise_std_m > 0.0:
#         d2  += random.gauss(0, noise_std_m)
#         d3  += random.gauss(0, noise_std_m)
#         d4  += random.gauss(0, noise_std_m)
#         d01 += random.gauss(0, noise_std_m)
#         d02 += random.gauss(0, noise_std_m)
#
#     return [d2, d3, d4, d01, d02]
#
#
# # ---------- Validation Tests ----------
#
# def run_single_test(anchors, tag, noise_std_m: float):
#     s = s_from_groundtruth(anchors, tag, noise_std_m)
#     est, it, ok = hybrid_solve_LM(anchors, s)
#     err = dist(tag, est)
#     print(
#         f"GT = ({tag.x:.2f},{tag.y:.2f},{tag.z:.2f})  | "
#         f"EST = ({est.x:.2f},{est.y:.2f},{est.z:.2f})  | "
#         f"ERR = {err:.3f} m  | it={it} ok={ok}"
#     )
#     return err
#
#
# def test_random_region():
#     print("\n===== RANDOM REGION TEST =====")
#     anchors = [
#         Vec3(0,0,2),
#         Vec3(5,0,2),
#         Vec3(0,5,2),
#         Vec3(5,5,2),
#     ]
#     N = 30
#     noise_std = 0.05  # 5cm noise ~ khá realistic
#     total = 0.0
#     worst = 0.0
#
#     for _ in range(N):
#         tag = Vec3(
#             random.uniform(0.5, 4.5),
#             random.uniform(0.5, 4.5),
#             random.uniform(1.0, 2.0),
#         )
#         e = run_single_test(anchors, tag, noise_std)
#         total += e
#         worst = max(worst, e)
#
#     print("----------------------------------")
#     print("MEAN ERROR =", total/N, "m")
#     print("MAX  ERROR =", worst, "m")
#
#
# def test_edges():
#     print("\n===== EDGE / CORNER TEST =====")
#     anchors = [
#         Vec3(0,0,2),
#         Vec3(5,0,2),
#         Vec3(0,5,2),
#         Vec3(5,5,2),
#     ]
#     noise_std = 0.05
#
#     edges = [
#         Vec3(0.2,0.2,1.2),
#         Vec3(4.8,0.2,1.2),
#         Vec3(0.2,4.8,1.2),
#         Vec3(4.8,4.8,1.2),
#         Vec3(2.5,0.2,1.2),
#         Vec3(0.2,2.5,1.2),
#     ]
#
#     for t in edges:
#         run_single_test(anchors, t, noise_std)
#
#
# def stress_test():
#     print("\n===== HIGH NOISE STRESS TEST =====")
#     anchors = [
#         Vec3(0,0,2),
#         Vec3(5,0,2),
#         Vec3(0,5,2),
#         Vec3(5,5,2),
#     ]
#     noise_std = 0.20  # 20cm noise
#     for _ in range(10):
#         tag = Vec3(
#             random.uniform(1.0,4.0),
#             random.uniform(1.0,4.0),
#             random.uniform(1.0,2.0),
#         )
#         run_single_test(anchors, tag, noise_std)
#
#
# # ---------- PUBLIC API: từ raw distance ra XYZ ----------
#
# def hybrid_from_raw(
#     anchors: Sequence[Vec3],
#     d01: float,
#     d02: float,
#     d2: float,
#     d3: float,
#     d4: float
# ):
#     """
#     Direct XYZ solver
#     anchors : 4 anchor positions
#     Inputs are distance-domain values (meters)
#
#     Meaning:
#         d2  = r2 - r1   (Δd2)
#         d3  = r3 - r1   (Δd3)
#         d4  = r4 - r1   (Δd4)
#         d01 = r1
#         d02 = r2
#
#     return (Vec3, converged:bool)
#     """
#
#     s = [d2, d3, d4, d01, d02]
#     est, it, ok = hybrid_solve_LM(anchors, s)
#     return est, ok
#
# def realtime_stream_test():
#     print("\n===== REALTIME CONTINUOUS HYBRID 3D STREAM =====")
#
#     anchors = [
#         Vec3(0,0,2),
#         Vec3(5,0,2),
#         Vec3(0,5,2),
#         Vec3(5,5,2)
#     ]
#
#     noise_std = 0.05   # 5cm noise realistic
#     i = 0
#
#     while True:
#         i += 1
#         tag = Vec3(
#             random.uniform(0.5,4.5),
#             random.uniform(0.5,4.5),
#             random.uniform(1.0,2.0),
#         )
#
#         s = s_from_groundtruth(anchors, tag, noise_std)
#         est, it, ok = hybrid_solve_LM(anchors, s)
#         err = dist(tag, est)
#
#         print(
#             f"[{i}]  "
#             f"GT=({tag.x:.2f},{tag.y:.2f},{tag.z:.2f})  "
#             f"EST=({est.x:.2f},{est.y:.2f},{est.z:.2f})  "
#             f"ERR={err:.3f} m  it={it} ok={ok}"
#         )
#
#         time.sleep(1)   # ⏳ dừng 1 giây
#
# if __name__ == "__main__":
#     realtime_stream_test()


# ==========================================
# hybrid_scalable.py
# 3D Hybrid Solver (Paper-style) + LM Stable (Tuned)
# ==========================================

from dataclasses import dataclass
import math
import random
import time
from typing import Sequence, Tuple, Optional

C0 = 299792458.0


# ---------- Basic vector utils ----------

@dataclass
class Vec3:
    x: float
    y: float
    z: float


def dist(a: Vec3, b: Vec3) -> float:
    return math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2
    )


def unit(a: Vec3, b: Vec3) -> Vec3:
    d = dist(a, b)
    if d < 1e-12:
        return Vec3(0.0, 0.0, 0.0)
    return Vec3((a.x - b.x) / d, (a.y - b.y) / d, (a.z - b.z) / d)


# ---------- Solve 3x3 linear system ----------

def solve_3x3(A, b):
    det = (
        A[0][0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1])
        - A[0][1]*(A[1][0]*A[2][2] - A[1][2]*A[2][0])
        + A[0][2]*(A[1][0]*A[2][1] - A[1][1]*A[2][0])
    )

    if abs(det) < 1e-12:
        return [0.0, 0.0, 0.0]

    inv_det = 1.0 / det
    inv = [[0.0]*3 for _ in range(3)]

    inv[0][0] =  (A[1][1]*A[2][2] - A[1][2]*A[2][1]) * inv_det
    inv[0][1] = -(A[0][1]*A[2][2] - A[0][2]*A[2][1]) * inv_det
    inv[0][2] =  (A[0][1]*A[1][2] - A[0][2]*A[1][1]) * inv_det

    inv[1][0] = -(A[1][0]*A[2][2] - A[1][2]*A[2][0]) * inv_det
    inv[1][1] =  (A[0][0]*A[2][2] - A[0][2]*A[2][0]) * inv_det
    inv[1][2] = -(A[0][0]*A[1][2] - A[0][2]*A[1][0]) * inv_det

    inv[2][0] =  (A[1][0]*A[2][1] - A[1][1]*A[2][0]) * inv_det
    inv[2][1] = -(A[0][0]*A[2][1] - A[0][1]*A[2][0]) * inv_det
    inv[2][2] =  (A[0][0]*A[1][1] - A[0][1]*A[1][0]) * inv_det

    x = [
        inv[0][0]*b[0] + inv[0][1]*b[1] + inv[0][2]*b[2],
        inv[1][0]*b[0] + inv[1][1]*b[1] + inv[1][2]*b[2],
        inv[2][0]*b[0] + inv[2][1]*b[1] + inv[2][2]*b[2],
    ]
    return x


# ---------- Residual + Jacobian ----------

def residual_and_jacobian_s(anchors, s, x: Vec3):
    x1, x2, x3, x4 = anchors
    d2, d3, d4, d01, d02 = s

    r1 = dist(x, x1)
    r2 = dist(x, x2)
    r3 = dist(x, x3)
    r4 = dist(x, x4)

    f = [
        (r2 - r1) - d2,
        (r3 - r1) - d3,
        (r4 - r1) - d4,
        r1 - d01,
        r2 - d02
    ]

    u1 = unit(x, x1)
    u2 = unit(x, x2)
    u3 = unit(x, x3)
    u4 = unit(x, x4)

    J = [
        [u2.x - u1.x, u2.y - u1.y, u2.z - u1.z],
        [u3.x - u1.x, u3.y - u1.y, u3.z - u1.z],
        [u4.x - u1.x, u4.y - u1.y, u4.z - u1.z],
        [u1.x, u1.y, u1.z],
        [u2.x, u2.y, u2.z],
    ]

    return f, J


# ---------- LM Solver ----------

def hybrid_solve_LM(
    anchors,
    s,
    init: Vec3 | None = None,
    max_iter: int = 120,
    lambda_init: float = 0.1,       # 🔥 mạnh hơn để ổn định hơn
    tol_step: float = 1e-4,
    tol_res: float = 1e-6,
    z_min: float = 0.2,
    z_max: float = 3.5,
):

    if init is None:
        x0 = Vec3(
            (anchors[0].x + anchors[-1].x) * 0.5,
            (anchors[0].y + anchors[-1].y) * 0.5,
            1.5
        )
    else:
        x0 = Vec3(init.x, init.y, init.z)

    lam = lambda_init

    f, J = residual_and_jacobian_s(anchors, s, x0)
    chi2 = sum(fi*fi for fi in f)
    converged = False
    last_good = x0
    last_good_cost = chi2

    for it in range(max_iter):
        JTJ = [[0.0]*3 for _ in range(3)]
        JTf = [0.0,0.0,0.0]

        for i in range(5):
            g0,g1,g2 = J[i]
            fi = f[i]

            JTJ[0][0] += g0*g0
            JTJ[0][1] += g0*g1
            JTJ[0][2] += g0*g2
            JTJ[1][0] += g1*g0
            JTJ[1][1] += g1*g1
            JTJ[1][2] += g1*g2
            JTJ[2][0] += g2*g0
            JTJ[2][1] += g2*g1
            JTJ[2][2] += g2*g2

            JTf[0] += g0*fi
            JTf[1] += g1*fi
            JTf[2] += g2*fi

        for k in range(3):
            JTJ[k][k] += lam

        delta = solve_3x3(JTJ, [-JTf[0],-JTf[1],-JTf[2]])
        step_norm = math.sqrt(delta[0]**2 + delta[1]**2 + delta[2]**2)

        # 🔥 trust region nhỏ hơn → bớt nhảy “văng”
        max_step = 0.25
        if step_norm > max_step:
            scale = max_step / step_norm
            delta = [d*scale for d in delta]

        if step_norm < tol_step and chi2 < last_good_cost + 1e-6:
            converged = True
            break

        x_candidate = Vec3(
            x0.x + delta[0],
            x0.y + delta[1],
            x0.z + delta[2]
        )

        # giữ trong vùng hợp lệ
        if x_candidate.z < z_min:
            x_candidate.z = (x_candidate.z + z_min) * 0.5
        if x_candidate.z > z_max:
            x_candidate.z = (x_candidate.z + z_max) * 0.5

        f_new, J_new = residual_and_jacobian_s(anchors, s, x_candidate)
        chi2_new = sum(fi*fi for fi in f_new)

        if chi2_new < chi2:
            last_good = x_candidate
            last_good_cost = chi2_new
            x0 = x_candidate
            f, J = f_new, J_new
            chi2 = chi2_new

            lam *= 0.7
            if lam < 1e-7:
                lam = 1e-7

            if chi2 < tol_res:
                converged = True
                break
        else:
            lam *= 2.0
            if lam > 1e7:
                break

    if not converged:
        # 🔥 nghiêm hơn → tránh nhận nghiệm sai vài mét
        if last_good_cost < 0.05:
            converged = True
            return last_good, max_iter, True, last_good_cost

    return last_good, it+1, converged, last_good_cost



# ---------- Forward Model ----------

def s_from_groundtruth(anchors, tag, noise_std_m: float = 0.0):
    r1 = dist(tag, anchors[0])
    r2 = dist(tag, anchors[1])
    r3 = dist(tag, anchors[2])
    r4 = dist(tag, anchors[3])

    d2 = r2 - r1
    d3 = r3 - r1
    d4 = r4 - r1
    d01 = r1
    d02 = r2

    if noise_std_m > 0.0:
        d2  += random.gauss(0, noise_std_m)
        d3  += random.gauss(0, noise_std_m)
        d4  += random.gauss(0, noise_std_m)
        d01 += random.gauss(0, noise_std_m)
        d02 += random.gauss(0, noise_std_m)

    return [d2, d3, d4, d01, d02]


# ---------- Public API ----------

def hybrid_from_raw(anchors, d01, d02, d2, d3, d4):
    s = [d2, d3, d4, d01, d02]
    est, it, ok, _ = hybrid_solve_LM(anchors, s)
    return est, ok
