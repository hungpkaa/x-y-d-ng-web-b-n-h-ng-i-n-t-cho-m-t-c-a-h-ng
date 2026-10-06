const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, hashPassword, verifyPassword } = require('../src/db');
const { createOrder, transitionOrder:transition,recordCodReceipt } = require('../src/orders');
function transitionOrder(db,id,status,actorId) {
  const result=transition(db,id,status,actorId,{version:db.prepare('SELECT version FROM orders WHERE id=?').get(id).version,reason:'Test operation'});
  if(result.status!==200) throw new Error(result.message);
  return result;
}
function fixture() {
  const db=openDatabase(':memory:');
  db.prepare('INSERT INTO users(id,name,email,password) VALUES(1,?,?,?)').run('Khách','test@example.com','test');
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(2,'Admin','admin@test.com','test','ADMIN')");
  db.prepare('INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,?,?,?,?,?,?)').run('Phone','Điện thoại','Brand','Demo',100000,1);
  db.prepare("INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE-1',100000,1,1)").run();
  return db;
}
test('Mật khẩu được băm và kiểm tra đúng',()=>{
  const encoded=hashPassword('test-password-123');
  assert.notEqual(encoded,'test-password-123');
  assert.ok(verifyPassword('test-password-123',encoded));
  assert.equal(verifyPassword('wrong-password',encoded),false);
});
test('Đơn lưu giá lúc mua; không bán vượt tồn; lỗi rollback toàn bộ',()=>{
  const db=fixture();
  try {
    const id=createOrder(db,1,{'1':1},'Khách','0901234567','Địa chỉ nhận hàng');
    assert.equal(db.prepare('SELECT on_hand-reserved AS stock FROM product_variants WHERE id=1').get().stock,0);
    assert.throws(()=>createOrder(db,1,{'1':1},'Khách','0901234567','Địa chỉ nhận hàng'));
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,1);
    db.prepare('UPDATE product_variants SET price=200000 WHERE id=1').run();
    assert.equal(db.prepare('SELECT total FROM orders WHERE id=?').get(id).total,100000);
    assert.equal(db.prepare('SELECT price FROM order_items WHERE order_id=?').get(id).price,100000);
  } finally { db.close(); }
});
test('Hủy hoàn tồn đúng một lần; trạng thái sai bị từ chối',()=>{
  const db=fixture();
  try {
    const id=createOrder(db,1,{'1':1},'Khách','0901234567','Địa chỉ nhận hàng');
    assert.throws(()=>transitionOrder(db,id,'DELIVERED',1));
    transitionOrder(db,id,'CANCELLED',1);
    assert.equal(db.prepare('SELECT on_hand-reserved AS stock FROM product_variants WHERE id=1').get().stock,1);
    assert.equal(transitionOrder(db,id,'CANCELLED',1).status,200);
    assert.equal(db.prepare('SELECT on_hand-reserved AS stock FROM product_variants WHERE id=1').get().stock,1);
  } finally { db.close(); }
});
test('Giao thành công không tự ghi đã thu; ADMIN đối soát đủ tiền COD mới ghi PAID',()=>{
  const db=fixture();
  try {
    const id=createOrder(db,1,{'1':1},'Khách','0901234567','Địa chỉ nhận hàng');
    for(const status of ['CONFIRMED','PREPARING','SHIPPING']) transitionOrder(db,id,status,2);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'UNPAID');
    transitionOrder(db,id,'DELIVERED',2);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'UNPAID');
    assert.equal(recordCodReceipt(db,id,{id:2},{version:'5',amount:'100000',reference:'COD-TEST-1',note:'Collected in full'}).status,200);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'PAID');
  } finally { db.close(); }
});
test('Số lượng lỗi không tạo đơn hoặc làm thay đổi tồn',()=>{
  const db=fixture();
  try {
    for(const quantity of [-1,0,1.5,100]) assert.throws(()=>createOrder(db,1,{'1':quantity},'Khách','0901234567','Địa chỉ nhận hàng'));
    assert.equal(db.prepare('SELECT on_hand-reserved AS stock FROM product_variants WHERE id=1').get().stock,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,0);
  } finally { db.close(); }
});
