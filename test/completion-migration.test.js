const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/db');
const { migrate, CURRENT_SCHEMA_VERSION } = require('../src/migrations');
const { issueCheckout, submitCheckout } = require('../src/checkout');

function insertFixture(db) {
  db.exec(`
    INSERT INTO users(id,name,email,password) VALUES(1,'Customer','migration@test.com','original-hash');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phones','Demo','Original description',1000,5);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,reserved,active) VALUES(1,1,'PHONE',1000,5,1,1);
    INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal,shipping_fee) VALUES(1,1,'Customer','0901234567','Original order address',1050,1000,50);
    INSERT INTO order_items(id,order_id,product_id,variant_id,name,price,quantity,sku_snapshot,configuration_snapshot) VALUES(1,1,1,1,'Original Phone',1000,1,'PHONE','Original configuration');
    INSERT INTO inventory_reservations(order_item_id,variant_id,quantity,status) VALUES(1,1,1,'HELD');
    INSERT INTO sessions VALUES('existing-session','{"cart":{"1":1}}',9999999999999);
    INSERT INTO checkout_requests(user_id,request_key,quote_json,expires_at,shipping_fee,payload_hash,order_id) VALUES(1,'existing-key','[[1,1,1000]]',9999999999999,50,'original-payload',1);
  `);
}

test('Khởi tạo mặc định có schema mới và chạy được checkout thực tế', () => {
  const db = openDatabase(':memory:');
  try {
    insertFixture(db);
    assert.equal(db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, CURRENT_SCHEMA_VERSION);
    const token = issueCheckout(db, 1, { '1': 1 });
    const result = submitCheckout(db, 1, token, { '1': 1 }, 'Customer', '0901234567', '123 New address');
    assert.equal(db.prepare('SELECT total FROM orders WHERE id=?').get(result.id).total, 1000);
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved, 2);
    assert.equal(db.prepare('SELECT shipping_quote_json FROM checkout_requests WHERE request_key=?').get(token).shipping_quote_json, null);
  } finally { db.close(); }
});

for (const oldVersion of [8, 10]) {
  test(`Nâng v${oldVersion} lên hiện tại giữ snapshot đơn, tồn, phiên và request cũ; chạy lại không thay dữ liệu`, () => {
    const db = openDatabase(':memory:', oldVersion);
    try {
      insertFixture(db);
      const tables = ['users', 'products', 'product_variants', 'orders', 'order_items', 'inventory_reservations', 'sessions', 'checkout_requests'];
      const before = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all()]));
      migrate(db);
      for (const table of tables) {
        const after = db.prepare(`SELECT * FROM ${table}`).all();
        assert.equal(after.length, before[table].length, table);
        before[table].forEach((row, index) => {
          for (const key of Object.keys(row)) assert.deepEqual(after[index][key], row[key], `${table}.${key}`);
        });
      }
      assert.equal(db.prepare('SELECT shipping_quote_json FROM orders WHERE id=1').get().shipping_quote_json, null);
      const snapshot = JSON.stringify(tables.map(table => db.prepare(`SELECT * FROM ${table}`).all()));
      migrate(db);
      assert.equal(JSON.stringify(tables.map(table => db.prepare(`SELECT * FROM ${table}`).all())), snapshot);
      assert.equal(db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, CURRENT_SCHEMA_VERSION);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { db.close(); }
  });
}

test('Lỗi nâng schema mới rollback cột/bảng và giữ dữ liệu để thử lại', () => {
  const db = openDatabase(':memory:', 10);
  try {
    insertFixture(db);
    db.exec('CREATE TABLE shipping_regions(code TEXT PRIMARY KEY)');
    const originalOrder = db.prepare('SELECT * FROM orders WHERE id=1').get();
    assert.throws(() => migrate(db), /already exists/);
    assert.equal(db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 10);
    assert.deepEqual(db.prepare('SELECT * FROM orders WHERE id=1').get(), originalOrder);
    assert.equal(db.prepare('PRAGMA table_info(checkout_requests)').all().some(column => column.name === 'shipping_quote_json'), false);
    db.exec('DROP TABLE shipping_regions');
    migrate(db);
    assert.equal(db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, CURRENT_SCHEMA_VERSION);
  } finally { db.close(); }
});
