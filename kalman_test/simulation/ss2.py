import math
import random
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

# ============================================================
#  ONE FIGURE ONLY:
#   - LOS (baseline)
#   - NLOS (bias + noise increase in a window)
#   - Missing anchors (LONGER burst drops + visible drift)
#
#  Make missing clearer by:
#   1) Longer burst windows
#   2) Predict-only during burst (no measurement update)
#   3) Add maneuver bump ONLY during missing bursts => drift grows
#   4) Plot Missing WITHOUT smoothing
#   5) Mark dropped frames with "x" on the bottom
# ============================================================

DT = 0.1
STEPS = 140               # 14s (longer to see effect)
BASE_NOISE_STD = 0.07     # ~7 cm LOS
SEED = 20251231

# ---------------- NLOS configuration ----------------
NLOS_START = 4.0
NLOS_END   = 7.0
NLOS_BIAS_M = 0.60
NLOS_EXTRA_NOISE = 0.12

# s = [d2, d3, d4, d01, d02]
# Apply NLOS on A2, A3 -> d3,d4 indices in s
A2_A3_AFFECTED_S_IDXS = (1, 2)

# ---------------- Missing anchors configuration ----------------
# Make it MUCH clearer: longer drop windows
MISSING_BURSTS = [
    (1.8, 3.6),
    (7.6, 9.6),
    (10.6, 12.6),
]
DROP_PROB_RANDOM = 0.02   # tiny random loss (optional)

# ============================================================
def to_kvec(v: HVec3) -> KVec3:
    return KVec3(v.x, v.y, v.z)

def to_hvec(v: KVec3) -> HVec3:
    return HVec3(v.x, v.y, v.z)

def smooth(y, k=4):
    out = []
    for i in range(len(y)):
        l = max(0, i - k)
        r = min(len(y), i + k + 1)
        out.append(sum(y[l:r]) / (r - l))
    return out

def anchors_baseline():
    return [
        HVec3(0.0, 0.0, 2.0),
        HVec3(5.0, 0.0, 2.0),
        HVec3(0.0, 5.0, 2.0),
        HVec3(5.0, 5.0, 2.7),
    ]

def bump(t, a, b, amp):
    # Smooth 0->1->0 bump inside [a,b]
    if t < a or t > b:
        return 0.0
    u = (t - a) / (b - a)
    return amp * math.sin(math.pi * u)

def gt_path(t: float) -> HVec3:
    # Base smooth motion
    cx, cy = 2.5, 2.5
    r = 0.7

    x = cx + r * math.sin(0.55 * t)
    y = cy + r * math.cos(0.48 * t)
    z = 1.5 + 0.18 * math.sin(0.35 * t)

    # Strong maneuver during missing bursts => predict-only drift grows clearly
    for a, b in MISSING_BURSTS:
        x += bump(t, a, b, amp=0.55)
        y -= bump(t, a, b, amp=0.45)

    return HVec3(x, y, z)

def apply_nlos_to_s(s, bias_m: float, extra_noise_std: float):
    s2 = list(s)
    for idx in A2_A3_AFFECTED_S_IDXS:
        s2[idx] += bias_m + random.gauss(0.0, extra_noise_std)
    return s2

def in_burst(t: float) -> bool:
    for a, b in MISSING_BURSTS:
        if a <= t <= b:
            return True
    return False

def simulate(mode: str):
    anchors = anchors_baseline()

    kf = AdaptiveGMCKalman3D(
        process_var=0.3,
        meas_var=0.01,
        alpha=1.0,
        beta_init=1.0,
    )

    # init from first frame (LOS init)
    t0 = DT
    gt0 = gt_path(t0)
    s0 = s_from_groundtruth(anchors, gt0, BASE_NOISE_STD)
    est0, _, _, _ = hybrid_solve_LM(anchors, s0)
    kf.reset(to_kvec(est0))

    times, errs, drops = [], [], []

    for step in range(1, STEPS + 1):
        t = step * DT
        gt = gt_path(t)

        dropped = False
        if mode == "MISSING":
            dropped = in_burst(t) or (random.random() < DROP_PROB_RANDOM)

        if dropped:
            # predict-only (no update)
            kf.predict(DT)
            est_k = kf.get_state_vec3()
            drops.append(True)
        else:
            s = s_from_groundtruth(anchors, gt, BASE_NOISE_STD)

            if mode == "NLOS" and (NLOS_START <= t <= NLOS_END):
                s = apply_nlos_to_s(s, NLOS_BIAS_M, NLOS_EXTRA_NOISE)

            est_hyb, it, ok, cost = hybrid_solve_LM(anchors, s)

            kf.predict(DT)
            est_k = kf.update(
                to_kvec(est_hyb),
                hybrid_cost=cost,
                hybrid_max_cost=2.0
            )
            drops.append(False)

        errs.append(dist(gt, to_hvec(est_k)))
        times.append(t)

    return times, errs, drops

# ============================================================
def run():
    random.seed(SEED)

    t_los, e_los, _ = simulate("LOS")
    random.seed(SEED)
    t_nls, e_nls, _ = simulate("NLOS")
    random.seed(SEED)
    t_mis, e_mis, d_mis = simulate("MISSING")

    mean_los, max_los = sum(e_los)/len(e_los), max(e_los)
    mean_nls, max_nls = sum(e_nls)/len(e_nls), max(e_nls)
    mean_mis, max_mis = sum(e_mis)/len(e_mis), max(e_mis)

    miss_rate = sum(d_mis)/len(d_mis) * 100.0

    print("===== ONE-PLOT SUMMARY =====")
    print(f"LOS     : mean={mean_los:.3f} m | max={max_los:.3f} m")
    print(f"NLOS    : mean={mean_nls:.3f} m | max={max_nls:.3f} m | window=[{NLOS_START:.1f},{NLOS_END:.1f}]s")
    print(f"MISSING : mean={mean_mis:.3f} m | max={max_mis:.3f} m | drop windows={len(MISSING_BURSTS)} (actual {miss_rate:.1f}%)")

    ymax = max(max_los, max_nls, max_mis) * 1.15
    ymax = max(ymax, 0.8)

    plt.figure(figsize=(13, 6))
    plt.title(
        "UWB Error vs Time (LOS vs NLOS vs Missing Anchors)\n"
        "Hybrid LM + Adaptive GMC–Kalman",
        weight="bold"
    )

    # LOS/NLOS smoothed
    plt.plot(t_los, smooth(e_los, k=4), linewidth=2.4, label=f"LOS (mean={mean_los:.3f}m)")
    plt.plot(t_nls, smooth(e_nls, k=4), linewidth=2.4, label=f"NLOS (mean={mean_nls:.3f}m)")

    # Missing NOT smoothed for clarity
    plt.plot(t_mis, e_mis, linewidth=2.1, label=f"Missing (mean={mean_mis:.3f}m)")

    # Shaded NLOS window
    plt.axvspan(NLOS_START, NLOS_END, alpha=0.12, label="NLOS window")

    # Shaded missing bursts
    for i, (a, b) in enumerate(MISSING_BURSTS):
        lbl = "Missing burst windows" if i == 0 else None
        plt.axvspan(a, b, alpha=0.12, label=lbl)

    # Mark dropped frames with x at bottom
    drop_ts = [t for t, d in zip(t_mis, d_mis) if d]
    if drop_ts:
        plt.scatter(drop_ts, [0.02] * len(drop_ts), marker="x", s=28, label="Dropped frames (Missing)")

    plt.xlabel("Time (s)")
    plt.ylabel("Error (m)")
    plt.ylim(0.0, ymax)
    plt.grid(True, alpha=0.35)
    plt.legend()
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    run()
