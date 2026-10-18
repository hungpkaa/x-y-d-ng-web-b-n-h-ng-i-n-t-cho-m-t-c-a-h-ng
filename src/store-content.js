const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
function content(db) {return db.prepare('SELECT * FROM store_content WHERE id=1').get();}
function saveContent(db,actor,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),before=content(db);
    if(Number(input.version)!==before.version) reject(409,'Nội dung đã được cập nhật.');
    const fields=['title','subtitle','contact'].map(k=>String(input[k]||'').trim());
    if(!fields[0]||fields[0].length>100||!fields[1]||fields[1].length>300||fields[2].length>300) reject(400,'Kiểm tra tiêu đề, nội dung và liên hệ.');
    db.prepare('UPDATE store_content SET title=?,subtitle=?,contact=?,version=version+1 WHERE id=1').run(...fields);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'STORE_CONTENT','store_content',1,?,?)").run(admin.id,JSON.stringify(before),JSON.stringify(content(db)));
    return {status:200,message:'Đã cập nhật trang chủ.'};
  });
}
module.exports={content,saveContent};
