# import math
# import matplotlib.pyplot as plt
#
# from hybrid_scalable import (
#     Vec3 as HVec3,
#     s_from_groundtruth,
#     hybrid_solve_LM,
#     dist,
# )
#
# from gmc_kalman_filter import (
#     Vec3 as KVec3,
#     AdaptiveGMCKalman3D,
# )
#
#
# # ================== CONFIG ==================
# DT = 0.1
# STEPS = 100
# NOISE_STD = 0.07
#
# # Đánh số mới: 0 → 4
# SCENARIOS = [0, 1, 2, 3, 4]
#
#
# def to_kvec(v: HVec3) -> KVec3:
#     return KVec3(v.x, v.y, v.z)
#
#
# def to_hvec(v: KVec3) -> HVec3:
#     return HVec3(v.x, v.y, v.z)
#
#
# # ================== SMOOTH & RMSE ==================
# def smooth(y, k=4):
#     out = []
#     for i in range(len(y)):
#         l = max(0, i-k)
#         r = min(len(y), i+k)
#         out.append(sum(y[l:r]) / (r-l))
#     return out
#
#
# def rolling_rmse(arr):
#     rmse = []
#     s = 0
#     for i, v in enumerate(arr, start=1):
#         s += v*v
#         rmse.append(math.sqrt(s / i))
#     return rmse
#
#
# # ================== ANCHOR LAYOUTS ==================
# def anchors_for_scenario(sid: int):
#
#     # ---------- S0 (baseline) ----------
#     if sid == 0:
#         return [
#             HVec3(0.0, 0.0, 2.0),
#             HVec3(5.0, 0.0, 2.0),
#             HVec3(0.0, 5.0, 2.0),
#             HVec3(5.0, 5.0, 2.7),
#         ]
#
#     # ---------- S1 (đổi độ cao – từ S2 cũ) ----------
#     if sid == 1:
#         return [
#             HVec3(0.0, 0.0, 2.1),
#             HVec3(5.0, 0.0, 2.4),
#             HVec3(0.0, 5.0, 1.9),
#             HVec3(5.0, 5.0, 2.8),
#         ]
#
#     # ---------- S2 (1 anchor gần giữa – từ S3 cũ) ----------
#     if sid == 2:
#         return [
#             HVec3(0.0, 0.0, 2.0),
#             HVec3(5.0, 0.0, 2.0),
#             HVec3(0.5, 3.5, 2.0),
#             HVec3(5.0, 5.0, 2.7),
#         ]
#
#     # ---------- S3 (cluster nhẹ – từ S5 cũ) ----------
#     if sid == 3:
#         return [
#             HVec3(0.5, 0.5, 2.0),
#             HVec3(4.5, 0.5, 2.0),
#             HVec3(0.7, 4.3, 2.1),
#             HVec3(4.3, 4.4, 2.6),
#         ]
#
#     # ---------- S4 (thẳng hàng – từ S6 cũ) ----------
#     if sid == 4:
#         return [
#             HVec3(0.0, 0.0, 2.0),
#             HVec3(2.0, 0.0, 2.0),
#             HVec3(4.0, 0.0, 2.0),
#             HVec3(6.0, 0.0, 2.0),
#         ]
#
#     raise ValueError(f"Invalid scenario id: {sid}")
#
#
# # ================== TAG TRAJECTORY ==================
# def gt_path(t: float, sid: int) -> HVec3:
#     cx, cy = 2.5, 2.5
#     base_r = 0.6
#
#     ang1 = 0.6 * t
#     ang2 = 0.5 * t
#
#     x = cx + base_r * math.sin(ang1)
#     y = cy + base_r * math.cos(ang2)
#     z = 1.5 + 0.2 * math.sin(0.4 * t + 0.2 * sid)
#
#     return HVec3(x, y, z)
#
#
# # ================== SIMULATION ==================
# def simulate_scenario(sid: int):
#     anchors = anchors_for_scenario(sid)
#
#     kf = AdaptiveGMCKalman3D(
#         process_var=0.3,
#         meas_var=0.01,
#         alpha=1.0,
#         beta_init=1.0,
#     )
#
#     t0 = 0.0
#     gt0 = gt_path(t0, sid)
#     s0 = s_from_groundtruth(anchors, gt0, NOISE_STD)
#     est0, _, _, _ = hybrid_solve_LM(anchors, s0)
#     kf.reset(to_kvec(est0))
#
#     times = []
#     err_kf = []
#
#     for step in range(1, STEPS + 1):
#         t = step * DT
#         gt = gt_path(t, sid)
#
#         s_meas = s_from_groundtruth(anchors, gt, NOISE_STD)
#         est_hyb, _, _, cost = hybrid_solve_LM(anchors, s_meas)
#
#         kf.predict(DT)
#         est_k = kf.update(to_kvec(est_hyb), hybrid_cost=cost, hybrid_max_cost=2.0)
#
#         err = dist(gt, to_hvec(est_k))
#
#         times.append(t)
#         err_kf.append(err)
#
#     mean_err = sum(err_kf) / len(err_kf)
#     max_err = max(err_kf)
#
#     return times, err_kf, mean_err, max_err
#
#
# # ================== MAIN ==================
# def run():
#     print("===== FINAL SCENARIOS – S0 / S1 / S2 / S3 / S4 =====")
#
#     all_times = []
#     all_errs = []
#     stats = []
#     rmse_trends = []
#
#     for sid in SCENARIOS:
#         t, e, mean_e, max_e = simulate_scenario(sid)
#
#         all_times.append(t)
#         all_errs.append(e)
#         stats.append((sid, mean_e, max_e))
#         rmse_trends.append(rolling_rmse(e))
#
#         print(f"S{sid}: mean={mean_e:.3f} m | max={max_e:.3f} m")
#
#     colors = ["tab:blue","tab:orange","tab:green","tab:red","tab:purple"]
#
#     # FIGURE 1 – ERROR (SMOOTHED)
#     plt.figure(figsize=(12,6))
#     plt.title("Position Error vs Time – Final Selected Scenarios (Smoothed)\nHybrid LM + Adaptive GMC–Kalman", weight="bold")
#
#     for i, sid in enumerate(SCENARIOS):
#         _, mean_e, max_e = stats[i]
#         label = f"S{sid} | mean={mean_e:.3f} m, max={max_e:.3f} m"
#
#         plt.plot(
#             all_times[i],
#             smooth(all_errs[i], k=4),
#             linewidth=2.2,
#             alpha=0.9,
#             color=colors[i],
#             label=label
#         )
#
#     plt.xlabel("Time (s)")
#     plt.ylabel("Error (m)")
#     plt.ylim(0.0, 4.0)
#     plt.grid(True, alpha=0.35)
#     plt.legend()
#     plt.tight_layout()
#     plt.show()
#
#     # FIGURE 2 – RMSE Trend
#     plt.figure(figsize=(12,6))
#     plt.title("RMSE Trend Over Time – Final UWB Scenarios\nHybrid LM + Adaptive GMC–Kalman", weight="bold")
#
#     for i, sid in enumerate(SCENARIOS):
#         plt.plot(
#             all_times[i],
#             rmse_trends[i],
#             linewidth=2.4,
#             color=colors[i],
#             label=f"S{sid}"
#         )
#
#     plt.xlabel("Time (s)")
#     plt.ylabel("RMSE (m)")
#     plt.ylim(0.0, 4.0)
#     plt.grid(True, alpha=0.35)
#     plt.legend()
#     plt.tight_layout()
#     plt.show()
#
#
# if __name__ == "__main__":
#     run()


import math
import matplotlib.pyplot as plt

from hybrid_scalable import Vec3 as HVec3, s_from_groundtruth, hybrid_solve_LM
from gmc_kalman_filter import AdaptiveGMCKalman3D, Vec3 as KVec3

# ================== CONFIG (match main.py) ==================
SCENARIO_DUR_S = 10.0
NUM_SCENARIOS = 6

DT = 0.1
NOISE_STD_M = 0.05     # 5 cm synthetic noise
LOG_EVERY_N = 10

HEIGHT_PRIOR_M = 1.55
HEIGHT_PRIOR_ALPHA = 0.10   # reduce height bias (was 0.30)

GUARD_COST_OK = 0.02
GUARD_INNOV_M = 0.50

# --- KF params (tuned, not hardcode) ---
MEAS_VAR = NOISE_STD_M ** 2      # 0.0025 for 5cm
PROCESS_VAR = 0.22               # slightly more responsive (less lag)

# =========================================================
# Utils
# =========================================================
def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def dist3(a, b):
    return math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2)

# room(x,z,y) <-> solver(x,y,z)
def room_to_solver(v: HVec3) -> HVec3:
    # room:  (x, y(height), z)  -> solver: (x, y=room.z, z=room.y)
    return HVec3(v.x, v.z, v.y)

def solver_to_room(v: HVec3) -> HVec3:
    # solver: (x, y=room.z, z=room.y) -> room: (x, y=solver.z, z=solver.y)
    return HVec3(v.x, v.z, v.y)

def apply_height_prior_h(v: HVec3) -> HVec3:
    if HEIGHT_PRIOR_ALPHA <= 0:
        return v
    z = (1 - HEIGHT_PRIOR_ALPHA) * v.z + HEIGHT_PRIOR_ALPHA * HEIGHT_PRIOR_M
    return HVec3(v.x, v.y, z)

def apply_height_prior_k(v: KVec3) -> KVec3:
    if HEIGHT_PRIOR_ALPHA <= 0:
        return v
    z = (1 - HEIGHT_PRIOR_ALPHA) * v.z + HEIGHT_PRIOR_ALPHA * HEIGHT_PRIOR_M
    return KVec3(v.x, v.y, z)

# =========================================================
# Scenarios (COPY from main.py)
# =========================================================
def anchors_for_scenario(idx):
    if idx == 0:
        return [HVec3(0,2.8,0), HVec3(12,2.8,0), HVec3(0,2.8,12), HVec3(12,2.8,12)]
    if idx == 1:
        return [HVec3(1,2.8,1), HVec3(11,2.8,1), HVec3(1,2.8,11), HVec3(11,2.8,11)]
    if idx == 2:
        return [HVec3(0,2.8,0), HVec3(12,2.8,0), HVec3(0,1.4,12), HVec3(12,1.4,12)]
    if idx == 3:
        return [HVec3(0,2.8,0), HVec3(12,1.4,0), HVec3(0,2.0,12), HVec3(12,2.8,12)]
    if idx == 4:
        return [HVec3(0,2.0,0), HVec3(4,2.0,0), HVec3(8,2.0,0), HVec3(12,2.2,2)]
    if idx == 5:
        return [HVec3(0,2.0,0), HVec3(0.5,2.0,0.1), HVec3(1.0,2.0,0), HVec3(1.5,2.1,0.1)]
    return anchors_for_scenario(0)

def tag_trajectory(seg_t, idx):
    cx, cz = 6.0, 6.0
    rx, rz = [(5,4.2),(5.2,2.8),(4.2,5.2),(4.8,4.8),(5.6,2.0),(5.6,2.0)][idx]
    ang = 2*math.pi*seg_t/SCENARIO_DUR_S

    x = cx + rx*math.cos(ang)
    z = cz + rz*math.sin(ang)
    y = 1.55 + 0.18*math.sin(1.2*ang)

    return HVec3(
        clamp(x,0.6,11.4),
        clamp(y,1.2,2.2),
        clamp(z,0.6,11.4),
    )

# =========================================================
# Plot helpers
# =========================================================
def smooth(y, k=4):
    out = []
    for i in range(len(y)):
        l = max(0, i-k)
        r = min(len(y), i+k+1)
        out.append(sum(y[l:r]) / (r-l))
    return out

def p90(arr):
    if not arr:
        return float("nan")
    a = sorted(arr)
    return a[int(0.9 * (len(a)-1))]

# =========================================================
# Core simulation for one scenario segment (10s)
# =========================================================
def run_one_scenario(sidx: int):
    anchors_room = anchors_for_scenario(sidx)
    anchors_sol = [room_to_solver(a) for a in anchors_room]

    kf = AdaptiveGMCKalman3D(
        process_var=PROCESS_VAR,
        meas_var=MEAS_VAR,
        alpha=1.0,
    )

    # init like main.py
    gt0_room = tag_trajectory(0.0, sidx)
    gt0_sol = room_to_solver(gt0_room)
    s0 = s_from_groundtruth(anchors_sol, gt0_sol, NOISE_STD_M)
    est0, _, ok0, _ = hybrid_solve_LM(anchors_sol, s0)

    if ok0:
        est0 = apply_height_prior_h(est0)
        kf.reset(apply_height_prior_k(KVec3(est0.x, est0.y, est0.z)))
    else:
        kf.reset(KVec3(6.0, 6.0, HEIGHT_PRIOR_M))

    times = []
    err_raw_cm = []
    err_kf_cm = []

    for step in range(1, int(SCENARIO_DUR_S / DT) + 1):
        t = step * DT
        gt_room = tag_trajectory(t, sidx)
        gt_sol = room_to_solver(gt_room)

        s = s_from_groundtruth(anchors_sol, gt_sol, NOISE_STD_M)

        # init from KF state like main.py
        k_state = kf.get_state_vec3()
        init = apply_height_prior_h(HVec3(k_state.x, k_state.y, k_state.z))

        est_sol, it, ok, cost = hybrid_solve_LM(anchors_sol, s, init=init)
        if ok:
            est_sol = apply_height_prior_h(est_sol)

        # RAW error in ROOM frame
        est_room_raw = solver_to_room(est_sol)
        raw_cm = 100.0 * dist3(est_room_raw, gt_room)

        # KF step
        kf.predict(DT)

        did_reset = False
        innov_m = float("nan")

        if ok:
            meas = apply_height_prior_k(KVec3(est_sol.x, est_sol.y, est_sol.z))
            pred = apply_height_prior_k(kf.get_state_vec3())
            innov_m = math.sqrt((meas.x - pred.x)**2 + (meas.y - pred.y)**2 + (meas.z - pred.z)**2)

            if cost <= GUARD_COST_OK and innov_m > GUARD_INNOV_M:
                kf.reset(meas)
                smoothed = meas
                did_reset = True
            else:
                smoothed = kf.update(meas, cost)
        else:
            smoothed = kf.get_state_vec3()

        out_room = solver_to_room(HVec3(smoothed.x, smoothed.y, smoothed.z))
        kf_cm = 100.0 * dist3(out_room, gt_room)

        times.append(t)
        err_raw_cm.append(raw_cm)
        err_kf_cm.append(kf_cm)

        if step % LOG_EVERY_N == 0:
            flag = "RST" if did_reset else "   "
            print(
                f"[S{sidx} t={t:5.2f}s] it={it:3d} cost={cost:6.3f} "
                f"innov={innov_m:4.2f}m {flag} "
                f"raw={raw_cm:6.1f}cm  kf={kf_cm:6.1f}cm"
            )

    stats = {
        "raw_mean": sum(err_raw_cm)/len(err_raw_cm),
        "raw_p90": p90(err_raw_cm),
        "raw_max": max(err_raw_cm),
        "kf_mean": sum(err_kf_cm)/len(err_kf_cm),
        "kf_p90": p90(err_kf_cm),
        "kf_max": max(err_kf_cm),
    }

    return times, err_raw_cm, err_kf_cm, stats

# =========================================================
# MAIN (2 figures: S0-S3, S4-S5)
# =========================================================
def run():
    print("\n===== OFFLINE PLOT (SAME AS main.py) – Hybrid raw vs GMC-KF =====\n")
    print(f"Params: meas_var={MEAS_VAR:.4f} | proc_var={PROCESS_VAR:.2f} | h_alpha={HEIGHT_PRIOR_ALPHA:.2f}\n")

    colors = ["tab:blue","tab:orange","tab:green","tab:red","tab:purple","tab:brown"]

    # Collect all scenarios
    all_times = []
    all_raw = []
    all_kf = []
    all_stats = []

    for sidx in range(NUM_SCENARIOS):
        t, raw_cm, kf_cm, st = run_one_scenario(sidx)
        all_times.append(t)
        all_raw.append(raw_cm)
        all_kf.append(kf_cm)
        all_stats.append(st)

        print(
            f"=== S{sidx} DONE | "
            f"RAW mean={st['raw_mean']:5.1f}cm p90={st['raw_p90']:5.1f}cm max={st['raw_max']:5.1f}cm || "
            f"KF  mean={st['kf_mean']:5.1f}cm p90={st['kf_p90']:5.1f}cm max={st['kf_max']:5.1f}cm"
        )

    # ---------------- FIG 1: S0-S3 ----------------
    plt.figure(figsize=(12, 6))
    plt.title(
        "Error vs Time (cm) – S0–S3 (Good/Moderate Geometry)\n"
        f"Hybrid (raw) vs GMC–Kalman | meas_var={MEAS_VAR:.4f} | proc_var={PROCESS_VAR:.2f} | h_alpha={HEIGHT_PRIOR_ALPHA:.2f}",
        weight="bold",
    )

    for sidx in range(0, 4):
        st = all_stats[sidx]
        c = colors[sidx]
        plt.plot(all_times[sidx], smooth(all_raw[sidx]), "--", color=c, alpha=0.45,
                 label=f"S{sidx} RAW (mean {st['raw_mean']:.0f}cm)")
        plt.plot(all_times[sidx], smooth(all_kf[sidx]), "-", color=c, linewidth=2.4,
                 label=f"S{sidx} KF  (mean {st['kf_mean']:.0f}cm)")

    plt.xlabel("Time (s)")
    plt.ylabel("Error (cm)")
    plt.ylim(0, 70)   # tuned for readability (S0-S3)
    plt.grid(True, alpha=0.35)
    plt.legend(ncol=2)
    plt.tight_layout()
    plt.show()

    # ---------------- FIG 2: S4-S5 ----------------
    plt.figure(figsize=(12, 6))
    plt.title(
        "Error vs Time (cm) – S4–S5 (Challenging Geometry: near-collinear / cluster)\n"
        f"Hybrid (raw) vs GMC–Kalman | meas_var={MEAS_VAR:.4f} | proc_var={PROCESS_VAR:.2f} | h_alpha={HEIGHT_PRIOR_ALPHA:.2f}",
        weight="bold",
    )

    for sidx in (4, 5):
        st = all_stats[sidx]
        c = colors[sidx]
        plt.plot(all_times[sidx], smooth(all_raw[sidx]), "--", color=c, alpha=0.45,
                 label=f"S{sidx} RAW (mean {st['raw_mean']:.0f}cm)")
        plt.plot(all_times[sidx], smooth(all_kf[sidx]), "-", color=c, linewidth=2.6,
                 label=f"S{sidx} KF  (mean {st['kf_mean']:.0f}cm)")

    plt.xlabel("Time (s)")
    plt.ylabel("Error (cm)")
    # auto ylim but keep some headroom
    ymax = max(max(all_raw[4]), max(all_kf[4]), max(all_raw[5]), max(all_kf[5]))
    plt.ylim(0, max(120, math.ceil((ymax + 15) / 10) * 10))
    plt.grid(True, alpha=0.35)
    plt.legend(ncol=2)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    run()
