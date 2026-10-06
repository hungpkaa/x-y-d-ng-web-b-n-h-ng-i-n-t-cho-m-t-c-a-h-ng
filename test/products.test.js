const { test }=require('node:test');
const assert=require('node:assert/strict');
const { openDatabase }=require('../src/db');
const { saveProduct,saveVariant,priceVariant,adjustStock,publishProduct }=require('../src/products');
const { createOrder,transitionOrder:transition }=require('../src/orders');
function transitionOrder(db,id,status,actorId) {
  const result=transition(db,id,status,actorId,{version:db.prepare('SELECT version FROM orders WHERE id=?').get(id).version,reason:'Test operation'});
  if(result.status!==200) throw new Error(result.message);
  return result;
}
const { migrate }=require('../src/migrations');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Admin','admin@test.com','test','ADMIN'),(2,'Staff','staff@test.com','test','STAFF'),(3,'Customer','customer@test.com','test','CUSTOMER'); INSERT INTO categories(name,slug) VALUES('Phone','phone'); INSERT INTO brands(name,slug) VALUES('Demo','demo');");
  const admin={id:1,role:'ADMIN'},staff={id:2,role:'STAFF'};
  const input={name:'Phone',category:'Phone',brand:'Demo',description:'Description'};
  const productId=saveProduct(db,staff,input).id;
  db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text) VALUES(?,?,?,?)').run(productId,'fixture.webp',Buffer.from('52494646240000005745425056503820180000003001009d012a0100010001402625a400037000fefcf40000','hex'),'Fixture');
  const variantId=saveVariant(db,staff,productId,{sku:'PHONE-BLACK-128',color:'Black',configuration:'128GB'}).id;
  return {db,admin,staff,input,productId,variantId};
}
const variant=(db,id)=>db.prepare('SELECT * FROM product_variants WHERE id=?').get(id);
const product=(db,id)=>db.prepare('SELECT * FROM products WHERE id=?').get(id);
test('STAFF tạo bản nháp/SKU không giá; chỉ ADMIN định giá và công bố; version cũ bị chặn',()=>{
  const {db,admin,staff,input,productId,variantId}=fixture();
  try {
    assert.equal(product(db,productId).status,'DRAFT'); assert.equal(variant(db,variantId).price,null);
    assert.equal(saveProduct(db,staff,{...input,price:'100'}).status,403);
    assert.equal(saveVariant(db,staff,productId,{sku:'BYPASS',price:'100',active:'1'}).status,403);
    assert.equal(priceVariant(db,staff,variantId,{price:'100',active:'1',version:'1'}).status,403);
    assert.equal(publishProduct(db,staff,productId,{status:'ACTIVE',version:'1'}).status,403);
    assert.equal(publishProduct(db,admin,productId,{status:'ACTIVE',version:'1'}).status,400);
    assert.equal(priceVariant(db,admin,variantId,{price:'100000',active:'1',version:'1'}).status,200);
    assert.equal(priceVariant(db,admin,variantId,{price:'200000',active:'1',version:'1'}).status,409);
    assert.equal(publishProduct(db,admin,productId,{status:'ACTIVE',version:'1'}).status,200);
    assert.equal(saveProduct(db,staff,{...input,id:productId,version:'1'}).status,409);
    assert.equal(priceVariant(db,admin,variantId,{price:'100000',active:'0',version:'2'}).status,409);
    assert.equal(saveVariant(db,staff,productId,{sku:'PHONE-BLACK-128'}).status,409);
    assert.equal(saveVariant(db,{role:'CUSTOMER'},productId,{sku:'NO'}).status,403);
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n>=4);
  } finally {db.close();}
});
test('SKU giữ giá/cấu hình lúc mua; kho giữ, hủy và bàn giao nguyên tử; không giảm hàng đã giữ',()=>{
  const {db,admin,staff,productId,variantId}=fixture();
  try {
    priceVariant(db,admin,variantId,{price:'100000',active:'1',version:'1'});
    adjustStock(db,staff,variantId,{delta:'2',reason:'Opening stock',version:'2'});
    publishProduct(db,admin,productId,{status:'ACTIVE',version:'1'});
    const first=createOrder(db,3,{[variantId]:1},'Customer','0901234567','Test address');
    assert.equal(variant(db,variantId).on_hand,2); assert.equal(variant(db,variantId).reserved,1);
    assert.equal(adjustStock(db,staff,variantId,{delta:'-2',reason:'Invalid adjustment',version:variant(db,variantId).version}).status,400);
    assert.equal(saveVariant(db,staff,productId,{id:variantId,sku:'RENAMED',version:variant(db,variantId).version}).status,409);
    priceVariant(db,admin,variantId,{price:'200000',active:'1',version:variant(db,variantId).version});
    saveVariant(db,staff,productId,{id:variantId,sku:'PHONE-BLACK-128',color:'White',configuration:'256GB',version:variant(db,variantId).version});
    const snapshot=db.prepare('SELECT * FROM order_items WHERE order_id=?').get(first);
    assert.equal(snapshot.price,100000); assert.equal(snapshot.configuration_snapshot,'Black · 128GB');
    transitionOrder(db,first,'CANCELLED',2);
    assert.equal(variant(db,variantId).reserved,0); assert.equal(variant(db,variantId).on_hand,2);
    assert.equal(transitionOrder(db,first,'CANCELLED',2).status,200);
    const second=createOrder(db,3,{[variantId]:2},'Customer','0901234567','Test address');
    for(const status of ['CONFIRMED','PREPARING','SHIPPING']) transitionOrder(db,second,status,2);
    assert.equal(variant(db,variantId).on_hand,0); assert.equal(variant(db,variantId).reserved,0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM inventory_reservations WHERE status='CONSUMED'").get().n,1);
  } finally {db.close();}
});
test('Lỗi giữa giao dịch đặt hàng rollback cả reservation và movements; SKU ẩn không mua được',()=>{
  const {db,admin,staff,productId,variantId}=fixture();
  try {
    priceVariant(db,admin,variantId,{price:'100',active:'1',version:'1'});
    adjustStock(db,staff,variantId,{delta:'2',reason:'Opening stock',version:'2'});
    publishProduct(db,admin,productId,{status:'ACTIVE',version:'1'});
    db.exec("CREATE TRIGGER fail_reservation BEFORE INSERT ON inventory_reservations BEGIN SELECT RAISE(ABORT,'forced failure'); END");
    const movements=db.prepare('SELECT COUNT(*) AS n FROM inventory_movements').get().n;
    assert.throws(()=>createOrder(db,3,{[variantId]:1},'Customer','0901234567','Test address'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_movements').get().n,movements);
    assert.equal(variant(db,variantId).reserved,0);
    db.exec('DROP TRIGGER fail_reservation');
    publishProduct(db,admin,productId,{status:'HIDDEN',version:'2'});
    assert.throws(()=>createOrder(db,3,{[variantId]:1},'Customer','0901234567','Test address'));
  } finally {db.close();}
});
test('Migration SKU giữ tồn khả dụng, giá snapshot, không trừ thêm đơn đang giao và chạy lại an toàn',()=>{
  const db=openDatabase(':memory:',1);
  try {
    db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','c@test.com','test'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Old phone','Phone','Demo','Old config',200000,5); INSERT INTO orders(id,user_id,recipient,phone,address,total,status) VALUES(1,1,'Customer','0901234567','Test address',100000,'PENDING'),(2,1,'Customer','0901234567','Test address',100000,'SHIPPING'); INSERT INTO order_items(id,order_id,product_id,name,price,quantity) VALUES(1,1,1,'Old phone',100000,1),(2,2,1,'Old phone',100000,1);");
    migrate(db);
    const v=variant(db,1); assert.equal(v.on_hand,6); assert.equal(v.reserved,1); assert.equal(v.on_hand-v.reserved,5);
    assert.equal(db.prepare('SELECT price FROM order_items WHERE id=1').get().price,100000);
    assert.equal(db.prepare('SELECT status FROM inventory_reservations WHERE order_item_id=2').get().status,'CONSUMED');
    transitionOrder(db,1,'CANCELLED',1);
    assert.equal(variant(db,1).on_hand-variant(db,1).reserved,6);
    const count=db.prepare('SELECT COUNT(*) AS n FROM product_variants').get().n;
    migrate(db); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_variants').get().n,count);
  } finally {db.close();}
});
