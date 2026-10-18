# CODE-06A — Kiểm tra khuyến mãi

Ngày kiểm tra: 18/10/2026. Căn cứ QD-22, UC-29, BR-04/10. Phạm vi: mã khuyến mãi hiện có và ghép nối giỏ tài khoản/checkout/phí cố định.

## Kết luận

Chưa phát hiện sai lệch với các yêu cầu đã chốt trong phạm vi kiểm tra SQLite. Không sửa mã nghiệp vụ; bổ sung ba ca tích hợp trong `test/promotion-account-flow.test.js`. Các ca mới tạo/sửa/tắt mã qua dịch vụ ADMIN, đặt qua giỏ tài khoản và kiểm tra dữ liệu đơn/kho/lượt dùng sau xử lý.

| Yêu cầu | Kết quả kiểm tra |
|---|---|
| Tối đa một mã mỗi đơn | Chuỗi chứa nhiều mã và mảng mã bị từ chối; chuẩn hóa khoảng trắng/chữ thường cho một mã hợp lệ |
| Chỉ giảm tiền hàng | Tiền hàng 100.000, giảm 10% = 10.000, phí 25.000 giữ nguyên; tổng 115.000 |
| Điều kiện tiền hàng tối thiểu | Tiền hàng 100.000 không đạt minimum 110.000 dù cộng phí thành 125.000 |
| Thời hạn và trần giảm | Bộ cũ kiểm tra trước start, đúng end, phạm vi sản phẩm và cap; giảm tối đa subtotal-1 theo BR-04 |
| Quyền quản lý | CUSTOMER/STAFF không tạo mã; STAFF không tắt mã; ADMIN được tạo/tắt |
| Giữ snapshot | Tắt mã không đổi subtotal/discount/phí/tổng/code của đơn cũ; replay đơn cũ không lấy thêm lượt hoặc xóa hàng mới thêm |
| Lượt dùng theo người | Khách đã giữ lượt bị chặn trong khi khách khác còn được báo giá khi tổng lượt còn đủ |
| Tranh lượt cuối sau báo giá | Khách thua không mất giỏ, không tạo đơn, không giữ thêm kho/lượt; request chưa gắn đơn |
| Xem báo giá chưa giữ lượt | Không có redemption trước khi đặt |
| Hủy trước bàn giao | Trả lượt một lần; có thể đặt lại; bộ cũ kiểm tra lỗi lưu hủy rollback |

## Phân biệt yêu cầu đã chốt và chi tiết thiết kế

QD-22 đã chốt một mã/đơn, không cộng dồn, chỉ giảm tiền hàng, kiểm tra thời hạn/tối thiểu/lượt và lưu mức giảm trên đơn.

UC-29 và BR-10 vẫn ghi FIXED/PERCENT, cap, PRODUCT/ALL, minimum theo subtotal, khoảng [start,end), HELD/USED/RELEASED là chi tiết thiết kế chưa chốt riêng. Báo cáo này kiểm tra hành vi mã đang có, không tự nâng những chi tiết đó thành quyết định mới của người dùng. Cơ chế hiện tại: HELD+USED chiếm lượt; hủy trước bàn giao RELEASED; bàn giao USED; thất bại sau bàn giao không tự trả lượt. Mã đã có lịch sử redemption không sửa quy tắc; tắt mã không thay đơn cũ.

## Xác minh và giới hạn

`node --test test/promotion-account-flow.test.js test/promotions.test.js`: **8 ca đạt, 0 lỗi, 0 bỏ qua**, gồm ba ca mới và năm ca hiện có (có tranh lượt cuối bằng hai kết nối).

Không chạy lại toàn bộ test vì chỉ thêm test/tài liệu. Chưa kiểm tra PostgreSQL hoặc giao diện quản trị/checkout bằng trình duyệt. Không thay đổi CSDL/cấu hình đang dùng và không triển khai web. Kiểm thử này không thay việc nghiệm thu UI và môi trường triển khai ở CODE-08.

## Tiếp theo

CODE-06B: đánh giá sản phẩm theo QD-23 — chủ dòng đơn đã giao, một đánh giá mỗi dòng, 1–5 sao và nhận xét, ADMIN duyệt trước công khai, sửa phải chờ duyệt lại, điểm trung bình chỉ tính nội dung công khai.
