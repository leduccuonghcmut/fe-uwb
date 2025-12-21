import math
import time
import matplotlib.pyplot as plt

from hybrid_scalable import (
    Vec3 as HVec3,
    dist,
    s_from_groundtruth,
    hybrid_solve_LM,
)

from gmc_kalman_filter import (
    Vec3 as KVec3,
    AdaptiveGMCKalman3D,
)


def to_kvec(v: HVec3) -> KVec3:
    return KVec3(v.x, v.y, v.z)

def to_hvec(v: KVec3) -> HVec3:
    return HVec3(v.x, v.y, v.z)


anchors = [
    HVec3(0, 0, 2.0),
    HVec3(5, 0, 2.0),
    HVec3(0, 5, 2.0),
    HVec3(5, 5, 2.7),
]


def gt_path(i: int) -> HVec3:
    return HVec3(
        2.5 + 0.6 * math.sin(i * 0.18),
        2.5 + 0.6 * math.cos(i * 0.16),
        1.5 + 0.25 * math.sin(i * 0.35),
    )


def run():
    print("\n===== PAPER-STYLE HYBRID + GMC-KF 3D LOG =====")

    # KF tuning
    kf = AdaptiveGMCKalman3D(
        process_var=0.6,
        meas_var=0.35,
        alpha=1.0,
        beta_init=1.0
    )

    noise_std = 0.05
    steps = 40

    # Init bằng Hybrid
    gt0 = gt_path(1)
    s0 = s_from_groundtruth(anchors, gt0, noise_std)
    est0, it0, ok0, cost0 = hybrid_solve_LM(anchors, s0)
    kf.reset(to_kvec(est0))

    print(f"[INIT] GT={gt0} | HYB_INIT={est0} err={dist(gt0,est0):.3f} cost={cost0:.6f} it={it0} ok={ok0}")

    print("\nidx | err_meas  err_hyb   err_kf  | cost_hyb it ok | FLAG  | RMSE(KF)  RMSE(HYB) | MAE(KF)  MAE(HYB) | Impact(%)")
    print("-"*160)

    # ================== DATA FOR PLOTS ==================
    frames, hyb_err_list, kf_err_list = [], [], []
    rmse_kf_list, rmse_hyb_list, impact_list, reject_marks = [], [], [], []

    sse_kf = sse_hyb = sae_kf = sae_hyb = 0.0

    # ================== MAIN LOOP ==================
    for i in range(1, steps + 1):
        gt = gt_path(i)
        s = s_from_groundtruth(anchors, gt, noise_std)

        est, it, ok, cost = hybrid_solve_LM(anchors, s)
        err_h = dist(gt, est)

        # Inject outlier
        if i == 18:
            print("\n>>> INJECT OUTLIER: Hybrid z += 1.5m <<<")
            est = HVec3(est.x, est.y, est.z + 1.5)
            err_h = dist(gt, est)

        kf.predict(dt=0.1)

        est_kf, dbg = kf.update_debug(
            to_kvec(est),
            hybrid_cost=cost,
            hybrid_max_cost=2.0
        )

        err_k = dist(gt, to_hvec(est_kf))
        err_meas = err_h

        # Running metrics
        sse_kf += err_k**2
        sse_hyb += err_h**2
        sae_kf += err_k
        sae_hyb += err_h

        rmse_kf = math.sqrt(sse_kf / i)
        rmse_hyb = math.sqrt(sse_hyb / i)
        mae_kf = sae_kf / i
        mae_hyb = sae_hyb / i

        impact = max(0.0, (1 - rmse_kf / rmse_hyb) * 100.0)
        flag = "REJECT" if dbg.get("gated", False) else "GOOD"

        print(
            f"[{i:02d}] | {err_meas:7.3f}  {err_h:7.3f}  {err_k:7.3f} | "
            f"{cost:8.4f} {it:2d} {int(ok)} | {flag:6} | "
            f"{rmse_kf:8.3f}   {rmse_hyb:8.3f} | "
            f"{mae_kf:7.3f}   {mae_hyb:7.3f} | "
            f"{impact:6.2f}"
        )

        frames.append(i)
        hyb_err_list.append(err_h)
        kf_err_list.append(err_k)
        rmse_kf_list.append(rmse_kf)
        rmse_hyb_list.append(rmse_hyb)
        impact_list.append(impact)
        reject_marks.append(flag == "REJECT")

        time.sleep(0.02)

    # ================== BEAUTIFUL IEEE PLOTS ==================
    plt.rcParams.update({
        "font.size": 10,
        "axes.labelsize": 11,
        "axes.titlesize": 12,
        "legend.fontsize": 9,
        "figure.titlesize": 13
    })

    fig = plt.figure(figsize=(13,8))
    fig.suptitle("Hybrid Localization with Adaptive GMC-Kalman Filter", weight="bold")

    # -------- Plot 1 --------
    ax1 = plt.subplot(3,1,1)
    ax1.plot(frames, hyb_err_list, '-o', lw=2.2, label="Hybrid Error")
    ax1.plot(frames, kf_err_list, '-o', lw=2.2, label="KF Error")

    # Highlight OUTLIER region
    ax1.axvspan(18-0.5, 18+0.5, color="red", alpha=0.12)
    ax1.annotate("Injected Outlier", xy=(18, max(hyb_err_list)),
                 xytext=(20, max(hyb_err_list)+0.2),
                 arrowprops=dict(facecolor='red', shrink=0.05))

    # Mark reject frames
    for i, r in enumerate(reject_marks):
        if r:
            ax1.scatter(frames[i], kf_err_list[i], color="red", s=50, zorder=5)

    ax1.set_ylabel("Error (m)")
    ax1.set_title("Instant Position Error")
    ax1.grid(True, alpha=0.35)
    ax1.legend()

    # -------- Plot 2 --------
    ax2 = plt.subplot(3,1,2)
    ax2.plot(frames, rmse_hyb_list, lw=2.2, label="Hybrid RMSE")
    ax2.plot(frames, rmse_kf_list, lw=2.2, label="KF RMSE")

    ax2.set_ylabel("RMSE (m)")
    ax2.set_title("Cumulative RMSE")
    ax2.grid(True, alpha=0.35)
    ax2.legend()

    # -------- Plot 3 --------
    ax3 = plt.subplot(3,1,3)
    ax3.plot(frames, impact_list, lw=2.4, label="Impact (%)", color="tab:blue")

    ax3.axhline(0, color="black", linestyle="--", lw=1)
    ax3.set_ylabel("Improvement %")
    ax3.set_xlabel("Frame")
    ax3.set_title("Impact of GMC-KF vs Hybrid")
    ax3.grid(True, alpha=0.35)
    ax3.legend()

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    run()
