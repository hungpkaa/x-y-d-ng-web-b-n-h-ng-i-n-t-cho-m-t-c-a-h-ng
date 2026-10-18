# CODE-05B — Kiểm tra VNPay sandbox cục bộ

Ngày kiểm tra: 18/10/2026. Căn cứ QD-15/16/17/24, BR-07/08 và kế hoạch CODE-05. Tiếp nối kiểm tra COD ở tài liệu 36.

## Kết luận

Trong phạm vi kiểm thử cục bộ SQLite, các trường hợp dưới đây đáp ứng yêu cầu đã chốt; chưa phát hiện sai lệch cần sửa mã nghiệp vụ. Bổ sung ba ca hồi quy vào `test/payments.test.js`. Không gọi dịch vụ VNPay hoặc dùng thông tin merchant thật.

| Yêu cầu | Bằng chứng kiểm tra |
|---|---|
| Hạn 15 phút từ tạo đơn | Tạo báo giá trước, mô phỏng tạo đơn sau một phút; deadline bằng thời điểm tạo đơn + 900.000 ms |
| Không kéo dài hạn khi thử lại | Attempt đầu thất bại; thử lại phút thứ 10 tạo reference mới nhưng giữ deadline gốc |
| Xử lý đúng biên hết hạn | Trước hạn 1 ms chưa hủy; đúng hạn chặn mở thanh toán, quét hủy và giải phóng giữ đúng một lần |
| Không phụ thuộc bộ quét chạy trước IPN | IPN thành công nhận đúng hạn khi chưa quét: tự hủy đơn hết hạn, giải phóng giữ, lưu khoản đã thu với nghĩa vụ hoàn |
| Thành công sau khách hủy | Giữ CANCELLED, chuyển REFUND_PENDING; không giữ kho lại, không cho xác nhận đơn lại, chưa tạo chứng từ hoàn giả |
| Chống xử lý trùng | IPN lặp không thêm event hoặc hoàn kho lặp; hai kết nối đồng thời được kiểm tra bởi bộ concurrency hiện có |
| Chỉ IPN cập nhật tiền | HTTP hiện có kiểm tra return không đổi trạng thái tiền, quyền xem giao dịch; IPN sai chữ ký bị từ chối |
| Xác thực và hoàn tiền | Bộ hiện có kiểm tra chữ ký, TmnCode, số tiền/tiền tệ/reference, trạng thái thành công không bị lùi, thu dư cần hoàn, quyền ADMIN, chứng từ và rollback |

Ba ca mới dùng thời gian giả lập/tham số `now`, không chờ 15 phút thực và không sửa deadline trong CSDL để vượt qua điều kiện của ca thử.

## Cách xử lý đang áp dụng

`src/server.js` quét khi khởi động và mỗi 30 giây. Vì vậy tác vụ quét không bảo đảm cập nhật giao diện đúng từng mili giây; `startPayment` vẫn chặn ở deadline và IPN thành công tự kiểm tra hết hạn trong cùng giao dịch. Chính sách hiện tại xét lúc hệ thống xử lý IPN: đến hạn mà đơn chưa được xác nhận tiền thì hủy và theo dõi hoàn, kể cả dữ liệu PayDate ghi thời điểm trước đó. Không tự đổi quy tắc này trong bước kiểm tra.

Trang return xác thực kết quả và quyền sở hữu rồi chuyển về đơn, không coi redirect là bằng chứng đã thu. IPN cập nhật ledger, trạng thái và audit cùng giao dịch. Tiền cần hoàn chỉ thành đã hoàn sau khi ADMIN ghi chứng từ phù hợp.

## Kết quả và giới hạn

Lệnh: `node --test test/payments.test.js test/payments-concurrency.test.js test/customer-payment-http.test.js`.

Kết quả: **14 ca đạt, 0 lỗi, 0 bỏ qua**, gồm ba ca mới, các ca dịch vụ hiện có, ba tình huống hai kết nối và một luồng HTTP.

Không chạy lại toàn bộ bộ test vì chỉ bổ sung test/tài liệu. Chưa nghiệm thu PostgreSQL, cấu hình merchant, IPN qua URL public, độ tương thích callback thực tế của nhà cung cấp hoặc thao tác trình duyệt/mobile. Các callback trong test được ký bằng khóa giả cục bộ; kết quả không thay thế nghiệm thu VNPay sandbox bên ngoài ở CODE-07. Không đọc `.env`, thay cấu hình đang dùng, triển khai web hoặc giao dịch tiền thật.

## Tiếp theo

CODE-05C: rà soát luồng giao thất bại → giao lại hoặc nhận hàng thực về, nhất là chỉ cộng kho một lần và tách khoản cần hoàn khỏi kho; đối chiếu QD-19 trước khi chuyển sang khuyến mãi/đánh giá/hỗ trợ ở CODE-06.
