# Kế hoạch triển khai từng bước

Căn cứ nghiệp vụ: [25 quyết định](20_TONG_HOP_QUYET_DINH_NGHIEP_VU.md). Đối chiếu lại điểm bắt đầu trong mã hiện tại, không thực hiện sửa mã trong bước lập danh sách này.

## 1. Mục tiêu trước mắt

Ổn định mã đã có và đáp ứng các yêu cầu đã chốt; không viết lại toàn bộ website. Không tiếp tục render hết mọi sơ đồ như điều kiện bắt buộc để sửa nền tảng. Các hình/bộ báo cáo còn lại hoàn thiện sau theo đúng tiến độ từng phần.

Lần kiểm tra đầy đủ gần nhất ngày 13/10/2026: 97 ca, 68 đạt, 21 lỗi, 8 bỏ qua. Đây là số liệu lịch sử; chưa chạy lại trong bước lập kế hoạch này. Không tuyên bố lỗi đã hết trước khi kiểm tra.

## 2. Danh sách triển khai

| Bước | Yêu cầu / hiện trạng | Thay đổi dự kiến | Điều kiện hoàn thành |
|---|---|---|---|
| CODE-01 | openDatabase mặc định v8; migrate/defaultDatabase dùng v11; checkout đã cần shipping_quote_json | Một nguồn phiên bản schema hiện tại; khởi tạo mặc định đồng bộ, fixture lịch sử truyền version tường minh | Test checkout/migration giữ dữ liệu cũ đạt; chạy bộ test để xác định lỗi còn lại |
| CODE-02 | Ca HTTP đăng nhập lỗi; rate limit hiện tính mọi POST theo IP | Xác nhận status/body lỗi; làm rõ chính sách giới hạn, chỉnh test và mã đúng chính sách; sửa thông báo tiếng Việt | Đăng nhập/khóa/đổi mật khẩu và ca 429 đạt; không bỏ bảo vệ chỉ để test xanh |
| CODE-03A | Giỏ đang nằm trong session; QD-04 yêu cầu giỏ tài khoản | Migration carts/cart_items và dịch vụ giỏ; vãng lai tiếp tục session; CUSTOMER đọc/ghi theo tài khoản | Logout/login và đổi/reset mật khẩu không mất giỏ; không lộ giỏ tài khoản khác |
| CODE-03B | QD-05 gộp một lần, cùng SKU cộng; vượt giới hạn báo điều chỉnh | Dấu gộp nguồn và giao dịch nguyên tử, UI thông báo lượng cần chỉnh; chống retry cộng lần hai | AT-36..38: gộp/tranh chấp/rollback/vượt tồn được xử lý đúng |
| CODE-04 | Phí cố định đã chốt; mã có biểu phí vùng đang ghép | Luồng chính dùng phí cố định, snapshot và kiểm tra đổi phí; phần vùng không cản trở mua bản đồ án | Xem checkout không cần vùng/trọng lượng; đổi phí trước đặt yêu cầu xác nhận lại; đơn cũ giữ nguyên |
| CODE-05 | Có nhiều nghiệp vụ sản phẩm/đơn/kho/thanh toán | Đối chiếu từng nhóm với QD, chỉ sửa khoảng cách thực tế; ưu tiên giữ/xuất/hủy, hạn online, COD và vận chuyển thủ công | Một luồng COD từ mua đến ADMIN thu tiền; online sandbox chỉ xác nhận từ kết quả hợp lệ; không trừ/hoàn kho lặp |
| CODE-06 | Khuyến mãi/đánh giá/gợi ý/hỗ trợ/báo cáo đã có mã | Nghiệm thu từng nhóm theo quy tắc đã chốt, sửa quyền/snapshot/nội dung còn lệch | Một mã/đơn; review chờ duyệt; ticket không lộ internal; doanh thu đúng điều kiện |
| CODE-07 | SMTP/VNPay chưa nghiệm thu bên ngoài trong lượt rà soát | Cấu hình môi trường thử nghiệm và chạy tích hợp; không commit bí mật | Email reset dùng một lần/30 phút; IPN public xác thực; không giả kết quả từ redirect |
| CODE-08 | Chưa xác nhận bản triển khai | Kiểm tra PostgreSQL, smoke, UI/mobile, backup/restore; đóng gói tài liệu và hướng dẫn chạy | Các kiểm tra phù hợp đạt, người khác chạy được, phạm vi demo rõ; sau đó mới triển khai web |

CODE-03A và CODE-03B là hai bước riêng, không làm toàn bộ giỏ trong một lượt. CODE-05/06 tiếp tục chia theo từng nhóm khi đến bước đó.

## 3. Phạm vi cụ thể của bước code đầu tiên

Tệp cần đọc trước sửa:

- `src/migrations.js`: danh sách migration và mặc định v11.
- `src/db.js`: `openDatabase(file, targetVersion = 8)` và các lời gọi từ `defaultDatabase`.
- `src/checkout.js`: cột `shipping_quote_json` cần schema v11.
- Các test migration/checkout: phân biệt fixture hiện tại với fixture cố ý dùng schema cũ.

Thay đổi dự kiến: xuất hằng CURRENT_SCHEMA_VERSION từ danh sách migration, dùng hằng cho mặc định mở/migrate/defaultDatabase. Giữ khả năng truyền version cũ cho test nâng cấp; không sửa lịch sử migration đã dùng chỉ để thêm cột vào schema cũ. Thêm ca khởi tạo mới và nâng cấp giữ snapshot/giá/tồn/đơn khi cần.

Xác minh: chạy test migration/checkout trước; sau đó bộ test đầy đủ một lần để xác định phần 20 lỗi schema đã được xử lý và lỗi còn lại. Không ghi chắc chắn hết 20 lỗi nếu chưa chạy.

Không thay giỏ, chính sách rate limit, giao diện hoặc cấu hình SMTP/VNPay trong CODE-01. Không khởi động ứng dụng lên CSDL đang sử dụng để kiểm tra; dùng dữ liệu test tạm/RAM. Không xóa dữ liệu hoặc hoàn tác các thay đổi chưa commit có sẵn.

## 4. Cách làm việc mỗi lượt

1. Giải thích vấn đề và phần nhỏ sẽ sửa.
2. Sửa đúng phạm vi bước đó, giữ thay đổi khác đang có.
3. Chạy kiểm tra phù hợp, báo kết quả và giới hạn.
4. Cho người dùng xem trước khi chuyển sang nhóm tiếp theo.

Không tự triển khai mọi chức năng trong một lượt. Các cấu hình nghiệp vụ chưa chốt (mức phí, SMTP/merchant, policy còn lại) được xử lý khi đến bước liên quan; không yêu cầu chốt mọi tham số trước khi sửa schema nền tảng.
