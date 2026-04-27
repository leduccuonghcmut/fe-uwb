import cv2
import numpy as np
import os
import glob
import matplotlib.pyplot as plt

# ====================== CẤU HÌNH ======================
IMAGE_FOLDER = "Image"          # Thư mục chứa tất cả ảnh bạn chụp (gửi từ điện thoại vào đây)
OUTPUT_FILE = "final.png"     # Tên file ảnh ghép cuối cùng
# =====================================================

# Đọc tất cả ảnh trong thư mục (jpg, png, jpeg)
image_paths = sorted(glob.glob(os.path.join(IMAGE_FOLDER, "*.[jJpP][pPnN][gG]")))
if len(image_paths) < 2:
    print("Cần ít nhất 2 ảnh để ghép!")
    exit()

images = []
for path in image_paths:
    img = cv2.imread(path)
    if img is not None:
        images.append(img)
        print(f"Đã load: {os.path.basename(path)} - Kích thước: {img.shape[1]}x{img.shape[0]}")

print(f"\nTổng cộng {len(images)} ảnh. Bắt đầu ghép...")

# Tạo stitcher (OpenCV có sẵn, rất mạnh)
stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)   # Dùng SCANS cho bản đồ phẳng (floor plan)

status, stitched = stitcher.stitch(images)

if status == cv2.Stitcher_OK:
    print("✅ Ghép thành công!")
    
    # Lưu file
    cv2.imwrite(OUTPUT_FILE, stitched)
    print(f"Đã lưu bản đồ ghép tại: {OUTPUT_FILE}")
    
    # Hiển thị để kiểm tra (dùng matplotlib)
    stitched_rgb = cv2.cvtColor(stitched, cv2.COLOR_BGR2RGB)
    plt.figure(figsize=(15, 10))
    plt.imshow(stitched_rgb)
    plt.title("Bản đồ phòng sau khi ghép")
    plt.axis('off')
    plt.show()
    
else:
    print(f"❌ Ghép thất bại. Mã lỗi: {status}")
    print("Lý do thường gặp:")
    print("- Ảnh chồng lấn quá ít (<30%)")
    print("- Ảnh bị rung hoặc góc chụp khác nhau nhiều")
    print("- Ánh sáng thay đổi mạnh giữa các ảnh")

# Gợi ý: Sau khi ghép xong, mở file bằng Photopea.com để crop sạch và chỉnh thẳng nếu cần