# Electro Store

## Bộ tài liệu phân tích và thiết kế

Đọc [docs/README.md](docs/README.md) để xem tác nhân, phân quyền, 34 đặc tả use case, sơ đồ UML tổng quát/theo tác nhân, sơ đồ luồng và ERD toàn hệ thống. Đây là thiết kế mục tiêu; danh sách chức năng đã triển khai bên dưới chỉ mô tả bản demo hiện tại.

Bản đầu của website bán đồ điện tử dùng Node.js 24+, Express, EJS và SQLite tích hợp trong Node.js. Chưa cần cài máy chủ cơ sở dữ liệu riêng.

## Chạy trên Windows PowerShell

```powershell
npm.cmd install
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = 'ThayBangMatKhauCuaBan123!'
npm.cmd run dev
```

Mở http://localhost:3000. Đăng nhập bằng tài khoản quản trị vừa cấu hình. Đăng ký tài khoản mới để thử vai trò khách hàng. Biến ADMIN chỉ tạo tài khoản khi email chưa tồn tại, không đổi mật khẩu hoặc nâng quyền tài khoản có sẵn.

`npm.cmd` tránh lỗi PowerShell chặn script `npm.ps1`; không cần đổi execution policy. Có thể chạy `npm.cmd start` thay cho chế độ tự tải lại.

SQLite được tạo tại `data/store.sqlite`; dữ liệu mẫu được thêm khi chưa có sản phẩm. Giá và cấu hình sản phẩm mẫu chỉ phục vụ demo. Không commit dữ liệu thật hoặc mật khẩu vào Git.

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

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run test:smoke
```

Kiểm thử nghiệp vụ gồm quyền tài khoản, vô hiệu phiên khi khóa/đổi mật khẩu, snapshot đơn/phí, không bán vượt tồn, rollback, đặt trùng, hủy tranh chấp với xác nhận và đối soát COD. Smoke test chạy server trên cổng 3107 với CSDL trong RAM, kiểm tra HTTP từ đăng ký đến giao hàng/thu COD. Các test restart/concurrency dùng CSDL tạm riêng, không tạo dữ liệu kiểm thử trong data/store.sqlite. Chạy demo: quản trị tạo SKU → khách cập nhật hồ sơ → giỏ hàng → COD → nhân viên xử lý đến đã giao → ADMIN ghi nhận tiền thực thu → khách xem đơn.

## Giới hạn của bản đầu

Phiên đăng nhập và giỏ hàng lưu trong SQLite, giữ qua khởi động lại trong thời hạn cookie 24 giờ. Khóa đặt hàng gắn với khách hàng và lưu CSDL: gửi lại cùng thông tin trả về đơn cũ; đổi thông tin với cùng khóa bị chặn. Xác nhận thanh toán có hiệu lực 15 phút và kiểm tra lại giá, giỏ, tồn. Khóa ký phiên local lưu CSDL; production cần SESSION_SECRET ổn định và cấu hình HTTPS/proxy. Logout xóa phiên; chưa đồng bộ giỏ nhiều thiết bị. DB_PATH cho phép chọn file SQLite (mặc định data/store.sqlite).

Danh mục/thương hiệu có bảng riêng; sản phẩm có nhiều SKU. Các cột giá/tồn cũ của products được giữ để tương thích nhưng giá/tồn bán hàng lấy từ product_variants. Chưa có danh mục phân cấp, sổ nhiều địa chỉ, quên mật khẩu, khuyến mãi, đánh giá, hỗ trợ hoặc thống kê. Gợi ý dùng quy tắc catalog và lượng đã giao, chưa cá nhân hóa theo lịch sử duyệt/mua hoặc tư vấn theo mục đích sử dụng. Danh mục và định nghĩa thông số chưa phân trang. Audit đã ghi cho sản phẩm, tài khoản, đơn và COD nhưng chưa có trang tra cứu chung. Phí giao hàng cố định, mặc định 0 VND cho demo; chưa có biểu phí theo địa bàn/trọng lượng hoặc tích hợp thanh toán/vận chuyển. COD xác nhận thủ công sau đối soát, chưa có upload chứng từ hay hoàn tiền. Đơn PAID cũ được giữ nguyên trạng thái khi nâng cấp, không tự tạo chứng từ cho lịch sử cũ.

## Nâng cấp CSDL

Ứng dụng chạy migration có phiên bản khi mở CSDL. Trước migration trên file, SQLite tạo bản sao nhất quán tại `data/backups/`; nâng cấp trong transaction và rollback nếu lỗi. Khởi động lại không chạy migration đã áp dụng. Bước 1 tách danh mục/thương hiệu, giữ nguyên ID sản phẩm, giá, tồn và các đơn cũ. Xem [tiến độ và cách kiểm tra](docs/09_TIEN_DO_TRIEN_KHAI.md).

## Thứ tự phát triển tiếp

Đã hoàn thành bước 1–6: catalog, SKU/kho, ảnh/thông số, phiên/chống đặt trùng, tài khoản/đơn hàng và so sánh/gợi ý. Chi tiết từng bước tại [tiến độ](docs/09_TIEN_DO_TRIEN_KHAI.md).

1. Khuyến mãi và đánh giá mua hàng.
2. Báo cáo và trang nhật ký; phân trang các danh sách còn lại.
3. Thanh toán sandbox, vận chuyển theo địa bàn, kiểm thử tích hợp và triển khai.

Xem `DANH_GIA_VA_KE_HOACH_DU_AN.md` để biết phạm vi yêu cầu ban đầu. Báo cáo đó ghi nhận hiện trạng trước khi khởi tạo mã nguồn này.
