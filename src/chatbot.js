const {labels}=require('./orders');
const normalize=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
function reply(db,user,message) {
  if(typeof message!=='string'||!message.trim()||message.length>500) return {status:400,message:'Nhập câu hỏi từ 1 đến 500 ký tự.'};
  const question=normalize(message.trim());
  const answer=(text,links=[])=>({status:200,text,links});
  const support={label:'Gửi yêu cầu cho nhân viên',url:'/support/new'};
  if(!/huy don/.test(question)&&/don hang|don cua|ma don|trang thai don|don\s*#?\d+/.test(question)) {
    if(!user||user.role!=='CUSTOMER'||user.status!=='ACTIVE') return answer('Đăng nhập tài khoản khách hàng để xem đơn của bạn.',[{label:'Đăng nhập',url:'/login'}]);
    const match=question.match(/(?:#|don\s*(?:hang\s*)?(?:so\s*|ma\s*)?)(\d+)\b/);
    const order=match?db.prepare('SELECT id,status FROM orders WHERE id=? AND user_id=?').get(Number(match[1]),user.id):db.prepare('SELECT id,status FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 1').get(user.id);
    return order?answer('Đơn #'+order.id+': '+(labels[order.status]||order.status)+'. Xem chi tiết để biết thanh toán và vận chuyển.',[{label:'Xem đơn #'+order.id,url:'/orders/'+order.id}]):answer('Không tìm thấy đơn của bạn theo yêu cầu này.',[{label:'Đơn của tôi',url:'/orders'},support]);
  }
  if(/huy don/.test(question)) return answer('Bạn có thể hủy đơn của mình khi còn chờ xác nhận (PENDING), tại trang chi tiết đơn. Nếu đơn đã sang bước khác, hãy gửi yêu cầu cho nhân viên.',[{label:'Đơn của tôi',url:'/orders'},support]);
  if(/thanh toan|vnpay|\bcod\b/.test(question)) return answer('Website hỗ trợ COD và VNPay khi đã cấu hình. Với thanh toán online chưa hoàn tất, mở chi tiết đơn để xem trạng thái và thử lại nếu đơn còn đủ điều kiện. Không gửi mật khẩu hay mã OTP qua chat.',[{label:'Đơn của tôi',url:'/orders'},support]);
  if(/doi tra|bao hanh|hoan tien/.test(question)) return answer('Hãy gửi mã đơn và mô tả vấn đề cho nhân viên để xác minh điều kiện đổi trả, bảo hành hoặc hoàn tiền. Tôi chưa có chính sách được công bố để xác nhận thời hạn hay mức phí.',[support]);
  if(/giao hang|phi ship|van chuyen|bao lau/.test(question)) return answer('Phí giao hàng và tổng tiền được hiển thị ở báo giá checkout trước khi xác nhận. Tiến trình giao và mã vận đơn nằm trong chi tiết đơn; thời gian giao cần nhân viên xác nhận.',[{label:'Giỏ hàng',url:'/cart'},{label:'Đơn của tôi',url:'/orders'},support]);
  if(/nhan vien|ho tro|khieu nai|lien he/.test(question)) return answer('Bạn có thể tạo phiếu hỗ trợ và xem phản hồi sau khi đăng nhập tài khoản khách hàng.',[support,{label:'Các yêu cầu của tôi',url:'/support'}]);
  if(/mat khau|dang nhap|dang ky/.test(question)) return answer('Bạn có thể đăng ký tài khoản, đăng nhập hoặc dùng chức năng quên mật khẩu. Sau khi đăng nhập, mục Hồ sơ cho phép đổi mật khẩu.',[{label:'Đăng ký',url:'/register'},{label:'Đăng nhập',url:'/login'},{label:'Quên mật khẩu',url:'/forgot-password'}]);
  if(/mua hang|dat hang|gio hang/.test(question)) return answer('Chọn sản phẩm và cấu hình SKU, thêm vào giỏ, đăng nhập khách hàng, kiểm tra báo giá rồi xác nhận đặt hàng. Giá và tồn được kiểm tra lại khi tạo đơn.',[{label:'Xem sản phẩm',url:'/'},{label:'Giỏ hàng',url:'/cart'}]);
  const budget=question.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|tr\b)/);
  const max=budget?Math.round(Number(budget[1].replace(',','.'))*1000000):null;
  const tokens=question.replace(/[?.,!#]/g,' ').split(/\s+/).filter(token=>token.length>1&&!['tim','mua','toi','muon','san','pham','duoi','tam','trieu','co','nao','gia','cho','voi','ngan','sach','tu','van','goi','y','tr','con','hang'].includes(token)&&!/^\d+$/.test(token));
  const rows=db.prepare("SELECT p.id,p.name,p.brand,p.category,MIN(v.price) price FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.status='ACTIVE' AND v.active=1 AND v.price>0 AND v.on_hand-v.reserved>0 GROUP BY p.id,p.name,p.brand,p.category ORDER BY MIN(v.price),p.id LIMIT 500").all();
  const products=rows.filter(row=>(max===null||row.price<=max)&&(!tokens.length||tokens.some(token=>normalize(row.name+' '+row.brand+' '+row.category).includes(token)))).slice(0,5);
  if(products.length&&(tokens.length||max)) return answer('Các sản phẩm đang bán và còn hàng phù hợp với từ khóa/ngân sách của bạn (giá từ SKU còn hàng):',products.map(row=>({label:row.name+' · từ '+row.price.toLocaleString('vi-VN')+' ₫',url:'/products/'+row.id})));
  if(/san pham|dien thoai|laptop|tai nghe|tablet|iphone|samsung|gia|trieu/.test(question)||max) return answer('Chưa tìm thấy sản phẩm còn hàng phù hợp. Bạn có thể đổi từ khóa hoặc dùng bộ lọc gợi ý theo danh mục, thương hiệu và ngân sách.',[{label:'Lọc sản phẩm gợi ý',url:'/recommendations'},support]);
  return answer('Tôi là trợ lý tự động theo quy tắc, hỗ trợ tìm sản phẩm và hướng dẫn mua hàng. Bạn có thể hỏi “laptop dưới 25 triệu”, “đơn hàng của tôi” hoặc “cách thanh toán”. Với câu hỏi cần nhân viên xác minh, hãy gửi phiếu hỗ trợ.',[{label:'Xem sản phẩm',url:'/'},support]);
}
module.exports={reply};
