import math
import time
import requests

from hybrid_scalable import Vec3 as HVec3, s_from_groundtruth, hybrid_solve_LM
from gmc_kalman_filter import AdaptiveGMCKalman3D
from gmc_kalman_filter import Vec3 as KVec3  # KF Vec3 riêng

PUSH_URL = "http://localhost:3000/push"

# ================== CONFIG (DEMO) ==================
SCENARIO_DUR_S = 10.0
NUM_SCENARIOS = 6  # S0..S5

DT = 0.1
NOISE_STD_M = 0.05  # ~5cm synthetic measurement noise

LOG_EVERY_N = 10

# ===== DEMO behavior =====
# Nếu Hybrid "đẹp" (cost nhỏ) => output = Hybrid (KF chỉ warm-start + smoothing nhẹ)
DEMO_USE_HYB_OUTPUT = False
DEMO_COST_OK = 0.02

# ===== KF anti-diverge guard =====
GUARD_COST_OK = 0.02
GUARD_INNOV_M = 0.50

# ===== HEIGHT PRIOR (giữ ổn định trục height) =====
# Alpha=1.0: FIX cứng height => demo ổn định, không nhảy 1-2m ở S2/S4/S5
HEIGHT_PRIOR_M = 1.55
HEIGHT_PRIOR_ALPHA = 0.3#thử 0.3 nếu muốn height dao động nhẹ


# ================= Socket.IO (optional) =================
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


def send_position_to_web(x: float, y: float, z: float):
    try:
        requests.get(
            PUSH_URL,
            params={"x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "ts": round(time.time(), 3)},
            timeout=0.25,
        )
    except Exception:
        pass


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ================= Vec3 conversion (match ss1.py style) =================
def to_kvec(h: HVec3) -> KVec3:
    return KVec3(h.x, h.y, h.z)


def to_hvec(k: KVec3) -> HVec3:
    return HVec3(k.x, k.y, k.z)


def dist3_k(a: KVec3, b: KVec3) -> float:
    dx = a.x - b.x
    dy = a.y - b.y
    dz = a.z - b.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)


# ================= Axis convention =================
# Room-space (web):    (x, y_height, z_plane)
# Solver-space:        (x_plane, y_plane, z_height)
def room_to_solver(v_room: HVec3) -> HVec3:
    return HVec3(v_room.x, v_room.z, v_room.y)


def solver_to_room(v_sol: HVec3) -> HVec3:
    return HVec3(v_sol.x, v_sol.z, v_sol.y)


def apply_height_prior_h(sol: HVec3) -> HVec3:
    if HEIGHT_PRIOR_ALPHA <= 0.0:
        return sol
    z = (1.0 - HEIGHT_PRIOR_ALPHA) * sol.z + HEIGHT_PRIOR_ALPHA * HEIGHT_PRIOR_M
    return HVec3(sol.x, sol.y, z)


def apply_height_prior_k(sol: KVec3) -> KVec3:
    if HEIGHT_PRIOR_ALPHA <= 0.0:
        return sol
    z = (1.0 - HEIGHT_PRIOR_ALPHA) * sol.z + HEIGHT_PRIOR_ALPHA * HEIGHT_PRIOR_M
    return KVec3(sol.x, sol.y, z)


# ================= Scenarios (Room-space) =================
def anchors_for_scenario_room(idx: int):
    if idx == 0:  # S0 – 4 corners
        return [
            HVec3(0.0, 2.8, 0.0),
            HVec3(12.0, 2.8, 0.0),
            HVec3(0.0, 2.8, 12.0),
            HVec3(12.0, 2.8, 12.0),
        ]
    if idx == 1:  # S1 – corners shifted inward
        return [
            HVec3(1.0, 2.8, 1.0),
            HVec3(11.0, 2.8, 1.0),
            HVec3(1.0, 2.8, 11.0),
            HVec3(11.0, 2.8, 11.0),
        ]
    if idx == 2:  # S2 – 2 anchors high-front, 2 anchors lower-back
        return [
            HVec3(0.0, 2.8, 0.0),
            HVec3(12.0, 2.8, 0.0),
            HVec3(0.0, 1.4, 12.0),
            HVec3(12.0, 1.4, 12.0),
        ]
    if idx == 3:  # S3 – mixed heights
        return [
            HVec3(0.0, 2.8, 0.0),
            HVec3(12.0, 1.4, 0.0),
            HVec3(0.0, 2.0, 12.0),
            HVec3(12.0, 2.8, 12.0),
        ]
    if idx == 4:  # S4 – 3 anchors almost collinear + 1 offset
        return [
            HVec3(0.0, 2.0, 0.0),
            HVec3(4.0, 2.0, 0.0),
            HVec3(8.0, 2.0, 0.0),
            HVec3(12.0, 2.2, 2.0),
        ]
    if idx == 5:  # S5 – cluster close together
        return [
            HVec3(0.0, 2.0, 0.0),
            HVec3(0.5, 2.0, 0.1),
            HVec3(1.0, 2.0, 0.0),
            HVec3(1.5, 2.1, 0.1),
        ]
    return anchors_for_scenario_room(0)


def tag_trajectory_room(seg_t: float, scenario_idx: int):
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
    z = cz + rz * math.sin(ang)              # z_plane
    y = 1.55 + 0.18 * math.sin(ang * 1.2)    # y_height

    return HVec3(
        clamp(x, 0.6, 11.4),
        clamp(y, 1.2, 2.2),
        clamp(z, 0.6, 11.4),
    )


def scenario_of_time(t: float):
    seg_idx = int(t // SCENARIO_DUR_S)
    idx = seg_idx % NUM_SCENARIOS
    seg_t = t - seg_idx * SCENARIO_DUR_S
    return idx, seg_t


def get_measure(t):
    sidx, seg_t = scenario_of_time(t)

    anchors_room = anchors_for_scenario_room(sidx)
    gt_room = tag_trajectory_room(seg_t, sidx)

    anchors_sol = [room_to_solver(a) for a in anchors_room]
    gt_sol = room_to_solver(gt_room)

    # chạy "công thức" từ code bạn: sinh s từ GT + noise, rồi dùng hybrid_solve_LM
    s = s_from_groundtruth(anchors_sol, gt_sol, noise_std_m=NOISE_STD_M)
    return sidx, seg_t, anchors_room, anchors_sol, s, gt_room


def print_anchors_room(anchors_room):
    for i, a in enumerate(anchors_room):
        print(f"  A{i}: ({a.x:5.2f}, {a.y:4.2f}, {a.z:5.2f})")


# ================= KF (robust) =================
# process_var nhỏ hơn => ít drift hơn, demo ổn định hơn
kf = AdaptiveGMCKalman3D(
    process_var=0.15,
    meas_var=0.01,
    alpha=1.0,
    beta_init=1.0,
)


def main():
    print("\n===== DEMO MAIN (Hybrid LM + GMC-Kalman, stable cm-level) =====\n")

    t0 = time.time()
    step = 0

    # init
    sidx, seg, anchors_room, anchors_sol, s, gt_room = get_measure(0.0)
    est_sol, it0, ok0, cost0 = hybrid_solve_LM(anchors_sol, s)
    if ok0:
        est_sol = apply_height_prior_h(est_sol)
        kf.reset(apply_height_prior_k(to_kvec(est_sol)))
    else:
        init0 = room_to_solver(HVec3(6.0, HEIGHT_PRIOR_M, 6.0))
        init0 = apply_height_prior_h(init0)
        kf.reset(to_kvec(init0))

    last_scenario = sidx
    print(f"=== START SCENARIO {sidx} ===")
    print_anchors_room(anchors_room)

    while True:
        loop_t = time.time()
        t = loop_t - t0
        step += 1

        sidx, seg, anchors_room, anchors_sol, s, gt_room = get_measure(t)

        # scenario switch: reset KF near hybrid to avoid carry-over
        if sidx != last_scenario:
            print(f"\n=== SWITCH SCENARIO → {sidx} (t={t:.2f}s) ===")
            print_anchors_room(anchors_room)
            last_scenario = sidx

            est_sw, it_sw, ok_sw, cost_sw = hybrid_solve_LM(anchors_sol, s)
            if ok_sw:
                est_sw = apply_height_prior_h(est_sw)
                kf.reset(apply_height_prior_k(to_kvec(est_sw)))

        # warm-start hybrid using KF state
        init_sol = apply_height_prior_h(to_hvec(kf.get_state_vec3()))
        est_sol, it, ok, cost = hybrid_solve_LM(anchors_sol, s, init=init_sol)
        if ok:
            est_sol = apply_height_prior_h(est_sol)

        # HYB error (room)
        if ok:
            hyb_room = solver_to_room(est_sol)
            hx = hyb_room.x - gt_room.x
            hy = hyb_room.y - gt_room.y
            hz = hyb_room.z - gt_room.z
            hyb_err_cm = 100.0 * math.sqrt(hx * hx + hy * hy + hz * hz)
        else:
            hyb_err_cm = float("nan")

        # KF predict
        kf.predict(DT)

        # KF update + guard (robust KF đôi khi gate measurement -> cần reset)
        did_reset = False
        if ok:
            meas_k = apply_height_prior_k(to_kvec(est_sol))
            pred_k = apply_height_prior_k(kf.get_state_vec3())
            innov_m = dist3_k(pred_k, meas_k)

            if (cost <= GUARD_COST_OK) and (innov_m > GUARD_INNOV_M):
                kf.reset(meas_k)
                smoothed_k = meas_k
                did_reset = True
            else:
                smoothed_k = kf.update(meas_k, hybrid_cost=cost, hybrid_max_cost=2.0)
                smoothed_k = apply_height_prior_k(smoothed_k)

                post_m = dist3_k(smoothed_k, meas_k)
                if (cost <= GUARD_COST_OK) and (post_m > GUARD_INNOV_M):
                    kf.reset(meas_k)
                    smoothed_k = meas_k
                    did_reset = True
        else:
            smoothed_k = apply_height_prior_k(kf.get_state_vec3())

        # ===== DEMO OUTPUT SELECT =====
        if DEMO_USE_HYB_OUTPUT and ok and (cost <= DEMO_COST_OK):
            out_sol = est_sol  # output = hybrid (đẹp nhất để demo)
        else:
            out_sol = apply_height_prior_h(to_hvec(smoothed_k))  # fallback KF

        out_room = solver_to_room(out_sol)

        # push to web
        send_position_to_web(out_room.x, out_room.y, out_room.z)

        # anchors update (optional)
        if sio:
            if not sio.connected:
                try:
                    sio.connect("http://localhost:3000")
                except Exception:
                    pass
            if sio and sio.connected:
                try:
                    sio.emit(
                        "anchors-update",
                        {
                            f"A{i}": {"x": round(a.x, 3), "y": round(a.y, 3), "z": round(a.z, 3)}
                            for i, a in enumerate(anchors_room)
                        },
                    )
                except Exception:
                    pass

        # error (cm) vs GT
        dx = out_room.x - gt_room.x
        dy = out_room.y - gt_room.y
        dz = out_room.z - gt_room.z
        err_cm = 100.0 * math.sqrt(dx * dx + dy * dy + dz * dz)

        if step % LOG_EVERY_N == 0:
            flag = "RST" if did_reset else "   "
            mode = "HYB" if (DEMO_USE_HYB_OUTPUT and ok and (cost <= DEMO_COST_OK)) else "KF "
            print(
                f"[t={t:6.2f}s | S{sidx} | seg={seg:5.2f}] "
                f"ok={1 if ok else 0} it={it:3d} cost={cost:9.4f} {flag} {mode} "
                f"GT=({gt_room.x:5.2f},{gt_room.y:4.2f},{gt_room.z:5.2f}) "
                f"HYBerr={hyb_err_cm:6.1f}cm "
                f"OUT=({out_room.x:5.2f},{out_room.y:4.2f},{out_room.z:5.2f}) "
                f"err={err_cm:6.1f} cm"
            )

        # keep dt stable
        spent = time.time() - loop_t
        time.sleep(max(0.0, DT - spent))


if __name__ == "__main__":
    main()
