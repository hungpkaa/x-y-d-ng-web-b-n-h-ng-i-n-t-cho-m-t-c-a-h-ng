# CODE-05C — Giao thất bại, giao lại và nhận hàng về

Ngày kiểm tra: 18/10/2026. Căn cứ QD-15/18/19/20/24, UC-25/26 và BR-09. Phạm vi giao toàn bộ một kiện theo tài liệu đã chốt; không bổ sung giao từng phần hoặc API hãng.

## Kết luận

Luồng dịch vụ hiện có đáp ứng các tình huống đã kiểm tra trên SQLite. Không phát hiện sai lệch cần sửa mã nghiệp vụ trong bước này. Bổ sung hai ca tích hợp vào `test/cod-flow.test.js` thay vì chỉ kiểm tra trạng thái vận đơn riêng lẻ.

Ca online mới đi qua giỏ tài khoản → checkout ONLINE → IPN ký bằng khóa test → xác nhận/chuẩn bị → vận chuyển → nhận hàng về → ghi chứng từ hoàn. Không ghi trực tiếp PAID hoặc trạng thái đơn để tạo tiền đề cho ca này; IPN và chứng từ hoàn đều là mô phỏng cục bộ, không giao dịch với nhà cung cấp.

## Các mốc kiểm tra

Ví dụ tồn đầu 10, mua 2 sản phẩm, tiền hàng 200.000 VND, phí giao 25.000 VND.

| Tình huống | Kho | Tiền và đơn |
|---|---|---|
| Bàn giao lần đầu | Thực tế 8, giữ 0 | Đơn SHIPPING |
| Báo FAILED | Vẫn 8, giữ 0 | Ghi bằng chứng/lý do, đơn vẫn SHIPPING để xử lý tiếp |
| Giao lại IN_TRANSIT | Vẫn 8, không xuất thêm | Dùng cùng vận đơn |
| COD giao lại thành công | Vẫn 8 | DELIVERED nhưng UNPAID; chỉ sau ADMIN ghi thu đủ 225.000 mới ghi doanh thu hàng 200.000 |
| Online đã thu, giao thất bại | Vẫn 8 | PAID, chưa tự tạo nghĩa vụ hoàn chỉ vì một lần FAILED |
| Xác nhận hàng thực về RETURNED | Cộng đúng 2, thực tế 10 | Đơn DELIVERY_FAILED; khoản đã thu chuyển REFUND_PENDING |
| Gửi lại cùng xác nhận nhận hàng | Không cộng thêm | Một movement nhận hàng về; chưa có chứng từ hoàn tự động |
| ADMIN ghi hoàn đủ có bằng chứng | Vẫn 10 | REFUNDED, giữ DELIVERY_FAILED và snapshot tổng/phí; một chứng từ dù gửi lại |
| Sự kiện mới sau RETURNED | Không đổi | Chặn giao lại, giao thành công hoặc nhận về lần nữa |

CUSTOMER không được xác nhận hàng về; thiếu bằng chứng bị chặn mà không đổi kho. STAFF không được ghi hoàn tiền. Khi hoàn tất luồng trả về, báo cáo không ghi doanh thu, ghi riêng online đã thu 225.000 và hoàn 225.000, dòng tiền ròng 0.

Các ca sẵn có trong `test/shipments.test.js` kiểm tra thêm hủy trước bàn giao, thời điểm/version, nguồn sự kiện, giao lại nhiều lần và rollback khi audit nhận hàng về thất bại. Bộ `test/payments.test.js` kiểm tra quyền, số tiền, chứng từ và rollback hoàn tiền.

## Xác minh

`node --test test/cod-flow.test.js test/shipments.test.js test/payments.test.js`: **19 ca đạt, 0 lỗi, 0 bỏ qua**.

Chỉ thay đổi test và tài liệu; không chạy lại toàn bộ bộ test trong bước này. Chưa nghiệm thu PostgreSQL, hai tiến trình nhận hàng về đồng thời, UI/mobile, vận chuyển hoặc hoàn tiền thật. Không thay đổi CSDL đang sử dụng hoặc triển khai web. Các kết quả không được hiểu là đã nghiệm thu toàn bộ CODE-05 ở mọi môi trường.

## Tiếp theo

CODE-06A: đối chiếu và kiểm tra khuyến mãi theo QD-22 — một mã mỗi đơn, giảm tiền hàng không giảm phí giao, thời hạn/giá trị tối thiểu/lượt sử dụng, snapshot và xử lý hủy/đặt lại. Tiếp tục một nhóm nhỏ mỗi lượt.
