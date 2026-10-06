const { join, dirname } = require('node:path');
const { mkdirSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { slugify } = require('./catalog');

function migrateCatalog(db) {
  db.exec(`CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE brands(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);
    ALTER TABLE products ADD COLUMN brand_id INTEGER REFERENCES brands(id);
    CREATE INDEX products_category_idx ON products(category_id);
    CREATE INDEX products_brand_idx ON products(brand_id);`);
  for (const [column,table] of [['category','categories'],['brand','brands']]) {
    const rows = db.prepare(`SELECT id,${column} AS name FROM products ORDER BY id`).all();
    const seen = new Map();
    for (const row of rows) {
      const name = row.name.trim() || 'Chưa phân loại';
      let id = seen.get(name);
      if (!id) {
        let slug = slugify(name) || 'item';
        const base = slug;
        let suffix = 2;
        while (db.prepare(`SELECT id FROM ${table} WHERE slug=?`).get(slug)) slug = `${base}-${suffix++}`;
        id = Number(db.prepare(`INSERT INTO ${table}(name,slug) VALUES(?,?)`).run(name,slug).lastInsertRowid);
        seen.set(name,id);
      }
      db.prepare(`UPDATE products SET ${column}=?,${column}_id=? WHERE id=?`).run(name,id,row.id);
    }
    // Legacy text is retained until the SKU migration; renames must stay consistent.
    db.exec(`CREATE TRIGGER ${table}_rename AFTER UPDATE OF name ON ${table}
      BEGIN UPDATE products SET ${column}=NEW.name WHERE ${column}_id=NEW.id; END;`);
  }
}
const migrations = [{ version:1, name:'catalog_categories_brands', up:migrateCatalog },{version:2,name:'product_skus_inventory',up:require('./sku-migration').migrateSkus},{version:3,name:'catalog_images_attributes',up:require('./catalog-content-migration').migrateCatalogContent},{version:4,name:'durable_sessions_checkout',up:db=>db.exec(`
CREATE TABLE sessions(sid TEXT PRIMARY KEY,data TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE checkout_requests(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,quote_json TEXT NOT NULL,expires_at INTEGER NOT NULL,payload_hash TEXT,order_id INTEGER UNIQUE REFERENCES orders(id),UNIQUE(user_id,request_key),CHECK((order_id IS NULL AND payload_hash IS NULL) OR (order_id IS NOT NULL AND payload_hash IS NOT NULL)));
CREATE INDEX checkout_expiry_idx ON checkout_requests(expires_at) WHERE order_id IS NULL;
`)},{version:5,name:'accounts_order_management',up:require('./account-order-migration').migrateAccountsOrders},{version:6,name:'promotions_verified_reviews',up:require('./promotion-review-migration').migratePromotionsReviews}];
function migrate(db, file = ':memory:', targetVersion = 6) {
  const hasVersions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  const applied = hasVersions ? new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row=>row.version)) : new Set();
  const pending = migrations.filter(item=>item.version<=targetVersion && !applied.has(item.version));
  if (!pending.length) return;
  if (file !== ':memory:') {
    const directory = join(dirname(file),'backups');
    mkdirSync(directory,{recursive:true});
    const backup = join(directory,`before-migration-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`);
    db.prepare('VACUUM INTO ?').run(backup);
    console.log(`Đã sao lưu CSDL trước nâng cấp: ${backup}`);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const item of pending) {
      item.up(db);
      db.prepare('INSERT INTO schema_migrations(version,name) VALUES(?,?)').run(item.version,item.name);
    }
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { migrate };
