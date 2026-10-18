# CODE-03A ghép route và CODE-03B gộp giỏ

Ngày: 16/10/2026. Hoàn thiện phần tiếp theo của [CODE-03A dữ liệu/dịch vụ](33_CODE_03A_DU_LIEU_VA_DICH_VU_GIO.md); không viết lại website.

## 1. Căn cứ và phạm vi

| Yêu cầu | Thực hiện / bằng chứng |
|---|---|
| QD-04, UC-03/16, AT-35: giỏ tài khoản không mất qua logout | Route giỏ đọc/ghi carts/cart_items; HTTP logout/login và đổi mật khẩu giữ giỏ |
| QD-05, UC-02/16, AT-36/37: gộp một lần | cart_merges lưu source_key UNIQUE và hash nội dung; gộp/ghi dấu cùng transaction; retry/restart không cộng lại |
| AT-38: vượt tồn/giới hạn báo điều chỉnh | Giữ số lượng mong muốn; dòng vượt 99 hoặc vượt 100 dòng lưu phần đóng góp chờ trong pending_json, không âm thầm bỏ; chặn checkout tới khi sửa/xóa |
| QD-03: vãng lai được dùng giỏ, phải login trước đặt | Giỏ vãng lai vẫn session; sau đăng nhập CUSTOMER gộp vào tài khoản; quản lý dùng tài khoản riêng |
| QD-15: giỏ không giữ hàng | Giữ hàng chỉ ở giao dịch đặt; gộp/cập nhật giỏ không tạo reservation hoặc movement |
| UC-18: chống trùng và giữ snapshot | submitAccountCheckout lấy giỏ mới nhất, dùng logic kiểm tra báo giá cũ và xóa mục đã mua trong cùng transaction; replay không xóa hàng thêm sau đó |

Phần gộp được nối cùng route để chuyển sang giỏ tài khoản không làm mất giỏ vãng lai hoặc session SKU v2 cũ đang hợp lệ. Các chức năng khác không được mở rộng.

## 2. Thay đổi kỹ thuật

- SQLite v13 / PostgreSQL v6 bổ sung cart_merges. Chưa chạy migration trên CSDL người dùng đang sử dụng trong lượt này.
- carts/cart_items vẫn là giỏ chính theo tài khoản. Session CUSTOMER không còn là nguồn giỏ chính; session vãng lai vẫn giữ dữ liệu trước đăng nhập.
- Login gộp nguồn một lần trước đổi ID phiên; nguồn trùng nhưng khác chủ/nội dung bị từ chối. Session CUSTOMER v2 hợp lệ trước nâng cấp được nhập khi truy cập, rồi bỏ bản session sau thành công.
- pending_json lưu lượng nguồn chưa thể đưa vào cart_items do giới hạn, gồm cả SKU đã không còn tồn tại. Giao diện hiển thị lượng mong muốn; set số lượng hợp lệ hoặc 0 sẽ giải quyết phần chờ. Không nới CHECK 1–99 của cart_items để chứa lượng vượt.
- Đơn và xóa mục đã mua được commit/rollback chung; dùng lại request đã tạo đơn không xóa giỏ hiện tại. Nhánh lỗi/đổi giá không làm mất giỏ.
- Form sửa giỏ có cart_version; bản cũ nhận phản hồi yêu cầu tải lại. POST cũ không gửi version được hỗ trợ bằng phiên bản đọc tại request; form thêm SKU cộng vào dữ liệu mới nhất và vẫn kiểm tra version trong transaction.
- Template giỏ tách sang views/cart.ejs, dùng giá/tồn hiện tại và thông báo thiếu hàng/đang chờ chỉnh. SKU ẩn không hiển thị thông tin mới như catalog công khai, nhưng dòng có thể xóa.

Các tên cột thực tế cart_merges.source_hash/pending_json là ánh xạ triển khai cho thiết kế dấu nguồn/kết quả gộp ở ERD 21; không tuyên bố schema thực tế trùng từng tên cột mục tiêu.

## 3. Kiểm thử

- HTTP: giỏ vãng lai sang tài khoản, reload không cộng lại, logout/login giữ giỏ, tài khoản khác không thấy giỏ, hai phiên không ghi đè form cũ, checkout replay không xóa hàng mới, nhập session cũ hợp lệ và đổi mật khẩu giữ giỏ.
- Dịch vụ: gộp lại sau mở lại file CSDL; đổi nội dung/chủ nguồn bị chặn; vượt 99/vượt 100 dòng/vượt tồn không mất yêu cầu; SKU đã xóa vẫn có thể loại bỏ.
- Lỗi giữa gộp/ghi dấu và lỗi xóa giỏ sau tạo đơn đều rollback dữ liệu; đổi giá sau báo giá chặn đặt và giữ giỏ.
- Smoke HTTP catalog/quyền/COD/giao hàng đã đạt.
- Có thêm test PostgreSQL cho gộp và checkout tài khoản, nhưng chưa chạy kết nối PostgreSQL. Không coi test SQLite là nghiệm thu PostgreSQL.

## 4. Giới hạn

- Chưa kiểm tra giao diện trực quan trong browser/mobile; HTTP đã render template nhưng không xác nhận bố cục.
- Chưa thử stress nhiều tiến trình hoặc đồng thời sửa cùng session vãng lai; chống gộp lặp dựa khóa nguồn bền, optimistic version cho tài khoản và transaction CSDL. Không coi toàn bộ ca concurrency đã nghiệm thu chỉ từ test replay.
- Tương thích tự nhập áp dụng session SKU v2 hợp lệ, chưa cam kết khôi phục phiên đã hết hạn/bị xóa hoặc giỏ trước định dạng SKU. Không quét/gộp mọi session khách trong CSDL một cách âm thầm.
- Ghi nhận reset giữ giỏ ở mức thiết kế lưu trữ và test reset hiện hữu; HTTP lượt mới kiểm tra đổi mật khẩu, chưa thêm ca SMTP reset toàn luồng với giỏ.

## 5. Bước tiếp theo

Kiểm tra PostgreSQL bằng schema tạm khi có cấu hình, sau đó CODE-04: bảo đảm luồng chính dùng phí cố định theo QD-21/UC-17/BR-15. Không thêm vùng/trọng lượng bắt buộc hoặc đổi nghiệp vụ khuyến mãi trong bước giỏ này.
