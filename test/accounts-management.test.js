const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,hashPassword,verifyPassword}=require('../src/db');
const {saveProfile,changePassword,createStaff,saveStaff,setAccountStatus}=require('../src/accounts');
const {createOrder,transitionOrder,recordCodReceipt}=require('../src/orders');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {saveShippingPolicy}=require('../src/shipping');
const {listRecords}=require('../src/management-list');
const admin={id:1,role:'ADMIN'},staff={id:2,role:'STAFF'},customer={id:3,role:'CUSTOMER'};
function fixture() {
  const db=openDatabase(':memory:');
  const password=hashPassword('old-password-123');
  const insert=db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)');
  for(const [id,role] of [[1,'ADMIN'],[2,'STAFF'],[3,'CUSTOMER'],[4,'CUSTOMER']]) insert.run(id,role,`${id}@test.com`,password,role);
  db.exec("INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100000,10,1)");
  return db;
}
const user=(db,id)=>db.prepare('SELECT * FROM users WHERE id=?').get(id);
const order=(db,id)=>db.prepare('SELECT * FROM orders WHERE id=?').get(id);
const makeOrder=(db,id=3)=>createOrder(db,id,{'1':1},'Old recipient','0901234567','Original address');
const move=(db,id,status,actor=staff,version=order(db,id).version)=>transitionOrder(db,id,status,actor,{version,reason:'Confirmed request'});
test('Hồ sơ chỉ sửa chính mình, email/quyền bất biến; mật khẩu cần mật khẩu cũ và vô hiệu phiên, audit không chứa mật khẩu',()=>{
  const db=fixture();
  try {
    const id=makeOrder(db),fields={version:'1',name:'New name',phone:'0901234567',address:'New default address'};
    assert.equal(saveProfile(db,customer,{...fields,user_id:'4'}).status,403);
    assert.equal(saveProfile(db,customer,{...fields,role:'ADMIN'}).status,403);
    assert.equal(saveProfile(db,customer,{...fields,email:'changed@test.com'}).status,403);
    assert.equal(saveProfile(db,customer,{...fields,phone:'bad'}).status,400);
    assert.equal(saveProfile(db,customer,fields).status,200);
    assert.equal(saveProfile(db,customer,fields).status,409);
    assert.equal(user(db,3).name,'New name');assert.equal(user(db,4).name,'CUSTOMER');
    assert.equal(order(db,id).address,'Original address');
    const passwordInput={version:'2',current_password:'wrong',new_password:'new-password-123',confirm_password:'new-password-123'};
    assert.equal(changePassword(db,customer,passwordInput).status,400);
    assert.equal(changePassword(db,customer,{...passwordInput,current_password:'old-password-123',confirm_password:'mismatch'}).status,400);
    assert.equal(changePassword(db,customer,{...passwordInput,current_password:'old-password-123'}).status,200);
    assert.ok(verifyPassword('new-password-123',user(db,3).password));assert.equal(user(db,3).auth_version,2);
    assert.equal(saveProfile(db,{...customer,auth_version:1},{...fields,version:'3'}).status,403);
    const audit=JSON.stringify(db.prepare('SELECT before_json,after_json FROM audit_logs').all());
    assert.ok(!audit.includes('old-password-123')&&!audit.includes('new-password-123')&&!audit.includes(user(db,3).password));
  } finally {db.close();}
});
test('ADMIN tạo/sửa nhân viên, khóa/mở khóa tăng auth_version; chặn vượt quyền, trùng email và tự khóa',()=>{
  const db=fixture();
  try {
    const fields={name:'New staff',email:' STAFF@TEST.COM ',password:'staff-password-123',phone:''};
    assert.equal(createStaff(db,staff,fields).status,403);
    assert.equal(createStaff(db,admin,{...fields,role:'ADMIN'}).status,403);
    const created=createStaff(db,admin,fields);assert.equal(created.status,200);
    assert.equal(user(db,created.id).role,'STAFF');assert.equal(user(db,created.id).email,'staff@test.com');
    assert.equal(createStaff(db,admin,fields).status,409);
    assert.equal(saveStaff(db,staff,created.id,{version:1,name:'Changed'}).status,403);
    assert.equal(saveStaff(db,admin,created.id,{version:1,name:'Changed',role:'ADMIN'}).status,403);
    assert.equal(saveStaff(db,admin,3,{version:1,name:'Changed'}).status,403);
    assert.equal(saveStaff(db,admin,created.id,{version:1,name:'Changed',phone:'0901234567'}).status,200);
    assert.equal(setAccountStatus(db,admin,1,{version:1,status:'LOCKED',reason:'Testing self lock'}).status,403);
    assert.equal(setAccountStatus(db,staff,3,{version:1,status:'LOCKED',reason:'Blocked'}).status,403);
    assert.equal(setAccountStatus(db,admin,3,{version:1,status:'LOCKED',reason:'Requested lock',role:'ADMIN'}).status,403);
    assert.equal(setAccountStatus(db,admin,3,{version:1,status:'LOCKED',reason:''}).status,400);
    assert.equal(setAccountStatus(db,admin,3,{version:1,status:'LOCKED',reason:'Requested lock'}).status,200);
    assert.equal(user(db,3).auth_version,2);
    assert.equal(saveProfile(db,customer,{version:2,name:'Changed'}).status,403);
    assert.equal(setAccountStatus(db,admin,3,{version:1,status:'ACTIVE',reason:'Requested unlock'}).status,409);
    assert.equal(setAccountStatus(db,admin,3,{version:2,status:'ACTIVE',reason:'Requested unlock'}).status,200);
    assert.equal(user(db,3).auth_version,3);
    assert.equal(saveProfile(db,{...customer,auth_version:1},{version:3,name:'Changed'}).status,403);
    assert.equal(user(db,3).role,'CUSTOMER');
  } finally {db.close();}
});
test('Khách chỉ hủy PENDING của mình; hủy lặp không hoàn tồn lần hai; version cũ và nhảy bước bị chặn',()=>{
  const db=fixture();
  try {
    const first=makeOrder(db),second=makeOrder(db,4);
    assert.equal(move(db,second,'CANCELLED',customer).status,404);
    assert.equal(move(db,first,'CONFIRMED',customer).status,403);
    assert.equal(move(db,first,'CANCELLED',customer).status,200);
    assert.equal(move(db,first,'CANCELLED',customer,1).status,200);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'cancelled:%'").get().n,1);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,1);
    assert.equal(move(db,second,'DELIVERED').status,409);
    assert.equal(move(db,second,'CONFIRMED').status,200);
    assert.equal(move(db,second,'PREPARING',staff,1).status,409);
    assert.equal(move(db,second,'CANCELLED',{id:4,role:'CUSTOMER'}).status,409);
    assert.equal(move(db,second,'CANCELLED').status,200);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
    assert.equal(db.prepare('SELECT note FROM order_history WHERE order_id=? ORDER BY id DESC').get(second).note,'Confirmed request');
    const third=makeOrder(db);db.prepare("UPDATE orders SET payment_method='ONLINE' WHERE id=?").run(third);
    assert.equal(move(db,third,'CONFIRMED').status,409);
    db.prepare("UPDATE orders SET payment_status='PAID' WHERE id=?").run(third);
    assert.equal(move(db,third,'CANCELLED',customer).status,200);
    assert.equal(order(db,third).payment_status,'REFUND_PENDING');
  } finally {db.close();}
});
test('Lỗi ghi lịch sử hủy rollback cả trạng thái, reservation, kho và audit',()=>{
  const db=fixture();
  try {
    const id=makeOrder(db);
    db.exec("CREATE TRIGGER fail_cancel BEFORE INSERT ON order_history WHEN NEW.status='CANCELLED' BEGIN SELECT RAISE(ABORT,'forced failure'); END");
    assert.throws(()=>move(db,id,'CANCELLED',customer));
    assert.equal(order(db,id).status,'PENDING');assert.equal(order(db,id).version,1);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,1);
    assert.equal(db.prepare('SELECT status FROM inventory_reservations').get().status,'HELD');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_logs').get().n,0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'cancelled:%'").get().n,0);
  } finally {db.close();}
});
test('Phí do ADMIN cấu hình và snapshot; báo giá phí cũ phải xác nhận lại, retry giữ tổng cũ',()=>{
  const db=fixture();
  try {
    const key=issueCheckout(db,3,{'1':1}),fields={version:'1',fee:'30000',reason:'Updated delivery cost'};
    assert.equal(saveShippingPolicy(db,staff,fields).status,403);
    assert.equal(saveShippingPolicy(db,admin,{...fields,fee:'-1'}).status,400);
    assert.equal(saveShippingPolicy(db,admin,fields).status,200);
    assert.equal(saveShippingPolicy(db,admin,fields).status,409);
    assert.throws(()=>submitCheckout(db,3,key,{'1':1},'Customer','0901234567','Test address'));
    const fresh=issueCheckout(db,3,{'1':1}),result=submitCheckout(db,3,fresh,{'1':1},'Customer','0901234567','Test address');
    assert.equal(order(db,result.id).subtotal,100000);assert.equal(order(db,result.id).shipping_fee,30000);assert.equal(order(db,result.id).total,130000);
    saveShippingPolicy(db,admin,{version:'2',fee:'50000',reason:'Changed delivery cost'});
    assert.equal(submitCheckout(db,3,fresh,{},'Customer','0901234567','Test address').id,result.id);
    assert.equal(order(db,result.id).total,130000);
  } finally {db.close();}
});
test('COD chỉ ADMIN ghi đủ tiền sau giao, chống trùng chứng từ và rollback khi lưu lỗi',()=>{
  const db=fixture();
  try {
    const id=makeOrder(db),receipt={version:1,amount:'100000',reference:'COD-ONE',note:'Bank reconciliation'};
    assert.equal(recordCodReceipt(db,id,staff,receipt).status,403);
    assert.equal(recordCodReceipt(db,id,admin,receipt).status,409);
    for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) assert.equal(move(db,id,status).status,200);
    assert.equal(order(db,id).payment_status,'UNPAID');
    assert.equal(recordCodReceipt(db,id,admin,{...receipt,version:5,amount:'99999'}).status,400);
    db.exec("CREATE TRIGGER fail_cod BEFORE UPDATE OF payment_status ON orders WHEN NEW.payment_status='PAID' BEGIN SELECT RAISE(ABORT,'forced failure'); END");
    assert.throws(()=>recordCodReceipt(db,id,admin,{...receipt,version:5}));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cod_receipts').get().n,0);assert.equal(order(db,id).payment_status,'UNPAID');
    db.exec('DROP TRIGGER fail_cod');
    assert.equal(recordCodReceipt(db,id,admin,{...receipt,version:5}).status,200);
    assert.equal(recordCodReceipt(db,id,admin,{...receipt,version:5}).status,200);
    assert.equal(recordCodReceipt(db,id,admin,{...receipt,version:6,reference:'COD-OTHER'}).status,409);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cod_receipts').get().n,1);
    const second=makeOrder(db);for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) move(db,second,status);
    assert.equal(recordCodReceipt(db,second,admin,{...receipt,version:5}).status,409);
  } finally {db.close();}
});
test('Danh sách tài khoản/đơn vượt 100 bản ghi, phân trang không trùng, giữ lọc và giới hạn đơn theo chủ',()=>{
  const db=fixture();
  try {
    const insert=db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,'test','CUSTOMER')");
    for(let i=0;i<105;i++) insert.run('Example '+i,`${i}@example.com`);
    let first=listRecords(db,'accounts',{q:'Example'}),second=listRecords(db,'accounts',{q:'Example',page:'2'});
    assert.equal(first.paging.total,105);assert.equal(first.rows.length,20);assert.equal(second.rows.length,20);
    assert.equal(first.rows.filter(row=>second.rows.some(next=>row.id===next.id)).length,0);
    assert.ok(first.paging.next.includes('q=Example'));
    const orders=db.prepare('INSERT INTO orders(user_id,recipient,phone,address,total,subtotal,created_at) VALUES(?,?,?,?,?,?,?)');
    for(let i=0;i<105;i++) orders.run(i%2?3:4,'Example '+i,'0901234567','Address here',100,100,'2026-10-06 12:00:00');
    first=listRecords(db,'orders',{from:'2026-10-06',to:'2026-10-06'},3);
    assert.equal(first.paging.total,52);assert.ok(first.rows.every(row=>row.user_id===3));
    assert.ok(first.paging.next.includes('from=2026-10-06'));
    assert.equal(listRecords(db,'orders',{from:'2026-02-30'}).status,400);
    assert.equal(listRecords(db,'accounts',{role:'HACK'}).status,400);
    assert.equal(listRecords(db,'orders',{status:'BAD'}).status,400);
    assert.equal(listRecords(db,'orders',{page:'-1'}).status,400);
    assert.equal(listRecords(db,'orders',{from:'2026-10-06',to:'2026-10-05'}).status,400);
  } finally {db.close();}
});
