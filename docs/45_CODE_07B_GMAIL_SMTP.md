# CODE-07B — Chuẩn bị Gmail SMTP

Ngày thực hiện: 18/10/2026. Người dùng chọn Gmail. Căn cứ QD-08 và kế hoạch CODE-07; chưa gửi email hoặc đọc .env trong bước này.

## Thay đổi mã và kiểm tra

Đồng bộ kiểm tra SMTP_USER/SMTP_PASS vào `src/mail.js`: nếu chỉ có một biến thì báo cấu hình thiếu cặp trước khi tạo transport; relay không cần đăng nhập vẫn bỏ cả hai được. Lệnh preflight dùng cùng kiểm tra này, tránh tình trạng preflight chặn nhưng ứng dụng vẫn chạy với cấu hình sai.

Bổ sung kiểm tra adapter: tạo mail bằng transport giả, đúng người nhận/người gửi, token được URL-encode, link dùng origin APP_URL, có thời hạn 30 phút/dùng một lần; lỗi gửi trả promise thất bại. Không gọi SMTP trong test.

Bộ liên quan: **12 ca đạt, 0 lỗi**. Sau thay đổi mã chạy `npm.cmd test`: **136 ca, 126 đạt, 0 lỗi, 10 bỏ qua PostgreSQL**. Đây là mốc toàn bộ mới nhất, thay cho số liệu lịch sử ở các tài liệu trước.

## Bước người dùng thực hiện trên máy

1. Bật xác minh hai bước cho tài khoản Google gửi thử. Theo [Google — mật khẩu ứng dụng](https://support.google.com/accounts/answer/185833?hl=vi), mật khẩu ứng dụng yêu cầu xác minh hai bước; một số tài khoản/chính sách không có tùy chọn này. Nếu không thấy, cần xác định điều kiện tài khoản, không nhập mật khẩu đăng nhập Google để thay thế.
2. Mở [Mật khẩu ứng dụng](https://myaccount.google.com/apppasswords), tạo cho dự án nếu tài khoản cho phép. Chỉ điền giá trị đó tại máy, không gửi vào hội thoại.
3. Mở .env hiện có bằng trình soạn thảo của bạn. Nếu chưa có, sao chép mẫu một lần; không ghi đè tệp hiện có. Điền các biến dưới đây bằng thông tin của bạn:

```dotenv
APP_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-address@gmail.com
```

Đây là mẫu để tự thay, chưa được ghi vào .env. Giữ SMTP_FROM cùng địa chỉ gửi thử. [Google — thông số SMTP Gmail](https://support.google.com/mail/answer/7104828?hl=en-uk) nêu smtp.gmail.com, xác thực bằng địa chỉ đầy đủ và cổng 587 cho TLS/STARTTLS. Mã hiện tại bật requireTLS trên cổng này. APP_URL phải khớp URL bạn thực sự dùng để mở web; localhost chỉ mở được trên chính máy đó.

4. Tự chạy kiểm tra cấu hình, không gửi thư:

```powershell
node --env-file=.env scripts/check-integrations.js
```

SMTP: CONFIGURED chỉ xác nhận cấu hình hợp lệ cục bộ. VNPay còn MISSING thì lệnh vẫn exit 1; điều này không có nghĩa cấu hình Gmail sai. Không cần điền VNPay chỉ để hoàn thành bước SMTP.

## Chưa hoàn thành

Chưa kiểm tra đăng nhập Gmail/TLS thật, email vào hộp thư, hoặc reset từ thư thực nhận. Cần chọn địa chỉ nhận thử do người dùng kiểm soát và chỉ dẫn gửi cụ thể trước khi thử gửi. Chưa tạo/sửa .env, gửi thư, khởi động ứng dụng với CSDL đang dùng hoặc triển khai web.

Tiếp theo: sau khi người dùng tự điền xong, kiểm tra kết quả SMTP không chứa bí mật; rồi mới thực hiện một lượt email khôi phục cho tài khoản CUSTOMER thử nghiệm. Không chuyển sang VNPay/triển khai chỉ vì test cục bộ đạt.
