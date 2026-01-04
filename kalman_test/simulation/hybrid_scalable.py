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
