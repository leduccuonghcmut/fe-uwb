import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.widgets import PolygonSelector, TextBox, Button
import numpy as np
import json
from datetime import datetime

# ================= CONFIG =================
IMAGE_PATH = "Im.jpg"
SAVE_FILE = "indoor_map.json"
# ==========================================

img = mpimg.imread(IMAGE_PATH)
h, w = img.shape[:2]

print(f"Loaded image: {w} x {h}")

# ================= STATE =================
scale = None
scale_points = []
polygon = []
anchors = []
mode = "scale"
real_distance = 5.0  # default
# =========================================

# ================= CLICK =================
def onclick(event):
    global scale, scale_points, mode

    if event.xdata is None or event.ydata is None:
        return

    x, y = event.xdata, event.ydata

    # ===== SCALE =====
    if mode == "scale":
        scale_points.append((x, y))
        ax.plot(x, y, 'yo')
        plt.draw()

        if len(scale_points) == 2:
            x1, y1 = scale_points[0]
            x2, y2 = scale_points[1]

            pixel_dist = np.sqrt((x2-x1)**2 + (y2-y1)**2)

            scale = real_distance / pixel_dist

            print(f"Scale: {scale:.4f} m/pixel")

            mode = "polygon"
            print("👉 Kéo polygon rồi nhấn Enter")

    # ===== ANCHOR =====
    elif mode == "anchor":
        px, py = x, y
        rx = px * scale
        ry = (h - py) * scale

        aid = len(anchors) + 1
        anchors.append({
            "id": aid,
            "pixel": [round(px,1), round(py,1)],
            "real": [round(rx,3), round(ry,3)]
        })

        print(f"📍 Anchor {aid}: ({rx:.2f}, {ry:.2f}) m")

        ax.plot(px, py, 'ro')
        ax.text(px+5, py-5, str(aid),
                color='white',
                bbox=dict(facecolor='red', alpha=0.8))
        plt.draw()

# ================= POLYGON =================
def onselect(verts):
    global polygon, mode
    polygon = np.array(verts)

    print(f"✅ Polygon xong ({len(polygon)} điểm)")
    print("👉 Click đặt anchor")

    mode = "anchor"

# ================= INPUT =================
def submit(text):
    global real_distance
    try:
        real_distance = float(text)
        print(f"✔ Distance set: {real_distance} m")
    except:
        print("⚠️ Nhập số không hợp lệ")

# ================= SAVE =================
def save(event):
    if scale is None or len(polygon) == 0:
        print("⚠️ Chưa đủ dữ liệu để lưu")
        return

    data = {
        "image": IMAGE_PATH,
        "scale": scale,
        "polygon": polygon.tolist(),
        "anchors": anchors,
        "created": datetime.now().isoformat()
    }

    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("✅ Saved:", SAVE_FILE)

# ================= UI =================
fig, ax = plt.subplots(figsize=(14, 9))
plt.subplots_adjust(bottom=0.2)

ax.imshow(img)
ax.set_title(
    "1. Nhập khoảng cách → 2. Click 2 điểm → 3. Vẽ polygon → 4. Đặt anchor"
)
ax.axis('off')

# Polygon
selector = PolygonSelector(
    ax,
    onselect,
    useblit=True,
    props=dict(color='red', linewidth=2)
)

# Click
fig.canvas.mpl_connect('button_press_event', onclick)

# ===== TextBox nhập mét =====
axbox = plt.axes([0.2, 0.05, 0.2, 0.05])
text_box = TextBox(axbox, 'Distance (m): ', initial=str(real_distance))
text_box.on_submit(submit)

# ===== Button save =====
axbtn = plt.axes([0.5, 0.05, 0.2, 0.05])
btn = Button(axbtn, 'Save Map')
btn.on_clicked(save)

plt.show()