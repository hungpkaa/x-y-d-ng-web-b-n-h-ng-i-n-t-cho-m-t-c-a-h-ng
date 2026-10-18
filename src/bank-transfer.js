const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {inventoryTransitionWork}=require('./orders');
const HOLD_MS=30*60000;
const utc=time=>new Date(time).toISOString().slice(0,19).replace('T',' ');

// Internal checkout work: caller must include order creation and cart consumption
// in the same transaction. This is not a public switch for existing COD orders.
function prepareBankTransferWork(db,actor,orderId,receiver,now=Date.now()) {
  const user=actorUser(db,actor,['CUSTOMER']);
  if(!Number.isSafeInteger(orderId)||orderId<1) reject(404,'Không tìm thấy đơn.');
  const order=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId,user.id);
  if(!order) reject(404,'Không tìm thấy đơn.');
  const previous=db.prepare('SELECT * FROM bank_transfer_orders WHERE order_id=?').get(orderId);
  if(previous) return previous; // Retry must never extend a deadline or replace its snapshot.
  if(order.status!=='PENDING'||order.payment_method!=='COD'||order.payment_status!=='UNPAID'||db.prepare('SELECT id FROM payments WHERE order_id=?').get(orderId)) reject(409,'Đơn không đủ điều kiện tạo chỉ dẫn chuyển khoản.');
  if(typeof receiver?.bankCode!=='string'||!/^[A-Z0-9_-]{2,30}$/.test(receiver.bankCode)||typeof receiver.accountNumber!=='string'||!/^\d{4,34}$/.test(receiver.accountNumber)||typeof receiver.accountName!=='string'||receiver.accountName.trim().length<2||receiver.accountName.trim().length>120||!Number.isSafeInteger(now)||now<0) reject(400,'Thông tin tài khoản nhận tiền không hợp lệ.');
  const deadline=now+HOLD_MS;
  if(!Number.isSafeInteger(deadline)) reject(400,'Thời hạn chuyển khoản không hợp lệ.');
  db.prepare('INSERT INTO bank_transfer_orders(order_id,bank_code,account_number,account_name,transfer_reference,amount,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(orderId,receiver.bankCode,receiver.accountNumber,receiver.accountName.trim(),'DH'+orderId,order.total,deadline,utc(now));
  db.prepare("UPDATE orders SET payment_method='BANK_TRANSFER',payment_status='PENDING',payment_deadline=? WHERE id=?").run(deadline,orderId);
  return db.prepare('SELECT * FROM bank_transfer_orders WHERE order_id=?').get(orderId);
}

function expireBankTransfers(db,now=Date.now()) {
  return transaction(db,()=>{
    const rows=db.prepare("SELECT o.* FROM orders o JOIN bank_transfer_orders b ON b.order_id=o.id WHERE o.payment_method='BANK_TRANSFER' AND o.status='PENDING' AND o.payment_status IN ('UNPAID','PENDING') AND b.expires_at<=? ORDER BY o.id LIMIT 100").all(now);
    for(const order of rows) {
      inventoryTransitionWork(db,order.id,'CANCELLED',null);
      db.prepare("UPDATE orders SET status='CANCELLED',payment_status='UNPAID',version=version+1 WHERE id=?").run(order.id);
      db.prepare("INSERT INTO order_history(order_id,status,previous_status,note,source) VALUES(?,'CANCELLED','PENDING','Hết 30 phút chờ xác nhận chuyển khoản','SYSTEM')").run(order.id);
      db.prepare("INSERT INTO audit_logs(action,entity_type,entity_id,after_json) VALUES('BANK_TRANSFER_EXPIRED','ORDER',?,?)").run(order.id,JSON.stringify({status:'CANCELLED'}));
    }
    return rows.length;
  });
}
function confirmBankTransfer(db,actor,orderId,input,now=Date.now()) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    if(!Number.isSafeInteger(orderId)||orderId<1) reject(404,'Không tìm thấy đơn chuyển khoản.');
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    const instructions=db.prepare('SELECT * FROM bank_transfer_orders WHERE order_id=?').get(orderId);
    if(!order||!instructions||order.payment_method!=='BANK_TRANSFER') reject(404,'Không tìm thấy đơn chuyển khoản.');
    const reference=typeof input.reference==='string'?input.reference.trim():'',note=typeof input.note==='string'?input.note.trim():'';
    const occurred=require('./payments').providerTime(typeof input.occurred_at==='string'?input.occurred_at.replace(/[-T:]/g,''):'');
    if(!/^[A-Za-z0-9_-]{3,100}$/.test(reference)||note.length<3||note.length>300||typeof input.amount!=='string'||!/^\d+$/.test(input.amount)||Number(input.amount)!==instructions.amount||!occurred||occurred<order.created_at||Date.parse(occurred.replace(' ','T')+'Z')>now+60000) reject(400,'Cần đúng số tiền, mã giao dịch ngân hàng, ghi chú và thời điểm nhận tiền hợp lệ.');
    const old=db.prepare('SELECT * FROM bank_transfer_receipts WHERE bank_transaction_id=?').get(reference);
    if(old) {
      if(old.order_id!==orderId||old.amount!==Number(input.amount)||old.note!==note||old.occurred_at!==occurred) reject(409,'Mã giao dịch đã được đối soát với nội dung khác.');
      return {status:200,paymentId:old.payment_id,replayed:true,message:'Khoản chuyển đã được xác nhận trước đó.'};
    }
    if(Number(input.version)!==order.version) reject(409,'Đơn đã thay đổi. Hãy tải lại.');
    if(!['PENDING','CANCELLED','DELIVERY_FAILED'].includes(order.status)||!['PENDING','UNPAID'].includes(order.payment_status)) reject(409,'Đơn không còn chờ đối soát khoản chuyển này.');
    if(order.status==='PENDING'&&instructions.expires_at<=now) {
      inventoryTransitionWork(db,orderId,'CANCELLED',null);
      db.prepare("UPDATE orders SET status='CANCELLED',version=version+1 WHERE id=?").run(orderId);
      db.prepare("INSERT INTO order_history(order_id,status,previous_status,note,source) VALUES(?,'CANCELLED','PENDING','Hết 30 phút chờ xác nhận chuyển khoản','SYSTEM')").run(orderId);
    }
    const cancelled=db.prepare('SELECT status FROM orders WHERE id=?').get(orderId).status!=='PENDING';
    const paymentId=Number(db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status,provider_transaction_id,occurred_at,evidence_ref) VALUES(?,'BANK_TRANSFER',?,?,'SUCCEEDED',?,?,?)").run(orderId,'BANK-'+reference,instructions.amount,reference,occurred,reference).lastInsertRowid);
    db.prepare('INSERT INTO bank_transfer_receipts(order_id,payment_id,actor_id,bank_transaction_id,amount,note,occurred_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(orderId,paymentId,admin.id,reference,instructions.amount,note,occurred,utc(now));
    db.prepare('UPDATE orders SET payment_status=?,version=version+1 WHERE id=?').run(cancelled?'REFUND_PENDING':'PAID',orderId);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'BANK_TRANSFER_RECEIPT','ORDER',?,?)").run(admin.id,orderId,JSON.stringify({payment_id:paymentId,amount:instructions.amount,outcome:cancelled?'REFUND_PENDING':'PAID'}));
    return {status:200,paymentId,replayed:false,message:cancelled?'Đã ghi khoản thu cần hoàn; đơn đã hủy không mở lại.':'Đã đối soát đủ tiền chuyển khoản.'};
  });
}
module.exports={HOLD_MS,prepareBankTransferWork,expireBankTransfers,confirmBankTransfer};
