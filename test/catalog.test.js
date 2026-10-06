const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, readdirSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { openDatabase } = require('../src/db');
const { migrate } = require('../src/migrations');
const { saveCatalog } = require('../src/catalog');
const { saveProduct } = require('../src/products');

test('Migration sao lưu, giữ dữ liệu cũ, xử lý slug trùng và không chạy lại',()=>{
  const directory = mkdtempSync(join(tmpdir(),'electro-migration-'));
  const file = join(directory,'store.sqlite');
  const db = new DatabaseSync(file);
  try {
    db.exec(`CREATE TABLE products(id INTEGER PRIMARY KEY,name TEXT,category TEXT,brand TEXT,price INTEGER,stock INTEGER);
      INSERT INTO products VALUES(1,'A','Điện thoại','Apple',123,5),(2,'B','Dien thoai','Apple',456,7);`);
    migrate(db,file,1);
    const backup = readdirSync(join(directory,'backups'))[0];
    const previous = new DatabaseSync(join(directory,'backups',backup));
    try {
      assert.equal(previous.prepare('SELECT COUNT(*) AS n FROM products').get().n,2);
      assert.equal(previous.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='categories'").get().n,0);
    } finally { previous.close(); }
    assert.deepEqual(db.prepare('SELECT price,stock FROM products ORDER BY id').all().map(row=>({...row})),[{price:123,stock:5},{price:456,stock:7}]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM categories').get().n,2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM brands').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id IS NOT NULL AND brand_id IS NOT NULL').get().n,2);
    migrate(db,file,1);
    assert.equal(readdirSync(join(directory,'backups')).length,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,1);
  } finally {
    db.close();
    for (const name of readdirSync(join(directory,'backups'))) unlinkSync(join(directory,'backups',name));
    rmdirSync(join(directory,'backups'));
    unlinkSync(file); rmdirSync(directory);
  }
});

test('ADMIN quản lý catalog, trùng bị chặn; đổi tên đồng bộ, ngừng sử dụng không làm mất sản phẩm',()=>{
  const db=openDatabase(':memory:');
  try {
    const admin={role:'ADMIN'};
    const category={name:'Điện thoại',slug:'dien-thoai',active:'1'};
    assert.equal(saveCatalog(db,{role:'STAFF'},'categories',category).status,403);
    assert.equal(saveCatalog(db,admin,'categories',category).status,200);
    assert.equal(saveCatalog(db,admin,'categories',{...category,name:'Khác'}).status,409);
    assert.equal(saveCatalog(db,admin,'brands',{name:'Apple',slug:'apple',active:'1'}).status,200);
    const product={name:'Phone',category:'Điện thoại',brand:'Apple',description:'Demo'};
    assert.equal(saveProduct(db,admin,product).status,200);
    assert.equal(saveProduct(db,admin,{...product,category:'Không tồn tại'}).status,400);
    assert.equal(saveCatalog(db,admin,'categories',{...category,id:'1',name:'Mobile',active:'0'}).status,200);
    const saved=db.prepare('SELECT * FROM products WHERE id=1').get();
    assert.equal(saved.category,'Mobile'); assert.equal(saved.status,'DRAFT');
    assert.equal(saveProduct(db,admin,{...product,category:'Mobile'}).status,400);
    assert.equal(saveProduct(db,{role:'STAFF'},{...product,id:'1',category:'Mobile',version:'1'}).status,200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,1);
    assert.throws(()=>db.prepare('DELETE FROM categories WHERE id=1').run());
  } finally { db.close(); }
});

test('Migration lỗi rollback schema và dấu phiên bản',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT)');
    assert.throws(()=>migrate(db));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('categories','brands','schema_migrations')").get().n,0);
    assert.equal(db.prepare('PRAGMA table_info(products)').all().some(row=>row.name==='category_id'),false);
  } finally { db.close(); }
});
