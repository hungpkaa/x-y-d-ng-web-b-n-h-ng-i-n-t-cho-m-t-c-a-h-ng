# Bổ sung chuyển khoản bằng QR ngân hàng

Ngày: 18/10/2026. Trạng thái hiện tại: đã nối BANK_TRANSFER vào checkout, chỉ dẫn nhận tiền trên đơn, timer hết hạn và route/form ADMIN đối soát. Tài khoản nhận và hạn 30 phút đã chốt; ảnh QR gốc chưa được lưu/đối chiếu nên chưa có mã để quét trên web.

Ảnh QR cửa hàng dự kiến lưu tại `public/images/payments/bidv-4801021854.png`; chứng từ khách không lưu vào thư mục public. Chưa có tệp ảnh thì trang đơn hiển thị thông tin ngân hàng dạng chữ và thông báo QR chưa có, không dùng QR giả. Khi nhận được tệp cần đối chiếu payload/người nhận trước khi dùng. Snapshot tài khoản được lưu trong báo giá và trên đơn; khi đổi QR/tài khoản phải quản lý phiên bản asset để không thay chỉ dẫn đơn cũ.

Kiểm tra lần nối giao diện: toàn bộ 144 ca, 133 đạt, 0 lỗi, 11 bỏ qua; PostgreSQL ngân hàng chạy riêng đạt, dùng checkout BANK_TRANSFER thật thay cho tạo đơn bằng fixture trực tiếp. HTTP kiểm tra chọn phương thức, tạo đơn, riêng tư, trang chỉ dẫn, chặn STAFF đối soát, ADMIN xác nhận và checkout replay. Chưa giao dịch ngân hàng thật, chưa kiểm tra bố cục trực quan. Các ghi chú bước 1/2 bên dưới là lịch sử triển khai.

## Phạm vi đã đồng ý

Người dùng chọn bổ sung QR tài khoản ngân hàng nhận tiền của mình, gửi ảnh QR trong hội thoại. Phương thức này độc lập với COD và VNPay sandbox. QR là chỉ dẫn chuyển khoản; không phải bằng chứng cửa hàng đã nhận tiền.

Người dùng cung cấp: **BIDV — số tài khoản 4801021854 — chủ tài khoản VUTIENHUNG**. Giữ nguyên tên do người dùng cung cấp, không tự đổi dấu hoặc khoảng trắng. Đây là thông tin được người dùng xác nhận, chưa phải xác minh từ ngân hàng. Chưa giải mã payload hoặc lưu ảnh QR vào dự án; phải đối chiếu QR với thông tin này trước khi dùng cho khách thanh toán.

Thời hạn đã chọn: **30 phút từ lúc tạo đơn**, bao gồm thời gian chờ ADMIN xác nhận tiền. Không tính từ lúc quét QR, không gia hạn khi tải lại trang, báo đã chuyển hoặc gửi lại yêu cầu tạo đơn.

## Luồng mục tiêu

1. CUSTOMER chọn Chuyển khoản ngân hàng ở checkout; xem tiền hàng, giảm giá, phí giao và tổng tiền trước xác nhận.
2. Tạo đơn và giữ kho trong một giao dịch; lưu phương thức, số tiền cần thu, nội dung chuyển khoản duy nhất theo mã đơn và hạn chờ xác nhận = thời điểm tạo đơn + 1.800.000 ms.
3. Trang đơn hiển thị QR đã xác minh cùng tên ngân hàng, số tài khoản, chủ tài khoản, số tiền và nội dung chuyển khoản dạng chữ.
4. Khách chuyển khoản. Nút Tôi đã chuyển khoản, nếu bổ sung, chỉ gửi yêu cầu đối soát; đơn chưa thành PAID và không gia hạn giữ hàng.
5. ADMIN kiểm tra giao dịch thực nhận: đúng người nhận, số tiền, nội dung và mã giao dịch ngân hàng; xác nhận thu tiền kèm chứng từ/ghi chú, lưu ledger và audit cùng giao dịch. STAFF không xác nhận khoản thu.
6. Đơn đã xác nhận thu mới được xử lý tiếp như đơn trả trước; không để route COD hay IPN VNPay xác nhận thay khoản chuyển khoản.

## Quy tắc cần triển khai

- Chống xác nhận lặp và dùng lại cùng mã giao dịch ngân hàng cho hai đơn; kiểm tra version và quyền từ CSDL.
- Thay QR hoặc cấu hình tài khoản chỉ áp dụng đơn mới; đơn cũ giữ snapshot chỉ dẫn nhận tiền và tổng tiền.
- Hết hạn chưa được xác nhận thu: hủy/giải phóng giữ một lần. Cần thông báo rõ tiền có thể đã đến ngân hàng nhưng cửa hàng chưa kịp đối soát.
- ADMIN đối soát thấy tiền sau khi đơn đã hủy: lưu khoản thu và nghĩa vụ hoàn, không tự mở đơn hoặc giữ kho lại. Hoàn tiền có chứng từ riêng.
- Chuyển thiếu/thừa, nội dung sai hoặc không xác định được đơn: không tự coi đã thanh toán đủ. Chi tiết lưu ngoại lệ và cách xử lý sẽ được chốt trong bước thiết kế tiếp theo.
- Báo cáo tách khoản chuyển khoản ngân hàng khỏi COD/VNPay; doanh thu vẫn chỉ DELIVERED + PAID, bằng subtotal - discount, loại phí giao. Không thêm provider mới mà bỏ sót tổng tiền thu/hoàn trong báo cáo.
- Dùng QR tĩnh thì không hứa QR tự điền số tiền/nội dung theo từng đơn: phải giải mã/xác minh khả năng ảnh hiện có. Tạo QR theo đơn là bước riêng nếu cần, không chỉnh ảnh QR bằng công cụ vẽ.

## Các thông tin đang chờ

| Thông tin | Trạng thái |
|---|---|
| Ảnh QR | Đã nhận trong hội thoại, chưa xác minh payload |
| Ngân hàng, số tài khoản, chủ tài khoản | Người dùng cung cấp BIDV / 4801021854 / VUTIENHUNG; chờ đối chiếu với payload QR |
| Thời hạn giữ hàng/chờ ADMIN xác nhận tiền | Đã chọn 30 phút từ tạo đơn, độc lập hạn VNPay 15 phút |
| QR tĩnh hay QR có số tiền/nội dung theo đơn | Chưa chốt sau xác minh QR |

Không yêu cầu mật khẩu, OTP, quyền truy cập tài khoản ngân hàng hoặc giao dịch thử có tiền thật trong bước tài liệu.

## Triển khai từng bước sau khi đủ thông tin

1. Chốt quy tắc còn thiếu và cập nhật use case, luồng thanh toán, dữ liệu/ledger, phân quyền và tiêu chí nghiệm thu liên quan.
2. Migration/dịch vụ cho phương thức BANK_TRANSFER, hạn, snapshot nhận tiền và đối soát ADMIN. Chưa thêm giá trị enum trực tiếp vào schema cũ nếu không có migration.
3. Giao diện checkout/trang đơn và màn hình ADMIN chờ đối soát; hiển thị rõ trạng thái chờ và chỉ dẫn chuyển khoản.
4. Kiểm tra SQLite/PostgreSQL: thu hợp lệ, sai/thiếu/thừa, trùng chứng từ, version cũ, rollback, hết hạn, tiền đến muộn, giữ/xuất kho và báo cáo.

Các bước trên là kế hoạch, chưa phải kết quả đã hoàn thành. Gmail tiếp tục tạm hoãn theo yêu cầu người dùng.

## Tiêu chí nghiệm thu bắt buộc

Cập nhật bước 2B: migration SQLite v15/PostgreSQL v8 thêm provider BANK_TRANSFER vào ledger, giữ ID/liên kết khoản thu/hoàn/sự kiện cũ. Migration SQLite kiểm tra khóa ngoại trước commit và khôi phục enforcement cả khi rollback; migration PostgreSQL v7/v8 nằm cùng giao dịch nâng cấp. Dịch vụ `confirmBankTransfer` chỉ ADMIN, đúng số tiền/chứng từ/thời điểm/version, chống trùng mã giao dịch; xác nhận sau hạn tự hủy/giải phóng giữ và ghi REFUND_PENDING. Khoản thu ngân hàng dùng luồng hoàn có sẵn, được cộng vào bankCash/totalCash/netCash và xuất CSV/bảng báo cáo riêng. Chưa có route/form đối soát, chưa bật checkout hoặc QR. Bộ đầy đủ: 144 ca, 133 đạt, 0 lỗi, 11 bỏ qua; ca PostgreSQL ngân hàng chạy riêng đạt, gồm khoản đến muộn, ledger, refundDue và bankCash. Chưa nghiệm thu thao tác thực tế hoặc giao dịch ngân hàng thật.

Cập nhật bước 2A: `src/bank-transfer.js` có work nội bộ lưu snapshot khi tạo đơn trong giao dịch và dịch vụ hết hạn 30 phút. Retry giữ nguyên snapshot/deadline; hết hạn giải phóng giữ một lần; lỗi audit rollback. Chưa nối vào checkout, timer hoặc route nào, nên chưa tạo đơn chuyển khoản từ giao diện. Phần ADMIN xác nhận thu cần nâng cấp ledger/provider hiện chỉ COD/VNPAY và nối báo cáo/hoàn tiền ở bước 2B; chưa triển khai trong bước 2A. Bộ SQLite liên quan 14 ca đạt; ca PostgreSQL riêng kiểm tra snapshot/deadline/giải phóng giữ cũng đạt. QR vẫn chưa được đối chiếu và chưa hiển thị.

Cập nhật triển khai bước 1: thêm migration SQLite v14/PostgreSQL v7 với `bank_transfer_orders` (snapshot ngân hàng/tài khoản/chủ/số tiền/nội dung/hạn/QR payload) và `bank_transfer_receipts` (liên kết khoản thu, ADMIN, mã giao dịch unique và ghi chú). Chưa ghi thông tin tài khoản vào CSDL đang dùng, chưa mở rộng provider/method ở checkout và chưa bật thanh toán. Hai ca SQLite kiểm tra nâng cấp/giữ dữ liệu và rollback đạt; một ca PostgreSQL dùng schema test riêng đã chạy migration và luồng cũ đạt. Độ đúng nghiệp vụ đối soát và QR sẽ kiểm tra khi triển khai dịch vụ, không coi bảng dữ liệu là tính năng đã hoàn tất.

- Chọn phương thức chuyển khoản chỉ khi thông tin nhận tiền/QR được cấu hình hợp lệ; không ảnh hưởng khả năng dùng COD.
- Đơn mới lưu snapshot BIDV, tài khoản, tên chủ, tiền phải thu, nội dung chuyển khoản và deadline 30 phút. Không gửi thông tin tài khoản khách cho bên tạo QR ngoài nếu chưa có yêu cầu tích hợp tương ứng.
- Khách khác không xem được QR/chỉ dẫn theo đơn của người mua; giá và tổng tiền lấy từ server.
- ADMIN nhận đúng tiền trước hạn mới ghi PAID; STAFF/CUSTOMER và ảnh chụp chuyển khoản không thay được bước đối soát.
- Đúng deadline mà chưa được xác nhận: hủy đơn và giải phóng giữ; xác nhận thu sau deadline phải qua nhánh tiền đến muộn, kể cả tác vụ quét chưa chạy. Không mở lại đơn đã hủy.
- Gửi lại xác nhận/chứng từ không thêm khoản thu hoặc trừ/hoàn kho lần hai; lỗi lưu rollback toàn bộ.
- Báo cáo tách tiền chuyển khoản ngân hàng, tính cả thu/hoàn vào dòng tiền tổng, chỉ ghi doanh thu khi đủ điều kiện QD-24.
