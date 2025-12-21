import math
import time
import requests

from hybrid_scalable import Vec3, s_from_groundtruth, hybrid_solve_LM
from gmc_kalman_filter import AdaptiveGMCKalman3D as GMCKalman3D

PUSH_URL = "http://localhost:3000/push"
SCENARIO_DUR_S = 10.0
NUM_SCENARIOS = 6


def send_position_to_web(x: float, y: float, z: float):
    try:
        requests.get(
            PUSH_URL,
            params={
                "x": round(x, 3),
                "y": round(y, 3),
                "z": round(z, 3),
                "ts": round(time.time(), 3),
            },
            timeout=0.25,
        )
    except Exception:
        pass


try:
    import socketio

    sio = socketio.Client(
        reconnection=True,
        reconnection_attempts=10,
        reconnection_delay=500,
        reconnection_delay_max=2000,
    )

    @sio.event
    def connect():
        print("Socket.IO connected")

    @sio.event
    def disconnect():
        print("Socket.IO disconnected, retrying...")

    @sio.event
    def connect_error(data):
        print(f"Socket.IO connect error: {data}")

    try:
        sio.connect("http://localhost:3000")
    except Exception as e:
        print(f"Initial Socket.IO connect failed: {e}")
        sio = None
except ImportError:
    print("python-socketio not installed, only HTTP will be used")
    sio = None
except Exception as e:
    print(f"Socket.IO client init error: {e}")
    sio = None


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
    return anchors_for_scenario(0)


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


def scenario_of_time(t: float):
    seg_idx = int(t // SCENARIO_DUR_S)
    idx = seg_idx % NUM_SCENARIOS
    seg_t = t - seg_idx * SCENARIO_DUR_S
    return idx, seg_t


def get_measure(step, t):
    scenario_idx, seg_t = scenario_of_time(t)
    anchors = anchors_for_scenario(scenario_idx)
    gt = tag_trajectory(seg_t, scenario_idx)
    s = s_from_groundtruth(anchors, gt, noise_std_m=0.05)
    return scenario_idx, seg_t, anchors, s, gt


kf = GMCKalman3D(
    process_var=0.8,
    meas_var=0.7,
    alpha=1.0,
    beta_init=1.0,
)


def main():
    print("\n===== REALTIME UWB → WEB PUSH (No delay after scenario switch) =====\n")

    dt = 0.1
    t0 = time.time()

    scenario0, seg0, anchors0, s0, gt0 = get_measure(1, 0.0)
    est0, _, ok0, _ = hybrid_solve_LM(anchors0, s0)
    kf.reset(est0 if ok0 else Vec3(6.0, 1.6, 6.0))

    step = 1
    last_scenario = scenario0

    while True:
        t = time.time() - t0
        step += 1

        scenario_idx, seg_t, anchors, s, gt = get_measure(step, t)

        if scenario_idx != last_scenario:
            print(f"\n=== SWITCH SCENARIO → {scenario_idx} (t={t:.1f}s) ===")
            last_scenario = scenario_idx

        est, _, ok, _ = hybrid_solve_LM(anchors, s)

        kf.predict(dt)
        smoothed = kf.update(est) if ok else kf.get_state_vec3()

        send_position_to_web(smoothed.x, smoothed.y, smoothed.z)

        if sio:
            if not sio.connected:
                try:
                    sio.connect("http://localhost:3000")
                except:
                    pass

            if sio and sio.connected:
                try:
                    sio.emit("anchors-update", {
                        f"A{i}": {"x": round(a.x, 3), "y": round(a.y, 3), "z": round(a.z, 3)}
                        for i, a in enumerate(anchors)
                    })
                except:
                    pass

        time.sleep(dt)


if __name__ == "__main__":
    main()





