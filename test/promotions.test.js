const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {transitionOrder}=require('../src/orders');
const {promotionQuote}=require('../src/promotions');
function fixture(file=':memory:') {
  const db=openDatabase(file);
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'One','one@test.com','test','CUSTOMER'),(2,'Two','two@test.com','test','CUSTOMER'),(3,'Staff','staff@test.com','test','STAFF'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,10),(2,'Other','Phone','Demo','Demo',2000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,10,1),(2,2,'OTHER',2000,10,1)");
  db.prepare("INSERT INTO promotions(id,code,kind,value,minimum,scope,starts_at,ends_at,total_limit,user_limit) VALUES(1,'LAST','FIXED',100,0,'ALL',?,?,1,1)").run(Date.now()-60000,Date.now()+3600000);
  return db;
}
const submit=(db,key,user=1,cart={'1':1})=>submitCheckout(db,user,key,cart,'Customer','0901234567','123 Example street','LAST');
const change=(db,id,status,actor=3)=>transitionOrder(db,id,status,actor,{version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),reason:'Verified transition'});
test('Mã giảm giữ lượt khi đặt, retry không giữ thêm, hủy trả lượt một lần và bàn giao dùng lượt',()=>{
  const db=fixture();
  try {
    const key=issueCheckout(db,1,{'1':1},'LAST'),second=issueCheckout(db,2,{'1':1},'LAST');
    const {id}=submit(db,key);
    assert.deepEqual(submit(db,key,1,{}),{id,replayed:true});
    assert.throws(()=>submit(db,second,2),/giới hạn|hết lượt/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM promotion_redemptions').get().n,1);
    const snapshot={...db.prepare('SELECT subtotal,discount,total,promotion_code FROM orders WHERE id=?').get(id)};
    assert.deepEqual(snapshot,{subtotal:1000,discount:100,total:900,promotion_code:'LAST'});
    assert.equal(change(db,id,'CANCELLED',1).status,200);
    assert.equal(change(db,id,'CANCELLED',1).status,200);
    assert.equal(db.prepare('SELECT status FROM promotion_redemptions').get().status,'RELEASED');
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,0);
    assert.deepEqual({...db.prepare('SELECT subtotal,discount,total,promotion_code FROM orders WHERE id=?').get(id)},snapshot);
    const next=submit(db,second,2).id;
    for(const status of ['CONFIRMED','PREPARING','SHIPPING']) assert.equal(change(db,next,status).status,200);
    assert.equal(db.prepare('SELECT status FROM promotion_redemptions WHERE order_id=?').get(next).status,'USED');
    assert.equal(change(db,next,'CANCELLED').status,409);
    assert.throws(()=>issueCheckout(db,1,{'1':1},'LAST'),/giới hạn|hết lượt/);
  } finally {db.close();}
});
test('Lỗi lưu lượt mã hoặc kết quả checkout rollback đơn, kho, lịch sử và lượt; khóa có thể thử lại',()=>{
  const db=fixture();
  try {
    const key=issueCheckout(db,1,{'1':1},'LAST');
    for(const sql of ["CREATE TRIGGER fail BEFORE INSERT ON promotion_redemptions BEGIN SELECT RAISE(ABORT,'forced failure'); END", "CREATE TRIGGER fail BEFORE UPDATE OF order_id ON checkout_requests BEGIN SELECT RAISE(ABORT,'forced failure'); END"]) {
      db.exec(sql);
      assert.throws(()=>submit(db,key),/forced failure/);
      for(const table of ['orders','order_items','order_history','inventory_reservations','inventory_movements','promotion_redemptions']) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0,table);
      assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,0);
      assert.equal(db.prepare('SELECT order_id FROM checkout_requests WHERE request_key=?').get(key).order_id,null);
      db.exec('DROP TRIGGER fail');
    }
    assert.ok(submit(db,key).id);
  } finally {db.close();}
});
test('Lỗi ghi lịch sử hủy giữ nguyên lượt, reservation, kho và trạng thái đơn',()=>{
  const db=fixture();
  try {
    const id=submit(db,issueCheckout(db,1,{'1':1},'LAST')).id;
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON order_history BEGIN SELECT RAISE(ABORT,'forced failure'); END");
    assert.throws(()=>change(db,id,'CANCELLED',1),/forced failure/);
    assert.equal(db.prepare('SELECT status FROM orders').get().status,'PENDING');
    assert.equal(db.prepare('SELECT status FROM promotion_redemptions').get().status,'HELD');
    assert.equal(db.prepare('SELECT status FROM inventory_reservations').get().status,'HELD');
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,1);
    db.exec('DROP TRIGGER fail');
    assert.equal(change(db,id,'CANCELLED',1).status,200);
  } finally {db.close();}
});
test('Giảm phần trăm theo sản phẩm, trần, tối thiểu, thời hạn và mã thay đổi sau báo giá',()=>{
  const db=fixture();
  try {
    db.exec("UPDATE promotions SET kind='PERCENT',value=50,cap=300,scope='PRODUCT'; INSERT INTO promotion_products VALUES(1,1)");
    assert.equal(promotionQuote(db,1,[[1,1,1000],[2,1,2000]],'last').discount,300);
    assert.throws(()=>promotionQuote(db,1,[[2,1,2000]],'LAST'),/phù hợp/);
    db.exec('UPDATE promotions SET cap=5000,value=100');
    assert.equal(promotionQuote(db,1,[[1,1,1000]],'LAST').discount,999);
    db.exec('UPDATE promotions SET minimum=5000');
    assert.throws(()=>promotionQuote(db,1,[[1,1,1000]],'LAST'),/tối thiểu/);
    db.exec('UPDATE promotions SET minimum=0');
    const promo=db.prepare('SELECT * FROM promotions').get();
    assert.throws(()=>promotionQuote(db,1,[[1,1,1000]],'LAST',promo.starts_at-1),/hiệu lực/);
    assert.throws(()=>promotionQuote(db,1,[[1,1,1000]],'LAST',promo.ends_at),/hết hạn/);
    const key=issueCheckout(db,1,{'1':1},'LAST');
    db.exec('UPDATE promotions SET cap=100');
    assert.throws(()=>submit(db,key),/thay đổi/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
  } finally {db.close();}
});
test('Hai kết nối tranh lượt mã cuối: chỉ một đơn giữ lượt dù kho đủ cho cả hai', {timeout:15000},async()=>{
  const {Worker}=require('node:worker_threads');
  const {mkdtempSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
  const {join}=require('node:path');
  const directory=mkdtempSync(join(require('node:os').tmpdir(),'electro-promo-race-'));
  const file=join(directory,'store.sqlite'),workers=[];
  let db;
  try {
    db=fixture(file);
    const keys=[1,2].map(user=>issueCheckout(db,user,{'1':1},'LAST'));
    db.close();db=null;
    const source=`const {parentPort,workerData:d}=require('node:worker_threads');const db=require(d.dbModule).openDatabase(d.file);parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{const result=require(d.checkoutModule).submitCheckout(db,d.user,d.key,{'1':1},'Customer','0901234567','123 Example street','LAST');parentPort.postMessage({ok:true,...result});}catch(error){parentPort.postMessage({ok:false,error:error.message});}finally{db.close();}});`;
    const tasks=keys.map((key,index)=>{
      const worker=new Worker(source,{eval:true,workerData:{file,key,user:index+1,dbModule:require.resolve('../src/db'),checkoutModule:require.resolve('../src/checkout')}});
      workers.push(worker);
      let readyResolve,resultResolve,readyReject,resultReject;
      const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
      const result=new Promise((resolve,reject)=>{resultResolve=resolve;resultReject=reject;});
      // Observe result rejection even if startup fails before awaiting results.
      result.catch(()=>{});
      worker.on('message',message=>message.ready?readyResolve():resultResolve(message));
      worker.on('error',error=>{readyReject(error);resultReject(error);});
      worker.on('exit',code=>{if(code!==0){const error=new Error('Worker exit '+code);readyReject(error);resultReject(error);}});
      return {ready,result,worker};
    });
    await Promise.all(tasks.map(task=>task.ready));
    tasks.forEach(task=>task.worker.postMessage('start'));
    const results=await Promise.all(tasks.map(task=>task.result));
    assert.equal(results.filter(result=>result.ok).length,1);
    assert.match(results.find(result=>!result.ok).error,/giới hạn|hết lượt/);
    db=openDatabase(file);
    for(const table of ['orders','promotion_redemptions','inventory_reservations']) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,1);
    assert.equal(db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get().reserved,1);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {
    await Promise.all(workers.map(worker=>worker.terminate()));
    if(db) db.close();
    // Only remove individual files in this test's dedicated temporary directory.
    for(const name of readdirSync(join(directory,'backups'))) unlinkSync(join(directory,'backups',name));
    rmdirSync(join(directory,'backups'));
    for(const name of readdirSync(directory)) unlinkSync(join(directory,name));
    rmdirSync(directory);
  }
});
