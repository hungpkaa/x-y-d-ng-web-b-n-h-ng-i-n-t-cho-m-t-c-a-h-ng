# CODE-06B — Đánh giá sản phẩm và kiểm duyệt

Ngày kiểm tra: 18/10/2026. Căn cứ QD-23, UC-27/28, BR-11.

## Kết luận trong phạm vi kiểm tra

Mã hiện có đáp ứng các tình huống đã kiểm tra trên SQLite. Không cần sửa mã nghiệp vụ trong bước này. Bổ sung `test/reviews-http.test.js` để kiểm tra ghép nối route, quyền, form và HTML trả về; không chỉ kiểm tra dịch vụ riêng lẻ.

## Bằng chứng

| Yêu cầu | Kiểm tra |
|---|---|
| Chủ dòng đơn đã giao | Bộ dịch vụ chặn đơn chưa giao/người khác/STAFF; HTTP chặn người khác và đường dẫn order không khớp item |
| Một đánh giá mỗi dòng đơn | Gửi lại version tạo mới bị chặn; sửa cập nhật bản cũ; form đơn chỉ còn một mục sửa |
| Sao và nhận xét hợp lệ | Dịch vụ giới hạn 1–5 sao, nhận xét không trống, tối đa 2.000 ký tự; chặn giả trường kiểm duyệt |
| Chờ duyệt trước công khai | Gửi mới không xuất hiện tại trang sản phẩm; có trong danh sách ADMIN |
| Chỉ ADMIN duyệt | STAFF bị chặn ở cả dịch vụ và HTTP; ADMIN không được sửa sao/nội dung thay khách |
| Sửa cần duyệt lại | Nội dung cũ biến mất khỏi public, nội dung mới chưa xuất hiện đến khi ADMIN duyệt lại |
| Điểm trung bình | Chỉ tính APPROVED; ca HTTP chuyển 5.0/5 thành 4.0/5 sau sửa và duyệt lại; bộ dịch vụ kiểm tra nhiều đánh giá và ẩn |
| Nội dung được escape | Chuỗi có thẻ script xuất hiện dưới dạng văn bản đã escape tại trang ADMIN và trang sản phẩm, không xuất thẻ nguyên bản |
| Ẩn không xóa lịch sử | Sau HIDDEN nội dung không còn public; bộ dịch vụ giữ bản ghi/version/audit |
| Rollback | Bộ dịch vụ hiện có kiểm tra lỗi audit không lưu dở nội dung hoặc quyết định duyệt |

Ca HTTP chuẩn bị đơn qua dịch vụ đặt đơn và vận chuyển thật trong dự án đến DELIVERED, sau đó thực hiện gửi/duyệt/sửa/ẩn bằng HTTP và đọc trang sản phẩm công khai. Không ghi trực tiếp trạng thái DELIVERED để bỏ qua luồng giao hàng.

## Kết quả và giới hạn

`node --test test/reviews.test.js test/reviews-http.test.js`: **4 ca đạt, 0 lỗi, 0 bỏ qua**. Một ca HTTP chứa toàn bộ chuỗi gửi → duyệt → sửa → duyệt lại → ẩn và các kiểm tra quyền/escape.

Chỉ thêm test và tài liệu; không chạy lại toàn bộ bộ test trong bước này. HTML đã được kiểm tra tự động qua HTTP, chưa kiểm tra bố cục hoặc thao tác bằng trình duyệt/mobile. Chưa nghiệm thu PostgreSQL. Không thay đổi cấu hình/CSDL đang sử dụng hoặc triển khai web.

## Tiếp theo

CODE-06C: hỗ trợ khách hàng theo QD-25 — ticket gắn đơn chính chủ, CUSTOMER chỉ thấy nội dung công khai, STAFF/ADMIN trả lời và ghi chú nội bộ; trạng thái mới → đang xử lý → đóng. Các đề xuất chưa chốt như mở lại sau đóng cần được phân biệt với phạm vi đã chốt.
