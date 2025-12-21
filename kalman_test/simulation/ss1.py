import math
import matplotlib.pyplot as plt
import numpy as np

from hybrid_scalable import Vec3, s_from_groundtruth, hybrid_solve_LM
from gmc_kalman_filter import AdaptiveGMCKalman3D

SCENARIO_DUR_S = 10.0
NUM_SCENARIOS = 6
DT = 0.1

np.random.seed(1234)

bias = None
drift = None
last_noise = None


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def anchors_for_scenario(idx: int):
    if idx == 0:
        return [
            Vec3(0.0, 2.8, 0.0),
            Vec3(12.0, 2.8, 0.0),
            Vec3(0.0, 2.8, 12.0),
            Vec3(12.0, 2.8, 12.0),
        ]
    if idx == 1:
        return [
            Vec3(1.0, 2.8, 1.0),
            Vec3(11.0, 2.8, 1.0),
            Vec3(1.0, 2.8, 11.0),
            Vec3(11.0, 2.8, 11.0),
        ]
    if idx == 2:
        return [
            Vec3(0.0, 2.8, 0.0),
            Vec3(12.0, 2.8, 0.0),
            Vec3(0.0, 1.4, 12.0),
            Vec3(12.0, 1.4, 12.0),
        ]
    if idx == 3:
        return [
            Vec3(0.0, 2.8, 0.0),
            Vec3(12.0, 1.4, 0.0),
            Vec3(0.0, 2.0, 12.0),
            Vec3(12.0, 2.8, 12.0),
        ]
    if idx == 4:
        return [
            Vec3(0.0, 2.0, 0.0),
            Vec3(4.0, 2.0, 0.0),
            Vec3(8.0, 2.0, 0.0),
            Vec3(12.0, 2.2, 2.0),
        ]
    if idx == 5:
        return [
            Vec3(0.0, 2.0, 0.0),
            Vec3(0.5, 2.0, 0.1),
            Vec3(1.0, 2.0, 0.0),
            Vec3(1.5, 2.1, 0.1),
        ]


def tag_trajectory(seg_t: float, scenario_idx: int):
    cx, cz = 6.0, 6.0

    if scenario_idx == 0:
        rx, rz = 5.0, 4.2
    elif scenario_idx == 1:
        rx, rz = 5.2, 2.8
    elif scenario_idx == 2:
        rx, rz = 4.2, 5.2
    elif scenario_idx == 3:
        rx, rz = 4.8, 4.8
    else:
        rx, rz = 5.6, 2.0

    omega = (2.0 * math.pi) / SCENARIO_DUR_S
    ang = omega * seg_t

    x = cx + rx * math.cos(ang)
    z = cz + rz * math.sin(ang)
    y = 1.55 + 0.18 * math.sin(ang * 1.2)

    return Vec3(
        clamp(x, 0.6, 11.4),
        clamp(y, 1.2, 2.2),
        clamp(z, 0.6, 11.4),
    )


def init_noise_state(n_meas: int):
    global bias, drift, last_noise
    bias = np.random.normal(0.0, 0.10, n_meas)   # bias cố định mỗi kênh đo
    drift = np.zeros(n_meas)                     # drift chậm mỗi kênh đo
    last_noise = np.zeros(n_meas)                # nhiễu tương quan theo thời gian


def realistic_meas_noise(meas_idx: int, base_val: float) -> float:
    global bias, drift, last_noise

    # s_from_groundtruth trong hybrid_scalable: s = [Δd2, Δd3, Δd4, d01, d02]
    # 3 phần đầu là TDoA-diff, 2 phần sau là ToF/dist
    if meas_idx < 3:
        white_std = 0.10
        drift_std = 0.0010
        burst_p = 0.020
        burst_mu, burst_sigma = 0.60, 0.25
    else:
        white_std = 0.08
        drift_std = 0.0008
        burst_p = 0.015
        burst_mu, burst_sigma = 0.80, 0.30

    white = np.random.normal(0.0, white_std)

    drift[meas_idx] += np.random.normal(0.0, drift_std)
    drift[meas_idx] = clamp(drift[meas_idx], -0.25, 0.25)

    correlated = 0.85 * last_noise[meas_idx] + 0.15 * white
    last_noise[meas_idx] = correlated

    if np.random.rand() < burst_p:
        burst = np.random.normal(burst_mu, burst_sigma)
    else:
        burst = 0.0

    return base_val + bias[meas_idx] + drift[meas_idx] + correlated + burst


def add_realistic_noise_to_s(s_clean):
    return [realistic_meas_noise(i, float(v)) for i, v in enumerate(s_clean)]


def run_compare():
    kf = AdaptiveGMCKalman3D()

    all_errors = []
    rms_per_scenario = []

    for scenario in range(NUM_SCENARIOS):
        anchors = anchors_for_scenario(scenario)
        errors = []

        gt0 = tag_trajectory(0.0, scenario)
        s_clean0 = s_from_groundtruth(anchors, gt0, noise_std_m=0.0)

        init_noise_state(len(s_clean0))
        s0 = add_realistic_noise_to_s(s_clean0)

        est0, _, ok0, _ = hybrid_solve_LM(anchors, s0)
        kf.reset(est0 if ok0 else Vec3(6.0, 1.6, 6.0))

        t = 0.0
        while t < SCENARIO_DUR_S:
            gt = tag_trajectory(t, scenario)

            s_clean = s_from_groundtruth(anchors, gt, noise_std_m=0.0)
            s = add_realistic_noise_to_s(s_clean)

            est, _, ok, _ = hybrid_solve_LM(anchors, s)

            kf.predict(DT)
            smoothed = kf.update(est) if ok else kf.get_state_vec3()

            err = math.dist(
                (gt.x, gt.y, gt.z),
                (smoothed.x, smoothed.y, smoothed.z),
            )
            errors.append(err)

            t += DT

        all_errors.append(errors)
        rms = math.sqrt(sum(e * e for e in errors) / len(errors))
        rms_per_scenario.append(rms)
        print(f"Scenario {scenario} → RMS error = {rms:.3f} m")

    plt.figure(figsize=(12, 6))
    for i, errs in enumerate(all_errors):
        plt.plot(errs, label=f"Scenario {i}")
    plt.title("Tracking Error Over Time per Scenario")
    plt.xlabel("Frame Index")
    plt.ylabel("Error (m)")
    plt.legend()
    plt.grid()

    plt.figure(figsize=(8, 5))
    plt.bar([f"S{i}" for i in range(NUM_SCENARIOS)], rms_per_scenario, color="orange")
    plt.title("RMS Error Comparison")
    plt.ylabel("RMS Error (m)")
    plt.grid(axis="y")

    plt.show()


if __name__ == "__main__":
    run_compare()
