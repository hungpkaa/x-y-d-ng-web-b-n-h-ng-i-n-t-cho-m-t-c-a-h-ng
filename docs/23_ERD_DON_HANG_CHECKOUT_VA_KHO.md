# ERD đơn hàng, checkout và kho

Ngày 14/10/2026. Thiết kế mục tiêu; chưa sửa mã/migration.

| Bảng | Trách nhiệm |
|---|---|
| checkout_requests | Báo giá và khóa gắn CUSTOMER; chưa có đơn thì order_id NULL; thành công liên kết một đơn |
| orders | Chủ đơn, người nhận, trạng thái, tiền hàng/giảm/phí/tổng và hạn online |
| order_items | SKU, số lượng và snapshot tên/mã/cấu hình/giá lúc mua |
| order_history | Ai đổi trạng thái, thời điểm và lý do |
| inventory_reservations | Giữ hàng từng dòng đơn, theo dõi đã xuất/giải phóng/nhận về |
| inventory_movements | Dấu vết thay đổi tồn vật lý và lượng giữ, khóa chống ghi lặp |

Đã chỉnh sơ đồ và ràng buộc mục 2/2.1 của [ERD chung](07_ERD_VA_TU_DIEN_DU_LIEU.md): checkout có báo giá trước đơn, không chỉ là kết quả sau commit; bỏ liên kết phí khu vực bắt buộc khỏi đơn phí cố định. SHIPPING_RATES được đánh dấu mở rộng.

Ví dụ 10 hàng, đặt 2: tạo đơn giữ 2, còn bán 8; bàn giao tồn vật lý 8/giữ 0; hủy trước bàn giao tồn 10/giữ 0. Giao thất bại chưa cộng kho; xác nhận hàng trả về mới tăng tồn một lần.

Mã đã có snapshot/reservation/movement và request chống trùng; không kết luận đã nghiệm thu đầy đủ. Báo cáo 17 ghi lỗi fixture schema checkout, chưa sửa trong bước này. Cần ánh xạ tên cột mục tiêu với schema thực tế trước migration. Chi tiết khuyến mãi theo dòng/giữ lượt chưa chốt riêng.

Bước tiếp theo: ERD thanh toán, hoàn tiền và vận chuyển thủ công. Chưa render sơ đồ hoặc chạy lại test.
