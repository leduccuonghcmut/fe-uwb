import math
import matplotlib.pyplot as plt

from hybrid_scalable import (
    Vec3 as HVec3,
    s_from_groundtruth,
    hybrid_solve_LM,
    dist,
)

from gmc_kalman_filter import (
    Vec3 as KVec3,
    AdaptiveGMCKalman3D,
)


# ================== CONFIG ==================
DT = 0.1
STEPS = 100
NOISE_STD = 0.07

# Đánh số mới: 0 → 4
SCENARIOS = [0, 1, 2, 3, 4]


def to_kvec(v: HVec3) -> KVec3:
    return KVec3(v.x, v.y, v.z)


def to_hvec(v: KVec3) -> HVec3:
    return HVec3(v.x, v.y, v.z)


# ================== SMOOTH & RMSE ==================
def smooth(y, k=4):
    out = []
    for i in range(len(y)):
        l = max(0, i-k)
        r = min(len(y), i+k)
        out.append(sum(y[l:r]) / (r-l))
    return out


def rolling_rmse(arr):
    rmse = []
    s = 0
    for i, v in enumerate(arr, start=1):
        s += v*v
        rmse.append(math.sqrt(s / i))
    return rmse


# ================== ANCHOR LAYOUTS ==================
def anchors_for_scenario(sid: int):

    # ---------- S0 (baseline) ----------
    if sid == 0:
        return [
            HVec3(0.0, 0.0, 2.0),
            HVec3(5.0, 0.0, 2.0),
            HVec3(0.0, 5.0, 2.0),
            HVec3(5.0, 5.0, 2.7),
        ]

    # ---------- S1 (đổi độ cao – từ S2 cũ) ----------
    if sid == 1:
        return [
            HVec3(0.0, 0.0, 2.1),
            HVec3(5.0, 0.0, 2.4),
            HVec3(0.0, 5.0, 1.9),
            HVec3(5.0, 5.0, 2.8),
        ]

    # ---------- S2 (1 anchor gần giữa – từ S3 cũ) ----------
    if sid == 2:
        return [
            HVec3(0.0, 0.0, 2.0),
            HVec3(5.0, 0.0, 2.0),
            HVec3(0.5, 3.5, 2.0),
            HVec3(5.0, 5.0, 2.7),
        ]

    # ---------- S3 (cluster nhẹ – từ S5 cũ) ----------
    if sid == 3:
        return [
            HVec3(0.5, 0.5, 2.0),
            HVec3(4.5, 0.5, 2.0),
            HVec3(0.7, 4.3, 2.1),
            HVec3(4.3, 4.4, 2.6),
        ]

    # ---------- S4 (thẳng hàng – từ S6 cũ) ----------
    if sid == 4:
        return [
            HVec3(0.0, 0.0, 2.0),
            HVec3(2.0, 0.0, 2.0),
            HVec3(4.0, 0.0, 2.0),
            HVec3(6.0, 0.0, 2.0),
        ]

    raise ValueError(f"Invalid scenario id: {sid}")


# ================== TAG TRAJECTORY ==================
def gt_path(t: float, sid: int) -> HVec3:
    cx, cy = 2.5, 2.5
    base_r = 0.6

    ang1 = 0.6 * t
    ang2 = 0.5 * t

    x = cx + base_r * math.sin(ang1)
    y = cy + base_r * math.cos(ang2)
    z = 1.5 + 0.2 * math.sin(0.4 * t + 0.2 * sid)

    return HVec3(x, y, z)


# ================== SIMULATION ==================
def simulate_scenario(sid: int):
    anchors = anchors_for_scenario(sid)

    kf = AdaptiveGMCKalman3D(
        process_var=0.3,
        meas_var=0.01,
        alpha=1.0,
        beta_init=1.0,
    )

    t0 = 0.0
    gt0 = gt_path(t0, sid)
    s0 = s_from_groundtruth(anchors, gt0, NOISE_STD)
    est0, _, _, _ = hybrid_solve_LM(anchors, s0)
    kf.reset(to_kvec(est0))

    times = []
    err_kf = []

    for step in range(1, STEPS + 1):
        t = step * DT
        gt = gt_path(t, sid)

        s_meas = s_from_groundtruth(anchors, gt, NOISE_STD)
        est_hyb, _, _, cost = hybrid_solve_LM(anchors, s_meas)

        kf.predict(DT)
        est_k = kf.update(to_kvec(est_hyb), hybrid_cost=cost, hybrid_max_cost=2.0)

        err = dist(gt, to_hvec(est_k))

        times.append(t)
        err_kf.append(err)

    mean_err = sum(err_kf) / len(err_kf)
    max_err = max(err_kf)

    return times, err_kf, mean_err, max_err


# ================== MAIN ==================
def run():
    print("===== FINAL SCENARIOS – S0 / S1 / S2 / S3 / S4 =====")

    all_times = []
    all_errs = []
    stats = []
    rmse_trends = []

    for sid in SCENARIOS:
        t, e, mean_e, max_e = simulate_scenario(sid)

        all_times.append(t)
        all_errs.append(e)
        stats.append((sid, mean_e, max_e))
        rmse_trends.append(rolling_rmse(e))

        print(f"S{sid}: mean={mean_e:.3f} m | max={max_e:.3f} m")

    colors = ["tab:blue","tab:orange","tab:green","tab:red","tab:purple"]

    # FIGURE 1 – ERROR (SMOOTHED)
    plt.figure(figsize=(12,6))
    plt.title("Position Error vs Time – Final Selected Scenarios (Smoothed)\nHybrid LM + Adaptive GMC–Kalman", weight="bold")

    for i, sid in enumerate(SCENARIOS):
        _, mean_e, max_e = stats[i]
        label = f"S{sid} | mean={mean_e:.3f} m, max={max_e:.3f} m"

        plt.plot(
            all_times[i],
            smooth(all_errs[i], k=4),
            linewidth=2.2,
            alpha=0.9,
            color=colors[i],
            label=label
        )

    plt.xlabel("Time (s)")
    plt.ylabel("Error (m)")
    plt.ylim(0.0, 4.0)
    plt.grid(True, alpha=0.35)
    plt.legend()
    plt.tight_layout()
    plt.show()

    # FIGURE 2 – RMSE Trend
    plt.figure(figsize=(12,6))
    plt.title("RMSE Trend Over Time – Final UWB Scenarios\nHybrid LM + Adaptive GMC–Kalman", weight="bold")

    for i, sid in enumerate(SCENARIOS):
        plt.plot(
            all_times[i],
            rmse_trends[i],
            linewidth=2.4,
            color=colors[i],
            label=f"S{sid}"
        )

    plt.xlabel("Time (s)")
    plt.ylabel("RMSE (m)")
    plt.ylim(0.0, 4.0)
    plt.grid(True, alpha=0.35)
    plt.legend()
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    run()
