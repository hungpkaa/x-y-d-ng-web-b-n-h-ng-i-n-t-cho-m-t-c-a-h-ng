# CODE-06E — Báo cáo doanh thu, tiền thu và hoàn tiền

Ngày kiểm tra: 18/10/2026. Căn cứ QD-24, UC-32, BR-12; liên quan snapshot khuyến mãi/phí giao QD-21/22.

## Kết luận

Chưa phát hiện sai lệch cần sửa mã nghiệp vụ trong phạm vi SQLite đã kiểm tra. Bổ sung một ca tích hợp trong `test/promotion-account-flow.test.js`: tạo mã bằng dịch vụ ADMIN, đặt bằng giỏ tài khoản, giao bằng dịch vụ vận chuyển, ADMIN thu COD rồi đọc báo cáo và CSV.

| Nội dung | Kết quả |
|---|---|
| Đã giao nhưng chưa thu | Có một đơn đã giao nhưng recognizedOrders/revenue/cash đều 0 |
| Đã giao và đã thu đủ | Tiền hàng 100.000, giảm 10.000, phí giao 25.000: doanh thu 90.000, phí riêng 25.000, COD thực thu 115.000 |
| Gửi lại chứng từ | Vẫn một đơn ghi nhận, không nhân đôi khoản thu/doanh thu |
| CSV | Các dòng doanh thu/phí/COD khớp lần lượt 90.000/25.000/115.000 |
| Kỳ ghi nhận | Bộ reporting hiện có kiểm tra mốc muộn hơn giữa giao và thu, ngày Việt Nam [đầu ngày, đầu ngày kế), hai ngày khác nhau |
| Hủy/thất bại/chưa thu | Không ghi doanh thu; khoản đã thu và cần hoàn vẫn được theo dõi riêng |
| Tiền hoàn | Bộ payments kiểm tra tiền thu và hoàn ở các kỳ khác nhau; hoàn không trở thành doanh thu |
| Thiếu chứng cứ lịch sử | Đơn legacy PAID thiếu mốc giao/thu không tự tính doanh thu, có chỉ báo dữ liệu thiếu |
| Quyền xem/xuất | HTTP chỉ ADMIN xem báo cáo và tải CSV; STAFF/CUSTOMER/vãng lai bị chặn |
| Đầu vào và CSV an toàn | Chặn ngày sai, khoảng quá dài, bộ lọc sai; CSV escape dấu nháy/xuống dòng và che công thức từ dữ liệu |

Chỉ tiêu top SKU đã giao trong mã hiện tại dựa lượng giao, khác với chỉ tiêu doanh thu yêu cầu đủ cả giao và thu. Phí giao của đơn được ghi nhận cũng khác dòng tiền thu phí riêng; không suy diễn chỉ tiêu này là số tiền hãng vận chuyển đã nhận. Khoản chờ hoàn là số dư hiện tại trên toàn dữ liệu, được ghi rõ trong CSV.

## Xác minh và giới hạn

Lệnh: `node --test test/reporting.test.js test/accounts-http.test.js test/promotion-account-flow.test.js test/payments.test.js test/cod-flow.test.js`.

Kết quả: **23 ca đạt, 0 lỗi, 0 bỏ qua**. Bộ chạy bao gồm các luồng tài khoản/thanh toán/kho liên quan; không phải 23 ca báo cáo độc lập.

Chỉ bổ sung test và tài liệu, không chạy lại toàn bộ bộ test ở bước này. Chưa nghiệm thu PostgreSQL, bố cục biểu đồ/bảng trên trình duyệt/mobile, hoặc hiệu năng dữ liệu lớn. Các báo cáo hiện tại phục vụ phạm vi đồ án, không có bước nghiệm thu tài chính bên ngoài trong lượt này. Không thay đổi cấu hình/CSDL đang dùng, gửi tiền hoặc triển khai web.

## Tiếp theo

CODE-07A: rà soát cấu hình và điều kiện nghiệm thu SMTP/VNPay sandbox, chuẩn bị lệnh kiểm tra và danh sách phần đã giả lập/phần cần kết nối thật. Trước tiên kiểm tra mã và cấu hình mẫu, không đọc hoặc ghi bí mật `.env`; không coi các ca cục bộ là đã nghiệm thu dịch vụ bên ngoài. PostgreSQL, UI/mobile và triển khai tiếp tục thuộc CODE-08.
