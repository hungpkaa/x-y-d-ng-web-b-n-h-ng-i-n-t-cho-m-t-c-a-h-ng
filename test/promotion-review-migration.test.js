const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {migrate}=require('../src/migrations');
test('Migration v6 giữ snapshot đơn, kho, phiên và khóa checkout; chạy lại không thay dữ liệu',()=>{
  const db=openDatabase(':memory:',5);
  try {
    db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','test@test.com','hash'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,5); INSERT INTO product_variants(id,product_id,sku,price,on_hand,reserved,active) VALUES(1,1,'PHONE',1000,5,1,1); INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal,shipping_fee) VALUES(1,1,'Customer','0901234567','Original address',1050,1000,50); INSERT INTO order_items(id,order_id,product_id,variant_id,name,price,quantity,sku_snapshot,configuration_snapshot) VALUES(1,1,1,1,'Phone',1000,1,'PHONE','Original configuration'); INSERT INTO inventory_reservations(order_item_id,variant_id,quantity,status) VALUES(1,1,1,'HELD'); INSERT INTO sessions VALUES('session','{}',9999999999999); INSERT INTO checkout_requests(user_id,request_key,quote_json,expires_at,shipping_fee,payload_hash,order_id) VALUES(1,'existing','[[1,1,1000]]',9999999999999,50,'original-hash',1)");
    const tables=['users','products','product_variants','orders','order_items','inventory_reservations','sessions','checkout_requests'];
    const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]));
    migrate(db,':memory:',6);
    for(const table of tables) {
      const after=db.prepare(`SELECT * FROM ${table}`).all();
      assert.equal(after.length,before[table].length);
      before[table].forEach((row,index)=>{for(const key of Object.keys(row)) assert.deepEqual(after[index][key],row[key],table+'.'+key);});
    }
    assert.equal(db.prepare('SELECT discount,promotion_code FROM orders').get().discount,0);
    assert.equal(db.prepare('SELECT promotion_code FROM orders').get().promotion_code,'');
    assert.equal(db.prepare('SELECT promotion_id FROM checkout_requests').get().promotion_id,null);
    const snapshot=JSON.stringify(tables.map(table=>db.prepare(`SELECT * FROM ${table}`).all()));
    migrate(db,':memory:',6);
    assert.equal(JSON.stringify(tables.map(table=>db.prepare(`SELECT * FROM ${table}`).all())),snapshot);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,6);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();}
});
test('Migration v6 lỗi rollback các bảng/cột mới và không đánh dấu đã nâng cấp',()=>{
  const db=openDatabase(':memory:',5);
  try {
    db.exec('CREATE TABLE reviews(id INTEGER PRIMARY KEY)');
    assert.throws(()=>migrate(db,':memory:',6),/already exists/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('promotions','promotion_products','promotion_redemptions')").get().n,0);
    for(const table of ['orders','checkout_requests']) assert.equal(db.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name==='discount'),false);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,5);
    db.exec('DROP TABLE reviews');
    migrate(db,':memory:',6);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,6);
  } finally {db.close();}
});
