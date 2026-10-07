const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {transitionOrder}=require('../src/orders');
const pay=require('../src/payments');
const {salesReport}=require('../src/reporting');
const config={tmnCode:'TESTCODE',secret:'test-only-signing-key',returnUrl:'http://localhost/payments/vnpay/return',paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'};
function fixture(file=':memory:') {
  const db=openDatabase(file);
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com','hash','CUSTOMER'),(2,'Other','two@test.com','hash','CUSTOMER'),(3,'Admin','admin@test.com','hash','ADMIN'),(4,'Staff','staff@test.com','hash','STAFF'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,10,1)");
  return db;
}
function online(db,user=1) {
  const key=issueCheckout(db,user,{'1':1},'','ONLINE'),result=submitCheckout(db,user,key,{'1':1},'Customer','0901234567','123 Example street','','ONLINE');
  return {key,id:result.id,payment:db.prepare('SELECT * FROM payments WHERE order_id=?').get(result.id)};
}
function callback(payment,options={}) {
  const params={vnp_TmnCode:config.tmnCode,vnp_TxnRef:payment.reference,vnp_Amount:String(payment.amount*100),vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'123456789',vnp_PayDate:pay.vnpDate(Date.now()-1000),...options};
  return {...params,vnp_SecureHash:pay.signature(params,config.secret)};
}
const move=(db,id,status,actor=3)=>transitionOrder(db,id,status,actor,{version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),reason:'Verified transition'});
function refundInput(db,id,payment) {
  return {version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),amount:String(payment.amount),reference:'REFUND-'+payment.id,evidence_ref:'BANK-EVIDENCE-'+payment.id,note:'Confirmed external refund',occurred_at:new Date(Date.now()+7*3600000).toISOString().slice(0,19)};
}
test('VNPay URL ký HMAC SHA512, tiền nhân 100, mốc giờ Việt Nam và POST retry giữ cùng attempt',()=>{
  const db=fixture();
  try {
    const order=online(db),started=pay.startPayment(db,{id:1},order.id,'127.0.0.1',config);
    assert.equal(started.status,200);
    const url=new URL(started.url),params=Object.fromEntries(url.searchParams);
    assert.equal(url.host,'sandbox.vnpayment.vn');assert.equal(params.vnp_Amount,'100000');
    assert.equal(params.vnp_SecureHash,pay.signature(params,config.secret));
    assert.equal(params.vnp_TxnRef,order.payment.reference);assert.equal(params.vnp_ExpireDate,pay.vnpDate(order.payment.expires_at));
    assert.equal(pay.startPayment(db,{id:1},order.id,'127.0.0.1',config).url,started.url);
    assert.equal(pay.startPayment(db,{id:2},order.id,'127.0.0.1',config).status,404);
    assert.equal(pay.startPayment(db,{id:4},order.id,'127.0.0.1',config).status,403);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
    assert.equal(submitCheckout(db,1,order.key,{},'Customer','0901234567','123 Example street','','ONLINE').id,order.id);
    assert.throws(()=>submitCheckout(db,1,order.key,{},'Customer','0901234567','123 Example street','','COD'),/Phương thức/);
    assert.equal(pay.canonical({vnp_OrderInfo:'Thanh toan 1',vnp_Amount:'100000'}),'vnp_Amount=100000&vnp_OrderInfo=Thanh+toan+1');
    assert.equal(pay.vnpDate(Date.parse('2026-10-06T17:00:00Z')),'20261007000000');
  } finally {db.close();}
});
test('IPN chặn chữ ký/TmnCode/amount/currency/reference sai; thành công không bị lùi bởi failure cũ',()=>{
  const db=fixture();
  try {
    const order=online(db),signed=callback(order.payment);
    assert.equal(move(db,order.id,'CONFIRMED',4).status,409);
    assert.equal(pay.processIpn(db,{...signed,vnp_Amount:'1'},config).RspCode,'97');
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_TmnCode:'WRONG'}),config).RspCode,'97');
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_Amount:'99999'}),config).RspCode,'04');
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_CurrCode:'USD'}),config).RspCode,'04');
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_TxnRef:'missing'}),config).RspCode,'01');
    assert.equal(db.prepare('SELECT status FROM payments').get().status,'PENDING');
    assert.equal(pay.processIpn(db,signed,config).RspCode,'00');
    assert.equal(pay.processIpn(db,signed,config).RspCode,'02');
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_ResponseCode:'24',vnp_TransactionStatus:'02'}),config).RspCode,'02');
    assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'PAID');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_events').get().n,1);
    for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) assert.equal(move(db,order.id,status).status,200);
    assert.ok(db.prepare('SELECT recognition_at FROM orders').get().recognition_at);
    const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),report=salesReport(db,{from:today,to:today});
    assert.equal(report.summary.revenue,1000);assert.equal(report.summary.onlineCash,1000);assert.equal(report.summary.cash,0);
  } finally {db.close();}
});
test('Hết hạn giải phóng tồn một lần; success đến muộn ghi tiền và chờ hoàn, không mở đơn lại',()=>{
  const db=fixture();
  try {
    const order=online(db);
    db.prepare('UPDATE orders SET payment_deadline=? WHERE id=?').run(Date.now()-1,order.id);
    assert.equal(pay.expirePayments(db),1);assert.equal(pay.expirePayments(db),0);
    assert.equal(db.prepare('SELECT status FROM orders').get().status,'CANCELLED');
    assert.equal(db.prepare('SELECT status FROM payments').get().status,'EXPIRED');
    assert.equal(db.prepare('SELECT on_hand,reserved FROM product_variants').get().reserved,0);
    assert.equal(db.prepare("SELECT actor_id,source FROM order_history WHERE source='SYSTEM'").get().actor_id,null);
    assert.equal(pay.processIpn(db,callback(order.payment),config).RspCode,'00');
    const current=db.prepare('SELECT * FROM orders').get();
    assert.equal(current.status,'CANCELLED');assert.equal(current.payment_status,'REFUND_PENDING');
    assert.equal(pay.refundDue(db,order.id).length,1);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
  } finally {db.close();}
});
test('Success sau failure vẫn ghi nhận; hai attempt thu thành công chỉ một doanh thu, khoản dư cần hoàn',()=>{
  const db=fixture();
  try {
    const order=online(db);
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_ResponseCode:'24',vnp_TransactionStatus:'02'}),config).RspCode,'00');
    assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'UNPAID');
    pay.startPayment(db,{id:1},order.id,'127.0.0.1',config);
    const second=db.prepare('SELECT * FROM payments ORDER BY id DESC').get();
    assert.notEqual(second.reference,order.payment.reference);
    assert.equal(pay.processIpn(db,callback(order.payment,{vnp_TransactionNo:'111'}),config).RspCode,'00');
    assert.equal(pay.processIpn(db,callback(second,{vnp_TransactionNo:'222'}),config).RspCode,'00');
    assert.equal(pay.refundDue(db,order.id).length,1);
    for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) move(db,order.id,status);
    const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),report=salesReport(db,{from:today,to:today});
    assert.equal(report.summary.revenue,1000);assert.equal(report.summary.onlineCash,2000);assert.equal(report.pendingRefunds,1000);
    const due=pay.refundDue(db,order.id)[0];
    assert.equal(pay.recordRefund(db,{id:3},due.id,refundInput(db,order.id,due)).status,200);
    assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'PAID');
    assert.equal(pay.refundDue(db,order.id).length,0);
  } finally {db.close();}
});
test('Hoàn tiền chỉ ADMIN, đúng khoản thu/số tiền/bằng chứng, idempotent; không hoàn kho hoặc đổi snapshot',()=>{
  const db=fixture();
  try {
    const order=online(db);pay.processIpn(db,callback(order.payment),config);
    assert.equal(move(db,order.id,'CANCELLED',1).status,200);
    const input=refundInput(db,order.id,order.payment);
    assert.equal(pay.recordRefund(db,{id:4},order.payment.id,input).status,403);
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,{...input,amount:'2000'}).status,400);
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,{...input,evidence_ref:''}).status,400);
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,{...input,version:'0'}).status,409);
    const stock={...db.prepare('SELECT on_hand,reserved FROM product_variants').get()};
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,input).status,200);
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,input).status,200);
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,{...input,reference:'OTHER'}).status,409);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds').get().n,1);
    assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'REFUNDED');
    assert.equal(db.prepare('SELECT total FROM orders').get().total,1000);
    assert.deepEqual({...db.prepare('SELECT on_hand,reserved FROM product_variants').get()},stock);
  } finally {db.close();}
});
test('Lỗi audit IPN hoặc hoàn tiền rollback ledger, trạng thái, event và chứng từ',()=>{
  const db=fixture();
  try {
    const order=online(db),ipn=callback(order.payment);
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'payment failure'); END");
    assert.throws(()=>pay.processIpn(db,ipn,config),/payment failure/);
    assert.equal(db.prepare('SELECT status FROM payments').get().status,'PENDING');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_events').get().n,0);
    db.exec('DROP TRIGGER fail');
    pay.processIpn(db,ipn,config);move(db,order.id,'CANCELLED',1);
    const input=refundInput(db,order.id,order.payment);
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'refund failure'); END");
    assert.throws(()=>pay.recordRefund(db,{id:3},order.payment.id,input),/refund failure/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds').get().n,0);
    assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'REFUND_PENDING');
  } finally {db.close();}
});
test('Báo cáo ghi tiền thu và hoàn đúng các kỳ khác nhau, không coi tiền hoàn là doanh thu',()=>{
  const db=fixture();
  try {
    const order=online(db);pay.processIpn(db,callback(order.payment),config);move(db,order.id,'CANCELLED',1);
    db.prepare("UPDATE payments SET occurred_at='2026-10-06 17:00:00' WHERE id=?").run(order.payment.id);
    const input={...refundInput(db,order.id,order.payment),occurred_at:'2026-10-08T00:00:00'};
    assert.equal(pay.recordRefund(db,{id:3},order.payment.id,input,Date.parse('2026-10-08T01:00:00+07:00')).status,200);
    const first=salesReport(db,{from:'2026-10-07',to:'2026-10-07'}),second=salesReport(db,{from:'2026-10-08',to:'2026-10-08'});
    assert.equal(first.summary.onlineCash,1000);assert.equal(first.summary.refunds,0);assert.equal(first.summary.netCash,1000);assert.equal(first.summary.revenue,0);
    assert.equal(second.summary.onlineCash,0);assert.equal(second.summary.refunds,1000);assert.equal(second.summary.netCash,-1000);
  } finally {db.close();}
});
