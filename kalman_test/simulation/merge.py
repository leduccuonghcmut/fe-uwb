import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import json
from datetime import datetime

# ====================== CẤU HÌNH ======================
IMAGE_PATH = "final.png"      # ← Thay bằng tên file ảnh bạn vừa ghép
REAL_WIDTH_M = 8.0                  # ← Chiều rộng thực tế của phòng (đơn vị mét) - bạn đo thực tế
REAL_HEIGHT_M = 5.0                 # ← Chiều cao thực tế của phòng (đơn vị mét)
SAVE_FILE = "indoor_map.json"       # File lưu bản đồ + anchor
# =====================================================

# Tải ảnh
img = mpimg.imread(IMAGE_PATH)
height_px, width_px = img.shape[:2]

# Tính scale (pixel → mét)
scale_x = REAL_WIDTH_M / width_px
scale_y = REAL_HEIGHT_M / height_px

print(f"Ảnh: {width_px} × {height_px} pixel")
print(f"Phòng thực tế: {REAL_WIDTH_M} m × {REAL_HEIGHT_M} m")
print(f"Scale: {scale_x:.4f} m/pixel (X) | {scale_y:.4f} m/pixel (Y)")
print("Hệ tọa độ: (0,0) ở góc dưới-trái của ảnh\n")

anchors = []   # Danh sách anchor

def onclick(event):
    if event.xdata is None or event.ydata is None:
        return
    
    px = event.xdata
    py = event.ydata
    
    # Chuyển pixel → mét (lật trục Y để (0,0) nằm dưới-trái)
    rx = px * scale_x
    ry = (height_px - py) * scale_y
    
    anchor_id = len(anchors) + 1
    anchors.append({
        "id": anchor_id,
        "pixel": (round(px, 1), round(py, 1)),
        "real": (round(rx, 3), round(ry, 3)),
        "time": datetime.now().strftime("%H:%M:%S")
    })
    
    print(f"✅ Anchor {anchor_id} → Pixel: ({px:.0f}, {py:.0f}) | Real: ({rx:.3f}, {ry:.3f}) m")
    
    # Vẽ lên bản đồ
    ax.plot(px, py, 'ro', markersize=10)
    ax.text(px + 8, py - 8, str(anchor_id), color='white', fontsize=11,
            bbox=dict(facecolor='red', alpha=0.8, boxstyle='round'))
    plt.draw()

# ==================== HIỂN THỊ BẢN ĐỒ SỐ ====================
fig, ax = plt.subplots(figsize=(14, 9))
ax.imshow(img)
ax.set_title("Bản đồ Indoor số - Click chuột để đặt Anchor\n(Đóng cửa sổ khi xong)")
ax.axis('off')

# Kết nối click
fig.canvas.mpl_connect('button_press_event', onclick)

plt.tight_layout()
plt.show()

# ==================== SAU KHI ĐÓNG CỬA SỔ ====================
print("\n" + "="*70)
print(f"Hoàn tất! Đã đặt {len(anchors)} anchor(s)")

for a in anchors:
    print(f"Anchor {a['id']:2d} | Real: {a['real'][0]:.3f} m , {a['real'][1]:.3f} m")

# Lưu thành file JSON (bản đồ số)
if anchors or True:   # luôn lưu dù chưa có anchor
    map_data = {
        "room": {
            "width_m": REAL_WIDTH_M,
            "height_m": REAL_HEIGHT_M
        },
        "image": IMAGE_PATH,
        "scale": {"x": scale_x, "y": scale_y},
        "anchors": anchors,
        "created": datetime.now().isoformat()
    }
    
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(map_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Bản đồ số đã được lưu vào: {SAVE_FILE}")
    print("Bạn có thể load file này sau để hiển thị lại anchor cũ.")