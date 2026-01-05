# import math
# import time
# import requests
# from collections import defaultdict
#
# from hybrid_scalable import Vec3 as HVec3, s_from_groundtruth, hybrid_solve_LM
# from gmc_kalman_filter import AdaptiveGMCKalman3D
# from gmc_kalman_filter import Vec3 as KVec3
#
# # ================== CONFIG ==================
# SCENARIO_DUR_S = 10.0
# NUM_SCENARIOS = 6
#
# DT = 0.1
# NOISE_STD_M = 0.05     # 5cm synthetic noise
# LOG_EVERY_N = 10
#
# HEIGHT_PRIOR_M = 1.55
# HEIGHT_PRIOR_ALPHA = 0.3
#
# GUARD_COST_OK = 0.02
# GUARD_INNOV_M = 0.50
#
# PUSH_URL = "http://localhost:3000/push"
#
# # ================== Utils ==================
# def clamp(v, lo, hi):
#     return max(lo, min(hi, v))
#
# def send_position(x, y, z):
#     try:
#         requests.get(
#             PUSH_URL,
#             params={"x": round(x,3), "y": round(y,3), "z": round(z,3)},
#             timeout=0.25,
#         )
#     except Exception:
#         pass
#
# def dist3(a, b):
#     return math.sqrt(
#         (a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2
#     )
#
# # room(x,z,y) <-> solver(x,y,z)
# def room_to_solver(v: HVec3):
#     return HVec3(v.x, v.z, v.y)
#
# def solver_to_room(v: HVec3):
#     return HVec3(v.x, v.z, v.y)
#
# def apply_height_prior_h(v: HVec3):
#     if HEIGHT_PRIOR_ALPHA <= 0:
#         return v
#     z = (1-HEIGHT_PRIOR_ALPHA)*v.z + HEIGHT_PRIOR_ALPHA*HEIGHT_PRIOR_M
#     return HVec3(v.x, v.y, z)
#
# def apply_height_prior_k(v: KVec3):
#     if HEIGHT_PRIOR_ALPHA <= 0:
#         return v
#     z = (1-HEIGHT_PRIOR_ALPHA)*v.z + HEIGHT_PRIOR_ALPHA*HEIGHT_PRIOR_M
#     return KVec3(v.x, v.y, z)
#
# # ================== Scenarios ==================
# def anchors_for_scenario(idx):
#     if idx == 0:
#         return [HVec3(0,2.8,0), HVec3(12,2.8,0), HVec3(0,2.8,12), HVec3(12,2.8,12)]
#     if idx == 1:
#         return [HVec3(1,2.8,1), HVec3(11,2.8,1), HVec3(1,2.8,11), HVec3(11,2.8,11)]
#     if idx == 2:
#         return [HVec3(0,2.8,0), HVec3(12,2.8,0), HVec3(0,1.4,12), HVec3(12,1.4,12)]
#     if idx == 3:
#         return [HVec3(0,2.8,0), HVec3(12,1.4,0), HVec3(0,2.0,12), HVec3(12,2.8,12)]
#     if idx == 4:
#         return [HVec3(0,2.0,0), HVec3(4,2.0,0), HVec3(8,2.0,0), HVec3(12,2.2,2)]
#     if idx == 5:
#         return [HVec3(0,2.0,0), HVec3(0.5,2.0,0.1), HVec3(1.0,2.0,0), HVec3(1.5,2.1,0.1)]
#     return anchors_for_scenario(0)
#
# def tag_trajectory(seg_t, idx):
#     cx, cz = 6.0, 6.0
#     rx, rz = [(5,4.2),(5.2,2.8),(4.2,5.2),(4.8,4.8),(5.6,2.0),(5.6,2.0)][idx]
#     ang = 2*math.pi*seg_t/SCENARIO_DUR_S
#
#     x = cx + rx*math.cos(ang)
#     z = cz + rz*math.sin(ang)
#     y = 1.55 + 0.18*math.sin(1.2*ang)
#
#     return HVec3(
#         clamp(x,0.6,11.4),
#         clamp(y,1.2,2.2),
#         clamp(z,0.6,11.4),
#     )
#
# def scenario_of_time(t):
#     seg = int(t//SCENARIO_DUR_S)
#     return seg % NUM_SCENARIOS, t - seg*SCENARIO_DUR_S
#
# # ================== KF ==================
# kf = AdaptiveGMCKalman3D(
#     process_var=0.15,
#     meas_var=0.01,
#     alpha=1.0,
# )
#
# # ================== MAIN ==================
# def main():
#     print("\n===== DEMO Hybrid + GMC-KF (detailed demo log) =====\n")
#
#     t0 = time.time()
#     last_sidx = None
#     err_stat = defaultdict(list)
#
#     # init
#     sidx, seg = scenario_of_time(0.0)
#     anchors = anchors_for_scenario(sidx)
#     gt = tag_trajectory(seg, sidx)
#
#     anchors_sol = [room_to_solver(a) for a in anchors]
#     gt_sol = room_to_solver(gt)
#
#     s = s_from_groundtruth(anchors_sol, gt_sol, NOISE_STD_M)
#     est, _, ok, _ = hybrid_solve_LM(anchors_sol, s)
#
#     if ok:
#         est = apply_height_prior_h(est)
#         kf.reset(apply_height_prior_k(KVec3(est.x, est.y, est.z)))
#
#     step = 0
#
#     while True:
#         loop_t = time.time()
#         t = loop_t - t0
#         step += 1
#
#         sidx, seg = scenario_of_time(t)
#         anchors = anchors_for_scenario(sidx)
#         gt = tag_trajectory(seg, sidx)
#
#         # ===== end scenario summary =====
#         if last_sidx is not None and sidx != last_sidx:
#             errs = err_stat[last_sidx]
#             if errs:
#                 errs_sorted = sorted(errs)
#                 p90 = errs_sorted[int(0.9*len(errs_sorted))]
#                 print(
#                     f"=== S{last_sidx} DONE | "
#                     f"mean={sum(errs)/len(errs):5.1f} cm | "
#                     f"p90={p90:5.1f} cm | "
#                     f"max={max(errs):5.1f} cm | N={len(errs)}"
#                 )
#             err_stat[last_sidx].clear()
#
#         last_sidx = sidx
#
#         anchors_sol = [room_to_solver(a) for a in anchors]
#         gt_sol = room_to_solver(gt)
#
#         s = s_from_groundtruth(anchors_sol, gt_sol, NOISE_STD_M)
#
#         init = apply_height_prior_h(HVec3(*kf.get_state_vec3().__dict__.values()))
#         est, it, ok, cost = hybrid_solve_LM(anchors_sol, s, init=init)
#
#         if ok:
#             est = apply_height_prior_h(est)
#
#         kf.predict(DT)
#
#         did_reset = False
#         innov_m = float("nan")
#         mode = "KF"
#
#         if ok:
#             meas = apply_height_prior_k(KVec3(est.x, est.y, est.z))
#             pred = apply_height_prior_k(kf.get_state_vec3())
#             innov_m = dist3(meas, pred)
#
#             if cost <= GUARD_COST_OK and innov_m > GUARD_INNOV_M:
#                 kf.reset(meas)
#                 smoothed = meas
#                 did_reset = True
#             else:
#                 smoothed = kf.update(meas, cost)
#
#             mode = "KF"
#         else:
#             smoothed = kf.get_state_vec3()
#
#         out = solver_to_room(HVec3(smoothed.x, smoothed.y, smoothed.z))
#         send_position(out.x, out.y, out.z)
#
#         err_cm = 100.0 * dist3(out, gt)
#         err_stat[sidx].append(err_cm)
#
#         if step % LOG_EVERY_N == 0:
#             flag = "RST" if did_reset else "   "
#             print(
#                 f"[t={t:5.2f}s | S{sidx}] "
#                 f"it={it:3d} cost={cost:6.3f} "
#                 f"innov={innov_m:4.2f}m "
#                 f"{flag} {mode} "
#                 f"err={err_cm:5.1f}cm"
#             )
#
#         time.sleep(max(0.0, DT - (time.time() - loop_t)))
#
#
# if __name__ == "__main__":
#     main()


import math
import time
import requests
from collections import defaultdict

from hybrid_scalable import Vec3 as HVec3, s_from_groundtruth, hybrid_solve_LM
from gmc_kalman_filter import AdaptiveGMCKalman3D
from gmc_kalman_filter import Vec3 as KVec3

# ================== Socket.IO (anchors) ==================
try:
    import socketio
    sio = socketio.Client(reconnection=True)
    sio.connect("http://localhost:3000")
    print("[Socket.IO] Connected to server")
except Exception as e:
    print("[Socket.IO] Disabled:", e)
    sio = None

# ================== CONFIG ==================
SCENARIO_DUR_S = 10.0
NUM_SCENARIOS = 6

DT = 0.1
NOISE_STD_M = 0.05     # 5cm synthetic noise
LOG_EVERY_N = 10

HEIGHT_PRIOR_M = 1.55
HEIGHT_PRIOR_ALPHA = 0.3

GUARD_COST_OK = 0.02
GUARD_INNOV_M = 0.50

PUSH_URL = "http://localhost:3000/push"

# ================== Utils ==================
def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def send_position(x, y, z):
    try:
        requests.get(
            PUSH_URL,
            params={"x": round(x,3), "y": round(y,3), "z": round(z,3)},
            timeout=0.25,
        )
    except Exception:
        pass

def send_anchors_to_web(anchors_room):
    if not sio:
        return
    try:
        payload = {
            f"A{i}": {
                "x": round(a.x, 3),
                "y": round(a.y, 3),   # Y = height
                "z": round(a.z, 3)
            }
            for i, a in enumerate(anchors_room)
        }
        sio.emit("anchors-update", payload)
        print("[ANCHORS] Sent →", payload)
    except Exception:
        pass

def dist3(a, b):
    return math.sqrt(
        (a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2
    )

# room(x,z,y) <-> solver(x,y,z)
def room_to_solver(v: HVec3):
    return HVec3(v.x, v.z, v.y)

def solver_to_room(v: HVec3):
    return HVec3(v.x, v.z, v.y)

def apply_height_prior_h(v: HVec3):
    if HEIGHT_PRIOR_ALPHA <= 0:
        return v
    z = (1-HEIGHT_PRIOR_ALPHA)*v.z + HEIGHT_PRIOR_ALPHA*HEIGHT_PRIOR_M
    return HVec3(v.x, v.y, z)

def apply_height_prior_k(v: KVec3):
    if HEIGHT_PRIOR_ALPHA <= 0:
        return v
    z = (1-HEIGHT_PRIOR_ALPHA)*v.z + HEIGHT_PRIOR_ALPHA*HEIGHT_PRIOR_M
    return KVec3(v.x, v.y, z)

# ================== Scenarios ==================
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

def scenario_of_time(t):
    seg = int(t//SCENARIO_DUR_S)
    return seg % NUM_SCENARIOS, t - seg*SCENARIO_DUR_S

# ================== KF ==================
kf = AdaptiveGMCKalman3D(
    process_var=0.15,
    meas_var=0.01,
    alpha=1.0,
)

# ================== MAIN ==================
def main():
    print("\n===== DEMO Hybrid + GMC-KF (tag + anchors → web) =====\n")

    t0 = time.time()
    last_sidx = None
    err_stat = defaultdict(list)

    # init
    sidx, seg = scenario_of_time(0.0)
    anchors = anchors_for_scenario(sidx)
    gt = tag_trajectory(seg, sidx)

    send_anchors_to_web(anchors)

    anchors_sol = [room_to_solver(a) for a in anchors]
    gt_sol = room_to_solver(gt)

    s = s_from_groundtruth(anchors_sol, gt_sol, NOISE_STD_M)
    est, _, ok, _ = hybrid_solve_LM(anchors_sol, s)

    if ok:
        est = apply_height_prior_h(est)
        kf.reset(apply_height_prior_k(KVec3(est.x, est.y, est.z)))

    step = 0

    while True:
        loop_t = time.time()
        t = loop_t - t0
        step += 1

        sidx, seg = scenario_of_time(t)
        anchors = anchors_for_scenario(sidx)
        gt = tag_trajectory(seg, sidx)

        # ===== end scenario summary =====
        if last_sidx is not None and sidx != last_sidx:
            errs = err_stat[last_sidx]
            if errs:
                errs_sorted = sorted(errs)
                p90 = errs_sorted[int(0.9*len(errs_sorted))]
                print(
                    f"=== S{last_sidx} DONE | "
                    f"mean={sum(errs)/len(errs):5.1f} cm | "
                    f"p90={p90:5.1f} cm | "
                    f"max={max(errs):5.1f} cm | N={len(errs)}"
                )
            err_stat[last_sidx].clear()

            # 🔥 gửi anchor mới khi đổi scenario
            send_anchors_to_web(anchors)

        last_sidx = sidx

        anchors_sol = [room_to_solver(a) for a in anchors]
        gt_sol = room_to_solver(gt)

        s = s_from_groundtruth(anchors_sol, gt_sol, NOISE_STD_M)

        init = apply_height_prior_h(HVec3(*kf.get_state_vec3().__dict__.values()))
        est, it, ok, cost = hybrid_solve_LM(anchors_sol, s, init=init)

        if ok:
            est = apply_height_prior_h(est)

        kf.predict(DT)

        did_reset = False
        innov_m = float("nan")

        if ok:
            meas = apply_height_prior_k(KVec3(est.x, est.y, est.z))
            pred = apply_height_prior_k(kf.get_state_vec3())
            innov_m = dist3(meas, pred)

            if cost <= GUARD_COST_OK and innov_m > GUARD_INNOV_M:
                kf.reset(meas)
                smoothed = meas
                did_reset = True
            else:
                smoothed = kf.update(meas, cost)
        else:
            smoothed = kf.get_state_vec3()

        out = solver_to_room(HVec3(smoothed.x, smoothed.y, smoothed.z))
        send_position(out.x, out.y, out.z)

        err_cm = 100.0 * dist3(out, gt)
        err_stat[sidx].append(err_cm)

        if step % LOG_EVERY_N == 0:
            flag = "RST" if did_reset else "   "
            print(
                f"[t={t:5.2f}s | S{sidx}] "
                f"it={it:3d} cost={cost:6.3f} "
                f"innov={innov_m:4.2f}m "
                f"{flag} KF "
                f"err={err_cm:5.1f}cm"
            )

        time.sleep(max(0.0, DT - (time.time() - loop_t)))


if __name__ == "__main__":
    main()
