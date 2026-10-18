# Rà soát toàn dự án — 13/10/2026

## 1. Kết luận

Dự án hiện đã có bộ tài liệu phân tích và thiết kế cùng một ứng dụng Node.js/Express/EJS tương đối rộng, hỗ trợ SQLite và PostgreSQL. Không còn là kho trống như báo cáo ngày 02/10/2026.

Phần nghiệp vụ chính đã có mã, màn hình và kiểm thử. Tuy nhiên, chưa đủ cơ sở gọi toàn bộ dự án đã hoàn thiện: bộ test hiện thất bại, những phần mới còn đang ghép nối, tài liệu tiến độ chưa cập nhật đồng bộ và tích hợp ngoài chưa được nghiệm thu trong lần rà soát này.

Chỉ bổ sung báo cáo này, không sửa mã hoặc triển khai chức năng. Có nhiều thay đổi chưa commit; không hoàn tác chúng và không truy cập nội dung bí mật trong `.env`.

## 2. Cách kiểm tra và giới hạn

- Kiểm kê tệp, Git status, package scripts; đọc các tài liệu phạm vi, chỉ mục, đặc tả, ERD, truy vết và báo cáo tiến độ/đối chiếu cũ.
- Đối chiếu các tuyến HTTP trong `src/server.js`, cấu trúc migration và các module thanh toán, checkout, biểu phí, jobs, ngoại lệ, email, sản phẩm.
- Chạy `npm.cmd test`; chạy lại và lưu log tạm để tổng hợp các lỗi do output lần đầu bị cắt.
- Chạy `npm.cmd run test:smoke` với dữ liệu kiểm thử riêng theo script: đạt.
- Không sửa hoặc migration CSDL vận hành, không chạy SMTP thật, VNPay merchant thật, API hãng giao hàng; không thực hiện kiểm tra trực quan trên browser/mobile.
- Không chạy lại bộ PostgreSQL chuyên biệt; 8 ca PostgreSQL trong bộ mặc định được bỏ qua. Kết quả PostgreSQL trong tài liệu cũ là lịch sử, không phải kết quả xác nhận của lần này.
- Kiểm tra HTTP/smoke không đồng nghĩa mọi màn hình, nghiệp vụ hoặc tiêu chí AT đã đạt.

## 3. Những phần đã có

### 3.1. Tài liệu

Đã có:

- Phạm vi, 5 tác nhân và ma trận quyền.
- Danh mục và đặc tả 34 use case UC-01..34.
- 6 nguồn sơ đồ PlantUML tổng quát/theo tác nhân.
- Quy tắc và sơ đồ hoạt động, trạng thái, tuần tự bằng Mermaid.
- ERD mục tiêu, từ điển dữ liệu và ma trận truy vết/nghiệm thu.
- Hướng dẫn SQLite/PostgreSQL, SMTP/VNPay, vận chuyển thủ công.
- Tài liệu dashboard, yêu thích/thông báo, chatbot và các báo cáo tiến độ.

Đã có khung phân tích rộng. Việc còn lại chủ yếu là thống nhất quyết định, cập nhật theo schema/mã hiện tại và xác minh tài liệu xuất cuối, thay vì viết lại toàn bộ.

### 3.2. Website

“Có” dưới đây nghĩa là có triển khai trong mã và tuyến/màn hình liên quan; không có nghĩa mọi trường hợp đã được nghiệm thu.

| Nhóm | Hiện trạng |
|---|---|
| Tài khoản | Đăng ký/đăng nhập/đăng xuất, hồ sơ, đổi/quên mật khẩu, khóa/mở khóa và quản lý STAFF; phiên lưu CSDL |
| Catalog | Danh mục, thương hiệu, tìm/lọc/sắp xếp/phân trang, chi tiết sản phẩm |
| Sản phẩm | Nháp/công bố/ẩn, nhiều SKU, quyền giá ADMIN, tồn khả dụng/giữ hàng, lịch sử kho, ảnh WebP và thuộc tính có kiểu |
| Giỏ/checkout | Giỏ theo phiên, báo giá, khóa chống tạo đơn trùng, lưu giá/phí/giảm tại thời điểm mua, COD và lựa chọn online khi cấu hình |
| Đơn | Chủ sở hữu, danh sách/chi tiết, hủy PENDING, xử lý trạng thái/version và lịch sử |
| Thanh toán | COD thu tiền riêng sau giao; URL/IPN VNPay sandbox; ledger, timeout và ghi nhận hoàn tiền thủ công |
| Vận chuyển | Vận đơn thủ công, bàn giao, giao thất bại/giao lại, nhận hàng về; chưa có API hãng |
| Khuyến mãi/đánh giá | Mã giảm có giới hạn/thời hạn, giữ lượt; đánh giá dòng đơn đã giao và kiểm duyệt |
| Hỗ trợ/báo cáo | Sổ địa chỉ, ticket theo đơn, ghi chú nội bộ, báo cáo/CSV và audit |
| Mở rộng | So sánh SKU, gợi ý theo quy tắc, dashboard, yêu thích, đã xem, thông báo trong website và chatbot theo quy tắc |
| Nền tảng | Migration, backup/import PostgreSQL, test nghiệp vụ/HTTP/concurrency, health live/ready |

Không nên bổ sung thêm chatbot AI, tích điểm hoặc bảo hành trước khi ổn định nền tảng và chốt phạm vi đồ án. Các phần đó không giải quyết lỗi hiện tại và có thể mở rộng phạm vi không cần thiết.

## 4. Kết quả kiểm thử hiện tại

`npm.cmd test` / `node --test`:

| Chỉ số | Kết quả |
|---|---:|
| Tổng | 97 |
| Đạt | 68 |
| Lỗi | 21 |
| Bỏ qua | 8 |

20 ca lỗi báo `table checkout_requests has no column named shipping_quote_json`; trải rộng qua checkout, concurrency, phí giao, khuyến mãi và thanh toán. Một ca HTTP tài khoản lỗi ở bước đăng nhập sau đổi mật khẩu (`null` thay vì redirect `/`).

Smoke HTTP: đạt quyền STAFF/ADMIN, ảnh WebP/ảnh nháp, thuộc tính, phân trang/lọc, SKU, đơn COD và giao hàng. Smoke không bao phủ tất cả nhánh mới, đặc biệt chưa chứng minh biểu phí theo địa bàn hoặc worker jobs hoạt động.

Không dùng các con số “77/82/87/89 ca đạt” trong README/báo cáo cũ để mô tả trạng thái hiện tại.

## 5. Vấn đề cần xử lý, theo ưu tiên

### P0 — Đồng bộ schema với checkout và test

`src/db.js` khai báo `openDatabase(file, targetVersion = 8)`, trong khi ứng dụng qua `defaultDatabase()` mở SQLite đến v11. Nhiều fixture gọi `openDatabase()` không truyền version, nên chỉ có schema v8. `src/checkout.js` đã đọc/ghi `shipping_quote_json`, chỉ được tạo trong migration v11 ở `src/completion-migration.js`.

Đây là nguyên nhân trực tiếp của 20 lỗi nêu trên. Không được hiểu 20 lỗi là 20 chức năng độc lập đều hỏng trên bản ứng dụng dùng v11; cũng không được bỏ qua vì smoke đã qua.

Đề xuất khi được triển khai sửa: dùng một hằng phiên bản schema hiện tại cho khởi tạo mặc định; test migration lịch sử truyền version cũ tường minh. Thêm kiểm thử nâng từ v8/v10 lên v11, khởi tạo mới và giữ snapshot/đơn cũ, sau đó chạy lại toàn bộ bộ test.

### P1 — Kiểm tra giới hạn đăng nhập

Ca HTTP lỗi tại `test/accounts-http.test.js:131`. Mã hiện tính rate limit theo IP cho mọi POST login, kể cả thành công, và không xóa bộ đếm sau thành công. Ca test đăng nhập nhiều tài khoản/phiên liên tiếp có thể chạm ngưỡng 10/15 phút.

Đây là nguyên nhân nghi vấn mạnh từ mã, chưa xác nhận status/body của lần login thất bại. Cần ghi nhận status/body trong test rồi chốt chính sách: đếm lần thất bại, hoặc giữ giới hạn tổng với fixture/ca test kiểm tra 429 riêng. Không tắt bảo vệ chỉ để làm test xanh. Đồng thời sửa thông báo tiếng Việt hiện bị mất dấu/ký tự.

### P1 — Hoàn thiện đường vào checkout theo địa bàn

Mã GET `/checkout` gọi `issueCheckout` trước khi render. Khi bật biểu phí địa bàn mà request không có `region`, `shippingQuote` ném lỗi và người dùng bị chuyển về giỏ. Trong khi selector khu vực nằm trên màn hình checkout chưa được render. Luồng thông thường từ giỏ cần được kiểm chứng và sửa để khách có thể chọn khu vực trước khi phát hành báo giá.

Đã có bảng vùng/biểu phí, trọng lượng SKU và snapshot, nhưng chưa có test chuyên biệt cho phần mới này trong danh sách test hiện tại. Cần thêm ca: thiếu vùng, vùng không hỗ trợ, SKU thiếu trọng lượng, khoảng phí chồng nhau, đổi trọng lượng/biểu phí sau báo giá và retry đơn.

### P1 — Jobs mới có nền tảng, chưa nối vào nghiệp vụ

`src/jobs.js` có enqueue/claim/lease/retry/finish; migration có integration_jobs/job_events và màn hình vận hành. Tuy nhiên, không tìm thấy nơi gọi enqueue/runOne từ luồng nghiệp vụ hoặc worker chạy nền. Luồng reset vẫn gọi trực tiếp `mailer.sendReset()`.

Không thể ghi “đã có hàng đợi email bền” chỉ từ việc có bảng và module. Cần đặc tả loại job, worker, handler, chống gửi trùng, trạng thái khi restart, timeout và bảo vệ dữ liệu nhạy cảm; sau đó mới triển khai ghép nối và kiểm thử. SMTP/network có thể lỗi sau khi gửi nên retry cần chốt hành vi gửi lặp.

### P1 — Tích hợp ngoài và đối soát

- VNPay có sandbox URL và IPN; chưa có querydr trong mã rà soát để chủ động đối soát khi mất callback.
- `payment_exceptions` đã có module scan và trang vận hành. Scan được gọi khi ADMIN mở trang; chưa chứng minh là tác vụ tự động có lịch. Chức năng resolve có trong module nhưng không thấy route gọi trực tiếp; trang hướng người dùng đến hoàn tiền.
- Vận chuyển vẫn là chế độ thủ công; chưa có adapter create/query/cancel và callback hãng.
- Email/VNPay cần nghiệm thu thật ở sandbox với cấu hình và endpoint phù hợp; bản test giả không thay thế bước này.

Các tích hợp cần chốt trong tài liệu trước, không tự chọn hoặc tuyên bố đã kết nối nhà cung cấp.

### P2 — Đồng bộ tài liệu và quyền đã phê duyệt

- `docs/07` còn mô tả schema v9/v2 và chưa có shipping_rates/jobs/exceptions, trong khi mã đã có SQLite v11/PostgreSQL migration v4.
- `docs/12` còn ghi weight/biểu phí/tables mới là chưa có; nên cập nhật thành “đã có nền tảng, chưa hoàn thiện/kiểm thử” theo từng phần.
- README và các mốc tiến độ/test đang khác nhau. Cần một báo cáo hiện trạng mới nhất và giữ các mốc cũ dưới nhãn lịch sử.
- Giỏ trước đăng nhập/đăng nhập trước đặt hàng đã được người dùng đồng ý; chỉ mục cần phản ánh quyết định này.
- COD + sandbox, tài khoản riêng cho quản lý, hủy PENDING, một kiện/đơn và các quy tắc khác vẫn có nội dung giả định chưa được phê duyệt riêng. Không được xem câu “ok” cho quy tắc đăng nhập là đồng ý toàn bộ các giả định.
- Phân biệt ERD mục tiêu và schema thực tế; thêm truy vết dashboard/yêu thích/thông báo/chatbot/nội dung cửa hàng nếu giữ trong phạm vi cuối.
- Chưa có xác nhận render/kiểm tra bố cục các sơ đồ và một bộ báo cáo Word/PDF cuối cùng. Nguồn Markdown/PlantUML không thay thế tài liệu nộp đã xem lại.

### P2 — Giao diện và vận hành

- Có các chuỗi tiếng Việt bị thay bằng `?` ngay trong source, ví dụ views/shipping.ejs, src/checkout.js và src/server.js. Cần sửa nội dung UTF-8 và kiểm tra trực quan; không chỉ đổi encoding khi đọc.
- CSS/JS storefront, nội dung cửa hàng và các màn hình mới đang có tệp chưa commit. Chốt phiên bản Git sau khi tài liệu, test và màn hình đã được rà soát; không commit bí mật hoặc CSDL.
- Cần nghiệm thu mobile, thao tác bàn phím, trạng thái trống/lỗi, form gửi lặp và luồng checkout địa bàn.
- Có backup script nhưng chưa xác nhận phục hồi từ backup trong lần này. Trước vận hành cần kiểm tra restore, HTTPS/proxy/session secret, monitoring và PostgreSQL trên cấu hình triển khai dự kiến.
- server.js hiện gom nhiều route/module; việc tách router/service có thể làm sau khi ổn định nghiệp vụ, không cần viết lại toàn bộ ngay.

## 6. Lộ trình tiếp theo theo yêu cầu làm từ từ

### Bước gần nhất: hoàn thiện tài liệu hiện trạng

1. Dùng báo cáo này làm mốc kiểm tra mới nhất.
2. Rà soát và chốt phạm vi thanh toán, vận chuyển, quyền và quy tắc hủy; mỗi nhóm làm riêng.
3. Đồng bộ đặc tả, ERD thực tế/mục tiêu và truy vết với phần đã có và phần đang dở.
4. Xuất sơ đồ/báo cáo và rà soát bố cục khi nội dung đã ổn định.

### Sau khi tài liệu được thống nhất: sửa nền tảng trước

1. Đồng bộ version schema; xử lý nguyên nhân test lỗi và xác nhận rate limit.
2. Nghiệm thu checkout địa bàn, tiếng Việt và các màn hình mới.
3. Hoàn thiện worker jobs/đối soát nếu đã chốt thuộc phạm vi.
4. Chạy lại SQLite, PostgreSQL và smoke; kiểm tra browser/mobile.
5. Nghiệm thu SMTP/VNPay sandbox; vận chuyển API chỉ khi đã chọn nhà cung cấp/phạm vi.
6. Sau cùng mới chuẩn bị triển khai web.

Không nên thêm chức năng mới ngay lúc này. Ưu tiên là tài liệu nhất quán, bộ test xanh và một luồng mua hàng được nghiệm thu đầy đủ.
