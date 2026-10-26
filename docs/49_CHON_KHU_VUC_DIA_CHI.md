# Bộ chọn địa chỉ Việt Nam

Checkout, sổ địa chỉ và hồ sơ dùng tỉnh/thành phố và phường/xã liên kết; người dùng chỉ nhập số nhà, tên đường và chi tiết tòa nhà. Không thay đổi phí vận chuyển hiện có.

Dữ liệu: https://provinces.open-api.vn/api/v2/?depth=2, tải ngày 2026-10-26, mô hình sau sáp nhập 07/2025. Snapshot `public/vietnam-regions.json` gồm 34 tỉnh/thành và 3321 phường/xã/đặc khu, được phục vụ nội bộ để không phụ thuộc API ngoài khi thanh toán.

Máy chủ xác minh mã phường/xã thuộc tỉnh/thành, ghép tên chuẩn với dòng địa chỉ rồi lưu vào trường address hiện có. Không cần di trú dữ liệu; đơn đã đặt và địa chỉ cũ không bị thay đổi. Địa chỉ đã lưu theo định dạng chuẩn được chọn lại tự động. Địa chỉ cũ chưa nhận diện được giữ nguyên để người dùng kiểm tra, chọn lại khu vực khi sửa.

Khi đổi phương thức thanh toán, giữ bản nháp khu vực; khi đổi sang một địa chỉ đã lưu khác, dùng địa chỉ vừa chọn. JavaScript không khả dụng hoặc lỗi tải snapshot: dùng ô nhập địa chỉ đầy đủ dự phòng. Hồ sơ cho phép bỏ trống địa chỉ, còn checkout và sổ địa chỉ bắt buộc có địa chỉ hợp lệ.

Để cập nhật snapshot, tải API v2, giữ cấu trúc province `{code,name,wards:[{code,name}]}` với mã dạng chuỗi, chạy `test/address-regions.test.js` rồi kiểm tra bộ chọn.
