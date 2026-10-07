# Electro Store

Đối chiếu đầy đủ docs tại [34 use case và phần còn thiếu](docs/12_ECARTS_ET_IMPLEMENTATION.md). Đã thêm [vận đơn thủ công, giao thất bại và nhận hàng về](docs/13_SU_DUNG_VAN_CHUYEN.md) theo UC-25/26.

## Bộ tài liệu phân tích và thiết kế

Đọc [docs/README.md](docs/README.md) để xem tác nhân, phân quyền, 34 đặc tả use case, sơ đồ UML tổng quát/theo tác nhân, sơ đồ luồng và ERD toàn hệ thống. Đây là thiết kế mục tiêu; danh sách chức năng đã triển khai bên dưới chỉ mô tả bản demo hiện tại.

Website bán đồ điện tử dùng Node.js 24+, Express, EJS và PostgreSQL khi cấu hình `DATABASE_URL`; vẫn hỗ trợ SQLite cho demo và kiểm thử. Xem [hướng dẫn PostgreSQL](docs/11_POSTGRESQL.md) để cấu hình, chuyển dữ liệu hiện có và chạy bộ kiểm tra PostgreSQL.

## Chạy trên Windows PowerShell

```powershell
npm.cmd install
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = 'ThayBangMatKhauCuaBan123!'
npm.cmd run dev
```

Mở http://localhost:3000. Đăng nhập bằng tài khoản quản trị vừa cấu hình. Đăng ký tài khoản mới để thử vai trò khách hàng. Biến ADMIN chỉ tạo tài khoản khi email chưa tồn tại, không đổi mật khẩu hoặc nâng quyền tài khoản có sẵn.

`npm.cmd` tránh lỗi PowerShell chặn script `npm.ps1`; không cần đổi execution policy. Có thể chạy `npm.cmd start` thay cho chế độ tự tải lại.

Khi không có `DATABASE_URL`, SQLite được tạo tại `data/store.sqlite`; khi có biến này, ứng dụng lưu dữ liệu trong PostgreSQL. Dữ liệu mẫu được thêm khi chưa có sản phẩm. Giá và cấu hình sản phẩm mẫu chỉ phục vụ demo. Không commit dữ liệu thật hoặc mật khẩu vào Git.

## Đã triển khai

- Đăng ký, đăng nhập, đăng xuất; băm mật khẩu bằng scrypt, CSRF và giới hạn thử đăng nhập.
- Danh sách, chi tiết, tìm kiếm theo tên/thương hiệu, lọc danh mục, sắp xếp giá.
- Giỏ hàng theo phiên, cập nhật số lượng, xóa, kiểm tra tồn.
- Đặt hàng COD theo SKU, giá lấy từ server; lưu mã SKU, màu/cấu hình và giá lúc mua.
- Giữ tồn nguyên tử khi đặt đơn; giải phóng khi hủy; trừ tồn vật lý khi chuyển SHIPPING. Có lịch sử điều chỉnh kho.
- Đơn hàng của khách, chi tiết và lịch sử trạng thái; khách không đọc được đơn của người khác.
- STAFF/ADMIN tạo sản phẩm nháp và SKU; ADMIN thiết lập giá/bật bán SKU và công bố/ẩn sản phẩm. STAFF cập nhật thông tin và điều chỉnh tồn có lý do; cả hai xử lý đơn.
- SKU có giá/tồn riêng theo màu/cấu hình, kiểm tra version chống ghi đè và audit khi thay đổi.
- STAFF/ADMIN tải ảnh JPEG/PNG/WebP, sửa mô tả/thứ tự và xóa ảnh; ảnh được kiểm tra, chuyển WebP và lưu trong SQLite. Ảnh nháp/ẩn chỉ quản lý được xem.
- ADMIN định nghĩa thông số theo danh mục (văn bản, số, Có/Không); STAFF nhập giá trị cho SKU. Khi công bố cần ảnh và đủ thông số bắt buộc.
- Catalog và quản lý sản phẩm phân trang 20 mục, tìm kiếm/lọc danh mục, thương hiệu, khoảng giá và sắp xếp ổn định.
- ADMIN quản lý danh mục/thương hiệu tại `/admin/catalog`; sản phẩm chọn từ danh sách có sẵn. Đổi tên được đồng bộ; ngừng sử dụng ngăn gán mới, không ẩn sản phẩm cũ.
- Hồ sơ `/profile`: tên, điện thoại, địa chỉ mặc định và đổi mật khẩu bằng mật khẩu hiện tại. Email/vai trò bất biến; đổi mật khẩu vô hiệu hóa các phiên cũ.
- ADMIN quản lý tài khoản và tạo/sửa nhân viên tại `/admin/accounts`, khóa/mở khóa có lý do và audit. Tài khoản khóa không đăng nhập/thao tác được; mở khóa cần đăng nhập mới; không tự khóa ADMIN đang sử dụng.
- Danh sách đơn cá nhân/toàn cửa hàng tìm kiếm, lọc trạng thái/ngày và phân trang 20 mục. Khách hủy đơn PENDING của mình; STAFF/ADMIN xử lý từng bước có ghi chú và version chống ghi đè.
- ADMIN cấu hình phí giao hàng cố định tại `/admin/shipping`; báo giá phải xác nhận lại khi phí thay đổi, đơn đã đặt giữ nguyên tiền hàng/phí/tổng.
- Giao thành công giữ COD ở UNPAID; chỉ ADMIN xác nhận đủ tiền thực thu với mã chứng từ/ghi chú mới chuyển PAID. Không tự đánh dấu đã hoàn tiền khi hủy đơn đã thu.
- So sánh tại `/compare`: tối đa 3 SKU cùng danh mục, giá/cấu hình/thông số có kiểu và đơn vị, đánh dấu khác biệt. Danh sách lưu trong phiên; SKU ẩn/tắt bán được tự loại bỏ, SKU hết hàng vẫn so sánh được.
- Gợi ý ở catalog/chi tiết và `/recommendations`: tối đa 6 sản phẩm còn hàng, mỗi sản phẩm một SKU phù hợp. Xếp theo danh mục/thương hiệu/giá gần, lượng đã giao và ID; chọn cấu hình tham chiếu hoặc lọc danh mục/thương hiệu/ngân sách. Hiển thị lý do, không giả dữ liệu bán chạy.
- ADMIN tạo/sửa/bật/tắt mã tại `/admin/promotions`; khách áp dụng một mã ở checkout. Mã giảm tiền hàng theo số tiền/phần trăm, có phạm vi sản phẩm, thời hạn và giới hạn lượt; đặt đơn giữ lượt, hủy trước giao trả lượt, bàn giao dùng lượt. Đơn giữ snapshot mức giảm.
- CUSTOMER viết/sửa đánh giá trong đơn DELIVERED; ADMIN duyệt tại `/admin/reviews`. Chỉ đánh giá được duyệt mới hiển thị công khai và tính điểm trung bình; khách sửa cần duyệt lại.
- ADMIN xem báo cáo tại `/admin/reports`: theo ngày Việt Nam, doanh thu hàng đã giao/thu đủ, COD thực thu, trạng thái đơn, top 10 SKU đã giao và tồn thấp hiện tại. Xuất CSV cùng bộ lọc, có che công thức và ghi audit lần xuất.
- ADMIN tra cứu `/admin/audit` theo ngày, người thao tác, hành động, loại/mã đối tượng; phân trang 20 mục, xem trước/sau đã che trường nhạy cảm. Không có chức năng sửa/xóa nhật ký.
- Quên mật khẩu tại `/forgot-password`: gửi liên kết SMTP một lần, hết hạn 30 phút; mật khẩu mới vô hiệu các phiên cũ. Cần cấu hình email trước khi sử dụng.
- CUSTOMER lưu tối đa 20 địa chỉ tại `/addresses`, chọn mặc định hoặc địa chỉ khác khi checkout. Đơn cũ giữ nguyên thông tin nhận hàng.
- Hỗ trợ theo đơn tại `/support`: khách tạo từ chi tiết đơn; STAFF/ADMIN xử lý tại `/admin/support`, trả lời công khai hoặc ghi chú nội bộ. Khách không thấy tin nội bộ, mở lại ticket đã đóng trong 7 ngày; danh sách/hội thoại phân trang.
- Checkout chọn COD hoặc VNPay sandbox khi đã cấu hình. VNPay cập nhật tiền từ IPN đã xác thực, không từ return trình duyệt; đơn quá hạn 15 phút được hủy/giải phóng tồn. Callback trùng/muộn được xử lý theo ledger.
- ADMIN ghi nhận hoàn toàn bộ khoản thu cho đơn hủy hoặc khoản thu dư tại `/admin/refunds`, có mã đối soát/bằng chứng/thời điểm. Không tự gửi lệnh hoàn tiền ngân hàng/VNPay. Báo cáo bổ sung tiền VNPay thu, tiền hoàn, thu trừ hoàn và khoản chờ hoàn.

## Cấu hình email và VNPay

Sao chép `.env.example` thành `.env`, nhập SMTP, `APP_URL`, `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` do nhà cung cấp cấp. Các lệnh start/dev tự đọc `.env` nếu có; file thật không được commit. Xem [hướng dẫn cấu hình và kiểm thử](docs/10_CAU_HINH_EMAIL_VNPAY.md) để đăng ký URL IPN/Return public và kiểm tra email. Chưa có cấu hình thì khôi phục mật khẩu và VNPay chưa khả dụng; các chức năng còn lại vẫn chạy.

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run test:smoke
```

Kiểm thử nghiệp vụ gồm quyền tài khoản, vô hiệu phiên khi khóa/đổi mật khẩu, snapshot đơn/phí, không bán vượt tồn, rollback, đặt trùng, hủy tranh chấp với xác nhận và đối soát COD. Smoke test chạy server trên cổng 3107 với CSDL trong RAM, kiểm tra HTTP từ đăng ký đến giao hàng/thu COD. Các test restart/concurrency dùng CSDL tạm riêng, không tạo dữ liệu kiểm thử trong data/store.sqlite. Chạy demo: quản trị tạo SKU → khách cập nhật hồ sơ → giỏ hàng → COD → nhân viên xử lý đến đã giao → ADMIN ghi nhận tiền thực thu → khách xem đơn.

## Giới hạn của bản đầu

Cập nhật 07/10/2026: 77/77 test và smoke test đạt. Đã kiểm tra email giả/IPN ký bằng khóa kiểm thử; chưa chạy SMTP thật, merchant VNPay thật hoặc giao diện trực quan bằng trình duyệt.

Phiên đăng nhập và giỏ hàng lưu trong SQLite, giữ qua khởi động lại trong thời hạn cookie 24 giờ. Khóa đặt hàng gắn với khách hàng và lưu CSDL: gửi lại cùng thông tin trả về đơn cũ; đổi thông tin với cùng khóa bị chặn. Xác nhận thanh toán có hiệu lực 15 phút và kiểm tra lại giá, giỏ, tồn. Khóa ký phiên local lưu CSDL; production cần SESSION_SECRET ổn định và cấu hình HTTPS/proxy. Logout xóa phiên; chưa đồng bộ giỏ nhiều thiết bị. DB_PATH cho phép chọn file SQLite (mặc định data/store.sqlite).

Danh mục/thương hiệu có bảng riêng; sản phẩm có nhiều SKU. Các cột giá/tồn cũ của products được giữ để tương thích nhưng giá/tồn bán hàng lấy từ product_variants. Chưa có danh mục phân cấp. Gợi ý dùng quy tắc catalog và lượng đã giao, chưa cá nhân hóa theo lịch sử duyệt/mua hoặc tư vấn theo mục đích sử dụng. Danh mục và định nghĩa thông số chưa phân trang. Phí giao hàng cố định, mặc định 0 VND cho demo; chưa có biểu phí theo địa bàn/trọng lượng hoặc tích hợp vận chuyển. COD xác nhận thủ công sau đối soát; hoàn tiền chỉ ghi nhận toàn bộ từng khoản thu sau khi thực hiện ngoài hệ thống, chưa upload tệp chứng từ/hoàn một phần/đổi trả sau giao. Đơn PAID cũ được giữ nguyên khi nâng cấp; chỉ chứng từ COD thật có sẵn được chuyển sang ledger, không tạo bằng chứng giả cho lịch sử cũ.

Báo cáo giới hạn 366 ngày, mặc định tháng hiện tại theo UTC+7. Doanh thu hàng chỉ ghi nhận DELIVERED/PAID khi đủ lịch sử giao và bằng chứng thu tiền, không dùng ngày tạo đơn thay thế. Đơn cũ thiếu bằng chứng được báo riêng. COD thực thu theo ngày ghi chứng từ; VNPay theo thời điểm cổng báo đã thu, tiền hoàn theo thời điểm chứng từ. Thu trừ hoàn không phải lợi nhuận. Tồn thấp là tồn hiện tại, UI hiển thị 20 SKU đầu và CSV có toàn bộ; không phải tồn cuối kỳ. Nhật ký che trường nhạy cảm theo tên khóa JSON, không tự phát hiện bí mật trong ghi chú tự do. Email chưa có hàng đợi/retry bền; VNPay chưa có querydr chủ động đối soát khi IPN mất. Sandbox cần CSDL riêng với dữ liệu bán thật.

## Nâng cấp CSDL

Ứng dụng chạy migration có phiên bản khi mở CSDL. Trước migration trên file, SQLite tạo bản sao nhất quán tại `data/backups/`; nâng cấp trong transaction và rollback nếu lỗi. Khởi động lại không chạy migration đã áp dụng. Bước 1 tách danh mục/thương hiệu, giữ nguyên ID sản phẩm, giá, tồn và các đơn cũ. Xem [tiến độ và cách kiểm tra](docs/09_TIEN_DO_TRIEN_KHAI.md).

## Thứ tự phát triển tiếp

Đã hoàn thành bước 1–6: catalog, SKU/kho, ảnh/thông số, phiên/chống đặt trùng, tài khoản/đơn hàng và so sánh/gợi ý. Chi tiết từng bước tại [tiến độ](docs/09_TIEN_DO_TRIEN_KHAI.md).

Khuyến mãi/đánh giá và báo cáo COD/nhật ký đã có; phạm vi và giới hạn tại [tiến độ](docs/09_TIEN_DO_TRIEN_KHAI.md).

1. Kiểm tra giao diện trực quan; phân trang các danh sách còn lại.
2. Cấu hình SMTP/merchant VNPay, kiểm thử tích hợp trên domain public; bổ sung đối soát querydr và hàng đợi email.
3. Vận chuyển theo địa bàn, kiểm thử triển khai và vận hành.

Xem `DANH_GIA_VA_KE_HOACH_DU_AN.md` để biết phạm vi yêu cầu ban đầu. Báo cáo đó ghi nhận hiện trạng trước khi khởi tạo mã nguồn này.
