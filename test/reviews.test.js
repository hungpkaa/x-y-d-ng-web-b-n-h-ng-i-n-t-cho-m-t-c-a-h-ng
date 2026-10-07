const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {createOrder,transitionOrder}=require('../src/orders');
const {saveReview,moderateReview,publicReviews}=require('../src/reviews');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com','test','CUSTOMER'),(2,'Other','two@test.com','test','CUSTOMER'),(3,'Staff','staff@test.com','test','STAFF'),(4,'Admin','admin@test.com','test','ADMIN'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,10,1)");
  return db;
}
function order(db,user=1,delivered=true) {
  const id=createOrder(db,user,{'1':1},'Customer','0901234567','123 Example street');
  if(delivered) for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) {
    const version=db.prepare('SELECT version FROM orders WHERE id=?').get(id).version;
    assert.equal(transitionOrder(db,id,status,3,{version:String(version),reason:'Delivery for review'}).status,200);
  }
  return db.prepare('SELECT id FROM order_items WHERE order_id=?').get(id).id;
}
const input={version:'0',rating:'5',content:'Verified purchase'};
test('Chỉ chủ dòng đơn đã giao được đánh giá; mỗi dòng một đánh giá, chặn trường giả và version cũ',()=>{
  const db=fixture();
  try {
    const pending=order(db,1,false),item=order(db);
    assert.equal(saveReview(db,{id:1},pending,input).status,409);
    assert.equal(saveReview(db,{id:2},item,input).status,404);
    assert.equal(saveReview(db,{id:3},item,input).status,403);
    assert.equal(saveReview(db,{id:1},item,{...input,status:'APPROVED'}).status,403);
    assert.equal(saveReview(db,{id:1},item,{...input,rating:'6'}).status,400);
    assert.equal(saveReview(db,{id:1},item,{...input,content:' '}).status,400);
    assert.equal(saveReview(db,{id:1},item,input).status,200);
    assert.equal(saveReview(db,{id:1},item,input).status,409);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM reviews').get().n,1);
    assert.equal(publicReviews(db,1).summary.count,0);
  } finally {db.close();}
});
test('Chỉ ADMIN duyệt, không sửa sao/nội dung; điểm trung bình chỉ tính công khai, sửa cần duyệt lại',()=>{
  const db=fixture();
  try {
    const items=[order(db),order(db,2)];
    items.forEach((item,index)=>assert.equal(saveReview(db,{id:index+1},item,{...input,rating:index?'1':'5'}).status,200));
    const reviews=db.prepare('SELECT * FROM reviews ORDER BY id').all();
    const decision={version:'1',status:'APPROVED',reason:''};
    assert.equal(moderateReview(db,{id:3},reviews[0].id,decision).status,403);
    assert.equal(moderateReview(db,{id:4},reviews[0].id,{...decision,rating:'4'}).status,403);
    assert.equal(moderateReview(db,{id:4},reviews[0].id,{...decision,status:'HIDDEN'}).status,400);
    reviews.forEach(review=>assert.equal(moderateReview(db,{id:4},review.id,decision).status,200));
    assert.equal(publicReviews(db,1).summary.average,3);
    assert.equal(publicReviews(db,1).summary.count,2);
    assert.equal(moderateReview(db,{id:4},reviews[0].id,decision).status,409);
    assert.equal(moderateReview(db,{id:4},reviews[1].id,{version:'2',status:'HIDDEN',reason:'Moderation reason'}).status,200);
    assert.equal(publicReviews(db,1).summary.average,5);
    assert.equal(saveReview(db,{id:1},items[0],{version:'2',rating:'4',content:'Updated purchase review'}).status,200);
    assert.equal(publicReviews(db,1).summary.count,0);
    const changed=db.prepare('SELECT * FROM reviews WHERE id=?').get(reviews[0].id);
    assert.equal(changed.status,'PENDING');assert.equal(changed.moderator_id,null);
    db.exec("UPDATE products SET status='HIDDEN'");
    assert.equal(publicReviews(db,1).summary.count,0);
  } finally {db.close();}
});
test('Lỗi audit rollback nội dung gửi và quyết định kiểm duyệt',()=>{
  const db=fixture();
  try {
    const item=order(db);
    db.exec("CREATE TRIGGER fail_review BEFORE INSERT ON audit_logs WHEN NEW.entity_type='REVIEW' BEGIN SELECT RAISE(ABORT,'forced review failure'); END");
    assert.throws(()=>saveReview(db,{id:1},item,input),/forced review failure/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM reviews').get().n,0);
    db.exec('DROP TRIGGER fail_review');
    assert.equal(saveReview(db,{id:1},item,input).status,200);
    const review=db.prepare('SELECT * FROM reviews').get();
    db.exec("CREATE TRIGGER fail_review BEFORE INSERT ON audit_logs WHEN NEW.entity_type='REVIEW' BEGIN SELECT RAISE(ABORT,'forced review failure'); END");
    assert.throws(()=>moderateReview(db,{id:4},review.id,{version:'1',status:'APPROVED',reason:''}),/forced review failure/);
    assert.deepEqual(db.prepare('SELECT * FROM reviews').get(),review);
    assert.equal(publicReviews(db,1).summary.count,0);
  } finally {db.close();}
});
