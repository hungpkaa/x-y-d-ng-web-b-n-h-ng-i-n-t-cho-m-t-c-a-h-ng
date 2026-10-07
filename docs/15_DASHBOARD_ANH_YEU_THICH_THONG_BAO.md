# Bổ sung hướng phát triển 3, 4, 5, 6

Cập nhật 07/10/2026. Schema ứng dụng: SQLite v10, PostgreSQL v3. Đây là các chức năng mở rộng ngoài danh mục 34 UC ban đầu; quyền giá, công bố, thanh toán và vận chuyển vẫn theo tài liệu phân quyền.

## 3. Điều hướng quản trị và dashboard

Đăng nhập STAFF hoặc ADMIN, chọn **Quản lý** để mở `/admin/dashboard`. Sidebar dẫn đến sản phẩm/ảnh, đơn hàng, vận chuyển và hỗ trợ. ADMIN có thêm các mục tài khoản, catalog, thông số, khuyến mãi, kiểm duyệt, phí giao, hoàn tiền, báo cáo và nhật ký.

Dashboard hiển thị số sản phẩm, bản nháp, đơn chờ xử lý/chuẩn bị/giao, SKU tồn khả dụng không quá 5, hỗ trợ đang mở và các đơn gần nhất. Chỉ ADMIN thấy các số tiền báo cáo tháng hiện tại. CUSTOMER không được truy cập dashboard.

## 4. Nhập và sắp xếp ảnh

Chọn **Sản phẩm & ảnh → Thêm sản phẩm**. Có thể chọn ảnh ngay khi tạo bản nháp. Ở trang chỉnh sửa, chọn hoặc kéo một tệp vào vùng tải ảnh để xem trước; hỗ trợ JPEG, PNG, WebP tĩnh tối đa 5MB, tối đa 10 ảnh mỗi sản phẩm. Server giải mã và chuyển ảnh thành WebP.

Kéo thẻ ảnh để đổi thứ tự hoặc dùng nút Lên/Xuống/Đặt làm ảnh đại diện, sau đó bấm **Lưu thứ tự / ảnh đại diện**. Ảnh đầu tiên là ảnh đại diện trên catalog. Danh sách lưu phải chứa đầy đủ ảnh của đúng sản phẩm; phiên bản cũ bị từ chối để tránh ghi đè chỉnh sửa đồng thời. Thay đổi được ghi audit và rollback nếu ghi nhật ký thất bại.

Nếu bản nháp đã tạo nhưng tải ảnh lỗi, form cho thử lại ảnh và có liên kết mở sản phẩm đã tạo. JavaScript cần được bật cho tải tệp/xem trước/kéo thả.

## 5. Yêu thích và đã xem

CUSTOMER ACTIVE bấm **Lưu yêu thích** trên chi tiết sản phẩm; danh sách ở `/favorites`, có phân trang và bỏ yêu thích, tối đa 200 sản phẩm/tài khoản. Thêm lặp không tạo bản ghi trùng. Sản phẩm chưa công bố không xuất hiện trong danh sách khách.

`/recent` hiển thị tối đa 20 sản phẩm đã xem, mới nhất trước. Khách vãng lai lưu theo phiên; khách đăng nhập lưu theo tài khoản và được chuyển lịch sử phiên vào tài khoản khi đăng nhập. Có nút xóa lịch sử. Dữ liệu từng khách được tách riêng.

## 6. Thông báo trong website

CUSTOMER ACTIVE mở tùy chọn theo dõi tại từng SKU, bật **Có hàng trở lại** hoặc **Giá giảm**. Theo dõi đúng cấu hình, không lấy giá của SKU khác. Trang `/notifications` hiển thị thông báo, các SKU đang theo dõi, nút tắt theo dõi, đánh dấu đọc và cài đặt bật/tắt thông báo tiến trình đơn.

Ứng dụng quét khi khởi động, mỗi 30 giây và khi mở trang thông báo. Cursor lịch sử đơn, trạng thái SKU đã quan sát và khóa sự kiện duy nhất được lưu trong database để chống trùng qua restart. Chỉ khách ACTIVE nhận thông báo mới; khách chỉ đọc và đánh dấu thông báo của mình. Cài đặt đơn dùng version để chặn ghi đè đồng thời.

Đây là thông báo **trong website**, chưa gửi email hoặc push trình duyệt. Có hàng/giá giảm được phát hiện bằng so sánh giữa các lần quét, nên thay đổi rất ngắn rồi trở về trạng thái cũ giữa hai lần quét có thể không được ghi nhận. Nếu cần bảo đảm mọi sự kiện và gửi email, bước tiếp theo là outbox/jobs bền. Tắt rồi bật lại thông báo đơn chỉ theo dõi các thay đổi sau khi lưu cài đặt.

## Kiểm tra và sử dụng

- `npm test`: 87 ca đạt, 8 ca PostgreSQL được bỏ qua trong lệnh này.
- `npm run test:postgres`: 8 ca PostgreSQL đạt trong schema thử nghiệm riêng.
- `npm run test:smoke` và `npm run test:smoke:postgres`: đạt; kiểm tra HTTP quyền, dashboard, ảnh, yêu thích, đã xem và chuyển lịch sử khi đăng nhập, cùng các luồng cũ.
- Đã sao lưu database trước nâng cấp PostgreSQL v3; sau nâng cấp vẫn có 3 tài khoản và 2 đơn hiện có.

Chưa kiểm tra trực tiếp thao tác kéo thả/xem trước trên trình duyệt desktop/mobile; HTTP và domain tests không thay thế nghiệm thu giao diện. SMTP và merchant VNPay thật không nằm trong kiểm tra lần này.

Khởi động lại server bằng `npm start`, tải lại trình duyệt bằng Ctrl+F5 để nhận CSS/JavaScript mới. Nếu dùng PowerShell chặn `npm.ps1`, dùng `npm.cmd start`.
