const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
function scan(db) {
  return transaction(db,()=>{
    const rows=db.prepare("SELECT p.id,p.order_id,o.status FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.status='SUCCEEDED' AND (o.status IN ('CANCELLED','DELIVERY_FAILED') OR EXISTS(SELECT 1 FROM payments f WHERE f.order_id=p.order_id AND f.status='SUCCEEDED' AND f.id<p.id))").all();
    for(const p of rows) db.prepare('INSERT OR IGNORE INTO payment_exceptions(payment_id,order_id,kind,created_at) VALUES(?,?,?,?)').run(p.id,p.order_id,['CANCELLED','DELIVERY_FAILED'].includes(p.status)?'REFUND_DUE':'DUPLICATE_CAPTURE',Date.now());
    db.prepare("UPDATE payment_exceptions SET status='RESOLVED',note='Đã ghi nhận chứng từ hoàn tiền',version=version+1 WHERE status='OPEN' AND EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=payment_exceptions.payment_id)").run();
    return rows.length;
  });
}
function resolve(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),row=db.prepare('SELECT * FROM payment_exceptions WHERE id=?').get(id);
    if(!row) reject(404,'Không tìm thấy ngoại lệ.');
    if(row.status!=='OPEN'||row.version!==Number(input.version)) reject(409,'Ngoại lệ đã thay đổi.');
    const note=String(input.note||'').trim();if(note.length<5||note.length>500) reject(400,'Cần ghi chú xử lý từ 5 đến 500 ký tự.');
    if(!db.prepare('SELECT id FROM refunds WHERE payment_id=?').get(row.payment_id)) reject(409,'Khoản tiền này cần chứng từ hoàn tiền trước khi đóng ngoại lệ.');
    db.prepare("UPDATE payment_exceptions SET status='RESOLVED',note=?,resolved_by=?,version=version+1 WHERE id=?").run(note,admin.id,id);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'RESOLVE_PAYMENT_EXCEPTION','payment_exception',?,?)").run(admin.id,id,JSON.stringify({note}));
    return {status:200,message:'Đã đóng ngoại lệ.'};
  });
}
module.exports={scan,resolve};
