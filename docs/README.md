# Bộ tài liệu phân tích và thiết kế Electro Store

## CODE-07B — Gmail SMTP ngày 18/10/2026

[Hướng dẫn Gmail SMTP](45_CODE_07B_GMAIL_SMTP.md): người dùng chọn Gmail; đồng bộ kiểm tra cặp USER/PASS giữa ứng dụng và preflight, bổ sung test adapter gửi giả. Toàn bộ mới nhất: **136 ca, 126 đạt, 0 lỗi, 10 bỏ qua PostgreSQL**. Chưa đọc/ghi .env hoặc gửi thư thực tế. Bước tiếp theo phụ thuộc người dùng tự điền cấu hình Gmail cục bộ.

## CODE-07A — Chuẩn bị tích hợp ngày 18/10/2026

[Chuẩn bị SMTP/VNPay sandbox](44_CODE_07A_CHUAN_BI_TICH_HOP.md): thêm lệnh `npm.cmd run integrations:check:sample` kiểm tra cấu hình mẫu, không mạng/CSDL và không xuất bí mật. Bộ liên quan **9 ca đạt, 0 lỗi**. Mẫu thiếu thông tin nhà cung cấp đúng dự kiến; không kết luận về .env hiện dùng. Chưa gửi thư hoặc kết nối VNPay thật. Tiếp theo: CODE-07B, cấu hình SMTP thử nghiệm.

## CODE-06E — Báo cáo ngày 18/10/2026

[Kiểm tra báo cáo doanh thu](43_CODE_06E_BAO_CAO_DOANH_THU.md): bổ sung luồng đơn có khuyến mãi/phí giao → giao → thu COD → báo cáo/CSV. Bộ liên quan **23 ca đạt, 0 lỗi**; quyền xuất và kỳ thu/hoàn được kiểm tra. Chưa nghiệm thu PostgreSQL/UI. Tiếp theo: CODE-07A, chuẩn bị nghiệm thu SMTP/VNPay bên ngoài.

## CODE-06D — Gợi ý sản phẩm ngày 18/10/2026

[Kiểm tra gợi ý sản phẩm](42_CODE_06D_GOI_Y_SAN_PHAM.md): bổ sung ca đặt đơn giữ hết tồn/hủy giải phóng giữ và kiểm tra gợi ý cập nhật theo kho khả dụng. Bộ gợi ý/so sánh **11 ca đạt, 0 lỗi**. Chưa nghiệm thu PostgreSQL/UI; trọng số và số kết quả vẫn là chi tiết thiết kế chưa chốt riêng. Tiếp theo: CODE-06E, báo cáo.

## CODE-06C — Hỗ trợ khách hàng ngày 18/10/2026

[Kiểm tra hỗ trợ khách hàng](41_CODE_06C_HO_TRO_KHACH_HANG.md): mở rộng HTTP về quyền theo đơn/ticket, nội dung nội bộ, luồng xử lý/đóng, version cũ và escape HTML. Bộ liên quan **8 ca đạt, 0 lỗi**; có cả ca reset/địa chỉ cùng module. Chưa nghiệm thu PostgreSQL/UI. Tiếp theo: CODE-06D, gợi ý sản phẩm.

## CODE-06B — Đánh giá và kiểm duyệt ngày 18/10/2026

[Kiểm tra đánh giá sản phẩm](40_CODE_06B_DANH_GIA_VA_KIEM_DUYET.md): bổ sung luồng HTTP gửi/duyệt/sửa/duyệt lại/ẩn, quyền và escape nội dung HTML. Bộ liên quan **4 ca đạt, 0 lỗi**. Chưa nghiệm thu bố cục trình duyệt hoặc PostgreSQL. Tiếp theo: CODE-06C, hỗ trợ khách hàng.

## CODE-06A — Khuyến mãi ngày 18/10/2026

[Kiểm tra khuyến mãi](39_CODE_06A_KIEM_TRA_KHUYEN_MAI.md): bổ sung ba ca giỏ tài khoản/phí cố định, quyền quản lý, snapshot khi tắt mã và tranh lượt sau báo giá. Bộ liên quan **8 ca đạt, 0 lỗi**. Các chi tiết thiết kế chưa chốt riêng vẫn được ghi rõ; chưa nghiệm thu PostgreSQL/UI. Tiếp theo: CODE-06B, đánh giá sản phẩm.

## CODE-05C — Giao lại và nhận hàng về ngày 18/10/2026

[Kiểm tra giao thất bại, giao lại và nhận hàng về](38_CODE_05C_GIAO_LAI_VA_NHAN_HANG_VE.md): bổ sung hai ca tích hợp COD giao lại và online trả về/hoàn tiền. Bộ liên quan **19 ca đạt, 0 lỗi**. Kho chỉ cộng khi nhận hàng thực về; hoàn tiền được ghi riêng. Chưa nghiệm thu PostgreSQL hoặc nhà cung cấp thật. Tiếp theo: CODE-06A, khuyến mãi.

## CODE-05B — Kiểm tra VNPay cục bộ ngày 18/10/2026

[VNPay sandbox, hết hạn và IPN](37_CODE_05B_NGHIEM_THU_VNPAY_LOCAL.md): bổ sung ba ca về deadline gốc, retry không gia hạn, IPN sau hạn khi chưa quét và thành công sau khách hủy. Bộ liên quan **14 ca đạt, 0 lỗi**. Chưa kiểm tra với VNPay bên ngoài hoặc PostgreSQL. Tiếp theo: CODE-05C, giao thất bại/giao lại/nhận hàng về.

## CODE-05A — Kiểm tra COD ngày 18/10/2026

[Luồng COD, kho và vận chuyển thủ công](36_CODE_05A_NGHIEM_THU_COD.md): đã kiểm tra chuỗi giỏ tài khoản → đặt → bàn giao → giao → ADMIN thu đủ COD → báo cáo; bổ sung hai ca tích hợp. Bộ kiểm tra liên quan **14 ca đạt, 0 lỗi**. Không sửa mã nghiệp vụ trong bước này; PostgreSQL và giao diện chưa nghiệm thu. Tiếp theo: CODE-05B, kiểm tra VNPay sandbox cục bộ.

## Cập nhật mới nhất — 18/10/2026

[CODE-04 — Phí giao hàng cố định](35_CODE_04_PHI_GIAO_CO_DINH.md): đã tách phí vùng/trọng lượng khỏi checkout theo QD-21. Toàn bộ test: **120 ca, 110 đạt, 0 lỗi, 10 bỏ qua PostgreSQL**. Mục rà soát ngày 13/10 bên dưới là số liệu lịch sử. Bước kế tiếp: nghiệm thu từng phần CODE-05, bắt đầu luồng COD/kho/vận chuyển thủ công.

[Chatbot hỗ trợ người dùng](16_CHATBOT_HO_TRO.md): bản tự động theo quy tắc, tìm sản phẩm/ngân sách, hướng dẫn và tra cứu đơn chính chủ; không cần API key.

## Hiện trạng mới nhất — 13/10/2026

Xem [rà soát toàn dự án](17_RA_SOAT_TOAN_DU_AN_2026_10_13.md). Bộ test hiện tại có 97 ca: **68 đạt, 21 lỗi, 8 bỏ qua**; smoke HTTP COD đạt. 20 lỗi liên quan đến fixture schema cũ thiếu `shipping_quote_json`; một ca HTTP đăng nhập cần xác minh ảnh hưởng của rate limit. Chưa chạy lại bộ PostgreSQL chuyên biệt, kiểm tra trực quan hoặc tích hợp nhà cung cấp thật trong lần rà soát này.

Mã hiện có migration SQLite v11 và PostgreSQL v4. Biểu phí địa bàn, jobs và ngoại lệ thanh toán đã có nền tảng nhưng còn phần ghép nối/kiểm thử; không xem chúng là đã hoàn thiện chỉ vì có bảng hoặc màn hình. ERD mục tiêu và các báo cáo cũ cần được đồng bộ lần lượt.

Ưu tiên hiện tại: hoàn thiện tài liệu từng phần và thống nhất các giả định, sau đó mới sửa mã và nghiệm thu. Không thêm chức năng hoặc triển khai web trong bước tài liệu này.

## Các mốc kiểm tra trước đây

[Dashboard, ảnh, yêu thích/đã xem và thông báo trong website](15_DASHBOARD_ANH_YEU_THICH_THONG_BAO.md) ghi nhận mốc SQLite v10, PostgreSQL v3; 87 ca local và 8 ca PostgreSQL đạt, hai luồng smoke đạt. Đây là kết quả lịch sử, không thay thế kết quả ngày 13/10/2026.

[Kết quả kiểm tra lại và ý tưởng phát triển ngày 07/10/2026](14_KIEM_TRA_VA_DE_XUAT_PHAT_TRIEN.md): 89 ca đạt khi chạy hai bộ, smoke SQLite/PostgreSQL đạt, dữ liệu hiện có không vi phạm các kiểm tra tồn/đơn/hoàn; ghi rõ phạm vi chưa kiểm tra trực tiếp bằng browser hoặc nhà cung cấp thật.

**Cập nhật 07/10/2026:** [đối chiếu 34 UC và phần còn thiếu](12_ECARTS_ET_IMPLEMENTATION.md), [hướng dẫn vận chuyển thủ công](13_SU_DUNG_VAN_CHUYEN.md), [PostgreSQL](11_POSTGRESQL.md). Bản mới bổ sung shipment/nhận hàng về: SQLite v9, PostgreSQL v2; 82 bài local và 7 bài PostgreSQL đạt. Các kết quả v8 dưới đây là mốc trước đó.

Phiên bản thiết kế 1.0 — ngày 05/10/2026. Phạm vi: website bán đồ điện tử cho một cửa hàng. Bộ tài liệu mô tả **hệ thống mục tiêu**, không xác nhận các chức năng đã được lập trình. Kết quả triển khai theo từng bước, schema thực tế và kiểm thử được cập nhật riêng tại [tiến độ triển khai](09_TIEN_DO_TRIEN_KHAI.md).

Cấu hình các chức năng: [SMTP, VNPay sandbox và hoàn tiền](10_CAU_HINH_EMAIL_VNPAY.md). Mốc migration v8 và 77 kiểm thử đạt thuộc bản trước; không dùng để xác nhận hiện trạng. Tích hợp SMTP/merchant VNPay thật chưa được nghiệm thu trong lần rà soát mới nhất.

## Thứ tự đọc

1. [Phạm vi, tác nhân, phân quyền](01_PHAM_VI_TAC_NHAN_VA_PHAN_QUYEN.md).
2. [Danh mục use case và sơ đồ theo tác nhân](04_DANH_MUC_VA_SO_DO_USE_CASE.md).
3. [Đặc tả toàn bộ use case](05_DAC_TA_USE_CASE.md).
4. [Quy tắc, sơ đồ hoạt động, trạng thái và tuần tự](06_QUY_TAC_VA_SO_DO_LUONG.md).
5. [ERD toàn hệ thống, từ điển dữ liệu và ràng buộc](07_ERD_VA_TU_DIEN_DU_LIEU.md).
6. [Ma trận truy vết và nghiệm thu](08_TRUY_VET_VA_NGHIEM_THU.md).

Sơ đồ use case dùng PlantUML để có tác nhân, biên hệ thống và quan hệ UML đúng nghĩa; mã nguồn ở [diagrams](diagrams/). Sơ đồ luồng và ERD dùng Mermaid trong Markdown. Có thể mở PlantUML bằng trình xem hỗ trợ PlantUML và Mermaid bằng trình xem Markdown hỗ trợ Mermaid. Các tệp nguồn cho phép chỉnh sửa, xuất SVG/PNG khi đưa vào báo cáo.

## Mức độ quyết định

- **Đã được người dùng đồng ý:** chỉ ADMIN được sửa giá; STAFF cập nhật thông tin sản phẩm và tồn kho. Khách được xem sản phẩm và quản lý giỏ hàng trước đăng nhập, nhưng phải đăng nhập trước khi xác nhận đặt hàng. Công nghệ triển khai đã chọn là Node.js. Phạm vi thanh toán: COD và VNPay sandbox phục vụ đồ án, chưa giao dịch tiền thật (chốt ngày 13/10/2026).
- **Đã chốt thêm về hủy đơn:** CUSTOMER chỉ hủy đơn của mình khi PENDING (chờ xác nhận). STAFF/ADMIN được hủy trước bàn giao cho đơn vị vận chuyển, phải ghi lý do. Nếu đã thu tiền, ghi nhận khoản cần hoàn; không tự đánh dấu đã hoàn tiền (ngày 13/10/2026).
- **Đã chốt ngày 14/10/2026 về kiện hàng:** mỗi đơn một kiện, một mã vận đơn, giao toàn bộ sản phẩm cùng lúc; chưa hỗ trợ chia đơn/giao từng phần.
- **Đã chốt ngày 14/10/2026 về khuyến mãi:** mỗi đơn tối đa một mã, không cộng dồn; giảm tiền hàng, không giảm phí giao; kiểm tra thời hạn, giá trị đơn tối thiểu và giới hạn lượt dùng; lưu mức giảm trên đơn để thay đổi chương trình không ảnh hưởng đơn cũ.
- **Đã chốt ngày 14/10/2026 về đánh giá:** chỉ khách đã nhận hàng được đánh giá; một đánh giá trên mỗi dòng sản phẩm trong đơn, gồm 1–5 sao và nhận xét; được sửa đánh giá của mình; ADMIN duyệt trước khi công khai, sửa phải duyệt lại.
- **Đã chốt ngày 14/10/2026 về tài khoản quản lý:** STAFF/ADMIN dùng tài khoản CUSTOMER riêng khi mua; tài khoản quản lý chỉ dùng nghiệp vụ cửa hàng.
- **Đã chốt ngày 14/10/2026 về quản lý sản phẩm:** STAFF tạo nháp, nhập thông tin/ảnh/cấu hình/tồn; ADMIN thiết lập giá và công bố, chỉ ADMIN được ẩn; nháp không hiển thị cho khách.
- **Điều kiện công bố đã chốt:** tên, danh mục, thương hiệu, mô tả; ít nhất một ảnh hợp lệ; đủ thông số bắt buộc; ít nhất một SKU bật bán có mã riêng, giá > 0. Hết hàng vẫn được công bố nhưng hiển thị “Hết hàng” và không cho đặt mua SKU hết hàng.
- **Gợi ý đã chốt:** ưu tiên cùng danh mục/thương hiệu/giá gần; chỉ sản phẩm công khai có SKU còn hàng; loại sản phẩm đang xem; hiển thị lý do; không dùng ML.
- **Giả định thiết kế còn lại:** cơ chế bật/tắt từng SKU, trọng số/khoảng giá/số kết quả gợi ý, loại mã giảm, cách giữ/trả lượt và giới hạn theo khách cần rà soát riêng.
- **Đã chốt ngày 14/10/2026:** VNPay sandbox có thời hạn 15 phút từ lúc tạo đơn. Hết hạn chưa thanh toán thì hủy và giải phóng lượng giữ; đã xác minh thành công thì tiếp tục xử lý; thành công đến sau hủy ghi khoản cần hoàn, không mở lại đơn. Không áp dụng thời hạn này cho COD.
- **Đã chốt ngày 14/10/2026 về phí giao hàng:** một mức phí cố định do ADMIN cấu hình, khách thấy trước khi đặt; đơn đã tạo giữ nguyên phí. Biểu phí khu vực/trọng lượng thuộc phần mở rộng.
- **Thông số cấu hình chưa lựa chọn:** số tiền phí giao cố định, địa bàn phục vụ, nhà cung cấp vận chuyển cho phần mở rộng, thông tin merchant VNPay sandbox và URL callback, thời hạn phiên và giới hạn truy cập. Phải cấu hình và nghiệm thu trước khi sử dụng tích hợp; quyết định phạm vi không xác nhận kết nối đã hoạt động.
- **Ngoài phạm vi:** nhiều cửa hàng/người bán, kế toán đầy đủ, nhập hàng/nhà cung cấp, chat realtime, ML, đổi trả/bảo hành và hoàn tiền tự động. Trường hợp thu tiền muộn hoặc tiền đã thu khi hủy vẫn phải ghi nhận và xử lý hoàn tiền thủ công có bằng chứng.

Những giả định trên là lựa chọn thiết kế để tài liệu nhất quán, không được ghi là quyết định đã được người dùng phê duyệt. Khi thay đổi, cập nhật đồng thời quyền, đặc tả, sơ đồ, ERD và nghiệm thu.

## Bước rà soát tài liệu tiếp theo

**CODE-03A route và gộp một lần đã nối:** [kết quả/phạm vi](34_CODE_03A_ROUTE_VA_GOP_GIO.md). CUSTOMER dùng giỏ tài khoản; nguồn gộp vượt giới hạn giữ để chỉnh, checkout/xóa mục mua nguyên tử. Bước kế tiếp kiểm tra PostgreSQL khi có cấu hình và CODE-04 phí cố định; chưa triển khai web hoặc kiểm tra UI trực quan.

**CODE-03A, phần dữ liệu/dịch vụ:** đã thêm carts/cart_items (SQLite v12, PostgreSQL v5) và dịch vụ theo tài khoản; [kết quả/phạm vi](33_CODE_03A_DU_LIEU_VA_DICH_VU_GIO.md). Bộ đầy đủ 108 ca: 99 đạt, 0 lỗi, 9 PostgreSQL bỏ qua. Chưa ghép route nên website vẫn dùng giỏ session; bước tiếp theo ghép route và test HTTP, gộp một lần vẫn thuộc CODE-03B.

**CODE-02 đã thực hiện:** xác nhận lỗi 429 và tách ngưỡng thử sai/tổng request; [kết quả](32_CODE_02_GIOI_HAN_DANG_NHAP.md). Bộ đầy đủ 102 ca: 94 đạt, 0 lỗi, 8 PostgreSQL bỏ qua; smoke COD đạt. Tiếp theo CODE-03A giỏ lưu theo tài khoản, làm từng phần; chưa triển khai web hoặc nghiệm thu PostgreSQL riêng.

**Đã cập nhật fixture giao hàng:** [kết quả](31_CAP_NHAT_TEST_GIAO_HANG.md), 36 ca liên quan đạt; bộ đầy đủ 101 ca: 92 đạt, 1 lỗi HTTP đăng nhập, 8 PostgreSQL bỏ qua. Bước tiếp theo CODE-02 xác minh phản hồi và rate limit đăng nhập. Không thay logic website trong bước fixture này.

**CODE-01 đã thực hiện:** đồng bộ phiên bản schema; 12 test checkout/migration đạt. Bộ đầy đủ hiện 101 ca: 83 đạt, 10 lỗi, 8 bỏ qua; hết lỗi thiếu shipping_quote_json nhưng còn fixture giao trực tiếp không qua vận đơn và một ca đăng nhập. Xem [kết quả CODE-01](30_CODE_01_DONG_BO_SCHEMA.md). Bước tiếp theo cập nhật fixture giao hàng theo schema hiện tại trước xử lý rate limit; chưa thêm chức năng giỏ mới hoặc triển khai web.

**Chuyển sang triển khai từng bước:** [kế hoạch CODE-01..08](29_KE_HOACH_TRIEN_KHAI_TUNG_BUOC.md) là công việc hiện hành, bắt đầu đồng bộ phiên bản schema/checkout. Không tiếp tục xuất hết sơ đồ như điều kiện để bắt đầu code. Những “bước tiếp theo” render/ERD bên dưới là tiến trình trước và sẽ hoàn thiện khi đóng gói báo cáo. Bước lập kế hoạch chưa sửa mã hoặc chạy lại test.

**Đã render ERD catalog/SKU/thông số:** [SVG](diagrams/rendered/13_erd_catalog_sku_thong_so.svg) / [PNG](diagrams/rendered/13_erd_catalog_sku_thong_so.png), đã xem tên cột/khóa và quan hệ. Tiếp theo ERD đơn hàng/checkout/kho; các trường tùy chọn không làm tăng phạm vi đã chốt. Chưa sửa mã hoặc migration.

**Đã render ERD tài khoản/giỏ/reset:** [SVG](diagrams/rendered/12_erd_tai_khoan_gio_reset.svg) / [PNG](diagrams/rendered/12_erd_tai_khoan_gio_reset.png), đã chỉnh chữ ô bảng và kiểm tra khóa/quan hệ; SKU là nút tham chiếu rút gọn. Tiếp theo ERD catalog/SKU/thông số. Chưa tạo migration hoặc sửa mã.

**Đã render tuần tự vận chuyển/COD:** [SVG](diagrams/rendered/11_tuan_tu_van_chuyen_cod.svg) / [PNG](diagrams/rendered/11_tuan_tu_van_chuyen_cod.png), đã kiểm tra giao thủ công và đối soát ADMIN độc lập. Tiếp theo render ERD theo từng nhóm, bắt đầu tài khoản/phiên/giỏ/reset. Chưa sửa mã website.

**Đã render tuần tự VNPay tối thiểu:** [SVG](diagrams/rendered/10_tuan_tu_vnpay_sandbox.svg) / [PNG](diagrams/rendered/10_tuan_tu_vnpay_sandbox.png), đã kiểm tra IPN/xác thực/nhánh sai-đúng và trang quay lại. Tiếp theo sequence vận chuyển thủ công và thu COD. Chưa sửa mã hoặc nghiệm thu cổng.

**Đã render trạng thái thanh toán:** [SVG](diagrams/rendered/09_trang_thai_thanh_toan.svg) / [PNG](diagrams/rendered/09_trang_thai_thanh_toan.png), đã sửa nhãn chồng và xem lại bản cuối. Tiếp theo render sequence VNPay sandbox tối thiểu. Chưa sửa mã hoặc nghiệm thu cổng.

**Đã render trạng thái vận chuyển:** [SVG](diagrams/rendered/08_trang_thai_van_chuyen.svg) / [PNG](diagrams/rendered/08_trang_thai_van_chuyen.png), đã chỉnh cỡ chữ nhãn và xem lại giao thất bại/giao lại/hàng trả về. Tiếp theo sơ đồ trạng thái thanh toán. Chưa sửa mã website.

**Đã render trạng thái đơn:** [SVG](diagrams/rendered/07_trang_thai_don_hang.svg) / [PNG](diagrams/rendered/07_trang_thai_don_hang.png), đã rút nhãn và xem lại hình cuối. Tiếp theo sơ đồ trạng thái vận chuyển. Chưa sửa mã website.

**Đã render luồng đặt hàng chính:** [SVG](diagrams/rendered/06_luong_dat_hang.svg) / [PNG](diagrams/rendered/06_luong_dat_hang.png), đã xem nhánh COD/online và giao lại/nhận hàng về. Hình dài, cần bố trí theo nhóm khi đưa vào báo cáo. Bước tiếp theo render trạng thái đơn hàng; chưa sửa mã website.

**Đã render đủ 6 nguồn use case:** sơ đồ vận chuyển [SVG](diagrams/rendered/05_van_chuyen.svg) / [PNG](diagrams/rendered/05_van_chuyen.png) đã kiểm tra trực quan. Bước tiếp theo render luồng đặt hàng chính (Mermaid), rồi lần lượt trạng thái và ERD. Chưa kiểm tra bố cục trang in, sửa mã hoặc nghiệm thu API hãng.

**Đã render sơ đồ cổng thanh toán:** [SVG](diagrams/rendered/04_cong_thanh_toan.svg) / [PNG](diagrams/rendered/04_cong_thanh_toan.png), đã kiểm tra chữ và include xác thực/chống trùng. Bước tiếp theo render sơ đồ vận chuyển thủ công. Chưa nghiệm thu VNPay hoặc sửa mã website.

**Đã render sơ đồ quản trị viên:** [SVG](diagrams/rendered/03_quan_tri.svg) / [PNG](diagrams/rendered/03_quan_tri.png), đã kiểm tra nhãn và các nhóm quyền. Bố cục dài, cần chia nhóm khi đặt trang báo cáo; UC-34 vẫn có chi tiết thiết kế cần rà soát. Bước tiếp theo render sơ đồ cổng thanh toán. Chưa sửa mã website.

**Đã render sơ đồ nhân viên:** [SVG](diagrams/rendered/02_nhan_vien.svg) / [PNG](diagrams/rendered/02_nhan_vien.png), đã xem chữ, quyền giá/công bố/COD và ghi chú vận chuyển thủ công. Tiếp theo render sơ đồ quản trị viên; chưa sửa mã hoặc xác nhận bố cục trang in.

**Đã render sơ đồ khách hàng:** [SVG](diagrams/rendered/01_khach_hang.svg) / [PNG](diagrams/rendered/01_khach_hang.png), đã xem lại chữ và hướng include/extend. Hình lớn, bố cục trang in cần xử lý khi đóng gói báo cáo. Bước tiếp theo render sơ đồ nhân viên. Chưa sửa mã website.

**Đã render use case tổng quát:** [SVG](diagrams/rendered/00_tong_quat.svg) / [PNG](diagrams/rendered/00_tong_quat.png), đã xem lại chữ và hình; giới hạn bố cục ghi ở [hình đã xuất](diagrams/rendered/README.md). Bước tiếp theo render sơ đồ khách hàng; chưa render toàn bộ hoặc xác nhận trang in báo cáo.

**Kiểm tra trước render:** kiểm tra nguồn và sửa tham chiếu UC-04-R/UC-25/26, sơ đồ nhân viên; kết quả/giới hạn tại [28](28_KIEM_TRA_NGUON_TRUOC_RENDER.md). Tiếp theo chuẩn bị render và xem hình từng sơ đồ, bắt đầu use case tổng quát. Chưa xác nhận bố cục hoặc cú pháp qua trình render.

**VNPay và hủy vận đơn:** đã thêm sequence tối thiểu 9.1, giữ worker ở 9.2 như mở rộng; UC-22/23 và hủy vận đơn thủ công đã đồng bộ. Bước tiếp theo kiểm tra tham chiếu/nội dung sơ đồ trước khi render. Chưa sửa mã hoặc nghiệm thu cổng.

**Tách mở rộng:** đã đưa SHIPPING_RATES và INTEGRATION_JOBS ra khỏi các hình chính sang [tài liệu 27](27_ERD_MO_RONG_VA_LUONG_TICH_HOP.md), đánh dấu sequence worker đề xuất. Tiếp theo chỉnh sequence VNPay tối thiểu và đoạn hủy vận đơn còn API; chưa render hoặc sửa mã.

**Rà soát nguồn sơ đồ:** đã chỉnh use case tổng quát/khách/VNPay/vận chuyển và sequence vận chuyển thủ công; [báo cáo 26](26_RA_SOAT_QUAN_HE_VA_SO_DO.md) ghi rõ phần đã sửa và phần còn lại. Tiếp theo tách hình ERD chính/mở rộng và rà soát luồng API/worker còn sót. Chưa render sơ đồ hoặc sửa mã.

**ERD khuyến mãi/đánh giá/hỗ trợ/audit:** đã bổ sung mục 4.1 tài liệu 07 và [bản giải thích](25_ERD_KHUYEN_MAI_DANH_GIA_HO_TRO_AUDIT.md). Bước tiếp theo: rà soát toàn bộ quan hệ/tham chiếu ERD, rồi đồng bộ sơ đồ use case và luồng. Các nhóm đã rà soát vẫn là thiết kế, chưa nghiệm thu mã hoặc render hình.

**ERD thanh toán/vận chuyển:** đã bổ sung ràng buộc mục 3.1 tài liệu 07 và [bản giải thích](24_ERD_THANH_TOAN_HOAN_TIEN_VAN_CHUYEN.md), tách trạng thái tiền/đơn/kiện và phần API mở rộng. Tiếp theo ERD khuyến mãi/đánh giá/hỗ trợ/audit. Chưa sửa mã hoặc nghiệm thu tích hợp.

**ERD đơn/checkout/kho:** đã cập nhật mục 2 tài liệu 07 và [bản giải thích](23_ERD_DON_HANG_CHECKOUT_VA_KHO.md), phân biệt báo giá trước đơn, snapshot phí cố định và giữ/xuất/hoàn kho. Tiếp theo ERD thanh toán/hoàn tiền/vận chuyển thủ công. Chưa sửa mã hoặc migration.

**Bước hiện tại:** đã rà soát ERD catalog/SKU/thông số, bổ sung ràng buộc mục 1.1 tài liệu 07 và [bản giải thích nhóm dữ liệu](22_ERD_CATALOG_SKU_VA_THONG_SO.md). Tiếp theo: ERD đơn hàng/checkout/kho. Các ghi nhận bên dưới là tiến trình trước; chưa sửa mã, tạo migration hoặc render sơ đồ.

**Cập nhật ERD:** đã chỉnh nhóm tài khoản/phiên/giỏ/reset trong tài liệu 07 và lập [bảng giải thích, ràng buộc và ánh xạ](21_ERD_TAI_KHOAN_GIO_VA_RESET.md). Tiếp theo rà soát ERD catalog/SKU/thông số. Chưa tạo migration, sửa mã hoặc render sơ đồ.

**Bước hiện hành:** đã lập [tổng hợp quyết định nghiệp vụ](20_TONG_HOP_QUYET_DINH_NGHIEP_VU.md), gồm 25 quyết định đã thống nhất, phần chưa chốt và các chỗ cần đồng bộ. Tiếp theo rà soát ERD tài khoản/phiên/giỏ/reset theo bản tổng hợp này. Những câu “bước tiếp theo” bên dưới là ghi nhận các vòng trước, không phải công việc mới cần thực hiện lại. Chưa sửa mã website.

Hỗ trợ theo đơn đã chốt: khách tạo yêu cầu cho đơn của mình; STAFF/ADMIN xem/trả lời; khách chỉ thấy trao đổi công khai, không thấy ghi chú nội bộ; trạng thái mới → đang xử lý → đã đóng. UC-30/31, ghi chú ERD và AT-56..58 đã cập nhật. Bước tiếp theo: tổng hợp quyết định và rà soát phần còn chưa thống nhất. Chưa sửa mã hoặc chạy nghiệm thu.

Quên mật khẩu đã chốt ngày 14/10/2026: liên kết email dùng một lần, hạn 30 phút; thông báo chung; reset thành công vô hiệu mọi phiên cũ và giữ giỏ/lịch sử đơn. Đã bổ sung UC-04-R thuộc nhóm tài khoản và AT-41..43; chưa sửa mã, chưa nghiệm thu SMTP thật. Bước kế tiếp: rà soát nhóm sản phẩm và quyền tạo nháp/công bố. Các ghi nhận bên dưới là tiến trình các bước trước.

Đã chốt ngày 14/10/2026: CUSTOMER đăng nhập gộp giỏ vãng lai và giỏ tài khoản một lần, cộng số lượng cùng SKU; vượt tồn/giới hạn báo khách điều chỉnh trước đặt; tải trang không cộng lại. Đổi mật khẩu phải xác minh mật khẩu hiện tại, vô hiệu mọi phiên cũ khi thành công, đăng nhập lại bằng mật khẩu mới; giữ giỏ tài khoản và lịch sử đơn. UC-04 và AT-39/40 đã cập nhật; chưa sửa mã hoặc chạy nghiệm thu. Bước tiếp theo: rà soát quy trình quên mật khẩu.

Đã chốt ngày 14/10/2026: giỏ CUSTOMER lưu theo tài khoản, đăng xuất không mất giỏ; đăng nhập lại thấy giỏ cũ, trước đặt kiểm tra giá/tồn. ERD CARTS/CART_ITEMS phù hợp; mã hiện còn lưu giỏ trong phiên và cần điều chỉnh sau giai đoạn tài liệu. Bổ sung AT-35, chưa chạy nghiệm thu. Tài khoản quản lý mua bằng CUSTOMER riêng đã chốt; bước tiếp theo là cách gộp giỏ khi đăng nhập.

Đã rà soát riêng [tài khoản và phân quyền](19_RA_SOAT_TAI_KHOAN_VA_PHAN_QUYEN.md): có các khác biệt giữa ERD mục tiêu và session/giỏ thực tế, cùng các ca nghiệm thu cần bổ sung. Đã chốt ngày 14/10/2026: ADMIN khóa/mở khóa CUSTOMER/STAFF có lý do; khóa vô hiệu mọi phiên, mở khóa đăng nhập lại; giữ tài khoản/lịch sử đơn. Giỏ qua đăng xuất đã chốt; chưa sửa mã hoặc công bố bộ test đã đạt.

Đã chốt ngày 14/10/2026 về báo cáo: doanh thu tiền hàng chỉ tính đơn đã giao và đã thanh toán, bằng tiền hàng trừ giảm giá, không gồm phí giao; đơn hủy/giao thất bại không tính. Tiền thu, tiền hoàn và phí giao hiển thị riêng. Bước tiếp theo: tổng hợp các quyết định đã chốt và đối chiếu ERD/tiêu chí nghiệm thu để xác định phần còn là giả định.

Đã chốt ngày 14/10/2026 về giao thất bại: ghi nhận lý do, có thể giao lại; chỉ cộng kho khi cửa hàng xác nhận nhận hàng trả về; đã thu tiền thì ghi khoản cần hoàn, không tự coi đã hoàn. Một đơn một kiện và vận chuyển thủ công đã chốt, UC-25/26 đã được cập nhật.

Cơ chế tồn kho, thời hạn online và quyền xác nhận COD đã chốt. COD chỉ được ADMIN xác nhận thu đủ tiền kèm mã chứng từ và ghi chú; STAFF cập nhật giao hàng, DELIVERED không tự chuyển PAID. Xem [luồng đặt hàng và giao hàng](18_LUONG_DAT_HANG_VA_GIAO_HANG.md).

Phạm vi thanh toán đã chốt: COD và VNPay sandbox, chưa giao dịch tiền thật. Vận chuyển đã chốt ngày 13/10/2026: cập nhật thủ công phục vụ đồ án; STAFF/ADMIN nhập hãng, mã vận đơn và trạng thái giao hàng. Dữ liệu mô phỏng trong demo phải ghi rõ. Tích hợp API hãng là phần mở rộng giai đoạn sau, không bắt buộc cho bản đồ án hiện tại. Chưa nghiệm thu kết nối VNPay bên ngoài trong bước tài liệu này.

Phí giao cố định, khuyến mãi, đánh giá và doanh thu đã chốt. Các quy tắc hủy đã được đánh dấu trong UC-20/21 và BR-06. ERD và nghiệm thu còn các tham chiếu biểu phí nâng cao cần được đánh dấu là mở rộng khi rà soát các phần đó; chưa thay đổi mã nguồn.

## Tài liệu cũ

[02](02_DAC_TA_SAN_PHAM_VA_LO_TRINH.md) ghi nhận bản sửa quyền giá và lộ trình; [03](03_ERD_DE_XUAT.md) là ERD sơ bộ. Chúng được giữ làm lịch sử và dẫn sang bộ đặc tả mới, không dùng thay thế tài liệu mục tiêu. Báo cáo ở thư mục gốc ngày 02/10/2026 mô tả thời điểm chưa có mã nguồn.
