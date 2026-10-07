# Đối chiếu tài liệu và mã nguồn — 07/10/2026

Tài liệu này và [09](09_TIEN_DO_TRIEN_KHAI.md) ghi nhận tiến độ thực tế. Đặc tả [05](05_DAC_TA_USE_CASE.md) và quy tắc [06](06_QUY_TAC_VA_SO_DO_LUONG.md) là mục tiêu. “Local” nghĩa là đã triển khai/kiểm thử trong dự án, chưa xác nhận tích hợp bên ngoài thực tế.

## Đối chiếu 34 use case

| UC | Hiện trạng | Bằng chứng / phần còn thiếu |
|---|---|---|
| 01 | Local | Đăng ký CUSTOMER, email chuẩn hóa, CSRF; `accounts-http` |
| 02 | Local | Đăng nhập, đổi session ID, giới hạn thử; giới hạn đăng nhập còn trong RAM |
| 03 | Local | Đăng xuất xóa phiên lưu bền; `session-http` |
| 04 | Local | Hồ sơ, mật khẩu, sổ địa chỉ, reset; SMTP thật cần cấu hình |
| 05 | Local | ADMIN tạo/sửa STAFF, khóa CUSTOMER/STAFF; `accounts-management` |
| 06 | Local | Catalog lọc/sắp xếp/phân trang; `content`, smoke HTTP |
| 07 | Local | SKU/ảnh/thuộc tính/đánh giá công khai; smoke HTTP |
| 08 | Local | STAFF/ADMIN tạo DRAFT/SKU inactive; `products` |
| 09 | Local | Thông tin, WebP, thuộc tính có kiểu; `content` |
| 10 | Local | Chỉ ADMIN đặt giá, optimistic version; `products` |
| 11 | Local | Kho/movement và version; `orders`, `products` |
| 12 | Local | Công bố/ẩn, điều kiện ảnh/thuộc tính/giá; thiếu weight SKU theo mô hình mục tiêu |
| 13 | Local | Catalog/thương hiệu/định nghĩa thuộc tính; `catalog`, `content` |
| 14 | Local | Tối đa 3 SKU cùng danh mục; `discovery`, `discovery-http` |
| 15 | Local | Gợi ý theo điểm và số lượng đã giao; `discovery` |
| 16 | Local | Giỏ session bền; hiện chưa phải bảng carts/cart_items riêng |
| 17 | Một phần | Báo giá/mã/phí cố định; thiếu địa bàn, trọng lượng và shipping_rates |
| 18 | Một phần | Request key, snapshot, reservation nguyên tử; thiếu kiểm tra biểu phí địa bàn |
| 19 | Local | Đơn cá nhân, snapshot, lịch sử, vận chuyển; kiểm tra chủ dữ liệu |
| 20 | Local | Chủ đơn chỉ hủy PENDING; giữ kho/mã/tiền đúng; `accounts-management` |
| 21 | Local | STAFF/ADMIN lọc đơn, xác nhận/chuẩn bị/hủy; SHIPPING/DELIVERED đi qua vận chuyển |
| 22 | Một phần | VNPay sandbox ký URL/thử lại; chưa có API querydr, worker đối soát hoặc merchant thật |
| 23 | Một phần | IPN verified/idempotent, callback muộn, ledger; chưa có bảng payment_exceptions và xử lý đối soát chủ động |
| 24 | Local | ADMIN xác nhận đủ COD sau DELIVERED; không tự PAID khi giao hàng |
| 25 | Thủ công | Ghi hãng/mã/bằng chứng, một vận đơn/đơn; chưa có adapter/API hãng hoặc job tạo vận đơn |
| 26 | Thủ công | Bàn giao, giao lại, thất bại, nhận hàng về đúng một lần; chưa có callback hãng xác thực/sequence |
| 27 | Local | Chủ dòng đơn DELIVERED đánh giá; một review/dòng; `reviews` |
| 28 | Local | ADMIN duyệt/ẩn, sửa quay về PENDING; `reviews` |
| 29 | Local | Phạm vi, thời hạn, giới hạn HELD+USED; `promotions` |
| 30 | Local | Ticket gắn đơn mình, tin public/nội bộ và phân trang; `customer-services` |
| 31 | Local | Trả lời/trạng thái/nhận xử lý/mở lại; `customer-services` |
| 32 | Local | Báo cáo ngày Việt Nam, CSV, cash/refunds/recognition; `reporting`, `postgres` |
| 33 | Local | Audit lọc/phân trang/che JSON; chưa có chính sách retention hoặc export audit riêng |
| 34 | Local đầy đủ từng khoản | Hoàn toàn phần một capture, reference/bằng chứng duy nhất; chưa hỗ trợ hoàn từng phần hoặc API hoàn tự động (ngoài phạm vi) |

## Đã bổ sung trong lần đối chiếu này

- SQLite migration v9 và PostgreSQL migration v2: `shipments`, `shipment_events`, khóa unique, indexes. Không tạo mã vận đơn hoặc bằng chứng giả cho đơn cũ.
- `/admin/shipments`: danh sách lọc/phân trang; tạo/cập nhật từ trang chi tiết đơn. STAFF và ADMIN thực hiện, CUSTOMER chỉ xem vận đơn của đơn mình; khách không nhận bằng chứng/ghi chú nội bộ.
- Tạo thủ công ở PREPARING có mã hãng/tracking, thời điểm thực tế, bằng chứng và lý do; không xuất hàng. Trường hợp đơn cũ đã SHIPPING được gắn vận đơn thực tế mà không xuất kho lại.
- READY → IN_TRANSIT xuất reservation/kho/mã khuyến mãi cùng giao dịch; FAILED giữ order SHIPPING và không cộng kho; giao lại không xuất lần nữa; RETURNED có bằng chứng nhận lại hàng, movement unique `returned:order_item_id`, order DELIVERY_FAILED.
- Tiền đã thu trên đơn DELIVERY_FAILED cần hoàn, có trong danh sách hoàn và báo cáo nghĩa vụ; không ghi doanh thu hàng. Verified payment muộn cho đơn DELIVERY_FAILED cũng giữ nghĩa vụ hoàn.
- RETURNED/replay dùng request_key lưu bền, kiểm tra payload; key khác không được chạy lại transition terminal. Version của shipment và order cùng được kiểm tra. Timestamp cũ không làm lùi luồng.
- Hủy trước bàn giao chuyển bản ghi READY → CANCELLED và giải phóng reservation trong cùng giao dịch; đây là hủy bản ghi thủ công tại cửa hàng. Nhân viên vẫn cần hủy với hãng, không được hiểu là đã gọi API hãng thành công.
- Có `npm run db:backup` tạo bản PostgreSQL custom dump bằng pg_dump; không in hoặc đưa mật khẩu vào tham số lệnh.

## Thứ tự phát triển tiếp theo

1. **BR-15: biểu phí và trọng lượng.** Thêm weight_grams, địa bàn có mã, shipping_rates với thời gian/trọng lượng không chồng nhau; snapshot vào checkout và đơn; từ chối địa bàn chưa cấu hình. Không tự đoán biểu phí thật hoặc coi phí 0 demo là biểu phí vận hành.
2. **BR-16: tác vụ bền vững.** integration_jobs, lease/attempts/backoff, restart recovery, kiểm tra điều kiện trước API, khóa request_key ổn định. Chỉ gọi nhà cung cấp sau commit.
3. **Đối soát thanh toán.** payment_exceptions cho thu muộn/trùng/hủy/nhận hàng về, giao diện xử lý; querydr VNPay dùng credential/đường dẫn đúng của merchant sandbox; không suy luận thu tiền từ redirect.
4. **Vận chuyển API.** Chọn hãng/cấu hình sandbox, adapter create/query/cancel và callback xác thực. Chế độ thủ công đã dùng được độc lập, không cần token hãng.
5. **Nghiệm thu ngoài hệ thống.** SMTP thật, VNPay thật ở sandbox, callback public, xem giao diện trong trình duyệt và tải lớn PostgreSQL. Hiện PostgreSQL vẫn dùng cầu nối đồng bộ; pool async/khóa theo tài nguyên là công việc mở rộng hiệu năng.

## Kiểm tra

`npm test`: 82 bài đạt, 7 bài PostgreSQL được bỏ qua có chủ đích nếu không có POSTGRES_TEST. `npm run test:postgres`: 7 bài PostgreSQL đạt trong schema tạm. `npm run test:smoke` và `npm run test:smoke:postgres`: đạt, gồm vận đơn thủ công trước bàn giao/giao COD. Tổng 89 bài đạt khi chạy cả hai bộ; không coi mọi AT-01..34 đã nghiệm thu.

AT-23/24 được kiểm tra trực tiếp ở `test/shipments.test.js` và `test/postgres.test.js`; kiểm tra rollback khi lỗi audit, duplicate nhận hàng về, không cộng kho ở FAILED, khách không thấy bằng chứng và nghĩa vụ hoàn sau RETURNED. Chưa render lại các sơ đồ PlantUML hoặc kiểm tra giao diện bằng browser automation.
