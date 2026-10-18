# ERD danh mục, sản phẩm, SKU và thông số

Ngày rà soát: 14/10/2026. Thiết kế mục tiêu theo QD-09..14; chưa sửa mã hoặc migration.

## Dữ liệu và quan hệ

| Bảng | Vai trò | Quan hệ/ràng buộc |
|---|---|---|
| categories | Danh mục, ví dụ điện thoại/laptop | Có nhiều sản phẩm và định nghĩa thông số; có thể chưa có dữ liệu con |
| brands | Thương hiệu | Có nhiều sản phẩm; có thể chưa có sản phẩm |
| products | Thông tin chung, danh mục/thương hiệu, nháp/công bố/ẩn | Một danh mục, một thương hiệu; nháp có thể chưa có SKU/ảnh |
| product_variants | SKU theo màu/cấu hình, mã/giá/tồn riêng | Thuộc một sản phẩm, mã duy nhất; giá NULL khi nháp, >0 khi bán |
| product_images | Ảnh hợp lệ, mô tả, thứ tự | Thuộc một sản phẩm; đủ ít nhất một ảnh trước công bố |
| attribute_definitions | Tên/mã, kiểu, đơn vị, bắt buộc theo danh mục | UNIQUE(category_id,code); ADMIN quản lý |
| variant_attribute_values | Giá trị thông số từng SKU | UNIQUE(variant_id,attribute_id); đúng kiểu/danh mục; STAFF nhập |

Nguồn sơ đồ Mermaid ở [ERD chung, mục 1](07_ERD_VA_TU_DIEN_DU_LIEU.md), ràng buộc bổ sung ở mục 1.1. Không tạo bảng riêng cho kết quả so sánh/gợi ý: chúng được tính từ SKU, thông số và giao dịch; cách lưu danh sách so sánh là chi tiết kỹ thuật.

## Ví dụ để phân biệt sản phẩm và SKU

Sản phẩm “Điện thoại A” có hai SKU: A-128-BLACK (128GB đen) và A-256-WHITE (256GB trắng). Tên/mô tả/thương hiệu thuộc products; màu, cấu hình, giá và tồn thuộc từng SKU. Bộ nhớ có giá trị 128/256 trong thông số kiểu NUMBER, đơn vị GB.

Một SKU hết hàng không làm SKU còn lại hết hàng. Nếu tất cả SKU bán được đều hết tồn, sản phẩm vẫn công khai nhưng hiển thị “Hết hàng”, không cho đặt. So sánh vẫn được; gợi ý không chọn sản phẩm không có SKU còn hàng.

## Đối chiếu với mã và phần còn lại

- Mã đã có bảng catalog/SKU/ảnh/định nghĩa/giá trị; không cần kết luận phải xây lại toàn bộ.
- Mã có cột tên danh mục/thương hiệu và giá/tồn products cũ để tương thích; thiết kế mục tiêu dùng quan hệ ID và giá/tồn SKU. Khi chuẩn bị sửa schema phải đánh giá dữ liệu cũ, không xóa cột ngay.
- Ảnh thực tế lưu dữ liệu binary trong CSDL; ERD dùng storage_key để biểu diễn định danh, chưa quyết định chuyển sang filesystem/object storage.
- Giá trị thông số số trong mã dùng REAL; tiền vẫn phải là số chính xác/nguyên VND, không áp dụng REAL cho giá.
- Phân cấp danh mục, bảo hành/serial và trọng lượng vận chuyển chưa là điều kiện bắt buộc của bản đồ án đã chốt.
- Chưa chốt chính sách đổi danh mục, ngừng dùng thương hiệu, sửa mã SKU đã phát sinh đơn. Cần làm rõ khi đặc tả thao tác liên quan.

Các AT-44..55 là tiêu chí kiểm tra công bố/thông số/so sánh/gợi ý, chưa được chạy lại trong bước này. Chưa render sơ đồ để xem bố cục. Bước tiếp theo: ERD đơn hàng, checkout và giữ/xuất kho.
