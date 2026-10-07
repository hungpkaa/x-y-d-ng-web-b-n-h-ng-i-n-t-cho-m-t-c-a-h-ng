# Bộ tài liệu phân tích và thiết kế Electro Store

**Mới nhất:** [Dashboard, ảnh, yêu thích/đã xem và thông báo trong website](15_DASHBOARD_ANH_YEU_THICH_THONG_BAO.md). Đã triển khai hướng 3–6: SQLite v10, PostgreSQL v3; 87 ca local và 8 ca PostgreSQL đạt, hai luồng smoke đạt. Các số liệu bên dưới là mốc trước đó.

[Kết quả kiểm tra lại và ý tưởng phát triển ngày 07/10/2026](14_KIEM_TRA_VA_DE_XUAT_PHAT_TRIEN.md): 89 ca đạt khi chạy hai bộ, smoke SQLite/PostgreSQL đạt, dữ liệu hiện có không vi phạm các kiểm tra tồn/đơn/hoàn; ghi rõ phạm vi chưa kiểm tra trực tiếp bằng browser hoặc nhà cung cấp thật.

**Cập nhật 07/10/2026:** [đối chiếu 34 UC và phần còn thiếu](12_ECARTS_ET_IMPLEMENTATION.md), [hướng dẫn vận chuyển thủ công](13_SU_DUNG_VAN_CHUYEN.md), [PostgreSQL](11_POSTGRESQL.md). Bản mới bổ sung shipment/nhận hàng về: SQLite v9, PostgreSQL v2; 82 bài local và 7 bài PostgreSQL đạt. Các kết quả v8 dưới đây là mốc trước đó.

Phiên bản thiết kế 1.0 — ngày 05/10/2026. Phạm vi: website bán đồ điện tử cho một cửa hàng. Bộ tài liệu mô tả **hệ thống mục tiêu**, không xác nhận các chức năng đã được lập trình. Kết quả triển khai theo từng bước, schema thực tế và kiểm thử được cập nhật riêng tại [tiến độ triển khai](09_TIEN_DO_TRIEN_KHAI.md).

Cấu hình các chức năng mới: [SMTP, VNPay sandbox và hoàn tiền](10_CAU_HINH_EMAIL_VNPAY.md). Mã nguồn hiện đến migration v8; kết quả mới nhất 77 kiểm thử đạt, chưa nghiệm thu SMTP/merchant VNPay thật.

## Thứ tự đọc

1. [Phạm vi, tác nhân, phân quyền](01_PHAM_VI_TAC_NHAN_VA_PHAN_QUYEN.md).
2. [Danh mục use case và sơ đồ theo tác nhân](04_DANH_MUC_VA_SO_DO_USE_CASE.md).
3. [Đặc tả toàn bộ use case](05_DAC_TA_USE_CASE.md).
4. [Quy tắc, sơ đồ hoạt động, trạng thái và tuần tự](06_QUY_TAC_VA_SO_DO_LUONG.md).
5. [ERD toàn hệ thống, từ điển dữ liệu và ràng buộc](07_ERD_VA_TU_DIEN_DU_LIEU.md).
6. [Ma trận truy vết và nghiệm thu](08_TRUY_VET_VA_NGHIEM_THU.md).

Sơ đồ use case dùng PlantUML để có tác nhân, biên hệ thống và quan hệ UML đúng nghĩa; mã nguồn ở [diagrams](diagrams/). Sơ đồ luồng và ERD dùng Mermaid trong Markdown. Có thể mở PlantUML bằng trình xem hỗ trợ PlantUML và Mermaid bằng trình xem Markdown hỗ trợ Mermaid. Các tệp nguồn cho phép chỉnh sửa, xuất SVG/PNG khi đưa vào báo cáo.

## Mức độ quyết định

- **Đã chốt từ tài liệu trước:** chỉ ADMIN thiết lập/sửa giá; STAFF cập nhật thông tin sản phẩm và tồn kho.
- **Giả định thiết kế cho bộ tài liệu này:** STAFF được tạo bản nháp; ADMIN đặt giá và công bố; tài khoản STAFF/ADMIN dùng tài khoản CUSTOMER riêng để mua; khách chỉ hủy PENDING; COD và một cổng sandbox; mỗi đơn một kiện; đánh giá một lần trên mỗi dòng đơn đã giao; một mã giảm giá/đơn; gợi ý theo quy tắc.
- **Thông số cấu hình chưa lựa chọn:** nhà cung cấp thanh toán/vận chuyển, biểu phí và địa bàn giao hàng, thời hạn thanh toán (mặc định thiết kế 15 phút), thời hạn phiên và giới hạn truy cập. Không cần chọn nhà cung cấp để đọc và rà soát mô hình; phải cấu hình trước tích hợp.
- **Ngoài phạm vi:** nhiều cửa hàng/người bán, kế toán đầy đủ, nhập hàng/nhà cung cấp, chat realtime, ML, đổi trả/bảo hành và hoàn tiền tự động. Trường hợp thu tiền muộn hoặc tiền đã thu khi hủy vẫn phải ghi nhận và xử lý hoàn tiền thủ công có bằng chứng.

Những giả định trên là lựa chọn thiết kế để tài liệu nhất quán, không được ghi là quyết định đã được người dùng phê duyệt. Khi thay đổi, cập nhật đồng thời quyền, đặc tả, sơ đồ, ERD và nghiệm thu.

## Tài liệu cũ

[02](02_DAC_TA_SAN_PHAM_VA_LO_TRINH.md) ghi nhận bản sửa quyền giá và lộ trình; [03](03_ERD_DE_XUAT.md) là ERD sơ bộ. Chúng được giữ làm lịch sử và dẫn sang bộ đặc tả mới, không dùng thay thế tài liệu mục tiêu. Báo cáo ở thư mục gốc ngày 02/10/2026 mô tả thời điểm chưa có mã nguồn.
