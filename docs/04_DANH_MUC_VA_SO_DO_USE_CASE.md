# Danh mục và sơ đồ use case

Phiên bản 1.0 — 05/10/2026. Mã UC dùng thống nhất trong [đặc tả](05_DAC_TA_USE_CASE.md), [luồng](06_QUY_TAC_VA_SO_DO_LUONG.md), [ERD](07_ERD_VA_TU_DIEN_DU_LIEU.md) và [nghiệm thu](08_TRUY_VET_VA_NGHIEM_THU.md).

## Danh mục

Ký hiệu: K = CUSTOMER; V = vãng lai; N = STAFF; Q = ADMIN; T = cổng thanh toán; G = đơn vị vận chuyển. V/N/Q đều được xem catalog công khai. Các thao tác tài khoản chung chỉ thực hiện với phiên/tài khoản phù hợp.

| Mã | Use case | Tác nhân |
|---|---|---|
| UC-01 | Đăng ký | V |
| UC-02 | Đăng nhập | V, K, N, Q khi chưa có phiên |
| UC-03 | Đăng xuất | K, N, Q |
| UC-04 | Cập nhật hồ sơ/mật khẩu | K, N, Q |
| UC-05 | Quản lý tài khoản khách/nhân viên | Q |
| UC-06 | Duyệt, tìm kiếm, lọc, sắp xếp sản phẩm | V, K, N, Q |
| UC-07 | Xem chi tiết sản phẩm | V, K, N, Q |
| UC-08 | Tạo bản nháp sản phẩm/SKU | N, Q |
| UC-09 | Cập nhật thông tin, ảnh, SKU, thông số | N, Q |
| UC-10 | Thiết lập/sửa giá SKU | Q |
| UC-11 | Điều chỉnh tồn kho | N, Q |
| UC-12 | Công bố/ẩn sản phẩm và SKU | Q |
| UC-13 | Quản lý danh mục, thương hiệu, định nghĩa thuộc tính | Q |
| UC-14 | So sánh sản phẩm | V, K, N, Q |
| UC-15 | Xem sản phẩm gợi ý | V, K, N, Q |
| UC-16 | Quản lý giỏ hàng | V, K |
| UC-17 | Xem báo giá checkout/áp mã giảm giá | K |
| UC-18 | Xác nhận đặt hàng | K |
| UC-19 | Xem đơn cá nhân và lịch sử | K |
| UC-20 | Hủy đơn cá nhân | K |
| UC-21 | Tra cứu/xử lý đơn toàn cửa hàng | N, Q |
| UC-22 | Thanh toán trực tuyến/thử lại | K; T hỗ trợ |
| UC-23 | Tiếp nhận kết quả thanh toán | T |
| UC-24 | Xác nhận thu COD | Q |
| UC-25 | Tạo vận đơn | N, Q; G hỗ trợ |
| UC-26 | Cập nhật kết quả vận chuyển | G; N, Q trong chế độ thủ công |
| UC-27 | Gửi/sửa đánh giá đã mua | K |
| UC-28 | Kiểm duyệt đánh giá | Q |
| UC-29 | Quản lý khuyến mãi | Q |
| UC-30 | Gửi/xem yêu cầu hỗ trợ | K |
| UC-31 | Xử lý yêu cầu hỗ trợ | N, Q |
| UC-32 | Xem báo cáo và xuất dữ liệu | Q |
| UC-33 | Xem nhật ký quản trị | Q |
| UC-34 | Ghi nhận hoàn tiền thủ công | Q |

## Các sơ đồ UML

| Sơ đồ | Nguồn |
|---|---|
| Tổng quát đủ 5 tác nhân | [00_tong_quat.puml](diagrams/00_tong_quat.puml) |
| Khách hàng, gồm vãng lai/đã đăng nhập | [01_khach_hang.puml](diagrams/01_khach_hang.puml) |
| Nhân viên | [02_nhan_vien.puml](diagrams/02_nhan_vien.puml) |
| Quản trị viên | [03_quan_tri.puml](diagrams/03_quan_tri.puml) |
| Cổng thanh toán | [04_cong_thanh_toan.puml](diagrams/04_cong_thanh_toan.puml) |
| Đơn vị vận chuyển | [05_van_chuyen.puml](diagrams/05_van_chuyen.puml) |

Biên hệ thống là Electro Store. Đường nối tác nhân/use case biểu thị tham gia, không phải thứ tự thời gian. ADMIN được nối trực tiếp với các use case có quyền; không dùng kế thừa STAFF vì có thể gây hiểu rằng ADMIN được mua hàng bằng tài khoản quản trị.

## Quan hệ use case

- UC-17 **include** kiểm tra giỏ và tính báo giá: luôn xảy ra khi mở checkout.
- UC-18 **include** kiểm tra giỏ và tính báo giá, giữ tồn và lưu đơn: luôn xảy ra khi xác nhận; server tính lại, không dùng giá trình duyệt.
- Áp mã giảm giá **extend** UC-17 tại điểm tính báo giá, điều kiện khách nhập mã. Không bắt buộc đơn nào cũng có mã.
- UC-22 không include UC-18: đơn được tạo trước, thanh toán có thể thất bại/thử lại. Quan hệ trước/sau nằm ở sơ đồ luồng.
- UC-23 không include UC-26: kết quả thanh toán không đồng nghĩa giao hàng. Hai callback độc lập.
- UC-27 không extend UC-07: đánh giá có mục tiêu riêng và điều kiện đã nhận hàng, không phải bước tùy chọn của mọi lần xem sản phẩm.
- Đăng nhập là tiền điều kiện với các use case bảo vệ; không vẽ include đăng nhập vào mọi thao tác.
- Thêm/sửa/ẩn không include lẫn nhau. Sơ đồ tổng quát nhóm các chức năng để dễ đọc; sơ đồ từng tác nhân dùng mã UC chi tiết.
