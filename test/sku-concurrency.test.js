const { test }=require('node:test');
const assert=require('node:assert/strict');
const { Worker }=require('node:worker_threads');
const { mkdtempSync,readdirSync,unlinkSync,rmdirSync }=require('node:fs');
const { tmpdir }=require('node:os');
const { join }=require('node:path');
const { openDatabase }=require('../src/db');
test('Hai kết nối đặt đồng thời SKU cuối: đúng một đơn giữ hàng',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'electro-sku-race-'));
  const file=join(directory,'store.sqlite');
  const workers=[];
  let db;
  try {
    db=openDatabase(file);
    db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','test@example.com','test'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100,1); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'LAST-SKU',100,1,1);");
    db.close(); db=null;
    const code=`const {parentPort,workerData}=require('node:worker_threads');const db=require(workerData.dbModule).openDatabase(workerData.file);const {createOrder}=require(workerData.ordersModule);parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{const id=createOrder(db,1,{'1':1},'Customer','0901234567','Test address');parentPort.postMessage({ok:true,id});}catch(error){parentPort.postMessage({ok:false,error:error.message});}finally{db.close();}});`;
    const tasks=[0,1].map(()=>{
      const worker=new Worker(code,{eval:true,workerData:{file,dbModule:require.resolve('../src/db'),ordersModule:require.resolve('../src/orders')}});
      workers.push(worker);
      let readyResolve,resultResolve,reject;
      const ready=new Promise(resolve=>{readyResolve=resolve;});
      const result=new Promise((resolve,fail)=>{resultResolve=resolve;reject=fail;});
      worker.on('message',message=>message.ready?readyResolve():resultResolve(message));
      worker.on('error',error=>{readyResolve();reject(error);});
      return {ready,result,worker};
    });
    await Promise.all(tasks.map(item=>item.ready));
    tasks.forEach(item=>item.worker.postMessage('start'));
    const results=await Promise.all(tasks.map(item=>item.result));
    assert.equal(results.filter(item=>item.ok).length,1);
    assert.match(results.find(item=>!item.ok).error,/không còn bán hoặc không đủ hàng/);
    db=openDatabase(file);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_reservations').get().n,1);
    assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,1);
  } finally {
    await Promise.all(workers.map(worker=>worker.terminate()));
    if(db) db.close();
    for(const name of readdirSync(join(directory,'backups'))) unlinkSync(join(directory,'backups',name));
    rmdirSync(join(directory,'backups'));
    for(const name of readdirSync(directory)) unlinkSync(join(directory,name));
    rmdirSync(directory);
  }
});
