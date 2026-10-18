const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {openDatabase}=require('../src/db');
const {readCart,updateCart}=require('../src/account-cart');
const {issueCheckout,submitAccountCheckout}=require('../src/checkout');
const {transitionOrder,recordCodReceipt}=require('../src/orders');
const {createShipment,changeShipment}=require('../src/shipments');
const {saveShippingPolicy}=require('../src/shipping');
const {salesReport}=require('../src/reporting');
const payments=require('../src/payments');
const customer={id:1},staff={id:2},admin={id:3};
function fixture() {
  const db=openDatabase(':memory:');
  db.exec(`INSERT INTO users(id,name,email,password,role) VALUES
    (1,'Buyer','buyer@test.com','hash','CUSTOMER'),(2,'Staff','staff@test.com','hash','STAFF'),(3,'Admin','admin@test.com','hash','ADMIN');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100000,10);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100000,10,1);`);
  assert.equal(saveShippingPolicy(db,admin,{version:1,fee:'25000',reason:'Fixed demo delivery fee'}).status,200);
  return db;
}
const stock=db=>({...db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get()});
const order=(db,id)=>db.prepare('SELECT * FROM orders WHERE id=?').get(id);
const move=(db,id,status,actor=staff)=>transitionOrder(db,id,status,actor,{version:order(db,id).version,reason:'Verified order handling'});
const proof=()=>({occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19),evidence_ref:'CARRIER-PROOF',reason:'Verified physical carrier handling'});
function purchase(db,method='COD') {
  assert.equal(updateCart(db,customer,{variant_id:1,quantity:2,version:readCart(db,customer).version}).status,200);
  const token=issueCheckout(db,1,readCart(db,customer).quantities,'',method);
  return submitAccountCheckout(db,customer,token,'Buyer','0901234567','123 Example street','',method).id;
}
function shipmentInput(db,id,status) {
  const shipment=db.prepare('SELECT * FROM shipments WHERE id=?').get(id);
  return {version:shipment.version,order_version:order(db,shipment.order_id).version,
    status,request_key:randomBytes(16).toString('hex'),...proof()};
}
function report(db) {
  const day=new Date(Date.now()+25200000).toISOString().slice(0,10);
  return salesReport(db,{from:day,to:day}).summary;
}

test('CODE-05A: account checkout → handoff → delivery → ADMIN COD receipt, with stock and revenue checkpoints',()=>{
  const db=fixture();try {
    assert.deepEqual(stock(db),{on_hand:10,reserved:0});
    const id=purchase(db);
    assert.deepEqual(stock(db),{on_hand:10,reserved:2});
    assert.deepEqual(readCart(db,customer).quantities,{});
    assert.equal(order(db,id).total,225000);
    const receipt={amount:'225000',reference:'COD-FLOW-001',note:'Verified full carrier remittance'};
    assert.equal(recordCodReceipt(db,id,admin,{...receipt,version:order(db,id).version}).status,409);
    for(const status of ['CONFIRMED','PREPARING']) {
      assert.equal(move(db,id,status).status,200);
      assert.deepEqual(stock(db),{on_hand:10,reserved:2});
    }
    assert.equal(move(db,id,'SHIPPING').status,409);
    const shipment=createShipment(db,staff,id,{version:order(db,id).version,provider:'MANUAL CARRIER',tracking_number:'COD-FLOW-TRACK',...proof()});
    assert.equal(shipment.status,200);
    assert.equal(db.prepare('SELECT cod_amount FROM shipments WHERE id=?').get(shipment.id).cod_amount,225000);
    assert.deepEqual(stock(db),{on_hand:10,reserved:2});
    const handoff=shipmentInput(db,shipment.id,'IN_TRANSIT');
    assert.equal(changeShipment(db,staff,shipment.id,handoff).status,200);
    assert.equal(changeShipment(db,staff,shipment.id,handoff).status,200);
    assert.deepEqual(stock(db),{on_hand:8,reserved:0});
    assert.equal(move(db,id,'CANCELLED').status,409);
    assert.equal(changeShipment(db,staff,shipment.id,shipmentInput(db,shipment.id,'DELIVERED')).status,200);
    assert.equal(order(db,id).payment_status,'UNPAID');
    assert.equal(report(db).revenue,0);assert.equal(report(db).cash,0);
    const body={...receipt,version:order(db,id).version};
    for(const actor of [customer,staff]) assert.equal(recordCodReceipt(db,id,actor,body).status,403);
    assert.equal(recordCodReceipt(db,id,admin,{...body,amount:'200000'}).status,400);
    assert.equal(recordCodReceipt(db,id,admin,body).status,200);
    assert.equal(recordCodReceipt(db,id,admin,body).status,200);
    assert.equal(order(db,id).payment_status,'PAID');
    assert.ok(order(db,id).recognition_at);
    assert.deepEqual(stock(db),{on_hand:8,reserved:0});
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cod_receipts').get().n,1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM payments WHERE provider='COD'").get().n,1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'shipping:%'").get().n,1);
    const summary=report(db);
    assert.equal(summary.revenue,200000);assert.equal(summary.shipping,25000);
    assert.equal(summary.cash,225000);assert.equal(summary.recognizedOrders,1);
  } finally {db.close();}
});

test('CODE-05A: cancellation before handoff releases only the hold and invalidates the ready shipment',()=>{
  const db=fixture();try {
    const id=purchase(db);
    for(const status of ['CONFIRMED','PREPARING']) assert.equal(move(db,id,status).status,200);
    const shipment=createShipment(db,staff,id,{version:order(db,id).version,provider:'MANUAL CARRIER',tracking_number:'COD-CANCEL-TRACK',...proof()});
    assert.equal(shipment.status,200);
    const lateHandoff=shipmentInput(db,shipment.id,'IN_TRANSIT');
    assert.equal(move(db,id,'CANCELLED').status,200);
    assert.equal(move(db,id,'CANCELLED').status,200);
    assert.equal(changeShipment(db,staff,shipment.id,lateHandoff).status,409);
    assert.deepEqual(stock(db),{on_hand:10,reserved:0});
    assert.equal(db.prepare('SELECT status FROM inventory_reservations').get().status,'RELEASED');
    assert.equal(db.prepare('SELECT status FROM shipments WHERE id=?').get(shipment.id).status,'CANCELLED');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'cancelled:%'").get().n,1);
    assert.equal(report(db).revenue,0);assert.equal(report(db).cash,0);
  } finally {db.close();}
});

test('CODE-05C: failed COD delivery can retry to delivery without a second stock issue or automatic receipt',()=>{
  const db=fixture();try {
    const id=purchase(db);
    for(const status of ['CONFIRMED','PREPARING']) assert.equal(move(db,id,status).status,200);
    const shipment=createShipment(db,staff,id,{version:order(db,id).version,provider:'MANUAL CARRIER',tracking_number:'COD-RETRY',...proof()});
    assert.equal(shipment.status,200);
    for(const status of ['IN_TRANSIT','FAILED','IN_TRANSIT','DELIVERED']) {
      assert.equal(changeShipment(db,staff,shipment.id,shipmentInput(db,shipment.id,status)).status,200);
      assert.deepEqual(stock(db),{on_hand:8,reserved:0});
    }
    assert.equal(order(db,id).status,'DELIVERED');
    assert.equal(order(db,id).payment_status,'UNPAID');
    assert.equal(report(db).revenue,0);assert.equal(report(db).cash,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM shipments').get().n,1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'shipping:%'").get().n,1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'returned:%'").get().n,0);
    assert.equal(recordCodReceipt(db,id,admin,{version:order(db,id).version,amount:'225000',reference:'COD-RETRY-RECEIPT',note:'Verified carrier remittance'}).status,200);
    assert.equal(report(db).revenue,200000);assert.equal(report(db).cash,225000);
  } finally {db.close();}
});

test('CODE-05C: real checkout/IPN → failed delivery → physical return → refund keeps stock and money separate',()=>{
  const db=fixture();try {
    const id=purchase(db,'ONLINE');
    const config={tmnCode:'LOCALTEST',secret:'local-test-key'};
    const payment=db.prepare('SELECT * FROM payments WHERE order_id=?').get(id);
    const params={vnp_TmnCode:config.tmnCode,vnp_TxnRef:payment.reference,vnp_Amount:String(payment.amount*100),vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'123456789',vnp_PayDate:payments.vnpDate(Date.now())};
    assert.equal(payments.processIpn(db,{...params,vnp_SecureHash:payments.signature(params,config.secret)},config).RspCode,'00');
    for(const status of ['CONFIRMED','PREPARING']) assert.equal(move(db,id,status).status,200);
    const shipment=createShipment(db,staff,id,{version:order(db,id).version,provider:'MANUAL CARRIER',tracking_number:'ONLINE-RETURN',...proof()});
    assert.equal(shipment.status,200);
    assert.equal(db.prepare('SELECT cod_amount FROM shipments WHERE id=?').get(shipment.id).cod_amount,0);
    for(const status of ['IN_TRANSIT','FAILED']) assert.equal(changeShipment(db,staff,shipment.id,shipmentInput(db,shipment.id,status)).status,200);
    assert.deepEqual(stock(db),{on_hand:8,reserved:0});
    assert.equal(order(db,id).status,'SHIPPING');assert.equal(order(db,id).payment_status,'PAID');
    assert.equal(payments.refundDue(db,id).length,0);
    const returned=shipmentInput(db,shipment.id,'RETURNED');
    assert.equal(changeShipment(db,customer,shipment.id,returned).status,403);
    assert.equal(changeShipment(db,staff,shipment.id,{...returned,evidence_ref:''}).status,400);
    assert.deepEqual(stock(db),{on_hand:8,reserved:0});
    assert.equal(changeShipment(db,staff,shipment.id,returned).status,200);
    assert.equal(changeShipment(db,staff,shipment.id,returned).status,200);
    assert.deepEqual(stock(db),{on_hand:10,reserved:0});
    assert.equal(order(db,id).status,'DELIVERY_FAILED');assert.equal(order(db,id).payment_status,'REFUND_PENDING');
    assert.equal(payments.refundDue(db,id).length,1);
    assert.equal(report(db).revenue,0);assert.equal(report(db).onlineCash,225000);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds').get().n,0);
    const snapshot=order(db,id);
    const refund={version:snapshot.version,amount:'225000',reference:'RETURN-REFUND',evidence_ref:'BANK-REFUND',note:'Verified full external refund',occurred_at:proof().occurred_at};
    assert.equal(payments.recordRefund(db,staff,payment.id,refund).status,403);
    assert.equal(payments.recordRefund(db,admin,payment.id,refund).status,200);
    assert.equal(payments.recordRefund(db,admin,payment.id,refund).status,200);
    assert.equal(order(db,id).payment_status,'REFUNDED');assert.equal(order(db,id).status,'DELIVERY_FAILED');
    assert.equal(order(db,id).total,snapshot.total);assert.equal(order(db,id).shipping_fee,snapshot.shipping_fee);
    assert.deepEqual(stock(db),{on_hand:10,reserved:0});
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'returned:%'").get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds').get().n,1);
    assert.equal(report(db).revenue,0);assert.equal(report(db).refunds,225000);assert.equal(report(db).netCash,0);
    for(const status of ['IN_TRANSIT','DELIVERED','RETURNED']) assert.equal(changeShipment(db,staff,shipment.id,shipmentInput(db,shipment.id,status)).status,409);
  } finally {db.close();}
});
