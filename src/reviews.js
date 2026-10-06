const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {pagination}=require('./product-list');
function audit(db,actor,action,id,before,after) {
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,?,'REVIEW',?,?,?)").run(actor.id,action,id,before?JSON.stringify(before):null,JSON.stringify(after));
}
function saveReview(db,actor,itemId,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']),item=db.prepare('SELECT i.id,o.id AS order_id,o.user_id,o.status FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=?').get(itemId);
    if(!item||item.user_id!==user.id) reject(404,'Không tìm thấy dòng đơn của bạn.');
    if(item.status!=='DELIVERED') reject(409,'Chỉ đánh giá sau khi đơn đã giao.');
    if(['status','user_id','product_id','moderator_id'].some(key=>input[key]!==undefined)) reject(403,'Đánh giá chỉ được sửa sao và nội dung của chính bạn.');
    if(typeof input.rating!=='string'||! /^[1-5]$/.test(input.rating)||typeof input.content!=='string'||input.content.trim().length<1||input.content.trim().length>2000) reject(400,'Chọn 1–5 sao và nội dung 1–2000 ký tự.');
    const existing=db.prepare('SELECT * FROM reviews WHERE order_item_id=?').get(itemId);
    if(Number(input.version)!==(existing?.version??0)) reject(409,'Đánh giá đã thay đổi. Hãy tải lại trang đơn và sửa bản hiện có.');
    let id;
    if(existing) {id=existing.id;db.prepare("UPDATE reviews SET rating=?,content=?,status='PENDING',version=version+1,moderator_id=NULL,moderation_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Number(input.rating),input.content.trim(),id);}
    else id=Number(db.prepare('INSERT INTO reviews(order_item_id,rating,content) VALUES(?,?,?)').run(itemId,Number(input.rating),input.content.trim()).lastInsertRowid);
    audit(db,user,'REVIEW_SUBMIT',id,existing?{status:existing.status,version:existing.version}:null,{status:'PENDING',rating:Number(input.rating),version:(existing?.version??0)+1});
    return {status:200,message:'Đã gửi đánh giá, chờ quản trị viên duyệt.',orderId:item.order_id};
  });
}
function moderateReview(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']),review=db.prepare('SELECT * FROM reviews WHERE id=?').get(id);
    if(!review) reject(404,'Không tìm thấy đánh giá.');
    if(input.content!==undefined||input.rating!==undefined) reject(403,'Quản trị viên không được sửa nội dung hoặc số sao thay khách.');
    if(Number(input.version)!==review.version) reject(409,'Đánh giá đã thay đổi. Hãy tải lại danh sách.');
    const reason=typeof input.reason==='string'?input.reason.trim():'';
    if(!['APPROVED','HIDDEN','REJECTED'].includes(input.status)||reason.length>300||input.status!=='APPROVED'&&reason.length<3) reject(400,'Chọn trạng thái duyệt; ẩn/từ chối cần lý do 3–300 ký tự.');
    db.prepare('UPDATE reviews SET status=?,moderator_id=?,moderation_reason=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(input.status,admin.id,reason,id);
    audit(db,admin,'REVIEW_MODERATE',id,{status:review.status,version:review.version},{status:input.status,version:review.version+1,reason});
    return {status:200,message:'Đã cập nhật kiểm duyệt đánh giá.'};
  });
}
function orderReviews(db,orderId) {return db.prepare('SELECT r.* FROM reviews r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=?').all(orderId);}
function publicReviews(db,productId,page='1',variantId=null) {
  if(typeof page!=='string'||!/^\d+$/.test(page)||!Number.isSafeInteger(Number(page))||Number(page)<1) return {status:400,message:'Trang đánh giá không hợp lệ.'};
  const where="FROM reviews r JOIN order_items i ON i.id=r.order_item_id JOIN products p ON p.id=i.product_id WHERE i.product_id=? AND p.status='ACTIVE' AND r.status='APPROVED'";
  const summary=db.prepare(`SELECT COUNT(*) count,AVG(r.rating) average ${where}`).get(productId);
  const paging=pagination(summary.count,page,20,`/products/${productId}`);
  const link=n=>`/products/${productId}?${new URLSearchParams({... (variantId?{sku:String(variantId)}:{}),reviews_page:String(n)})}#reviews`;
  paging.previous=paging.page>1?link(paging.page-1):null;paging.next=paging.page<paging.pages?link(paging.page+1):null;
  const rows=db.prepare(`SELECT r.rating,r.content,r.updated_at,i.sku_snapshot,i.configuration_snapshot ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`).all(productId,paging.size,paging.offset);
  return {status:200,summary,rows,paging};
}
function listReviews(db,query={}) {
  const status=query.status??'PENDING',q=typeof query.q==='string'?query.q.trim():'';
  if(!['','PENDING','APPROVED','HIDDEN','REJECTED'].includes(status)||q.length>100) return {status:400,message:'Bộ lọc đánh giá không hợp lệ.'};
  const from="FROM reviews r JOIN order_items i ON i.id=r.order_item_id JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=o.user_id WHERE (?='' OR r.status=?) AND (instr(lower(i.name),lower(?))>0 OR instr(lower(r.content),lower(?))>0)",args=[status,status,q,q];
  const total=db.prepare(`SELECT COUNT(*) n ${from}`).get(...args).n,paging=pagination(total,query.page||1,20,'/admin/reviews',{status,q});
  const rows=db.prepare(`SELECT r.*,i.name,i.sku_snapshot,o.id AS order_id,o.status AS order_status,u.name AS customer_name ${from} ORDER BY r.id DESC LIMIT ? OFFSET ?`).all(...args,paging.size,paging.offset);
  return {status:200,rows,paging,filters:{status,q}};
}
module.exports={saveReview,moderateReview,orderReviews,publicReviews,listReviews};
