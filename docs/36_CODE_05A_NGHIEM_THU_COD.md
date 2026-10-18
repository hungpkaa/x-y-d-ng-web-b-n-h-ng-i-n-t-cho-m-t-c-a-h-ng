# CODE-05A — Kiểm tra luồng COD, kho và vận chuyển thủ công

Ngày kiểm tra: 18/10/2026. Căn cứ QD-15, QD-17, QD-18, QD-20, QD-21, QD-24; UC-18, UC-20/21, UC-24/25/26 và kế hoạch CODE-05.

## Kết luận trong phạm vi bước này

Các dịch vụ hiện có đáp ứng luồng COD được kiểm tra trên SQLite. Không phát hiện sai lệch cần sửa mã nghiệp vụ trong bước này. Bổ sung hai ca kiểm tra tích hợp tại `test/cod-flow.test.js`, đi qua dịch vụ thật từ giỏ tài khoản, checkout, xử lý đơn, vận chuyển, thu COD đến báo cáo; không ghi trực tiếp trạng thái để bỏ qua điều kiện nghiệp vụ.

## Các mốc đã kiểm tra

Ví dụ: tồn thực tế 10, mua 2 sản phẩm giá 100.000 VND, phí cố định 25.000 VND, tổng thu 225.000 VND.

| Mốc | Tồn thực tế / giữ | Điều kiện và kết quả |
|---|---|---|
| Trước đặt | 10 / 0 | Giỏ không giữ kho |
| Đặt thành công | 10 / 2 | Snapshot tổng 225.000; xóa phần đã mua khỏi giỏ cùng giao dịch |
| Xác nhận, chuẩn bị | 10 / 2 | Không xuất kho; không được thu COD trước giao |
| Tạo vận đơn READY | 10 / 2 | Một hãng/mã vận đơn; số tiền COD bằng tổng đơn; tạo vận đơn chưa xuất kho |
| Bàn giao IN_TRANSIT | 8 / 0 | Tiêu thụ lượng giữ, xuất kho đúng một lần; gửi lại cùng yêu cầu không xuất thêm |
| Giao thành công | 8 / 0 | Đơn DELIVERED nhưng vẫn UNPAID; doanh thu và tiền COD thực thu vẫn 0 |
| ADMIN xác nhận đủ tiền | 8 / 0 | Cần mã chứng từ, ghi chú và đúng 225.000; CUSTOMER/STAFF bị chặn |
| Gửi lại chứng từ | 8 / 0 | Một chứng từ, một khoản thanh toán; không thu hoặc ghi nhận doanh thu lặp |
| Báo cáo sau thu | 8 / 0 | Doanh thu hàng 200.000; phí giao riêng 25.000; COD thực thu 225.000 |

Ca thứ hai xác nhận hủy trước bàn giao: chỉ giải phóng giữ, tồn vẫn 10; vận đơn READY thành CANCELLED; hủy lặp không giải phóng thêm; yêu cầu bàn giao cũ bị chặn. Sau bàn giao không được hủy trực tiếp.

Kiểm tra nguồn: `src/server.js` bảo vệ route thu COD bằng middleware ADMIN; `views/order.ejs` chỉ hiển thị form khi ADMIN xem đơn COD đã giao, chưa thu. Dịch vụ kiểm tra lại quyền từ CSDL, không chỉ dựa vào việc ẩn form.

## Kết quả xác minh và giới hạn

Chạy `node --test test/cod-flow.test.js test/shipments.test.js test/accounts-management.test.js`: **14 ca đạt, 0 lỗi, 0 bỏ qua**. Hai ca mới kiểm tra chuỗi tích hợp; các ca hiện có kiểm tra thêm version, chứng từ trùng, rollback, quyền, giao lại và nhận hàng về.

Không chạy lại toàn bộ test vì bước này chỉ bổ sung test và tài liệu. Mốc toàn bộ gần nhất ở CODE-04: 120 ca, 110 đạt, 0 lỗi, 10 bỏ qua PostgreSQL; số này là mốc trước khi thêm hai ca mới.

Chưa nghiệm thu trực quan trình duyệt/mobile, PostgreSQL hoặc đối soát với hãng vận chuyển thật. Không xem kiểm tra dịch vụ là bằng chứng đã hoàn thành các phần tích hợp ngoài. Không thay cấu hình/CSDL đang sử dụng hoặc triển khai web.

## Tiếp theo

CODE-05B: kiểm tra VNPay sandbox — hạn 15 phút từ tạo đơn, hết hạn giải phóng giữ, chữ ký và số tiền callback, callback trùng, thành công sau hủy chuyển khoản cần hoàn và không mở lại đơn. Chưa cần giao dịch tiền thật hoặc thông tin merchant để rà soát mã và kiểm thử cục bộ.
