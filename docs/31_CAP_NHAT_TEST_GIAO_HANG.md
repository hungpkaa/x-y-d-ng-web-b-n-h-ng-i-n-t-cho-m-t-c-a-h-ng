# Cập nhật fixture giao hàng theo schema hiện tại

## Đã thay đổi

- Thêm helper `test-support/shipping.js` để thiết lập giao hàng bằng dịch vụ createShipment/changeShipment thật, với hãng/mã/bằng chứng thử nghiệm, version và request_key.
- Cập nhật helper trong 6 tệp test: accounts-management, orders, products, payments, promotions, reviews. CONFIRMED/PREPARING/hủy vẫn dùng transitionOrder; SHIPPING/DELIVERED đi qua vận đơn.
- Không cập nhật tay trạng thái đơn trong helper, không hạ fixture xuống schema v8, không thay assertion để chấp nhận lỗi, không bỏ kiểm tra quyền/nhảy bước.
- Không sửa logic sản phẩm, thanh toán, kho, đăng nhập hoặc giao diện ứng dụng trong bước này.

## Kiểm tra

- Nhóm 6 tệp đã sửa cùng shipments: 36/36 đạt.
- Bộ đầy đủ: 101 ca, 92 đạt, 1 lỗi, 8 PostgreSQL bỏ qua.
- 9 ca lỗi do fixture giao trực tiếp sau CODE-01 đã qua. Không chạy bộ PostgreSQL riêng trong bước này.
- Còn lỗi `accounts-http.test.js:131`, login sau đổi mật khẩu không trả redirect mong đợi. Không tự kết luận mật khẩu hỏng; cần xác minh status/body và rate limit.

## Bước tiếp theo

CODE-02: ghi nhận đúng phản hồi đăng nhập thất bại, xác định tác động ngưỡng 10 yêu cầu/15 phút theo IP, chốt cách đếm phù hợp rồi sửa và kiểm tra. Giữ ca bảo vệ 429 riêng; không tắt rate limit để làm bộ test xanh. Chưa triển khai giỏ theo tài khoản hoặc sửa dữ liệu vận hành.
