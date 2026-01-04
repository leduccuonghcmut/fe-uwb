# t.py
# ===== TEST SUITE hybrid_scalable + GMC-Kalman (FULLER) =====
# - Deterministic random seed
# - Tests: dist/unit, solve_3x3, residual/Jacobian finite-diff,
#          hybrid_solve_LM (coplanar/non-coplanar, bad init),
#          hybrid_from_raw equivalence, mirror ambiguity helper,
#          GMC kernel/weights, safe_gamma accuracy, reset/predict/update,
#          update gating, outlier robustness, axis-wise weights check.

import math
import random
import numpy as np

import hybrid_scalable as hs
import gmc_kalman_filter as gmc


# -----------------------------
# Helpers
# -----------------------------
def v3(x, y, z):  # shorthand
    return hs.Vec3(float(x), float(y), float(z))


def dist3(a, b):
    return hs.dist(a, b)


def fmt_v(v):
    return f"({v.x:.2f},{v.y:.2f},{v.z:.2f})"


def assert_close(name, got, exp, tol):
    err = abs(got - exp)
    ok = err <= tol
    print(f"{name}: got={got:.6f}, exp={exp:.6f}, |err|={err:.3e} -> {'OK' if ok else 'FAIL'}")
    return ok


def assert_true(name, cond):
    print(f"{name}: {'OK' if cond else 'FAIL'}")
    return bool(cond)


def vec_norm3(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def f_norm(f):
    return math.sqrt(sum(float(x) * float(x) for x in f))


def numeric_jacobian(anchors, s, x, eps=1e-6):
    # Finite difference Jacobian: J_num[i,j] = d f_i / d x_j
    base_f, _ = hs.residual_and_jacobian_s(anchors, s, x)
    Jn = np.zeros((len(base_f), 3), dtype=float)
    for j, (dx, dy, dz) in enumerate([(eps, 0, 0), (0, eps, 0), (0, 0, eps)]):
        xp = hs.Vec3(x.x + dx, x.y + dy, x.z + dz)
        fp, _ = hs.residual_and_jacobian_s(anchors, s, xp)
        for i in range(len(base_f)):
            Jn[i, j] = (fp[i] - base_f[i]) / eps
    return Jn


def multi_start_solve(anchors, s, inits):
    # Run hs.hybrid_solve_LM with multiple initial guesses, pick smallest residual norm
    best = None
    best_fn = 1e99
    best_meta = None
    for init in inits:
        est, it, ok, cost = hs.hybrid_solve_LM(anchors, s, init=init)
        f, _ = hs.residual_and_jacobian_s(anchors, s, est)
        fn = f_norm(f)
        meta = (est, it, ok, cost, fn, init)
        if fn < best_fn:
            best_fn = fn
            best_meta = meta
            best = est
    return best_meta  # (est, it, ok, cost, fn, init_used)


def make_anchors_coplanar_5x5(z=2.0):
    return [v3(0, 0, z), v3(5, 0, z), v3(0, 5, z), v3(5, 5, z)]


def make_anchors_noncoplanar_5x5():
    # Lift one anchor to break mirror/plane ambiguity
    return [v3(0, 0, 2.0), v3(5, 0, 2.0), v3(0, 5, 2.0), v3(5, 5, 2.6)]


def rand_tag_in_box(xmin, xmax, ymin, ymax, zmin, zmax):
    return v3(
        random.uniform(xmin, xmax),
        random.uniform(ymin, ymax),
        random.uniform(zmin, zmax),
    )


def run_stats_solver(anchors, N=50, noise=0.05, z_plane=2.0, bad_thr=0.30, fn_thr=0.12):
    plane_hits = 0
    bad_cnt = 0
    conv_cnt = 0
    errs = []
    max_err = 0.0

    for _ in range(N):
        gt = rand_tag_in_box(0.6, 4.4, 0.6, 4.4, 0.6, 2.0)
        s = hs.s_from_groundtruth(anchors, gt, noise_std_m=noise)
        est, it, ok, cost = hs.hybrid_solve_LM(anchors, s)
        err = dist3(gt, est)
        f, _ = hs.residual_and_jacobian_s(anchors, s, est)
        fn = f_norm(f)
        plane = abs(est.z - z_plane) < 1e-6

        if plane:
            plane_hits += 1
        if ok:
            conv_cnt += 1
        if (err > bad_thr) and (fn < fn_thr):
            bad_cnt += 1

        errs.append(err)
        max_err = max(max_err, err)

    mean_err = float(sum(errs) / len(errs))
    return mean_err, max_err, conv_cnt, bad_cnt, plane_hits


# -----------------------------
# Main
# -----------------------------
def main():
    random.seed(20251230)
    np.random.seed(20251230)

    print("===== TEST SUITE hybrid_scalable + GMC-Kalman (FULLER) =====")

    # ========== TEST 1: dist() ==========
    print("\n=== TEST 1: dist() ===")
    a = v3(0, 0, 0)
    b = v3(3, 4, 0)
    d = hs.dist(a, b)
    assert_true("dist == 5", abs(d - 5.0) < 1e-12)

    # ========== TEST 2: unit() ==========
    print("\n=== TEST 2: unit() ===")
    u = hs.unit(b, a)  # vector from a to b normalized? (depends hs.unit definition)
    # hs.unit(a,b) returns (a-b)/||a-b||, so hs.unit(b,a) == (b-a)/||b-a|| -> (0.6,0.8,0)
    assert_close("unit.x", u.x, 0.6, 1e-9)
    assert_close("unit.y", u.y, 0.8, 1e-9)
    assert_close("unit.z", u.z, 0.0, 1e-9)

    # ========== TEST 3: solve_3x3 vs numpy ==========
    print("\n=== TEST 3: solve_3x3() vs numpy.linalg.solve ===")
    ok_all = True
    trials = 20
    for k in range(trials):
        # random well-conditioned matrix
        M = np.random.randn(3, 3)
        # make it more likely invertible
        M = M + np.eye(3) * 0.5
        bb = np.random.randn(3)
        x_np = np.linalg.solve(M, bb)

        A = M.tolist()
        x_hs = hs.solve_3x3(A, bb.tolist())
        err = np.linalg.norm(x_np - np.array(x_hs))
        if err > 1e-6:
            ok_all = False
        if k < 3:
            print(f"[{k}] err={err:.3e}")
    assert_true("solve_3x3 close to numpy (<=1e-6)", ok_all)

    # ========== TEST 4: s_from_groundtruth residuals ideal=0 ==========
    print("\n=== TEST 4: s_from_groundtruth() -> residuals should be ~0 (noise=0) ===")
    anchors = make_anchors_coplanar_5x5(2.0)
    gt = v3(2.5, 2.5, 1.5)
    s = hs.s_from_groundtruth(anchors, gt, noise_std_m=0.0)
    f, J = hs.residual_and_jacobian_s(anchors, s, gt)
    fn = f_norm(f)
    print("residuals:", [f"{x:.3e}" for x in f], " | f_norm=", f"{fn:.3e}")
    assert_true("f_norm ~ 0", fn < 1e-10)

    # ========== TEST 5: Jacobian finite-difference check ==========
    print("\n=== TEST 5: residual_and_jacobian_s() finite-diff Jacobian check ===")
    # Use non-coplanar to avoid degeneracy; test a few random points
    anchors_nc = make_anchors_noncoplanar_5x5()
    okJ = True
    for i in range(5):
        gt_i = rand_tag_in_box(0.8, 4.2, 0.8, 4.2, 0.7, 2.0)
        s_i = hs.s_from_groundtruth(anchors_nc, gt_i, noise_std_m=0.02)
        x0 = rand_tag_in_box(0.8, 4.2, 0.8, 4.2, 0.7, 2.3)
        f_a, J_a = hs.residual_and_jacobian_s(anchors_nc, s_i, x0)
        J_a = np.array(J_a, dtype=float)
        J_n = numeric_jacobian(anchors_nc, s_i, x0, eps=1e-6)
        diff = np.max(np.abs(J_a - J_n))
        if diff > 5e-3:
            okJ = False
        print(f"[{i}] max|J_ana - J_num| = {diff:.3e}")
    assert_true("Jacobian matches finite-diff (max diff <=5e-3)", okJ)

    # ========== TEST 6: hybrid_solve_LM() single point ==========
    print("\n=== TEST 6: hybrid_solve_LM() one point (noise=2cm) ===")
    anchors = make_anchors_coplanar_5x5(2.0)
    gt = v3(2.5, 2.5, 1.5)
    s = hs.s_from_groundtruth(anchors, gt, noise_std_m=0.02)
    est, it, ok, cost = hs.hybrid_solve_LM(anchors, s)
    err = dist3(gt, est)
    print(f"GT={fmt_v(gt)} | EST={fmt_v(est)} | ERR={err:.3f} m | it={it} ok={ok} cost={cost:.3e}")
    assert_true("ok=True", ok)
    assert_true("err < 0.25m (typical)", err < 0.25)

    # ========== TEST 7: bad init behavior (EXPECTED FAIL) + rescue ==========
    print("\n=== TEST 7: hybrid_solve_LM() bad init (expected fail) + rescue ===")
    bad_init = v3(20.0, -10.0, 3.0)
    est2, it2, ok2, cost2 = hs.hybrid_solve_LM(anchors, s, init=bad_init)
    err2 = dist3(gt, est2)
    print(f"init={fmt_v(bad_init)} -> EST={fmt_v(est2)} ERR={err2:.3f} it={it2} ok={ok2} cost={cost2:.3e}")

    # 7A: Với init quá xa, LM có thể fail -> đây là EXPECTED
    assert_true("expected ok=False for extremely bad init", ok2 is False)

    # 7B: Rescue bằng multi-start với vài init hợp lý (dưới plane) -> phải kéo về tốt
    z_plane = 2.0
    rescue_inits = [
        v3(2.5, 2.5, 1.2),
        v3(2.5, 2.5, 1.6),
        v3(1.0, 4.0, 1.2),
        v3(4.0, 1.0, 1.2),
    ]
    est_r, it_r, ok_r, cost_r, fn_r, init_used = multi_start_solve(anchors, s, rescue_inits)
    err_r = dist3(gt, est_r)
    print(
        f"rescue best_init={fmt_v(init_used)} -> EST={fmt_v(est_r)} ERR={err_r:.3f} fn={fn_r:.3e} it={it_r} ok={ok_r} cost={cost_r:.3e}")
    assert_true("rescue ok", ok_r)
    assert_true("rescue err < 0.30m", err_r < 0.30)
    assert_true("rescue stays below plane", est_r.z <= z_plane + 1e-6)

    # ========== TEST 8: Multi-start should avoid mirror (use NON-coplanar anchors) ==========
    print("\n=== TEST 8: Multi-start (use non-coplanar anchors to avoid mirror) ===")
    anchors8 = make_anchors_noncoplanar_5x5()
    gt8 = v3(2.5, 2.5, 1.5)
    s8 = hs.s_from_groundtruth(anchors8, gt8, noise_std_m=0.02)

    inits8 = [
        v3(2.5, 2.5, 0.8),
        v3(2.5, 2.5, 1.5),
        v3(2.5, 2.5, 3.0),  # cho phép, nhưng non-coplanar sẽ không còn mirror dễ như trước
        v3(1.0, 4.0, 1.2),
    ]
    est_m, it_m, ok_m, cost_m, fn_m, init_used = multi_start_solve(anchors8, s8, inits8)
    err_m = dist3(gt8, est_m)
    print(
        f"best_init={fmt_v(init_used)} -> EST={fmt_v(est_m)} ERR={err_m:.3f} fn={fn_m:.3e} it={it_m} ok={ok_m} cost={cost_m:.3e}")
    assert_true("multi-start ok", ok_m)
    assert_true("multi-start err < 0.30m", err_m < 0.30)

    # ========== TEST 9: hybrid_from_raw equivalence ==========
    print("\n=== TEST 9: hybrid_from_raw() should match hybrid_solve_LM() output domain ===")
    # s = [d2, d3, d4, d01, d02]
    d2, d3, d4, d01, d02 = s[0], s[1], s[2], s[3], s[4]
    est_w, ok_w = hs.hybrid_from_raw(anchors, d01=d01, d02=d02, d2=d2, d3=d3, d4=d4)
    err_w = dist3(gt, est_w)
    print(f"EST(wrapper)={fmt_v(est_w)} ERR={err_w:.3f} ok={ok_w}")
    assert_true("wrapper ok", ok_w)

    # ========== TEST 10: stats coplanar vs non-coplanar ==========
    print("\n=== TEST 10: Stats compare (coplanar vs non-coplanar) ===")
    for noise in [0.00, 0.02, 0.05, 0.10]:
        mean_c, max_c, conv_c, bad_c, plane_c = run_stats_solver(make_anchors_coplanar_5x5(2.0), N=80, noise=noise, z_plane=2.0)
        mean_n, max_n, conv_n, bad_n, plane_n = run_stats_solver(make_anchors_noncoplanar_5x5(), N=80, noise=noise, z_plane=2.0)
        print(f"noise={noise:.2f} | COP: mean={mean_c:.3f} max={max_c:.3f} conv={conv_c}/80 bad={bad_c} plane={plane_c}"
              f" | NONCOP: mean={mean_n:.3f} max={max_n:.3f} conv={conv_n}/80 bad={bad_n} plane={plane_n}")

    # ========== TEST 11: gmc_kernel / weights basic properties ==========
    print("\n=== TEST 11: gmc_kernel() / gmc_weights_vec() properties ===")
    k0 = gmc.gmc_kernel(0.0, alpha=1.0, beta=1.0)
    k1 = gmc.gmc_kernel(0.5, alpha=1.0, beta=1.0)
    k2 = gmc.gmc_kernel(2.0, alpha=1.0, beta=1.0)
    print(f"k(0)= {k0:.6f}, k(0.5)= {k1:.6f}, k(2.0)= {k2:.6f}")
    assert_true("k(0)==1", abs(k0 - 1.0) < 1e-12)
    assert_true("monotonic decreasing with |e|", (k0 >= k1 >= k2) and (k2 > 0.0))

    v = np.array([0.0, 0.5, -2.0]).reshape(3, 1)
    w = gmc.gmc_weights_vec(v, alpha=1.0, beta=1.0).reshape(-1)
    print("weights:", [f"{x:.6f}" for x in w])
    assert_true("w in (0,1]", all((0.0 < x <= 1.0) for x in w))

    # ========== TEST 12: safe_gamma accuracy vs math.gamma ==========
    print("\n=== TEST 12: safe_gamma() accuracy check vs math.gamma ===")
    zs = [0.2, 0.5, 0.8, 1.2, 2.5, 3.3, 5.0]
    okG = True
    for z in zs:
        g1 = gmc.safe_gamma(z)
        g2 = math.gamma(z)
        rel = abs(g1 - g2) / (abs(g2) + 1e-12)
        if rel > 1e-10:  # should be tiny because uses math.gamma when available
            okG = False
        print(f"z={z:.2f} safe={g1:.12e} math={g2:.12e} rel={rel:.3e}")
    assert_true("safe_gamma ~ math.gamma (rel<=1e-10)", okG)

    # ========== TEST 13: Kalman reset/predict/update gating ==========
    print("\n=== TEST 13: AdaptiveGMCKalman3D reset/predict/update gating ===")
    kf = gmc.AdaptiveGMCKalman3D(process_var=0.9, meas_var=0.25, alpha=1.0, beta_init=1.0)
    true_pos = gmc.Vec3(2.5, 2.5, 1.5)
    kf.reset(true_pos)

    before = kf.get_state_vec3()
    kf.predict(dt=0.1)
    after_pred = kf.get_state_vec3()
    # predict doesn't change x in this simple model; only P changes
    assert_true("predict keeps x same", dist3(v3(before.x, before.y, before.z), v3(after_pred.x, after_pred.y, after_pred.z)) < 1e-12)

    # gating: hybrid_cost too large => no update
    meas = gmc.Vec3(10.0, 10.0, 10.0)
    est_gated, dbg = kf.update_debug(meas, hybrid_cost=10.0, hybrid_max_cost=3.0)
    assert_true("gated==True", dbg.get("gated", False) is True)

    # ========== TEST 14: axis-wise outlier weights (Z spike) ==========
    print("\n=== TEST 14: axis-wise weights should down-weight Z spike ===")
    kf2 = gmc.AdaptiveGMCKalman3D(process_var=0.9, meas_var=0.25, alpha=1.0, beta_init=1.0)
    kf2.reset(true_pos)

    # small noise measurement
    meas1 = gmc.Vec3(2.55, 2.45, 1.52)
    kf2.predict(0.1)
    est1, dbg1 = kf2.update_debug(meas1, hybrid_cost=0.1, hybrid_max_cost=3.0)
    print("w (normal):", dbg1["w"], "Rdiag:", dbg1["Rdiag"])

    # big z outlier
    meas2 = gmc.Vec3(2.55, 2.45, 1.52 + 1.8)
    kf2.predict(0.1)
    est2, dbg2 = kf2.update_debug(meas2, hybrid_cost=0.1, hybrid_max_cost=3.0)
    wx, wy, wz = dbg2["w"]
    print("w (z-outlier):", dbg2["w"], "Rdiag:", dbg2["Rdiag"])
    assert_true("wz << wx,wy (down-weight z)", (wz < wx) and (wz < wy))

    # ========== TEST 15: Robustness demo (stationary + one big outlier) ==========
    print("\n=== TEST 15: GMC robustness stationary + one outlier ===")
    kf3 = gmc.AdaptiveGMCKalman3D(process_var=0.9, meas_var=0.25, alpha=1.0, beta_init=1.0)
    kf3.reset(true_pos)
    random.seed(20251230)

    meas_errs = []
    est_errs = []

    for i in range(1, 31):
        # gaussian measurement noise
        mx = true_pos.x + random.gauss(0, 0.20)
        my = true_pos.y + random.gauss(0, 0.20)
        mz = true_pos.z + random.gauss(0, 0.20)
        if i == 15:
            mz += 1.8  # outlier
            print(">>> OUTLIER +1.8m on Z <<<")

        meas_i = gmc.Vec3(mx, my, mz)

        kf3.predict(0.1)
        est_i = kf3.update(meas_i, hybrid_cost=0.1, hybrid_max_cost=3.0)

        em = math.dist((mx, my, mz), (true_pos.x, true_pos.y, true_pos.z))
        ee = math.dist((est_i.x, est_i.y, est_i.z), (true_pos.x, true_pos.y, true_pos.z))
        meas_errs.append(em)
        est_errs.append(ee)

        if i <= 5 or i in [14, 15, 16]:
            print(f"[{i:02d}] MEAS={em:.3f} -> EST={ee:.3f} | EST={est_i.x:.2f},{est_i.y:.2f},{est_i.z:.2f}")

    print("----------------------------------------")
    print(f"Mean MEAS error = {sum(meas_errs)/len(meas_errs):.3f} m")
    print(f"Mean EST  error = {sum(est_errs)/len(est_errs):.3f} m")
    assert_true("EST mean error < MEAS mean error", (sum(est_errs) / len(est_errs)) < (sum(meas_errs) / len(meas_errs)))

    print("\nDone.")


if __name__ == "__main__":
    main()
