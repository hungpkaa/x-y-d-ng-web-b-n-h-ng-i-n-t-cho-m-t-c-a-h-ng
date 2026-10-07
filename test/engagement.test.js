const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,seed}=require('../src/db');
const service=require('../src/engagement');
const {createOrder,transitionOrder}=require('../src/orders');
const {reorderImages}=require('../src/product-images');
function fixture() {
  const db=openDatabase(':memory:',10);seed(db);
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com','hash','CUSTOMER'),(2,'Other','two@test.com','hash','CUSTOMER'),(3,'Staff','staff@test.com','hash','STAFF')");return db;
}
test('Yêu thích: idempotent, riêng từng khách, chỉ sản phẩm ACTIVE và chặn quản lý',()=>{
  const db=fixture();try {
    assert.equal(service.favorite(db,{id:1},1,'add').status,200);
    service.favorite(db,{id:1},1,'add');assert.equal(service.favorites(db,{id:1}).rows.length,1);
    assert.equal(service.favorites(db,{id:2}).rows.length,0);
    assert.equal(service.favorite(db,{id:3},1,'add').status,403);
    db.exec("UPDATE products SET status='HIDDEN' WHERE id=1");
    assert.equal(service.favorites(db,{id:1}).rows.length,0);
    assert.equal(service.favorite(db,{id:2},1,'add').status,404);
    assert.equal(service.favorite(db,{id:1},1,'remove').status,200);
  } finally {db.close();}
});
test('Đã xem: sản phẩm cuối lên đầu dù cùng giây, không trùng, không lộ sản phẩm ẩn hoặc khách khác',()=>{
  const db=fixture();try {
    for(const id of [1,2,3,1]) service.recordView(db,{id:1},id);
    assert.deepEqual(service.recent(db,{id:1}).map(row=>row.id),[1,3,2]);
    assert.equal(service.recent(db,{id:2}).length,0);
    db.exec("UPDATE products SET status='HIDDEN' WHERE id=1");
    assert.deepEqual(service.recent(db,null,[1,2,2,'x']).map(row=>row.id),[2]);
  } finally {db.close();}
});
test('Thông báo: opt-in theo SKU, có hàng/giá giảm đúng một lần, opt-out và đánh dấu đọc đúng chủ',()=>{
  const db=fixture();try {
    db.exec('UPDATE product_variants SET on_hand=0 WHERE id=1');
    assert.equal(service.watch(db,{id:1},1,{stock_enabled:'1',price_enabled:'1'}).status,200);
    db.exec('UPDATE product_variants SET on_hand=3,price=price-1000,version=version+1 WHERE id=1');
    service.scan(db);service.scan(db);
    const rows=service.notifications(db,{id:1}).rows;assert.equal(rows.length,2);
    assert.equal(service.notifications(db,{id:2}).rows.length,0);
    assert.equal(service.markRead(db,{id:2},rows[0].id).status,404);
    assert.equal(service.markRead(db,{id:1},rows[0].id).status,200);
    service.watch(db,{id:1},1,{stock_enabled:'0',price_enabled:'0'});
    db.exec('UPDATE product_variants SET price=price-1000,version=version+1 WHERE id=1');service.scan(db);
    assert.equal(service.notifications(db,{id:1}).rows.length,2);
  } finally {db.close();}
});
test('Thông báo đơn: lưu cursor chống trùng, tắt tiến trình và tài khoản khóa không nhận mới',()=>{
  const db=fixture();try {
    const id=createOrder(db,1,{'1':1},'Customer','0901234567','123 Test Street');service.scan(db);service.scan(db);
    assert.equal(service.notifications(db,{id:1}).rows.length,1);
    const pref=service.preferences(db,1);
    service.savePreferences(db,{id:1},{version:String(pref.version),orders_enabled:'0'});
    transitionOrder(db,id,'CONFIRMED',3,{version:'1',reason:'Confirmed order'});service.scan(db);
    assert.equal(service.notifications(db,{id:1}).rows.length,1);
    assert.equal(service.savePreferences(db,{id:1},{version:String(pref.version),orders_enabled:'1'}).status,409);
    const current=service.preferences(db,1);
    service.savePreferences(db,{id:1},{version:String(current.version),orders_enabled:'1'});
    db.exec("UPDATE users SET status='LOCKED' WHERE id=1");
    transitionOrder(db,id,'PREPARING',3,{version:'2',reason:'Prepare order'});service.scan(db);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=1').get().n,1);
  } finally {db.close();}
});
test('Sắp xếp ảnh: danh sách đủ/unique/đúng sản phẩm, cover, version và rollback khi lỗi audit',()=>{
  const db=fixture();try {
    const insert=db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)');
    insert.run(1,'a',Buffer.from('a'),'First',0);insert.run(1,'b',Buffer.from('b'),'Second',1);insert.run(2,'c',Buffer.from('c'),'Other',0);
    assert.equal(reorderImages(db,{id:3,role:'STAFF'},1,{version:'1',ids:[2,1]}).status,200);
    assert.equal(db.prepare('SELECT id FROM product_images WHERE product_id=1 ORDER BY sort_order,id LIMIT 1').get().id,2);
    assert.equal(reorderImages(db,{id:3,role:'STAFF'},1,{version:'1',ids:[1,2]}).status,409);
    assert.equal(reorderImages(db,{id:3,role:'STAFF'},1,{version:'2',ids:[1,3]}).status,400);
    assert.equal(reorderImages(db,{id:1,role:'CUSTOMER'},1,{version:'2',ids:[1,2]}).status,403);
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'image rollback'); END");
    assert.throws(()=>reorderImages(db,{id:3,role:'STAFF'},1,{version:'2',ids:[1,2]}),/image rollback/);
    assert.equal(db.prepare('SELECT id FROM product_images WHERE product_id=1 ORDER BY sort_order,id LIMIT 1').get().id,2);
  } finally {db.close();}
});
