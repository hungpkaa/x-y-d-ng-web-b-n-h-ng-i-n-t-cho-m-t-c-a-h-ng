# CODE-01 — Đồng bộ phiên bản schema

## Thay đổi thực hiện

- `src/migrations.js` xuất CURRENT_SCHEMA_VERSION lấy từ migration cuối cùng (hiện là v11); mặc định migrate dùng hằng này.
- `src/db.js` dùng cùng hằng cho openDatabase; defaultDatabase không còn truyền số phiên bản riêng.
- Giữ tham số targetVersion để các test migration lịch sử mở v4/v5/v6/v8/v10 tường minh. Không sửa nội dung migration cũ.
- Thêm `test/completion-migration.test.js`: khởi tạo mới chạy checkout, nâng v8/v10 giữ dữ liệu và chạy lại không đổi; lỗi nâng cấp rollback để thử lại.

Không đổi checkout, giỏ, đăng nhập, giao diện, PostgreSQL migration hoặc chính sách vận chuyển. Những thay đổi trước đó trong các tệp vẫn giữ; không hoàn tác hoặc commit trong bước này. Không mở/migration CSDL sử dụng thật để thử.

## Kết quả kiểm tra

- Nhóm checkout/migration: 12/12 đạt, dùng RAM/file test riêng.
- Smoke HTTP đạt quyền STAFF/ADMIN, ảnh/thông số, catalog và luồng COD/giao hàng.
- Bộ đầy đủ: 101 ca, 83 đạt, 10 lỗi, 8 PostgreSQL bỏ qua.
- Không còn lỗi thiếu cột `shipping_quote_json` trong lượt chạy này.
- Chưa chạy bộ PostgreSQL chuyên biệt; không suy ra PostgreSQL đạt từ test SQLite.

## Lỗi còn lại và bước tiếp theo

Sau khi fixture mặc định mở schema hiện tại, 9 ca COD/đơn/SKU/thanh toán/khuyến mãi/đánh giá lộ giả định cũ: chuyển SHIPPING/DELIVERED trực tiếp bằng transitionOrder. Schema từ v9 yêu cầu vận đơn và bằng chứng; các ca nhận 409 hoặc thiếu doanh thu do chưa thực sự giao được. Cần cập nhật thiết lập test theo luồng shipments thật; không bỏ ràng buộc vận đơn hoặc hạ fixture xuống v8 để né lỗi.

Một ca HTTP tài khoản vẫn lỗi ở đăng nhập sau đổi mật khẩu; rate limit cần xác minh status/body riêng theo CODE-02. Không tuyên bố toàn bộ dự án đã ổn định.

Bước nhỏ kế tiếp: cập nhật helper/fixture giao hàng của các ca còn lại để dùng createShipment/changeShipment với mã, version và bằng chứng thử nghiệm, giữ mọi assertion nghiệp vụ; sau đó mới xử lý đăng nhập. Đây là điều chỉnh thứ tự theo lỗi phát hiện, không thêm chức năng mới.
