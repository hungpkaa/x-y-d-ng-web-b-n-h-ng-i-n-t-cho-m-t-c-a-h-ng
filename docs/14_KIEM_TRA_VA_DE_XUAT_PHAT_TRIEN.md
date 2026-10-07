# Kiểm tra lại và đề xuất phát triển — 07/10/2026

## Kết quả thực thi

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 82 đạt, 0 lỗi; 7 ca PostgreSQL bỏ qua vì chạy riêng |
| `npm run test:postgres` | 7 đạt, 0 lỗi; schema tạm được tạo/xóa độc lập |
| `npm run test:smoke` | Đạt trên SQLite |
| `npm run test:smoke:postgres` | Đạt trên PostgreSQL |
| `npm run db:check` | Kết nối electro_store thành công |
| `node --check` | 41 tệp JavaScript trong src/public/scripts hợp lệ |
| `git diff --check` | Không lỗi whitespace; Git thông báo chuẩn hóa LF/CRLF trên Windows |

Hai bộ test có tổng 89 ca đạt khi chạy riêng. Đây là bằng chứng trong phạm vi các ca đã viết, không bảo đảm toàn bộ mọi tổ hợp thao tác hoặc tất cả AT trong docs đều được kiểm tra.

## Đối chiếu chức năng

| Nhóm | Đã kiểm tra | Giới hạn |
|---|---|---|
| Tài khoản | Đăng ký, đăng nhập/đăng xuất, quyền, khóa/mở, hồ sơ/mật khẩu, vô hiệu phiên | Reset email dùng SMTP giả trong bài HTTP; chưa nghiệm thu gửi thật |
| Session/giỏ | Lưu bền qua restart, expiry, CSRF, cart/checkout key | Giới hạn thử đăng nhập trong RAM; giỏ giữa nhiều thiết bị chưa đồng bộ |
| Catalog | Tìm/lọc/sắp xếp/phân trang, chỉ public dữ liệu hợp lệ | Chưa kiểm tra trình bày mobile/browser trực tiếp |
| Quản lý sản phẩm | STAFF tạo draft/SKU; ADMIN đặt giá/công bố; sửa thông tin, tồn, typed attributes | Chưa có trọng lượng SKU theo BR-15 |
| Ảnh | Có ô chọn ảnh ngay form thêm; JSON create → upload, WebP, MIME/size/permission | Smoke kiểm tra HTML có field + API create/upload; chưa tự động điều khiển FileReader/chọn tệp trong browser |
| So sánh/gợi ý | Tối đa 3 cùng danh mục, dữ liệu kiểu, điểm và số lượng đã giao | Gợi ý theo quy tắc, chưa cá nhân hóa |
| Địa chỉ | Chủ sở hữu/default/version, snapshot đơn không đổi | Chưa có chọn địa bàn bằng mã để tính ship |
| Checkout | Server tính lại, chống payload giả/đơn trùng, rollback, giữ tồn/mã | Phí cố định; thiếu địa bàn/trọng lượng và shipping_rates |
| Đơn | Quyền đọc/hủy, version, điều kiện ONLINE PAID, xác nhận/chuẩn bị | Giao hàng phải qua shipment khi schema mới được dùng |
| Thanh toán | Chữ ký/ref/amount, IPN trùng, callback muộn, timeout hết hạn, ledger | Không có merchant thật được nghiệm thu, querydr hay worker đối soát bền |
| COD | Chỉ ADMIN, đủ total, chứng từ unique, không PAID ngay khi DELIVERED | Đối soát ngoài hệ thống vẫn do ADMIN xác nhận bằng chứng |
| Vận chuyển | Tracking/bằng chứng, bàn giao/FAILED/giao lại/RETURNED, exactly once, quyền | Chế độ MANUAL; chưa API hãng hoặc callback hãng |
| Đánh giá | Đã mua/đã giao, quyền, duyệt/ẩn/sửa và tính điểm | Chưa có ảnh/video đánh giá |
| Khuyến mãi | Thời hạn/phạm vi/giới hạn/lượt giữ, tranh lượt cuối, giải phóng | Chưa có chương trình điểm thành viên |
| Hỗ trợ | Tin public/internal, chủ ticket, xử lý/mở lại và phân trang | Chưa có đính kèm, thông báo email ticket hoặc realtime |
| Hoàn tiền | Capture toàn phần có chứng từ, unique/replay, đơn trả về/chờ hoàn | Thủ công; chưa hoàn từng phần hoặc API hoàn tự động |
| Báo cáo/audit | Thời gian Việt Nam, revenue/cash/refunds, CSV, lọc/che JSON | Chưa dashboard biểu đồ, lịch gửi báo cáo hoặc retention audit |
| PostgreSQL | Migration/import/sequence/blob/rollback/concurrency | Cầu nối đồng bộ, một connection/process và khóa writer chung; chưa benchmark tải lớn |

## Kiểm tra dữ liệu hiện có

Các truy vấn chạy trong một transaction `REPEATABLE READ READ ONLY` trên PostgreSQL thật, không sửa dữ liệu người dùng. Tất cả đều trả số vi phạm bằng 0:

- `on_hand >= reserved >= 0`.
- `reserved` khớp tổng các reservation HELD của SKU.
- Tổng đơn khớp `subtotal - discount + shipping_fee` và lớn hơn 0.
- Khoản hoàn toàn phần khớp số tiền capture.
- Shipment RETURNED gắn order DELIVERY_FAILED.
- Đơn CANCELLED không còn reservation HELD.

Database đã có PostgreSQL migrations 1 và 2. Các phép kiểm tra trên không thay thế đối soát với ngân hàng hoặc hãng vận chuyển.

## Hoàn thiện nền tảng trước

1. **Biểu phí địa bàn/trọng lượng**: hoàn thành BR-15 và UC-17/18; không nhận giao ở vùng chưa có giá cấu hình.
2. **Jobs bền và đối soát**: email/payment/shipment có trạng thái, lease, retry, lịch sử và request key ổn định. VNPay có API querydr để truy vấn kết quả giao dịch, cần tích hợp/kiểm thử với merchant sandbox theo [tài liệu chính thức](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).
3. **PostgreSQL async/pool**: thay cầu nối chặn luồng, khóa từng order/SKU; mỗi transaction phải dùng cùng connection theo [node-postgres](https://node-postgres.com/features/transactions). Cần benchmark trước/sau, không dự đoán công suất khi chưa đo.
4. **Kiểm tra trình duyệt**: desktop/mobile, bàn phím, trường lỗi, FileReader/upload và back/refresh/retry; đưa vào kiểm tra hồi quy.
5. **Vận hành**: backup theo lịch + diễn tập restore, log có request ID, giới hạn đăng nhập bền, cảnh báo lỗi; nghiệm thu HTTPS/SMTP/callback thật trước triển khai.

## Ý tưởng mở rộng ngoài thiết kế hiện tại

Đây là đề xuất dựa trên dự án. Bốn hướng sidebar/dashboard, ảnh, yêu thích/đã xem và thông báo đã được triển khai sau báo cáo này; xem [phạm vi và hướng dẫn mới](15_DASHBOARD_ANH_YEU_THICH_THONG_BAO.md). Thông báo hiện trong website; email jobs chưa triển khai. Các mục khác vẫn là đề xuất:

| Ưu tiên | Ý tưởng | Giá trị / phạm vi |
|---|---|---|
| Cao | Quản trị có sidebar, dashboard và lối vào rõ cho sản phẩm/ảnh/đơn/vận chuyển | Giảm khó tìm chức năng như vấn đề tải ảnh vừa gặp |
| Cao | Preview ảnh, kéo thả, sắp xếp ảnh đại diện, giữ thông tin khi lỗi form | Dễ nhập và kiểm tra sản phẩm trước công bố |
| Cao | Danh sách yêu thích, sản phẩm đã xem | Giúp khách quay lại chọn thiết bị; nhỏ hơn dự án ML |
| Cao | Thông báo có hàng/giảm giá theo opt-in | Theo dõi SKU hết hàng; cần email job và chống gửi trùng |
| Trung bình | Tra cứu bảo hành theo serial/IMEI và đơn mua | Phù hợp cửa hàng điện tử; cần mô hình serial, chính sách và quyền riêng |
| Trung bình | Nhập sản phẩm/SKU bằng Excel/CSV có preview | Tiết kiệm nhập liệu; validate, xử lý lỗi từng dòng, audit; nhập giá chỉ ADMIN |
| Trung bình | Chọn cấu hình/tư vấn thiết bị theo nhu cầu và ngân sách | Dùng thông số hiện có, giải thích tiêu chí gợi ý |
| Trung bình | Email xác nhận đơn, tiến trình giao, phản hồi hỗ trợ | Khách theo dõi thuận tiện; triển khai sau jobs bền |
| Sau | Tích điểm/hạng thành viên, combo phụ kiện | Cần chốt quy tắc cộng/trừ khi hủy/hoàn, tránh trùng khuyến mãi |
| Sau | Đổi trả/RMA, bảo hành và hoàn từng phần | Mở rộng ngoài phạm vi hiện tại; phải giữ ledger/kho/serial nhất quán |

Đề xuất thực hiện: biểu phí và jobs/đối soát trước; tiếp theo làm giao diện quản trị + ảnh, rồi wishlist/thông báo có hàng. API hãng triển khai khi có nhà cung cấp và credential được chọn.
