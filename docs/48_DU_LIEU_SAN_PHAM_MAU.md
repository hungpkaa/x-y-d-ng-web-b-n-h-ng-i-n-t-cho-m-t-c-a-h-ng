# Mở rộng danh mục sản phẩm mẫu

Đã nhập thêm 27 sản phẩm, 76 ảnh WebP vào cơ sở dữ liệu đang cấu hình trong `.env`. Tổng sau nhập: 33 sản phẩm, 12 thương hiệu; gồm 13 điện thoại, 7 laptop, 3 tablet, 4 tai nghe và 6 phụ kiện.

## Nguồn và giới hạn

### Đợt bổ sung danh mục

Thêm 19 sản phẩm và 29 ảnh WebP từ DummyJSON và Fake Store API, nâng tổng lên 52 sản phẩm ở 8 danh mục. Snapshot bổ sung nằm tại `fixtures/catalog/extra-products.json`: 5 điện thoại, 1 tablet, 3 phụ kiện chụp ảnh, 4 thiết bị điện gia dụng, 2 màn hình và 4 thiết bị lưu trữ. Giá và tồn kho vẫn là dữ liệu mẫu; thông số cần được xác minh trước khi bán thật.

`npm.cmd run catalog:expand` tải lại snapshot bổ sung và chuẩn bị ảnh. `catalog:images` chuẩn bị ảnh của cả hai snapshot; `catalog:import` nhập cả hai snapshot vào cơ sở dữ liệu đang cấu hình. Mục Fake Store API dùng SKU `SAMPLE-FS-`, các mục DummyJSON giữ `SAMPLE-DJ-`; audit log lưu URL nguồn tương ứng. Nhập lại không ghi đè sản phẩm cũ.

- Dữ liệu và các góc ảnh: [DummyJSON Products](https://dummyjson.com/docs/products), bộ dữ liệu phục vụ thử nghiệm và phát triển giao diện. Không phải danh mục hàng mới nhất hoặc bảng giá Việt Nam.
- Snapshot nguồn tại `fixtures/catalog/products.json`; URL nguồn từng sản phẩm và ảnh được lưu trong audit log khi nhập.
- Giá quy đổi mẫu theo hệ số cố định 25.000, làm tròn 10.000 đồng; đây không phải tỷ giá hiện hành. Mỗi SKU mới có 12 đơn vị tồn mẫu cùng lịch sử nhập kho. Mô tả công khai ghi rõ dữ liệu mẫu.
- Không tự nhận thông số RAM, dung lượng, màu sắc hay ảnh thuộc một phiên bản cấu hình cụ thể khi nguồn chưa xác minh. Cần quản trị viên bổ sung trước khi bán thật. Không nhập đánh giá hay số sao từ dữ liệu mẫu.
- Không thay thế ảnh các sản phẩm cũ bằng ảnh của mẫu máy khác. Sáu sản phẩm có sẵn được giữ nguyên giá, SKU và tồn kho; ảnh tham khảo được bổ sung riêng như bên dưới.

## Chạy lại trên máy khác

1. `npm.cmd run catalog:images`: tải 76 ảnh từ CDN nguồn, kiểm tra và chuyển WebP, lưu bộ đệm tại `data/catalog-import/images` (không đưa vào Git).
2. `npm.cmd run catalog:import`: dùng SQLite/PostgreSQL theo cấu hình hiện tại, lưu ảnh trong `product_images` để phục vụ bằng `/media/...`. Website không tải ảnh trực tiếp từ CDN ngoài.

Chỉ chạy nhập khi muốn bổ sung dữ liệu mẫu vào cơ sở dữ liệu đó. Các SKU dùng tiền tố `SAMPLE-DJ-`. Chạy lại sẽ bỏ qua SKU/tên đã tồn tại, không cập nhật giá, tồn, đơn hàng hoặc ảnh cũ. Nhập trong một giao dịch: lỗi sẽ hoàn tác toàn bộ. Nếu danh mục có thông số bắt buộc chưa nhập, sản phẩm mới ở bản nháp thay vì công bố thiếu thông tin.

## Xác minh

### Bổ sung ảnh cho sáu sản phẩm gốc

Đã bổ sung 13 ảnh cho cả sáu sản phẩm ban đầu, nâng tổng lên 89 ảnh; không còn sản phẩm nào trong 33 sản phẩm thiếu ảnh. Loại hai ảnh quảng cáo có chữ cấu hình để tránh nhầm với cấu hình đang lưu. Chạy lại bỏ qua sản phẩm đã có ảnh.

`npm.cmd run catalog:fill-images` bổ sung ảnh khi sản phẩm chưa có ảnh, không ghi đè bộ ảnh quản trị viên đã tải. Danh sách ánh xạ và trang nguồn CellphoneS tại `fixtures/catalog/existing-product-images.json`. Ảnh thể hiện mẫu máy và các màu tham khảo, không cam kết màu của SKU trong kho. Riêng ASUS Vivobook 15 là ảnh tham khảo dòng A1505VA-MA492W; sản phẩm gốc chưa có mã model chi tiết. Ảnh lưu WebP trong cơ sở dữ liệu, kèm nguồn trong audit log; không sửa tên, giá, cấu hình hoặc tồn kho. Cần rà soát quyền sử dụng ảnh trước khi dùng danh mục này để kinh doanh.

- Kiểm thử thêm mới, số ảnh, lịch sử tồn, chạy lại không ghi đè, thiếu ảnh và rollback giữa chừng.
- Bộ kiểm thử: 135 đạt, 11 PostgreSQL bỏ qua, 0 lỗi.
- Đã thực hiện nhập trên PostgreSQL đang cấu hình: 27 sản phẩm, 76 ảnh, 0 bản nháp. Truy cập danh mục Laptop, trang sản phẩm mới và ảnh `/media` trên server hiện tại đều trả HTTP 200; ảnh trả `image/webp`.
