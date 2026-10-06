const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {SQLiteSessionStore,sessionSecret}=require('../src/session-store');
const {mkdtempSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
function fixture(file=':memory:') {
  const db=openDatabase(file);
  db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','one@test.com','test'),(2,'Other','two@test.com','test'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phones','Demo','Demo',100,5); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100,5,1)");
  return db;
}
const submit=(db,key,cart={'1':1},name='Customer',user=1)=>submitCheckout(db,user,key,cart,name,'0901234567','123 Example street');
test('Khóa đặt hàng trả lại đơn sau khi giỏ trống; chặn đổi payload và khách khác',()=>{
  const db=fixture();
  try {
    const key=issueCheckout(db,1,{'1':1}),result=submit(db,key);
    assert.deepEqual(submit(db,key,{}),{id:result.id,replayed:true});
    assert.throws(()=>submit(db,key,{},'Changed'));
    assert.throws(()=>submit(db,key,{},'Customer',2));
    assert.throws(()=>submit(db,'forged'));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,1);
  } finally {db.close();}
});
test('Giá, giỏ thay đổi, hết hạn và lỗi giữa giao dịch không tạo đơn hay giữ kho',()=>{
  const db=fixture();
  try {
    const key=issueCheckout(db,1,{'1':1});
    assert.throws(()=>submit(db,key,{'1':2}));
    db.exec('UPDATE product_variants SET price=200');
    assert.throws(()=>submit(db,key));
    db.exec('UPDATE product_variants SET price=100');
    db.exec("CREATE TRIGGER fail_checkout BEFORE UPDATE OF order_id ON checkout_requests BEGIN SELECT RAISE(ABORT,'test failure'); END");
    assert.throws(()=>submit(db,key));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
    db.exec('DROP TRIGGER fail_checkout; UPDATE checkout_requests SET expires_at=0');
    assert.throws(()=>submit(db,key));
  } finally {db.close();}
});
test('Mở lại CSDL giữ phiên, giỏ, khóa ký và đơn; touch không ghi đè giỏ, logout và hết hạn xóa phiên',()=>{
  const folder=mkdtempSync(join(tmpdir(),'electro-session-')),file=join(folder,'store.sqlite');
  let db=fixture(file);
  const call=(store,method,...args)=>new Promise((resolve,reject)=>store[method](...args,(error,value)=>error?reject(error):resolve(value)));
  return (async()=>{
    try {
      const secret=sessionSecret(db),key=issueCheckout(db,1,{'1':1});
      let store=new SQLiteSessionStore(db);
      const value={userId:1,csrf:'csrf',cart:{'1':1},cookie:{expires:new Date(Date.now()+60000)}};
      await call(store,'set','persist',value);
      db.close();db=openDatabase(file);store=new SQLiteSessionStore(db);
      assert.equal(sessionSecret(db),secret);
      assert.equal((await call(store,'get','persist')).userId,1);
      assert.deepEqual((await call(store,'get','persist')).cart,{'1':1});
      await call(store,'touch','persist',{...value,cart:{}});
      assert.deepEqual((await call(store,'get','persist')).cart,{'1':1});
      const result=submit(db,key);db.close();db=openDatabase(file);
      assert.equal(submit(db,key,{}).id,result.id);
      store=new SQLiteSessionStore(db);await call(store,'destroy','persist');
      assert.equal(await call(store,'get','persist'),null);
      await call(store,'set','expired',{cookie:{expires:new Date(0)}});
      assert.equal(await call(store,'get','expired'),null);
    } finally {
      db.close();
      for(const name of readdirSync(join(folder,'backups'))) unlinkSync(join(folder,'backups',name));
      rmdirSync(join(folder,'backups'));unlinkSync(file);rmdirSync(folder);
    }
  })();
});
