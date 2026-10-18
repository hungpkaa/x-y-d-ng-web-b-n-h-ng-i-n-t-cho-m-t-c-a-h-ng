# Truy vết yêu cầu và nghiệm thu

Cập nhật 07/10/2026: 82 bài local và 7 bài PostgreSQL đạt, hai smoke đạt; UC-25/26 đã có chế độ thủ công, AT-23/24 có bài kiểm tra nhận hàng về. Chi tiết [đối chiếu 34 UC](12_ECARTS_ET_IMPLEMENTATION.md). Chưa nghiệm thu mọi ca AT hoặc API hãng/SMTP/VNPay thật.

Phiên bản 1.0 — 05/10/2026. Checklist mục tiêu, không phải kết quả test đã chạy. Đặc tả tại [05](05_DAC_TA_USE_CASE.md), sơ đồ tại [04](04_DANH_MUC_VA_SO_DO_USE_CASE.md) và [06](06_QUY_TAC_VA_SO_DO_LUONG.md), dữ liệu tại [07](07_ERD_VA_TU_DIEN_DU_LIEU.md).

Kết quả triển khai mới nhất ngày 07/10/2026: 77 kiểm thử và smoke test đạt cho luồng local đến migration v8, gồm catalog/SKU/phiên, tài khoản/đơn, khuyến mãi/đánh giá, báo cáo/audit, địa chỉ/hỗ trợ/reset và ledger VNPay/hoàn tiền. SMTP và IPN dùng dữ liệu giả trong test; chưa nghiệm thu SMTP/merchant VNPay thật. Phạm vi, giới hạn và bằng chứng tại [tiến độ](09_TIEN_DO_TRIEN_KHAI.md) và [cấu hình tích hợp](10_CAU_HINH_EMAIL_VNPAY.md); các ca AT dưới đây vẫn là checklist mục tiêu, không được coi tất cả đã đạt.

## 1. Ma trận truy vết

| Nhóm yêu cầu | UC | Tác nhân | Quy tắc | Dữ liệu chính | Sơ đồ |
|---|---|---|---|---|---|
| Tài khoản | 01–05 | K/N/Q | BR-01,13 | users, addresses, sessions, audit | Use case K/N/Q; luồng 06 §3 |
| Catalog | 06–07 | Mọi người | BR-02 | products, variants, images | Use case K; luồng 06 §4 |
| Quản lý hàng | 08–13 | N/Q | BR-02,03,13 | categories, brands, attributes, variants, movements | Use case N/Q; luồng 06 §4 |
| So sánh/gợi ý | 14–15 | Mọi người | BR-14 | attributes, variants, order_items | Use case K |
| Giỏ và checkout | 16–18 | V/K | BR-03,04,05,10,15 | carts, checkout_requests, orders, reservations, rates, redemptions | Use case K; luồng/sequence 06 §5,9 |
| Đơn cá nhân/xử lý | 19–21 | K/N/Q | BR-06,07,09 | orders, history, reservations | Use case K/N/Q; trạng thái 06 §7 |
| Thanh toán | 22–24,34 | K/Q/T | BR-05,07,08,12,16 | payments, events, exceptions, refunds, jobs | Use case T/Q; luồng 06 §6,9 |
| Vận chuyển | 25–26 | N/Q/G | BR-03,09,15,16 | shipments, events, jobs, movements | Use case G; 06 §8,10 |
| Đánh giá | 27–28 | K/Q | BR-11,13 | reviews, order_items | Use case K/Q; 06 §11 |
| Khuyến mãi | 29 và 17–18 | Q/K | BR-10 | promotions, products, redemptions | Use case Q/K; 06 §11 |
| Hỗ trợ | 30–31 | K/N/Q | BR-01,13 | requests, messages, history | Use case K/N/Q; 06 §11 |
| Báo cáo/audit | 32–33 | Q | BR-12,13 | orders, payments, refunds, audit | Use case Q; 06 §12 |

## 2. Ca nghiệm thu quan trọng

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-01 | Đăng ký với email đã tồn tại khác chữ hoa | Không tạo tài khoản thứ hai |
| AT-02 | Đăng ký gửi role=ADMIN | Chỉ CUSTOMER được tạo |
| AT-03 | ADMIN khóa/mở khóa CUSTOMER hoặc STAFF có nhiều phiên; thử thiếu lý do và truy cập bằng cookie cũ | Quy tắc đã chốt 14/10/2026: bắt buộc lý do; khóa chặn tất cả phiên ở lần truy cập tiếp theo; mở khóa phải đăng nhập lại; tài khoản/lịch sử đơn giữ nguyên. Đây là tiêu chí, chưa xác nhận đã chạy đạt trong bước tài liệu này |
| AT-04 | STAFF gửi cập nhật giá/công bố bằng HTTP | 403; mọi trường không đổi |
| AT-05 | STAFF tạo nháp, nhập thông tin/ảnh/cấu hình/tồn; thử công bố/ẩn; ADMIN đặt giá và công bố | Nháp không public; STAFF không công bố/ẩn hoặc đặt giá; ADMIN công bố khi đủ thông tin, ảnh, thông số và ít nhất một SKU bật bán có mã riêng, giá > 0. Chưa chạy nghiệm thu trong bước tài liệu |
| AT-06 | Hai người cập nhật cùng version SKU | Một thành công, người còn lại conflict |
| AT-07 | K sửa địa chỉ, xem đơn cũ | Snapshot người nhận/địa chỉ giữ nguyên |
| AT-08 | K đọc/hủy đơn, xem ticket K khác | 404, không lộ dữ liệu |
| AT-09 | Hai khách mua SKU available=1 cùng lúc | Một đơn giữ được hàng; available không âm |
| AT-10 | Hai POST cùng request_key/cùng nội dung | Cùng một order_id, chỉ một lần giữ hàng/lượt mã |
| AT-11 | POST cùng key nhưng khác cart/địa chỉ | Conflict, không tạo thêm đơn |
| AT-12 | Giả mạo giá/tổng/phí/giảm từ browser | Server tính lại; không chấp nhận số tiền giả |
| AT-13 | Giá đổi sau báo giá trước confirm | Yêu cầu xác nhận báo giá mới, chưa tạo đơn |
| AT-14 | Lỗi sau giữ SKU đầu hoặc insert order_item | Rollback tất cả order/reservation/mã/movement |
| AT-15 | Hủy lặp và hủy đồng thời với xác nhận | Hoàn giữ tối đa một lần; một transition thắng |
| AT-16 | ONLINE chưa PAID, N xác nhận | Bị chặn |
| AT-17 | Callback sai chữ ký/reference/amount/currency | Không PAID, log redacted |
| AT-18 | Callback success lặp rồi failure cũ | Một khoản thu; PAID không bị lùi |
| AT-19 | Hết hạn và success chạy đồng thời | Một kết quả theo khóa; không mất dấu tiền thực thu |
| AT-20 | Success đến sau CANCELLED | Không mở lại đơn/tồn; tiền thu + REFUND_PENDING |
| AT-21 | Cổng timeout khi tạo payment/shipment | Retry/tra cứu cùng key, không tạo yêu cầu trùng |
| AT-22 | DELIVERED COD rồi xác nhận chứng từ hai lần | Trước thu UNPAID; sau thu một payment SUCCEEDED |
| AT-23 | Giao thất bại, chưa nhận lại hàng | Không cộng on_hand |
| AT-24 | RETURNED gửi lặp | on_hand tăng đúng một lần, DELIVERY_FAILED |
| AT-25 | Hai khách tranh lượt mã cuối | Một redemption HELD; không vượt limit |
| AT-26 | Hủy trước bàn giao với mã giảm | RELEASED một lần; tổng/snapshot đơn giữ nguyên |
| AT-27 | Người chưa nhận hoặc không chủ đơn đánh giá | Từ chối; người hợp lệ một review/order_item |
| AT-28 | Sửa review APPROVED hoặc ADMIN ẩn | Không public cho tới duyệt; trung bình tính lại |
| AT-29 | K đọc ticket có tin internal | Chỉ thấy tin public; N/Q thấy internal |
| AT-30 | Report ngày Asia/Saigon có đơn sát 00:00 | Khoảng UTC đúng; CSV và màn hình khớp |
| AT-31 | Đơn hủy, thu muộn và hoàn ở kỳ khác | Không doanh thu hàng; cash thu/hoàn theo ngày thực |
| AT-32 | Hoàn tiền duplicate/amount vượt tiền thu | Không ghi hoàn hai lần/vượt số còn phải hoàn |
| AT-33 | N đọc audit hoặc upload tệp giả ảnh | Bị chặn; không lưu/chạy tệp giả |
| AT-34 | Restart server và đăng nhập tiếp | Phiên/giỏ lưu bền vững; có thể xem giao dịch cũ |
| AT-35 | CUSTOMER thêm SKU, đăng xuất, đăng nhập lại cùng tài khoản; thay đổi giá/tồn trước đặt | Quy tắc chốt 14/10/2026: giỏ tài khoản còn nguyên; phiên cũ không truy cập được; giá/tồn được kiểm tra lại trước tạo đơn. Giỏ không giữ hàng; tài khoản khác không thấy giỏ này. Chưa chạy nghiệm thu trong bước tài liệu |

## 3. Kiểm tra chất lượng tài liệu

### Ca bổ sung về hỗ trợ (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-56 | CUSTOMER tạo/xem yêu cầu gắn đơn của mình, rồi gửi ID đơn/yêu cầu của người khác | Chỉ thao tác trên dữ liệu của mình; không tạo yêu cầu cho đơn người khác hoặc lộ hội thoại |
| AT-57 | STAFF/ADMIN trả lời công khai và thêm ghi chú nội bộ; khách đọc yêu cầu | Khách chỉ nhận tin công khai; nội dung nội bộ không có trong HTML/JSON gửi về khách; khách không tự tạo tin nội bộ |
| AT-58 | STAFF/ADMIN xử lý yêu cầu mới đến đang xử lý rồi đóng | Lưu trạng thái và người thao tác, hiển thị trạng thái cho chủ yêu cầu; thao tác không có quyền bị chặn |


### Ca bổ sung về gợi ý (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-53 | Xem sản phẩm khi có ứng viên công khai cùng danh mục/thương hiệu/giá gần và ứng viên nháp/ẩn/hết hàng | Ưu tiên theo tiêu chí đã chốt; loại sản phẩm đang xem và nháp/ẩn/hết hàng; mỗi kết quả có ít nhất một SKU còn bán được |
| AT-54 | Gợi ý có lý do “Cùng thương hiệu” hoặc “Giá tương tự” | Lý do khớp dữ liệu và quy tắc xếp hạng đã thiết kế; không giả thông tin bán chạy hoặc quan hệ tương tự |
| AT-55 | Không có ứng viên phù hợp | Hiển thị trạng thái rỗng hoặc gợi ý khác theo thiết kế rõ ràng; không lấp bằng hàng ẩn/hết tồn; không cần dịch vụ ML |


### Ca bổ sung về so sánh (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-50 | Thêm 3 SKU cùng danh mục, rồi thêm SKU thứ tư hoặc khác danh mục | Giữ tối đa 3 SKU cùng danh mục; báo lỗi, không âm thầm thay SKU đã chọn |
| AT-51 | So sánh SKU còn hàng với SKU hết hàng, sau đó ADMIN ẩn một SKU đã chọn | Hết hàng vẫn so sánh; SKU bị ẩn không xuất hiện khi đọc lại danh sách; không lộ dữ liệu nháp/ẩn |
| AT-52 | So sánh giá/cấu hình/thông số có đơn vị, một giá trị khác và một giá trị thiếu | Hiển thị nhất quán; đánh dấu khác biệt; dữ liệu thiếu ghi “Chưa có thông tin”, không suy đoán giá trị |


### Ca bổ sung về thông số (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-47 | STAFF tạo/sửa định nghĩa thông số; ADMIN tạo định nghĩa có kiểu, đơn vị và dấu bắt buộc | STAFF bị từ chối; ADMIN được quản lý; nhân viên chỉ nhập giá trị cho SKU |
| AT-48 | Nhập giá trị sai kiểu hoặc định nghĩa thuộc danh mục khác vào SKU | Không lưu dữ liệu không hợp lệ; báo trường cần sửa; không công bố nếu thiếu thông số bắt buộc |
| AT-49 | Hai SKU có thông số chuẩn và một trường tùy chọn chưa có giá trị | So sánh cùng tên/đơn vị; trường thiếu hiển thị chưa có thông tin, không biến thành 0 hoặc false |


### Ca bổ sung về công bố (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-44 | ADMIN công bố sản phẩm thiếu lần lượt tên/danh mục/thương hiệu/mô tả/ảnh hợp lệ/thông số bắt buộc/SKU có mã và giá > 0 | Không công bố; thông báo dữ liệu cần bổ sung; sản phẩm vẫn nháp |
| AT-45 | Công bố sản phẩm đủ dữ liệu nhưng mọi SKU bật bán có tồn khả dụng bằng 0 | Được công bố, hiển thị “Hết hàng”; gửi đặt mua trực tiếp cũng bị chặn, không tạo đơn/giữ hàng |
| AT-46 | Sản phẩm có SKU A hết hàng, SKU B còn hàng | A không mua được; B mua được theo tồn khả dụng; không gán “Hết hàng” cho toàn sản phẩm khi B còn hàng |


### Ca bổ sung về quên mật khẩu (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-41 | Yêu cầu reset cho email tồn tại và không tồn tại | Cùng thông báo công khai; email hợp lệ được gửi liên kết khi cấu hình SMTP; không lộ trạng thái tài khoản qua thông báo |
| AT-42 | Dùng token hợp lệ, sai, đã dùng hoặc hết hạn 30 phút | Chỉ token hợp lệ còn hạn dùng được một lần; trường hợp còn lại không đổi mật khẩu |
| AT-43 | Reset thành công khi có nhiều phiên, giỏ tài khoản và đơn cũ | Mọi phiên cũ mất hiệu lực, đăng nhập lại bằng mật khẩu mới; giỏ/lịch sử đơn giữ nguyên; lỗi giữa giao dịch rollback |


### Ca bổ sung về đổi mật khẩu (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-39 | Người dùng đang có hai phiên, giỏ tài khoản và đơn cũ; đổi mật khẩu đúng mật khẩu hiện tại | Mọi phiên cũ mất hiệu lực, kể cả phiên đổi; đăng nhập lại bằng mật khẩu mới; mật khẩu cũ không đăng nhập được; giỏ tài khoản và lịch sử đơn giữ nguyên |
| AT-40 | Đổi mật khẩu với mật khẩu hiện tại sai hoặc lỗi lưu giữa giao dịch | Không thay mật khẩu, không vô hiệu phiên do thao tác thất bại; giỏ/lịch sử đơn không thay đổi |


### Ca bổ sung về gộp giỏ (đã chốt nghiệp vụ, chưa chạy nghiệm thu)

| Mã | Thiết lập và hành động | Kết quả mong đợi |
|---|---|---|
| AT-36 | Giỏ tài khoản có SKU A số lượng 2, giỏ vãng lai có A số lượng 1 và B số lượng 1; đăng nhập CUSTOMER | A số lượng 3, B số lượng 1; giỏ cũ khác giữ nguyên; không giữ kho |
| AT-37 | Tải trang hoặc gửi lại cùng yêu cầu gộp | Không cộng số lượng lần hai; lỗi giữa giao dịch không để giỏ bị gộp một phần |
| AT-38 | Tổng số lượng gộp vượt tồn hoặc giới hạn | Báo mục cần điều chỉnh trước đặt; không âm thầm bỏ hàng, không tạo đơn vượt tồn/giới hạn |


- Có đủ 5 tác nhân, trạng thái khách vãng lai tách khỏi CUSTOMER nhưng không thêm tác nhân kinh doanh ngoài phạm vi.
- Mỗi mã UC có đúng một đặc tả, ít nhất một sơ đồ tác nhân liên quan và bảng dữ liệu hỗ trợ hoặc được giải thích là dữ liệu tạm/tính toán.
- Quyền giá chỉ ADMIN ở tất cả tài liệu/sơ đồ; STOCK và PAID không được đồng nhất; SHIPPING cần bàn giao; COD DELIVERED chưa tự PAID.
- Include/extend không dùng thay thứ tự quy trình; luồng chính và ngoại lệ có hậu điều kiện rõ.
- ERD có khóa, cardinality, unique, null, CHECK và ràng buộc liên bảng; migration phân biệt tồn khả dụng bản cũ với on_hand/reserved mục tiêu.
- Mọi giả định được đánh dấu; nhà cung cấp/biểu phí chưa lựa chọn không được coi đã tích hợp.

## 4. Hạng mục cần cấu hình/xác nhận trước triển khai

| Nội dung | Thiết kế mặc định | Ảnh hưởng nếu thay |
|---|---|---|
| STAFF tạo nháp | Đã chốt 14/10/2026: nhập thông tin/ảnh/cấu hình/tồn; ADMIN đặt giá/công bố/ẩn | UC-08,10,12, quyền và trạng thái SKU |
| Tài khoản quản lý mua hàng | Đã chốt 14/10/2026: dùng CUSTOMER riêng; STAFF/ADMIN chỉ thao tác quản lý | UC-16..22 và ma trận quyền |
| Mốc khách hủy | Chỉ PENDING | UC-20, BR-06, trạng thái/ca AT-15 |
| Hạn thanh toán | 15 phút cấu hình | UC-22, deadline/reservation/job hết hạn |
| Thanh toán/vận chuyển | COD + một sandbox; một shipment/đơn | Adapter, event signatures, ERD payments/shipments |
| Phí giao | Biểu phí theo địa bàn/trọng lượng | shipping_rates, UC-17, tổng snapshot |
| Mã giảm | Một mã, không cộng dồn, lượt giữ tính limit | promotions/redemptions và BR-10 |
| Đánh giá | Một review mỗi dòng đã giao | UC-27 và unique order_item |
| Giao thất bại/hoàn tiền | Hàng thực về mới cộng kho; hoàn tiền thủ công | UC-26,34, ledger và ngoại lệ |

Đây là danh sách quyết định thiết kế để người đọc rà soát, không là yêu cầu dừng viết tài liệu. Chưa chạy các ca AT như chức năng đã có; kiểm thử hiện tại của code chỉ bao phủ một phần bản demo COD.

## 5. Kiểm tra tài liệu thực hiện ngày 05/10/2026

- Đối chiếu 34 mã use case UC-01..34, mỗi mục có đủ 6 trường nhóm đặc tả: tác nhân/mục tiêu, tiền điều kiện/kích hoạt, luồng chính, thay thế/lỗi, hậu điều kiện, nghiệm thu.
- Kiểm tra đường dẫn nội bộ và cặp code fence của 10 file Markdown, tham chiếu alias của 6 file PlantUML, 34 bảng ERD và 34 dòng từ điển dữ liệu tương ứng: đạt.
- Rà soát thủ công quyền giá, tồn giữ/tiêu thụ/hoàn, callback muộn, trạng thái đơn/thanh toán/giao, các giả định và dẫn chiếu bản lịch sử.
- Chưa chạy bộ render PlantUML/Mermaid trong môi trường này; kiểm tra nguồn và tham chiếu không thay thế kiểm tra hình xuất SVG/PNG. Khi xuất báo cáo cần render bằng trình hỗ trợ và xem bố cục. Các ca AT-01..34 là tiêu chí triển khai tương lai, không được ghi là đã chạy đạt.
