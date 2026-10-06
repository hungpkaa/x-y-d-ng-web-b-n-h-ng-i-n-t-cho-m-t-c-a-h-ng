# Đánh giá và kế hoạch xây dựng website bán đồ điện tử

Ngày đánh giá: 02/10/2026.

## 1. Cơ sở và giới hạn đánh giá

Đã đọc hai tài liệu Word: “USE CASE PHÂN RÃ HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ” và “TÁC NHÂN VÀ NGHIỆP VỤ HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ”, đồng thời đối chiếu sơ đồ use case tổng quát người dùng cung cấp.

Đã kiểm tra thư mục làm việc và Git:

- Thư mục hiện chỉ chứa `.git`; không có mã nguồn, cấu hình chạy, cơ sở dữ liệu hay kiểm thử.
- Nhánh local `main` chưa có commit; `HEAD` chưa trỏ đến commit hợp lệ.
- Remote được cấu hình là `https://github.com/hungpkaa/x-y-d-ng-web-b-n-h-ng-i-n-t-cho-m-t-c-a-h-ng.git`.
- Lệnh `git ls-remote origin` thực hiện thành công nhưng không trả về ref nào. Tại thời điểm kiểm tra, remote không công bố nhánh/tag để lấy mã nguồn.

Do đó, báo cáo này đánh giá tài liệu yêu cầu và đề xuất triển khai. Không thể kết luận một chức năng đã chạy, đã thiếu trong một phiên bản khác, hoặc tỷ lệ hoàn thành lập trình. Nếu mã nguồn nằm ở thư mục/kho khác, cần đối chiếu bổ sung trước khi dùng kế hoạch này để sửa hệ thống đã có.

## 2. Phần đã có

Phần phân tích đã hình thành được khung nghiệp vụ khá rõ:

- Xác định 5 tác nhân: khách hàng, nhân viên bán hàng, quản trị viên, cổng thanh toán, đơn vị vận chuyển.
- Liệt kê luồng mua hàng: tìm sản phẩm → xem chi tiết → giỏ hàng → đặt hàng → thanh toán → theo dõi đơn.
- Phân rã các nhóm quản trị: tài khoản, sản phẩm, danh mục, thương hiệu, đơn hàng, khuyến mãi, đánh giá, báo cáo.
- Xác định tiêu chí so sánh thông số kỹ thuật và gợi ý sản phẩm theo danh mục, thương hiệu, giá, độ phổ biến.
- Giới hạn recommendation ở mức quy tắc cơ bản, phù hợp phạm vi đồ án; chưa cần Machine Learning.

Đây là đầu vào phân tích, chưa phải bằng chứng triển khai. Tài liệu chưa đủ chi tiết để lập trình thống nhất hoặc nghiệm thu từng chức năng.

## 3. Đối chiếu yêu cầu với hiện trạng

| Nhóm chức năng | Đã có trong tài liệu | Bằng chứng triển khai tại workspace | Cần làm tiếp |
|---|---|---|---|
| Tài khoản khách hàng | Đăng ký, đăng nhập/đăng xuất, cập nhật thông tin | Chưa có mã để kiểm tra | Xác thực, hồ sơ, kiểm tra dữ liệu, trạng thái khóa tài khoản |
| Danh sách sản phẩm | Danh mục, tìm kiếm, lọc, sắp xếp, chi tiết | Chưa có mã để kiểm tra | CSDL sản phẩm, phân trang, API và giao diện |
| So sánh | Chọn, xem, bỏ sản phẩm; các tiêu chí kỹ thuật | Chưa có mã để kiểm tra | Chuẩn hóa thuộc tính theo danh mục, giới hạn số sản phẩm, bảng so sánh |
| Gợi ý | Cùng danh mục/thương hiệu/khoảng giá, phổ biến | Chưa có mã để kiểm tra | Công thức xếp hạng đơn giản, loại sản phẩm đang xem và sản phẩm bị ẩn |
| Giỏ hàng | Thêm, sửa số lượng, xóa, tính tổng | Chưa có mã để kiểm tra | Quy tắc biến thể, tồn kho, đồng bộ giỏ hàng và tính tiền phía server |
| Đặt hàng | Địa chỉ, phương thức thanh toán, tạo đơn | Chưa có mã để kiểm tra | Giao dịch tạo đơn, lưu giá lúc mua, phí giao hàng, xử lý đặt hàng lặp |
| Thanh toán | Gửi yêu cầu, nhận kết quả, cập nhật trạng thái | Chưa có mã để kiểm tra | COD và cổng sandbox; kiểm tra chữ ký, số tiền, callback lặp |
| Đơn hàng cá nhân | Danh sách, chi tiết, lịch sử, theo dõi | Chưa có mã để kiểm tra | Phân quyền chủ sở hữu, lịch sử trạng thái, điều kiện hủy đơn |
| Đánh giá | Số sao, nội dung, sản phẩm đã mua | Chưa có mã để kiểm tra | Kiểm tra quyền đánh giá, số lần đánh giá, kiểm duyệt |
| Nhân viên | Sản phẩm, số lượng, xác nhận đơn, hỗ trợ | Chưa có mã để kiểm tra | Ma trận quyền, màn hình xử lý đơn và cách ghi nhận hỗ trợ |
| Quản trị | Tài khoản, nhân viên, danh mục, thương hiệu, khuyến mãi, đánh giá | Chưa có mã để kiểm tra | CRUD, khóa/ẩn dữ liệu, ràng buộc tham chiếu, nhật ký thao tác |
| Báo cáo | Doanh thu, đơn, bán chạy, sản phẩm, khách hàng | Chưa có mã để kiểm tra | Định nghĩa chỉ số, khoảng thời gian và nguồn dữ liệu |
| Vận chuyển | Gửi đơn, cập nhật giao hàng, xác nhận giao thành công | Chưa có mã để kiểm tra | Phí ship, mã vận đơn, lỗi giao, cập nhật thủ công hoặc adapter nhà vận chuyển |

## 4. Những điểm cần bổ sung trong phân tích

### 4.1. Đặc tả use case

Mỗi use case cần có: mã, tác nhân, mục tiêu, tiền điều kiện, luồng chính, luồng thay thế/lỗi, hậu điều kiện, quyền truy cập và tiêu chí nghiệm thu. Hiện tài liệu chủ yếu liệt kê thao tác.

Ví dụ “Đặt hàng” cần trả lời: có bắt buộc đăng nhập không; giá thay đổi thì xử lý thế nào; hết hàng khi xác nhận ra sao; mã giảm giá có áp dụng được không; bấm xác nhận hai lần có tạo hai đơn không; thanh toán thất bại có giữ đơn và tồn kho không.

### 4.2. Điều chỉnh sơ đồ use case

- `include` diễn tả hành vi bắt buộc được dùng lại, không diễn tả thứ tự trước/sau trong quy trình.
- Không nên dùng `Thanh toán → include → Quản lý vận chuyển` để biểu diễn chuỗi giao hàng. COD có thể được thu tiền sau khi giao; nên mô tả thứ tự bằng activity diagram hoặc sequence diagram.
- Quan hệ `Đánh giá sản phẩm → extend → Xem chi tiết sản phẩm` chỉ phù hợp nếu đánh giá là hành vi tùy chọn mở rộng luồng xem chi tiết. Mũi tên extend hướng về use case gốc. Điều kiện “đã mua và đã nhận hàng” vẫn phải đặc tả riêng.
- “Thêm”, “sửa”, “cập nhật số lượng” là các lựa chọn trong nhóm quản lý sản phẩm; không có nghĩa mỗi lần quản lý đều thực hiện tất cả. Có thể tổ chức bằng nhóm use case hoặc các use case độc lập thay cho include bắt buộc.
- Tài liệu có cập nhật hồ sơ và quản lý nhân viên chi tiết hơn hình tổng quát; cần thống nhất tên/mã use case giữa các bản.
- Cổng thanh toán và đơn vị vận chuyển là hệ thống bên ngoài. Website chỉ xây phần tích hợp; không xây lại nghiệp vụ nội bộ của các bên này.

### 4.3. Quy tắc nghiệp vụ còn thiếu

| Vấn đề | Quy tắc đề xuất cho bản đầu |
|---|---|
| Vai trò | CUSTOMER, STAFF, ADMIN; backend kiểm tra quyền trên từng API |
| Quyền nhân viên | Xem/thêm/sửa sản phẩm và xử lý đơn; không quản lý vai trò hoặc xóa lịch sử giao dịch |
| Sản phẩm điện tử | Tách sản phẩm và biến thể SKU: màu, dung lượng/cấu hình; mỗi SKU có giá và tồn kho |
| Thông số | Định nghĩa theo danh mục, có đơn vị và kiểu dữ liệu; so sánh các sản phẩm cùng loại |
| Tồn kho | Giữ hàng khi tạo đơn, giải phóng khi hủy/hết hạn; giao dịch nguyên tử để tránh bán vượt tồn |
| Giá đơn hàng | Server tính tổng; lưu tên/SKU/đơn giá/giảm giá tại thời điểm mua trong chi tiết đơn |
| Trạng thái | Tách trạng thái đơn hàng, thanh toán và vận chuyển; quy định bước chuyển hợp lệ |
| Hủy đơn | Chỉ cho khách hủy trước mốc xử lý đã thống nhất; đơn trả trước cần xử lý hoàn tiền riêng |
| Khuyến mãi | Ngày hiệu lực, loại/mức giảm, trần giảm, điều kiện áp dụng, hạn mức sử dụng; bản đầu không cộng dồn |
| Đánh giá | Chỉ chủ đơn đã giao được đánh giá; một đánh giá trên một chi tiết đơn ở bản đầu |
| Xóa dữ liệu | Ưu tiên ẩn sản phẩm và khóa tài khoản; giữ dữ liệu đơn cũ để truy vết |
| Doanh thu | Đề xuất tính theo đơn đã hoàn tất và thanh toán đã thu; nêu rõ cách trừ hoàn tiền và phí ship |
| Hỗ trợ | Bản đầu dùng yêu cầu hỗ trợ gắn với đơn và ghi chú xử lý; chat realtime là mở rộng |

Luồng đơn đề xuất: `PENDING → CONFIRMED → PREPARING → SHIPPING → DELIVERED`; `CANCELLED` chỉ được chuyển từ các trạng thái cho phép. Giao thất bại/hoàn hàng cần quy tắc riêng nếu đưa vào phạm vi.

Thanh toán: `UNPAID`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`. COD khởi đầu là `UNPAID`; hoàn tiền chỉ đánh dấu hoàn thành sau khi có kết quả xử lý. Trạng thái cuối của đơn không được suy ra chỉ từ việc khách quay lại trang thanh toán.

### 4.4. Thiết kế và tài liệu chưa có tại workspace

- ERD và từ điển dữ liệu.
- Ma trận phân quyền và đặc tả API.
- Wireframe cho khách hàng, nhân viên, quản trị viên.
- Kịch bản kiểm thử, dữ liệu mẫu, hướng dẫn chạy và cấu hình môi trường.
- Yêu cầu phi chức năng: bảo vệ mật khẩu, xác thực, kiểm tra đầu vào, giới hạn đăng nhập, phân trang, log, sao lưu và khôi phục.
- Thông tin bảo hành trên sản phẩm; quản lý yêu cầu bảo hành/đổi trả là phần mở rộng cần chốt phạm vi, không tự xem là yêu cầu bắt buộc của hai tài liệu.

## 5. Phương án xây dựng

### 5.1. Kiến trúc

Với phạm vi một cửa hàng và đồ án cơ sở, đề xuất một ứng dụng monolith chia module, một CSDL quan hệ, một frontend responsive. Chưa cần microservices, hàng đợi phức tạp hay Machine Learning.

Module: Identity, Catalog, Cart, Orders, Payments, Shipping, Promotions, Reviews, Reports. Thanh toán/vận chuyển đi qua adapter để có thể dùng sandbox hoặc mô phỏng trong demo và thay bằng dịch vụ thật sau này.

Chưa có stack hiện hữu để kế thừa. Nên chọn công nghệ nhóm đã biết và yêu cầu của môn học trước khi khởi tạo; cấu trúc trên áp dụng được cho Java/Spring, ASP.NET, Laravel hoặc Node.js. Không cần đổi stack nếu mã nguồn thực tế đã được xây bằng công nghệ khác.

### 5.2. Dữ liệu cốt lõi

Các bảng dự kiến:

- `users`, `roles`, `user_roles`, `addresses`.
- `categories`, `brands`, `products`, `product_images`, `product_variants`, `attribute_definitions`, `product_attribute_values`.
- `carts`, `cart_items`.
- `orders`, `order_items`, `order_status_history`.
- `inventory_reservations`, `inventory_movements` để theo dõi giữ hàng và thay đổi tồn kho.
- `payments`, `payment_events` để lưu giao dịch và ngăn xử lý callback lặp.
- `shipments`.
- `promotions`, `promotion_products`, `promotion_redemptions` nếu dùng chương trình/mã khuyến mãi theo sản phẩm.
- `reviews`, `support_requests`, `audit_logs`.

Đây là mô hình đề xuất, chưa phải schema đã tồn tại. Cần chốt quan hệ, khóa ngoại, unique/index và quy tắc trước khi tạo migration. Tiền lưu bằng kiểu số chính xác; không dùng số thực dấu phẩy động để tính tiền.

## 6. Lộ trình và điều kiện hoàn thành

| Giai đoạn | Công việc | Điều kiện nghiệm thu |
|---|---|---|
| 0. Chốt phân tích | Chuẩn hóa use case, ma trận quyền, ERD, trạng thái, wireframe, lựa chọn stack | Có đặc tả cho luồng mua hàng và xử lý đơn; thống nhất phạm vi demo |
| 1. Nền tảng và catalog | Khởi tạo dự án, migration, seed, đăng ký/đăng nhập, phân quyền, danh mục/thương hiệu/sản phẩm/SKU, tìm kiếm/lọc | Khách xem được dữ liệu từ CSDL; admin quản lý được; người không đủ quyền bị từ chối ở API |
| 2. Mua hàng COD | Giỏ hàng, địa chỉ, phí ship, tạo đơn, giữ tồn, lịch sử đơn, nhân viên xác nhận và xử lý đơn | Chạy được toàn bộ luồng mua → giao → ghi nhận thu tiền; không bán vượt tồn hoặc tạo đơn lặp |
| 3. Hoàn thiện nghiệp vụ | Hồ sơ/khóa tài khoản, quản lý nhân viên, so sánh, gợi ý, khuyến mãi, đánh giá, hỗ trợ, thống kê | Có ca nghiệm thu cho từng use case; số liệu báo cáo khớp dữ liệu mẫu |
| 4. Tích hợp ngoài | Một cổng thanh toán sandbox; vận chuyển theo phạm vi đã chốt | Thành công/thất bại/callback lặp được xử lý đúng; có mã vận đơn và lịch sử giao hàng |
| 5. Đóng gói đồ án | Kiểm thử toàn luồng, rà soát quyền, log/backup, triển khai demo, README và báo cáo | Người khác chạy được theo README; demo đủ ba vai trò và hai tích hợp hoặc ghi rõ phần mô phỏng |

Ưu tiên làm một luồng mua hàng COD hoàn chỉnh trước, sau đó mở rộng. Giai đoạn 1–2 tạo MVP; không đồng nghĩa đã đáp ứng toàn bộ tài liệu. So sánh, gợi ý, khuyến mãi, đánh giá, báo cáo và tích hợp ngoài vẫn cần hoàn tất nếu nghiệm thu theo toàn bộ phạm vi.

Nếu chưa tích hợp API nhà vận chuyển, có thể cho nhân viên nhập mã vận đơn và cập nhật trạng thái để demo nghiệp vụ. Phải ghi rõ đây là cập nhật thủ công, chưa phải tích hợp tự động với đơn vị vận chuyển.

Không đưa ra số tuần chắc chắn khi chưa biết số người, năng lực, thời gian làm và yêu cầu công nghệ. Sau giai đoạn 0, chia việc thành backlog với phụ thuộc và ước lượng theo nguồn lực thực tế.

## 7. Kiểm thử quan trọng

1. Khách A không đọc/sửa được đơn của khách B; STAFF không tự cấp quyền ADMIN.
2. Tài khoản khóa không tiếp tục thao tác qua phiên đăng nhập cũ theo chính sách đã chọn.
3. Hai khách đồng thời mua SKU còn một sản phẩm: chỉ một đơn giữ được hàng.
4. Sửa giá/tổng tiền trên trình duyệt không thay đổi số tiền server tính.
5. Gửi xác nhận đặt hàng nhiều lần không tạo đơn trùng cho cùng yêu cầu.
6. Hủy đơn giải phóng tồn đúng một lần; chuyển trạng thái sai bị từ chối.
7. Callback thanh toán sai chữ ký/sai số tiền không đánh dấu PAID; callback lặp không trừ tồn hoặc ghi thu tiền lần hai.
8. Thay đổi giá, tên hoặc ẩn sản phẩm không làm sai lịch sử đơn đã mua.
9. Khuyến mãi hết hạn/vượt hạn mức không được áp dụng; việc sử dụng đồng thời không vượt giới hạn.
10. Người chưa nhận hàng không được đánh giá; báo cáo không cộng đơn hủy vào doanh thu.

## 8. Bước nên thực hiện ngay

Nếu đây là kho khởi đầu: hoàn tất đặc tả luồng mua hàng, ERD và ma trận quyền; chọn stack; rồi triển khai giai đoạn 1–2. Chưa nên bắt đầu bằng dashboard thống kê hoặc AI recommendation vì chưa có dữ liệu giao dịch làm nền.

Nếu dự án đã lập trình ở nơi khác: cung cấp đúng thư mục/kho mã nguồn để đánh giá lại từng chức năng theo bằng chứng gồm schema, API, giao diện và kết quả chạy. Không dùng trạng thái “chưa có mã để kiểm tra” trong báo cáo này để kết luận mã nguồn ở nơi khác chưa thực hiện chức năng.
