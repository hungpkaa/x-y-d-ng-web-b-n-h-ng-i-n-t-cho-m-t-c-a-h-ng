# CODE-03A — Dữ liệu và dịch vụ giỏ tài khoản

## Truy vết tài liệu

- QD-04, UC-03/16, AT-35: giỏ tài khoản độc lập phiên; logout/đổi/reset mật khẩu không được xóa giỏ; trước đặt kiểm tra giá/tồn.
- QD-02: tài khoản quản lý không dùng giỏ mua cá nhân.
- ERD 07/21: carts thuộc CUSTOMER, cart_items UNIQUE(cart_id,variant_id), version chống ghi đè.
- QD-05 và AT-36..38 về gộp một lần thuộc CODE-03B, chưa thực hiện.

## Đã thực hiện

- SQLite migration v12 và PostgreSQL migration v5 tạo carts/cart_items; giỏ độc lập sessions, không tự chuyển dữ liệu session cũ hoặc tạo cart_merges trong lượt này.
- `src/account-cart.js`: readCart/updateCart kiểm tra CUSTOMER ACTIVE và phiên bản xác thực nếu actor cung cấp; chủ giỏ lấy từ actor, không nhận user_id/cart_id hoặc giá do biểu mẫu gửi.
- Lưu SKU/số lượng; tính giá/tồn từ dữ liệu hiện tại khi đọc. SKU ẩn/không bán vẫn giữ dòng để khách xóa, không trả chi tiết mới của hàng ẩn như catalog công khai.
- Cập nhật nguyên tử, version chống ghi đè, số lượng 1–99 và tối đa 100 dòng. Set 0 xóa; vượt tồn/giới hạn không âm thầm cắt lượng. Không tạo reservation/movement hoặc đơn khi sửa giỏ.
- SQL tạo bảng riêng cho hai dialect; không sửa migration đã áp dụng trước đó.

## Kiểm tra

- 9 test giỏ/migration liên quan đạt, gồm quyền, giá/tồn đổi, hàng bị ẩn, version cũ, rollback, xóa phiên/mở lại file, nâng v11 giữ session cũ.
- Bộ đầy đủ: 108 ca, 99 đạt, 0 lỗi, 9 PostgreSQL bỏ qua.
- Có ca PostgreSQL mới cho giỏ/quyền/phiên/kho; chưa chạy kết nối PostgreSQL trong lượt này. SQL/migration PostgreSQL chưa được coi là nghiệm thu thật.
- Test xóa phiên/tăng auth_version mô phỏng tác động lưu trữ; chưa phải nghiệm thu HTTP logout/reset/checkout của giỏ tài khoản.

## Giới hạn và bước gần nhất

Website vẫn đọc/ghi giỏ trong session; dịch vụ mới chưa được gọi từ route. Vì vậy không tuyên bố khách dùng giao diện hiện tại đã giữ được giỏ qua logout. Chưa sửa login/cart/checkout views, chưa gộp giỏ, chưa backfill session cũ, chưa sửa CSDL vận hành.

Bước tiếp theo CODE-03A phần ghép route: CUSTOMER đọc/ghi bằng dịch vụ tài khoản, vãng lai dùng session; logout không mang giỏ tài khoản sang vãng lai; checkout nhận giỏ chủ tài khoản và chỉ bỏ các mục đã mua sau thành công. Phải có test HTTP AT-35 trước tuyên bố hoàn thành. Quy tắc gộp/di chuyển giỏ vãng lai và session cũ cần làm nhất quán trong CODE-03B, không được tự bỏ giỏ cũ khi đổi luồng.
