const {createHash,randomBytes}=require('node:crypto');
const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {pagination}=require('./product-list');
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
function audit(db,actor,action,type,id,data) {
  db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,?,?,?,?)').run(actor.id,action,type,id,JSON.stringify(data));
}
function rateLimit(db,key,maximum,now=Date.now()) {
  return transaction(db,()=>{
    db.prepare('DELETE FROM request_limits WHERE expires_at<=?').run(now);
    const keyHash=hash(key),row=db.prepare('SELECT * FROM request_limits WHERE key_hash=?').get(keyHash);
    if(row&&row.count>=maximum) return false;
    db.prepare('INSERT INTO request_limits VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=request_limits.count+1').run(keyHash,now+15*60000);
    return true;
  });
}
function issuePasswordReset(db,email,now=Date.now()) {
  return transaction(db,()=>{
    const user=typeof email==='string'?db.prepare("SELECT id,email,auth_version FROM users WHERE email=? AND status='ACTIVE'").get(email.trim().toLowerCase()):null;
    if(!user) return null;
    const token=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM password_resets WHERE expires_at<=?').run(now);
    db.prepare('INSERT INTO password_resets VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,auth_version=excluded.auth_version,expires_at=excluded.expires_at').run(user.id,hash(token),user.auth_version,now+30*60000);
    return {token,email:user.email};
  });
}
function resetPassword(db,token,input,now=Date.now()) {
  return transaction(db,()=>{
    if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)) reject(400,'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
    const row=db.prepare("SELECT r.*,u.status,u.auth_version current_auth FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=?").get(hash(token));
    if(!row||row.status!=='ACTIVE'||row.auth_version!==row.current_auth||row.expires_at<=now) reject(400,'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
    if(!text(input.password,10,128)||input.password.length>128||input.password!==input.confirm_password) reject(400,'Mật khẩu cần 10–128 ký tự và xác nhận phải khớp.');
    db.prepare('UPDATE users SET password=?,auth_version=auth_version+1,version=version+1 WHERE id=?').run(require('./db').hashPassword(input.password),row.user_id);
    db.prepare('DELETE FROM password_resets WHERE user_id=?').run(row.user_id);
    audit(db,{id:row.user_id},'PASSWORD_RESET','USER',row.user_id,{sessions_invalidated:true});
    return {status:200,message:'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'};
  });
}
function addresses(db,actor) {
  const user=actorUser(db,actor,['CUSTOMER']);
  return db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id').all(user.id);
}
function saveAddress(db,actor,id,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(['user_id','is_default'].some(key=>input[key]!==undefined)) reject(403,'Không được thay chủ sở hữu hoặc mặc định qua thao tác này.');
    const existing=id===null?null:db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(id,user.id);
    if(id!==null&&!existing) reject(404,'Không tìm thấy địa chỉ.');
    if(existing&&Number(input.version)!==existing.version) reject(409,'Địa chỉ đã thay đổi. Hãy tải lại.');
    if(!text(input.label,1,60)||!text(input.recipient,2,80)||typeof input.phone!=='string'||!/^0\d{9}$/.test(input.phone)||!text(input.address,10,300)) reject(400,'Kiểm tra tên địa chỉ, người nhận, điện thoại và địa chỉ.');
    const count=db.prepare('SELECT COUNT(*) n FROM addresses WHERE user_id=?').get(user.id).n;
    if(!existing&&count>=20) reject(409,'Bạn có thể lưu tối đa 20 địa chỉ.');
    if(existing) db.prepare('UPDATE addresses SET label=?,recipient=?,phone=?,address=?,version=version+1 WHERE id=?').run(input.label.trim(),input.recipient.trim(),input.phone,input.address.trim(),id);
    else id=Number(db.prepare('INSERT INTO addresses(user_id,label,recipient,phone,address,is_default) VALUES(?,?,?,?,?,?)').run(user.id,input.label.trim(),input.recipient.trim(),input.phone,input.address.trim(),count===0?1:0).lastInsertRowid);
    audit(db,user,'ADDRESS_SAVE','ADDRESS',id,{version:existing?existing.version+1:1});
    return {status:200,message:'Đã lưu địa chỉ.',id};
  });
}
function changeAddress(db,actor,id,input,action) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']),row=db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(id,user.id);
    if(!row) reject(404,'Không tìm thấy địa chỉ.');
    if(Number(input.version)!==row.version) reject(409,'Địa chỉ đã thay đổi. Hãy tải lại.');
    if(action==='default') {
      db.prepare('UPDATE addresses SET is_default=0,version=version+1 WHERE user_id=? AND is_default=1 AND id<>?').run(user.id,id);
      db.prepare('UPDATE addresses SET is_default=1,version=version+1 WHERE id=?').run(id);
    } else if(action==='delete') {
      db.prepare('DELETE FROM addresses WHERE id=?').run(id);
      if(row.is_default) db.prepare('UPDATE addresses SET is_default=1,version=version+1 WHERE id=(SELECT MIN(id) FROM addresses WHERE user_id=?)').run(user.id);
    } else reject(400,'Thao tác không hợp lệ.');
    audit(db,user,'ADDRESS_'+action.toUpperCase(),'ADDRESS',id,{});
    return {status:200,message:action==='default'?'Đã chọn địa chỉ mặc định.':'Đã xóa địa chỉ. Đơn cũ giữ nguyên thông tin nhận hàng.'};
  });
}
function visibleTicket(db,user,id) {
  const row=db.prepare('SELECT s.*,u.name assigned_name FROM support_requests s LEFT JOIN users u ON u.id=s.assigned_to WHERE s.id=?').get(id);
  if(!row||user.role==='CUSTOMER'&&row.user_id!==user.id) reject(404,'Không tìm thấy yêu cầu hỗ trợ.');
  return row;
}
function listSupport(db,actor,query={}) {
  const user=actorUser(db,actor),status=query.status??'',q=query.q??'',page=query.page??'1';
  if(typeof status!=='string'||!['','OPEN','IN_PROGRESS','RESOLVED','CLOSED'].includes(status)||typeof q!=='string'||q.length>120||typeof page!=='string'||!/^\d+$/.test(page)||!Number.isSafeInteger(Number(page))||Number(page)<1||Number(page)>1000000) return {status:400,message:'Bộ lọc hỗ trợ không hợp lệ.'};
  const management=user.role!=='CUSTOMER',where=["(?='' OR s.status=?)","instr(lower(s.subject),lower(?))>0"],args=[status,status,q];
  if(!management) {where.push('s.user_id=?');args.push(user.id);}
  const from=' FROM support_requests s WHERE '+where.join(' AND '),total=db.prepare('SELECT COUNT(*) n'+from).get(...args).n;
  const paging=pagination(total,page,20,management?'/admin/support':'/support',{status,q});
  const rows=db.prepare('SELECT s.*'+from+' ORDER BY s.updated_at DESC,s.id DESC LIMIT ? OFFSET ?').all(...args,paging.size,paging.offset);
  return {status:200,rows,paging,filters:{status,q},management};
}
function supportDetail(db,actor,id,query={}) {
  const user=actorUser(db,actor),ticket=visibleTicket(db,user,id),management=user.role!=='CUSTOMER';
  if(query.page!==undefined&&(typeof query.page!=='string'||!/^\d+$/.test(query.page)||!Number.isSafeInteger(Number(query.page))||Number(query.page)<1||Number(query.page)>1000000)) reject(400,'Trang hội thoại không hợp lệ.');
  const condition=' WHERE m.request_id=?'+(management?'':' AND m.internal=0');
  const total=db.prepare('SELECT COUNT(*) n FROM support_messages m'+condition).get(id).n;
  const paging=pagination(total,query.page??String(Math.max(1,Math.ceil(total/20))),20,'/support/'+id);
  const messages=db.prepare('SELECT m.*,u.name actor_name,u.role actor_role FROM support_messages m JOIN users u ON u.id=m.actor_id'+condition+' ORDER BY m.id LIMIT ? OFFSET ?').all(id,paging.size,paging.offset);
  const history=db.prepare('SELECT * FROM support_history WHERE request_id=? ORDER BY id DESC LIMIT 50').all(id).reverse();
  return {ticket,messages,paging,history:management?history:history.map(({id,previous_status,status,created_at})=>({id,previous_status,status,created_at})),management};
}
function createSupport(db,actor,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    const order=db.prepare('SELECT id FROM orders WHERE id=? AND user_id=?').get(Number(input.order_id),user.id);
    if(!order) reject(404,'Không tìm thấy đơn hàng của bạn.');
    if(!text(input.subject,1,120)||!text(input.content,1,2000)||input.internal!==undefined) reject(400,'Nhập chủ đề và nội dung hỗ trợ hợp lệ.');
    const id=Number(db.prepare('INSERT INTO support_requests(user_id,order_id,subject) VALUES(?,?,?)').run(user.id,order.id,input.subject.trim()).lastInsertRowid);
    db.prepare('INSERT INTO support_messages(request_id,actor_id,content) VALUES(?,?,?)').run(id,user.id,input.content.trim());
    db.prepare("INSERT INTO support_history(request_id,actor_id,status) VALUES(?,?,'OPEN')").run(id,user.id);
    audit(db,user,'SUPPORT_CREATE','SUPPORT',id,{order_id:order.id});
    return {status:200,message:'Đã gửi yêu cầu hỗ trợ.',id};
  });
}
function replySupport(db,actor,id,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor),row=visibleTicket(db,user,id);
    if(Number(input.version)!==row.version) reject(409,'Hội thoại đã thay đổi. Hãy tải lại.');
    if(row.status==='CLOSED') reject(409,'Yêu cầu đã đóng. Mở lại trước khi gửi tin.');
    const internal=input.internal??'0';
    if(!['0','1'].includes(internal)||!text(input.content,1,2000)) reject(400,'Nội dung cần 1–2000 ký tự.');
    if(user.role==='CUSTOMER'&&internal!=='0') reject(403,'Khách hàng không được ghi chú nội bộ.');
    db.prepare('INSERT INTO support_messages(request_id,actor_id,content,internal) VALUES(?,?,?,?)').run(id,user.id,input.content.trim(),Number(internal));
    db.prepare('UPDATE support_requests SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
    audit(db,user,'SUPPORT_REPLY','SUPPORT',id,{internal:Number(internal)});
    return {status:200,message:'Đã gửi tin nhắn.'};
  });
}
function changeSupport(db,actor,id,input,now=Date.now()) {
  return transaction(db,()=>{
    const user=actorUser(db,actor),row=visibleTicket(db,user,id);
    if(Number(input.version)!==row.version) reject(409,'Yêu cầu đã thay đổi. Hãy tải lại.');
    if(user.role==='CUSTOMER') {
      if(input.status!=='OPEN'||row.status!=='CLOSED'||!row.closed_at||now-Date.parse(row.closed_at.replace(' ','T')+'Z')>7*86400000) reject(409,'Chỉ mở lại yêu cầu đã đóng trong 7 ngày.');
      if(input.assigned_to!==undefined) reject(403,'Không được chỉ định người xử lý.');
    } else {
      const allowed={OPEN:['IN_PROGRESS','CLOSED'],IN_PROGRESS:['RESOLVED','CLOSED'],RESOLVED:['IN_PROGRESS','CLOSED'],CLOSED:['OPEN']};
      if(!allowed[row.status].includes(input.status)||!text(input.reason,3,300)) reject(400,'Chọn bước xử lý hợp lệ và ghi lý do 3–300 ký tự.');
    }
    const assignee=user.role==='CUSTOMER'?row.assigned_to:user.id;
    db.prepare("UPDATE support_requests SET status=?,assigned_to=?,version=version+1,updated_at=CURRENT_TIMESTAMP,closed_at=CASE WHEN ?='CLOSED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?").run(input.status,assignee,input.status,id);
    db.prepare('INSERT INTO support_history(request_id,actor_id,previous_status,status,note) VALUES(?,?,?,?,?)').run(id,user.id,row.status,input.status,user.role==='CUSTOMER'?'Khách mở lại yêu cầu':input.reason.trim());
    audit(db,user,'SUPPORT_STATUS','SUPPORT',id,{status:input.status,assigned_to:assignee});
    return {status:200,message:'Đã cập nhật yêu cầu hỗ trợ.'};
  });
}
module.exports={rateLimit,issuePasswordReset,resetPassword,addresses,saveAddress,changeAddress,listSupport,supportDetail,createSupport,replySupport,changeSupport};
