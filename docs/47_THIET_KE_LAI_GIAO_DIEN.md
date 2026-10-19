# Thiết kế lại giao diện theo hướng cửa hàng điện tử

Ngày: 19/10/2026. Người dùng yêu cầu làm lại giao diện toàn trang, tham khảo CellphoneS. Đã xem cấu trúc tại https://cellphones.com.vn/; giữ thương hiệu Electro Store và dữ liệu/nghiệp vụ dự án.

## Thay đổi

- `public/retail.css`: bộ giao diện chung cho các trang, breakpoint 1150/900/680/380 px, khoảng cách, màu, typography, card, form, bảng và chế độ in. Được nạp sau CSS đang có để giữ hành vi và các class đặc thù.
- Header mới: thương hiệu, menu danh mục, ô tìm kiếm lớn, giỏ/đơn/tài khoản, thanh danh mục ngang. Footer chia cột với liên kết đang hoạt động.
- Trang chủ: khối danh mục, banner minh họa thiết bị bằng CSS, hai khối khám phá so sánh/ngân sách và hàng tiện ích. Không dùng ảnh/banner, nhãn khuyến mãi hoặc cam kết dịch vụ của CellphoneS.
- Thẻ sản phẩm gọn, 5 cột desktop, 4/3/2 cột khi giảm chiều rộng; giữ giá/tồn thật từ server.
- Đồng bộ trang chi tiết, giỏ, checkout, QR, hồ sơ, địa chỉ, đăng nhập/reset, danh sách/chi tiết đơn, hội thoại hỗ trợ, thông báo và so sánh.
- Quản trị: sidebar, bảng, bộ lọc và SKU dùng cùng thiết kế; chuyển menu sang cuộn ngang trên màn hình nhỏ.

## Xác minh

Cập nhật nhóm khám phá: So sánh/Gợi ý/Đã xem (và Yêu thích dùng chung template) có `discovery-heading.ejs`, điều hướng qua lại, ảnh dự phòng bằng SVG và bộ CSS riêng. Gợi ý giữ form/tham chiếu và lý do thật; So sánh giữ bảng ngữ nghĩa, 0/false/thiếu và lọc điểm khác nhau; Đã xem không thêm thông báo còn hàng khi dữ liệu trang chưa có tồn SKU. Bộ discovery HTTP + engagement: 6 ca đạt; smoke đạt. Chưa nghiệm thu trực quan.

Cập nhật trang danh mục: thêm `category-presentation.js` và `category-landing.ejs`. Điện thoại dùng banner hồng với minh họa điện thoại, Laptop dùng banner tím với minh họa laptop; danh mục khác có bố cục bổ sung chung. Minh họa dựng bằng CSS, không giả ảnh hàng thực tế. Dải thương hiệu chỉ lấy sản phẩm ACTIVE trong danh mục đang xem; mức giá nhanh giữ nguyên danh mục/thương hiệu/từ khóa/sắp xếp và về trang đầu. Xóa bộ lọc vẫn giữ danh mục. Khoảng giá đều bao gồm hai đầu theo bộ lọc hiện tại, nên sản phẩm đúng mốc có thể xuất hiện ở hai khoảng liền nhau. Không giả số giảm giá hoặc điểm đánh giá.

Đã mở rộng HTTP để kiểm tra trang Laptop và thương hiệu trong danh mục; toàn bộ vẫn 133 đạt/0 lỗi/11 bỏ qua. Smoke đạt. Trang local trả 200 với phần landing và bộ lọc mới; chưa có nghiệm thu bằng ảnh chụp trình duyệt.

`npm.cmd test`: 144 ca, 133 đạt, 0 lỗi, 11 bỏ qua PostgreSQL. `npm.cmd run test:smoke`: đạt.

Đã thử công cụ trình duyệt: không có browser/app khả dụng trong phiên, nên chưa chụp màn hình hoặc nghiệm thu trực quan desktop/mobile. Kết quả test/HTTP không chứng minh bố cục hoàn hảo. Cần người dùng mở bản local để đánh giá; nếu có trình duyệt kết nối sẽ tiếp tục kiểm tra trực quan các kích thước và tương tác menu/form.

Gmail vẫn tạm hoãn. Không thay luật thanh toán, quyền, dữ liệu cửa hàng, thông tin nhận tiền hoặc triển khai web trong bước thiết kế.
# Bổ sung giao diện chi tiết sản phẩm và thanh toán

- Trang sản phẩm: bố cục ảnh và thông tin hai cột trên màn hình lớn, một cột trên điện thoại; hiển thị giá, tồn kho và mã của cấu hình đang chọn. Nút mua dẫn tới đúng cấu hình và biểu mẫu thêm giỏ hiện có.
- Giỏ hàng, thanh toán, chi tiết đơn có chỉ dẫn ba bước mua hàng; bước hiện tại không đồng nghĩa đã thanh toán.
- Trang thanh toán có các ô chọn COD, chuyển khoản QR BIDV và VNPay sandbox khi được cấu hình. Lựa chọn gửi lại biểu mẫu có CSRF để tạo báo giá phù hợp, giữ thông tin nhận hàng đang nhập. Khi JavaScript không hoạt động, danh sách chọn phương thức vẫn sử dụng được.
- Không thay đổi quy tắc xác nhận tiền chuyển khoản hoặc thời hạn giữ hàng.
- Kiểm tra: JavaScript hợp lệ; bộ kiểm thử 144 bài gồm 133 đạt, 11 PostgreSQL bỏ qua, không có lỗi. Chưa xác minh trực quan trên trình duyệt trong môi trường hiện tại.

