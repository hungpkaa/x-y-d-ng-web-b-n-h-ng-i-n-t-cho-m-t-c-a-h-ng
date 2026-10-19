const test=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,seed}=require('../src/db');
const {withCartImages}=require('../src/cart-presentation');
test('Ảnh giỏ: giữ nguyên tiền/tồn, chọn ảnh đầu và không dẫn tới ảnh sản phẩm ẩn',()=>{
  const db=openDatabase(':memory:');seed(db);
  try {
    const variant=db.prepare('SELECT id,product_id FROM product_variants ORDER BY id LIMIT 1').get();
    db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)').run(variant.product_id,'second.webp',Buffer.from('x'),'Second',2);
    db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)').run(variant.product_id,'first.webp',Buffer.from('x'),'First',0);
    const item={id:variant.id,price:120,quantity:2,stock:5};
    const [row]=withCartImages(db,[item]);
    assert.equal(row.image_key,'first.webp');assert.equal(row.product_url,`/products/${variant.product_id}?sku=${variant.id}`);
    assert.equal(row.price,120);assert.equal(row.quantity,2);assert.equal(row.stock,5);assert.equal(item.image_key,undefined);
    db.prepare("UPDATE products SET status='HIDDEN' WHERE id=?").run(variant.product_id);
    const [hidden,missing]=withCartImages(db,[item,{id:999999}]);
    assert.equal(hidden.image_key,null);assert.equal(hidden.product_url,null);assert.equal(missing.image_key,null);
    assert.deepEqual(withCartImages(db,[]),[]);
  } finally {db.close();}
});
