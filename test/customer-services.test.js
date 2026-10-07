const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,hashPassword,verifyPassword}=require('../src/db');
const {createOrder}=require('../src/orders');
const services=require('../src/customer-services');
function fixture() {
  const db=openDatabase(':memory:');
  db.prepare("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com',?,'CUSTOMER')").run(hashPassword('OriginalPassword123'));
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(2,'Other','two@test.com','hash','CUSTOMER'),(3,'Staff','staff@test.com','hash','STAFF'),(4,'Admin','admin@test.com','hash','ADMIN'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,10,1)");
  return db;
}
test('Reset lưu hash token, dùng một lần, thay token cũ, tăng auth_version và không lộ bí mật trong audit',()=>{
  const db=fixture();
  try {
    assert.equal(services.issuePasswordReset(db,'missing@test.com'),null);
    const old=services.issuePasswordReset(db,' ONE@test.com '),fresh=services.issuePasswordReset(db,'one@test.com');
    assert.notEqual(db.prepare('SELECT token_hash FROM password_resets').get().token_hash,fresh.token);
    const input={password:'NewPassword12345',confirm_password:'NewPassword12345'};
    assert.equal(services.resetPassword(db,old.token,input).status,400);
    assert.equal(services.resetPassword(db,fresh.token,{...input,confirm_password:'wrong'}).status,400);
    assert.equal(services.resetPassword(db,fresh.token,input).status,200);
    assert.equal(services.resetPassword(db,fresh.token,input).status,400);
    const user=db.prepare('SELECT * FROM users WHERE id=1').get();
    assert.equal(user.auth_version,2);assert.ok(verifyPassword(input.password,user.password));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM password_resets').get().n,0);
    assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM audit_logs').all()),new RegExp(fresh.token+'|NewPassword12345'));
  } finally {db.close();}
});
test('Reset từ chối token hết hạn, tài khoản khóa và thay đổi auth_version; rate limit bền trong DB',()=>{
  const db=fixture();
  try {
    const now=Date.now(),reset=services.issuePasswordReset(db,'one@test.com',now),input={password:'NewPassword12345',confirm_password:'NewPassword12345'};
    assert.equal(services.resetPassword(db,reset.token,input,now+30*60000).status,400);
    db.exec("UPDATE users SET status='LOCKED' WHERE id=1");
    assert.equal(services.issuePasswordReset(db,'one@test.com'),null);
    assert.equal(services.resetPassword(db,reset.token,input,now).status,400);
    db.exec("UPDATE users SET status='ACTIVE',auth_version=auth_version+1 WHERE id=1");
    assert.equal(services.resetPassword(db,reset.token,input,now).status,400);
    assert.equal(services.rateLimit(db,'ip:private',2,now),true);assert.equal(services.rateLimit(db,'ip:private',2,now),true);assert.equal(services.rateLimit(db,'ip:private',2,now),false);
    assert.equal(services.rateLimit(db,'ip:private',2,now+15*60000),true);
    assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM request_limits').all()),/private/);
  } finally {db.close();}
});
test('Reset lỗi audit rollback mật khẩu và giữ token dùng được',()=>{
  const db=fixture();
  try {
    const reset=services.issuePasswordReset(db,'one@test.com'),before=db.prepare('SELECT * FROM users WHERE id=1').get();
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'reset failure'); END");
    assert.throws(()=>services.resetPassword(db,reset.token,{password:'NewPassword12345',confirm_password:'NewPassword12345'}),/reset failure/);
    assert.deepEqual(db.prepare('SELECT * FROM users WHERE id=1').get(),before);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM password_resets').get().n,1);
  } finally {db.close();}
});
test('Địa chỉ kiểm tra chủ sở hữu, default duy nhất, version, giới hạn 20 và không sửa snapshot đơn',()=>{
  const db=fixture();
  try {
    const input={label:'Home',recipient:'Customer',phone:'0901234567',address:'123 Original street'};
    const one=services.saveAddress(db,{id:1},null,input).id,two=services.saveAddress(db,{id:1},null,{...input,label:'Work'}).id;
    assert.equal(services.saveAddress(db,{id:2},one,{...input,version:'1'}).status,404);
    assert.equal(services.saveAddress(db,{id:3},null,input).status,403);
    assert.equal(services.saveAddress(db,{id:1},null,{...input,user_id:'2'}).status,403);
    assert.equal(services.changeAddress(db,{id:1},two,{version:'1'},'default').status,200);
    assert.equal(services.addresses(db,{id:1}).filter(row=>row.is_default).length,1);
    assert.equal(services.saveAddress(db,{id:1},two,{...input,version:'1'}).status,409);
    const id=createOrder(db,1,{'1':1},input.recipient,input.phone,input.address);
    assert.equal(services.saveAddress(db,{id:1},two,{...input,address:'456 New example street',version:'2'}).status,200);
    assert.equal(db.prepare('SELECT address FROM orders WHERE id=?').get(id).address,input.address);
    assert.equal(services.changeAddress(db,{id:1},two,{version:'3'},'delete').status,200);
    assert.equal(services.addresses(db,{id:1})[0].is_default,1);
    for(let n=0;n<19;n++) assert.equal(services.saveAddress(db,{id:1},null,input).status,200);
    assert.equal(services.saveAddress(db,{id:1},null,input).status,409);
    assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM audit_logs').all()),/0901234567|Original street|New example street/);
  } finally {db.close();}
});
test('Hỗ trợ kiểm tra đơn/chủ ticket; khách không thấy tin nội bộ, lịch sử nội bộ hoặc ghi nội bộ',()=>{
  const db=fixture();
  try {
    const order=createOrder(db,1,{'1':1},'Customer','0901234567','123 Example street'),input={order_id:String(order),subject:'Delivery question',content:'Public question'};
    assert.equal(services.createSupport(db,{id:2},input).status,404);
    const id=services.createSupport(db,{id:1},input).id;
    assert.throws(()=>services.supportDetail(db,{id:2},id),error=>error.status===404);
    assert.equal(services.replySupport(db,{id:1},id,{version:'1',content:'Private',internal:'1'}).status,403);
    assert.equal(services.replySupport(db,{id:3},id,{version:'1',content:'Internal-only value',internal:'1'}).status,200);
    assert.equal(services.replySupport(db,{id:3},id,{version:'1',content:'Public answer'}).status,409);
    assert.equal(services.replySupport(db,{id:3},id,{version:'2',content:'Public answer'}).status,200);
    assert.equal(services.changeSupport(db,{id:3},id,{version:'3',status:'IN_PROGRESS',reason:'Internal history note'}).status,200);
    const customer=services.supportDetail(db,{id:1},id),staff=services.supportDetail(db,{id:3},id);
    assert.equal(customer.messages.length,2);assert.equal(staff.messages.length,3);
    assert.doesNotMatch(JSON.stringify(customer),/Internal-only value|Internal history note/);
    assert.match(JSON.stringify(staff),/Internal-only value/);
    assert.equal(services.listSupport(db,{id:2}).paging.total,0);
    assert.equal(services.listSupport(db,{id:3}).paging.total,1);
  } finally {db.close();}
});
test('Hỗ trợ đóng/mở lại trong 7 ngày, chặn version cũ và rollback tin khi audit lỗi',()=>{
  const db=fixture();
  try {
    const order=createOrder(db,1,{'1':1},'Customer','0901234567','123 Example street');
    const id=services.createSupport(db,{id:1},{order_id:String(order),subject:'Help',content:'First message'}).id;
    assert.equal(services.changeSupport(db,{id:3},id,{version:'1',status:'CLOSED',reason:'Resolved question'}).status,200);
    assert.equal(services.replySupport(db,{id:1},id,{version:'2',content:'Closed message'}).status,409);
    const closed=db.prepare('SELECT * FROM support_requests').get(),time=Date.parse(closed.closed_at.replace(' ','T')+'Z');
    assert.equal(services.changeSupport(db,{id:1},id,{version:'2',status:'OPEN'},time+7*86400000+1).status,409);
    assert.equal(services.changeSupport(db,{id:1},id,{version:'2',status:'OPEN'},time+86400000).status,200);
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'support failure'); END");
    assert.throws(()=>services.replySupport(db,{id:1},id,{version:'3',content:'Must rollback'}),/support failure/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM support_messages').get().n,1);
    assert.equal(db.prepare('SELECT version FROM support_requests').get().version,3);
  } finally {db.close();}
});
test('Hội thoại vượt 100 tin phân trang đúng nội dung khách thấy, mặc định trang cuối',()=>{
  const db=fixture();
  try {
    const order=createOrder(db,1,{'1':1},'Customer','0901234567','123 Example street');
    const id=services.createSupport(db,{id:1},{order_id:String(order),subject:'Help',content:'First message'}).id;
    const insert=db.prepare('INSERT INTO support_messages(request_id,actor_id,content,internal) VALUES(?,3,?,?)');
    for(let n=0;n<105;n++) {insert.run(id,'Public '+n,0);insert.run(id,'Internal '+n,1);}
    const first=services.supportDetail(db,{id:1},id,{page:'1'}),second=services.supportDetail(db,{id:1},id,{page:'2'}),latest=services.supportDetail(db,{id:1},id);
    assert.equal(first.paging.total,106);assert.equal(first.messages.length,20);
    assert.ok(second.messages.every(row=>!first.messages.some(item=>item.id===row.id)));
    assert.ok(first.messages.every(row=>row.internal===0));
    assert.equal(latest.paging.page,6);assert.equal(latest.messages.length,6);
    assert.equal(services.supportDetail(db,{id:3},id).paging.total,211);
  } finally {db.close();}
});
