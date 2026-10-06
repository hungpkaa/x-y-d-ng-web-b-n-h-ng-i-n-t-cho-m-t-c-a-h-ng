const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {mkdtempSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {openDatabase}=require('../src/db');
const {createOrder}=require('../src/orders');
test('Khách hủy và nhân viên xác nhận đồng thời: chỉ một trạng thái thắng, kho khớp kết quả',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'electro-cancel-race-')),file=join(folder,'store.sqlite'),workers=[];
  let db;
  try {
    db=openDatabase(file);
    db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','c@test.com','test','CUSTOMER'),(2,'Staff','s@test.com','test','STAFF'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',100,1); INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(1,1,'PHONE',100,1,1)");
    const id=createOrder(db,1,{'1':1},'Customer','0901234567','Test address');db.close();db=null;
    const code=`const {parentPort,workerData:d}=require('node:worker_threads');const db=require(d.dbModule).openDatabase(d.file);const {transitionOrder}=require(d.ordersModule);parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{parentPort.postMessage(transitionOrder(db,d.id,d.status,d.actor,{version:1,reason:'Concurrent request'}));}finally{db.close();}});`;
    const tasks=[{actor:1,status:'CANCELLED'},{actor:2,status:'CONFIRMED'}].map(action=>{
      const worker=new Worker(code,{eval:true,workerData:{...action,file,id,dbModule:require.resolve('../src/db'),ordersModule:require.resolve('../src/orders')}});workers.push(worker);
      let readyResolve,resultResolve,reject;
      const ready=new Promise(resolve=>readyResolve=resolve),result=new Promise((resolve,fail)=>{resultResolve=resolve;reject=fail;});
      worker.on('message',message=>message.ready?readyResolve():resultResolve(message));worker.on('error',error=>{readyResolve();reject(error);});
      return {worker,ready,result};
    });
    await Promise.all(tasks.map(task=>task.ready));tasks.forEach(task=>task.worker.postMessage('start'));
    const results=await Promise.all(tasks.map(task=>task.result));assert.equal(results.filter(result=>result.status===200).length,1);assert.equal(results.filter(result=>result.status===409).length,1);
    db=openDatabase(file);
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id),variant=db.prepare('SELECT * FROM product_variants').get();
    assert.equal(order.version,2);assert.ok(['CANCELLED','CONFIRMED'].includes(order.status));assert.equal(variant.on_hand,1);
    assert.equal(variant.reserved,order.status==='CANCELLED'?0:1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM order_history WHERE order_id=?').get(id).n,2);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_logs').get().n,1);
  } finally {
    await Promise.all(workers.map(worker=>worker.terminate()));if(db)db.close();
    for(const name of readdirSync(join(folder,'backups')))unlinkSync(join(folder,'backups',name));rmdirSync(join(folder,'backups'));
    for(const name of readdirSync(folder))unlinkSync(join(folder,name));rmdirSync(folder);
  }
});
