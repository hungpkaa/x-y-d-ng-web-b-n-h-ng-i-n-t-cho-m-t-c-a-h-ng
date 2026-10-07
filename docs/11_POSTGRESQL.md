# PostgreSQL trên Windows

Cập nhật: PostgreSQL migration v2 bổ sung vận chuyển thủ công tương ứng SQLite v9. Snapshot `postgres-schema.sql` giữ baseline v1/v8; migration v2 chạy tiếp sau baseline, không sửa lịch sử cũ. Xem [vận chuyển](13_SU_DUNG_VAN_CHUYEN.md) và [đối chiếu docs](12_ECARTS_ET_IMPLEMENTATION.md).

Dự án dùng PostgreSQL khi có `DATABASE_URL`. Nếu không có biến này, dự án vẫn hỗ trợ SQLite để chạy demo hoặc kiểm thử. `DB_PATH=:memory:` chủ động chọn SQLite cho các bài kiểm tra cũ.

## Cấu hình

PostgreSQL 18 đã được kiểm tra tại `localhost:5432`. Tạo database `electro_store` trong pgAdmin rồi thêm vào `.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/electro_store
DATABASE_SCHEMA=public
```

Thay mật khẩu tại máy của bạn. Nếu mật khẩu có ký tự đặc biệt, mã hóa URL các ký tự đó. Không commit `.env`. Tài khoản ứng dụng riêng nên được dùng khi triển khai thực tế; `postgres` là tài khoản quản trị dùng trong bước thiết lập local này.

```cmd
npm install
npm run db:check
```

## Chuyển dữ liệu SQLite hiện có

Dừng ứng dụng trước khi nhập dữ liệu để không phát sinh ghi mới vào SQLite sau thời điểm sao chép. PostgreSQL phải chưa có dữ liệu ứng dụng. Không chạy `npm start` trên database trống trước khi nhập, vì ứng dụng sẽ tạo dữ liệu mẫu.

```cmd
npm run db:import
```

Nguồn mặc định là `data/store.sqlite`. Có thể truyền đường dẫn khác:

```cmd
npm run db:import -- "C:\path\store.sqlite"
```

Công cụ tạo bản sao tại `data/backups/before-postgres-*.sqlite`, nâng cấp bản sao nếu cần, kiểm tra khóa ngoại, khởi tạo schema PostgreSQL rồi nhập toàn bộ dữ liệu trong một giao dịch. File SQLite gốc không bị sửa. Tài khoản và hash mật khẩu, ID, đơn hàng, lịch sử, ảnh nhị phân, phiên đăng nhập và các cấu hình đều được giữ. Số bản ghi được đối chiếu ở từng bảng; sequence được đặt lại để ID mới tiếp tục sau ID đã nhập. Nếu đích có dữ liệu, công cụ từ chối ghi đè. Nếu nhập lỗi, dữ liệu nhập rollback; schema trống đã khởi tạo có thể còn lại để thử lại.

File schema: `src/postgres-schema.sql`. Bảng `postgres_migrations` quản lý phiên bản PostgreSQL riêng, không dùng các migration SQLite để thay đổi PostgreSQL. Snapshot PostgreSQL ban đầu tương ứng schema SQLite v8; `schema_migrations` SQLite không được nhập vì đó là lịch sử DDL của engine cũ.

## Chạy ứng dụng

```cmd
npm start
```

Mở http://localhost:3000. Với `.env` có `DATABASE_URL`, sản phẩm, tài khoản, đơn hàng, thanh toán, hỗ trợ và session đều được lưu trong PostgreSQL. Database rỗng sẽ được tạo schema và dữ liệu mẫu; database đã nhập giữ dữ liệu hiện có. Có thể kiểm tra các bảng trong pgAdmin: `Databases → electro_store → Schemas → public → Tables`, nhấn Refresh sau khi nhập.

## Kiểm thử

```cmd
npm test
npm run test:smoke
npm run test:postgres
npm run test:smoke:postgres
```

Hai lệnh đầu chạy bộ kiểm tra SQLite hiện có. Hai lệnh PostgreSQL dùng kết nối `.env`, tạo các schema tên `test_pg_*`, `test_import_*`, `test_smoke_*`, rồi xóa đúng schema đã tạo; không thay đổi bảng ứng dụng trong `public`. Tài khoản kiểm thử cần quyền tạo schema. Bao gồm checkout retry, IPN trùng, giao hàng và báo cáo, callback muộn/hoàn tiền, giới hạn khuyến mãi, duyệt đánh giá, ẩn tin hỗ trợ nội bộ, rate limit/reset mật khẩu, rollback, bytea, nhập dữ liệu và hai kết nối tranh SKU cuối. Smoke HTTP kiểm tra quyền STAFF/ADMIN, ảnh, thông số, phân trang và đơn COD.

## Giới hạn hiện tại

Các service hiện có giữ API đồng bộ. `src/postgres.js` dùng worker riêng sở hữu một kết nối `pg`, rồi chờ kết quả đồng bộ trên luồng ứng dụng. Cách này giữ các giao dịch nghiệp vụ trong cùng kết nối và giúp chuyển engine mà giữ luồng xử lý hiện có, nhưng một tiến trình Node vẫn xử lý truy vấn tuần tự và bị chặn khi chờ database. Đây chưa phải thiết kế pool bất đồng bộ cho lưu lượng lớn.

Giao dịch ghi lấy PostgreSQL advisory lock chung để giữ hợp đồng một writer của các nghiệp vụ tồn kho/khuyến mãi/thanh toán. Các tiến trình ứng dụng dùng cùng khóa; công cụ hoặc câu SQL bên ngoài phải tự tuân thủ quy tắc nghiệp vụ. Báo cáo dùng snapshot `REPEATABLE READ READ ONLY`. Truy vấn có timeout 10 giây, cầu nối chờ tối đa 20 giây; kết quả một truy vấn tối đa 16 MiB. Giới hạn bytea tương thích ảnh ứng dụng tối đa 5 MiB.

Timestamp nghiệp vụ tiếp tục dùng TEXT UTC dạng `YYYY-MM-DD HH:mm:ss` để giữ nguyên dữ liệu cũ và logic báo cáo; số tiền/ID/thời gian epoch dùng BIGINT, ảnh dùng BYTEA. Lớp chuyển cú pháp hỗ trợ các truy vấn hiện có, không phải trình chuyển SQL tổng quát. Khi mở rộng tải lớn, bước tiếp theo là đổi service sang async/await, connection pool và khóa theo từng tài nguyên.

## Quay lại SQLite

Dừng ứng dụng, bỏ hoặc comment `DATABASE_URL` trong `.env`, rồi chạy lại. Ứng dụng sẽ mở `data/store.sqlite` còn nguyên. Các thay đổi phát sinh trên PostgreSQL sau khi chuyển không tự đồng bộ ngược sang SQLite.
