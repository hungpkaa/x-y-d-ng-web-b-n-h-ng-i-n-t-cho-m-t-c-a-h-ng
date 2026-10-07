# Vận chuyển thủ công — UC-25/26

1. Đăng nhập STAFF hoặc ADMIN, vào **Xử lý đơn hàng**, mở đơn.
2. Xác nhận đơn rồi chuyển sang **Đang chuẩn bị**. ONLINE phải đã PAID.
3. Ở mục **Vận chuyển**, nhập hãng, mã vận đơn thực tế, thời điểm giờ Việt Nam, mã bằng chứng/biên bản và ghi chú.
4. Khi bàn giao thực tế, chọn **Đang vận chuyển** và nhập bằng chứng. Hệ thống xuất kho và tiêu thụ giữ hàng/lượt mã tại bước này, không phải lúc tạo mã vận đơn.
5. Giao thành công chọn **Giao thành công**. COD vẫn **Chưa thu tiền** cho đến khi ADMIN ghi nhận chứng từ đối soát đủ tiền.
6. Giao thất bại chọn **Giao thất bại, chờ xử lý**. Đơn vẫn **Đang giao**, kho chưa được cộng. Có thể ghi nhận giao lại hoặc nhận hàng về.
7. Chỉ khi đã nhận hàng thực về, chọn **Đã nhận hàng về** và nhập biên bản kho. Hệ thống cộng đúng một lần và chuyển đơn **Giao thất bại, đã nhận lại hàng**. Nếu đã thu tiền, ADMIN xử lý tại **Ghi nhận hoàn tiền**.

Trang tổng hợp: `/admin/shipments`. Khách xem mã hãng/mã vận đơn/trạng thái trên đơn của mình, không thấy bằng chứng hoặc ghi chú nội bộ. Mỗi đơn một vận đơn; mã duy nhất theo hãng. Không sửa trạng thái SHIPPING/DELIVERED ở form trạng thái đơn để vượt quy trình vận chuyển.

Khi hủy đơn trước bàn giao, vận đơn thủ công được đánh dấu đã hủy ở cửa hàng. Nhân viên phải hủy với hãng và kiểm tra xác nhận; ứng dụng chưa gọi API hãng. Đơn cũ đang SHIPPING mà chưa có vận đơn có thể nhập mã thật để bổ sung hồ sơ, không trừ kho lần nữa.

Khởi động lại ứng dụng để tự chạy SQLite v9 hoặc PostgreSQL v2. Đã có bản PostgreSQL `.dump` trước nâng cấp tại `data/backups`. Tự sao lưu thêm bằng `npm run db:backup`. Không có thay đổi snapshot địa chỉ, tiền hoặc giá trên đơn cũ.
