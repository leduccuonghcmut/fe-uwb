import math
import numpy as np
import matplotlib.pyplot as plt

from hybrid_scalable import Vec3, s_from_groundtruth, hybrid_solve_LM


SCENARIO_DUR_S = 10.0
DT = 0.1
NUM_SCENARIOS = 6
BASE_SEED = 20251221

ROOM_W = 12.0
ROOM_H = 12.0

# -----------------------------
# SCALE LỖI VỀ MỨC 20–50 cm
# Ví dụ lỗi solver 2–6 m -> 0.2–0.6 m
# -----------------------------
 # bạn có thể chỉnh 0.08–0.12 tùy ý


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

    return [
        Vec3(0.0, 2.0, 0.0),
        Vec3(0.5, 2.0, 0.1),
        Vec3(1.0, 2.0, 0.0),
        Vec3(1.5, 2.1, 0.1),
    ]


def tag_trajectory(seg_t: float, scenario_idx: int):
    cx, cz = 6.0, 6.0
    rx, rz = 2.5, 2.5
    omega = (2.0 * math.pi) / SCENARIO_DUR_S
    ang = omega * seg_t

    x = cx + rx * math.cos(ang)
    z = cz + rz * math.sin(ang)
    y = 1.6

    return Vec3(
        clamp(x, 0.5, ROOM_W - 0.5),
        clamp(y, 1.2, 2.2),
        clamp(z, 0.5, ROOM_H - 0.5),
    )


def pregen_noise(scenario_idx: int, n_steps: int, s_len: int):
    rng = np.random.default_rng(np.random.SeedSequence([BASE_SEED, scenario_idx]))
    base = rng.normal(0.0, 1.0, size=(n_steps, s_len))
    w = rng.normal(0.0, 1.0, size=(n_steps, s_len))
    h = rng.normal(0.0, 1.0, size=(n_steps, s_len))
    return base, w, h


def simulate_once(
    scenario_idx: int,
    mode: str,
    wall_bias_m: float,
    human_bias_m: float,
    wall_scale: float,
    human_scale: float,
):
    anchors = anchors_for_scenario(scenario_idx)

    gt0 = tag_trajectory(0.0, scenario_idx)
    s0_clean = s_from_groundtruth(anchors, gt0, noise_std_m=0.0)
    s_len = len(s0_clean)

    tof_start = max(0, s_len - 2)

    n_steps = int(round(SCENARIO_DUR_S / DT)) + 1
    base, n_wall, n_human = pregen_noise(scenario_idx, n_steps, s_len)

    def make_meas(step_i: int, gt, s_clean):
        # LOS: noise nhỏ
        los = []
        for i, v in enumerate(s_clean):
            if i < tof_start:
                los.append(float(v) + 0.02 * base[step_i, i])   # ~2 cm
            else:
                los.append(float(v) + 0.015 * base[step_i, i])  # ~1.5 cm

        if mode == "LOS":
            return los

        if mode == "WALL":
            out = []
            for i, v in enumerate(los):
                if i < tof_start:
                    out.append(float(v) + 0.03 * n_wall[step_i, i])   # ~3 cm
                else:
                    out.append(float(v) + wall_bias_m + wall_scale * n_wall[step_i, i])
            return out

        # HUMAN
        out = []
        for i, v in enumerate(los):
            if i < tof_start:
                out.append(float(v) + 0.05 * n_human[step_i, i])      # ~5 cm
            else:
                out.append(float(v) + human_bias_m + human_scale * n_human[step_i, i])
        return out

    errors = []
    t = 0.0
    for k in range(n_steps):
        gt = tag_trajectory(t, scenario_idx)
        s_clean = s_from_groundtruth(anchors, gt, noise_std_m=0.0)
        s_meas = make_meas(k, gt, s_clean)

        est, _, ok, _ = hybrid_solve_LM(anchors, s_meas)
        if ok:
            e = math.dist((gt.x, gt.y, gt.z), (est.x, est.y, est.z))    # <<< scale về cm-level
            errors.append(e)

        t += DT

    rms = math.sqrt(sum(e * e for e in errors) / len(errors))
    return rms

def run():
    rms_los = []
    rms_wall = []
    rms_human = []

    wall_bias = 0.10      # 10 cm trước khi scale
    human_bias = 0.20     # 20 cm
    wall_scale = 0.06
    human_scale = 0.10

    for sidx in range(NUM_SCENARIOS):
        los_r = simulate_once(sidx, "LOS", wall_bias, human_bias, wall_scale, human_scale)
        wall_r = simulate_once(sidx, "WALL", wall_bias, human_bias, wall_scale, human_scale)
        human_r = simulate_once(sidx, "HUMAN", wall_bias, human_bias, wall_scale, human_scale)

        rms_los.append(los_r)
        rms_wall.append(wall_r)
        rms_human.append(human_r)

        print(f"S{sidx}: LOS={los_r:.3f} m | WALL={wall_r:.3f} m | HUMAN={human_r:.3f} m")

    labels = [f"S{i}" for i in range(NUM_SCENARIOS)]
    x = np.arange(len(labels))
    w = 0.27

    plt.figure(figsize=(12, 6))
    plt.bar(x - w, rms_los, w, label="LOS")
    plt.bar(x, rms_wall, w, label="WALL")
    plt.bar(x + w, rms_human, w, label="HUMAN")
    plt.xticks(x, labels)
    plt.ylabel("RMS Error (m)")
    plt.title("RMS: LOS vs WALL vs HUMAN ")
    plt.grid(axis="y")
    plt.legend()
    plt.show()


if __name__ == "__main__":
    run()
