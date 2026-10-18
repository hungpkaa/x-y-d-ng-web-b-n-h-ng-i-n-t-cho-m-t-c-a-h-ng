# ERD thanh toán, hoàn tiền và vận chuyển thủ công

Thiết kế mục tiêu theo các quyết định đã thống nhất; chưa sửa mã hoặc migration.

| Bảng | Vai trò |
|---|---|
| payments | Attempt online hoặc khoản COD ADMIN đã xác nhận, gắn với đơn |
| payment_events | Kết quả cổng được xác thực, dấu chống xử lý callback lặp |
| payment_exceptions | Khoản cần xử lý khi thành công đến muộn, đã hủy hoặc thu dư |
| refunds | Bằng chứng ghi nhận hoàn của một khoản đã thu; không tự gọi API hoàn |
| shipments | Một kiện/mã vận đơn mỗi đơn, hãng và trạng thái; bản đồ án MANUAL |
| shipment_events | Ai cập nhật, thời điểm, lý do và thông tin xác nhận trạng thái |

Nguồn sơ đồ và ràng buộc mục 3/3.1 tại [ERD chung](07_ERD_VA_TU_DIEN_DU_LIEU.md). Đã bổ sung actor/ghi chú cho thanh toán và lý do cho sự kiện vận chuyển. Các trường actor_id cần có quan hệ tới users khi hoàn thiện toàn bộ sơ đồ; đây là thiết kế, không phải cột đã thêm vào CSDL.

## Ba trạng thái độc lập

- Đơn DELIVERED/COD có thể vẫn UNPAID đến khi ADMIN đối soát đủ tiền.
- Đơn CANCELLED có thể đang cần hoàn, chưa phải đã hoàn.
- Shipment FAILED chưa có nghĩa hàng đã về kho; RETURNED cần xác nhận nhận về.

## Điểm cần chốt sau

- Quyền ghi nhận hoàn, hoàn toàn phần hay từng phần và cách phân bổ tiền hàng/phí.
- Chứng từ demo, kiểu bằng chứng và quy tắc thời điểm đối soát.
- Giới hạn và vòng đời attempt online, policy retention sự kiện/nhật ký.

Các điểm này không làm thay đổi quyết định đã chốt về hạn online, COD, một kiện và vận chuyển thủ công. API hãng, querydr và jobs được đánh dấu nền tảng/mở rộng; có mã/bảng không có nghĩa đã nghiệm thu tích hợp.

Bước tiếp theo: ERD khuyến mãi, đánh giá, hỗ trợ và nhật ký. Chưa render sơ đồ, nghiệm thu SMTP/VNPay hoặc chạy lại test.
