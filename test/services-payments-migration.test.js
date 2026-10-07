const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {migrate}=require('../src/migrations');
test('Migration v7/v8 giữ dữ liệu cũ, chuyển địa chỉ hợp lệ và chứng từ COD thật, không giả bằng chứng legacy',()=>{
  const db=openDatabase(':memory:',6);
  try {
    db.exec("INSERT INTO users(id,name,email,password,phone,address) VALUES(1,'Customer','one@test.com','original-hash','0901234567','123 Original street'); INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal,shipping_fee,status,payment_status) VALUES(1,1,'Original','0901234567','Original order address',1100,1000,100,'DELIVERED','PAID'),(2,1,'Legacy','0901234567','Original legacy address',1000,1000,0,'DELIVERED','PAID'); INSERT INTO order_history(order_id,actor_id,status,previous_status,note,created_at) VALUES(1,1,'DELIVERED','SHIPPING','Original note','2026-10-06 12:00:00'); INSERT INTO cod_receipts(order_id,actor_id,amount,reference,note,created_at) VALUES(1,1,1100,'EXISTING-COD','Real existing evidence','2026-10-07 12:00:00'); INSERT INTO sessions VALUES('sid','{}',9999999999999); INSERT INTO checkout_requests(user_id,request_key,quote_json,expires_at,payload_hash,order_id) VALUES(1,'old-key','[]',9999999999999,'original-hash',1)");
    const before={user:db.prepare('SELECT * FROM users').get(),orders:db.prepare('SELECT * FROM orders ORDER BY id').all(),history:db.prepare('SELECT * FROM order_history').get(),receipt:db.prepare('SELECT * FROM cod_receipts').get(),session:db.prepare('SELECT * FROM sessions').get(),request:db.prepare('SELECT * FROM checkout_requests').get()};
    migrate(db,':memory:',8);
    assert.deepEqual(db.prepare('SELECT * FROM users').get(),before.user);
    for(const [index,row] of before.orders.entries()) {const current=db.prepare('SELECT * FROM orders WHERE id=?').get(index+1);for(const key of Object.keys(row)) assert.equal(current[key],row[key]);}
    for(const key of Object.keys(before.history)) assert.equal(db.prepare('SELECT * FROM order_history').get()[key],before.history[key]);
    assert.deepEqual(db.prepare('SELECT * FROM cod_receipts').get(),before.receipt);
    assert.deepEqual(db.prepare('SELECT * FROM sessions').get(),before.session);
    for(const key of Object.keys(before.request)) assert.equal(db.prepare('SELECT * FROM checkout_requests').get()[key],before.request[key]);
    const address=db.prepare('SELECT * FROM addresses').get();assert.equal(address.address,before.user.address);assert.equal(address.is_default,1);
    const payment=db.prepare('SELECT * FROM payments').get();assert.equal(payment.evidence_ref,'EXISTING-COD');assert.equal(payment.amount,1100);assert.equal(payment.occurred_at,'2026-10-07 12:00:00');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id=2').get().n,0);
    assert.equal(db.prepare('SELECT recognition_at FROM orders WHERE id=2').get().recognition_at,null);
    assert.equal(db.prepare('SELECT recognition_at FROM orders WHERE id=1').get().recognition_at,'2026-10-07 12:00:00');
    migrate(db,':memory:',8);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM addresses').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,8);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();}
});
test('Lỗi migration v8 rollback v7 cùng giao dịch và giữ nguyên order_history cũ',()=>{
  const db=openDatabase(':memory:',6);
  try {
    db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','one@test.com','hash'); INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal) VALUES(1,1,'Customer','0901234567','Original street',1000,1000); INSERT INTO order_history(order_id,actor_id,status) VALUES(1,1,'PENDING'); CREATE TABLE payment_events(id INTEGER PRIMARY KEY)");
    const history=db.prepare('SELECT * FROM order_history').all();
    assert.throws(()=>migrate(db,':memory:',8),/already exists/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,6);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('addresses','payments','password_resets','support_requests')").get().n,0);
    assert.deepEqual(db.prepare('SELECT * FROM order_history').all(),history);
    assert.equal(db.prepare('PRAGMA table_info(orders)').all().some(row=>row.name==='payment_deadline'),false);
    db.exec('DROP TABLE payment_events');migrate(db,':memory:',8);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,8);
  } finally {db.close();}
});
