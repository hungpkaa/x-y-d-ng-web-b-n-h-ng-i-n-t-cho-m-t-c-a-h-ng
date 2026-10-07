const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {pagination}=require('./product-list');
function normalizeCode(value='') {
  if(typeof value!=='string') throw new Error('Mã giảm giá không hợp lệ.');
  const code=value.trim().toUpperCase();
  if(code&&!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('Mã giảm giá cần 3–40 ký tự chữ, số, gạch ngang hoặc gạch dưới.');
  return code;
}
function localTime(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time=Date.parse(value+':00+07:00');
  return Number.isFinite(time)&&new Date(time+25200000).toISOString().slice(0,16)===value?time:NaN;
}
const displayTime=value=>new Date(value+25200000).toISOString().slice(0,16);
const integer=(value,min,max)=>typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
function log(db,actor,action,id,before,after) {
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,?,'PROMOTION',?,?,?)").run(actor.id,action,id,before?JSON.stringify(before):null,JSON.stringify(after));
}
function savePromotion(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    const existing=id===null?null:db.prepare('SELECT * FROM promotions WHERE id=?').get(id);
    if(id!==null&&!existing) reject(404,'Không tìm thấy khuyến mãi.');
    if(existing&&Number(input.version)!==existing.version) reject(409,'Khuyến mãi đã thay đổi. Hãy tải lại trang.');
    if(existing&&db.prepare('SELECT id FROM promotion_redemptions WHERE promotion_id=? LIMIT 1').get(id)) reject(409,'Mã đã có lượt sử dụng/giữ không được sửa quy tắc. Hãy tắt hoặc tạo mã mới.');
    let code;try {code=normalizeCode(input.code);}catch(error){reject(400,error.message);}
    const starts=localTime(input.starts_at),ends=localTime(input.ends_at);
    if(!code||!['FIXED','PERCENT'].includes(input.kind)||!['ALL','PRODUCT'].includes(input.scope)||!integer(input.value,1,input.kind==='PERCENT'?100:1000000000)||!integer(input.minimum,0,1000000000000)||!integer(input.total_limit,1,1000000)||!integer(input.user_limit,1,Number(input.total_limit))||!['0','1'].includes(input.active)||!Number.isFinite(starts)||!Number.isFinite(ends)||ends<=starts) reject(400,'Kiểm tra loại/mức giảm, phạm vi, giá tối thiểu, số lượt và thời gian Việt Nam (UTC+7).');
    const cap=input.cap===''||input.cap===undefined?null:integer(input.cap,1,1000000000)?Number(input.cap):NaN;
    if(Number.isNaN(cap)||input.kind==='PERCENT'&&cap===null) reject(400,'Mã phần trăm cần trần giảm là số nguyên 1–1 tỷ VND.');
    const raw=input.product_ids===undefined?[]:Array.isArray(input.product_ids)?input.product_ids:[input.product_ids];
    if(raw.some(value=>!integer(value,1,Number.MAX_SAFE_INTEGER))) reject(400,'Danh sách sản phẩm không hợp lệ.');
    const products=[...new Set(raw.map(Number))];
    if(input.scope==='PRODUCT'&&!products.length||input.scope==='ALL'&&products.length) reject(400,'Phạm vi sản phẩm phải chọn ít nhất một sản phẩm; phạm vi toàn bộ cần bỏ chọn danh sách.');
    if(products.some(product=>!db.prepare('SELECT id FROM products WHERE id=?').get(product))) reject(400,'Sản phẩm áp dụng không tồn tại.');
    if(db.prepare('SELECT id FROM promotions WHERE code=? AND id<>?').get(code,id??-1)) reject(409,'Mã giảm giá đã tồn tại.');
    const values=[code,input.kind,Number(input.value),cap,Number(input.minimum),input.scope,starts,ends,Number(input.total_limit),Number(input.user_limit),Number(input.active)];
    if(existing) db.prepare('UPDATE promotions SET code=?,kind=?,value=?,cap=?,minimum=?,scope=?,starts_at=?,ends_at=?,total_limit=?,user_limit=?,active=?,version=version+1 WHERE id=?').run(...values,id);
    else id=Number(db.prepare('INSERT INTO promotions(code,kind,value,cap,minimum,scope,starts_at,ends_at,total_limit,user_limit,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...values).lastInsertRowid);
    db.prepare('DELETE FROM promotion_products WHERE promotion_id=?').run(id);
    for(const product of products) db.prepare('INSERT INTO promotion_products(promotion_id,product_id) VALUES(?,?)').run(id,product);
    log(db,admin,'PROMOTION_SAVE',id,existing,{...db.prepare('SELECT * FROM promotions WHERE id=?').get(id),product_ids:products});
    return {status:200,message:'Đã lưu khuyến mãi.',id};
  });
}
function togglePromotion(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),promotion=db.prepare('SELECT * FROM promotions WHERE id=?').get(id);
    if(!promotion) reject(404,'Không tìm thấy khuyến mãi.');
    if(Number(input.version)!==promotion.version) reject(409,'Khuyến mãi đã thay đổi. Hãy tải lại trang.');
    if(!['0','1'].includes(input.active)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.trim().length>300) reject(400,'Chọn trạng thái và nhập lý do 3–300 ký tự.');
    if(input.active==='1'&&!promotion.active&&db.prepare('SELECT id FROM promotion_redemptions WHERE promotion_id=? LIMIT 1').get(id)) reject(409,'Mã đã sử dụng và bị tắt cần tạo mã mới thay vì bật lại.');
    db.prepare('UPDATE promotions SET active=?,version=version+1 WHERE id=?').run(Number(input.active),id);
    log(db,admin,'PROMOTION_STATUS',id,{active:promotion.active},{active:Number(input.active),reason:input.reason.trim()});
    return {status:200,message:input.active==='1'?'Đã bật mã giảm giá.':'Đã tắt mã cho đơn mới; đơn đã đặt giữ nguyên mức giảm.'};
  });
}
function promotionQuote(db,userId,snapshot,rawCode='',now=Date.now()) {
  const code=normalizeCode(rawCode);
  if(!code) return {id:null,code:'',discount:0};
  const promo=db.prepare('SELECT * FROM promotions WHERE code=?').get(code);
  if(!promo||!promo.active||now<promo.starts_at||now>=promo.ends_at) throw new Error('Mã giảm giá chưa có hiệu lực, đã hết hạn hoặc đã tắt.');
  const subtotal=snapshot.reduce((sum,[,quantity,price])=>sum+quantity*price,0);
  if(subtotal<promo.minimum) throw new Error('Giá trị tiền hàng chưa đạt mức tối thiểu của mã giảm giá.');
  const counts=db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN user_id=? THEN 1 ELSE 0 END) per_user FROM promotion_redemptions WHERE promotion_id=? AND status IN ('HELD','USED')").get(userId,promo.id);
  if(counts.total>=promo.total_limit||(counts.per_user||0)>=promo.user_limit) throw new Error('Mã giảm giá đã hết lượt hoặc bạn đã đạt giới hạn sử dụng.');
  const selected=promo.scope==='ALL'?null:new Set(db.prepare('SELECT product_id FROM promotion_products WHERE promotion_id=?').all(promo.id).map(row=>row.product_id));
  const eligible=snapshot.reduce((sum,[variantId,quantity,price])=>sum+(!selected||selected.has(db.prepare('SELECT product_id FROM product_variants WHERE id=?').get(variantId)?.product_id)?quantity*price:0),0);
  const calculated=promo.kind==='FIXED'?promo.value:Math.floor(eligible*promo.value/100);
  const discount=Math.max(0,Math.min(calculated,promo.cap??calculated,eligible,subtotal-1));
  if(discount<1) throw new Error('Giỏ hàng không có tiền hàng phù hợp để áp dụng mã.');
  return {id:promo.id,code:promo.code,discount};
}
function listPromotions(db,query={}) {
  const q=typeof query.q==='string'?query.q.trim():'',active=query.active??'';
  if(q.length>100||!['','0','1'].includes(active)) return {status:400,message:'Bộ lọc không hợp lệ.'};
  const where="WHERE instr(code,upper(?))>0 AND (?='' OR CAST(active AS TEXT)=?)",args=[q,active,active];
  const total=db.prepare(`SELECT COUNT(*) n FROM promotions ${where}`).get(...args).n;
  const paging=pagination(total,query.page||1,20,'/admin/promotions',{q,active});
  const rows=db.prepare(`SELECT p.*,(SELECT COUNT(*) FROM promotion_redemptions WHERE promotion_id=p.id AND status IN ('HELD','USED')) AS occupied FROM promotions p ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args,paging.size,paging.offset);
  return {status:200,rows,paging,filters:{q,active}};
}
module.exports={normalizeCode,displayTime,savePromotion,togglePromotion,promotionQuote,listPromotions};
