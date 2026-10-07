const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {openDatabase,seed}=require('../src/db');
const {createOrder,transitionOrder}=require('../src/orders');
const service=require('../src/shipments');
const pay=require('../src/payments');
const {salesReport}=require('../src/reporting');
function fixture() {
  const db=openDatabase(':memory:',9);seed(db);
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','customer@test.com','hash','CUSTOMER'),(2,'Staff','staff@test.com','hash','STAFF'),(3,'Admin','admin@test.com','hash','ADMIN'),(4,'Other','other@test.com','hash','CUSTOMER')");
  const id=createOrder(db,1,{'1':2},'Customer','0901234567','123 Test Street');
  for(const status of ['CONFIRMED','PREPARING']) assert.equal(transitionOrder(db,id,status,2,{version:db.prepare('SELECT version FROM orders WHERE id=?').get(id).version,reason:'Prepare confirmed order'}).status,200);
  return {db,id};
}
function proof() {return {occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19),evidence_ref:'WAREHOUSE-RECEIPT-1',reason:'Verified physical carrier handling'};}
function create(db,id) {return service.createShipment(db,{id:2},id,{version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),provider:'TEST CARRIER',tracking_number:'TRACK-'+id,...proof()});}
function input(db,shipment,status) {
  const row=db.prepare('SELECT * FROM shipments WHERE id=?').get(shipment);
  return {version:String(row.version),order_version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(row.order_id).version),request_key:randomBytes(16).toString('hex'),status,...proof()};
}
const move=(db,id,status)=>service.changeShipment(db,{id:2},id,input(db,id,status));

test('Vận đơn: tạo/replay giữ kho, có chủ sở hữu, bằng chứng và chặn cập nhật đơn để vượt vận chuyển',()=>{
  const {db,id}=fixture();try {
    const before=db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get();
    const body={version:'3',provider:'TEST CARRIER',tracking_number:'TRACK-1',...proof()};
    assert.equal(service.createShipment(db,{id:1},id,body).status,403);
    const created=service.createShipment(db,{id:2},id,body);assert.equal(created.status,200);
    assert.equal(service.createShipment(db,{id:2},id,body).id,created.id);
    assert.equal(service.createShipment(db,{id:2},id,{...body,evidence_ref:'Different proof'}).status,409);
    assert.deepEqual(db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get(),before);
    assert.equal(transitionOrder(db,id,'SHIPPING',2,{version:'3',reason:'Try bypass tracking'}).status,409);
    assert.throws(()=>service.detail(db,{id:4},id),error=>error.status===404);
    assert.equal(service.detail(db,{id:1},id).events[0].evidence_ref,undefined);
    assert.equal(service.detail(db,{id:2},id).events[0].evidence_ref,body.evidence_ref);
  } finally {db.close();}
});

test('Giao thất bại chưa cộng kho; giao lại không xuất lần hai; nhận hàng thực về/replay cộng đúng một lần',()=>{
  const {db,id}=fixture();try {
    const original=db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand,shipment=create(db,id).id;
    assert.equal(move(db,shipment,'IN_TRANSIT').status,200);
    assert.deepEqual({...db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get()},{on_hand:original-2,reserved:0});
    assert.equal(move(db,shipment,'FAILED').status,200);
    assert.equal(db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand,original-2);
    assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(id).status,'SHIPPING');
    assert.equal(move(db,shipment,'IN_TRANSIT').status,200);assert.equal(move(db,shipment,'FAILED').status,200);
    const returned=input(db,shipment,'RETURNED');
    assert.equal(service.changeShipment(db,{id:2},shipment,returned).status,200);
    assert.equal(service.changeShipment(db,{id:2},shipment,returned).status,200);
    assert.equal(service.changeShipment(db,{id:2},shipment,{...returned,reason:'Different receipt'}).status,409);
    assert.equal(move(db,shipment,'RETURNED').status,409);
    assert.equal(db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand,original);
    assert.equal(db.prepare('SELECT status,payment_status FROM orders WHERE id=?').get(id).payment_status,'UNPAID');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'returned:%'").get().n,1);
    assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(id).status,'DELIVERY_FAILED');
  } finally {db.close();}
});

test('Đơn có tiền thu khi nhận hàng về chuyển chờ hoàn; ledger/report không ghi doanh thu và hoàn đủ',()=>{
  const {db,id}=fixture();try {
    const amount=db.prepare('SELECT total FROM orders WHERE id=?').get(id).total;
    db.prepare("UPDATE orders SET payment_method='ONLINE',payment_status='PAID' WHERE id=?").run(id);
    const payment=Number(db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status,occurred_at) VALUES(?,'VNPAY','CAPTURE-RETURN',?,'SUCCEEDED',CURRENT_TIMESTAMP)").run(id,amount).lastInsertRowid);
    const shipment=create(db,id).id;assert.equal(db.prepare('SELECT cod_amount FROM shipments WHERE id=?').get(shipment).cod_amount,0);
    for(const status of ['IN_TRANSIT','FAILED','RETURNED']) assert.equal(move(db,shipment,status).status,200);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'REFUND_PENDING');
    assert.equal(pay.listRefunds(db).rows.length,1);
    const day=new Date(Date.now()+25200000).toISOString().slice(0,10),report=salesReport(db,{from:day,to:day});
    assert.equal(report.summary.revenue,0);assert.equal(report.summary.onlineCash,amount);assert.equal(report.pendingRefunds,amount);
    assert.equal(pay.recordRefund(db,{id:3},payment,{version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),amount:String(amount),reference:'REFUND-RETURN',evidence_ref:'BANK-RETURN',note:'Returned paid order refund',occurred_at:proof().occurred_at}).status,200);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'REFUNDED');
  } finally {db.close();}
});

test('Hủy trước bàn giao hủy bản ghi vận đơn, không nhận sự kiện bàn giao muộn; COD giao xong vẫn chưa thu',()=>{
  const {db,id}=fixture();try {
    const shipment=create(db,id).id;
    assert.equal(transitionOrder(db,id,'CANCELLED',2,{version:'3',reason:'Cancel before physical handoff'}).status,200);
    assert.equal(db.prepare('SELECT status FROM shipments WHERE id=?').get(shipment).status,'CANCELLED');
    assert.equal(move(db,shipment,'IN_TRANSIT').status,409);
    const next=createOrder(db,1,{'1':1},'Customer','0901234567','123 Test Street');
    for(const [index,status] of ['CONFIRMED','PREPARING'].entries()) transitionOrder(db,next,status,2,{version:index+1,reason:'Prepare COD delivery'});
    const nextShipment=create(db,next).id;
    for(const status of ['IN_TRANSIT','DELIVERED']) assert.equal(move(db,nextShipment,status).status,200);
    assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(next).payment_status,'UNPAID');
  } finally {db.close();}
});

test('Bằng chứng/version/sự kiện cũ bị chặn; lỗi audit rollback cả nhận hàng, movement và lịch sử',()=>{
  const {db,id}=fixture();try {
    const shipment=create(db,id).id,bad=input(db,shipment,'IN_TRANSIT');
    assert.equal(service.changeShipment(db,{id:2},shipment,{...bad,evidence_ref:''}).status,400);
    assert.equal(service.changeShipment(db,{id:2},shipment,{...bad,version:'0'}).status,409);
    assert.equal(service.changeShipment(db,{id:2},shipment,{...bad,occurred_at:'2020-01-01T12:00:00'}).status,409);
    for(const status of ['IN_TRANSIT','FAILED']) assert.equal(move(db,shipment,status).status,200);
    const before=db.prepare('SELECT on_hand,version FROM product_variants WHERE id=1').get();
    db.exec("CREATE TRIGGER fail_return BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'return rollback'); END");
    assert.throws(()=>move(db,shipment,'RETURNED'),/return rollback/);
    assert.deepEqual(db.prepare('SELECT on_hand,version FROM product_variants WHERE id=1').get(),before);
    assert.equal(db.prepare('SELECT status FROM shipments WHERE id=?').get(shipment).status,'FAILED');
    assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(id).status,'SHIPPING');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'returned:%'").get().n,0);
  } finally {db.close();}
});
