const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
function shippingPolicy(db) {return db.prepare('SELECT * FROM shipping_policy WHERE id=1').get();}
function saveShippingPolicy(db,actor,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),policy=shippingPolicy(db),fee=Number(input.fee);
    if(Number(input.version)!==policy.version) reject(409,'Biểu phí đã thay đổi. Hãy tải lại trang.');
    if(typeof input.fee!=='string'||!/^\d+$/.test(input.fee)||!Number.isSafeInteger(fee)||fee<0||fee>1000000||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.trim().length>300) reject(400,'Phí phải là số nguyên 0–1.000.000 VND và cần lý do (3–300 ký tự).');
    db.prepare('UPDATE shipping_policy SET fee=?,version=version+1 WHERE id=1').run(fee);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'SHIPPING_FEE','SHIPPING_POLICY',1,?,?)").run(admin.id,JSON.stringify({fee:policy.fee}),JSON.stringify({fee,reason:input.reason.trim()}));
    return {status:200,message:'Đã cập nhật phí giao hàng cho báo giá mới.'};
  });
}
module.exports={shippingPolicy,saveShippingPolicy};
