# 🌸 Lớp Mình Xinh — Xếp chỗ ngồi

Web xếp chỗ ngồi cho giáo viên, phong cách dễ thương, hiệu ứng mượt theo vật lý. Viết bằng HTML, CSS và JavaScript thuần — **không cần cài đặt**, mở `index.html` bằng trình duyệt là dùng được.

## Tính năng

- 📥 **Nhập danh sách** từ Excel (.xlsx, .xls), CSV, TXT hoặc dán chữ — tự nhận diện cột họ tên, giới tính, học lực, chiều cao, ưu tiên, ghi chú; tự đoán giới tính theo tên.
- 🖐️ **Kéo thả** thẻ học sinh với chuyển động lò xo, lắc như con lắc, đáp xuống có nảy; thả vào chỗ có người thì hai bạn đổi chỗ.
- 📱 **Cảm ứng**: chạm để chọn rồi chạm chỗ ngồi để xếp, hoặc giữ để kéo.
- ✨ **Xếp tự động**: ngẫu nhiên, xen kẽ nam – nữ, đôi bạn cùng tiến, thấp trước cao sau, theo ABC; ưu tiên bàn đầu, tách các bạn không nên ngồi gần, giữ nguyên chỗ đã khóa.
- ↔️ Đổi dãy / đổi bàn hằng tuần, 🪑 tùy chỉnh số bàn – dãy – chỗ, tắt / bật từng bàn, 👩‍🏫 hai góc nhìn.
- 📷 Ảnh học sinh (thêm từng bạn hoặc hàng loạt theo tên file).
- 🏫 Nhiều lớp, 💾 lưu nhiều phương án sơ đồ, ↶ hoàn tác / làm lại.
- 🎁 **Chia sẻ sơ đồ** ra file `.lopxinh.json` — người nhận mở là đúng lớp, đúng chỗ ngồi.
- 📤 In A4, xuất ảnh PNG, Excel, CSV; sao lưu / khôi phục toàn bộ dữ liệu.
- 📐 Responsive cho điện thoại, máy tính bảng, laptop, màn hình lớn; ⚡ tự bật chế độ nhẹ trên máy yếu.

## Sử dụng

Mở `index.html` bằng Chrome, Edge hoặc Safari. Dữ liệu được lưu trong trình duyệt (localStorage) — nhớ dùng **Xuất & In → Sao lưu dữ liệu** để giữ một bản ra file.

Đọc / xuất Excel, xuất ảnh PNG và phông chữ cần Internet (tải từ CDN); các chức năng còn lại chạy được khi không có mạng.

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Khung trang |
| `styles.css` | Giao diện, responsive, chế độ nhẹ, bản in |
| `app.js` | Dữ liệu, kéo thả vật lý, thuật toán xếp chỗ, nhập / xuất, hộp thoại |
