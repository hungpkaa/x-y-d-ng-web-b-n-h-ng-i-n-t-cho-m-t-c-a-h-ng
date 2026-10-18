const { randomBytes,createHash }=require('node:crypto');
const { getVariant,createOrderWork }=require('./orders');
const { transaction }=require('./products');
const {shippingPolicy}=require('./shipping');
const {actorUser}=require('./accounts');
const {normalizeCode,promotionQuote}=require('./promotions');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function quote(db,cart) {
  const entries=Object.entries(cart).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(!entries.length||entries.length>100) throw new Error('Giỏ hàng không hợp lệ.');
  return entries.map(([id,quantity])=>{
    const item=getVariant(db,Number(id));
    if(!Number.isSafeInteger(Number(id))||!item||!item.active||item.product_status!=='ACTIVE'||!item.price||!Number.isSafeInteger(quantity)||quantity<1||quantity>99||item.stock<quantity) throw new Error('SKU không còn bán hoặc không đủ hàng. Vui lòng kiểm tra giỏ hàng.');
    return [Number(id),quantity,item.price];
  });
}
function issueCheckout(db,userId,cart,code='',method='COD') {
  actorUser(db,{id:userId},['CUSTOMER']);
  const snapshot=quote(db,cart),token=randomBytes(24).toString('hex');
  const promotion=promotionQuote(db,userId,snapshot,code);
  const fee=shippingPolicy(db).fee;
  if(!['COD','ONLINE'].includes(method)) throw new Error('Phương thức thanh toán không hợp lệ.');
  if(method==='ONLINE'&&snapshot.reduce((sum,[,q,price])=>sum+q*price,0)-promotion.discount+fee>9999999999) throw new Error('Tổng tiền vượt giới hạn VNPay sandbox.');
  db.prepare('DELETE FROM checkout_requests WHERE order_id IS NULL AND expires_at<=?').run(Date.now());
  db.prepare('INSERT INTO checkout_requests(user_id,request_key,quote_json,expires_at,shipping_fee,promotion_id,promotion_code,discount,payment_method,shipping_quote_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(userId,token,JSON.stringify(snapshot),Date.now()+900000,fee,promotion.id,promotion.code,promotion.discount,method,null);
  return token;
}
function submitCheckout(db,userId,token,cart,recipient,phone,address,rawCode='',method='COD',ip='127.0.0.1') {
  return transaction(db,()=>submitCheckoutWork(db,userId,token,cart,recipient,phone,address,rawCode,method,ip));
}
function submitCheckoutWork(db,userId,token,cart,recipient,phone,address,rawCode='',method='COD',ip='127.0.0.1') {
    actorUser(db,{id:userId},['CUSTOMER']);
    const request=db.prepare('SELECT * FROM checkout_requests WHERE user_id=? AND request_key=?').get(userId,String(token||''));
    if(!request) throw new Error('Yêu cầu đặt hàng không hợp lệ. Hãy mở lại trang thanh toán.');
    const code=normalizeCode(rawCode);
    if(!['COD','ONLINE'].includes(method)||method!==request.payment_method) throw new Error('Phương thức đã thay đổi. Hãy xác nhận báo giá mới.');
    const hash=digest(code?[recipient,phone,address,method,code]:[recipient,phone,address,method]);
    if(request.order_id!==null) {
      if(hash!==request.payload_hash) throw new Error('Thông tin giao hàng đã thay đổi. Hãy tạo yêu cầu thanh toán mới.');
      return {id:request.order_id,replayed:true};
    }
    if(request.expires_at<=Date.now()) throw new Error('Yêu cầu đã hết hạn. Hãy mở lại trang thanh toán.');
    if(code!==request.promotion_code) throw new Error('Mã giảm giá đã thay đổi. Hãy mở lại trang thanh toán để xác nhận.');
    if(request.shipping_quote_json) throw new Error('Chính sách giao hàng đã thay đổi. Hãy mở lại trang thanh toán để xác nhận phí cố định.');
    if(shippingPolicy(db).fee!==request.shipping_fee) throw new Error('Phí giao hàng đã thay đổi. Hãy mở lại trang thanh toán để xác nhận.');
    if(JSON.stringify(quote(db,cart))!==request.quote_json) throw new Error('Giỏ hàng hoặc giá đã thay đổi. Hãy mở lại trang thanh toán để xác nhận.');
    const promotion=promotionQuote(db,userId,JSON.parse(request.quote_json),code);
    if(promotion.id!==request.promotion_id||promotion.discount!==request.discount) throw new Error('Khuyến mãi đã thay đổi. Hãy mở lại trang thanh toán để xác nhận.');
    const id=createOrderWork(db,userId,cart,recipient,phone,address,request.shipping_fee,promotion);
    db.prepare('UPDATE orders SET shipping_quote_json=? WHERE id=?').run(request.shipping_quote_json,id);
    if(method==='ONLINE') {
      db.prepare("UPDATE orders SET payment_method='ONLINE' WHERE id=?").run(id);
      require('./payments').createOnlineWork(db,id,ip);
    }
    if(promotion.id!==null) db.prepare("INSERT INTO promotion_redemptions(promotion_id,user_id,order_id,amount,status) VALUES(?,?,?,?,'HELD')").run(promotion.id,userId,id,promotion.discount);
    db.prepare('UPDATE checkout_requests SET order_id=?,payload_hash=? WHERE id=?').run(id,hash,request.id);
    return {id,replayed:false};
}
function submitAccountCheckout(db,actor,token,recipient,phone,address,rawCode='',method='COD',ip='127.0.0.1') {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    const carts=require('./account-cart'),cart=carts.resultForUser(db,user.id);
    const request=db.prepare('SELECT order_id FROM checkout_requests WHERE user_id=? AND request_key=?').get(user.id,String(token||''));
    if(!request?.order_id&&!cart.canCheckout) throw new Error('Giỏ có sản phẩm không hợp lệ hoặc cần điều chỉnh. Hãy kiểm tra giỏ.');
    const result=submitCheckoutWork(db,user.id,token,cart.quantities,recipient,phone,address,rawCode,method,ip);
    if(!result.replayed) carts.consumeCartWork(db,user.id,cart.quantities);
    return result;
  });
}
module.exports={issueCheckout,submitCheckout,submitAccountCheckout};
