const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {mkdtempSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {openDatabase}=require('../src/db');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {transitionOrder}=require('../src/orders');
const payments=require('../src/payments');
const config={tmnCode:'TESTCODE',secret:'concurrency-test-signing-key'};
async function race(tasks) {
  const workers=[],source=`const {parentPort,workerData:d}=require('node:worker_threads');const db=require(d.dbModule).openDatabase(d.file);parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{const result=require(d.paymentModule)[d.method](db,...d.args);parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,error:error.message});}finally{db.close();}});`;
  try {
    const jobs=tasks.map(task=>{
      const worker=new Worker(source,{eval:true,workerData:{...task,dbModule:require.resolve('../src/db'),paymentModule:require.resolve('../src/payments')}});workers.push(worker);
      let readyResolve,resultResolve,readyReject,resultReject;
      const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
      const result=new Promise((resolve,reject)=>{resultResolve=resolve;resultReject=reject;});result.catch(()=>{});
      worker.on('message',message=>message.ready?readyResolve():resultResolve(message));
      worker.on('error',error=>{readyReject(error);resultReject(error);});
      worker.on('exit',code=>{if(code!==0){const error=new Error('Worker exit '+code);readyReject(error);resultReject(error);}});
      return {worker,ready,result};
    });
    await Promise.all(jobs.map(job=>job.ready));jobs.forEach(job=>job.worker.postMessage('start'));
    return await Promise.all(jobs.map(job=>job.result));
  } finally {await Promise.all(workers.map(worker=>worker.terminate()));}
}
for(const mode of ['duplicate-ipn','expire-ipn','refund']) test('Hai kết nối đồng thời: '+mode,{timeout:15000},async()=>{
  const directory=mkdtempSync(join(tmpdir(),'electro-payment-race-')),file=join(directory,'store.sqlite');
  let db;
  try {
    db=openDatabase(file);
    db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com','hash','CUSTOMER'),(2,'Admin','admin@test.com','hash','ADMIN'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,10); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',1000,10,1)");
    const key=issueCheckout(db,1,{'1':1},'','ONLINE'),id=submitCheckout(db,1,key,{'1':1},'Customer','0901234567','123 Example street','','ONLINE').id;
    const payment=db.prepare('SELECT * FROM payments').get(),query={vnp_TmnCode:config.tmnCode,vnp_TxnRef:payment.reference,vnp_Amount:'100000',vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'12345',vnp_PayDate:payments.vnpDate(Date.now()-1000)};
    query.vnp_SecureHash=payments.signature(query,config.secret);
    const ipn={file,method:'processIpn',args:[query,config]};
    let tasks=[ipn,ipn];
    if(mode==='expire-ipn') {
      db.prepare('UPDATE orders SET payment_deadline=? WHERE id=?').run(Date.now()-1,id);
      tasks=[{file,method:'expirePayments',args:[]},ipn];
    }
    if(mode==='refund') {
      payments.processIpn(db,query,config);
      const version=db.prepare('SELECT version FROM orders').get().version;
      assert.equal(transitionOrder(db,id,'CANCELLED',1,{version:String(version),reason:'Cancel for refund'}).status,200);
      const refund={version:String(db.prepare('SELECT version FROM orders').get().version),amount:'1000',reference:'REFUND-ONE',evidence_ref:'BANK-EVIDENCE',note:'Verified external refund',occurred_at:new Date(Date.now()+7*3600000).toISOString().slice(0,19)};
      tasks=[{file,method:'recordRefund',args:[{id:2},payment.id,refund]},{file,method:'recordRefund',args:[{id:2},payment.id,{...refund,reference:'REFUND-TWO'}]}];
    }
    db.close();db=null;
    const results=await race(tasks);assert.ok(results.every(result=>result.ok));
    db=openDatabase(file);
    if(mode==='duplicate-ipn') {
      assert.deepEqual(results.map(result=>result.result.RspCode).sort(),['00','02']);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_events').get().n,1);
      assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'PAID');
    } else if(mode==='expire-ipn') {
      assert.equal(db.prepare('SELECT status FROM orders').get().status,'CANCELLED');
      assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'REFUND_PENDING');
      assert.equal(db.prepare('SELECT reserved FROM product_variants').get().reserved,0);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE source_key LIKE 'cancelled:%'").get().n,1);
    } else {
      assert.deepEqual(results.map(result=>result.result.status).sort(),[200,409]);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds').get().n,1);
      assert.equal(db.prepare('SELECT payment_status FROM orders').get().payment_status,'REFUNDED');
    }
    assert.equal(db.prepare("SELECT COUNT(*) n FROM payments WHERE status='SUCCEEDED'").get().n,1);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {
    if(db) db.close();
    for(const name of readdirSync(join(directory,'backups'))) unlinkSync(join(directory,'backups',name));rmdirSync(join(directory,'backups'));
    for(const name of readdirSync(directory)) unlinkSync(join(directory,name));rmdirSync(directory);
  }
});
