const test=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,seed}=require('../src/db');
const {importDemoCatalog}=require('../src/demo-catalog');
const {publicationProblem}=require('../src/attributes');
const products=require('../fixtures/catalog/products.json');
test('Catalog mẫu: đủ ảnh, có lịch sử tồn, chạy lại không ghi đè giá/tồn hoặc thêm trùng',()=>{
  const db=openDatabase(':memory:');seed(db);
  try {
    const before=db.prepare('SELECT * FROM products ORDER BY id').all();
    const result=importDemoCatalog(db,products,()=>Buffer.from('test image'));
    assert.equal(result.created,27);assert.equal(result.images,76);assert.equal(result.drafts,0);
    const variant=db.prepare("SELECT * FROM product_variants WHERE sku='SAMPLE-DJ-78'").get();
    assert.equal(publicationProblem(db,variant.product_id),null);
    db.prepare('UPDATE product_variants SET price=123456,on_hand=9 WHERE id=?').run(variant.id);
    const replay=importDemoCatalog(db,products,()=>Buffer.from('test image'));
    assert.equal(replay.created,0);assert.equal(replay.skipped,27);
    const after=db.prepare('SELECT * FROM product_variants WHERE id=?').get(variant.id);
    assert.equal(after.price,123456);assert.equal(after.on_hand,9);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'sample:dummyjson:%'").get().n,27);
    for(const original of before) assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=?').get(original.id),original);
  } finally {db.close();}
});
test('Catalog mẫu: thiếu ảnh không ghi dữ liệu; lỗi giữa chừng rollback toàn bộ',()=>{
  const db=openDatabase(':memory:');seed(db);
  try {
    const count=db.prepare('SELECT COUNT(*) n FROM products').get().n;
    assert.throws(()=>importDemoCatalog(db,products,()=>{throw new Error('missing asset');}),/missing asset/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,count);
    db.prepare("INSERT INTO brands(name,slug,active) VALUES('Huawei','huawei',0)").run();
    assert.throws(()=>importDemoCatalog(db,products,()=>Buffer.from('test image')),/đã tắt/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,count);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM product_images WHERE storage_key LIKE 'sample-dj-%'").get().n,0);
  } finally {db.close();}
});
