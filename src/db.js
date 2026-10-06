const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { join, dirname, resolve } = require('node:path');
const { scryptSync, randomBytes, timingSafeEqual } = require('node:crypto');
const { migrate } = require('./migrations');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const expected = Buffer.from(hash, 'hex');
  return expected.length === 64 && timingSafeEqual(expected, scryptSync(password, salt, 64));
}
function openDatabase(file, targetVersion = 6) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK(role IN ('CUSTOMER','STAFF','ADMIN')));
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, brand TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0), stock INTEGER NOT NULL CHECK(stock >= 0), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), recipient TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', payment_method TEXT NOT NULL DEFAULT 'COD', payment_status TEXT NOT NULL DEFAULT 'UNPAID', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0));
    CREATE TABLE IF NOT EXISTS order_history (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), actor_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  try { migrate(db,file,targetVersion); } catch(error) { db.close(); throw error; }
  return db;
}
function seed(db) {
  if (!db.prepare('SELECT id FROM products LIMIT 1').get()) {
    const insert = db.prepare('INSERT INTO products(name,category,brand,description,price,stock,category_id,brand_id) VALUES(?,?,?,?,?,?,?,?)');
    [
      ['iPhone 16','Điện thoại','Apple','128GB · Màn hình 6.1 inch · Chip A18',19990000,15],
      ['Galaxy S25','Điện thoại','Samsung','256GB · RAM 12GB · Màn hình AMOLED',21990000,12],
      ['MacBook Air M3','Laptop','Apple','RAM 16GB · SSD 256GB · Màn hình 13 inch',24990000,8],
      ['ASUS Vivobook 15','Laptop','ASUS','Intel Core i5 · RAM 16GB · SSD 512GB',14990000,10],
      ['Sony WH-1000XM5','Tai nghe','Sony','Tai nghe không dây · Chống ồn chủ động',6990000,20],
      ['iPad Air M2','Tablet','Apple','128GB · Màn hình 11 inch · Wi-Fi',15990000,9]
    ].forEach(row => {
      const { slugify } = require('./catalog');
      for (const [table,name] of [['categories',row[1]],['brands',row[2]]]) {
        if (!db.prepare(`SELECT id FROM ${table} WHERE name=?`).get(name)) db.prepare(`INSERT INTO ${table}(name,slug) VALUES(?,?)`).run(name,slugify(name));
      }
      const productId=Number(insert.run(...row,db.prepare('SELECT id FROM categories WHERE name=?').get(row[1]).id,db.prepare('SELECT id FROM brands WHERE name=?').get(row[2]).id).lastInsertRowid);
      const variantId=Number(db.prepare('INSERT INTO product_variants(product_id,sku,configuration,price,on_hand,active) VALUES(?,?,?,?,?,1)').run(productId,`DEMO-${productId}`,row[3],row[4],row[5]).lastInsertRowid);
      db.prepare('INSERT INTO inventory_movements(variant_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,0,?,?)').run(variantId,row[5],`seed:sku:${variantId}`,'Tồn mẫu ban đầu');
    });
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD cần ít nhất 10 ký tự');
    db.prepare('INSERT OR IGNORE INTO users(name,email,password,role) VALUES(?,?,?,?)')
      .run('Quản trị viên', process.env.ADMIN_EMAIL.toLowerCase(), hashPassword(process.env.ADMIN_PASSWORD), 'ADMIN');
  }
}
function defaultDatabase() {
  if (process.env.DB_PATH === ':memory:') {
    const db = openDatabase(':memory:');
    seed(db);
    return db;
  }
  const directory = join(__dirname, '..', 'data');
  mkdirSync(directory, { recursive: true });
  const file=process.env.DB_PATH ? resolve(process.env.DB_PATH) : join(directory,'store.sqlite');
  mkdirSync(dirname(file),{recursive:true});
  const db = openDatabase(file);
  seed(db);
  return db;
}
module.exports = { openDatabase, defaultDatabase, hashPassword, verifyPassword };
