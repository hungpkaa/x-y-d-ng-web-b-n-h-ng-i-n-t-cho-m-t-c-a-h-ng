const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {readCart,updateCart,mergeCart}=require('../src/account-cart');
const {issueCheckout,submitAccountCheckout}=require('../src/checkout');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec(`INSERT INTO users(id,name,email,password) VALUES(1,'One','one@test.com','hash'),(2,'Two','two@test.com','hash');
    INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,200);
    INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,200,1),(2,1,'PHONE-2',2000,10,1);`);
  return db;
}
const actor={id:1};
const set=(db,id,q)=>updateCart(db,actor,{variant_id:id,quantity:q,version:readCart(db,actor).version});
const source='a'.repeat(64);
const submit=(db,key)=>submitAccountCheckout(db,actor,key,'One','0901234567','123 Example street');

test('AT-36/37: gộp đúng SKU một lần, replay sau chỉnh giỏ không cộng lại, không nhận nguồn của khách khác',()=>{
  const db=fixture();try {
    set(db,1,2);
    assert.deepEqual(mergeCart(db,actor,source,{'1':1,'2':1}).quantities,{'1':3,'2':1});
    assert.equal(mergeCart(db,actor,source,{'1':1,'2':1}).replayed,true);
    set(db,1,1);
    assert.equal(mergeCart(db,actor,source,{'1':1,'2':1}).quantities['1'],1);
    assert.equal(mergeCart(db,{id:2},source,{'1':1,'2':1}).status,409);
    assert.equal(mergeCart(db,actor,source,{'1':2}).status,409);
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,0);
  } finally {db.close();}
});

test('AT-38: vượt 99 được giữ đủ lượng mong muốn và chặn đặt cho tới khi khách chỉnh',()=>{
  const db=fixture();try {
    set(db,1,98);
    const merged=mergeCart(db,actor,source,{'1':5});
    assert.equal(merged.quantities['1'],103);assert.equal(merged.canCheckout,false);
    assert.equal(db.prepare('SELECT quantity FROM cart_items').get().quantity,98);
    assert.equal(set(db,1,4).quantities['1'],4);
    assert.equal(readCart(db,actor).canCheckout,true);
    assert.equal(mergeCart(db,actor,source,{'1':5}).quantities['1'],4);
  } finally {db.close();}
});

test('Gộp vượt tồn giữ số lượng để chỉnh; SKU đã xóa được giữ dạng chờ và có thể xóa khỏi giỏ',()=>{
  const db=fixture();try {
    set(db,2,8);
    const merged=mergeCart(db,actor,source,{'2':5,'999':1});
    assert.equal(merged.quantities['2'],13);assert.equal(merged.quantities['999'],1);
    assert.equal(merged.canCheckout,false);
    assert.equal(set(db,999,0).status,200);assert.equal(set(db,2,2).status,200);
    assert.equal(readCart(db,actor).canCheckout,true);
  } finally {db.close();}
});

test('Gộp lỗi ghi dấu rollback, thử lại không mất giỏ hoặc cộng hai lần',()=>{
  const db=fixture();try {
    set(db,1,1);
    const before=readCart(db,actor);
    db.exec("CREATE TRIGGER fail_merge BEFORE INSERT ON cart_merges BEGIN SELECT RAISE(ABORT,'forced merge failure'); END");
    assert.throws(()=>mergeCart(db,actor,source,{'1':2}),/forced merge failure/);
    assert.deepEqual(readCart(db,actor),before);
    db.exec('DROP TRIGGER fail_merge');
    assert.equal(mergeCart(db,actor,source,{'1':2}).quantities['1'],3);
  } finally {db.close();}
});

test('Gộp quá 100 dòng giữ mục vượt ở danh sách cần chỉnh, không âm thầm bỏ',()=>{
  const db=fixture();try {
    set(db,1,1);
    const cartId=readCart(db,actor).cartId;
    for(let id=2;id<=101;id++) {
      if(id>2) db.prepare('INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(?,1,?,1000,5,1)').run(id,'SKU-'+id);
      if(id<=100) db.prepare('INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES(?,?,1)').run(cartId,id);
    }
    const merged=mergeCart(db,actor,source,{'101':1});
    assert.equal(Object.keys(merged.quantities).length,101);
    assert.equal(merged.canCheckout,false);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cart_items').get().n,100);
    assert.equal(set(db,101,1).status,400);
    set(db,1,0);
    assert.equal(set(db,101,1).status,200);
    assert.equal(readCart(db,actor).canCheckout,true);
  } finally {db.close();}
});

test('Tạo đơn và bỏ mục đã mua cùng giao dịch; replay không xóa hàng thêm sau đó',()=>{
  const db=fixture();try {
    set(db,1,1);
    const key=issueCheckout(db,1,readCart(db,actor).quantities);
    const placed=submit(db,key);
    assert.ok(placed.id);assert.deepEqual(readCart(db,actor).quantities,{});
    set(db,2,1);
    assert.equal(submit(db,key).id,placed.id);
    assert.deepEqual(readCart(db,actor).quantities,{'2':1});
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
  } finally {db.close();}
});

test('Lỗi xóa giỏ sau tạo đơn rollback cả đơn/kho/request; đổi giá trước xác nhận không làm mất giỏ',()=>{
  const db=fixture();try {
    set(db,1,1);const key=issueCheckout(db,1,readCart(db,actor).quantities);
    db.exec("CREATE TRIGGER fail_consume BEFORE DELETE ON cart_items BEGIN SELECT RAISE(ABORT,'forced consume failure'); END");
    assert.throws(()=>submit(db,key),/forced consume failure/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,0);
    assert.equal(db.prepare('SELECT order_id FROM checkout_requests WHERE request_key=?').get(key).order_id,null);
    assert.equal(readCart(db,actor).quantities['1'],1);
    db.exec('DROP TRIGGER fail_consume; UPDATE product_variants SET price=3000 WHERE id=1');
    assert.throws(()=>submit(db,key),/giá đã thay đổi/);
    assert.equal(readCart(db,actor).quantities['1'],1);
  } finally {db.close();}
});
