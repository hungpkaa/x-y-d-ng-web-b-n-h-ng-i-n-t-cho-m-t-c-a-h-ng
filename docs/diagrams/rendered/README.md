# Hình sơ đồ đã xuất

## ERD catalog, SKU và thông số

- Nguồn: nhóm catalog chọn từ mục 1 tài liệu 07; [MMD](13_erd_catalog_sku_thong_so.mmd), [SVG](13_erd_catalog_sku_thong_so.svg), [PNG](13_erd_catalog_sku_thong_so.png).
- Gồm categories, brands, products, product_variants, product_images, attribute_definitions và variant_attribute_values; không lẫn các bảng tài khoản/giỏ.
- SVG từ mermaid.ink, nội dung bảng 14px; PNG từ Edge headless cục bộ và cắt trắng bằng Pillow. Đã mở PNG: tên bảng/cột và PK/FK/UK đọc được; quan hệ sản phẩm/SKU/ảnh và định nghĩa/giá trị thể hiện riêng.
- parent_id, warranty_months, weight_grams giữ làm trường tùy chọn trong thiết kế; không suy ra phân cấp/bảo hành hoặc trọng lượng bắt buộc của bản phí cố định. Đọc cùng mục 1.1 và từ điển để biết ràng buộc kiểu/đơn vị/unique cặp thuộc tính.
- Hình dài theo chiều dọc; cần bố trí trang phù hợp hoặc chia phần khi đóng gói báo cáo. Chưa nghiệm thu trang in/schema thật.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram catalog-erd`. Không sửa mã website hoặc migration.

## ERD tài khoản, phiên, giỏ và reset

- Nguồn: nhóm chọn từ mục 1 tài liệu 07; [MMD](12_erd_tai_khoan_gio_reset.mmd), [SVG](12_erd_tai_khoan_gio_reset.svg), [PNG](12_erd_tai_khoan_gio_reset.png).
- Gồm users, addresses, sessions, carts/cart_items/cart_merges và password_reset_tokens; giữ product_variants chỉ với id như nút tham chiếu bên ngoài nhóm.
- SVG từ mermaid.ink sau lần đầu timeout; PNG từ Edge headless, cắt trắng bằng Pillow. Đã giảm nội dung bảng về 14px và mở xem bản cuối: tên cột/PK/FK/UK đọc được đầy đủ.
- Giỏ độc lập với phiên; token thuộc user; dấu gộp thuộc giỏ; một user có tối đa một giỏ. Nullable, giới hạn và điều kiện nghiệp vụ vẫn đọc cùng từ điển dữ liệu, không chỉ hình.
- Hình rộng, cần bố trí trang ngang hoặc chia nhóm khi đóng gói báo cáo; một số đường dài đi qua vùng giữa các bảng, chưa nghiệm thu bố cục trang in.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram identity-erd`. Đây là schema mục tiêu, không khẳng định các bảng mới đã có trong mã.

## Tuần tự vận chuyển thủ công và COD

- Nguồn: mục 10 tài liệu 06; [MMD](11_tuan_tu_van_chuyen_cod.mmd), [SVG](11_tuan_tu_van_chuyen_cod.svg), [PNG](11_tuan_tu_van_chuyen_cod.png).
- SVG từ mermaid.ink; PNG từ Edge headless cục bộ, cắt trắng bằng Pillow. Đã mở PNG: chữ tiếng Việt, tác nhân và thông điệp không bị cắt.
- Nhân viên trao đổi với hãng ngoài website rồi nhập mã; bàn giao mới giảm on_hand/reserved; DELIVERED vẫn UNPAID cho tới ADMIN đối soát riêng. Không có callback/API hãng trực tiếp trong luồng này.
- Sequence minh họa luồng thành công; giao lại/hàng về/hủy thuộc các sơ đồ trạng thái và ngoại lệ khác. Phải kiểm tra số tiền/chứng từ trước ghi PAID theo UC-24, không hiểu thông điệp đối soát là cho phép ghi tiền tùy ý.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram cod-sequence`. Chưa nghiệm thu mã hoặc bố cục trang báo cáo.

## Tuần tự VNPay sandbox tối thiểu

- Nguồn: mục 9.1 tài liệu 06; [MMD](10_tuan_tu_vnpay_sandbox.mmd), [SVG](10_tuan_tu_vnpay_sandbox.svg), [PNG](10_tuan_tu_vnpay_sandbox.png).
- SVG từ mermaid.ink; PNG từ Edge headless cục bộ, cắt trắng bằng Pillow. Đã mở PNG: chữ tiếng Việt, tác nhân và khung alt đọc được, không bị cắt.
- Có tạo đơn/giữ hàng, lưu attempt/tham chiếu/hạn, URL server ký, IPN, xác minh, nhánh kết quả sai/đúng và đọc trạng thái khi quay lại. Không có worker bắt buộc trong luồng tối thiểu; không dùng redirect xác nhận tiền.
- Sequence này minh họa luồng và xử lý kết quả, không bao phủ mọi ngoại lệ timeout/thu muộn/tranh chấp hết hạn; các điều kiện ở tài liệu 06/UC-22/23 vẫn áp dụng.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram vnpay-sequence`. Chưa nghiệm thu merchant, mã ứng dụng hoặc bố cục trang in.

## Trạng thái thanh toán

- Nguồn: mục 13 tài liệu 06; [MMD](09_trang_thai_thanh_toan.mmd), [SVG](09_trang_thai_thanh_toan.svg), [PNG](09_trang_thai_thanh_toan.png).
- SVG từ mermaid.ink, nhãn 14px; PNG từ Edge headless cục bộ và cắt trắng bằng Pillow. Đã rút ngắn nhãn chồng nhau, bổ sung chú giải đầy đủ trong tài liệu 06 và xem lại PNG cuối.
- Có UNPAID/PENDING/PAID/REFUND_PENDING/REFUNDED, đường xác nhận COD bởi ADMIN và thu muộn sau hủy. Nhãn “chưa thu” không có nghĩa mọi đơn đã hủy: xem trạng thái đơn độc lập.
- Chỉ hoàn đủ có bằng chứng mới REFUNDED; không suy ra thu từ redirect hoặc giao thành công. Sandbox không phải khoản tiền thật.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram payment-state`. Chưa nghiệm thu mã/merchant hoặc bố cục trang in.

## Trạng thái vận chuyển

- Nguồn: mục 8 tài liệu 06; [MMD](08_trang_thai_van_chuyen.mmd), [SVG](08_trang_thai_van_chuyen.svg), [PNG](08_trang_thai_van_chuyen.png).
- SVG từ mermaid.ink, nhãn chuyển trạng thái giảm về 14px để tránh sát mép; PNG từ Edge headless cục bộ, cắt phần trắng bằng Pillow. Đã mở và xem lại bản cuối, chữ tiếng Việt đầy đủ.
- Có CREATED/READY/IN_TRANSIT/DELIVERED/FAILED/RETURNED/CANCELLED; FAILED có thể giao lại, RETURNED chỉ khi hàng thực về, hủy chỉ trước bàn giao.
- Trạng thái kiện không tự xác nhận thu COD hoặc hoàn tiền. Bản đồ án do STAFF/ADMIN cập nhật thủ công; việc hủy với hãng thực hiện ngoài website.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram shipping-state`. Chưa nghiệm thu trang in hoặc mã ứng dụng.

## Trạng thái đơn hàng

- Nguồn: mục 7 của tài liệu 06; [MMD](07_trang_thai_don_hang.mmd), [SVG](07_trang_thai_don_hang.svg), [PNG](07_trang_thai_don_hang.png).
- SVG từ mermaid.ink; PNG từ Edge headless cục bộ, cắt phần trắng bằng Pillow. Đã mở và xem lại bản cuối sau khi rút ngắn nhãn hủy bị cắt.
- Nhánh PENDING/CONFIRMED/PREPARING/SHIPPING/DELIVERED và CANCELLED/DELIVERY_FAILED đọc rõ; chú giải tại tài liệu 06: hạn chỉ ONLINE chưa thu, N/Q hủy trước bàn giao, khách chỉ hủy PENDING của mình, thất bại chỉ kết thúc khi nhận hàng về.
- Hình trạng thái đơn không thay thế trạng thái thanh toán hoặc kiện; không suy ra đã hoàn tiền từ CANCELLED.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink --diagram order-state`. Chưa kiểm tra bố cục khi đặt vào báo cáo hoặc nghiệm thu mã.

## Luồng đặt hàng chính (Mermaid)

- Nguồn: mục 5 tài liệu `../../06_QUY_TAC_VA_SO_DO_LUONG.md`; bản trích [MMD](06_luong_dat_hang.mmd), hình [SVG](06_luong_dat_hang.svg) / [PNG](06_luong_dat_hang.png).
- SVG xuất bằng mermaid.ink sau khi Kroki timeout. Máy chủ PNG trả 503; PNG hiện được tạo bằng Edge headless từ SVG cục bộ, không phải ảnh lỗi của dịch vụ.
- Đã mở PNG: thấy đủ nhánh đăng nhập/báo giá/chống đặt trùng, COD/online, giữ/xuất hàng, vận chuyển thủ công, giao lại/nhận hàng về và khoản cần hoàn; chữ tiếng Việt không bị cắt.
- Đã bổ sung nhánh giao lại và điều kiện xác nhận nhận hàng về trước cộng kho. Luồng tổng chưa mô tả mọi ngoại lệ callback muộn/hủy; các ngoại lệ ở mục 6 của tài liệu 06, không được suy ra từ hình này.
- Hình dài, không nên thu nhỏ toàn bộ vào một trang A4; cần chia theo nhóm khi đóng gói báo cáo. Chưa xác nhận bố cục trang in hoặc chạy nghiệm thu mã.
- Tái xuất SVG: `python scripts/render-order-flow.py --service mermaid-ink`. Lệnh chỉ gửi nguồn luồng được trích, không đọc `.env` hoặc CSDL. PNG remote là tùy chọn `--png`, có thể lỗi dịch vụ.

## Use case vận chuyển thủ công

- Nguồn: `../05_van_chuyen.puml`; hình [SVG](05_van_chuyen.svg) / [PNG](05_van_chuyen.png).
- Đã mở PNG: chữ tiếng Việt/nhãn không bị cắt; STAFF/ADMIN liên kết UC-25/26; hãng ở ngoài website với ghi chú API/callback mở rộng.
- Include kiểm tra quyền/chống lặp và bước trạng thái đúng hướng; ghi rõ một đơn một kiện/mã, không giao từng phần, giao xong chưa tự xác nhận thu COD.
- Hình thể hiện phạm vi nghiệp vụ thủ công, không xác nhận đã tích hợp nhà vận chuyển.
- Tái xuất: `python scripts/render-usecase.py 05_van_chuyen`. Chưa nghiệm thu trang in hoặc sửa mã website.

## Tổng kết lượt xuất use case

Đã xuất và mở xem cả 6 sơ đồ tổng quát/khách/nhân viên/quản trị/cổng/vận chuyển. Các hình đều cần kiểm tra lại khi đặt vào báo cáo, đặc biệt ba hình theo vai trò và hình tổng quát dài/nhiều liên kết. ERD và các sơ đồ hoạt động/trạng thái/sequence Mermaid chưa được render trong lượt này. Không coi bộ tài liệu đã hoàn tất chỉ từ việc xuất đủ use case.

## Use case cổng thanh toán

- Nguồn: `../04_cong_thanh_toan.puml`; hình [SVG](04_cong_thanh_toan.svg) / [PNG](04_cong_thanh_toan.png).
- Đã mở PNG: chữ và nhãn không bị cắt; tiêu đề ghi VNPay sandbox, có UC-22/23 và quan hệ include hướng tới xác thực/chống trùng.
- Ghi chú phân biệt trang quay lại với kết quả xác thực: redirect không tự xác nhận PAID. Hình thể hiện nghiệp vụ, không xác nhận merchant/IPN đã chạy thực tế.
- Bố cục ngang, ít nút; vẫn cần kiểm tra kích thước chữ khi đặt vào trang báo cáo.
- Tái xuất: `python scripts/render-usecase.py 04_cong_thanh_toan`. Chưa sửa mã website hoặc nghiệm thu tích hợp ngoài.

## Use case quản trị viên

- Nguồn: `../03_quan_tri.puml`; hình [SVG](03_quan_tri.svg) / [PNG](03_quan_tri.png).
- Đã mở PNG: chữ tiếng Việt, tiêu đề và nhãn UC không bị cắt; có quản lý tài khoản, giá, công bố/ẩn, catalog, đơn, thu COD, khuyến mãi, duyệt đánh giá, hỗ trợ, báo cáo và nhật ký.
- Không có giỏ/đặt mua bằng vai trò quản trị; việc mua dùng CUSTOMER riêng theo quyết định đã chốt.
- UC-34 trong hình là thiết kế ghi nhận hoàn thủ công hiện có; chi tiết quyền/quy trình hoàn vẫn cần rà soát riêng, hình không thay thế quyết định nghiệp vụ đó.
- Bố cục dài; chưa phù hợp thu nhỏ vào một trang A4 mà không kiểm tra. Có thể chia nhóm quản trị hàng/tài khoản và đơn/tài chính khi đóng gói báo cáo.
- Tái xuất: `python scripts/render-usecase.py 03_quan_tri`. Chưa nghiệm thu bố cục trang in hoặc sửa mã website.

## Use case nhân viên

- Nguồn: `../02_nhan_vien.puml`; hình [SVG](02_nhan_vien.svg) / [PNG](02_nhan_vien.png).
- Đã mở PNG: chữ tiếng Việt và nhãn không bị cắt; STAFF có tạo nháp/cập nhật thông tin/ảnh/thông số/tồn, xử lý đơn và hỗ trợ.
- Ghi chú phân biệt không đặt giá/công bố, không xác nhận thu COD; hãng vận chuyển trao đổi ngoài website, không nối API trực tiếp.
- Có UC-04-R; sơ đồ hiển thị năng lực tài khoản, không có nghĩa reset cần đăng nhập.
- Hình dài theo chiều dọc; cần xem lại kích thước trang in khi đưa vào Word. Chưa nghiệm thu bố cục trang in.
- Tái xuất: `python scripts/render-usecase.py 02_nhan_vien`. Không sửa mã website.

## Use case khách hàng

- Nguồn: `../01_khach_hang.puml`.
- Hình: [SVG](01_khach_hang.svg), [PNG](01_khach_hang.png).
- Đã mở PNG: chữ tiếng Việt và nhãn UC đọc được, không bị cắt; UC-04-R có ghi điều kiện trước đăng nhập và hạn liên kết 30 phút.
- Include hướng từ báo giá/đặt hàng tới hành vi dùng lại; extend áp mã hướng về báo giá, có điều kiện nhập mã.
- Hình có nhiều đường liên kết và kích thước lớn, còn khoảng trống; bản tổng theo tác nhân không nên thu nhỏ vào một trang A4 mà chưa kiểm tra. Khi đóng gói báo cáo có thể chia hình theo nhóm tài khoản/catalog/mua hàng để dễ đọc; bước này chưa xuất bố cục trang in.
- Xuất riêng bằng `python scripts/render-usecase.py 01_khach_hang`; script chỉ nhận tên một trong sáu sơ đồ sẵn có.

## Use case tổng quát

- Nguồn: `../00_tong_quat.puml`.
- Hình: [SVG](00_tong_quat.svg), [PNG](00_tong_quat.png).
- Xuất bằng máy chủ PlantUML công khai qua `scripts/render-usecase.py`; chỉ gửi nguồn sơ đồ, không đọc `.env` hoặc dữ liệu cửa hàng.
- Đã mở PNG kiểm tra trực quan: hình hợp lệ, chữ tiếng Việt đọc được, các nhãn không bị cắt; ACT-05 được ghi là thông tin ngoài website, không có API hãng trực tiếp.
- Bố cục tổng quát dài theo chiều dọc và có các đường liên kết giao nhau; nên dùng SVG khi phóng to. Khi đưa vào báo cáo Word cần bố trí trang riêng hoặc dùng các sơ đồ theo tác nhân để đọc chi tiết; chưa xác nhận bố cục trên trang in.

Script đã sửa mã hóa URL sau lần đầu máy chủ trả ảnh báo lỗi; các hình hiện tại là bản hợp lệ thay thế ảnh lỗi. Các sơ đồ khác chưa được render trong bước này. Không sửa mã website hoặc chạy lại kiểm thử ứng dụng.
