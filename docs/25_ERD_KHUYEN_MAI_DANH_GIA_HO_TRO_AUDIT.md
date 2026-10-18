# ERD khuyến mãi, đánh giá, hỗ trợ và nhật ký

Thiết kế mục tiêu theo QD-22/23/25; chưa sửa mã hoặc migration.

| Nhóm / bảng | Quan hệ và trách nhiệm |
|---|---|
| promotions | Chương trình/mã, thời hạn, tối thiểu và giới hạn lượt |
| promotion_products | Phạm vi sản phẩm nếu sử dụng; PK kép chương trình/sản phẩm |
| promotion_redemptions | Lần áp dụng gắn chương trình, khách và đơn; UNIQUE order_id, mức giảm khớp snapshot |
| reviews | Một bản/dòng đơn, chủ đơn đã nhận hàng, sao/nội dung/trạng thái duyệt |
| support_requests | Yêu cầu gắn đơn/chủ khách, trạng thái và người xử lý nếu phân công |
| support_messages | Tin thuộc yêu cầu; tác giả và dấu công khai/nội bộ |
| support_history | Lịch sử trạng thái, tác nhân, thời điểm và lý do |
| audit_logs | Nhật ký thao tác quản trị, đối tượng, trước/sau đã che bí mật |

Nguồn Mermaid ở mục 2/4 và ràng buộc mục 4.1 của [ERD chung](07_ERD_VA_TU_DIEN_DU_LIEU.md). Báo cáo và gợi ý là truy vấn từ dữ liệu, không cần bảng lưu kết quả riêng ở bản đầu.

## Các điểm đã làm rõ

- Khách của review/ticket/lượt mã phải khớp chủ đơn; FK tới users và orders riêng lẻ không tự bảo đảm quyền sở hữu.
- Mã có giới hạn lượt phải kiểm tra nguyên tử khi đặt; snapshot không đổi theo cấu hình chương trình sau này.
- Đánh giá sửa phải quay về chờ duyệt; trước duyệt không xuất hiện công khai. moderator là ADMIN, thời điểm duyệt là dữ liệu cần lưu.
- Tin nội bộ không được lộ qua HTML/JSON hoặc lịch sử trạng thái gửi cho khách.
- Luồng hỗ trợ đã chốt có ba trạng thái chính; RESOLVED/mở lại/phân công chi tiết vẫn là đề xuất.
- Sửa từ điển trọng lượng SKU thành optional cho phí cố định; tránh giữ điều kiện vận chuyển nâng cao trong bản đồ án.

## Phần chưa chốt và cần đối chiếu

Loại/trần mã, cách trả lượt, chính sách sửa chương trình đã dùng, mở lại ticket, retention audit và giới hạn nhập liệu vẫn cần ghi là thiết kế đề xuất. Chưa kiểm tra migration thực tế có moderated_at hoặc mọi tên cột mục tiêu; không coi việc chỉnh ERD là thêm cột CSDL.

Bước tiếp theo: rà soát toàn bộ quan hệ/cardinality và tham chiếu của bộ ERD, rồi cập nhật sơ đồ use case/luồng theo cùng phạm vi. Chưa render hoặc chạy lại test.
