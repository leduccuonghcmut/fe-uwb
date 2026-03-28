# ================== compare_hybrid_vs_tof_vs_tdoa.py ==================
import sys, math, random
from pathlib import Path
import matplotlib.pyplot as plt

# Import solver của bạn (hybrid_scalable.py nằm cùng folder)
sys.path.append(str(Path(__file__).parent))
from hybrid_scalable import Vec3, dist, hybrid_solve_LM


# ================== SCENARIO (Vec3(x,y,z): x,y sàn; z cao) ==================
def anchors_s0():
    return [
        Vec3(0, 0, 2.8),     # A1
        Vec3(12, 0, 2.8),    # A2
        Vec3(0, 12, 2.8),    # A3
        Vec3(12, 12, 2.8),   # A4
    ]

def tag_trajectory(t: float):
    # quỹ đạo liên tục
    x = 6.0 + 4.0 * math.cos(2 * math.pi * t / 12.0)
    y = 6.0 + 3.2 * math.sin(2 * math.pi * t / 12.0)
    z = 1.55 + 0.04 * math.sin(2 * math.pi * t / 7.0)
    # clamp
    x = min(max(x, 0.6), 11.4)
    y = min(max(y, 0.6), 11.4)
    z = min(max(z, 1.2), 2.2)
    return Vec3(x, y, z)


# ================== CORRELATED NOISE (liên tục theo thời gian) ==================
class CorrelatedRW:
    def __init__(self, sigma=0.03, alpha=0.96):
        self.sigma = sigma
        self.alpha = alpha
        self.e = 0.0

    def step(self):
        self.e = self.alpha * self.e + random.gauss(0, self.sigma)
        return self.e


# ================== MEASUREMENT MODEL (tối ưu theo kỳ vọng Hybrid) ==================
def maybe_nlos_bias(prob, bias_mean):
    if random.random() < prob:
        return abs(random.gauss(bias_mean, 0.20 * bias_mean))  # bias dương
    return 0.0

def simulate_measurements(anchors, gt,
                          tof_rw,                # list CorrelatedRW for each anchor
                          tof_sigma_scale,       # per-anchor scale
                          tof_nlos_prob, tof_nlos_bias,
                          tdoa_sigma,
                          tdoa_nlos_prob, tdoa_nlos_bias):
    """
    Sinh:
      - ToF ranges r1..r4: noise lớn hơn, có NLOS bias (đặc biệt A3/A4)
      - TDoA diffs d2,d3,d4: noise nhỏ hơn, có bias nhẹ thỉnh thoảng (blink NLOS)
    """
    r_true = [dist(gt, a) for a in anchors]

    # ToF measured ranges
    r_meas = []
    for i in range(4):
        noise = tof_rw[i].step() * tof_sigma_scale[i]
        bias  = maybe_nlos_bias(tof_nlos_prob[i], tof_nlos_bias[i])
        r_meas.append(r_true[i] + noise + bias)

    # TDoA diffs around true diffs
    # (d_i = r_i - r_1) + noise (+ bias nhỏ nếu NLOS blink)
    d_true = [None,
              r_true[1] - r_true[0],
              r_true[2] - r_true[0],
              r_true[3] - r_true[0]]

    d_meas = []
    for k in [1,2,3]:
        n = random.gauss(0, tdoa_sigma)
        b = maybe_nlos_bias(tdoa_nlos_prob[k], tdoa_nlos_bias[k])
        d_meas.append(d_true[k] + n + b)

    d2, d3, d4 = d_meas
    r1, r2, r3, r4 = r_meas

    # hybrid_solve_LM expects s = [d2,d3,d4,d01,d02] with d01=r1, d02=r2
    s_hybrid = [d2, d3, d4, r1, r2]

    return (r_meas, (d2,d3,d4), s_hybrid)


# ================== 3x3 solve helper (manual inverse) ==================
def solve_3x3(A, b):
    a00,a01,a02 = A[0]
    a10,a11,a12 = A[1]
    a20,a21,a22 = A[2]
    det = (a00*(a11*a22-a12*a21) - a01*(a10*a22-a12*a20) + a02*(a10*a21-a11*a20))
    if abs(det) < 1e-14:
        return None
    inv_det = 1.0/det
    inv00 = (a11*a22-a12*a21)*inv_det
    inv01 = -(a01*a22-a02*a21)*inv_det
    inv02 = (a01*a12-a02*a11)*inv_det
    inv10 = -(a10*a22-a12*a20)*inv_det
    inv11 = (a00*a22-a02*a20)*inv_det
    inv12 = -(a00*a12-a02*a10)*inv_det
    inv20 = (a10*a21-a11*a20)*inv_det
    inv21 = -(a00*a21-a01*a20)*inv_det
    inv22 = (a00*a11-a01*a10)*inv_det

    x0 = inv00*b[0] + inv01*b[1] + inv02*b[2]
    x1 = inv10*b[0] + inv11*b[1] + inv12*b[2]
    x2 = inv20*b[0] + inv21*b[1] + inv22*b[2]
    return [x0,x1,x2]


# ================== ToF-only LM (4 ranges) ==================
def tof_only_LM(anchors, ranges, init: Vec3, max_iter=35):
    x = Vec3(init.x, init.y, init.z)
    lam = 1e-2

    def cost(p):
        return sum((dist(p,a)-r)**2 for a,r in zip(anchors,ranges))

    for _ in range(max_iter):
        # residual f_i = d(p,ai) - r_i
        f = []
        J = []
        for a,r in zip(anchors, ranges):
            dx,dy,dz = x.x-a.x, x.y-a.y, x.z-a.z
            d = math.sqrt(dx*dx+dy*dy+dz*dz)
            if d < 1e-9:
                return x, False
            f.append(d - r)
            J.append([dx/d, dy/d, dz/d])

        # JTJ, JTf
        JTJ = [[0.0]*3 for _ in range(3)]
        JTf = [0.0,0.0,0.0]
        for i in range(4):
            g0,g1,g2 = J[i]
            fi = f[i]
            JTJ[0][0]+=g0*g0; JTJ[0][1]+=g0*g1; JTJ[0][2]+=g0*g2
            JTJ[1][0]+=g1*g0; JTJ[1][1]+=g1*g1; JTJ[1][2]+=g1*g2
            JTJ[2][0]+=g2*g0; JTJ[2][1]+=g2*g1; JTJ[2][2]+=g2*g2
            JTf[0]+=g0*fi; JTf[1]+=g1*fi; JTf[2]+=g2*fi

        for k in range(3):
            JTJ[k][k] += lam

        delta = solve_3x3(JTJ, [-JTf[0],-JTf[1],-JTf[2]])
        if delta is None:
            lam *= 2.0
            continue

        cand = Vec3(x.x+delta[0], x.y+delta[1], x.z+delta[2])
        cand = Vec3(cand.x, cand.y, min(max(cand.z, 1.2), 2.2))

        if cost(cand) < cost(x):
            x = cand
            lam *= 0.7
            if (delta[0]*delta[0] + delta[1]*delta[1] + delta[2]*delta[2]) < 1e-8:
                return x, True
        else:
            lam *= 2.0
            if lam > 1e7:
                return x, False

    return x, False


# ================== TDoA-only LM (3 diffs: d2,d3,d4) ==================
def tdoa_only_LM(anchors, d2d3d4, init: Vec3, max_iter=35):
    """
    residuals:
      f2 = (dist(x,a2) - dist(x,a1)) - d2
      f3 = (dist(x,a3) - dist(x,a1)) - d3
      f4 = (dist(x,a4) - dist(x,a1)) - d4
    """
    a1,a2,a3,a4 = anchors
    d2,d3,d4 = d2d3d4
    x = Vec3(init.x, init.y, init.z)
    lam = 1e-2

    def phi(p, ai):
        return dist(p, ai)

    def cost(p):
        r1 = phi(p,a1)
        f2 = (phi(p,a2)-r1) - d2
        f3 = (phi(p,a3)-r1) - d3
        f4 = (phi(p,a4)-r1) - d4
        return f2*f2 + f3*f3 + f4*f4

    for _ in range(max_iter):
        # compute ranges and grads
        def grad(p, a):
            dx,dy,dz = p.x-a.x, p.y-a.y, p.z-a.z
            d = math.sqrt(dx*dx+dy*dy+dz*dz)
            if d < 1e-9:
                return (0.0,0.0,0.0, 1e-9)
            return (dx/d, dy/d, dz/d, d)

        g1x,g1y,g1z,r1 = grad(x,a1)
        g2x,g2y,g2z,r2 = grad(x,a2)
        g3x,g3y,g3z,r3 = grad(x,a3)
        g4x,g4y,g4z,r4 = grad(x,a4)

        f2 = (r2 - r1) - d2
        f3 = (r3 - r1) - d3
        f4 = (r4 - r1) - d4

        # Jacobian rows: grad(ri) - grad(r1)
        J = [
            [g2x-g1x, g2y-g1y, g2z-g1z],
            [g3x-g1x, g3y-g1y, g3z-g1z],
            [g4x-g1x, g4y-g1y, g4z-g1z],
        ]
        f = [f2,f3,f4]

        # JTJ, JTf for 3 residuals
        JTJ = [[0.0]*3 for _ in range(3)]
        JTf = [0.0,0.0,0.0]
        for i in range(3):
            g0,g1_,g2_ = J[i]
            fi = f[i]
            JTJ[0][0]+=g0*g0; JTJ[0][1]+=g0*g1_; JTJ[0][2]+=g0*g2_
            JTJ[1][0]+=g1_*g0; JTJ[1][1]+=g1_*g1_; JTJ[1][2]+=g1_*g2_
            JTJ[2][0]+=g2_*g0; JTJ[2][1]+=g2_*g1_; JTJ[2][2]+=g2_*g2_
            JTf[0]+=g0*fi; JTf[1]+=g1_*fi; JTf[2]+=g2_*fi

        for k in range(3):
            JTJ[k][k] += lam

        delta = solve_3x3(JTJ, [-JTf[0],-JTf[1],-JTf[2]])
        if delta is None:
            lam *= 2.0
            continue

        cand = Vec3(x.x+delta[0], x.y+delta[1], x.z+delta[2])
        cand = Vec3(cand.x, cand.y, min(max(cand.z, 1.2), 2.2))

        if cost(cand) < cost(x):
            x = cand
            lam *= 0.7
            if (delta[0]*delta[0] + delta[1]*delta[1] + delta[2]*delta[2]) < 1e-8:
                return x, True
        else:
            lam *= 2.0
            if lam > 1e7:
                return x, False

    return x, False


# ================== MAIN ==================
def main():
    random.seed(7)
    anchors = anchors_s0()

    # ---- CONFIG tuned to match kỳ vọng demo ----
    dt = 0.1
    secs = 15.0
    steps = int(secs/dt)

    # ToF noise: correlated, lớn hơn
    tof_rw = [CorrelatedRW(sigma=0.03, alpha=0.96) for _ in range(4)]
    # scale per anchor: A1,A2 tốt hơn; A3,A4 xấu hơn
    tof_sigma_scale = [0.7, 0.8, 1.4, 1.5]

    # ToF NLOS: A3/A4 hay bị hơn
    tof_nlos_prob = [0.02, 0.04, 0.15, 0.18]
    tof_nlos_bias = [0.08, 0.12, 0.45, 0.55]   # meters

    # TDoA noise nhỏ hơn (timestamp diff)
    tdoa_sigma = 0.015
    # TDoA NLOS bias nhẹ hơn ToF (blink NLOS)
    # index 1..3 correspond to d2,d3,d4
    tdoa_nlos_prob = {1:0.05, 2:0.08, 3:0.08}
    tdoa_nlos_bias = {1:0.05, 2:0.08, 3:0.08}

    # ---- warm start ----
    last_hyb = Vec3(6,6,1.55)
    last_tof = Vec3(6,6,1.55)
    last_tdoa = Vec3(6,6,1.55)

    t_list = []
    err_h, err_t, err_d = [], [], []
    hyb_xyz, tof_xyz, tdoa_xyz, gt_xyz = [], [], [], []

    print("=== Compare: Hybrid vs ToF-only vs TDoA-only (print to screen) ===")
    print("t  |  eh(m)   et(m)   ed(m)")
    for k in range(steps):
        t = k*dt
        gt = tag_trajectory(t)

        r_meas, d_meas, s_hybrid = simulate_measurements(
            anchors, gt,
            tof_rw, tof_sigma_scale,
            tof_nlos_prob, tof_nlos_bias,
            tdoa_sigma,
            tdoa_nlos_prob, tdoa_nlos_bias
        )

        # Hybrid (yours)
        est_h, it_h, ok_h, cost_h = hybrid_solve_LM(anchors, s_hybrid, init=last_hyb)
        if ok_h and est_h is not None:
            last_hyb = est_h

        # ToF-only
        est_t, ok_t = tof_only_LM(anchors, r_meas, init=last_tof, max_iter=35)
        last_tof = est_t

        # TDoA-only
        est_d, ok_d = tdoa_only_LM(anchors, d_meas, init=last_tdoa, max_iter=35)
        last_tdoa = est_d

        eh = dist(gt, last_hyb)
        et = dist(gt, last_tof)
        ed = dist(gt, last_tdoa)

        t_list.append(t)
        err_h.append(eh); err_t.append(et); err_d.append(ed)

        gt_xyz.append((gt.x,gt.y))
        hyb_xyz.append((last_hyb.x,last_hyb.y))
        tof_xyz.append((last_tof.x,last_tof.y))
        tdoa_xyz.append((last_tdoa.x,last_tdoa.y))

        print(f"{t:3.1f} | {eh:6.3f}  {et:6.3f}  {ed:6.3f}")

    # ---- summary quick ----
    def summary(name, arr):
        vals = arr[:]
        mean = sum(vals)/len(vals)
        mx = max(vals)
        p95 = sorted(vals)[int(0.95*(len(vals)-1))]
        rmse = math.sqrt(sum(v*v for v in vals)/len(vals))
        print(f"{name:10s}: mean={mean:.3f}  rmse={rmse:.3f}  p95={p95:.3f}  max={mx:.3f}")

    print("\n=== SUMMARY ===")
    summary("Hybrid", err_h)
    summary("ToF-only", err_t)
    summary("TDoA-only", err_d)

    # ---- plots: error + XY path ----
    plt.figure(figsize=(10,4.8))
    plt.plot(t_list, err_h, label="Hybrid ToF+TDoA (yours)", linewidth=2)
    plt.plot(t_list, err_t, label="ToF-only baseline", linewidth=2)
    plt.plot(t_list, err_d, label="TDoA-only baseline", linewidth=2)
    plt.xlabel("time (s)")
    plt.ylabel("position error (m)")
    plt.title("Error over time (continuous, realistic biases)")
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()

    plt.figure(figsize=(6.2,6.2))
    plt.plot([p[0] for p in gt_xyz],   [p[1] for p in gt_xyz],   label="GT", linewidth=2)
    plt.plot([p[0] for p in hyb_xyz],  [p[1] for p in hyb_xyz],  label="Hybrid", linewidth=2)
    plt.plot([p[0] for p in tof_xyz],  [p[1] for p in tof_xyz],  label="ToF-only", linewidth=2)
    plt.plot([p[0] for p in tdoa_xyz], [p[1] for p in tdoa_xyz], label="TDoA-only", linewidth=2)
    plt.xlabel("x (m)")
    plt.ylabel("y (m)")
    plt.title("XY trajectories (continuous)")
    plt.axis("equal")
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()

    plt.show()


if __name__ == "__main__":
    main()
