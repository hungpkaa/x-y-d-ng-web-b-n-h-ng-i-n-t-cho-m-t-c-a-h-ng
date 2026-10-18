const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {migrate}=require('../src/migrations');

test('Ledger v15 preserves referenced payments/refunds/events and restores foreign keys after rollback',()=>{
  const db=openDatabase(':memory:',14);
  try {
    db.exec(`INSERT INTO users(id,name,email,password) VALUES(1,'Buyer','buyer@test.com','hash');
      INSERT INTO orders(id,user_id,recipient,phone,address,total) VALUES(1,1,'Buyer','0901234567','Original address',100);
      INSERT INTO payments(id,order_id,provider,reference,amount,status) VALUES(1,1,'VNPAY','OLD',100,'SUCCEEDED');
      INSERT INTO payment_events(payment_id,event_key,response_code,transaction_status,outcome) VALUES(1,'OLD-EVENT','00','00','SUCCEEDED');
      INSERT INTO refunds(payment_id,order_id,actor_id,amount,reference,evidence_ref,note,occurred_at) VALUES(1,1,1,100,'OLD-REFUND','BANK','Refunded','2026-10-18 00:00:00');`);
    const before=db.prepare('SELECT * FROM payments').all();
    db.exec("CREATE TRIGGER fail_v15 BEFORE INSERT ON schema_migrations WHEN NEW.version=15 BEGIN SELECT RAISE(ABORT,'ledger migration failure'); END");
    assert.throws(()=>migrate(db),/ledger migration failure/);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    assert.deepEqual(db.prepare('SELECT * FROM payments').all(),before);
    db.exec('DROP TRIGGER fail_v15');migrate(db);
    assert.deepEqual(db.prepare('SELECT * FROM payments').all(),before);
    assert.equal(db.prepare('SELECT payment_id FROM refunds').get().payment_id,1);
    assert.equal(db.prepare('SELECT payment_id FROM payment_events').get().payment_id,1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.throws(()=>db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status) VALUES(999,'BANK_TRANSFER','BAD-FK',100,'SUCCEEDED')").run(),/FOREIGN KEY/);
    db.prepare("INSERT INTO payments(order_id,provider,reference,amount,status) VALUES(1,'BANK_TRANSFER','NEW-BANK',100,'SUCCEEDED')").run();
  } finally {db.close();}
});

test('Bank transfer v14 upgrades v13 without changing existing orders/payments; repeated migration preserves snapshots',()=>{
  const db=openDatabase(':memory:',13);
  try {
    db.exec(`INSERT INTO users(id,name,email,password) VALUES(1,'Buyer','buyer@test.com','hash');
      INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal,shipping_fee,status,payment_status) VALUES(1,1,'Buyer','0901234567','Original address',125000,100000,25000,'DELIVERED','PAID');
      INSERT INTO payments(id,order_id,provider,reference,amount,status) VALUES(1,1,'COD','OLD-COD',125000,'SUCCEEDED');`);
    const orders=db.prepare('SELECT * FROM orders').all(),payments=db.prepare('SELECT * FROM payments').all();
    migrate(db,':memory:',14);
    assert.deepEqual(db.prepare('SELECT * FROM orders').all(),orders);
    assert.deepEqual(db.prepare('SELECT * FROM payments').all(),payments);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_transfer_orders').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_transfer_receipts').get().n,0);
    const insert=db.prepare('INSERT INTO bank_transfer_orders(order_id,bank_code,account_number,account_name,transfer_reference,amount,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)');
    insert.run(1,'BIDV','4801021854','VUTIENHUNG','DH1',125000,Date.now()+1800000,'2026-10-18 00:00:00');
    const snapshot=db.prepare('SELECT * FROM bank_transfer_orders').get();
    migrate(db,':memory:',14);assert.deepEqual(db.prepare('SELECT * FROM bank_transfer_orders').get(),snapshot);
    assert.throws(()=>insert.run(1,'BIDV','other','other','DUP',1,1,'now'),/UNIQUE/);
    assert.throws(()=>insert.run(999,'BIDV','4801021854','VUTIENHUNG','DH999',1,1,'now'),/FOREIGN KEY/);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();}
});

test('Bank transfer migration failure rolls back new tables and migration marker',()=>{
  const db=openDatabase(':memory:',13);
  try {
    db.exec("CREATE TRIGGER fail_bank_version BEFORE INSERT ON schema_migrations WHEN NEW.version=14 BEGIN SELECT RAISE(ABORT,'forced bank migration failure'); END");
    assert.throws(()=>migrate(db,':memory:',14),/forced bank migration failure/);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='bank_transfer_orders'").get(),undefined);
    assert.equal(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v,13);
    db.exec('DROP TRIGGER fail_bank_version');migrate(db,':memory:',14);
    assert.equal(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v,14);
  } finally {db.close();}
});
