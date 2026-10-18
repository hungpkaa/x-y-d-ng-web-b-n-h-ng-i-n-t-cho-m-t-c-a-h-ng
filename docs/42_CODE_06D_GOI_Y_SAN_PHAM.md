# CODE-06D — Gợi ý sản phẩm

Ngày kiểm tra: 18/10/2026. Căn cứ QD-14, UC-15, AT-53..55.

## Kết luận

Chưa phát hiện sai lệch cần sửa mã nghiệp vụ trong phạm vi đã kiểm tra trên SQLite. Dịch vụ `src/recommendations.js` dùng truy vấn và quy tắc xếp hạng, không dùng ML. Bổ sung một ca tích hợp kho vào `test/discovery.test.js`; chạy cùng bộ HTTP hiện có.

| Yêu cầu | Bằng chứng |
|---|---|
| Công khai và còn hàng | Chỉ ACTIVE, SKU bật bán/giá > 0 và on_hand - reserved > 0; loại nháp/ẩn/hết hàng/tắt SKU |
| Không gợi ý sản phẩm đang xem | Loại theo product_id, kể cả sản phẩm có nhiều SKU |
| Ưu tiên phù hợp | Các ca hiện có kiểm tra danh mục, thương hiệu, giá gần, SKU tham chiếu đúng sản phẩm |
| Có lý do đúng dữ liệu | Cùng danh mục/thương hiệu/giá gần khi thỏa điều kiện; lượng đã giao lấy từ đơn DELIVERED, không lấy đơn chờ/hủy |
| Không giả bán chạy | Chưa có lịch sử giao thì dùng lý do đang bán/còn hàng; không tạo số liệu giao giả |
| Liên kết đúng cấu hình | HTTP kiểm tra link sku và cấu hình được chọn, không đưa SKU riêng tư vào kết quả |
| Kho thay đổi sau đặt | Ca mới tạo đơn thật giữ hết 10 sản phẩm: sản phẩm biến mất khỏi gợi ý; khách hủy đơn giải phóng giữ thì xuất hiện lại, tồn hiển thị 10 |
| Đọc không thay nghiệp vụ | Gọi gợi ý không đổi on_hand/reserved hay lịch sử đơn; bộ cũ kiểm tra thêm dữ liệu giao dịch/audit |
| Bộ lọc và thứ tự | Chọn SKU còn hàng trong ngân sách; từ chối bộ lọc sai; thứ tự ổn định; không cắt ứng viên ở 100 sản phẩm |

## Chi tiết thiết kế vẫn chưa chốt riêng

UC-15 ghi rõ trọng số, khoảng giá, số kết quả và cách phá hòa là đề xuất kỹ thuật. Mã hiện tại dùng 50 điểm danh mục, 20 thương hiệu, 10 giá lệch không quá 20%; tối đa 6, phá hòa bằng lượng đã giao rồi ID. Báo cáo ghi nhận/kiểm tra hành vi đang có, không tự chốt các con số này thành yêu cầu mới.

## Xác minh và giới hạn

`node --test test/discovery.test.js test/discovery-http.test.js`: **11 ca đạt, 0 lỗi, 0 bỏ qua**. Đây là bộ dùng chung gợi ý và so sánh; không phải 11 ca gợi ý độc lập.

Chỉ bổ sung test và tài liệu; không chạy lại toàn bộ bộ test trong bước này. HTTP kiểm tra HTML và liên kết, chưa kiểm tra bố cục trình duyệt/mobile. Chưa nghiệm thu PostgreSQL hoặc hiệu năng với dữ liệu lớn thực tế. Không thay đổi CSDL/cấu hình đang sử dụng hoặc triển khai web.

## Tiếp theo

CODE-06E: đối chiếu báo cáo QD-24 — doanh thu chỉ đơn đã giao và đã thanh toán, bằng tiền hàng trừ giảm giá, loại phí giao; thu/hoàn/phí hiển thị riêng. Kiểm tra kỳ ghi nhận và quyền truy cập/xuất báo cáo trước khi chuyển sang tích hợp bên ngoài ở CODE-07.
