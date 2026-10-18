const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {createOrderWork,transitionOrder}=require('../src/orders');
const {transaction}=require('../src/products');
const {prepareBankTransferWork,expireBankTransfers,confirmBankTransfer,HOLD_MS}=require('../src/bank-transfer');
const receiver={bankCode:'BIDV',accountNumber:'4801021854',accountName:'VUTIENHUNG'};
function fixture() {
  const db=openDatabase(':memory:');
  db.exec(`INSERT INTO users(id,name,email,password,role) VALUES(1,'Buyer','buyer@test.com','hash','CUSTOMER'),(2,'Other','other@test.com','hash','CUSTOMER'),(3,'Staff','staff@test.com','hash','STAFF');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100000,10);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100000,10,1);
    INSERT INTO users(id,name,email,password,role) VALUES(4,'Admin','admin@test.com','hash','ADMIN');`);
  return db;
}
function place(db,now=Date.now(),details=receiver) {
  return transaction(db,()=>{
    const id=createOrderWork(db,1,{'1':2},'Buyer','0901234567','123 Example street',25000);
    prepareBankTransferWork(db,{id:1},id,details,now);return id;
  });
}
test('Bank transfer snapshots receiver and total, holds 30 minutes, retries preserve deadline and owner',()=>{
  const db=fixture();try {
    const now=Date.now(),id=place(db,now),row=db.prepare('SELECT * FROM bank_transfer_orders').get();
    assert.equal(row.amount,225000);assert.equal(row.expires_at,now+HOLD_MS);assert.equal(row.transfer_reference,'DH'+id);
    assert.equal(row.account_number,receiver.accountNumber);assert.equal(row.qr_payload,null);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,2);
    assert.deepEqual(prepareBankTransferWork(db,{id:1},id,{...receiver,accountNumber:'123456'},now+100000),row);
    assert.throws(()=>prepareBankTransferWork(db,{id:2},id,receiver),error=>error.status===404);
    assert.throws(()=>prepareBankTransferWork(db,{id:3},id,receiver),error=>error.status===403);
    assert.equal(transitionOrder(db,id,'CONFIRMED',{id:3},{version:1,reason:'Try before payment'}).status,409);
    assert.equal(expireBankTransfers(db,row.expires_at-1),0);
    assert.equal(expireBankTransfers(db,row.expires_at),1);assert.equal(expireBankTransfers(db,row.expires_at+1),0);
    assert.equal(db.prepare('SELECT status FROM orders').get().status,'CANCELLED');
    assert.deepEqual({...db.prepare('SELECT on_hand,reserved FROM product_variants').get()},{on_hand:10,reserved:0});
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,0);
  } finally {db.close();}
});

const proof=(db,id,now)=>({version:db.prepare('SELECT version FROM orders WHERE id=?').get(id).version,amount:'225000',reference:'BIDV-TXN-001',note:'Verified bank statement',occurred_at:new Date(now+25200000).toISOString().slice(0,19)});
test('ADMIN confirmation records bank cash once; late receipt cancels and becomes refund due without holding stock',()=>{
  for(const late of [false,true]) {
    const db=fixture();try {
      const now=Date.now(),id=place(db,now),received=late?now+HOLD_MS:now;
      const input=proof(db,id,received);
      assert.equal(confirmBankTransfer(db,{id:3},id,input,received).status,403);
      assert.equal(confirmBankTransfer(db,{id:4},id,{...input,amount:'1'},received).status,400);
      const result=confirmBankTransfer(db,{id:4},id,input,received);assert.equal(result.status,200);
      assert.equal(confirmBankTransfer(db,{id:4},id,input,received).replayed,true);
      const order=db.prepare('SELECT * FROM orders').get();
      assert.equal(order.payment_status,late?'REFUND_PENDING':'PAID');
      assert.equal(order.status,late?'CANCELLED':'PENDING');
      assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,late?0:2);
      const day=new Date(received+25200000).toISOString().slice(0,10);
      const report=require('../src/reporting').salesReport(db,{from:day,to:day});
      assert.equal(report.summary.bankCash,225000);assert.equal(report.summary.totalCash,225000);assert.equal(report.summary.revenue,0);
      assert.equal(require('../src/payments').refundDue(db,id).length,late?1:0);
      if(late) {
        const refund={...input,version:order.version,reference:'REFUND-BANK-001',evidence_ref:'BANK-REFUND-001'};
        assert.equal(require('../src/payments').recordRefund(db,{id:4},result.paymentId,refund,received).status,200);
        assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'REFUNDED');
      }
      assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
    } finally {db.close();}
  }
});
test('Confirmation audit failure rolls back bank receipt, ledger, expiry and stock',()=>{
  const db=fixture();try {
    const now=Date.now(),id=place(db,now),received=now+HOLD_MS;
    db.exec("CREATE TRIGGER fail_bank_receipt BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'bank receipt failure'); END");
    assert.throws(()=>confirmBankTransfer(db,{id:4},id,proof(db,id,received),received),/bank receipt failure/);
    assert.equal(db.prepare('SELECT status FROM orders').get().status,'PENDING');
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,2);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_transfer_receipts').get().n,0);
  } finally {db.close();}
});
test('Invalid receiver and expiry audit failure roll back orders, snapshot and stock',()=>{
  const db=fixture();try {
    assert.equal(place(db,Date.now(),{...receiver,accountNumber:'bad'}).status,400);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
    place(db);const deadline=db.prepare('SELECT expires_at FROM bank_transfer_orders').get().expires_at;
    db.exec("CREATE TRIGGER fail_bank_expiry BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'bank expiry failure'); END");
    assert.throws(()=>expireBankTransfers(db,deadline),/bank expiry failure/);
    assert.equal(db.prepare('SELECT status FROM orders').get().status,'PENDING');
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,2);
    db.exec('DROP TRIGGER fail_bank_expiry');assert.equal(expireBankTransfers(db,deadline),1);
  } finally {db.close();}
});
