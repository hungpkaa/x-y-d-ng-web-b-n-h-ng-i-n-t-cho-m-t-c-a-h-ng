# CODE-02 — Giới hạn đăng nhập

## Nguyên nhân đã xác nhận

Thêm status/body vào assertion tại accounts-http.test.js xác nhận lần đăng nhập bằng mật khẩu mới trả HTTP 429. Mã cũ tính cả đăng nhập thành công vào giới hạn 10 request/15 phút theo IP. Vì test dùng nhiều tài khoản/phiên chung localhost nên chạm giới hạn; không phải đổi mật khẩu không lưu.

## Thay đổi

- Tách bộ đếm thất bại và tổng request đăng nhập trong CSDL, giữ thời hạn 15 phút.
- Sau 10 lần sai theo IP, các yêu cầu tiếp theo bị chặn trước kiểm tra mật khẩu. Thành công không thêm vào bộ đếm sai; thành công cũng không xóa bộ đếm sai để tránh dùng một tài khoản hợp lệ vượt bảo vệ.
- Tổng request vẫn giới hạn 60/15 phút theo IP, gồm thành công, để bảo vệ tài nguyên xác thực. Đây là lựa chọn vận hành triển khai, có thể điều chỉnh sau khi kiểm tra lưu lượng.
- Phản hồi 429 có Retry-After 900 giây và thông báo tiếng Việt đã sửa. Header dùng thời gian chờ bảo thủ, không phải số giây còn lại chính xác.
- Thêm isRateLimited để kiểm tra bộ đếm còn hạn mà không tăng lượt; không thay cách giới hạn reset/hỗ trợ hiện hữu.

## Kiểm tra

- Tái hiện trước sửa: accounts-http lỗi, status 429.
- Sau sửa, nhóm HTTP tài khoản/login và customer-services: 9/9 đạt.
- Bộ đầy đủ: 102 ca, 94 đạt, 0 lỗi, 8 PostgreSQL bỏ qua. Không chạy bộ PostgreSQL riêng, không coi đã nghiệm thu production.
- Smoke HTTP COD/giao hàng đạt.
- Test login mới xác nhận 12 lần thành công vẫn được đăng nhập, 10 lần sai được ghi nhận và yêu cầu kế tiếp bị 429 kể cả dùng mật khẩu đúng. Unit test kiểm tra hết hạn và kiểm tra giới hạn không tăng lượt.

Giới hạn theo IP có thể ảnh hưởng người dùng chung mạng; cần kiểm tra proxy đúng cấu hình khi triển khai. Không tắt bảo vệ bằng mode test hoặc tăng ngưỡng chỉ để assertion xanh.

## Bước tiếp theo

CODE-03A: giỏ theo tài khoản, tách khỏi phiên. Thực hiện riêng migration và dịch vụ giỏ, sau đó ghép route; gộp giỏ một lần là CODE-03B tiếp theo. Chưa thực hiện giỏ hoặc thay CSDL sử dụng thật trong CODE-02.
