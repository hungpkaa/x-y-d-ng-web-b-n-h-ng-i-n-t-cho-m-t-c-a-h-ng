const {transaction}=require('./products');
// Lazy import avoids db -> migrations -> accounts -> db circular initialization.
const passwordTools=()=>require('./db');
function reject(status,message) { const error=new Error(message); error.status=status; throw error; }
const text=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
function actorUser(db,actor,roles=['CUSTOMER','STAFF','ADMIN']) {
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(actor?.id??0);
  if(!user||user.status!=='ACTIVE'||!roles.includes(user.role)||(actor.auth_version!==undefined&&actor.auth_version!==user.auth_version)) reject(403,'Tài khoản không có quyền hoặc phiên đã hết hiệu lực.');
  return user;
}
function fresh(user,input) { if(Number(input.version)!==user.version) reject(409,'Thông tin đã thay đổi. Hãy tải lại trang.'); }
function audit(db,actor,action,id,before,after) {
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,?,'USER',?,?,?)").run(actor.id,action,id,before?JSON.stringify(before):null,JSON.stringify(after));
}
function profileFields(input) {
  const name=typeof input.name==='string'?input.name.trim():'';
  const phone=typeof input.phone==='string'?input.phone.trim():'';
  const address=typeof input.address==='string'?input.address.trim():'';
  if(!text(name,2,80)||(phone&&!/^0\d{9}$/.test(phone))||(address&&!text(address,10,300))) reject(400,'Kiểm tra tên (2–80 ký tự), điện thoại 10 số bắt đầu 0 và địa chỉ (10–300 ký tự).');
  return {name,phone,address};
}
function saveProfile(db,actor,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor);fresh(user,input);
    if(['id','user_id','role','status','email','auth_version','password'].some(key=>input[key]!==undefined)) reject(403,'Hồ sơ chỉ được sửa tên, điện thoại và địa chỉ của chính bạn.');
    const fields=profileFields(input);
    db.prepare('UPDATE users SET name=?,phone=?,address=?,version=version+1 WHERE id=?').run(fields.name,fields.phone,fields.address,user.id);
    audit(db,user,'PROFILE_UPDATE',user.id,{version:user.version},{version:user.version+1,fields:['name','phone','address']});
    return {status:200,message:'Đã cập nhật hồ sơ.'};
  });
}
function changePassword(db,actor,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor);fresh(user,input);
    const {hashPassword,verifyPassword}=passwordTools();
    if(typeof input.current_password!=='string'||input.current_password.length>128||!verifyPassword(input.current_password,user.password)) reject(400,'Mật khẩu hiện tại không đúng.');
    if(typeof input.new_password!=='string'||input.new_password.trim().length<10||input.new_password.length>128||input.new_password!==input.confirm_password) reject(400,'Mật khẩu mới cần 10–128 ký tự và phần xác nhận phải khớp.');
    if(verifyPassword(input.new_password,user.password)) reject(400,'Hãy chọn mật khẩu mới khác mật khẩu hiện tại.');
    db.prepare('UPDATE users SET password=?,auth_version=auth_version+1,version=version+1 WHERE id=?').run(hashPassword(input.new_password),user.id);
    audit(db,user,'PASSWORD_CHANGE',user.id,{auth_version:user.auth_version},{auth_version:user.auth_version+1});
    return {status:200,message:'Đã đổi mật khẩu. Hãy đăng nhập lại.'};
  });
}
function createStaff(db,actor,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    if(input.role!==undefined||input.status!==undefined) reject(403,'Tài khoản mới chỉ được cấp vai trò nhân viên.');
    const {name,phone}=profileFields({...input,address:''});
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    if(!text(email,5,150)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof input.password!=='string'||input.password.trim().length<10||input.password.length>128) reject(400,'Email hoặc mật khẩu (10–128 ký tự) không hợp lệ.');
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) reject(409,'Email đã được sử dụng.');
    const id=Number(db.prepare("INSERT INTO users(name,email,password,role,phone) VALUES(?,?,?,'STAFF',?)").run(name,email,passwordTools().hashPassword(input.password),phone).lastInsertRowid);
    audit(db,admin,'STAFF_CREATE',id,null,{role:'STAFF',status:'ACTIVE'});
    return {status:200,message:'Đã tạo tài khoản nhân viên.',id};
  });
}
function saveStaff(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if(!user) reject(404,'Không tìm thấy tài khoản.');
    if(user.role!=='STAFF'||['role','email','status','password','auth_version'].some(key=>input[key]!==undefined)) reject(403,'Chỉ được sửa tên và điện thoại nhân viên; quyền, trạng thái và mật khẩu dùng thao tác riêng.');
    fresh(user,input);
    const {name,phone}=profileFields({...input,address:''});
    db.prepare('UPDATE users SET name=?,phone=?,version=version+1 WHERE id=?').run(name,phone,id);
    audit(db,admin,'STAFF_UPDATE',id,{version:user.version},{version:user.version+1,fields:['name','phone']});
    return {status:200,message:'Đã cập nhật nhân viên.'};
  });
}
function setAccountStatus(db,actor,id,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if(!user) reject(404,'Không tìm thấy tài khoản.');
    if(id===admin.id) reject(403,'Không thể tự khóa tài khoản quản trị đang sử dụng.');
    if(['role','email','password','auth_version'].some(key=>input[key]!==undefined)) reject(403,'Thao tác khóa/mở khóa không được thay đổi quyền hoặc thông tin đăng nhập.');
    if(!['ACTIVE','LOCKED'].includes(input.status)||!text(input.reason,3,300)) reject(400,'Chọn trạng thái hợp lệ và nhập lý do (3–300 ký tự).');
    fresh(user,input);
    if(user.role==='ADMIN'&&input.status==='LOCKED'&&db.prepare("SELECT COUNT(*) n FROM users WHERE role='ADMIN' AND status='ACTIVE'").get().n<=1) reject(409,'Phải giữ ít nhất một quản trị viên hoạt động.');
    if(user.status===input.status) return {status:200,message:'Trạng thái tài khoản đã được cập nhật trước đó.'};
    db.prepare('UPDATE users SET status=?,auth_version=auth_version+1,version=version+1 WHERE id=?').run(input.status,id);
    audit(db,admin,'ACCOUNT_STATUS',id,{status:user.status,auth_version:user.auth_version},{status:input.status,auth_version:user.auth_version+1,reason:input.reason.trim()});
    return {status:200,message:input.status==='LOCKED'?'Đã khóa tài khoản và vô hiệu hóa các phiên cũ.':'Đã mở khóa. Người dùng cần đăng nhập lại.'};
  });
}
module.exports={actorUser,reject,saveProfile,changePassword,createStaff,saveStaff,setAccountStatus};
