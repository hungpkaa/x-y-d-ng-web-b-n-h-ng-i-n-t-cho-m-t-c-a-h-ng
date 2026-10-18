# CODE-07A — Chuẩn bị nghiệm thu SMTP và VNPay sandbox

Ngày thực hiện: 18/10/2026. Căn cứ QD-08/16 và kế hoạch CODE-07. Bước này chuẩn bị công cụ và quy trình, chưa kết nối nhà cung cấp.

## Đã có và còn thiếu bằng chứng

| Phần | Đã xác minh cục bộ | Chưa nghiệm thu bên ngoài |
|---|---|---|
| SMTP | Cấu hình transport trong src/mail.js; HTTP giả lập nhận token, reset một lần, vô hiệu phiên | Đăng nhập SMTP/TLS, gửi đến hộp thư thử, liên kết mở được và email thực nhận |
| VNPay | URL sandbox, IPN ký bằng khóa test, số tiền, replay, hạn 15 phút, thu muộn/hoàn | Merchant sandbox đã đăng ký, URL public nhận IPN, kết quả giao dịch từ VNPay thật |
| Cấu hình hiện dùng | Không kiểm tra trong lượt này | Không kết luận .env của người dùng có/thiếu biến vì chưa đọc |

Mã gửi email hiện gửi sau commit, chưa có retry bền vững cho email. Lỗi gửi chỉ ghi thông báo chung; người dùng cần yêu cầu lại sau khi sửa kết nối. Không coi sự tồn tại module jobs là bằng chứng email đã được ghép hàng đợi.

## Công cụ mới

`scripts/check-integrations.js` chỉ kiểm tra cấu hình, không mở CSDL, gửi thư, gọi mạng hoặc khởi động web. Không xuất giá trị biến hoặc nguyên văn lỗi URL/nhà cung cấp. Các trạng thái:

- MISSING: thiếu biến bắt buộc, chỉ in tên biến.
- INVALID: cấu hình không hợp lệ theo kiểm tra hiện có, hoặc chỉ có một trong SMTP_USER/SMTP_PASS.
- CONFIGURED: qua kiểm tra cú pháp cục bộ; không chứng minh kết nối được hoặc thông tin đăng nhập đúng.

Kiểm tra mẫu, không đọc .env và không trộn biến môi trường vào mẫu:

```powershell
npm.cmd run integrations:check:sample
```

Đã chạy: SMTP thiếu SMTP_HOST/SMTP_FROM; VNPay thiếu VNPAY_TMN_CODE/VNPAY_HASH_SECRET. Exit code 1 là kết quả dự kiến vì mẫu để trống thông tin nhà cung cấp, không phải lỗi kiểm thử. APP_URL trong mẫu dùng localhost.

Khi người dùng đã tự điền cấu hình cục bộ và muốn kiểm tra tệp đó:

```powershell
node --env-file=.env scripts/check-integrations.js
```

Lệnh này đọc .env; **chưa chạy trong bước này**. Không gửi nội dung .env hoặc ảnh có mật khẩu/khóa vào hội thoại. Công cụ không kiểm tra DNS/TLS, định dạng hộp thư đầy đủ, quyền gửi của SMTP_FROM hoặc khả năng truy cập APP_URL từ bên ngoài.

## Thứ tự nghiệm thu tiếp theo

1. SMTP trước: chọn hộp thư thử do người dùng kiểm soát; tự điền SMTP_HOST/PORT/FROM và thông tin đăng nhập khi nhà cung cấp yêu cầu. Giữ .env hiện có, không ghi đè từ mẫu. Chạy kiểm tra cấu hình cục bộ.
2. Khi đã cho phép gửi thư đến địa chỉ thử cụ thể, dùng quên mật khẩu cho CUSTOMER thử nghiệm; xác nhận email thực nhận, liên kết đúng APP_URL, dùng một lần, liên kết cũ vô hiệu sau yêu cầu mới và phiên cũ hết hiệu lực sau reset. Chưa gửi email trong lượt này.
3. VNPay sandbox sau: chuẩn bị merchant thử và địa chỉ HTTPS public phù hợp môi trường thử; đăng ký IPN/Return theo hướng dẫn tích hợp hiện có. Localhost không đủ làm bằng chứng callback từ bên ngoài. Chưa tạo domain/tunnel hoặc triển khai web trong lượt này.
4. Trên CSDL thử riêng, kiểm tra một đơn sandbox với kết quả thực từ IPN; ghi trạng thái/số tiền/reference đã che thông tin nhạy cảm, rồi kiểm tra retry/hết hạn/thu muộn. Không tự giả PAID để ghi hoàn thành nghiệm thu.

Thông số nhà cung cấp lấy từ tài khoản/cấu hình người dùng thực sự sử dụng; chưa lựa chọn dịch vụ mới hoặc xác minh hướng dẫn nhà cung cấp hiện hành trong lượt này.

## Kiểm tra đã chạy

`node --test test/integration-config.test.js test/customer-services.test.js test/customer-payment-http.test.js`: **9 ca đạt, 0 lỗi, 0 bỏ qua**. Ca mới kiểm tra thiếu/đủ biến, auth thiếu một nửa, port/URL sai, HTTPS production và kết quả không chứa giá trị bí mật. HTTP vẫn dùng SMTP giả và callback ký cục bộ.

Không chạy toàn bộ test, không đọc .env, không mở CSDL đang dùng, không gửi thư/thanh toán hoặc triển khai. CODE-07 bên ngoài còn chờ điều kiện tài khoản và môi trường thử; PostgreSQL, UI/mobile và đóng gói vẫn chưa nghiệm thu ở CODE-08.

## Bước nhỏ tiếp theo

CODE-07B: chuẩn bị và kiểm tra cấu hình SMTP trên môi trường thử; chỉ thử gửi khi đã có địa chỉ nhận thử cụ thể và chỉ dẫn gửi của người dùng. Có thể tiếp tục việc kiểm tra cục bộ không cần bí mật trước khi kết nối ngoài.
