# Quy tắc nghiệp vụ và sơ đồ luồng

Phiên bản 1.0 — 05/10/2026. Các lựa chọn ngoài quyền giá là giả định thiết kế tại [README](README.md). Tất cả thời điểm lưu UTC, hiển thị Asia/Saigon. Dưới đây là thiết kế mục tiêu, khác với bản COD hiện tại ở cách giữ tồn và ghi nhận tiền.

## 1. Quy tắc

| Mã | Quy tắc |
|---|---|
| BR-01 | CUSTOMER chỉ thao tác dữ liệu mình; N/Q dùng tài khoản khách riêng khi mua. Khóa tài khoản vô hiệu hóa phiên qua auth_version. |
| BR-02 | STAFF tạo DRAFT/SKU inactive không giá, sửa thông tin/tồn; chỉ ADMIN đặt giá và công bố/ẩn. SKU active phải có giá > 0. |
| BR-03 | available = on_hand - reserved. Đặt đơn tăng reserved; hủy/hết hạn trước giao giảm reserved; bàn giao giảm cả on_hand và reserved; hàng thực về tăng on_hand. Tất cả nguyên tử và có movement. |
| BR-04 | Server tính subtotal, discount và phí; total = subtotal - discount + shipping_fee. Bản đầu không hỗ trợ đơn miễn phí: tổng giảm tối đa subtotal-1 VND, luôn total>0. Snapshot tên/SKU/cấu hình/giá/địa chỉ/khuyến mãi/phí không đổi sau tạo đơn. Báo giá đổi phải xác nhận lại. |
| BR-05 | Checkout UNIQUE(user_id,request_key); cùng nội dung trả đơn cũ, khác nội dung bị conflict. Callback UNIQUE(provider,event_id); trạng thái terminal không đảo ngược bởi event cũ. |
| BR-06 | CUSTOMER hủy PENDING; N/Q hủy PENDING/CONFIRMED/PREPARING. SHIPPING không hủy trực tiếp. PAID hủy phải REFUND_PENDING, không giả định đã hoàn. |
| BR-07 | COD có thể xác nhận khi UNPAID; ONLINE phải PAID mới CONFIRMED. ONLINE PENDING chưa thu hết hạn 15 phút thì CANCELLED và giải phóng giữ tồn; thời hạn cấu hình. |
| BR-08 | Callback success muộn ghi nhận tiền nhưng không mở lại đơn; REFUND_PENDING và ngoại lệ cho ADMIN. Callback thất bại sau success không lùi PAID. |
| BR-09 | Tạo vận đơn chưa phải giao hàng. SHIPPING chỉ khi bàn giao thực tế; DELIVERED chưa phải thu COD. Giao thất bại chưa cộng kho; nhận lại hàng rồi mới cộng. |
| BR-10 | Một mã/đơn; FIXED hoặc PERCENT 1–100 có trần; thời gian [start,end), minimum theo subtotal; phạm vi PRODUCT hoặc ALL; không giảm phí ship. Lượt HELD+USED tính vào limit. Hủy trước bàn giao → RELEASED; bàn giao → USED; đơn thất bại sau bàn giao không tự phục hồi lượt. |
| BR-11 | Một review/order_item; chủ đơn DELIVERED, 1–5 sao; chỉ APPROVED hiển thị/tính trung bình. Sửa lại phải duyệt lại. |
| BR-12 | Doanh thu hàng ghi nhận khi đơn DELIVERED và payment PAID: subtotal-discount, không gồm ship. recognition_at là thời điểm điều kiện cuối đạt. Tiền thu/hoàn dựa ledger SUCCEEDED theo occurred_at. Báo cáo net cash = thu - hoàn gồm ship; không gọi net cash là lợi nhuận. |
| BR-13 | Không xóa giao dịch/đối tượng được tham chiếu; ẩn/khóa. Audit ghi người/nguồn, thời gian, lý do, trước/sau đã che nhạy cảm; không cung cấp chức năng sửa/xóa. |
| BR-14 | So sánh tối đa 3 SKU cùng danh mục; thông số có kiểu và đơn vị. Gợi ý không ML: cùng danh mục +50, cùng thương hiệu +20, giá lệch <=20% +10; tie-break lượng đã giao giảm dần rồi ID. |
| BR-15 | Một đơn một shipment. Phí theo shipping_rate áp cho địa bàn, trọng lượng và hiệu lực; chưa có biểu phí thực thì không nhận checkout ở địa bàn chưa cấu hình. Không ngầm miễn phí ngoài demo. |
| BR-16 | Tác vụ nền và API ngoài dùng job bền vững; retry giữ request_key. Timeout là chưa rõ kết quả, phải tra cứu/retry cùng tham chiếu trước khi tạo yêu cầu mới. |

## 2. Ma trận chuyển trạng thái

### Đơn hàng

| Từ | Sang | Nguồn/điều kiện | Tồn/tiền |
|---|---|---|---|
| Mới | PENDING | UC-18 | Giữ tồn; giữ lượt mã |
| PENDING | CONFIRMED | N/Q; COD hoặc ONLINE PAID | Không đổi tồn |
| CONFIRMED | PREPARING | N/Q | Không đổi tồn |
| PREPARING | SHIPPING | UC-26 bàn giao có vận đơn | Tiêu thụ reservation; lượt mã USED |
| SHIPPING | DELIVERED | G xác thực hoặc N/Q thủ công | Không tự thu COD |
| PENDING | CANCELLED | Chủ đơn, N/Q hoặc hết hạn ONLINE chưa thu | Giải phóng giữ; hoàn tiền nếu có |
| CONFIRMED/PREPARING | CANCELLED | N/Q; chưa bàn giao | Giải phóng giữ; hoàn tiền nếu có |
| SHIPPING | DELIVERY_FAILED | Đã nhận lại hàng, shipment RETURNED | Cộng kho một lần; tiền thu cần hoàn |

CANCELLED/DELIVERED/DELIVERY_FAILED là terminal trong phạm vi này. Đổi trả sau giao thuộc mở rộng. Không sửa tay trạng thái để vượt điều kiện.

### Thanh toán đơn và attempt

- Đơn: UNPAID → PENDING khi tạo attempt ONLINE; PENDING → PAID khi verified success; PENDING → UNPAID khi FAILED/hết hạn mà chưa thu; UNPAID/PENDING → REFUND_PENDING nếu tiền success đến khi đơn đã hủy; PAID → REFUND_PENDING khi hủy/giao thất bại; REFUND_PENDING → REFUNDED khi hoàn đủ.
- COD: UNPAID → PAID chỉ qua UC-24. Hủy COD chưa thu giữ UNPAID.
- Attempt: CREATED → PENDING → SUCCEEDED/FAILED; CREATED/PENDING → EXPIRED khi quá hạn. Verified success muộn từ FAILED/EXPIRED vẫn ghi SUCCEEDED và xử lý ngoại lệ, vì tiền thật có thể đã thu; không suy luận thành công từ trang redirect.
- payment_exception ghi nghĩa vụ hoàn của khoản thu muộn/trùng. Nếu đơn hợp lệ đã PAID và thu dư thêm, vẫn PAID, khoản dư xử lý riêng; không cộng thu dư vào doanh thu hàng. REFUNDED là tiền đã thu cho đơn hủy đã hoàn hết, không phải mọi đơn đều phải đi qua trạng thái này.

### Vận chuyển

- CREATED → READY khi có mã vận đơn; READY → IN_TRANSIT khi bàn giao; IN_TRANSIT → DELIVERED hoặc FAILED; FAILED → IN_TRANSIT khi giao lại; FAILED → RETURNED khi hàng thực về.
- CREATED/READY → CANCELLED khi đơn hủy trước bàn giao; có job hủy vận đơn nếu đã tạo ngoài hệ thống.
- Callback không có sequence tin cậy dùng timestamp nhà cung cấp + trạng thái hiện tại, tra cứu khi mâu thuẫn; không coi thời gian nhận HTTP là thứ tự nghiệp vụ.

## 3. Luồng đăng ký, đăng nhập và khóa tài khoản — UC-01..05

```mermaid
flowchart TD
  A[Nhập email và mật khẩu] --> B{Giới hạn thử cho phép?}
  B -- Không --> C[429 và thời gian thử lại]
  B -- Có --> D{Mật khẩu đúng và tài khoản ACTIVE?}
  D -- Không --> E[Thông báo chung, không tạo phiên]
  D -- Có --> F[Đổi ID phiên, lưu user và auth_version]
  F --> G[Mỗi yêu cầu đọc lại quyền và trạng thái]
  G --> H{ACTIVE và auth_version khớp?}
  H -- Có --> I[Kiểm tra quyền và chủ dữ liệu]
  H -- Không --> J[Hủy phiên, yêu cầu đăng nhập]
  K[ADMIN khóa hoặc người dùng đổi mật khẩu] --> L[Tăng auth_version và ghi audit]
  L --> G
```

Đăng ký: validate → email unique → hash → CUSTOMER ACTIVE → đăng nhập UC-02; không tiếp nhận role từ khách.

## 4. Luồng sản phẩm, giá và công bố — UC-08..13

```mermaid
flowchart TD
  A[STAFF hoặc ADMIN tạo DRAFT] --> B[SKU inactive, chưa có giá]
  B --> C[Nhập ảnh, thông số, điều chỉnh tồn có lý do]
  C --> D[ADMIN thiết lập giá SKU]
  D --> E{Thông tin đủ và SKU có giá hợp lệ?}
  E -- Không --> F[Giữ DRAFT, trả lỗi theo trường]
  E -- Có --> G[ADMIN công bố ACTIVE và bật SKU]
  G --> H[Catalog và checkout được sử dụng]
  H --> I[ADMIN ẩn sản phẩm hoặc SKU]
  I --> J[Ngừng mua mới, giữ đơn cũ]
  S[STAFF gửi trường giá hoặc công bố] --> T[403, không ghi dữ liệu]
```

## 5. Luồng mua hàng — UC-16..26

```mermaid
flowchart TD
  A[Chọn SKU và thêm giỏ] --> B{Đăng nhập CUSTOMER?}
  B -- Không --> C[Đăng nhập và gộp giỏ]
  C --> D[Nhập nhận hàng, phương thức, mã giảm]
  B -- Có --> D
  D --> E[Server báo giá hàng, giảm, phí ship]
  E --> F[Khách xác nhận request_key]
  F --> G{Đã có key?}
  G -- Cùng nội dung --> H[Trả đơn cũ]
  G -- Khác nội dung --> I[Conflict]
  G -- Chưa --> J{Giá, tồn, mã, địa chỉ còn hợp lệ?}
  J -- Không --> K[Rollback hoặc báo giá lại, chưa tạo đơn]
  J -- Có --> L[Giao dịch giữ tồn và lượt mã, tạo PENDING]
  L --> M{COD hay ONLINE?}
  M -- COD --> N[N/Q xác nhận]
  M -- ONLINE --> O[Tạo attempt và chuyển sang cổng]
  O --> P{Verified success trước hết hạn?}
  P -- Có --> Q[PAID]
  Q --> N
  P -- Chưa --> R[Thử lại trong hạn hoặc chờ đối soát]
  R --> X{Hết hạn và chưa thu?}
  X -- Có --> Y[Hủy, giải phóng giữ tồn và lượt mã]
  X -- Không --> O
  N --> S[PREPARING, tạo vận đơn]
  S --> T[Bàn giao: SHIPPING, tiêu thụ tồn giữ]
  T --> U{Kết quả giao?}
  U -- Thành công --> V[DELIVERED]
  V --> W[COD đối soát riêng; ONLINE đã thu]
  U -- Thất bại --> Z[Chờ giao lại hoặc nhận hàng về]
  Z --> AA[RETURNED: cộng kho một lần, DELIVERY_FAILED]
```

## 6. Luồng hủy/hết hạn và callback muộn — UC-20,21,23,34

```mermaid
flowchart TD
  A[Yêu cầu hủy hoặc job hết hạn] --> B[Khóa đơn và kiểm tra trạng thái]
  B --> C{Nguồn và điều kiện hợp lệ?}
  C -- Không --> D[Từ chối, không đổi dữ liệu]
  C -- Có --> E[CANCELLED, giải phóng HELD một lần]
  E --> F{Đã thu tiền?}
  F -- Có --> G[REFUND_PENDING và ghi nghĩa vụ hoàn]
  F -- Không --> H[Giữ UNPAID, không giả hoàn tiền]
  I[Callback success tới sau hủy] --> J[Verified, ghi tiền thực thu]
  J --> G
  G --> K[ADMIN đối soát và hoàn qua kênh ngoài]
  K --> L[Nhập bằng chứng, reference unique]
  L --> M{Đã hoàn đủ?}
  M -- Có --> N[REFUNDED]
  M -- Không --> G
```

Job hết hạn và callback success phải khóa cùng đơn. Nếu success được commit trước job, job không hủy; nếu job hủy trước success, success không khôi phục hàng.

Sau PAID, deadline thanh toán không được dùng để giải phóng reservation: hàng giữ tới hủy hoặc bàn giao. Worker hết hạn chỉ chọn order ONLINE PENDING chưa thu, không quét expires_at của reservation một cách độc lập. Khi đơn hủy đã có shipment READY, lưu job hủy vận đơn ngoài hệ thống; nếu yêu cầu tạo vận đơn đang chạy trả kết quả sau hủy, ghi mã để hủy/đối soát, không chuyển đơn về trạng thái bán. Worker kiểm tra lại điều kiện trước gọi API; lỗi mạng không thể rollback thay đổi đã xảy ra ở nhà cung cấp nên dùng job bù và audit.

## 7. Sơ đồ trạng thái đơn

```mermaid
stateDiagram-v2
  [*] --> PENDING: tạo đơn và giữ hàng
  PENDING --> CONFIRMED: COD hoặc ONLINE đã thu
  CONFIRMED --> PREPARING: chuẩn bị
  PREPARING --> SHIPPING: bàn giao có vận đơn
  SHIPPING --> DELIVERED: giao thành công
  SHIPPING --> DELIVERY_FAILED: xác nhận hàng thực về
  PENDING --> CANCELLED: khách hoặc N/Q hoặc hết hạn
  CONFIRMED --> CANCELLED: N/Q trước bàn giao
  PREPARING --> CANCELLED: N/Q trước bàn giao
  DELIVERED --> [*]
  DELIVERY_FAILED --> [*]
  CANCELLED --> [*]
```

## 8. Sơ đồ trạng thái vận chuyển

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> READY: nhận mã vận đơn
  READY --> IN_TRANSIT: bàn giao
  IN_TRANSIT --> DELIVERED: giao thành công
  IN_TRANSIT --> FAILED: giao thất bại
  FAILED --> IN_TRANSIT: giao lại
  FAILED --> RETURNED: hàng thực về
  CREATED --> CANCELLED: hủy trước bàn giao
  READY --> CANCELLED: hủy trước bàn giao
  DELIVERED --> [*]
  RETURNED --> [*]
  CANCELLED --> [*]
```

## 9. Sơ đồ tuần tự đặt hàng và thanh toán

```mermaid
sequenceDiagram
  actor K as Khách hàng
  participant W as Electro Store
  participant D as CSDL
  participant J as Worker tích hợp
  participant T as Cổng thanh toán
  K->>W: Xác nhận báo giá và request_key
  W->>D: BEGIN, kiểm tra key, giá, tồn, mã
  alt Không hợp lệ
    W->>D: ROLLBACK
    W-->>K: Lỗi hoặc xác nhận báo giá mới
  else Hợp lệ
    W->>D: Lưu đơn, reservation, redemption, key
    W->>D: COMMIT
    W-->>K: Mã đơn
    K->>W: Thanh toán ONLINE
    W->>D: Lưu attempt và integration_job unique
    J->>D: Nhận job đã commit
    J->>T: Tạo yêu cầu cùng reference/request_key
    T-->>J: URL thanh toán hoặc kết quả tra cứu
    J->>D: Lưu URL/trạng thái attempt
    W-->>K: URL thanh toán
    K->>T: Thanh toán
    T->>W: Callback đã ký
    W->>D: BEGIN, event unique, khóa attempt và đơn
    W->>D: Ghi thu/ngoại lệ, trạng thái, COMMIT
    W-->>T: ACK
    K->>W: Quay lại, xem trạng thái server
    W-->>K: Đã thu hoặc đang xác minh
  end
```

## 10. Sơ đồ tuần tự giao hàng và COD

```mermaid
sequenceDiagram
  actor N as Nhân viên
  participant W as Electro Store
  participant D as CSDL
  participant G as Nhà vận chuyển
  actor Q as ADMIN
  N->>W: Tạo vận đơn cho PREPARING
  W->>D: Lưu shipment và job
  W->>G: Worker gửi request_key đã lưu
  G-->>W: Mã vận đơn
  W->>D: READY
  G->>W: Bàn giao / IN_TRANSIT đã xác thực
  W->>D: SHIPPING, giảm on_hand và reserved một lần
  G->>W: DELIVERED đã xác thực
  W->>D: Đơn DELIVERED, COD vẫn UNPAID
  Q->>W: Đối soát số tiền và chứng từ COD
  W->>D: Payment SUCCEEDED, PAID, audit
  W-->>Q: Xác nhận thu tiền
```

## 11. Luồng khuyến mãi, đánh giá và hỗ trợ

```mermaid
flowchart LR
  A[ADMIN cấu hình mã] --> B[Khách nhập mã ở báo giá]
  B --> C[Kiểm tra thời gian, phạm vi, minimum, lượt]
  C --> D[Đặt đơn giữ lượt HELD]
  D --> E[Bàn giao chuyển USED]
  D --> F[Hủy trước giao chuyển RELEASED]
  G[Chủ đơn DELIVERED] --> H[Đánh giá PENDING]
  H --> I[ADMIN duyệt]
  I --> J[APPROVED hiển thị]
  I --> K[HIDDEN hoặc REJECTED]
  J --> L[Khách sửa nội dung]
  L --> H
  M[Khách gửi ticket OPEN] --> N[Nhân viên nhận IN_PROGRESS]
  N --> O[Trả lời và RESOLVED]
  O --> P[CLOSED]
  P --> R[Mở lại trong 7 ngày]
  R --> N
```

## 12. Sơ đồ dữ liệu báo cáo

```mermaid
flowchart LR
  A[Đơn và snapshot] --> D[Doanh thu hàng tại recognition_at]
  B[Payment SUCCEEDED] --> E[Tiền thu theo occurred_at]
  C[Refund SUCCEEDED] --> F[Tiền hoàn theo occurred_at]
  E --> G[Net cash = thu trừ hoàn]
  F --> G
  H[Dòng đơn DELIVERED] --> I[Bán chạy theo số lượng đã giao]
  D --> J[Bộ lọc UTC từ ngày Asia/Saigon]
  G --> J
  I --> J
  J --> K[Màn hình và CSV cùng truy vấn]
```

Báo cáo hiển thị riêng doanh thu hàng, phí giao, giảm giá, tiền thu, tiền hoàn và khoản chờ hoàn; không cộng callback như một khoản thu mới. Trường hợp thu dư không tạo thêm doanh thu hàng.

## 13. Sơ đồ trạng thái thanh toán của đơn

```mermaid
stateDiagram-v2
  [*] --> UNPAID
  UNPAID --> PENDING: tạo attempt ONLINE
  PENDING --> UNPAID: thất bại hoặc hết hạn chưa thu
  PENDING --> PAID: verified success, đơn còn hợp lệ
  UNPAID --> PAID: ADMIN xác nhận COD
  PAID --> REFUND_PENDING: hủy hoặc hàng giao thất bại đã về
  PENDING --> REFUND_PENDING: success muộn sau hủy
  UNPAID --> REFUND_PENDING: success muộn sau hủy
  REFUND_PENDING --> REFUNDED: hoàn đủ có bằng chứng
  REFUNDED --> [*]
```

PAID không terminal: có thể cần hoàn khi hủy. Khoản thu dư sau PAID là payment_exception độc lập, không làm mất trạng thái khoản thu hợp lệ.
