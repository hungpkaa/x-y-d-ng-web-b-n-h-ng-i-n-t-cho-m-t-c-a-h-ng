# Luồng đặt hàng và giao hàng

Ngày: 13/10/2026. Bản rà soát nghiệp vụ từng bước, chưa phải xác nhận mã nguồn đã đáp ứng đầy đủ.

## 1. Quyết định đã thống nhất

- Khách được xem sản phẩm và quản lý giỏ hàng trước đăng nhập; phải đăng nhập trước khi xác nhận đặt hàng.
- Thanh toán COD hoặc VNPay sandbox phục vụ đồ án; chưa giao dịch tiền thật.
- Vận chuyển cập nhật thủ công: STAFF/ADMIN nhập hãng, mã vận đơn và trạng thái; API hãng để giai đoạn sau.
- Khách chỉ hủy đơn của mình khi chờ xác nhận. STAFF/ADMIN hủy trước bàn giao và phải ghi lý do.
- Tiền đã thu khi hủy được ghi nhận là khoản cần hoàn, không tự đánh dấu đã hoàn tiền.
- Đã chốt cơ chế tồn kho: giỏ hàng chưa giữ hàng; tạo đơn thành công mới giữ số lượng đặt; bàn giao vận chuyển mới xuất kho; hủy trước bàn giao giải phóng lượng giữ.
- Đã chốt ngày 14/10/2026: VNPay sandbox có thời hạn 15 phút từ lúc tạo đơn; thử lại không gia hạn. Hết hạn chưa thanh toán thì hủy và giải phóng lượng giữ; đã xác minh thành công thì tiếp tục xử lý. Thành công đến sau hủy ghi khoản cần hoàn, không mở lại đơn. Quy tắc hết hạn này không áp dụng COD.

## 2. Luồng chính đề xuất

Đã chốt ngày 14/10/2026 về khuyến mãi: tối đa một mã/đơn, không cộng dồn; giảm tiền hàng, không giảm phí giao; kiểm tra thời hạn, giá trị đơn tối thiểu và giới hạn lượt dùng. Mức giảm được lưu trên đơn, không đổi khi sửa chương trình.

Đã chốt ngày 14/10/2026: một mức phí giao hàng cố định do ADMIN cấu hình; khách thấy phí trước khi đặt và đơn đã tạo giữ nguyên phí. Biểu phí theo khu vực/trọng lượng để mở rộng sau. Chưa chốt số tiền cụ thể.

Đã chốt ngày 14/10/2026: mỗi đơn một kiện, một mã vận đơn, giao toàn bộ sản phẩm cùng lúc; chưa hỗ trợ chia đơn thành nhiều lần giao.

Đã chốt ngày 14/10/2026 về giao thất bại: ghi nhận thất bại và lý do, có thể giao lại; chỉ cộng kho khi cửa hàng xác nhận đã nhận hàng trả về. Nếu đã thu tiền cho trường hợp nhận hàng trả về, ghi khoản cần hoàn, không tự đánh dấu đã hoàn. Giao lại không tự phát sinh hoàn tiền.

Đã chốt ngày 14/10/2026 về COD: STAFF/ADMIN cập nhật giao hàng; chỉ ADMIN xác nhận đã thu đủ tiền, kèm mã chứng từ và ghi chú. Giao thành công không tự chuyển thanh toán sang PAID.

| Bước | Người thực hiện | Xử lý | Đơn hàng | Tồn kho | Thanh toán |
|---|---|---|---|---|---|
| 1 | Khách | Chọn SKU, số lượng, thêm giỏ | Chưa có đơn | Chưa giữ hàng | Chưa phát sinh |
| 2 | Khách/hệ thống | Đăng nhập; nhập người nhận/địa chỉ; xem tiền hàng, giảm giá, phí giao; chọn COD hoặc sandbox | Chưa có đơn | Kiểm tra đủ hàng nhưng chưa giữ | Chưa thu |
| 3 | Khách/hệ thống | Xác nhận; kiểm tra lại giá, tồn, phí, mã giảm; tạo đơn và lưu thông tin tại thời điểm mua | PENDING — chờ xác nhận | Giữ số lượng đã đặt trong cùng giao dịch tạo đơn | COD: UNPAID; online: chờ thanh toán |
| 4A | Khách/hệ thống | COD đi tiếp mà chưa thu tiền | PENDING | Tiếp tục giữ | UNPAID |
| 4B | Khách/cổng/hệ thống | Chuyển đến VNPay sandbox; xác minh kết quả từ cổng | PENDING | Tiếp tục giữ trong thời hạn | PAID khi có kết quả hợp lệ; trang quay lại không tự xác nhận |
| 5 | STAFF/ADMIN | Kiểm tra và xác nhận; online phải có kết quả thanh toán thành công | CONFIRMED — đã xác nhận | Vẫn giữ | COD chưa thu; online đã xác nhận thanh toán sandbox |
| 6 | STAFF/ADMIN | Chuẩn bị hàng, ghi hãng/mã vận đơn thủ công | PREPARING — đang chuẩn bị | Vẫn giữ, chưa xuất | Không đổi |
| 7 | STAFF/ADMIN | Xác nhận đã bàn giao thực tế hoặc theo kịch bản demo được ghi rõ | SHIPPING — đang giao | Xuất hàng: giảm tồn vật lý và giảm lượng đang giữ | Không đổi |
| 8 | STAFF/ADMIN | Ghi nhận giao thành công | DELIVERED — đã giao | Không trừ thêm | COD chưa tự chuyển PAID; online giữ kết quả đã xác minh |
| 9 | ADMIN (đã chốt) | Xác nhận thu đủ COD, kèm mã chứng từ và ghi chú | DELIVERED | Không đổi | COD chuyển PAID khi xác nhận đủ tiền |

Quyền hủy, cơ chế giữ/xuất kho, thời hạn online và quyền xác nhận thu COD đã được thống nhất. Các trạng thái chi tiết vẫn là thiết kế đề xuất chưa được phê duyệt riêng toàn bộ. Trong sandbox, “đã thanh toán” là kết quả thử nghiệm, không phải khoản thu ngân hàng thực. Chứng từ COD khi demo phải được ghi rõ là dữ liệu mô phỏng.

## 3. Giải thích tồn kho bằng ví dụ

Cơ chế đã được thống nhất được mô tả bằng ba số: tồn vật lý (`on_hand`), lượng đang giữ (`reserved`), lượng còn bán được (`available = on_hand - reserved`). Tên trường là đề xuất kỹ thuật.

Ví dụ một SKU có 10 sản phẩm, khách đặt 2:

| Thời điểm | Tồn vật lý | Đang giữ | Còn bán được |
|---|---:|---:|---:|
| Trước đặt | 10 | 0 | 10 |
| Tạo đơn thành công | 10 | 2 | 8 |
| Xác nhận/chuẩn bị | 10 | 2 | 8 |
| Bàn giao vận chuyển | 8 | 0 | 8 |

Nếu hủy trước bàn giao: tồn vật lý vẫn 10, lượng giữ trở về 0, còn bán được 10. Nếu hàng đã bàn giao, không được cộng kho chỉ vì báo giao thất bại; phải xác nhận đã nhận hàng trả về. Thao tác gửi lặp không được giữ, xuất hoặc hoàn tồn lần hai.

## 4. Ngoại lệ cần có

| Tình huống | Cách xử lý đề xuất |
|---|---|
| Giá/giỏ/phí thay đổi trước xác nhận | Hiển thị báo giá mới để khách xác nhận; không âm thầm dùng tổng cũ |
| Hết hàng khi tạo đơn | Không tạo đơn hoặc giữ một phần; báo khách cập nhật giỏ |
| Bấm đặt hàng nhiều lần | Cùng yêu cầu hợp lệ trả lại cùng đơn, không tạo đơn trùng |
| Khách hủy PENDING | Kiểm tra chủ đơn; giải phóng lượng giữ; tiền đã thu chuyển sang cần hoàn |
| Nhân viên hủy trước bàn giao | Bắt buộc lý do; giải phóng lượng giữ; giữ lịch sử và thông tin tiền |
| Hủy và xác nhận diễn ra đồng thời | Chỉ một thao tác hợp lệ được ghi nhận; bên còn lại tải trạng thái mới |
| Online thất bại | Chưa đánh dấu PAID; khách có thể thử lại nếu đơn còn hợp lệ và còn hạn |
| Online quá hạn chưa thu | Đã chốt: 15 phút từ lúc tạo đơn, hủy và giải phóng giữ hàng nếu chưa thanh toán; không áp dụng COD |
| Kết quả thành công đến sau hủy | Ghi nhận kết quả vào lịch sử tiền, tạo khoản cần xử lý hoàn; không mở lại đơn |
| Giao thất bại | Đã chốt: ghi thất bại và lý do; có thể giao lại; không tự cộng tồn |
| Nhận hàng trả về | Đã chốt: chỉ cộng kho khi cửa hàng xác nhận đã nhận hàng; đã thu tiền thì ghi khoản cần hoàn, không tự đánh dấu đã hoàn. Thiết kế bổ sung: chứng cứ thực tế hoặc demo ghi rõ và chống cộng kho lặp |
| Ghi nhận hoàn tiền | Chỉ đánh dấu hoàn sau khi có chứng từ/kết quả hợp lệ; trong sandbox dùng bằng chứng thử nghiệm ghi rõ |

## 5. Phân biệt các trạng thái

- Đơn hàng cho biết cửa hàng đang xử lý đến bước nào.
- Thanh toán cho biết chưa thu, chờ kết quả, đã xác nhận hoặc cần hoàn/đã hoàn.
- Vận chuyển cho biết kiện đang chuẩn bị, đã bàn giao, giao thành công, thất bại hoặc đã trả về.

“Đã giao” không tự đồng nghĩa “đã đối soát COD”. “Đã hủy” không tự đồng nghĩa “đã hoàn tiền”.

## 6. Bước cần rà soát tiếp

Đã chốt ngày 14/10/2026 về báo cáo: chỉ tính doanh thu tiền hàng cho đơn đã giao và đã thanh toán; tiền hàng trừ giảm giá, không gồm phí giao. Tiền thu, tiền hoàn và phí giao hiển thị riêng. Đơn hủy/giao thất bại không tính doanh thu tiền hàng. Ví dụ: hàng 1.000.000 VND, giảm 100.000 VND, phí giao 30.000 VND thì tổng thanh toán 930.000 VND và doanh thu tiền hàng 900.000 VND khi đủ điều kiện. Đây là ví dụ, không phải mức phí đã chọn.

Đã chốt ngày 14/10/2026 về bước sau giao hàng: chủ đơn đã nhận hàng được đánh giá mỗi dòng sản phẩm một lần, gồm 1–5 sao và nhận xét; được sửa đánh giá của mình; ADMIN duyệt trước công khai và duyệt lại khi sửa. Chi tiết xem UC-27/28 và BR-11.

Cơ chế giữ/xuất kho, thời hạn online, quyền xác nhận COD, xử lý giao thất bại, một đơn một kiện, phí giao cố định, khuyến mãi, đánh giá và doanh thu đã chốt. UC-25/26 đã cập nhật luồng thủ công. Tiếp theo đối chiếu các quyết định với ERD và tiêu chí nghiệm thu; chưa triển khai mã trong bước này.
