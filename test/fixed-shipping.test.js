const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {issueCheckout,submitAccountCheckout}=require('../src/checkout');
const {readCart,updateCart}=require('../src/account-cart');
const {saveShippingPolicy,shippingPolicy}=require('../src/shipping');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec(`INSERT INTO users(id,name,email,password,role) VALUES(1,'Admin','admin@test.com','hash','ADMIN'),(2,'Buyer','buyer@test.com','hash','CUSTOMER');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100000,10);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100000,10,1);
    INSERT INTO app_settings(key,value) VALUES('regional_shipping','1') ON CONFLICT(key) DO UPDATE SET value='1';`);
  updateCart(db,{id:2},{variant_id:1,quantity:1,version:readCart(db,{id:2}).version});
  return db;
}
const fee=(db,value)=>saveShippingPolicy(db,{id:1},{fee:String(value),version:shippingPolicy(db).version,reason:'Update fixed fee'});
const issue=db=>issueCheckout(db,2,readCart(db,{id:2}).quantities);
const submit=(db,key)=>submitAccountCheckout(db,{id:2},key,'Buyer','0901234567','123 Example street');

test('QD-21: fixed fee works without region or SKU weight even with legacy regional mode enabled',()=>{
  const db=fixture();try {
    assert.equal(fee(db,25000).status,200);
    const key=issue(db),quote=db.prepare('SELECT * FROM checkout_requests WHERE request_key=?').get(key);
    assert.equal(quote.shipping_fee,25000);assert.equal(quote.shipping_quote_json,null);
    const result=submit(db,key),order=db.prepare('SELECT * FROM orders WHERE id=?').get(result.id);
    assert.equal(order.shipping_fee,25000);assert.equal(order.total,125000);
    assert.equal(fee(db,40000).status,200);
    assert.equal(submit(db,key).replayed,true);
    assert.equal(db.prepare('SELECT shipping_fee FROM orders WHERE id=?').get(result.id).shipping_fee,25000);
  } finally {db.close();}
});

test('BR-15: changing fee requires a new quote, preserving cart and inventory on failure',()=>{
  const db=fixture();try {
    const key=issue(db);fee(db,30000);
    assert.throws(()=>submit(db,key),/Phí giao hàng đã thay đổi/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
    assert.equal(readCart(db,{id:2}).quantities['1'],1);
    const result=submit(db,issue(db));
    assert.equal(db.prepare('SELECT shipping_fee FROM orders WHERE id=?').get(result.id).shipping_fee,30000);
  } finally {db.close();}
});

test('Unsubmitted legacy regional quotes require confirmation of the current fixed fee',()=>{
  const db=fixture();try {
    const key=issue(db);
    db.prepare('UPDATE checkout_requests SET shipping_quote_json=? WHERE request_key=?').run(JSON.stringify({region:'OLD',fee:0}),key);
    assert.throws(()=>submit(db,key),/xác nhận phí cố định/);
    assert.equal(readCart(db,{id:2}).quantities['1'],1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    assert.ok(submit(db,issue(db)).id);
  } finally {db.close();}
});
