# Rà soát quan hệ và nguồn sơ đồ

Rà soát tài liệu theo bản tổng hợp 20; không nghiệm thu mã nguồn.

## Đã kiểm tra và chỉnh

- Quan hệ user/giỏ/reset, sản phẩm/SKU/thuộc tính, dòng đơn/reservation, đơn/checkout và đơn/vận đơn có nguồn tham chiếu trong ERD 07. Checkout chưa tạo đơn cho phép liên kết order nullable; mỗi đơn có tối đa một vận đơn.
- Nguồn PlantUML tổng quát và vận chuyển đã bỏ liên kết trực tiếp hãng với chức năng website trong bản thủ công. ACT-05 vẫn hiện làm bối cảnh, có ghi chú trao đổi ngoài website/API mở rộng.
- Sơ đồ khách thêm UC-04-R; sơ đồ thanh toán ghi rõ VNPay sandbox.
- Sequence giao hàng/COD trong 06 đã đổi từ worker/callback hãng sang nhân viên nhập mã và cập nhật thủ công; COD vẫn do ADMIN đối soát riêng.

## Chưa hoàn thành toàn bộ

- Nguồn ERD còn SHIPPING_RATES/INTEGRATION_JOBS cho mở rộng; cần tách hình chính/hình mở rộng khi xuất báo cáo.
- Một số luồng hoạt động/trạng thái và sequence thanh toán vẫn mô tả worker/API mục tiêu; phải rà soát tiếp và ghi rõ giới hạn, không coi đã đồng bộ toàn bộ từ việc sửa sequence vận chuyển.
- UC-04-R đã vào sơ đồ khách, nhưng sơ đồ tài khoản nhân viên/quản trị và danh mục truy vết cần kiểm tra bổ sung khi xuất bộ cuối.
- Cardinality chỉ mô tả số lượng quan hệ; quyền chủ đơn, kiểu thuộc tính, thời hạn và bước trạng thái phải kiểm tra bằng ràng buộc/dịch vụ, không suy ra chỉ từ FK.
- Chưa render Mermaid/PlantUML hoặc kiểm tra bố cục. Kiểm tra nguồn không chứng minh trình render chấp nhận mọi ký hiệu.

Bước tiếp theo: tách ERD bản đồ án và phần mở rộng, rồi rà soát các luồng còn API/worker trước khi render. Chưa sửa mã website/migration hoặc chạy lại test.
