import math
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class Vec2:
    x: float
    y: float


def dist_2d(a: Vec2, b: Vec2) -> float:
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def solve_2d_tof(
        anchors: List[Vec2],
        distances: List[float],
        init_guess: Vec2 = Vec2(0, 0),
        max_iter: int = 50,
        tol: float = 1e-5
) -> Tuple[Vec2, bool]:
    """
    Giải tọa độ 2D từ khoảng cách ToF (Trilateration) dùng LM.
    anchors: Danh sách tọa độ Anchor [A1, A2, A3, ...]
    distances: Danh sách khoảng cách tương ứng [r1, r2, r3, ...]
    """
    curr_x, curr_y = init_guess.x, init_guess.y
    lam = 0.01  # Damping factor

    for i in range(max_iter):
        residuals = []
        jacobian = []

        for a, r_measured in zip(anchors, distances):
            r_est = math.sqrt((curr_x - a.x) ** 2 + (curr_y - a.y) ** 2)
            # f(x,y) = sqrt((x-xi)^2 + (y-yi)^2) - ri
            residuals.append(r_est - r_measured)

            # Đạo hàm riêng (Jacobian)
            if r_est < 1e-6: r_est = 1e-6
            df_dx = (curr_x - a.x) / r_est
            df_dy = (curr_y - a.y) / r_est
            jacobian.append([df_dx, df_dy])

        # Tính JT * J (Ma trận 2x2) và JT * f (Vector 2x1)
        jtj = [[0.0, 0.0], [0.0, 0.0]]
        jtf = [0.0, 0.0]

        for j, res in zip(jacobian, residuals):
            jtj[0][0] += j[0] * j[0]
            jtj[0][1] += j[0] * j[1]
            jtj[1][0] += j[1] * j[0]
            jtj[1][1] += j[1] * j[1]

            jtf[0] += j[0] * res
            jtf[1] += j[1] * res

        # Thêm Levenberg Marquardt damping
        jtj[0][0] += lam
        jtj[1][1] += lam

        # Giải hệ phương trình 2x2: (JTJ) * delta = -JTF
        # Cramer's rule
        det = jtj[0][0] * jtj[1][1] - jtj[0][1] * jtj[1][0]
        if abs(det) < 1e-12:
            break

        dx = (-jtf[0] * jtj[1][1] - (-jtf[1] * jtj[0][1])) / det
        dy = (jtj[0][0] * (-jtf[1]) - jtj[1][0] * (-jtf[0])) / det

        # Cập nhật nghiệm
        curr_x += dx
        curr_y += dy

        # Kiểm tra điều kiện dừng
        if math.sqrt(dx ** 2 + dy ** 2) < tol:
            return Vec2(curr_x, curr_y), True

    return Vec2(curr_x, curr_y), False


# ---------- TEST CODE ----------
if __name__ == "__main__":
    # Giả lập 4 Anchor 2D
    anchors_2d = [Vec2(0, 0), Vec2(5, 0), Vec2(0, 5), Vec2(5, 5)]

    # Giả sử Tag đang ở (2.5, 1.8), ToF đo được có sai số nhẹ
    measured_distances = [3.08, 3.08, 3.9, 3.9]  # r1, r2, r3, r4

    # Tính toán
    est_pos, success = solve_2d_tof(anchors_2d, measured_distances)

    print(f"Ket qua test 2D ToF:")
    print(f"Toa do uoc luong: X={est_pos.x:.3f}, Y={est_pos.y:.3f}")
    print(f"Hoi tu thanh cong: {success}")