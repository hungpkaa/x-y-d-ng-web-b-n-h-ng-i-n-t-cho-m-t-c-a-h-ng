# CODE-04 — Phí giao hàng cố định

Ngày thực hiện: 18/10/2026. Căn cứ: QD-21, UC-17, BR-15 và kế hoạch CODE-04.

## Đã thực hiện

- Checkout dùng duy nhất phí trong shipping_policy do ADMIN cấu hình; không yêu cầu vùng hoặc trọng lượng SKU, kể cả dữ liệu cũ đang bật regional_shipping.
- Khách xem phí và tổng tiền trước xác nhận. Báo giá lưu snapshot phí; đổi phí trước đặt yêu cầu lấy báo giá mới, không tạo đơn hoặc làm mất giỏ/giữ kho.
- Đơn đã tạo và gửi lại cùng yêu cầu giữ phí cũ. Báo giá vùng cũ chưa đặt phải xác nhận lại phí cố định.
- Màn hình ADMIN chỉ giữ biểu phí cố định, version, lý do và audit. Gỡ route cấu hình vùng/trọng lượng khỏi ứng dụng; giữ module và bảng mở rộng, không xóa dữ liệu hay sửa đơn lịch sử.
- Mức phí kinh doanh chưa chốt; không tự đặt một mức thu mới.

## Xác minh

`npm.cmd test`: 120 ca, 110 đạt, 0 lỗi, 10 bỏ qua (PostgreSQL chưa cấu hình chạy). Có ba ca mới kiểm tra cấu hình vùng cũ, SKU thiếu trọng lượng, snapshot/replay, đổi phí và báo giá vùng chưa đặt. Bộ HTTP giỏ/checkout hiện có cũng đạt.

`npm.cmd run test:smoke`: đạt, gồm quyền STAFF/ADMIN, SKU, đơn COD và giao hàng.

Chưa kiểm tra trực quan trình duyệt/mobile hoặc PostgreSQL trong bước này. Không khởi động ứng dụng với CSDL đang sử dụng và không triển khai web.

## Bước nhỏ tiếp theo

CODE-05A: đối chiếu luồng COD với tài liệu, từ tạo đơn → xác nhận → chuẩn bị → bàn giao → giao thành công → ADMIN ghi nhận đủ tiền. Kiểm tra các mốc giữ/xuất kho và quyền thu tiền trước khi sửa khoảng cách thực tế.
