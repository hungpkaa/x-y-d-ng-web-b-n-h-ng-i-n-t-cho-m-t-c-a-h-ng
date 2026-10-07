# Cấu hình email khôi phục và VNPay sandbox

Mã nguồn hỗ trợ SMTP, sổ địa chỉ, hỗ trợ theo đơn, thanh toán VNPay sandbox và ghi nhận hoàn tiền thủ công. Kiểm thử dùng SMTP giả và IPN ký bằng khóa kiểm thử; chưa kết nối merchant/SMTP thật.

## 1. Tệp cấu hình

Sao chép `.env.example` thành `.env` trong thư mục gốc. `npm.cmd start` và `npm.cmd run dev` tự đọc tệp nếu tồn tại. `.env` đã được bỏ qua trong Git. Không nhập thông tin thẻ hoặc khóa thật vào mã nguồn, ảnh chụp hay bộ test.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
npm.cmd run dev
```

Chỉnh `.env` trước khi chạy. `APP_URL` là URL cố định của website, không lấy từ Host header của người truy cập. Local dùng `http://localhost:3000`; khi triển khai qua HTTPS đổi thành tên miền public. `SESSION_SECRET` cần ổn định khi `NODE_ENV=production`. Chỉ đặt `TRUST_PROXY_HOPS` theo số proxy tin cậy mà bạn kiểm soát; không đặt tùy ý. `HOST` mặc định `127.0.0.1`, có thể cấu hình theo môi trường triển khai.

## 2. Khôi phục mật khẩu qua SMTP

Cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` theo nhà cung cấp email. Port 465 dùng TLS trực tiếp; port 587 yêu cầu STARTTLS. Không tắt kiểm tra chứng chỉ. SMTP relay không cần đăng nhập có thể bỏ USER/PASS, nhưng vẫn cần TLS.

Quy trình: vào Đăng nhập → Quên mật khẩu → nhập email → mở liên kết từ email → nhập/xác nhận mật khẩu mới → đăng nhập lại. Token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256, hết hạn 30 phút và dùng một lần. Yêu cầu mới thay liên kết cũ; khóa tài khoản/đổi mật khẩu làm token cũ vô hiệu theo auth_version. Khi reset thành công, phiên trên mọi thiết bị hết hiệu lực ở request tiếp theo.

Thông báo không tiết lộ email có tài khoản hay không. Giới hạn lưu trong DB: 5 yêu cầu/IP/15 phút, 3/email/15 phút, 10 lần gửi reset/IP/15 phút. Chưa có SMTP thì chức năng hiển thị tạm thời chưa khả dụng. Email gửi sau commit, không giữ khóa DB khi chờ mạng. Lỗi gửi chỉ ghi thông báo chung; chưa có hàng đợi email/retry bền vững, người dùng cần yêu cầu lại sau khi SMTP được khắc phục.

Tham khảo [SMTP transport của Nodemailer](https://nodemailer.com/smtp).

## 3. VNPay sandbox

Đăng ký merchant sandbox tại [VNPay](https://sandbox.vnpayment.vn/devreg/) để nhận TmnCode/HashSecret. Nhập `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` vào `.env`, cấu hình `APP_URL` theo domain merchant đã đăng ký. URL thanh toán được cố định vào sandbox, không thể đổi thành live qua tệp cấu hình.

Đăng ký với VNPay URL public:

- IPN: `https://ten-mien-cua-ban/payments/vnpay/ipn`
- Return: `https://ten-mien-cua-ban/payments/vnpay/return`

IPN cần truy cập được từ VNPay; `localhost` chỉ đủ kiểm tra giao diện và tạo URL, không nhận được callback từ dịch vụ ngoài. Production qua reverse proxy phải có HTTPS và cấu hình cookie/proxy đúng. Tài khoản sandbox và dữ liệu thử nghiệm cần dùng CSDL riêng với dữ liệu bán hàng thật.

Tích hợp theo [API PAY VNPay 2.1.0](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html): sắp xếp/encode tham số, ký HMAC SHA-512, amount nhân 100, mốc CreateDate/ExpireDate GMT+7. IPN kiểm tra chữ ký, TmnCode, tham chiếu, amount, trạng thái và mã giao dịch. VNPay không luôn gửi CurrCode về IPN; nếu có thì chỉ nhận VND. Return chỉ dẫn về đơn của chủ sở hữu, không cập nhật tiền dựa trên redirect trình duyệt.

Khách chọn VNPay sandbox ở checkout → xác nhận tạo đơn → mở chi tiết đơn → Thanh toán VNPay sandbox. Đơn giữ hàng 15 phút từ lúc tạo; retry cùng attempt PENDING dùng cùng tham chiếu, failure có thể tạo attempt mới trong hạn chung của đơn. Job trong tiến trình server quét mỗi 30 giây và khi khởi động; hủy đơn chưa trả tiền quá hạn, giải phóng tồn/lượt mã một lần. Chạy lại sau downtime sẽ quét tiếp dữ liệu bền trong DB.

Callback success tới sau hủy/hết hạn vẫn ghi tiền thật đã báo từ cổng, chuyển REFUND_PENDING; không mở lại đơn hoặc giữ lại kho. Failure cũ không làm lùi khoản SUCCEEDED. Hai attempt đều được cổng báo thu thì giữ hai khoản thu, chỉ ghi doanh thu hàng một lần và yêu cầu hoàn khoản dư. Mã giao dịch nhà cung cấp là unique; xung đột tham chiếu trả lỗi để đối soát, không tự nhân đôi tiền.

Chưa có API querydr để chủ động đối soát khi IPN bị mất; cần kiểm tra giao dịch trên merchant và xử lý cấu hình/kết nối để VNPay gửi lại IPN. Các mã phản hồi IPN 00/02/01/04/97/99 được xử lý theo tài liệu. Không lưu chữ ký/secret/raw callback vào audit.

## 4. Ghi nhận hoàn tiền

ADMIN vào Quản lý → Ghi nhận hoàn tiền. Danh sách gồm khoản thu SUCCEEDED chưa hoàn của đơn CANCELLED và các khoản thu dư của đơn còn hợp lệ. Chỉ ghi nhận sau khi đã hoàn ngoài hệ thống, nhập toàn bộ số tiền của khoản thu, mã đối soát unique, mã/đường dẫn bằng chứng, thời điểm thực hoàn theo giờ Việt Nam và ghi chú.

Mỗi payment được hoàn toàn bộ tối đa một lần; gửi lại cùng chứng từ trả kết quả cũ, khác chứng từ bị chặn. Không cho hoàn vượt tiền đã thu. Không tự gửi lệnh hoàn tiền VNPay, không hỗ trợ hoàn một phần/đổi trả sau giao. Bằng chứng lưu dưới dạng mã/đường dẫn văn bản, chưa upload tệp hoặc kiểm tra tự động với ngân hàng.

Đơn hủy chỉ REFUNDED sau khi tất cả khoản cần hoàn được ghi nhận; hoàn khoản thu dư không làm mất PAID của khoản hợp lệ. Nghiệp vụ hoàn tiền không sửa snapshot đơn, không cộng kho. Khách xem tổng tiền đã hoàn trong chi tiết đơn; chứng từ đối soát chỉ ADMIN quản lý.

## 5. Địa chỉ, hỗ trợ và báo cáo

- CUSTOMER mở Hồ sơ → Sổ địa chỉ: thêm/sửa/xóa/chọn mặc định, tối đa 20. Mặc định trong sổ ưu tiên ở checkout; nếu sổ trống dùng hồ sơ. Chỉnh/xóa không sửa đơn cũ.
- Từ chi tiết đơn, khách tạo yêu cầu hỗ trợ. STAFF/ADMIN vào Quản lý → Hỗ trợ khách hàng: trả lời công khai/nội bộ, nhận xử lý, giải quyết/đóng. Khách không thấy tin hoặc ghi chú lịch sử nội bộ. Khách mở lại trong 7 ngày; mỗi thay đổi kiểm tra version. Danh sách và hội thoại phân trang 20; mặc định hội thoại mở trang cuối. Lịch sử trạng thái hiển thị 50 sự kiện gần nhất.
- Báo cáo nhận tiền từ ledger COD/VNPay, hoàn theo thời điểm chứng từ và thu trừ hoàn theo đúng kỳ. Doanh thu hàng chỉ khi DELIVERED/PAID, giữ recognition_at; khoản chờ hoàn là số dư hiện tại trên toàn bộ dữ liệu. Thu trừ hoàn không phải lợi nhuận. Dữ liệu sandbox không phải tiền kinh doanh thật.

## 6. Migration và kiểm thử

Migration v7 thêm địa chỉ/reset/rate limit/hỗ trợ; chuyển địa chỉ hồ sơ CUSTOMER hợp lệ sang địa chỉ mặc định. v8 thêm payments/events/refunds, deadline/recognition, phương thức báo giá; chuyển chứng từ COD hiện có sang ledger, giữ nguyên thời gian/amount/bằng chứng. Không tạo khoản thu giả cho đơn legacy PAID không có chứng từ. Lịch sử đơn giữ dữ liệu cũ và thêm source, cho phép actor NULL cho SYSTEM/PROVIDER. Backup trước migration file và transaction rollback giữ nguyên cơ chế cũ.

Kiểm tra bằng `npm.cmd test` và `npm.cmd run test:smoke`. 77 kiểm thử đạt tại lần cập nhật: gồm HTTP khôi phục với email giả, vô hiệu hai phiên, địa chỉ/hỗ trợ, VNPay return không ghi tiền, IPN/hoàn tiền; race hai kết nối cho IPN trùng, expiry với success, hoàn trùng; rollback ledger/audit, migration v7/v8, phân trang và kỳ báo cáo.

Chưa chạy giao dịch trên merchant sandbox thật, gửi SMTP thật hoặc kiểm tra bố cục trực quan bằng trình duyệt. Sau khi điền cấu hình, cần kiểm tra email đến hộp thư và một đơn sandbox thật có IPN, refund/callback retry trên môi trường public trước nghiệm thu tích hợp.
