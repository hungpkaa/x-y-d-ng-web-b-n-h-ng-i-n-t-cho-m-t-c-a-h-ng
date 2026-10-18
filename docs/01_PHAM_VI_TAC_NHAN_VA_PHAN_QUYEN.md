# 01. Phạm vi, tác nhân và phân quyền

Tên đề tài: Xây dựng website thương mại điện tử bán đồ điện tử cho một cửa hàng.

Trạng thái: Tài liệu mục tiêu phiên bản 1.0, cập nhật ngày 13/10/2026. Đã thống nhất ngày 02/10/2026: chỉ quản trị viên được sửa giá sản phẩm; nhân viên được cập nhật thông tin sản phẩm và tồn kho. Đã thống nhất thêm: khách được xem sản phẩm và quản lý giỏ hàng trước khi đăng nhập, nhưng phải đăng nhập trước khi xác nhận đặt hàng. Các lựa chọn khác là giả định thiết kế, chưa được phê duyệt riêng. Xem [chỉ mục và giả định](README.md), [đặc tả](05_DAC_TA_USE_CASE.md) và [quy tắc](06_QUY_TAC_VA_SO_DO_LUONG.md).

Tài liệu tham chiếu: “TÁC NHÂN VÀ NGHIỆP VỤ HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ”, “USE CASE PHÂN RÃ HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ” và sơ đồ use case tổng quát đã cung cấp. Tài liệu này mô tả hệ thống mục tiêu, không xác nhận mức độ hoàn thành của mã nguồn.

## 1. Mục tiêu

Xây dựng website hỗ trợ một cửa hàng giới thiệu và bán sản phẩm điện tử trực tuyến. Khách hàng có thể tìm hiểu, so sánh, lựa chọn sản phẩm, đặt mua và theo dõi đơn hàng. Nhân viên xử lý sản phẩm, đơn hàng và yêu cầu hỗ trợ. Quản trị viên quản lý dữ liệu, tài khoản và theo dõi hoạt động kinh doanh.

Hệ thống cần lưu lại thông tin giao dịch để khách hàng tra cứu lịch sử mua hàng và cửa hàng theo dõi đơn, tồn kho, doanh thu.

## 2. Phạm vi

### 2.1. Chức năng thuộc phạm vi đề tài

| Nhóm | Nội dung |
|---|---|
| Tài khoản | Đăng ký, đăng nhập, đăng xuất, cập nhật thông tin cá nhân; quản trị khóa/mở khóa tài khoản và quản lý nhân viên |
| Sản phẩm | Danh sách, chi tiết, tìm kiếm, lọc, sắp xếp; quản lý sản phẩm, số lượng, danh mục và thương hiệu |
| So sánh | Chọn sản phẩm, xem các thông số tương ứng và bỏ sản phẩm khỏi danh sách so sánh |
| Gợi ý | Sản phẩm tương tự theo danh mục, thương hiệu, khoảng giá; sản phẩm phổ biến/bán chạy |
| Giỏ hàng | Thêm, xem, đổi số lượng, xóa và tính tổng tiền |
| Đặt hàng | Kiểm tra giỏ, nhập thông tin nhận hàng, chọn phương thức thanh toán, xác nhận và tạo đơn |
| Thanh toán | Đã chốt: COD và VNPay sandbox phục vụ đồ án, chưa giao dịch tiền thật; gửi yêu cầu, nhận kết quả và cập nhật trạng thái thanh toán |
| Đơn hàng | Khách xem đơn của mình; nhân viên xác nhận/cập nhật trạng thái; quản trị theo dõi toàn bộ đơn |
| Vận chuyển | Đã chốt: cập nhật thủ công phục vụ đồ án; STAFF/ADMIN nhập hãng, mã vận đơn và trạng thái giao hàng; API hãng để giai đoạn sau |
| Đánh giá | Khách đánh giá sản phẩm đã mua; quản trị xem, ẩn hoặc xóa nội dung không phù hợp |
| Khuyến mãi | Quản lý chương trình, mức giảm, thời gian và điều kiện áp dụng |
| Hỗ trợ | Nhân viên tra cứu đơn và hỗ trợ vấn đề liên quan đến đơn hàng |
| Báo cáo | Doanh thu, số đơn, sản phẩm bán chạy, số sản phẩm và số khách hàng |

### 2.2. Giới hạn đề xuất

- Phục vụ một cửa hàng; không xây sàn cho nhiều người bán hoặc quản lý nhiều chi nhánh.
- Recommendation dựa trên quy tắc, không dùng Machine Learning phức tạp, theo phạm vi hai tài liệu gốc.
- Website tích hợp VNPay sandbox. Vận chuyển dùng cập nhật thủ công trong bản đồ án; tích hợp API hãng để giai đoạn sau. Không xây hệ thống nội bộ của các bên này.
- Không đưa kế toán đầy đủ, quản lý nhà cung cấp/nhập hàng, chat realtime, ứng dụng di động riêng vào bản đầu.
- Quản lý bảo hành, đổi trả và hoàn tiền tự động chưa được mô tả trong tài liệu gốc. Nếu thêm, cần mở rộng đặc tả và phạm vi rõ ràng.

Các chức năng thuộc phạm vi nhưng làm ở giai đoạn sau vẫn là yêu cầu cần hoàn thành; không được xem một bản demo COD là đã đáp ứng toàn bộ đề tài.

## 3. Tác nhân

| Mã | Tác nhân | Mô tả và trách nhiệm |
|---|---|---|
| ACT-01 | Khách hàng | Tìm hiểu sản phẩm, so sánh, quản lý giỏ hàng, đặt mua, thanh toán, xem đơn và đánh giá sản phẩm đã mua |
| ACT-02 | Nhân viên bán hàng | Thêm/cập nhật thông tin sản phẩm và số lượng, không được sửa giá; kiểm tra, xác nhận, xử lý đơn; hỗ trợ khách hàng |
| ACT-03 | Quản trị viên | Quản lý tài khoản, nhân viên, sản phẩm, danh mục, thương hiệu, đơn, khuyến mãi, đánh giá và báo cáo |
| ACT-04 | Cổng thanh toán | Tiếp nhận yêu cầu thanh toán và gửi kết quả giao dịch về website |
| ACT-05 | Đơn vị vận chuyển | Tiếp nhận yêu cầu giao hàng và cung cấp trạng thái vận chuyển |

Đề xuất phân biệt hai trạng thái sử dụng của khách hàng: khách vãng lai và khách đã đăng nhập. Đây là cách làm rõ quyền trong ACT-01, không bắt buộc bổ sung một tác nhân nghiệp vụ độc lập.

## 4. Ma trận phân quyền đề xuất

Ký hiệu: “Có” là được thực hiện; “Không” là không được thực hiện. Bảng dưới áp dụng cho các màn hình và thao tác nghiệp vụ trong vai trò tương ứng.

| Chức năng | Vãng lai | Khách đã đăng nhập | Nhân viên | Quản trị |
|---|---|---|---|---|
| Xem, tìm kiếm, lọc, sắp xếp sản phẩm | Có | Có | Có | Có |
| So sánh và xem gợi ý | Có | Có | Có | Có |
| Đăng ký tài khoản khách hàng | Có | Không | Không | Không |
| Đăng nhập | Có | Không | Không | Không |
| Đăng xuất, cập nhật hồ sơ của mình | Không | Có | Có | Có |
| Quản lý giỏ hàng | Có | Có | Không | Không |
| Đặt hàng, thanh toán | Không | Có | Không | Không |
| Xem đơn cá nhân | Không | Có | Không | Không |
| Gửi đánh giá sản phẩm đã mua | Không | Có | Không | Không |
| Tạo bản nháp/cập nhật thông tin sản phẩm (không gồm giá) | Không | Không | Có | Có |
| Đặt giá SKU và công bố sản phẩm | Không | Không | Không | Có |
| Cập nhật tồn kho | Không | Không | Có | Có |
| Sửa giá sản phẩm | Không | Không | Không | Có |
| Ẩn sản phẩm | Không | Không | Không | Có |
| Quản lý danh mục, thương hiệu | Không | Không | Không | Có |
| Xem, xác nhận, cập nhật trạng thái đơn toàn cửa hàng | Không | Không | Có | Có |
| Tra cứu đơn để hỗ trợ khách | Không | Không | Có | Có |
| Khóa/mở khóa tài khoản khách | Không | Không | Không | Có |
| Tạo/sửa/khóa tài khoản nhân viên | Không | Không | Không | Có |
| Quản lý khuyến mãi | Không | Không | Không | Có |
| Quản lý đánh giá | Không | Không | Không | Có |
| Xem báo cáo/thống kê | Không | Không | Không | Có |
| Hủy đơn cá nhân khi PENDING | Không | Chủ đơn | Không | Không |
| Quản lý ảnh, SKU và thuộc tính (không gồm giá/công bố) | Không | Không | Có | Có |
| Tạo vận đơn/cập nhật vận chuyển thủ công | Không | Không | Có | Có |
| Xác nhận thu COD/ghi nhận hoàn tiền thủ công | Không | Không | Không | Có |
| Gửi/xem yêu cầu hỗ trợ | Không | Của mình | Toàn cửa hàng | Toàn cửa hàng |
| Xem nhật ký quản trị | Không | Không | Không | Có |

Đã chốt ngày 14/10/2026: STAFF tạo bản nháp, nhập thông tin, ảnh, cấu hình và tồn kho; ADMIN thiết lập giá và công bố sản phẩm, chỉ ADMIN được ẩn sản phẩm. Nháp không hiển thị cho khách. STAFF/ADMIN dùng tài khoản khách riêng khi mua. Điều kiện công bố và chi tiết bật/tắt SKU cần rà soát riêng; các quyền chưa được đánh dấu đã chốt vẫn là đề xuất. Kết quả triển khai xem [tiến độ](09_TIEN_DO_TRIEN_KHAI.md), không suy ra từ thiết kế mục tiêu.

“Đăng nhập” trong bảng là thao tác khi chưa có phiên đăng nhập. Nhân viên và quản trị vẫn có chức năng đăng nhập bằng tài khoản được cấp.

Cổng thanh toán chỉ gửi kết quả giao dịch qua điểm tích hợp được xác thực. Trong bản đồ án, nhân viên nhập hãng, mã vận đơn và trạng thái thay cho kết nối trực tiếp với đơn vị vận chuyển; dữ liệu mô phỏng phải ghi rõ. ACT-05 được giữ để mô tả bối cảnh nghiệp vụ; các callback/API hãng trong thiết kế mục tiêu thuộc phần mở rộng. Hai tác nhân bên ngoài không có quyền quản trị website.

## 5. Nguyên tắc nghiệp vụ ban đầu

Các nguyên tắc sau là đề xuất cần thống nhất trước khi đặc tả từng use case:

1. Đã thống nhất: khách vãng lai được xem sản phẩm và quản lý giỏ hàng; phải đăng nhập trước khi xác nhận đặt hàng.
2. Khách chỉ được xem và thao tác trên dữ liệu cá nhân, giỏ hàng, đơn hàng của mình.
3. Giá và tổng thanh toán được tính từ dữ liệu hợp lệ của hệ thống; không lấy tổng tiền do trình duyệt tự gửi làm kết quả cuối.
4. Mỗi đơn lưu thông tin người nhận và giá sản phẩm tại thời điểm mua để thay đổi dữ liệu sau này không làm sai lịch sử.
5. Không tạo đơn nếu sản phẩm không còn bán hoặc không đủ tồn kho.
6. Đơn hàng, thanh toán và vận chuyển có trạng thái riêng; chi tiết chuyển trạng thái sẽ được đặc tả ở phần đơn hàng.
7. Chỉ chủ đơn đã nhận sản phẩm mới được đánh giá; một đánh giá trên mỗi dòng đơn, có thể sửa nội dung của chính mình và phải duyệt lại.
8. Ưu tiên ẩn sản phẩm, khóa tài khoản để bảo toàn lịch sử; không xóa dữ liệu làm mất thông tin đơn đã phát sinh.
9. Nhân viên không được tự cấp quyền quản trị hoặc thay đổi vai trò tài khoản.
10. Kết quả tích hợp bên ngoài phải được kiểm tra tính hợp lệ trước khi thay đổi trạng thái trong website.
11. Đã thống nhất: chỉ quản trị viên được sửa giá sản phẩm. Nhân viên chỉ cập nhật thông tin sản phẩm và tồn kho trong phạm vi được cấp quyền.

## 6. Những điểm cần chốt

Điều kiện công bố đã chốt: có tên, danh mục, thương hiệu, mô tả, ít nhất một ảnh hợp lệ, đủ thông số bắt buộc theo danh mục và ít nhất một SKU bật bán có mã riêng, giá > 0. Sản phẩm hết hàng vẫn được hiển thị, nhưng không cho đặt mua SKU hết hàng. Xem UC-12 và AT-44..46; cơ chế bật/tắt từng SKU cần rà soát riêng.

Đã chốt ngày 14/10/2026 về tài khoản: chỉ ADMIN khóa/mở khóa CUSTOMER hoặc STAFF, phải ghi lý do; khóa vô hiệu mọi phiên hiện có, mở khóa cần đăng nhập lại. Không xóa tài khoản và lịch sử đơn hàng.

Đã chốt ngày 14/10/2026: phí giao hàng cố định do ADMIN cấu hình; hiển thị trước xác nhận đặt hàng và lưu nguyên trên đơn đã tạo. Biểu phí khu vực/trọng lượng để giai đoạn mở rộng. Số tiền phí cụ thể và địa bàn phục vụ chưa chốt.

| Nội dung | Đề xuất ban đầu | Khi nào cần chốt |
|---|---|---|
| Đăng nhập trước khi đặt hàng | Đã chốt: được xem sản phẩm và quản lý giỏ hàng trước đăng nhập; bắt buộc đăng nhập trước khi xác nhận đặt hàng | Đã được người dùng đồng ý |
| Phương thức thanh toán | Đã chốt: COD và VNPay sandbox phục vụ đồ án; chưa giao dịch tiền thật | Đã thống nhất ngày 13/10/2026 |
| Nhà cung cấp thanh toán | Đã chọn VNPay sandbox; thông tin merchant và URL callback chưa chốt, kết nối chưa nghiệm thu | Cấu hình và kiểm thử trước tích hợp |
| Vận chuyển | Đã chốt: cập nhật thủ công; STAFF/ADMIN nhập hãng, mã vận đơn, trạng thái; API hãng để giai đoạn sau. Một kiện/đơn vẫn là giả định | Chế độ thủ công đã thống nhất ngày 13/10/2026; rà soát số kiện riêng |
| Nhân viên sửa giá sản phẩm | Đã chốt: không được; chỉ quản trị viên được sửa giá | Đã thống nhất ngày 02/10/2026 |
| Nhân viên/quản trị mua hàng | Đã chốt: dùng tài khoản CUSTOMER riêng; STAFF/ADMIN chỉ dùng nghiệp vụ quản lý | Đã thống nhất ngày 14/10/2026 |
| Biến thể | SKU theo màu/cấu hình, giá và tồn riêng; đã mô hình hóa ở ERD | Rà soát đặc tính theo danh mục |
| Hủy đơn | Đã chốt: khách chỉ hủy đơn của mình khi PENDING; STAFF/ADMIN hủy trước bàn giao, phải ghi lý do. Đã thu tiền thì ghi khoản cần hoàn, không tự đánh dấu đã hoàn | Đã thống nhất ngày 13/10/2026 |
| Đổi trả/cách thực hiện hoàn tiền | Đổi trả ngoài phạm vi đề xuất; hoàn tiền thủ công có bằng chứng là giả định thiết kế, chưa chốt riêng | Rà soát trước triển khai |
| Hỗ trợ khách hàng | Ticket gắn đơn, tin public/internal và lịch sử trạng thái | Rà soát UC-30/31 trước triển khai |

## 7. Thứ tự hoàn thiện bộ tài liệu

Mỗi bước viết và rà soát xong rồi mới chuyển tiếp. Chưa triển khai thêm website trong giai đoạn tài liệu.

1. Phạm vi, tác nhân và phân quyền — tài liệu hiện tại.
2. Danh sách use case có mã và chỉnh sơ đồ tổng quát/phân rã.
3. Đặc tả use case theo nhóm, bắt đầu từ tài khoản; sau đó sản phẩm, giỏ hàng, đặt hàng, thanh toán và các nhóm còn lại.
4. Quy tắc nghiệp vụ và sơ đồ hoạt động/trạng thái cho đơn, thanh toán, vận chuyển.
5. ERD, từ điển dữ liệu và ràng buộc.
6. Thiết kế màn hình và kiến trúc Node.js; đặc tả API phù hợp thiết kế.
7. Kịch bản kiểm thử, tiêu chí nghiệm thu và kế hoạch triển khai.

Chỉ chuyển sang triển khai web sau khi bộ tài liệu đã được thống nhất và các quyết định ảnh hưởng tới luồng mua hàng được chốt. Các file mã nguồn đã tạo trước đó giữ làm tham khảo, không dùng để ép phạm vi thiết kế.

## 8. Phân quyền ở mức dữ liệu và tích hợp

- ACT-01 có hai trạng thái: vãng lai và CUSTOMER đăng nhập. Quyền công khai không cho phép đọc sản phẩm nháp/ẩn, hồ sơ hay đơn của người khác.
- ACT-02/03 phải có tài khoản ACTIVE và phiên còn hiệu lực. Backend kiểm tra vai trò mỗi yêu cầu; khóa tài khoản tăng phiên bản xác thực để vô hiệu hóa phiên cũ ngay ở lần truy cập tiếp theo.
- Mọi thao tác đổi dữ liệu qua trình duyệt phải có CSRF hợp lệ. ID không thay thế kiểm tra quyền sở hữu; với dữ liệu riêng không tồn tại/không thuộc quyền trả cùng kết quả 404.
- STAFF không sửa giá, mã giảm giá, tài khoản, vai trò, xác nhận tiền hoặc nhật ký. Không dùng payload có cột không được phép để cập nhật toàn bộ bản ghi.
- ADMIN không tự khóa/hạ quyền tài khoản của mình hoặc khóa ADMIN ACTIVE cuối cùng. Đăng ký công khai luôn tạo CUSTOMER; tạo STAFF không nhận quyền ADMIN từ biểu mẫu.
- ACT-04 chỉ gửi sự kiện thanh toán đã xác thực, tham chiếu đến giao dịch được tạo trước; không truy cập phiên quản trị. Trong phần mở rộng API hãng, ACT-05 chỉ gửi sự kiện vận chuyển đã xác thực cho vận đơn đã liên kết; bản đồ án hiện dùng STAFF/ADMIN cập nhật thủ công.
- Sự kiện bên ngoài không dùng CSRF của trình duyệt; dùng chữ ký/xác thực nhà cung cấp, kiểm tra số tiền, tiền tệ, mã tham chiếu và khóa chống lặp.
- Tác vụ hết hạn thanh toán chạy nội bộ theo lịch, không phải tác nhân kinh doanh thứ sáu; chỉ tác động đơn/giao dịch đủ điều kiện.
- Dữ liệu tối thiểu theo tác nhân: CUSTOMER xem dữ liệu của mình; STAFF xem địa chỉ/điện thoại phục vụ đơn và hỗ trợ; ADMIN xem báo cáo, nhật ký; nhà vận chuyển chỉ nhận dữ liệu giao hàng; cổng thanh toán chỉ nhận tham chiếu và số tiền cần thiết.

## 9. Hồ sơ tác nhân và ranh giới trách nhiệm

| Tác nhân | Mục tiêu | Đầu vào cung cấp | Kết quả nhận | Giới hạn |
|---|---|---|---|---|
| ACT-01 Khách hàng | Chọn thiết bị, mua, theo dõi và phản hồi | Từ khóa/bộ lọc, SKU, số lượng, địa chỉ, mã giảm, đánh giá, tin hỗ trợ | Catalog, báo giá, xác nhận đơn, trạng thái, trả lời hỗ trợ | Không sửa giá/tồn, không xem dữ liệu khách khác; vãng lai không xác nhận mua |
| ACT-02 Nhân viên | Chuẩn bị catalog, kho và giao hàng; giải quyết hỗ trợ | Bản nháp, thông số/ảnh, delta tồn có lý do, bước xử lý đơn, vận đơn thủ công, trả lời | Hàng đợi đơn/ticket, lịch sử, kết quả lưu | Không định giá/công bố, quản lý tài khoản, khuyến mãi, báo cáo hoặc xác nhận tiền |
| ACT-03 Quản trị viên | Kiểm soát hoạt động cửa hàng và quyền người dùng | Giá, công bố/ẩn, tài khoản STAFF, khóa user, chương trình giảm, duyệt review, bằng chứng thu/hoàn | Dữ liệu quản trị, doanh thu/tiền thu/hoàn, nhật ký | Không sửa/xóa lịch sử giao dịch, không giả mạo đánh giá hoặc trạng thái tiền thiếu bằng chứng |
| ACT-04 Cổng thanh toán | Xử lý giao dịch trực tuyến ngoài website | Kết quả tạo yêu cầu, reference, transaction/event ID, trạng thái và chữ ký | Yêu cầu thanh toán và ACK callback | Website không lưu thông tin thẻ; cổng không có phiên ADMIN hoặc quyền sửa đơn tùy ý |
| ACT-05 Đơn vị vận chuyển | Nhận kiện và thông báo kết quả giao | Mã vận đơn, event ID, trạng thái, thời điểm và xác thực | Địa chỉ/điện thoại nhận, kiện hàng, tiền COD cần thu, ACK | Không truy cập catalog quản trị; báo đã giao không đồng nghĩa website đã đối soát COD |

Cổng và đơn vị vận chuyển là hệ thống ngoài biên Electro Store. CSDL, worker, bộ gợi ý và phiên đăng nhập là thành phần nội bộ, không phải tác nhân. Nhân viên/quản trị là người dùng nội bộ nhưng vẫn ở ngoài biên phần mềm trong UML. Số lượng nhân viên/khách không đổi loại tác nhân.
