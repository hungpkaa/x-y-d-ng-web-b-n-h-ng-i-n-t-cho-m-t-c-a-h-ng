# Chatbot hỗ trợ người dùng

Bản đầu chạy tại website, không cần API key hoặc dịch vụ AI bên ngoài. Chatbot dùng quy tắc tiếng Việt và truy vấn dữ liệu hiện có, không phải mô hình AI hội thoại.

## Sử dụng

Khởi động lại bằng `npm start` (`npm.cmd start` nếu PowerShell chặn script), nhấn Ctrl+F5. Nút **💬 Hỗ trợ** xuất hiện góc dưới bên phải trang khách hàng, hỗ trợ khách vãng lai và khách đăng nhập.

- Hỏi “laptop dưới 25 triệu”, “iPhone” để tìm tối đa 5 sản phẩm đang công bố, có SKU còn hàng. Giá hiển thị là giá thấp nhất trong các SKU còn hàng; bấm liên kết để xem cấu hình và giá hiện tại.
- Hỏi “đơn hàng của tôi”, “trạng thái đơn #1” để tra cứu đơn mới nhất hoặc theo mã. Chỉ CUSTOMER ACTIVE được tra cứu và chỉ thấy đơn của chính mình.
- Hỏi về đặt hàng, hủy đơn PENDING, COD/VNPay, phí giao hàng, tài khoản để nhận hướng dẫn và liên kết phù hợp.
- Hỏi về bảo hành, đổi trả, hoàn tiền hoặc cần nhân viên: chatbot dẫn đến phiếu hỗ trợ. Không tự xác nhận chính sách, thời gian giao hay kết quả hoàn tiền chưa được cấu hình.

Chatbot chỉ đọc dữ liệu, không tự đặt/hủy đơn, thu tiền hoặc chỉnh sản phẩm. Câu hỏi tối đa 500 ký tự; endpoint POST `/chatbot/message` yêu cầu CSRF, giới hạn 20 yêu cầu/phút theo phiên. Nội dung hiển thị bằng textContent; không thực thi HTML từ câu hỏi. Đơn riêng không được tra cứu theo email hay mã đơn của người khác.

## Giới hạn bản đầu

Tìm sản phẩm theo từ khóa và ngân sách dạng “25 triệu”/“25 tr”; chưa hiểu mọi cách diễn đạt hoặc ngữ cảnh nhiều lượt. Tìm trong tối đa 500 sản phẩm còn hàng giá thấp nhất. Tin nhắn hiển thị trong trang hiện tại, không lưu transcript lâu dài và không gửi sang bên thứ ba. Phiếu hỗ trợ vẫn yêu cầu khách đăng nhập.

Có thể phát triển bản AI sau khi chọn nhà cung cấp: tìm kiếm theo tài liệu/chính sách đã duyệt, truy vấn sản phẩm và đơn qua công cụ có quyền, trả lời có nguồn, chuyển nội dung sang phiếu hỗ trợ với sự đồng ý của khách. API key phải lưu server; cần kiểm soát chi phí và kiểm thử trước khi bật.

## Kiểm tra

89 ca local đạt; smoke PostgreSQL đạt, gồm chat tìm sản phẩm, CSRF và quyền tra cứu đơn chính chủ. Chưa thao tác trực tiếp giao diện chat trên trình duyệt/mobile.
