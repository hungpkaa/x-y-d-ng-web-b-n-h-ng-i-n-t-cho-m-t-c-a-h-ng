# Đặc tả quản lý sản phẩm và lộ trình

> Tài liệu ghi nhận bản mã nguồn và lộ trình trước khi hoàn thiện phân tích. Đặc tả **mục tiêu** hiện dùng [05_DAC_TA_USE_CASE.md](05_DAC_TA_USE_CASE.md), đặc biệt UC-08..13. Trong mục tiêu STAFF tạo DRAFT không giá; bản code hiện tại vẫn chỉ ADMIN tạo sản phẩm có giá. Danh mục UC-P01/P02 ở đây là mã lịch sử, được thay bằng UC-08/09/10 ở bộ mới.

Ngày cập nhật: 05/10/2026. Quyền chỉ ADMIN sửa giá kế thừa quyết định tại tài liệu 01. Các thiết kế mở rộng dưới đây là đề xuất, chưa phải chức năng đã triển khai.

## UC-P01: Tạo sản phẩm

- Tác nhân bản hiện tại: ADMIN đã đăng nhập.
- Luồng chính: nhập tên, danh mục, thương hiệu, mô tả, giá và tồn; server kiểm tra quyền và dữ liệu; lưu sản phẩm; thông báo thành công.
- Giá là số nguyên VND từ 1 đến 1.000.000.000; tồn nguyên từ 0 đến 1.000.000; tên/danh mục/thương hiệu 1–120 ký tự; mô tả 1–2000 ký tự.
- Lỗi: CSRF sai hoặc STAFF/CUSTOMER gửi yêu cầu bị từ chối; dữ liệu sai không tạo sản phẩm.
- Nghiệm thu: ADMIN tạo được; STAFF không thể tự thiết lập giá bằng HTTP.
- Tạm thời ADMIN tạo sản phẩm do schema hiện bắt buộc có giá. Luồng STAFF tạo bản nháp để ADMIN duyệt giá cần bổ sung cùng trạng thái sản phẩm ở bước SKU.

## UC-P02: Cập nhật sản phẩm

- Tác nhân: STAFF hoặc ADMIN; sản phẩm phải tồn tại.
- STAFF sửa tên, danh mục, thương hiệu, mô tả và tồn. Không gửi giá hoặc gửi đúng giá đang có; giá khác bị trả 403, không cập nhật bất cứ trường nào.
- ADMIN sửa được các trường trên và giá. ID không hợp lệ bị từ chối; ID không tồn tại trả 404.
- SQL cập nhật của STAFF không chứa cột giá, tránh ghi đè giá bằng dữ liệu cũ.
- Nghiệm thu: giả mạo trường giá bị chặn; cập nhật tồn vẫn hoạt động; giá đơn đã mua không đổi khi giá sản phẩm đổi.

## Các bước tiếp theo và điều kiện hoàn thành

| Bước | Công việc | Tiêu chí |
|---|---|---|
| 1 | Phân quyền giá | Backend chặn STAFF sửa giá; giao diện phù hợp; kiểm thử đạt |
| 2 | Hoàn thiện đặc tả toàn hệ thống và ERD | Use case có luồng lỗi, quyền, nghiệm thu; chốt hủy đơn, phí ship và tích hợp |
| 3 | Danh mục/thương hiệu, sản phẩm/SKU | Mỗi biến thể có mã unique, giá/tồn riêng; migration bảo toàn đơn cũ |
| 4 | Tài khoản và đơn | Khóa tài khoản vô hiệu hóa phiên cũ; quản lý nhân viên; hủy đúng quyền; phân trang |
| 5 | So sánh, gợi ý, khuyến mãi, đánh giá, báo cáo | So sánh cùng loại; giảm giá do server tính; đánh giá sau giao; doanh thu loại đơn hủy |
| 6 | Thanh toán/vận chuyển, triển khai | Callback xác thực và chống lặp; mã vận đơn; persistent session; backup/restore; HTTPS |

## Các quyết định còn cần thống nhất

1. STAFF tạo bản nháp hay chỉ ADMIN tạo sản phẩm; thời điểm công bố sau duyệt giá.
2. Khách được hủy ở PENDING hay cả CONFIRMED; phí giao hàng và địa bàn phục vụ.
3. Cổng thanh toán sandbox, cách vận chuyển tự động hoặc thủ công.
4. Quyền mua hàng của STAFF/ADMIN, giới hạn khuyến mãi và quy tắc đánh giá.

Tiếp tục đặc tả tài khoản, giỏ hàng, đặt hàng và tích hợp trước khi coi bước 2 hoàn tất.
