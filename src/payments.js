const {createHmac,createHash,randomBytes,timingSafeEqual}=require('node:crypto');
const {isIP}=require('node:net');
const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {inventoryTransitionWork}=require('./orders');
const {pagination}=require('./product-list');
const sandboxUrl='https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
function vnpayConfig(env=process.env) {
  if(!env.VNPAY_TMN_CODE||!env.VNPAY_HASH_SECRET||!env.APP_URL) return null;
  const base=new URL(env.APP_URL);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||env.NODE_ENV==='production'&&base.protocol!=='https:') throw new Error('APP_URL không hợp lệ cho VNPay.');
  return {tmnCode:env.VNPAY_TMN_CODE,secret:env.VNPAY_HASH_SECRET,returnUrl:base.origin+'/payments/vnpay/return',paymentUrl:sandboxUrl};
}
const vnpDate=time=>new Date(time+7*3600000).toISOString().slice(0,19).replace(/[-T:]/g,'');
function providerTime(value) {
  if(typeof value!=='string'||!/^\d{14}$/.test(value)) return null;
  const iso=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T'+value.slice(8,10)+':'+value.slice(10,12)+':'+value.slice(12,14)+'+07:00';
  const time=Date.parse(iso);
  return Number.isFinite(time)&&vnpDate(time)===value?new Date(time).toISOString().slice(0,19).replace('T',' '):null;
}
function canonical(params) {
  const encode=value=>encodeURIComponent(value).replace(/%20/g,'+');
  return Object.keys(params).filter(key=>key!=='vnp_SecureHash'&&key!=='vnp_SecureHashType').sort().map(key=>encode(key)+'='+encode(params[key])).join('&');
}
const signature=(params,secret)=>createHmac('sha512',secret).update(canonical(params),'utf8').digest('hex');
function verifyCallback(query,config) {
  if(!config||Object.keys(query).some(key=>!key.startsWith('vnp_')||typeof query[key]!=='string'||query[key].length>1024)||typeof query.vnp_SecureHash!=='string'||! /^[a-fA-F0-9]{128}$/.test(query.vnp_SecureHash)) return false;
  const expected=Buffer.from(signature(query,config.secret),'hex'),actual=Buffer.from(query.vnp_SecureHash,'hex');
  return timingSafeEqual(expected,actual)&&query.vnp_TmnCode===config.tmnCode;
}
function paymentUrl(payment,config) {
  const params={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:config.tmnCode,vnp_Amount:String(payment.amount*100),vnp_CurrCode:'VND',vnp_TxnRef:payment.reference,vnp_OrderInfo:'Thanh toan don hang '+payment.order_id,vnp_OrderType:'other',vnp_Locale:'vn',vnp_ReturnUrl:config.returnUrl,vnp_IpAddr:payment.ip_address,vnp_CreateDate:vnpDate(Date.parse(payment.created_at.replace(' ','T')+'Z')),vnp_ExpireDate:vnpDate(payment.expires_at)};
  return config.paymentUrl+'?'+canonical(params)+'&vnp_SecureHash='+signature(params,config.secret);
}
function createOnlineWork(db,id,ip='127.0.0.1',now=Date.now()) {
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  const existing=db.prepare("SELECT * FROM payments WHERE order_id=? AND status='PENDING'").get(id);
  if(existing) return existing;
  if(order.total>9999999999) reject(400,'Tổng tiền vượt giới hạn VNPay sandbox.');
  if(order.payment_deadline===null) db.prepare('UPDATE orders SET payment_deadline=? WHERE id=?').run(now+15*60000,id);
  const reference=randomBytes(16).toString('hex');
  db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status,expires_at,ip_address) VALUES(?,'VNPAY',?,?,'PENDING',?,?)").run(id,reference,order.total,order.payment_deadline??now+15*60000,isIP(ip)?ip:'127.0.0.1');
  db.prepare("UPDATE orders SET payment_status='PENDING' WHERE id=?").run(id);
  return db.prepare('SELECT * FROM payments WHERE reference=?').get(reference);
}
function recognizeWork(db,id) {
  db.prepare(`UPDATE orders SET recognition_at=MAX((SELECT MIN(created_at) FROM order_history WHERE order_id=? AND status='DELIVERED'),(SELECT MIN(occurred_at) FROM payments WHERE order_id=? AND status='SUCCEEDED')) WHERE id=? AND status='DELIVERED' AND payment_status='PAID' AND recognition_at IS NULL`).run(id,id,id);
}
function cancelExpiredWork(db,order,now) {
  if(order.status!=='PENDING'||!['UNPAID','PENDING'].includes(order.payment_status)||order.payment_deadline===null||order.payment_deadline>now) return;
  inventoryTransitionWork(db,order.id,'CANCELLED',null);
  db.prepare("UPDATE orders SET status='CANCELLED',payment_status='UNPAID',version=version+1 WHERE id=?").run(order.id);
  db.prepare("INSERT INTO order_history(order_id,status,previous_status,note,source) VALUES(?,'CANCELLED','PENDING','Hết thời hạn thanh toán trực tuyến','SYSTEM')").run(order.id);
  db.prepare("INSERT INTO audit_logs(action,entity_type,entity_id,after_json) VALUES('PAYMENT_EXPIRED','ORDER',?,?)").run(order.id,JSON.stringify({status:'CANCELLED'}));
}
function expirePayments(db,now=Date.now()) {
  return transaction(db,()=>{
    const orders=db.prepare("SELECT * FROM orders WHERE payment_method='ONLINE' AND status='PENDING' AND payment_status IN ('UNPAID','PENDING') AND payment_deadline<=? ORDER BY id LIMIT 100").all(now);
    for(const order of orders) {
      cancelExpiredWork(db,order,now);
      db.prepare("UPDATE payments SET status='EXPIRED' WHERE order_id=? AND status='PENDING'").run(order.id);
    }
    return orders.length;
  });
}
function startPayment(db,actor,id,ip,config,now=Date.now()) {
  if(!config) return {status:503,message:'Thanh toán trực tuyến tạm thời chưa khả dụng.'};
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']),order=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(id,user.id);
    if(!order) reject(404,'Không tìm thấy đơn hàng.');
    if(order.payment_method!=='ONLINE'||order.status!=='PENDING'||!['UNPAID','PENDING'].includes(order.payment_status)||order.payment_deadline<=now) reject(409,'Đơn không còn ở trạng thái chờ thanh toán.');
    const payment=createOnlineWork(db,id,ip,now);
    return {status:200,url:paymentUrl(payment,config)};
  });
}
function processIpn(db,query,config,now=Date.now()) {
  const ack=(RspCode,Message)=>({RspCode,Message});
  if(!verifyCallback(query,config)) return ack('97','Invalid signature');
  return transaction(db,()=>{
    const payment=db.prepare("SELECT * FROM payments WHERE reference=? AND provider='VNPAY'").get(query.vnp_TxnRef??'');
    if(!payment) return ack('01','Order not found');
    if(query.vnp_Amount!==String(payment.amount*100)||query.vnp_CurrCode!==undefined&&query.vnp_CurrCode!=='VND') return ack('04','Invalid amount or currency');
    if(!/^[0-9]{2}$/.test(query.vnp_ResponseCode??'')||!/^[0-9]{2}$/.test(query.vnp_TransactionStatus??'')) return ack('99','Invalid result');
    const eventKey=createHash('sha256').update(canonical(query)).digest('hex');
    if(db.prepare('SELECT id FROM payment_events WHERE event_key=?').get(eventKey)||payment.status==='SUCCEEDED') return ack('02','Order already confirmed');
    const success=query.vnp_ResponseCode==='00'&&query.vnp_TransactionStatus==='00';
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(payment.order_id);
    let outcome='FAILED';
    if(success) {
      const occurred=providerTime(query.vnp_PayDate);
      if(!occurred||! /^[1-9]\d{0,30}$/.test(query.vnp_TransactionNo??'')||Date.parse(occurred.replace(' ','T')+'Z')>now+5*60000) return ack('99','Invalid transaction evidence');
      const reused=db.prepare("SELECT id FROM payments WHERE provider='VNPAY' AND provider_transaction_id=?").get(query.vnp_TransactionNo);
      if(reused) return ack('99','Transaction reference conflict');
      cancelExpiredWork(db,order,now);
      db.prepare("UPDATE payments SET status='SUCCEEDED',provider_transaction_id=?,occurred_at=? WHERE id=?").run(query.vnp_TransactionNo,occurred,payment.id);
      const current=db.prepare('SELECT * FROM orders WHERE id=?').get(order.id);
      const other=db.prepare("SELECT id FROM payments WHERE order_id=? AND status='SUCCEEDED' AND id<>?").get(order.id,payment.id);
      const needsRefund=['CANCELLED','DELIVERY_FAILED'].includes(current.status);
      outcome=needsRefund?'REFUND_PENDING':other?'DUPLICATE_CAPTURE':'SUCCEEDED';
      db.prepare("UPDATE orders SET payment_status=?,version=version+1 WHERE id=?").run(needsRefund?'REFUND_PENDING':current.payment_status==='REFUND_PENDING'?'REFUND_PENDING':'PAID',order.id);
      db.prepare("UPDATE payments SET status='EXPIRED' WHERE order_id=? AND id<>? AND status='PENDING'").run(order.id,payment.id);
      recognizeWork(db,order.id);
    } else if(payment.status==='PENDING') {
      db.prepare("UPDATE payments SET status='FAILED' WHERE id=?").run(payment.id);
      if(order.status==='PENDING'&&order.payment_status==='PENDING') db.prepare("UPDATE orders SET payment_status='UNPAID',version=version+1 WHERE id=?").run(order.id);
    }
    db.prepare('INSERT INTO payment_events(payment_id,event_key,response_code,transaction_status,outcome) VALUES(?,?,?,?,?)').run(payment.id,eventKey,query.vnp_ResponseCode,query.vnp_TransactionStatus,outcome);
    const currentStatus=db.prepare('SELECT status FROM orders WHERE id=?').get(order.id).status;
    db.prepare("INSERT INTO order_history(order_id,status,previous_status,note,source) VALUES(?,?,?,?,'PROVIDER')").run(order.id,currentStatus,currentStatus,success?(outcome==='REFUND_PENDING'?'Đã thu tiền sau khi hủy đơn; cần hoàn tiền.':'Cổng thanh toán xác nhận đã thu tiền.'):'Cổng thanh toán thông báo giao dịch chưa thành công.');
    db.prepare("INSERT INTO audit_logs(action,entity_type,entity_id,after_json) VALUES('VNPAY_IPN','ORDER',?,?)").run(order.id,JSON.stringify({payment_id:payment.id,outcome}));
    return ack('00','Confirm success');
  });
}
function refundDue(db,orderId) {
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if(!order) return [];
  const payments=db.prepare("SELECT p.*,(SELECT id FROM refunds WHERE payment_id=p.id) refund_id FROM payments p WHERE p.order_id=? AND p.status='SUCCEEDED' ORDER BY p.occurred_at,p.id").all(orderId);
  const cancelled=['CANCELLED','DELIVERY_FAILED'].includes(order.status);
  // For a valid order keep one successful capture; refund every additional capture.
  return payments.filter((payment,index)=>!payment.refund_id&&(cancelled||index>0));
}
function recordRefund(db,actor,paymentId,input,now=Date.now()) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),payment=db.prepare('SELECT * FROM payments WHERE id=?').get(paymentId);
    if(!payment) reject(404,'Không tìm thấy khoản thu.');
    const reference=typeof input.reference==='string'?input.reference.trim():'',evidence=typeof input.evidence_ref==='string'?input.evidence_ref.trim():'',note=typeof input.note==='string'?input.note.trim():'';
    const local=typeof input.occurred_at==='string'?input.occurred_at:'',compact=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)?local.replace(/[-T:]/g,''):'';
    const amount=Number(input.amount),occurred=providerTime(compact.length===12?compact+'00':compact);
    if(typeof input.amount!=='string'||!/^\d+$/.test(input.amount)||!Number.isSafeInteger(amount)||amount!==payment.amount||reference.length<3||reference.length>100||evidence.length<3||evidence.length>200||note.length<3||note.length>300||!occurred||Date.parse(occurred.replace(' ','T')+'Z')>now+60000||payment.occurred_at&&occurred<payment.occurred_at) reject(400,'Nhập đủ số tiền, mã đối soát, bằng chứng, ghi chú và thời điểm hoàn hợp lệ (giờ Việt Nam).');
    const old=db.prepare('SELECT * FROM refunds WHERE payment_id=?').get(paymentId);
    if(old) {
      if(old.reference!==reference||old.amount!==amount||old.evidence_ref!==evidence||old.note!==note||old.occurred_at!==occurred) reject(409,'Khoản thu đã có chứng từ hoàn khác.');
      return {status:200,message:'Khoản hoàn đã được ghi nhận trước đó.'};
    }
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(payment.order_id);
    if(Number(input.version)!==order.version) reject(409,'Đơn đã thay đổi. Hãy tải lại.');
    if(!refundDue(db,order.id).some(row=>row.id===paymentId)) reject(409,'Khoản thu chưa có nghĩa vụ hoàn được xác định.');
    if(db.prepare('SELECT id FROM refunds WHERE reference=?').get(reference)) reject(409,'Mã hoàn đã dùng cho khoản thu khác.');
    db.prepare('INSERT INTO refunds(payment_id,order_id,actor_id,amount,reference,evidence_ref,note,occurred_at) VALUES(?,?,?,?,?,?,?,?)').run(paymentId,order.id,admin.id,amount,reference,evidence,note,occurred);
    const remaining=refundDue(db,order.id);
    const status=['CANCELLED','DELIVERY_FAILED'].includes(order.status)?(remaining.length?'REFUND_PENDING':'REFUNDED'):order.payment_status;
    db.prepare('UPDATE orders SET payment_status=?,version=version+1 WHERE id=?').run(status,order.id);
    auditRefund(db,admin,order.id,paymentId,amount);
    return {status:200,message:'Đã ghi nhận tiền đã hoàn. Thông tin đơn và tồn kho giữ nguyên.'};
  });
}
function auditRefund(db,actor,orderId,paymentId,amount) {
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'REFUND_RECORD','ORDER',?,?)").run(actor.id,orderId,JSON.stringify({payment_id:paymentId,amount}));
}
function listRefunds(db,query={}) {
  const page=query.page??'1';
  if(typeof page!=='string'||!/^\d+$/.test(page)||Number(page)<1||!Number.isSafeInteger(Number(page))) return {status:400,message:'Trang không hợp lệ.'};
  const where="FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.status='SUCCEEDED' AND NOT EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=p.id) AND (o.status IN ('CANCELLED','DELIVERY_FAILED') OR EXISTS(SELECT 1 FROM payments first WHERE first.order_id=p.order_id AND first.status='SUCCEEDED' AND (first.occurred_at<p.occurred_at OR (first.occurred_at=p.occurred_at AND first.id<p.id))))";
  const total=db.prepare('SELECT COUNT(*) n '+where).get().n,paging=pagination(total,page,20,'/admin/refunds');
  const rows=db.prepare('SELECT p.*,o.version,o.status order_status '+where+' ORDER BY p.id DESC LIMIT ? OFFSET ?').all(paging.size,paging.offset);
  return {status:200,rows,paging};
}
module.exports={vnpayConfig,vnpDate,providerTime,canonical,signature,verifyCallback,paymentUrl,createOnlineWork,recognizeWork,expirePayments,startPayment,processIpn,refundDue,recordRefund,listRefunds};
