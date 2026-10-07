const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {migrate}=require('../src/migrations');
test('Migration v5 giữ tài khoản, đơn, tiền đã thu, phiên và khóa đặt hàng; bổ sung snapshot phí 0 cho dữ liệu cũ',()=>{
  const db=openDatabase(':memory:',4);
  try {
    db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','c@test.com','salt:hash','CUSTOMER'); INSERT INTO orders(id,user_id,recipient,phone,address,total,status,payment_status) VALUES(1,1,'Old recipient','0901234567','Original address',123000,'DELIVERED','PAID'); INSERT INTO sessions(sid,data,expires_at) VALUES('existing','{\"userId\":1,\"cart\":{\"1\":2}}',9999999999999); INSERT INTO checkout_requests(user_id,request_key,quote_json,expires_at,payload_hash,order_id) VALUES(1,'old-key','[[1,1,123000]]',100,'original-hash',1)");
    const beforeSession=db.prepare('SELECT data FROM sessions').get().data;
    migrate(db, ':memory:', 5);migrate(db, ':memory:', 5);
    const user=db.prepare('SELECT * FROM users').get(),order=db.prepare('SELECT * FROM orders').get(),request=db.prepare('SELECT * FROM checkout_requests').get();
    assert.equal(user.password,'salt:hash');assert.equal(user.role,'CUSTOMER');assert.equal(user.auth_version,1);assert.equal(user.status,'ACTIVE');
    assert.equal(order.total,123000);assert.equal(order.subtotal,123000);assert.equal(order.shipping_fee,0);assert.equal(order.payment_status,'PAID');assert.equal(order.address,'Original address');
    assert.equal(db.prepare('SELECT data FROM sessions').get().data,beforeSession);
    assert.equal(request.order_id,1);assert.equal(request.payload_hash,'original-hash');assert.equal(request.shipping_fee,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,5);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM shipping_policy').get().n,1);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {db.close();}
});
