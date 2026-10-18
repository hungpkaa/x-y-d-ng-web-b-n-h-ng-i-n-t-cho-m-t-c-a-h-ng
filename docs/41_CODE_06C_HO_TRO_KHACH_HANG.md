# CODE-06C — Hỗ trợ khách hàng

Ngày kiểm tra: 18/10/2026. Căn cứ QD-25, UC-30/31 và AT-56..58. Phạm vi đã chốt: yêu cầu theo đơn chính chủ, nội dung công khai/nội bộ, STAFF/ADMIN xử lý, luồng mới → đang xử lý → đóng.

## Kết luận

Chưa phát hiện sai lệch cần sửa mã nghiệp vụ trong các tình huống đã kiểm tra trên SQLite. Mở rộng ca HTTP hiện có trong `test/customer-payment-http.test.js`, giữ các kiểm tra dịch vụ tại `test/customer-services.test.js`.

| Yêu cầu | Bằng chứng |
|---|---|
| Tạo theo đơn chính chủ | HTTP chặn khách dùng order_id của người khác với 404 |
| Không truy cập ticket người khác | Chặn xem, gửi tin và đổi trạng thái; danh sách khách khác không chứa ticket |
| Khách không ghi nội bộ | Gửi internal=1 bị 403, nội dung không được lưu |
| STAFF/ADMIN xử lý | STAFF nhận IN_PROGRESS, ADMIN đóng CLOSED qua HTTP; khách tự đóng không thay trạng thái |
| Không lộ nội bộ | Tin nội bộ và lý do nhận xử lý/đóng chỉ thấy phía quản lý; HTML phía khách không chứa các chuỗi đánh dấu đó |
| Version cũ | Đóng bằng version trước khi nhận xử lý bị chặn; trạng thái vẫn IN_PROGRESS, không thêm lý do giả vào lịch sử |
| Nội dung được escape | Tin công khai chứa thẻ script xuất hiện dưới dạng văn bản đã escape |
| Ticket đã đóng | Khách và STAFF không gửi thêm tin; version và hội thoại không đổi |
| Phân trang và rollback | Bộ dịch vụ hiện có kiểm tra hơn 100 tin, đếm/phân trang chỉ nội dung khách được thấy; lỗi audit rollback tin/version |

Luồng HTTP tạo đơn bằng checkout hiện tại, tạo ticket từ đơn đó và thao tác bằng các tài khoản CUSTOMER/STAFF/ADMIN riêng. HTML được kiểm tra tự động; chưa kiểm tra bố cục bằng trình duyệt.

## Phần thiết kế chưa chốt riêng

UC-30/31 còn mô tả mở lại trong 7 ngày và trạng thái RESOLVED. Mã hiện có hỗ trợ những hành vi này; ca dịch vụ hiện có vẫn kiểm tra chúng để tránh hồi quy. Báo cáo này không tự chốt thêm phạm vi đó và không gỡ hành vi đang có. Kết luận về luồng đã chốt dựa trên OPEN → IN_PROGRESS → CLOSED.

## Kết quả và giới hạn

`node --test test/customer-services.test.js test/customer-payment-http.test.js`: **8 ca đạt, 0 lỗi, 0 bỏ qua**. Tổng này gồm một ca HTTP mở rộng và bảy ca dịch vụ; một số ca dịch vụ kiểm tra reset mật khẩu/địa chỉ cùng module, không phải tám ca hỗ trợ độc lập.

Chỉ thay đổi test và tài liệu; không chạy lại toàn bộ test ở bước này. Chưa nghiệm thu PostgreSQL hoặc thao tác trình duyệt/mobile. SMTP trong HTTP là giả lập, VNPay là callback ký cục bộ; không gửi thư hay thanh toán thật. Không thay cấu hình/CSDL đang sử dụng hoặc triển khai web.

## Tiếp theo

CODE-06D: kiểm tra gợi ý sản phẩm theo QD-14 — chỉ sản phẩm công khai có SKU còn hàng, loại sản phẩm đang xem, có lý do phù hợp và không cần ML. Sau đó kiểm tra báo cáo theo QD-24 trước khi chuyển sang tích hợp bên ngoài ở CODE-07.
