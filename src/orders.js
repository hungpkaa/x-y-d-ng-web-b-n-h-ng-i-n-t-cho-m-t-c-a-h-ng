const { transaction } = require('./products');
const {actorUser,reject}=require('./accounts');
const transitions = { PENDING:['CONFIRMED','CANCELLED'], CONFIRMED:['PREPARING','CANCELLED'], PREPARING:['SHIPPING','CANCELLED'], SHIPPING:['DELIVERED'], DELIVERED:[], CANCELLED:[] };
transitions.DELIVERY_FAILED=[];
const labels = { PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',PREPARING:'Đang chuẩn bị',SHIPPING:'Đang giao',DELIVERED:'Đã giao',CANCELLED:'Đã hủy',DELIVERY_FAILED:'Giao thất bại, đã nhận lại hàng' };
const variantQuery=`SELECT v.*,p.name,p.category,p.brand,p.description,p.status AS product_status,(v.on_hand-v.reserved) AS stock FROM product_variants v JOIN products p ON p.id=v.product_id`;
function getVariant(db,id) { return db.prepare(`${variantQuery} WHERE v.id=?`).get(id); }
function createOrder(db,userId,cart,recipient,phone,address) {
  return transaction(db,()=>createOrderWork(db,userId,cart,recipient,phone,address));
}
function createOrderWork(db,userId,cart,recipient,phone,address,shippingFee=0,promotion={discount:0,code:''}) {
    const entries=Object.entries(cart);
    if(!entries.length||entries.length>100) throw new Error('Giỏ hàng không hợp lệ.');
    const items=entries.map(([id,quantity])=>{
      if(!Number.isSafeInteger(Number(id))||Number(id)<=0) throw new Error('SKU không hợp lệ.');
      const item=getVariant(db,Number(id));
      if(!item||item.product_status!=='ACTIVE'||!item.active||!item.price||!Number.isSafeInteger(quantity)||quantity<1||quantity>99||item.stock<quantity) throw new Error('SKU không còn bán hoặc không đủ hàng. Vui lòng kiểm tra giỏ hàng.');
      return {...item,quantity};
    });
    if(!Number.isSafeInteger(shippingFee)||shippingFee<0||shippingFee>1000000) throw new Error('Phí giao hàng không hợp lệ.');
    const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0),discount=promotion.discount,total=subtotal-discount+shippingFee;
    if(!Number.isSafeInteger(discount)||discount<0||discount>=subtotal) throw new Error('Mức giảm giá không hợp lệ.');
    const id=Number(db.prepare('INSERT INTO orders(user_id,recipient,phone,address,total,subtotal,shipping_fee,discount,promotion_code) VALUES(?,?,?,?,?,?,?,?,?)').run(userId,recipient,phone,address,total,subtotal,shippingFee,discount,promotion.code).lastInsertRowid);
    for(const item of items) {
      const held=db.prepare('UPDATE product_variants SET reserved=reserved+?,version=version+1 WHERE id=? AND on_hand-reserved>=?').run(item.quantity,item.id,item.quantity);
      if(held.changes!==1) throw new Error('SKU không còn đủ hàng.');
      const itemId=Number(db.prepare('INSERT INTO order_items(order_id,product_id,variant_id,name,price,quantity,sku_snapshot,configuration_snapshot) VALUES(?,?,?,?,?,?,?,?)').run(id,item.product_id,item.id,item.name,item.price,item.quantity,item.sku,[item.color,item.configuration].filter(Boolean).join(' · ')).lastInsertRowid);
      db.prepare("INSERT INTO inventory_reservations(order_item_id,variant_id,quantity,status) VALUES(?,?,?,'HELD')").run(itemId,item.id,item.quantity);
      db.prepare('INSERT INTO inventory_movements(variant_id,actor_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,0,?,?,?)').run(item.id,userId,item.quantity,`hold:${itemId}`,'Giữ hàng khi đặt đơn');
    }
    db.prepare('INSERT INTO order_history(order_id,actor_id,status) VALUES(?,?,?)').run(id,userId,'PENDING');
    return id;
}
function inventoryTransitionWork(db,id,status,actorId) {
  const redemption=db.prepare('SELECT * FROM promotion_redemptions WHERE order_id=?').get(id);
  if(redemption) {
    if(redemption.status!=='HELD') throw new Error('Lượt khuyến mãi không hợp lệ.');
    db.prepare('UPDATE promotion_redemptions SET status=? WHERE id=?').run(status==='CANCELLED'?'RELEASED':'USED',redemption.id);
  }
  const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id);
  for(const item of items) {
    const result=db.prepare("UPDATE inventory_reservations SET status=? WHERE order_item_id=? AND status='HELD'").run(status==='SHIPPING'?'CONSUMED':'RELEASED',item.id);
    if(result.changes!==1) throw new Error('Giữ hàng không hợp lệ. Chưa cập nhật trạng thái.');
    const delta=status==='SHIPPING'?-item.quantity:0;
    db.prepare('UPDATE product_variants SET on_hand=on_hand+?,reserved=reserved-?,version=version+1 WHERE id=?').run(delta,item.quantity,item.variant_id);
    db.prepare('INSERT INTO inventory_movements(variant_id,actor_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,?,?,?,?)').run(item.variant_id,actorId,delta,-item.quantity,`${status.toLowerCase()}:${item.id}`,status==='SHIPPING'?'Bàn giao hàng':'Giải phóng hàng khi hủy');
  }
}
function transitionOrder(db,id,status,actorId,input={}) {
  return transaction(db,()=>{
    const actor=actorUser(db,typeof actorId==='object'?actorId:{id:actorId});
    actorId=actor.id;
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if(!order||(actor.role==='CUSTOMER'&&order.user_id!==actor.id)) reject(404,'Không tìm thấy đơn.');
    const note=typeof input.reason==='string'?input.reason.trim():'';
    if(note.length<3||note.length>300) reject(400,'Nhập lý do/ghi chú xử lý (3–300 ký tự).');
    if(actor.role==='CUSTOMER'&&status!=='CANCELLED') reject(403,'Khách hàng chỉ được hủy đơn của mình đang chờ xác nhận.');
    if(status==='CANCELLED'&&order.status==='CANCELLED') return {status:200,message:'Đơn đã được hủy trước đó.'};
    if(Number(input.version)!==order.version) reject(409,'Đơn đã thay đổi. Hãy tải lại trang.');
    if(actor.role==='CUSTOMER'&&order.status!=='PENDING') reject(409,'Chỉ được hủy đơn đang chờ xác nhận.');
    if(!transitions[order.status]?.includes(status)) reject(409,'Không được chuyển sang trạng thái này.');
    if(['SHIPPING','DELIVERED'].includes(status)&&require('./shipments').enabled(db)) reject(409,'Cập nhật bàn giao/kết quả tại mục vận chuyển, kèm mã vận đơn và bằng chứng.');
    if(status==='CONFIRMED'&&order.payment_method!=='COD'&&order.payment_status!=='PAID') reject(409,'Đơn trực tuyến phải được thanh toán trước khi xác nhận.');
    if(status==='CANCELLED'||status==='SHIPPING') inventoryTransitionWork(db,id,status,actorId);
    db.prepare("UPDATE orders SET status=?,version=version+1,payment_status=CASE WHEN ?='CANCELLED' AND payment_status='PAID' THEN 'REFUND_PENDING' WHEN ?='CANCELLED' THEN 'UNPAID' ELSE payment_status END WHERE id=?").run(status,status,status,id);
    if(status==='CANCELLED') db.prepare("UPDATE payments SET status='EXPIRED' WHERE order_id=? AND status='PENDING'").run(id);
    if(status==='CANCELLED') require('./shipments').cancelWork(db,id,actorId,note);
    db.prepare('INSERT INTO order_history(order_id,actor_id,status,previous_status,note) VALUES(?,?,?,?,?)').run(id,actorId,status,order.status,note);
    if(status==='DELIVERED') require('./payments').recognizeWork(db,id);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'ORDER_STATUS','ORDER',?,?,?)").run(actorId,id,JSON.stringify({status:order.status,version:order.version}),JSON.stringify({status,version:order.version+1,reason:note}));
    return {status:200,message:status==='CANCELLED'?'Đã hủy đơn và giải phóng hàng đã giữ.':'Đã cập nhật trạng thái.'};
  });
}
function recordCodReceipt(db,id,actor,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if(!order) reject(404,'Không tìm thấy đơn.');
    const reference=typeof input.reference==='string'?input.reference.trim():'',note=typeof input.note==='string'?input.note.trim():'',amount=Number(input.amount);
    if(reference.length<3||reference.length>100||note.length<3||note.length>300||typeof input.amount!=='string'||!/^\d+$/.test(input.amount)||!Number.isSafeInteger(amount)||amount!==order.total) reject(400,'Nhập số tiền đúng tổng đơn, mã chứng từ (3–100 ký tự) và ghi chú (3–300 ký tự).');
    const receipt=db.prepare('SELECT * FROM cod_receipts WHERE order_id=?').get(id);
    if(receipt) {
      if(receipt.reference!==reference||receipt.amount!==amount||receipt.note!==note) reject(409,'Đơn đã có chứng từ thu COD khác.');
      return {status:200,message:'Khoản thu đã được ghi nhận trước đó.'};
    }
    if(Number(input.version)!==order.version) reject(409,'Đơn đã thay đổi. Hãy tải lại trang.');
    if(order.payment_method!=='COD'||order.status!=='DELIVERED'||order.payment_status!=='UNPAID') reject(409,'Chỉ ghi nhận COD cho đơn đã giao và chưa ghi nhận thu tiền.');
    if(db.prepare('SELECT id FROM cod_receipts WHERE reference=?').get(reference)) reject(409,'Mã chứng từ đã dùng cho đơn khác.');
    db.prepare('INSERT INTO cod_receipts(order_id,actor_id,amount,reference,note) VALUES(?,?,?,?,?)').run(id,admin.id,amount,reference,note);
    db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status,occurred_at,evidence_ref) VALUES(?,'COD',?,?,'SUCCEEDED',CURRENT_TIMESTAMP,?)").run(id,'COD-'+reference,amount,reference);
    db.prepare("UPDATE orders SET payment_status='PAID',version=version+1 WHERE id=?").run(id);
    require('./payments').recognizeWork(db,id);
    db.prepare('INSERT INTO order_history(order_id,actor_id,status,previous_status,note) VALUES(?,?,?,?,?)').run(id,admin.id,order.status,order.status,'Đã đối soát và ghi nhận thu COD.');
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'COD_RECEIPT','ORDER',?,?,?)").run(admin.id,id,JSON.stringify({payment_status:'UNPAID'}),JSON.stringify({payment_status:'PAID',amount,reference}));
    return {status:200,message:'Đã ghi nhận tiền COD thực thu.'};
  });
}
module.exports={inventoryTransitionWork,createOrderWork,createOrder,transitionOrder,recordCodReceipt,transitions,labels,getVariant};
