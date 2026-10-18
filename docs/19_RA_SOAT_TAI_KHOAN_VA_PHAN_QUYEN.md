# Rà soát tài khoản và phân quyền

Ngày: 14/10/2026. Chỉ rà soát UC-01..05 và quyền liên quan; chưa sửa mã, chưa thay thế nghiệm thu thực tế.

## 1. Kết quả đối chiếu

| Nội dung | Đặc tả / dữ liệu / nghiệm thu | Đánh giá |
|---|---|---|
| Đăng ký khách hàng | UC-01; users.email unique, role; AT-01/02 | Khớp về mục tiêu: đăng ký công khai không cấp quyền quản lý |
| Đăng nhập ba vai trò | UC-02; users.status/auth_version, sessions; cần kiểm tra đổi ID phiên | Có mô hình; chính sách giới hạn đăng nhập cần chốt, ca HTTP hiện có lỗi theo báo cáo 17 |
| Hồ sơ và đổi mật khẩu | UC-04; users, addresses, sessions | Đổi mật khẩu đã chốt 14/10/2026: xác minh mật khẩu hiện tại, vô hiệu mọi phiên cũ khi thành công; giữ giỏ và lịch sử đơn; bổ sung AT-39/40 |
| Khóa/mở khóa | UC-05; users.status/auth_version, audit; AT-03 | Đã chốt 14/10/2026: ADMIN thao tác có lý do; khóa vô hiệu mọi phiên, mở khóa đăng nhập lại; giữ tài khoản và lịch sử đơn |
| STAFF không sửa giá | UC-10; quyền ADMIN; AT-04 | Đã chốt; có tiêu chí kiểm tra cả HTTP thay vì chỉ ẩn nút |
| Giỏ trước đăng nhập, đăng nhập trước đặt | UC-02/16/18; sessions/carts; AT-34 mới kiểm tra restart | Đã chốt; còn thiếu ca tường minh cho khách vãng lai và giữ giỏ khi đăng nhập |
| Tài khoản quản lý khi mua | UC-16..22; users.role | Đã chốt 14/10/2026: STAFF/ADMIN dùng CUSTOMER riêng khi mua; quy trình tạo/đổi vai trò vẫn cần rà soát riêng |

## 2. Điểm khác nhau giữa ERD mục tiêu và mã hiện tại

- ERD 07 vẽ sessions có user_id/auth_version/data_json; schema phiên thực tế dùng sid/data/expires_at và lưu thông tin user/phiên trong JSON. Hai cách đều biểu diễn phiên, nhưng tài liệu phải ghi rõ cách nào là schema thực tế.
- ERD có carts/cart_items riêng; giỏ hiện được lưu trong phiên. Đã chốt 14/10/2026: giỏ CUSTOMER lưu theo tài khoản, đăng xuất không mất giỏ, đăng nhập lại thấy giỏ cũ và kiểm tra giá/tồn trước đặt. Đây là yêu cầu cần điều chỉnh mã, không phải chức năng đã nghiệm thu; xóa phiên không được xóa giỏ tài khoản.
- users.password_hash ở ERD là tên mục tiêu; mã hiện dùng cột password để lưu giá trị băm, không có nghĩa đang lưu mật khẩu rõ. Cần lập bảng ánh xạ khi hoàn thiện từ điển dữ liệu.
- Tài liệu ERD vẫn có giới thiệu schema v9/v2; báo cáo rà soát 17 ghi mã có migration v11/v4. Không tự sửa ERD theo tên cột mới mà chưa quyết định giữ thiết kế mục tiêu hay mô tả schema thực tế.

## 3. Tiêu chí cần bổ sung khi rà soát nghiệm thu

Các ca dưới đây là đề xuất, chưa được chạy trong bước tài liệu này. Dùng mã AC-ACC để không trùng AT-01..34 hiện hữu.

| Mã | Thao tác | Kết quả mong đợi |
|---|---|---|
| AC-ACC-01 | Khách vãng lai xem, thêm/sửa/xóa giỏ | Được phép; chưa tạo đơn hoặc giữ kho |
| AC-ACC-02 | Khách vãng lai gửi xác nhận đặt hàng trực tiếp | Không tạo đơn; yêu cầu đăng nhập |
| AC-ACC-03 | Khách đăng nhập sau khi chuẩn bị giỏ | Đã chốt: gộp giỏ tài khoản một lần, cùng SKU cộng số lượng; vượt tồn/giới hạn báo điều chỉnh; tải trang không cộng lại; kiểm tra giá/tồn trước đặt |
| AC-ACC-04 | CUSTOMER/STAFF gọi API sửa giá hoặc cấp vai trò | Không thay đổi dữ liệu; từ chối theo quyền |
| AC-ACC-05 | Đổi mật khẩu với mật khẩu hiện tại sai | Không đổi mật khẩu hoặc vô hiệu phiên do thao tác thất bại |
| AC-ACC-06 | Đổi mật khẩu thành công trên một trong hai phiên | Phiên cũ không tiếp tục thao tác; đăng nhập lại bằng mật khẩu mới |
| AC-ACC-07 | Đăng nhập thành công/thất bại nhiều lần | Theo chính sách giới hạn đã chốt; không làm test lẫn lỗi giới hạn với lỗi mật khẩu |
| AC-ACC-08 | Khóa, mở khóa tài khoản đang có phiên | Khóa từ chối lần truy cập tiếp theo; mở khóa không khôi phục cookie cũ |

AC-ACC-08 về khóa/mở khóa và AC-ACC-06 về đổi mật khẩu đã được thống nhất ngày 14/10/2026. Không dùng bảng này để tuyên bố đã sửa 21 test lỗi hoặc đã chạy nghiệm thu.

## 4. Quyết định gần nhất cần chốt

Quên mật khẩu đã chốt ngày 14/10/2026: gửi liên kết email dùng một lần trong 30 phút, thông báo chung không tiết lộ tài khoản; reset thành công vô hiệu mọi phiên cũ, giữ giỏ và lịch sử đơn. Đã bổ sung UC-04-R và AT-41..43; ERD/sơ đồ còn cần cập nhật dữ liệu reset. Bước tiếp theo là đối chiếu nhóm sản phẩm và quyền tạo nháp/công bố. Chưa sửa mã hoặc nghiệm thu SMTP.

Quy tắc khóa/mở khóa đã được người dùng đồng ý ngày 14/10/2026: ADMIN khóa/mở khóa CUSTOMER hoặc STAFF và ghi lý do. Khi khóa, mọi phiên hiện có bị vô hiệu; khi mở khóa, người dùng phải đăng nhập lại. Không xóa tài khoản hoặc lịch sử đơn hàng.

Giỏ qua đăng xuất, tài khoản quản lý dùng CUSTOMER riêng, gộp giỏ một lần và đổi mật khẩu vô hiệu mọi phiên cũ đã được thống nhất ngày 14/10/2026. Bổ sung AT-36..40, chưa chạy nghiệm thu. Bước tiếp theo: rà soát quy trình quên mật khẩu. Các nhóm sản phẩm, checkout và báo cáo sẽ được đối chiếu ở bước khác.
