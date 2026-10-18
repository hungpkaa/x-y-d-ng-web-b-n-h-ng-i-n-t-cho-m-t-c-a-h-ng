const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readdirSync, unlinkSync, rmdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { openDatabase } = require('../src/db');
const { readCart, updateCart, mergeCart } = require('../src/account-cart');
const { migrate, CURRENT_SCHEMA_VERSION } = require('../src/migrations');
function populate(db) {
  db.exec(`INSERT INTO users(id,name,email,password,role) VALUES
    (1,'One','one@test.com','hash','CUSTOMER'),(2,'Two','two@test.com','hash','CUSTOMER'),(3,'Staff','staff@test.com','hash','STAFF');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,5);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,5,1);`);
}
const set = (db, actor, quantity, extra = {}) => updateCart(db, actor, { variant_id: 1, quantity, version: readCart(db, actor).version, ...extra });

test('Giỏ thuộc CUSTOMER, không nhận user_id/giá giả; thêm/xóa không giữ hàng', () => {
  const db = openDatabase(':memory:');
  try {
    populate(db);
    assert.equal(readCart(db, { id: 3 }).status, 403);
    assert.equal(readCart(db, {}).status, 403);
    assert.equal(set(db, { id: 1 }, 1, { user_id: 2 }).status, 403);
    assert.equal(set(db, { id: 1 }, 1, { price: 1 }).status, 403);
    assert.equal(set(db, { id: 1 }, 2).status, 200);
    assert.deepEqual(readCart(db, { id: 2 }).items, []);
    assert.equal(readCart(db, { id: 1 }).subtotal, 2000);
    assert.equal(set(db, { id: 1 }, 1, { action: 'add' }).quantities['1'], 3);
    assert.deepEqual({ ...db.prepare('SELECT on_hand,reserved FROM product_variants').get() }, { on_hand: 5, reserved: 0 });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n, 0);
    assert.equal(set(db, { id: 1 }, 0).items.length, 0);
  } finally { db.close(); }
});

test('Giỏ đọc giá/tồn hiện tại, giữ dòng không còn mua được để khách chỉnh/xóa', () => {
  const db = openDatabase(':memory:');
  try {
    populate(db);set(db, { id: 1 }, 2);
    db.exec('UPDATE product_variants SET price=2000,on_hand=1 WHERE id=1');
    const current = readCart(db, { id: 1 });
    assert.equal(current.subtotal, 4000);assert.equal(current.canCheckout, false);
    assert.equal(current.quantities['1'], 2);
    assert.equal(set(db, { id: 1 }, 3).status, 400);
    db.exec("UPDATE products SET status='HIDDEN'");
    const hidden = readCart(db, { id: 1 });
    assert.equal(hidden.items.length, 1);assert.equal(hidden.items[0].unitPrice, null);
    assert.equal(hidden.items[0].name, 'SKU không còn bán');
    assert.equal(set(db, { id: 1 }, 0).items.length, 0);
  } finally { db.close(); }
});

test('Version cũ, số lượng sai và lỗi lưu không ghi đè hoặc tạo giỏ một phần', () => {
  const db = openDatabase(':memory:');
  try {
    populate(db);
    for (const quantity of [-1, 1.5, 100]) assert.equal(set(db, { id: 1 }, quantity).status, 400);
    db.exec("CREATE TRIGGER fail_cart BEFORE INSERT ON cart_items BEGIN SELECT RAISE(ABORT,'forced cart failure'); END");
    assert.throws(() => set(db, { id: 1 }, 1), /forced cart failure/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM carts').get().n, 0);
    db.exec('DROP TRIGGER fail_cart');
    set(db, { id: 1 }, 1);
    const before = readCart(db, { id: 1 });
    assert.equal(updateCart(db, { id: 1 }, { variant_id: 1, quantity: 2, version: 0 }).status, 409);
    assert.deepEqual(readCart(db, { id: 1 }), before);
    db.exec("UPDATE users SET status='LOCKED' WHERE id=1");
    assert.equal(readCart(db, { id: 1 }).status, 403);
    db.exec("UPDATE users SET status='ACTIVE',auth_version=auth_version+1 WHERE id=1");
    assert.equal(readCart(db, { id: 1, auth_version: 1 }).status, 403);
  } finally { db.close(); }
});

test('Xóa phiên và mở lại CSDL không mất giỏ tài khoản', () => {
  const directory = mkdtempSync(join(tmpdir(), 'electro-account-cart-'));
  const file = join(directory, 'store.sqlite');
  let db = openDatabase(file);
  try {
    populate(db);set(db, { id: 1 }, 2);
    mergeCart(db,{id:1},'b'.repeat(64),{'1':1});
    db.exec("INSERT INTO sessions VALUES('old-session','{}',9999999999999)");
    db.exec("DELETE FROM sessions WHERE sid='old-session'");
    db.exec('UPDATE users SET auth_version=auth_version+1 WHERE id=1');
    db.close();db = openDatabase(file);
    assert.equal(readCart(db, { id: 1, auth_version: 2 }).quantities['1'], 3);
    assert.equal(mergeCart(db,{id:1,auth_version:2},'b'.repeat(64),{'1':1}).quantities['1'],3);
  } finally {
    db.close();
    for (const name of readdirSync(join(directory, 'backups'))) unlinkSync(join(directory, 'backups', name));
    rmdirSync(join(directory, 'backups'));unlinkSync(file);rmdirSync(directory);
  }
});

test('Migration từ v11 giữ phiên/giỏ cũ; không tự chuyển thành giỏ tài khoản; nâng lại an toàn', () => {
  const db = openDatabase(':memory:', 11);
  try {
    populate(db);
    db.exec(`INSERT INTO sessions VALUES('legacy','{"userId":1,"cart":{"1":2}}',9999999999999)`);
    const old = db.prepare('SELECT * FROM sessions').get();
    migrate(db);
    assert.deepEqual(db.prepare('SELECT * FROM sessions').get(), old);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM carts').get().n, 0);
    set(db, { id: 1 }, 1);migrate(db);
    assert.equal(readCart(db, { id: 1 }).quantities['1'], 1);
    assert.equal(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});
