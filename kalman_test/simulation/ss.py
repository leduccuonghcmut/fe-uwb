# import math
# import time
# import matplotlib.pyplot as plt
#
# from hybrid_scalable import (
#     Vec3 as HVec3,
#     dist,
#     s_from_groundtruth,
#     hybrid_solve_LM,
# )
#
# from gmc_kalman_filter import (
#     Vec3 as KVec3,
#     AdaptiveGMCKalman3D,
# )
#
#
# def to_kvec(v: HVec3) -> KVec3:
#     return KVec3(v.x, v.y, v.z)
#
# def to_hvec(v: KVec3) -> HVec3:
#     return HVec3(v.x, v.y, v.z)
#
#
# anchors = [
#     HVec3(0, 0, 2.0),
#     HVec3(5, 0, 2.0),
#     HVec3(0, 5, 2.0),
#     HVec3(5, 5, 2.7),
# ]
#
#
# def gt_path(i: int) -> HVec3:
#     return HVec3(
#         2.5 + 0.6 * math.sin(i * 0.18),
#         2.5 + 0.6 * math.cos(i * 0.16),
#         1.5 + 0.25 * math.sin(i * 0.35),
#     )
#
#
# def run():
#     print("\n===== PAPER-STYLE HYBRID + GMC-KF 3D LOG =====")
#
#     # KF tuning
#     kf = AdaptiveGMCKalman3D(
#         process_var=0.6,
#         meas_var=0.35,
#         alpha=1.0,
#         beta_init=1.0
#     )
#
#     noise_std = 0.05
#     steps = 40
#
#     # Init bằng Hybrid
#     gt0 = gt_path(1)
#     s0 = s_from_groundtruth(anchors, gt0, noise_std)
#     est0, it0, ok0, cost0 = hybrid_solve_LM(anchors, s0)
#     kf.reset(to_kvec(est0))
#
#     print(f"[INIT] GT={gt0} | HYB_INIT={est0} err={dist(gt0,est0):.3f} cost={cost0:.6f} it={it0} ok={ok0}")
#
#     print("\nidx | err_meas  err_hyb   err_kf  | cost_hyb it ok | FLAG  | RMSE(KF)  RMSE(HYB) | MAE(KF)  MAE(HYB) | Impact(%)")
#     print("-"*160)
#
#     # ================== DATA FOR PLOTS ==================
#     frames, hyb_err_list, kf_err_list = [], [], []
#     rmse_kf_list, rmse_hyb_list, impact_list, reject_marks = [], [], [], []
#
#     sse_kf = sse_hyb = sae_kf = sae_hyb = 0.0
#
#     # ================== MAIN LOOP ==================
#     for i in range(1, steps + 1):
#         gt = gt_path(i)
#         s = s_from_groundtruth(anchors, gt, noise_std)
#
#         est, it, ok, cost = hybrid_solve_LM(anchors, s)
#         err_h = dist(gt, est)
#
#         # Inject outlier
#         if i == 18:
#             print("\n>>> INJECT OUTLIER: Hybrid z += 1.5m <<<")
#             est = HVec3(est.x, est.y, est.z + 1.5)
#             err_h = dist(gt, est)
#
#         kf.predict(dt=0.1)
#
#         est_kf, dbg = kf.update_debug(
#             to_kvec(est),
#             hybrid_cost=cost,
#             hybrid_max_cost=2.0
#         )
#
#         err_k = dist(gt, to_hvec(est_kf))
#         err_meas = err_h
#
#         # Running metrics
#         sse_kf += err_k**2
#         sse_hyb += err_h**2
#         sae_kf += err_k
#         sae_hyb += err_h
#
#         rmse_kf = math.sqrt(sse_kf / i)
#         rmse_hyb = math.sqrt(sse_hyb / i)
#         mae_kf = sae_kf / i
#         mae_hyb = sae_hyb / i
#
#         impact = max(0.0, (1 - rmse_kf / rmse_hyb) * 100.0)
#         flag = "REJECT" if dbg.get("gated", False) else "GOOD"
#
#         print(
#             f"[{i:02d}] | {err_meas:7.3f}  {err_h:7.3f}  {err_k:7.3f} | "
#             f"{cost:8.4f} {it:2d} {int(ok)} | {flag:6} | "
#             f"{rmse_kf:8.3f}   {rmse_hyb:8.3f} | "
#             f"{mae_kf:7.3f}   {mae_hyb:7.3f} | "
#             f"{impact:6.2f}"
#         )
#
#         frames.append(i)
#         hyb_err_list.append(err_h)
#         kf_err_list.append(err_k)
#         rmse_kf_list.append(rmse_kf)
#         rmse_hyb_list.append(rmse_hyb)
#         impact_list.append(impact)
#         reject_marks.append(flag == "REJECT")
#
#         time.sleep(0.02)
#
#     # ================== BEAUTIFUL IEEE PLOTS ==================
#     plt.rcParams.update({
#         "font.size": 10,
#         "axes.labelsize": 11,
#         "axes.titlesize": 12,
#         "legend.fontsize": 9,
#         "figure.titlesize": 13
#     })
#
#     fig = plt.figure(figsize=(13,8))
#     fig.suptitle("Hybrid Localization with Adaptive GMC-Kalman Filter", weight="bold")
#
#     # -------- Plot 1 --------
#     ax1 = plt.subplot(3,1,1)
#     ax1.plot(frames, hyb_err_list, '-o', lw=2.2, label="Hybrid Error")
#     ax1.plot(frames, kf_err_list, '-o', lw=2.2, label="KF Error")
#
#     # Highlight OUTLIER region
#     ax1.axvspan(18-0.5, 18+0.5, color="red", alpha=0.12)
#     ax1.annotate("Injected Outlier", xy=(18, max(hyb_err_list)),
#                  xytext=(20, max(hyb_err_list)+0.2),
#                  arrowprops=dict(facecolor='red', shrink=0.05))
#
#     # Mark reject frames
#     for i, r in enumerate(reject_marks):
#         if r:
#             ax1.scatter(frames[i], kf_err_list[i], color="red", s=50, zorder=5)
#
#     ax1.set_ylabel("Error (m)")
#     ax1.set_title("Instant Position Error")
#     ax1.grid(True, alpha=0.35)
#     ax1.legend()
#
#     # -------- Plot 2 --------
#     ax2 = plt.subplot(3,1,2)
#     ax2.plot(frames, rmse_hyb_list, lw=2.2, label="Hybrid RMSE")
#     ax2.plot(frames, rmse_kf_list, lw=2.2, label="KF RMSE")
#
#     ax2.set_ylabel("RMSE (m)")
#     ax2.set_title("Cumulative RMSE")
#     ax2.grid(True, alpha=0.35)
#     ax2.legend()
#
#     # -------- Plot 3 --------
#     ax3 = plt.subplot(3,1,3)
#     ax3.plot(frames, impact_list, lw=2.4, label="Impact (%)", color="tab:blue")
#
#     ax3.axhline(0, color="black", linestyle="--", lw=1)
#     ax3.set_ylabel("Improvement %")
#     ax3.set_xlabel("Frame")
#     ax3.set_title("Impact of GMC-KF vs Hybrid")
#     ax3.grid(True, alpha=0.35)
#     ax3.legend()
#
#     plt.tight_layout()
#     plt.show()
#
#
# if __name__ == "__main__":
#     run()


# test_2d_vs_3d_geometry.py
import math, random
import main  # file main.py của bạn

def dist2_floor(room_a, room_b):
    # room coord trong main.py: (x, y=height, z)
    return math.sqrt((room_a.x-room_b.x)**2 + (room_a.z-room_b.z)**2)

def percentile(xs, p):
    xs = sorted(xs)
    if not xs:
        return float("nan")
    i = int(p*(len(xs)-1))
    return xs[i]

def run_one_scenario(sidx, secs=10.0, dt=0.1, seed=7):
    random.seed(seed)

    # tạo KF mới (tránh dùng global kf)
    kf = main.AdaptiveGMCKalman3D(process_var=0.15, meas_var=0.01, alpha=1.0)

    anchors_room = main.anchors_for_scenario(sidx)
    anchors_sol  = [main.room_to_solver(a) for a in anchors_room]

    # init KF bằng 1 lần solve ban đầu (giống main.py)
    gt0_room = main.tag_trajectory(0.0, sidx)
    gt0_sol  = main.room_to_solver(gt0_room)
    s0 = main.s_from_groundtruth(anchors_sol, gt0_sol, main.NOISE_STD_M)
    est0, _, ok0, _ = main.hybrid_solve_LM(anchors_sol, s0)
    if ok0 and est0 is not None:
        est0 = main.apply_height_prior_h(est0)
        kf.reset(main.apply_height_prior_k(main.KVec3(est0.x, est0.y, est0.z)))

    err2_list = []
    err3_list = []

    steps = int(secs / dt)
    for k in range(steps):
        seg = k * dt

        gt_room = main.tag_trajectory(seg, sidx)
        gt_sol  = main.room_to_solver(gt_room)

        s = main.s_from_groundtruth(anchors_sol, gt_sol, main.NOISE_STD_M)

        init_h = main.apply_height_prior_h(main.HVec3(*kf.get_state_vec3().__dict__.values()))
        est, it, ok, cost = main.hybrid_solve_LM(anchors_sol, s, init=init_h)
        if ok and est is not None:
            est = main.apply_height_prior_h(est)

        kf.predict(dt)

        if ok and est is not None:
            meas = main.apply_height_prior_k(main.KVec3(est.x, est.y, est.z))
            pred = main.apply_height_prior_k(kf.get_state_vec3())
            innov_m = main.dist3(meas, pred)

            # giống logic "RST" trong main.py
            if cost <= main.GUARD_COST_OK and innov_m > main.GUARD_INNOV_M:
                kf.reset(meas)
                smoothed = meas
            else:
                smoothed = kf.update(meas, cost)
        else:
            smoothed = kf.get_state_vec3()

        out_room = main.solver_to_room(main.HVec3(smoothed.x, smoothed.y, smoothed.z))

        err2 = dist2_floor(out_room, gt_room)
        err3 = main.dist3(out_room, gt_room)
        err2_list.append(err2)
        err3_list.append(err3)

    def summarize(name, errs_m):
        mean = sum(errs_m)/len(errs_m)
        p90  = percentile(errs_m, 0.90)
        mx   = max(errs_m)
        print(f"{name}: mean={mean*100:5.1f}cm  p90={p90*100:5.1f}cm  max={mx*100:5.1f}cm  N={len(errs_m)}")

    summarize(f"S{sidx} err2D(xz)", err2_list)
    summarize(f"S{sidx} err3D(xyz)", err3_list)
    print()

if __name__ == "__main__":
    # So sánh đồng phẳng vs lệch cao
    run_one_scenario(0)  # S0
    run_one_scenario(2)  # S2
