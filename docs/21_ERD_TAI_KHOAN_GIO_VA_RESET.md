# Rà soát ERD tài khoản, phiên, giỏ và reset

Ngày 14/10/2026. Thiết kế mục tiêu theo QD-03..08 và quyết định gộp giỏ; chưa tạo migration hoặc sửa mã.

## Dữ liệu chính

| Bảng | Trách nhiệm | Quan hệ |
|---|---|---|
| users | Danh tính, mật khẩu băm, vai trò, khóa và phiên bản xác thực | Một user có nhiều phiên/địa chỉ/reset token; CUSTOMER có tối đa một giỏ |
| sessions | Phiên đăng nhập hoặc vãng lai, hạn dùng, CSRF và giỏ vãng lai | user_id nullable; xóa phiên không xóa giỏ tài khoản |
| carts | Giỏ lâu dài theo tài khoản CUSTOMER | user_id UNIQUE |
| cart_items | SKU và số lượng, không giữ kho hoặc chốt giá mua | UNIQUE(cart_id,variant_id) |
| cart_merges | Thiết kế dấu gộp một lần cùng snapshot/kết quả nguồn | source_key UNIQUE; thuộc giỏ nhận |
| password_reset_tokens | Hash token dùng một lần, hạn 30 phút, dấu đã dùng | Thuộc user; token_hash UNIQUE |

Nguồn Mermaid và từ điển đã cập nhật ở mục 1/5 của [ERD chung](07_ERD_VA_TU_DIEN_DU_LIEU.md). Các tên bảng/cột là lựa chọn thiết kế; không đòi hỏi người dùng phê duyệt từng tên.

## Ràng buộc cần giữ

- Khóa hoặc đổi/reset mật khẩu vô hiệu mọi phiên cũ; mở khóa không phục hồi phiên cũ.
- Giỏ tài khoản tồn tại độc lập với phiên; logout không mang giỏ tài khoản sang trạng thái vãng lai cho người dùng tiếp theo.
- Gộp giỏ và ghi dấu xử lý nguyên tử; khi đổi ID phiên sau đăng nhập vẫn phải giữ được dấu giỏ nguồn.
- Không lộ giỏ, token hoặc thông tin tài khoản khác. STAFF/ADMIN không có giỏ mua bằng vai trò quản lý.
- Giá/tồn luôn kiểm tra lại trước đặt, không được coi số lượng trong giỏ là hàng đã giữ.
- Nếu tổng lượng vượt giới hạn 99 của cart_items, snapshot/kết quả gộp phải giữ yêu cầu điều chỉnh; không âm thầm cắt số lượng. Cách hiển thị/xử lý phần vượt là thiết kế còn cần hoàn thiện, không tuyên bố đã giải quyết trong mã.

## Ánh xạ với mã hiện tại

| Mục tiêu | Mã hiện tại / khoảng cách |
|---|---|
| users.password_hash | Cột password lưu giá trị băm; không phải mật khẩu rõ |
| sessions.user_id/auth_version/data_json | Thông tin người dùng/phiên nằm trong JSON data của session store |
| carts/cart_items/cart_merges | Cần bổ sung hoặc đổi cơ chế lưu giỏ trong phiên; chưa triển khai trong bước này |
| password_reset_tokens | Mã đã có reset; cần đối chiếu chi tiết schema khi chuẩn bị migration, không sao chép tên bảng mục tiêu làm bằng chứng đã có |

Không chạy lại test hoặc render Mermaid ở bước này. Rà soát nguồn/quan hệ không thay thế kiểm tra hình xuất cuối. Bước tiếp theo: ERD danh mục, thương hiệu, sản phẩm, SKU và thông số.
