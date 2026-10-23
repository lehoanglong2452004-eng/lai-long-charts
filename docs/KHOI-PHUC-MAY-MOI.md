# LAI LONG CHARTS — Sao lưu và khôi phục trên máy mới

© 2026 Lai Long Charts. Bảo lưu mọi quyền.

---

## 1. Hiểu đúng về "bản sao" của hệ thống

Hệ thống hiện được lưu ở **3 nơi**:

| Nơi | Vai trò | Có cần máy tính bật không? |
|---|---|---|
| **GitHub** (repo `lehoanglong2452004-eng/lai-long-charts`) | Bản **chính, đang chạy**. Trang web và lịch tự cập nhật dữ liệu đều chạy ở đây | **Không.** Tắt máy, đổi máy hay mất máy thì trang vẫn chạy |
| **Ổ E: `E:\LaiLongCharts`** | Bản sao đầy đủ trên máy hiện tại | — |
| **Google Drive** (bạn tự tải lên) | Bản sao dự phòng ngoài máy | — |

> **Quan trọng:** đổi máy tính **không làm trang web ngừng chạy**. Bạn chỉ cần bản sao khi muốn **chỉnh sửa** hệ thống trên máy mới, hoặc khi phải dựng lại trong trường hợp mất tài khoản GitHub.

---

## 2. Trong thư mục sao lưu có gì

```
E:\LaiLongCharts\
├── lai-long-charts\              ← TOÀN BỘ công trình (y hệt GitHub)
│   ├── .git\                     ← lịch sử mọi lần thay đổi (thư mục ẩn, đừng xóa)
│   ├── index.html, css\, js\     ← giao diện web
│   ├── scripts\                  ← script Python lấy dữ liệu
│   ├── data\                     ← dữ liệu COT + giá (tại thời điểm sao lưu)
│   ├── .github\workflows\        ← lịch tự động
│   └── docs\                     ← tài liệu (file này nằm ở đây)
├── LaiLongCharts-sao-luu.zip     ← cùng nội dung trên, nén thành 1 file (nên tải file này lên Drive)
├── HUONG-DAN-HE-THONG.pdf        ← giáo trình: cấu trúc và logic hệ thống
├── KHOI-PHUC-MAY-MOI.pdf         ← hướng dẫn này
└── CAP-NHAT-SAO-LUU.bat          ← bấm đúp để làm mới bản sao lưu
```

**Không có trong bản sao (cố ý, vì lý do bảo mật):** mật khẩu, token đăng nhập GitHub. Sang máy mới bạn đăng nhập lại.

---

## 3. Tải lên Google Drive

1. Mở https://drive.google.com

2. Bấm **+ Mới** → **Tải tệp lên**, chọn `E:\LaiLongCharts\LaiLongCharts-sao-luu.zip`.
    - Nên tải **file zip** vì nhanh hơn nhiều so với tải cả thư mục có hàng trăm file nhỏ.

3. Nếu muốn, tải thêm 2 file PDF để đọc trực tiếp trên Drive.

**Khi nào cần tải lại?** Mỗi khi hệ thống được sửa (thêm tính năng, thêm sản phẩm). Cách làm: bấm đúp `CAP-NHAT-SAO-LUU.bat` để làm mới file zip, rồi tải file zip mới lên Drive (chọn "Thay thế").

---

## 4. Khôi phục trên máy mới (từng bước)

### Bước 1: Cài phần mềm (chỉ làm một lần)

| Phần mềm | Tải ở đâu | Dùng để |
|---|---|---|
| **Git** | https://git-scm.com/download/win | Quản lý mã nguồn, đẩy lên GitHub |
| **Python 3.12** | https://www.python.org/downloads/ (nhớ tick **Add Python to PATH**) | Chạy script lấy dữ liệu, chạy thử trang |
| **GitHub CLI** | https://cli.github.com | Đăng nhập GitHub từ máy |
| **Claude** (tùy chọn) | https://claude.com/download | Nhờ Claude tiếp tục phát triển |

### Bước 2: Lấy bản sao về

**Cách A, từ Google Drive** (đúng ý muốn "bản y chang"):

1. Tải `LaiLongCharts-sao-luu.zip` từ Drive về.
2. Chuột phải, chọn **Extract All…**, rồi giải nén vào `E:\LaiLongCharts\` (hoặc bất kỳ ổ nào).

3. Bạn sẽ có thư mục `E:\LaiLongCharts\lai-long-charts\`.

**Cách B, từ GitHub** (nhanh nhất, luôn là bản mới nhất):
```
git clone https://github.com/lehoanglong2452004-eng/lai-long-charts.git E:\LaiLongCharts\lai-long-charts
```

### Bước 3: Đăng nhập GitHub

Mở **Command Prompt** hoặc **PowerShell**:
```
gh auth login
```
Chọn **GitHub.com**, chọn **HTTPS**, chọn **Login with a web browser**, rồi làm theo hướng dẫn.

### Bước 4: Đồng bộ với bản đang chạy

```
cd E:\LaiLongCharts\lai-long-charts
git pull
```
Lệnh này kéo về dữ liệu mới nhất mà robot đã cập nhật kể từ ngày bạn sao lưu.

### Bước 5: Chạy thử trên máy (không bắt buộc)

```
cd E:\LaiLongCharts\lai-long-charts
python -m http.server 8765
```
Mở trình duyệt vào **http://localhost:8765**, trang sẽ chạy y như bản trên mạng. (Giá futures trong ngày cần chạy thêm `python scripts\fetch_intraday.py`, xem bước 6.)

### Bước 6: Chạy các script dữ liệu trên máy (không bắt buộc)

```
cd E:\LaiLongCharts\lai-long-charts
pip install -r scripts\requirements.txt
python scripts\fetch_cot.py
python scripts\fetch_prices.py
python scripts\fetch_intraday.py
```

### Bước 7: Sửa và đưa lên mạng

Sau khi sửa file:
```
git add -A
git commit -m "Mô tả thay đổi"
git push
```
Khoảng 1–2 phút sau, trang web tự cập nhật.

### Bước 8: Tiếp tục làm việc cùng Claude

Mở ứng dụng Claude, chọn **Code**, chọn thư mục `E:\LaiLongCharts\lai-long-charts`. Claude đọc được toàn bộ mã nguồn và tài liệu trong `docs\` để tiếp tục phát triển.

---

## 5. Trường hợp xấu: mất tài khoản GitHub, hoặc muốn chuyển sang tài khoản mới

Bản sao trên Drive đủ để **dựng lại toàn bộ từ đầu**:

1. Tạo tài khoản GitHub mới, rồi tạo repo trống tên `lai-long-charts` (**Public**, **không** tick README).

2. Giải nén bản sao, mở terminal trong thư mục `lai-long-charts`:
    ```
   gh auth login
   git remote set-url origin https://github.com/<TÊN-TÀI-KHOẢN-MỚI>/lai-long-charts.git
   git push -u origin main
   ```

3. Trên GitHub, vào **Settings → Actions → General → Workflow permissions**, chọn **Read and write permissions**, rồi bấm **Save**.
4. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.

5. Vào tab **Actions**, lần lượt bấm **Run workflow** cho **Update COT**, **Update Prices** và **Deploy Site**.
6. Trang mới sẽ ở `https://<TÊN-TÀI-KHOẢN-MỚI>.github.io/lai-long-charts/`, với toàn bộ lịch sử thay đổi và lịch tự động như cũ.

---

## 6. Kiểm tra bản sao có nguyên vẹn không

Trong thư mục `lai-long-charts`, chạy:
```
git log --oneline -5
git status
```
- `git log` hiện danh sách các lần thay đổi gần nhất, nghĩa là lịch sử còn đủ.
- `git status` báo `nothing to commit, working tree clean`, nghĩa là các file khớp đúng với lịch sử.
