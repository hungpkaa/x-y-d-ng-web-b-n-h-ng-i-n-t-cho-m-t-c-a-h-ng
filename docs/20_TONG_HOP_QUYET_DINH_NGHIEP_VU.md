# Tổng hợp quyết định nghiệp vụ

Bổ sung 18/10/2026: người dùng đồng ý thêm chuyển khoản QR ngân hàng cá nhân, ADMIN đối soát trước PAID; thời hạn 30 phút từ tạo đơn. Tài khoản do người dùng cung cấp: BIDV / 4801021854 / VUTIENHUNG. Xem [đặc tả bổ sung](46_BO_SUNG_THANH_TOAN_QR_NGAN_HANG.md). Chưa đối chiếu payload QR; không áp dụng giới hạn COD/VNPay của QD-16 để loại bỏ phương thức mới đã đồng ý.

Ngày tổng hợp: 14/10/2026. Căn cứ: các phương án được trình bày và người dùng đồng ý trong cuộc trao đổi. Đây là yêu cầu mục tiêu, không phải biên bản nghiệm thu mã nguồn.

## 1. Các quyết định đã thống nhất

| Mã | Nhóm | Quyết định | Tham chiếu |
|---|---|---|---|
| QD-01 | Cách làm | Hoàn thiện tài liệu từng phần trước khi tiếp tục triển khai web; công nghệ Node.js | README |
| QD-02 | Vai trò | STAFF cập nhật thông tin/tồn; ADMIN đặt và sửa giá. STAFF/ADMIN dùng CUSTOMER riêng khi mua | 01; UC-08..12; BR-01/02 |
| QD-03 | Đặt hàng | Vãng lai xem sản phẩm và dùng giỏ; phải đăng nhập trước xác nhận đặt | UC-02/16/18 |
| QD-04 | Giỏ tài khoản | Lưu theo tài khoản, không mất khi đăng xuất; đăng nhập lại thấy giỏ cũ; kiểm tra giá/tồn trước đặt | UC-03/16; AT-35 |
| QD-05 | Gộp giỏ | Đăng nhập gộp giỏ vãng lai với giỏ tài khoản một lần, cùng SKU cộng số lượng; vượt tồn/giới hạn báo điều chỉnh; không cộng lại khi tải trang | UC-02/16; AT-36..38 |
| QD-06 | Khóa tài khoản | ADMIN khóa/mở CUSTOMER/STAFF có lý do; khóa vô hiệu mọi phiên, mở khóa đăng nhập lại; giữ tài khoản/lịch sử đơn | UC-05; AT-03 |
| QD-07 | Đổi mật khẩu | Xác minh mật khẩu hiện tại; thành công vô hiệu mọi phiên cũ, đăng nhập lại; giữ giỏ/lịch sử đơn | UC-04; AT-39/40 |
| QD-08 | Quên mật khẩu | Email liên kết dùng một lần trong 30 phút, thông báo chung; reset thành công vô hiệu mọi phiên cũ và giữ giỏ/lịch sử | UC-04-R; AT-41..43 |
| QD-09 | Sản phẩm | STAFF tạo nháp, nhập thông tin/ảnh/cấu hình/tồn; ADMIN đặt giá/công bố/ẩn; nháp không công khai | UC-08/12; BR-02 |
| QD-10 | Công bố | Có tên/danh mục/thương hiệu/mô tả, ít nhất một ảnh hợp lệ, đủ thông số bắt buộc và ít nhất một SKU bật bán có mã riêng, giá > 0 | UC-12; AT-44..46 |
| QD-11 | Hết hàng | Được công bố và so sánh; hiển thị hết hàng, không cho đặt SKU hết hàng | UC-12/14 |
| QD-12 | Thông số | ADMIN định nghĩa theo danh mục với kiểu/đơn vị/bắt buộc; STAFF nhập giá trị từng SKU; so sánh dùng chuẩn chung | UC-09/13/14; AT-47..49 |
| QD-13 | So sánh | Tối đa 3 SKU cùng danh mục; giá/cấu hình/thông số, đánh dấu khác biệt; thiếu ghi chưa có thông tin; ẩn không so sánh | UC-14; AT-50..52 |
| QD-14 | Gợi ý | Ưu tiên danh mục/thương hiệu/giá gần; công khai và có SKU còn hàng; loại sản phẩm đang xem; có lý do; không ML | UC-15; AT-53..55 |
| QD-15 | Kho | Giỏ chưa giữ; tạo đơn thành công mới giữ; bàn giao mới xuất; hủy trước bàn giao giải phóng lượng giữ | BR-03; 18 |
| QD-16 | Thanh toán | COD và VNPay sandbox cho đồ án, chưa giao dịch tiền thật. Online hạn 15 phút từ tạo đơn; hết hạn chưa thanh toán hủy/giải phóng giữ; thành công sau hủy ghi khoản cần hoàn, không mở lại đơn | BR-07/08; 18 |
| QD-17 | Hủy | Chủ đơn hủy khi chờ xác nhận; STAFF/ADMIN hủy trước bàn giao có lý do; đã thu thì ghi khoản cần hoàn, không tự coi đã hoàn | UC-20/21; BR-06 |
| QD-18 | Giao hàng | Thủ công, nhập hãng/mã/trạng thái; một đơn một kiện/một mã, giao toàn bộ cùng lúc; API hãng và giao từng phần để mở rộng | UC-25/26; BR-15 |
| QD-19 | Thất bại | Ghi lý do, có thể giao lại; chỉ cộng kho khi xác nhận nhận hàng về; đã thu tiền cho trường hợp trả về thì theo dõi hoàn riêng | UC-26; BR-09 |
| QD-20 | COD | STAFF/ADMIN cập nhật giao; chỉ ADMIN xác nhận thu đủ kèm mã chứng từ và ghi chú; đã giao không tự thành đã thanh toán | UC-24 |
| QD-21 | Phí giao | Cố định do ADMIN cấu hình, hiển thị trước đặt và giữ nguyên trên đơn đã tạo; phí khu vực/trọng lượng là mở rộng | UC-17; BR-15 |
| QD-22 | Khuyến mãi | Tối đa một mã/đơn, không cộng dồn; giảm tiền hàng, không phí giao; kiểm tra thời hạn/tối thiểu/lượt; lưu mức giảm trên đơn | UC-29; BR-10 |
| QD-23 | Đánh giá | Chủ đơn đã nhận hàng; một đánh giá/dòng đơn, 1–5 sao và nhận xét; sửa của mình; ADMIN duyệt trước công khai, sửa duyệt lại | UC-27/28; BR-11 |
| QD-24 | Doanh thu | Chỉ đã giao và đã thanh toán, tiền hàng trừ giảm giá, không gồm phí giao; hủy/thất bại không tính; thu/hoàn/phí hiển thị riêng | UC-32; BR-12 |
| QD-25 | Hỗ trợ | Yêu cầu theo đơn của mình; STAFF/ADMIN trả lời; khách chỉ thấy công khai, không thấy nội bộ; mới → đang xử lý → đóng | UC-30/31; AT-56..58 |

## 2. Phần chưa chốt và chi tiết thiết kế

Không coi các lựa chọn sau là đã được duyệt chỉ vì có trong mã/tài liệu cũ:

- Bật/tắt từng SKU, thay mã/cấu hình đã có giao dịch; danh sách thông số bắt buộc cụ thể từng danh mục.
- Loại mã giảm FIXED/PERCENT, trần giảm, phạm vi sản phẩm, giới hạn mỗi khách, giữ/trả lượt khi hủy.
- Trọng số xếp hạng, định nghĩa khoảng giá gần và số kết quả gợi ý.
- Quy tắc gửi lại liên kết reset, rate limit, thời hạn phiên; cơ chế kỹ thuật auth_version và chống lặp.
- Mở lại ticket trong 7 ngày, phân công xử lý, giới hạn hội thoại.
- Số tiền phí giao cụ thể và địa bàn phục vụ; cấu hình SMTP/merchant sandbox/callback.
- Cách thực hiện và chứng từ hoàn tiền, xử lý chứng từ demo; phân kỳ ghi doanh thu/thu/hoàn.
- Phạm vi cuối của dashboard, yêu thích, thông báo, chatbot, bảo hành/đổi trả và các phần mở rộng đã có mã.

Các chi tiết triển khai thông thường có thể được đề xuất trong thiết kế mà không biến mỗi tên cột hoặc thuật toán thành một quyết định nghiệp vụ cần hỏi riêng. Cần hỏi khi thay đổi hành vi người dùng, phạm vi hoặc chính sách kinh doanh.

## 3. Mâu thuẫn và chỗ cần đồng bộ

| Điểm | Hiện trạng | Cách xử lý tài liệu tiếp theo |
|---|---|---|
| Giỏ | ERD có carts/cart_items; mã lưu giỏ trong phiên | ERD giữ yêu cầu giỏ tài khoản; ghi khoảng cách triển khai, không nói đã đạt giữ qua logout |
| Gộp giỏ | UC-16 vừa yêu cầu báo vượt giới hạn, vừa ghi không vượt 99 | Tách số lượng mong muốn và điều kiện đặt hợp lệ trong thiết kế; chốt cách xử lý khi vượt trước khi sửa mã |
| Phiên | ERD tách user_id/auth_version; mã lưu trong JSON | Phân biệt schema mục tiêu/thực tế, bổ sung bảng ánh xạ |
| Reset | UC-04-R mới bổ sung, bộ danh mục vẫn 34 UC chính | Giữ 34 UC chính + phần bổ sung UC-04-R; cập nhật sơ đồ và dữ liệu reset, không tuyên bố mọi tham chiếu đã đủ |
| Vận chuyển | UC-25/26 đã đổi luồng thủ công; sơ đồ/BR khác còn API/job/callback | Đánh dấu API là mở rộng; luồng demo dùng N/Q nhập thủ công |
| Phí | Phí cố định đã chốt; ERD/truy vết/AT cấu hình còn shipping_rates | Chuyển bảng biểu phí nâng cao sang mở rộng; giữ snapshot shipping_fee trên đơn/checkout |
| Giới thiệu ERD/tiến độ | Còn schema v9/v2 và các số test cũ | Gắn nhãn lịch sử, dẫn báo cáo 17; không thay bằng kết quả chưa chạy lại |
| Chỉ mục | Nhiều đoạn “bước tiếp theo” của các vòng trước | Dùng tài liệu này làm bản tổng hợp hiện hành; các ghi nhận cũ giữ là lịch sử |

## 4. Cách hoàn thiện tiếp theo

1. Rà soát ERD nhóm tài khoản/phiên/giỏ/reset theo QD-03..08; viết rõ dữ liệu và quan hệ mục tiêu.
2. Lần lượt rà soát catalog/SKU, đơn/kho, thanh toán/vận chuyển và các nhóm còn lại.
3. Đồng bộ sơ đồ và nghiệm thu theo cùng phạm vi; đánh dấu phần mở rộng.
4. Render và xem lại sơ đồ/bộ báo cáo cuối khi nội dung ổn định.
5. Sau tài liệu mới sửa các khoảng cách mã, chạy lại test và chuẩn bị triển khai.

Không thay đổi mã website hoặc CSDL trong bước tổng hợp này. Các ca AT bổ sung là tiêu chí, không là test đã chạy. Kết quả kiểm tra mã ngày 13/10/2026 nằm ở báo cáo 17.
