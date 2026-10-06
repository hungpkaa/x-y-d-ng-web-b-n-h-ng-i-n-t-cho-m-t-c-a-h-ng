# Đặc tả use case

Phiên bản 1.0 — 05/10/2026. Áp dụng giả định tại [chỉ mục](README.md), quyền tại [01](01_PHAM_VI_TAC_NHAN_VA_PHAN_QUYEN.md), quy tắc tại [06](06_QUY_TAC_VA_SO_DO_LUONG.md). Mỗi mục có tác nhân/mục tiêu, tiền điều kiện, kích hoạt, luồng chính, luồng lỗi/thay thế, hậu điều kiện và nghiệm thu.

## Điều kiện chung

- Use case bảo vệ cần tài khoản ACTIVE, vai trò đúng và phiên hợp lệ; thao tác trình duyệt thay đổi dữ liệu cần CSRF. Hết phiên yêu cầu đăng nhập lại, không tự thực hiện thay đổi.
- Từ chối thao tác ngoài quyền trước khi ghi dữ liệu. Đơn, hỗ trợ, địa chỉ, đánh giá cá nhân kiểm tra chủ sở hữu. Không tin ID, giá, tổng tiền, vai trò từ trình duyệt.
- Lỗi validation trả thông báo theo trường, giữ dữ liệu không nhạy cảm; lỗi hệ thống trả thông báo chung và mã truy vết. Không hiển thị mật khẩu, bí mật tích hợp hoặc truy vấn SQL.
- Thay đổi nhiều bảng trong nghiệp vụ phải cùng giao dịch; nếu thất bại rollback toàn bộ. Gửi yêu cầu ra bên ngoài sau commit qua integration_jobs; retry dùng cùng khóa yêu cầu, không giữ transaction khi chờ mạng.
- Tên/họ tên tối đa 120/80 ký tự; email chuẩn hóa trim + lowercase, tối đa 150; mật khẩu 10–128 ký tự; điện thoại nhận hàng 10 số bắt đầu 0; địa chỉ 10–300 ký tự; mô tả tối đa 2000. Giá nguyên VND 1–1 tỷ; số lượng dòng giỏ 1–99, tối đa 100 dòng; phí/giảm giá không âm, giảm không vượt giá hàng.
- Phân trang mặc định 20, tối đa 100; thứ tự ổn định thêm ID; trường sort/filter nằm trong danh sách cho phép.

## UC-01 — Đăng ký

- **Tác nhân/mục tiêu:** khách vãng lai tạo tài khoản CUSTOMER.
- **Tiền điều kiện:** chưa đăng nhập; kích hoạt bằng chọn Đăng ký.
- **Luồng chính:** (1) nhập tên/email/mật khẩu; (2) kiểm tra dữ liệu và email unique; (3) băm mật khẩu; (4) lưu CUSTOMER ACTIVE; (5) yêu cầu đăng nhập.
- **Thay thế/lỗi:** email trùng hoặc dữ liệu sai không tạo tài khoản; payload role bị bỏ qua; giới hạn tần suất ngăn đăng ký hàng loạt. Không tự cấp STAFF/ADMIN.
- **Hậu điều kiện:** một tài khoản được tạo, không lưu mật khẩu rõ.
- **Nghiệm thu:** email khác chữ hoa vẫn bị coi trùng; role=ADMIN vẫn chỉ tạo CUSTOMER; dữ liệu sai không tăng số tài khoản.

## UC-02 — Đăng nhập

- **Tác nhân/mục tiêu:** CUSTOMER/STAFF/ADMIN xác thực vào hệ thống.
- **Tiền điều kiện:** chưa có phiên; kích hoạt bằng gửi email/mật khẩu.
- **Luồng chính:** (1) chuẩn hóa email; (2) kiểm tra giới hạn thử; (3) kiểm tra mật khẩu và ACTIVE; (4) tạo ID phiên mới, giữ giỏ khách hợp lệ; (5) điều hướng theo vai trò.
- **Thay thế/lỗi:** sai mật khẩu/email/tài khoản khóa trả thông báo chung; vượt giới hạn trả 429; không chuyển giỏ khách sang tài khoản STAFF/ADMIN.
- **Hậu điều kiện:** phiên gắn user_id và auth_version hiện tại; mật khẩu không ghi log.
- **Nghiệm thu:** ID phiên trước đăng nhập không dùng được; tài khoản khóa không đăng nhập; URL trở lại chỉ được phép nội bộ.

## UC-03 — Đăng xuất

- **Tác nhân/mục tiêu:** người đã đăng nhập kết thúc phiên hiện tại.
- **Tiền điều kiện:** có phiên; kích hoạt bằng nút Đăng xuất.
- **Luồng chính:** (1) kiểm tra CSRF; (2) hủy phiên ở store; (3) xóa cookie; (4) về catalog.
- **Thay thế/lỗi:** phiên đã hết vẫn về trang công khai; CSRF sai không hủy phiên còn hiệu lực.
- **Hậu điều kiện:** cookie cũ không truy cập dữ liệu riêng; giỏ CUSTOMER đã lưu CSDL không mất.
- **Nghiệm thu:** phát lại cookie cũ không xem được đơn; GET không thực hiện logout.

## UC-04 — Cập nhật hồ sơ/mật khẩu

- **Tác nhân/mục tiêu:** K/N/Q sửa hồ sơ của mình.
- **Tiền điều kiện:** đăng nhập ACTIVE; kích hoạt mở Hồ sơ.
- **Luồng chính:** (1) xem hồ sơ/địa chỉ; (2) sửa tên, số điện thoại, địa chỉ; (3) nếu đổi mật khẩu nhập mật khẩu hiện tại và mới; (4) validate và lưu; (5) đổi mật khẩu tăng auth_version và buộc đăng nhập lại.
- **Thay thế/lỗi:** mật khẩu cũ sai không đổi; địa chỉ không thuộc mình bị từ chối. Email là định danh bất biến trong bản đầu; không cho sửa role/status từ hồ sơ.
- **Hậu điều kiện:** hồ sơ mới dùng cho lần mua sau; snapshot đơn cũ giữ nguyên.
- **Nghiệm thu:** không sửa hồ sơ/địa chỉ người khác; phiên cũ hết hiệu lực sau đổi mật khẩu.

## UC-05 — Quản lý tài khoản khách/nhân viên

- **Tác nhân/mục tiêu:** ADMIN cấp STAFF, sửa tên, khóa/mở khóa tài khoản.
- **Tiền điều kiện:** ADMIN ACTIVE; kích hoạt từ danh sách tài khoản có tìm kiếm/phân trang.
- **Luồng chính:** (1) chọn tài khoản hoặc tạo STAFF; (2) kiểm tra email và quyền; (3) lưu thông tin/trạng thái; (4) khi khóa tăng auth_version; (5) ghi audit gồm actor, trước/sau và lý do.
- **Thay thế/lỗi:** không tự khóa/hạ quyền chính mình hoặc ADMIN cuối; không xóa tài khoản có giao dịch; không đổi CUSTOMER thành ADMIN qua biểu mẫu. Tạo ADMIN thuộc quy trình bootstrap được kiểm soát, không thuộc UC này.
- **Hậu điều kiện:** tài khoản khóa không tiếp tục thao tác bằng phiên cũ; mở khóa không phục hồi phiên cũ.
- **Nghiệm thu:** STAFF gọi chức năng bị 403; khóa user làm yêu cầu kế tiếp bị từ chối; email unique vẫn bảo đảm.

## UC-06 — Duyệt/tìm/lọc/sắp xếp

- **Tác nhân/mục tiêu:** mọi người tìm sản phẩm đang bán.
- **Tiền điều kiện:** không yêu cầu đăng nhập; kích hoạt mở catalog hoặc gửi bộ lọc.
- **Luồng chính:** (1) nhập từ khóa; chọn danh mục/thương hiệu/khoảng giá; (2) server validate bộ lọc; (3) truy vấn ACTIVE có SKU đang bán; (4) phân trang và hiển thị giá từ SKU phù hợp.
- **Thay thế/lỗi:** không có kết quả hiển thị rỗng và xóa lọc; bộ lọc sai bị báo lỗi; hết tồn vẫn được xem nhưng không mua.
- **Hậu điều kiện:** không ghi dữ liệu; giữ điều kiện lọc/sort khi đổi trang.
- **Nghiệm thu:** không lộ DRAFT/HIDDEN; sản phẩm trên 100 vẫn truy cập được qua trang; sort ổn định khi giá bằng nhau.

## UC-07 — Xem chi tiết

- **Tác nhân/mục tiêu:** mọi người xem ảnh, thông số, SKU, giá, tồn, đánh giá công khai và thông tin bảo hành.
- **Tiền điều kiện:** sản phẩm ACTIVE; kích hoạt chọn sản phẩm.
- **Luồng chính:** (1) đọc thông tin; (2) chọn màu/cấu hình SKU; (3) hiển thị đúng giá/tồn SKU; (4) cho thêm giỏ nếu SKU mua được.
- **Thay thế/lỗi:** sản phẩm ẩn/không tồn tại trả 404; SKU hết tồn vô hiệu hóa mua; ảnh thiếu dùng ảnh thay thế; chỉ hiển thị đánh giá APPROVED.
- **Hậu điều kiện:** dữ liệu không đổi.
- **Nghiệm thu:** đổi SKU đổi đúng giá/tồn; không hiện đánh giá pending hoặc thông tin người nhận đơn.

## UC-08 — Tạo bản nháp sản phẩm/SKU

- **Tác nhân/mục tiêu:** STAFF/ADMIN chuẩn bị sản phẩm mới.
- **Tiền điều kiện:** danh mục/thương hiệu tồn tại; kích hoạt Thêm bản nháp.
- **Luồng chính:** (1) nhập tên/mô tả/danh mục/thương hiệu; (2) thêm SKU unique, màu/cấu hình và thông số; (3) kiểm tra dữ liệu; (4) lưu DRAFT, SKU inactive, giá NULL; (5) ghi audit.
- **Thay thế/lỗi:** SKU trùng rollback; STAFF gửi giá/trạng thái công bố bị 403; ADMIN thiết lập giá qua UC-10, không âm thầm công bố trong bước này.
- **Hậu điều kiện:** bản nháp không xuất hiện trong catalog. Tồn khởi tạo 0; ghi tăng tồn qua UC-11.
- **Nghiệm thu:** STAFF tạo được nháp không giá; không thể tạo SKU bán ngay; thất bại không để bản ghi con mồ côi.

## UC-09 — Cập nhật thông tin/ảnh/SKU/thông số

- **Tác nhân/mục tiêu:** STAFF/ADMIN cập nhật mô tả và dữ liệu kỹ thuật.
- **Tiền điều kiện:** sản phẩm/SKU tồn tại; kích hoạt Sửa.
- **Luồng chính:** (1) tải bản ghi và version; (2) sửa các trường cho phép; (3) validate thuộc tính theo danh mục; (4) kiểm tra version chống ghi đè; (5) lưu và audit.
- **Thay thế/lỗi:** STAFF gửi giá/active/status bị chặn; version cũ yêu cầu tải lại; SKU đã có đơn không đổi mã SKU; đổi danh mục phải ánh xạ thông số hoặc giữ nháp. Ảnh kiểm tra MIME thực, dung lượng tối đa 5MB, tên lưu do server tạo; không chạy tệp tải lên.
- **Hậu điều kiện:** thông tin hiện tại thay đổi; snapshot đơn cũ không đổi. SKU mới inactive, giá NULL.
- **Nghiệm thu:** XSS được escape; tệp giả ảnh bị chặn; sửa thông tin không thay giá/tồn; hai người sửa không âm thầm ghi đè.

## UC-10 — Thiết lập/sửa giá SKU

- **Tác nhân/mục tiêu:** chỉ ADMIN định giá.
- **Tiền điều kiện:** SKU tồn tại; kích hoạt Đặt giá/Sửa giá.
- **Luồng chính:** (1) nhập giá nguyên VND hợp lệ và lý do; (2) kiểm tra quyền/version; (3) cập nhật giá; (4) audit giá trước/sau.
- **Thay thế/lỗi:** STAFF bị 403 kể cả HTTP trực tiếp; giá sai hoặc version cũ không cập nhật; sửa giá không tự công bố.
- **Hậu điều kiện:** giá mới cho báo giá sau; đơn cũ không đổi. Báo giá chưa xác nhận hết hiệu lực khi version thay đổi.
- **Nghiệm thu:** STAFF không thay được giá; đơn đã tạo giữ giá cũ; checkout báo giá lại khi giá thay đổi.

## UC-11 — Điều chỉnh tồn kho

- **Tác nhân/mục tiêu:** STAFF/ADMIN ghi tăng/giảm tồn vật lý có lý do.
- **Tiền điều kiện:** SKU tồn tại; kích hoạt Điều chỉnh tồn.
- **Luồng chính:** (1) nhập delta, lý do và version; (2) kiểm tra tồn vật lý mới >= tồn đang giữ; (3) cập nhật on_hand; (4) ghi inventory_movements và audit cùng giao dịch.
- **Thay thế/lỗi:** không đủ tồn hoặc version cũ không lưu; không sửa trực tiếp reserved; giao/hủy phải dùng nghiệp vụ tương ứng. Đây không phải module nhập hàng/nhà cung cấp.
- **Hậu điều kiện:** available = on_hand - reserved >= 0; có nguồn gốc mỗi thay đổi.
- **Nghiệm thu:** không điều chỉnh làm mất hàng đã giữ; rollback cả movement nếu lỗi; delta=0 bị từ chối.

## UC-12 — Công bố/ẩn sản phẩm và SKU

- **Tác nhân/mục tiêu:** ADMIN điều khiển trạng thái bán.
- **Tiền điều kiện:** sản phẩm tồn tại; kích hoạt Công bố/Ẩn.
- **Luồng chính:** (1) chọn trạng thái; (2) khi công bố kiểm tra ảnh/thông tin bắt buộc và ít nhất một SKU có giá hợp lệ; (3) bật SKU được duyệt; (4) lưu trạng thái và audit.
- **Thay thế/lỗi:** STAFF bị từ chối; SKU không giá không được active; ẩn không xóa đơn hoặc hủy giữ tồn đã có.
- **Hậu điều kiện:** ẩn thì không thêm giỏ/tạo đơn mới; đơn cũ vẫn xử lý được.
- **Nghiệm thu:** sản phẩm ẩn không ở catalog; giỏ chứa SKU bị ẩn không checkout; lịch sử mua không mất.

## UC-13 — Danh mục/thương hiệu/định nghĩa thuộc tính

- **Tác nhân/mục tiêu:** ADMIN chuẩn hóa catalog.
- **Tiền điều kiện:** quyền ADMIN; kích hoạt khu vực cấu hình catalog.
- **Luồng chính:** (1) thêm/sửa tên, slug, thuộc tính và đơn vị/kiểu; (2) kiểm tra unique/tham chiếu; (3) lưu; (4) audit.
- **Thay thế/lỗi:** không xóa danh mục/thương hiệu còn sản phẩm; không đổi kiểu thuộc tính đã có giá trị nếu chưa migration; không tạo vòng cha danh mục.
- **Hậu điều kiện:** thông số có tên/kiểu/đơn vị thống nhất; dùng trong lọc và so sánh.
- **Nghiệm thu:** không tạo slug trùng; dữ liệu sai kiểu bị chặn; xóa bản ghi đang tham chiếu thất bại rõ ràng.

## UC-14 — So sánh sản phẩm

- **Tác nhân/mục tiêu:** người xem so sánh tối đa 3 SKU thuộc cùng danh mục.
- **Tiền điều kiện:** SKU ACTIVE; kích hoạt Thêm vào so sánh.
- **Luồng chính:** (1) chọn SKU; (2) kiểm tra cùng danh mục/không trùng/giới hạn; (3) dựng bảng theo định nghĩa thuộc tính; (4) xem giá, cấu hình, khác biệt; (5) bỏ SKU tùy chọn.
- **Thay thế/lỗi:** khác danh mục hoặc quá 3 báo lỗi; thông số thiếu hiển thị “Chưa có thông tin”, không coi là 0; SKU ẩn được loại khỏi danh sách.
- **Hậu điều kiện:** danh sách so sánh cập nhật ở phiên, không đổi catalog.
- **Nghiệm thu:** cùng đơn vị và kiểu dữ liệu; bỏ một sản phẩm không xóa các mục khác.

## UC-15 — Xem gợi ý

- **Tác nhân/mục tiêu:** người xem tìm sản phẩm tương tự/phổ biến.
- **Tiền điều kiện:** mở catalog/chi tiết; kích hoạt vùng Gợi ý.
- **Luồng chính:** (1) lấy sản phẩm đang xem; (2) lọc ACTIVE có SKU mua được; (3) chấm điểm theo cùng danh mục, thương hiệu, giá gần; (4) dùng lượng đã giao để phá hòa; (5) hiển thị tối đa 6 sản phẩm.
- **Thay thế/lỗi:** không có ứng viên hiển thị bán chạy hoặc rỗng; không giả tạo dữ liệu bán chạy; mỗi sản phẩm xuất hiện một lần.
- **Hậu điều kiện:** không đổi dữ liệu giao dịch, không cần ML.
- **Nghiệm thu:** không gợi ý chính sản phẩm đang xem/ẩn/hết tồn; cùng dữ liệu cho thứ tự ổn định.

## UC-16 — Quản lý giỏ hàng

- **Tác nhân/mục tiêu:** V/K thêm, xem, đổi số lượng, xóa SKU.
- **Tiền điều kiện:** SKU mua được khi thêm; kích hoạt nút Giỏ hàng.
- **Luồng chính:** (1) chọn SKU và số lượng; (2) validate; (3) thêm/gộp cùng SKU; (4) lưu giỏ; (5) hiển thị tổng tạm tính từ giá hiện tại.
- **Thay thế/lỗi:** 0 là xóa; quá tồn hoặc giới hạn không cập nhật; SKU bị ẩn giữ thông báo không khả dụng và cho xóa. Đăng nhập K gộp giỏ theo SKU, không vượt 99; mục không hợp lệ yêu cầu khách chỉnh lại.
- **Hậu điều kiện:** giỏ không giữ hàng. CUSTOMER có một giỏ active trong CSDL; vãng lai dùng phiên bền vững.
- **Nghiệm thu:** giá giả trong payload không ảnh hưởng tổng; giỏ K còn sau restart; N/Q không đặt hàng bằng vai trò quản lý.

## UC-17 — Báo giá checkout/áp mã giảm giá

- **Tác nhân/mục tiêu:** K biết tổng và điều kiện đặt hàng.
- **Tiền điều kiện:** giỏ không rỗng; kích hoạt Tiến hành đặt hàng.
- **Luồng chính:** (1) nhập/chọn địa chỉ, phương thức COD/ONLINE; (2) kiểm tra SKU/tồn; (3) tính giá hàng; (4) nếu có mã kiểm tra điều kiện; (5) tính phí giao theo bảng cấu hình; (6) lưu báo giá và request_key gắn giỏ/giá/địa chỉ; (7) hiển thị tổng.
- **Thay thế/lỗi:** mã sai/hết hạn/hết lượt báo lỗi, không âm thầm bỏ mã; địa bàn không hỗ trợ không cho đặt; giá thay đổi yêu cầu xác nhận báo giá mới.
- **Hậu điều kiện:** chưa tạo đơn/chưa giữ tồn; total = subtotal - discount + shipping_fee.
- **Nghiệm thu:** xem báo giá không trừ kho/lượt mã; phí có trong tổng; sửa tổng trình duyệt không ảnh hưởng server.

## UC-18 — Xác nhận đặt hàng

- **Tác nhân/mục tiêu:** K tạo đúng một đơn cho một yêu cầu.
- **Tiền điều kiện:** báo giá hợp lệ, thông tin nhận hàng đầy đủ; kích hoạt Xác nhận.
- **Luồng chính:** (1) khóa request_key theo user; (2) kiểm tra lại giỏ/giá/phí/mã; (3) nếu khác báo giá yêu cầu xác nhận lại; (4) trong giao dịch giữ tồn và lượt mã; (5) tạo PENDING với snapshot, lịch sử, checkout_request; (6) COD=UNPAID, ONLINE=UNPAID chờ tạo attempt; (7) commit, xóa các mục giỏ đã mua và hiển thị đơn.
- **Thay thế/lỗi:** thiếu tồn/khuyến mãi hết lượt rollback; cùng key/cùng nội dung trả đơn cũ; cùng key/khác nội dung trả conflict; lỗi xóa giỏ sau commit không tạo lại đơn. ONLINE tạo yêu cầu thanh toán UC-22 sau khi đơn được lưu.
- **Hậu điều kiện:** một đơn và reservation cho mỗi dòng; không bán vượt tồn; snapshot không đổi.
- **Nghiệm thu:** hai khách mua hàng cuối chỉ một người thành công; hai yêu cầu đồng thời cùng key chỉ có một đơn; lỗi giữa giao dịch không để tồn/mã bị giữ một phần.

## UC-19 — Xem đơn cá nhân và lịch sử

- **Tác nhân/mục tiêu:** K theo dõi đơn của mình.
- **Tiền điều kiện:** K đăng nhập; kích hoạt Đơn của tôi.
- **Luồng chính:** (1) lọc/phân trang đơn user_id hiện tại; (2) mở chi tiết; (3) hiển thị snapshot, tiền, trạng thái đơn/thanh toán/giao riêng và lịch sử; (4) hiển thị thao tác theo điều kiện.
- **Thay thế/lỗi:** ID của người khác trả 404; đơn rỗng hiển thị hướng dẫn; sản phẩm đã ẩn vẫn có snapshot.
- **Hậu điều kiện:** dữ liệu không đổi.
- **Nghiệm thu:** K không đọc đơn K khác; giá/địa chỉ đơn không thay khi cập nhật catalog/hồ sơ.

## UC-20 — Hủy đơn cá nhân

- **Tác nhân/mục tiêu:** chủ đơn K hủy khi PENDING.
- **Tiền điều kiện:** chủ đơn, PENDING; kích hoạt Hủy và nhập lý do.
- **Luồng chính:** (1) kiểm tra chủ và trạng thái dưới khóa/giao dịch; (2) chuyển CANCELLED; (3) giải phóng reservation/lượt mã một lần; (4) payment PAID chuyển REFUND_PENDING; (5) ghi lịch sử và yêu cầu xử lý tiền nếu cần.
- **Thay thế/lỗi:** đơn vừa CONFIRMED bị conflict; yêu cầu hủy lặp trả trạng thái đã hủy, không hoàn tồn lần hai; không hủy đơn người khác.
- **Hậu điều kiện:** không giao đơn hủy; giữ nguyên số tiền đã thu, không tự đánh dấu REFUNDED.
- **Nghiệm thu:** hủy và xác nhận đồng thời chỉ một chuyển trạng thái thắng; tiền chỉ hoàn sau bằng chứng UC-34.

## UC-21 — Tra cứu/xử lý đơn toàn cửa hàng

- **Tác nhân/mục tiêu:** N/Q xác nhận, chuẩn bị, hủy đơn trước giao và theo dõi.
- **Tiền điều kiện:** N/Q ACTIVE; kích hoạt danh sách đơn.
- **Luồng chính:** (1) tìm/lọc theo mã, trạng thái, thời gian; (2) xem chi tiết; (3) chọn bước hợp lệ; (4) kiểm tra ONLINE phải PAID trước CONFIRMED; (5) chuyển PENDING→CONFIRMED→PREPARING; (6) ghi actor/lý do/trước-sau.
- **Thay thế/lỗi:** hủy được PENDING/CONFIRMED/PREPARING, giải phóng tồn/mã và tạo yêu cầu hoàn tiền nếu đã thu; SHIPPING/DELIVERED không hủy qua chức năng này; version cũ không ghi đè. SHIPPING phát sinh ở UC-26 khi đã bàn giao thực tế.
- **Hậu điều kiện:** lịch sử đầy đủ; không tự đổi trạng thái tiền thành PAID khi giao.
- **Nghiệm thu:** N không sửa tổng/snapshot; nhảy PENDING→DELIVERED bị chặn; online chưa thu không xác nhận.

## UC-22 — Thanh toán trực tuyến/thử lại

- **Tác nhân/mục tiêu:** K thanh toán đơn ONLINE của mình; T cung cấp URL thanh toán.
- **Tiền điều kiện:** đơn PENDING, chưa thu, còn hạn giữ hàng; kích hoạt Thanh toán.
- **Luồng chính:** (1) kiểm tra đơn; (2) dùng lại attempt PENDING hoặc tạo attempt mới sau FAILED; (3) lưu tham chiếu và số tiền/tiền tệ; (4) enqueue job gọi T cùng request_key; (5) nhận URL và đưa K đến T; (6) trang quay lại truy vấn trạng thái server.
- **Thay thế/lỗi:** timeout giữ trạng thái chưa rõ và tra cứu cùng tham chiếu, không tự tạo attempt khác; quá hạn không cho thử lại; đơn PAID hiển thị đã thu; phí và tổng không tính lại trên đơn đã tạo.
- **Hậu điều kiện:** attempt lưu bền vững; không PAID chỉ vì K quay lại website.
- **Nghiệm thu:** bấm lặp không tạo nhiều attempt đang mở; K không thanh toán đơn người khác; URL chỉ đến nhà cung cấp cấu hình.

## UC-23 — Tiếp nhận kết quả thanh toán

- **Tác nhân/mục tiêu:** T thông báo kết quả, hệ thống đối soát vào đơn.
- **Tiền điều kiện:** attempt đã tồn tại; kích hoạt callback/tra cứu chủ động đã xác thực.
- **Luồng chính:** (1) xác thực chữ ký, merchant, event ID; (2) đối chiếu reference, amount, VND; (3) ghi event unique; (4) khóa attempt và order; (5) cập nhật trạng thái đơn điệu; (6) thành công đúng hạn ghi tiền đã thu và PAID; (7) trả ACK sau commit.
- **Thay thế/lỗi:** chữ ký/số tiền sai không đổi tiền; event trùng ACK không cập nhật lần hai; thất bại sau thành công không đảo PAID; success đến sau hủy/hết hạn ghi đã thu + REFUND_PENDING, không mở lại đơn/giữ tồn. Thu thành công ở attempt thứ hai khi đơn đã thu tạo payment_exception, không cộng doanh thu lần hai.
- **Hậu điều kiện:** có dấu vết sự kiện và ngoại lệ; tiền thật luôn được ghi nhận dù cần hoàn.
- **Nghiệm thu:** callback sai không PAID; lặp/out-of-order không đổi ngược; callback muộn không hồi sinh đơn.

## UC-24 — Xác nhận thu COD

- **Tác nhân/mục tiêu:** ADMIN ghi nhận COD đã đối soát.
- **Tiền điều kiện:** đơn COD DELIVERED, chưa thu; kích hoạt Xác nhận thu.
- **Luồng chính:** (1) nhập số tiền, mã chứng từ/đối soát, ngày thu; (2) kiểm tra đúng total; (3) tạo payment COD SUCCEEDED unique theo đơn; (4) cập nhật PAID; (5) audit.
- **Thay thế/lỗi:** số tiền thiếu/thừa không tự PAID, ghi chú đối soát ở hỗ trợ; trùng chứng từ trả kết quả cũ; STAFF bị từ chối.
- **Hậu điều kiện:** giao và thu tiền độc lập; số tiền thu có bằng chứng.
- **Nghiệm thu:** DELIVERED COD chưa xác nhận vẫn UNPAID; xác nhận lặp không nhân đôi tiền thu.

## UC-25 — Tạo vận đơn

- **Tác nhân/mục tiêu:** N/Q yêu cầu G giao đơn.
- **Tiền điều kiện:** PREPARING; COD hoặc ONLINE đã PAID; chưa có vận đơn active.
- **Luồng chính:** (1) kiểm tra địa chỉ/kiện/COD cần thu; (2) lưu shipment CREATED và job unique; (3) gửi yêu cầu G sau commit; (4) lưu mã vận đơn và hãng; (5) nhân viên bàn giao thực tế trước UC-26.
- **Thay thế/lỗi:** timeout tra cứu theo request_key, không tạo vận đơn thứ hai; chế độ thủ công nhập hãng/mã unique và lý do; đơn hủy không được gửi. Phí phát sinh không tự sửa total đã chốt.
- **Hậu điều kiện:** một shipment/đơn theo giả định một kiện; có mã vận đơn trước khi SHIPPING.
- **Nghiệm thu:** gọi lặp không tạo hai vận đơn; tạo vận đơn không tự đánh dấu đã giao hoặc tiêu thụ tồn.

## UC-26 — Cập nhật kết quả vận chuyển

- **Tác nhân/mục tiêu:** G gửi sự kiện; N/Q cập nhật trong chế độ thủ công.
- **Tiền điều kiện:** shipment đã liên kết; G có chữ ký hợp lệ hoặc N/Q có phiên/CSRF; kích hoạt sự kiện trạng thái.
- **Luồng chính:** (1) xác thực nguồn/chống trùng; (2) kiểm tra thứ tự; (3) khi bàn giao chuyển shipment IN_TRANSIT và order SHIPPING, tiêu thụ reservation: giảm on_hand/reserved; (4) khi giao thành công chuyển DELIVERED; (5) lưu lịch sử/sự kiện.
- **Thay thế/lỗi:** event cũ không lùi trạng thái; callback cho đơn hủy không mở lại đơn, tạo ngoại lệ; giao thất bại shipment FAILED, đơn vẫn SHIPPING để chờ giao lại hoặc xác nhận hàng về. RETURNED chỉ khi hàng thực nhận về: hoàn on_hand một lần, đơn DELIVERY_FAILED, tiền đã thu cần REFUND_PENDING.
- **Hậu điều kiện:** không tự ghi PAID cho COD; hàng chưa về không cộng kho.
- **Nghiệm thu:** repeated RETURNED không tăng kho hai lần; fake callback bị chặn; update thủ công có actor và bằng chứng.

## UC-27 — Gửi/sửa đánh giá đã mua

- **Tác nhân/mục tiêu:** K đánh giá dòng đơn đã nhận.
- **Tiền điều kiện:** chủ đơn DELIVERED; kích hoạt Đánh giá từ dòng đơn.
- **Luồng chính:** (1) nhập 1–5 sao, nội dung 1–2000 ký tự; (2) kiểm tra ownership và unique order_item_id; (3) tạo hoặc sửa đánh giá của mình; (4) trạng thái PENDING chờ duyệt.
- **Thay thế/lỗi:** chưa nhận hàng/người khác bị từ chối; tạo lần hai hướng sửa bản cũ; sửa đánh giá APPROVED trả về PENDING.
- **Hậu điều kiện:** chưa hiển thị công khai tới khi UC-28 duyệt.
- **Nghiệm thu:** một dòng đơn chỉ một đánh giá; nội dung được escape; không chỉ dựa product_id để chứng minh đã mua.

## UC-28 — Kiểm duyệt đánh giá

- **Tác nhân/mục tiêu:** ADMIN duyệt/ẩn nội dung.
- **Tiền điều kiện:** đánh giá tồn tại; kích hoạt danh sách chờ duyệt.
- **Luồng chính:** (1) xem nội dung và bằng chứng mua; (2) chọn APPROVED/HIDDEN/REJECTED; (3) nhập lý do khi ẩn/từ chối; (4) lưu và audit.
- **Thay thế/lỗi:** STAFF bị chặn; không sửa nội dung khách thay khách; “xóa” trên UI là ẩn, giữ bản ghi đối soát.
- **Hậu điều kiện:** điểm trung bình chỉ tính APPROVED.
- **Nghiệm thu:** ẩn làm mất khỏi public và điểm trung bình; audit xác định người duyệt.

## UC-29 — Quản lý khuyến mãi

- **Tác nhân/mục tiêu:** ADMIN tạo/sửa/tắt mã giảm giá.
- **Tiền điều kiện:** ADMIN; kích hoạt Khuyến mãi.
- **Luồng chính:** (1) nhập code unique, FIXED/PERCENT, mức/trần, thời gian, giá trị tối thiểu, phạm vi sản phẩm, tổng lượt/per-user; (2) validate; (3) lưu và audit; (4) checkout áp quy tắc tại thời điểm đặt.
- **Thay thế/lỗi:** ngày sai, phần trăm ngoài 1–100, trần thiếu bị chặn; mã đã có redemption không đổi code/loại/phạm vi/mức, chỉ tắt hoặc tạo mã mới; không cộng dồn nhiều mã.
- **Hậu điều kiện:** lượt giữ + lượt đã dùng không vượt limit; đơn giữ snapshot mức giảm.
- **Nghiệm thu:** hai yêu cầu tranh lượt cuối chỉ một dùng được; xem báo giá không chiếm lượt; hủy trước giao giải phóng lượt một lần.

## UC-30 — Gửi/xem yêu cầu hỗ trợ

- **Tác nhân/mục tiêu:** K trao đổi vấn đề về đơn của mình.
- **Tiền điều kiện:** có đơn thuộc K; kích hoạt Yêu cầu hỗ trợ.
- **Luồng chính:** (1) chọn đơn, chủ đề/nội dung; (2) validate; (3) tạo ticket OPEN và tin đầu tiên; (4) xem trạng thái/trả lời; (5) gửi thêm tin hoặc mở lại ticket CLOSED trong 7 ngày.
- **Thay thế/lỗi:** đơn người khác bị 404; nội dung trống/quá 2000 bị chặn; không có chat realtime hoặc file đính kèm trong bản đầu.
- **Hậu điều kiện:** ticket và hội thoại gắn đơn/chủ sở hữu.
- **Nghiệm thu:** K không xem ticket người khác; không thấy ghi chú nội bộ của nhân viên.

## UC-31 — Xử lý hỗ trợ

- **Tác nhân/mục tiêu:** N/Q giải quyết ticket.
- **Tiền điều kiện:** ticket tồn tại; kích hoạt hàng đợi hỗ trợ.
- **Luồng chính:** (1) lọc và nhận xử lý; (2) xem đơn; (3) trả lời công khai hoặc ghi chú nội bộ; (4) chuyển IN_PROGRESS/RESOLVED/CLOSED; (5) lưu lịch sử và actor.
- **Thay thế/lỗi:** version cũ yêu cầu tải lại; trả lời không được tự sửa total/giá/tiền; phát sinh hoàn tiền chuyển Q xử lý UC-34.
- **Hậu điều kiện:** người xử lý và tiến trình có thể truy vết.
- **Nghiệm thu:** tin nội bộ chỉ N/Q thấy; đóng ticket không xóa hội thoại; K đọc được trả lời công khai.

## UC-32 — Báo cáo/xuất dữ liệu

- **Tác nhân/mục tiêu:** ADMIN xem kết quả kinh doanh theo khoảng thời gian.
- **Tiền điều kiện:** ADMIN; kích hoạt Báo cáo và chọn ngày theo Asia/Saigon.
- **Luồng chính:** (1) chuyển khoảng ngày địa phương sang UTC [from,to); (2) truy vấn chỉ số theo định nghĩa BR-12; (3) hiển thị doanh thu/đơn/bán chạy/tài khoản; (4) xuất CSV khi yêu cầu, escape giá trị bắt đầu ký tự công thức.
- **Thay thế/lỗi:** ngày đảo/range quá 366 ngày bị chặn; dữ liệu rỗng trả 0; không gộp nhiều event callback để tính tiền thu.
- **Hậu điều kiện:** không đổi nghiệp vụ; log lần xuất, không xuất mật khẩu/secret.
- **Nghiệm thu:** đơn hủy không vào doanh thu bán; hoàn tiền trừ đúng kỳ hoàn; số liệu cùng bộ lọc giữa màn hình/CSV khớp.

## UC-33 — Nhật ký quản trị

- **Tác nhân/mục tiêu:** ADMIN truy vết thay đổi và ngoại lệ tích hợp.
- **Tiền điều kiện:** ADMIN; kích hoạt Nhật ký.
- **Luồng chính:** (1) lọc actor/loại/đối tượng/thời gian; (2) xem before/after đã che nhạy cảm; (3) đối chiếu order/payment/shipment liên quan.
- **Thay thế/lỗi:** không cho sửa/xóa audit qua UI; actor hệ thống hoặc tích hợp hiển thị source thay vì giả user; event lỗi hiển thị thông tin đã redacted.
- **Hậu điều kiện:** không đổi dữ liệu; audit append-only ở tầng ứng dụng.
- **Nghiệm thu:** N/K không đọc audit; đổi giá/khóa tài khoản/thu tiền có audit; log không chứa mật khẩu/token/chữ ký bí mật.

## UC-34 — Ghi nhận hoàn tiền thủ công

- **Tác nhân/mục tiêu:** ADMIN xác nhận tiền thực đã hoàn cho đơn hủy/ngoại lệ thanh toán.
- **Tiền điều kiện:** có payment SUCCEEDED và khoản cần hoàn chưa xử lý; kích hoạt Hoàn tiền.
- **Luồng chính:** (1) kiểm tra refund_due; (2) thực hiện đối soát/hoàn qua kênh ngoài hệ thống; (3) nhập amount, reference unique, thời điểm, bằng chứng; (4) ghi refund SUCCEEDED và audit; (5) khi đã hoàn đủ cập nhật REFUNDED hoặc PAID nếu tiền thu hợp lệ của đơn vẫn còn.
- **Thay thế/lỗi:** không có bằng chứng không xác nhận; vượt số tiền thực thu chưa hoàn bị từ chối; gửi lặp trả bản cũ; không tự gọi cổng hoàn tiền trong bản đầu.
- **Hậu điều kiện:** tiền hoàn có ledger, không sửa snapshot đơn, không cộng kho qua nghiệp vụ hoàn tiền.
- **Nghiệm thu:** double-submit không hoàn hai lần; tiền thu thừa được hoàn mà vẫn giữ khoản PAID hợp lệ; STAFF không xác nhận hoàn.
