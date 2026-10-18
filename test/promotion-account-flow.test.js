const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {readCart,updateCart}=require('../src/account-cart');
const {issueCheckout,submitAccountCheckout}=require('../src/checkout');
const {savePromotion,togglePromotion,displayTime}=require('../src/promotions');
const {saveShippingPolicy}=require('../src/shipping');
const {transitionOrder,recordCodReceipt}=require('../src/orders');
const {advanceOrder}=require('../test-support/shipping');
const {salesReport,reportCsv}=require('../src/reporting');
const admin={id:3},customer={id:1};
function fixture() {
  const db=openDatabase(':memory:');
  db.exec(`INSERT INTO users(id,name,email,password,role) VALUES
    (1,'One','one@test.com','hash','CUSTOMER'),(2,'Two','two@test.com','hash','CUSTOMER'),
    (3,'Admin','admin@test.com','hash','ADMIN'),(4,'Staff','staff@test.com','hash','STAFF');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100000,10);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100000,10,1);`);
  assert.equal(saveShippingPolicy(db,admin,{version:1,fee:'25000',reason:'Fixed delivery fee'}).status,200);
  return db;
}
const fields=overrides=>({code:'SAVE10',kind:'PERCENT',value:'10',cap:'50000',minimum:'100000',scope:'ALL',
  starts_at:displayTime(Date.now()-60000),ends_at:displayTime(Date.now()+3600000),total_limit:'5',user_limit:'1',active:'1',...overrides});
function fill(db,id=1) {
  const actor={id};
  assert.equal(updateCart(db,actor,{variant_id:1,quantity:1,version:readCart(db,actor).version}).status,200);
}
const quote=(db,id=1,code='SAVE10')=>issueCheckout(db,id,readCart(db,{id}).quantities,code);
const submit=(db,key,id=1,code='SAVE10')=>submitAccountCheckout(db,{id},key,'Buyer','0901234567','123 Example street',code);

test('QD-24: discounted account order recognizes net merchandise only after COD receipt, with matching CSV',()=>{
  const db=fixture();try {
    assert.equal(savePromotion(db,admin,null,fields()).status,200);
    fill(db);const {id}=submit(db,quote(db));
    const day=new Date(Date.now()+25200000).toISOString().slice(0,10),range={from:day,to:day};
    for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) {
      const version=db.prepare('SELECT version FROM orders WHERE id=?').get(id).version;
      assert.equal(advanceOrder(db,id,status,{id:4},{version,reason:'Verified discounted order delivery'}).status,200);
    }
    const unpaid=salesReport(db,range);
    assert.equal(unpaid.summary.deliveredOrders,1);
    assert.equal(unpaid.summary.recognizedOrders,0);assert.equal(unpaid.summary.revenue,0);assert.equal(unpaid.summary.cash,0);
    const version=db.prepare('SELECT version FROM orders WHERE id=?').get(id).version;
    const receipt={version,amount:'115000',reference:'DISCOUNTED-COD',note:'Verified full remittance'};
    assert.equal(recordCodReceipt(db,id,admin,receipt).status,200);
    assert.equal(recordCodReceipt(db,id,admin,receipt).status,200);
    const report=salesReport(db,range),summary=report.summary;
    assert.equal(summary.subtotal,100000);assert.equal(summary.discount,10000);
    assert.equal(summary.revenue,90000);assert.equal(summary.shipping,25000);
    assert.equal(summary.cash,115000);assert.equal(summary.totalCash,115000);assert.equal(summary.recognizedOrders,1);
    const csv=reportCsv(report);
    assert.ok(csv.includes('"Doanh thu hàng đã giao và thu tiền","","","90000"'));
    assert.ok(csv.includes('"Phí giao của đơn ghi nhận","","","25000"'));
    assert.ok(csv.includes('"COD thực thu","","","115000"'));
  } finally {db.close();}
});

test('QD-22: ADMIN manages code; account checkout discounts merchandise only and keeps snapshot/replay after deactivation',()=>{
  const db=fixture();try {
    for(const actor of [customer,{id:4}]) assert.equal(savePromotion(db,actor,null,fields()).status,403);
    const promo=savePromotion(db,admin,null,fields());assert.equal(promo.status,200);
    fill(db);
    const key=quote(db,1,' save10 ');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM promotion_redemptions').get().n,0);
    const placed=submit(db,key),snapshot={...db.prepare('SELECT subtotal,discount,shipping_fee,total,promotion_code FROM orders WHERE id=?').get(placed.id)};
    assert.deepEqual(snapshot,{subtotal:100000,discount:10000,shipping_fee:25000,total:115000,promotion_code:'SAVE10'});
    assert.deepEqual(readCart(db,customer).quantities,{});
    assert.equal(savePromotion(db,admin,promo.id,{...fields(),version:1,value:'20'}).status,409);
    assert.equal(togglePromotion(db,{id:4},promo.id,{version:1,active:'0',reason:'End campaign'}).status,403);
    assert.equal(togglePromotion(db,admin,promo.id,{version:1,active:'0',reason:'End campaign'}).status,200);
    fill(db);
    assert.throws(()=>quote(db),/đã tắt/);
    assert.equal(submit(db,key).replayed,true);
    assert.equal(readCart(db,customer).quantities['1'],1);
    assert.deepEqual({...db.prepare('SELECT subtotal,discount,shipping_fee,total,promotion_code FROM orders WHERE id=?').get(placed.id)},snapshot);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM promotion_redemptions').get().n,1);
  } finally {db.close();}
});

test('QD-22: shipping cannot satisfy merchandise minimum; multiple codes rejected; per-user limit releases only on pre-handoff cancellation',()=>{
  const db=fixture();try {
    const promo=savePromotion(db,admin,null,fields({minimum:'110000'}));assert.equal(promo.status,200);
    fill(db);
    assert.throws(()=>quote(db),/tối thiểu/);
    assert.equal(savePromotion(db,admin,promo.id,{...fields(),version:1}).status,200);
    for(const code of [['SAVE10','OTHER'],'SAVE10,OTHER']) assert.throws(()=>quote(db,1,code),/Mã giảm giá/);
    const first=submit(db,quote(db));
    fill(db);
    assert.throws(()=>quote(db),/giới hạn/);
    fill(db,2);assert.ok(quote(db,2));
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(first.id);
    assert.equal(transitionOrder(db,first.id,'CANCELLED',customer,{version:order.version,reason:'Customer cancellation'}).status,200);
    assert.equal(db.prepare('SELECT status FROM promotion_redemptions WHERE order_id=?').get(first.id).status,'RELEASED');
    assert.ok(submit(db,quote(db)).id);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM promotion_redemptions WHERE user_id=1 AND status='HELD'").get().n,1);
  } finally {db.close();}
});

test('QD-22: last redemption taken after quote rejects account checkout without losing cart or holding more stock',()=>{
  const db=fixture();try {
    assert.equal(savePromotion(db,admin,null,fields({total_limit:'1'})).status,200);
    fill(db,1);fill(db,2);
    const first=quote(db,1),second=quote(db,2);
    assert.ok(submit(db,first,1).id);
    const before=readCart(db,{id:2});
    assert.throws(()=>submit(db,second,2),/giới hạn|hết lượt/);
    assert.deepEqual(readCart(db,{id:2}),before);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM promotion_redemptions').get().n,1);
    assert.equal(db.prepare('SELECT order_id FROM checkout_requests WHERE request_key=?').get(second).order_id,null);
  } finally {db.close();}
});
