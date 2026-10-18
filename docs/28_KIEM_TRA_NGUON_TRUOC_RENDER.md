# Kiểm tra nguồn tài liệu trước render

Đã kiểm tra bằng script đọc tệp: 28 tệp Markdown tại thời điểm chạy, không có đường dẫn nội bộ tới tệp không tồn tại hoặc code fence chưa đóng; 34 UC chính xuất hiện đúng một lần trong đặc tả; có UC-04-R. Sáu nguồn PlantUML có start/end, các alias trong quan hệ được khai báo. Kiểm tra alias không thay thế parser PlantUML.

Rà soát nội dung phát hiện và đã sửa: danh mục UC-25/26 còn mô tả hãng là tác nhân callback chính; sơ đồ nhân viên còn liên kết hãng trực tiếp vào chức năng website. Đã chuyển thành thông tin ngoài website, bổ sung UC-04-R trong danh mục và sơ đồ nhân viên/quản trị.

Chưa render SVG/PNG; chưa xác minh bố cục, phông tiếng Việt, cú pháp đầy đủ Mermaid/PlantUML hoặc đường dẫn anchor. Không coi kiểm tra nguồn là tài liệu đã sẵn sàng nộp. Không chạy lại kiểm thử ứng dụng hoặc sửa mã.

Bước tiếp theo: chuẩn bị công cụ render, xuất từng sơ đồ và xem lại hình, bắt đầu sơ đồ use case tổng quát; giữ nhãn bản chính/mở rộng. Sau khi sửa nguồn, kiểm tra lại tham chiếu nếu có đổi mã/tên tệp.
