const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const {mkdtempSync,readFileSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {Worker}=require('node:worker_threads');
const {PostgresDatabase}=require('../src/postgres');
const {migratePostgres}=require('../src/postgres-migrations');
const {issueCheckout,submitCheckout}=require('../src/checkout');
const {transitionOrder}=require('../src/orders');
const pay=require('../src/payments');
const {salesReport}=require('../src/reporting');
const {seed,openDatabase}=require('../src/db');
const {saveAddress,rateLimit,issuePasswordReset,resetPassword,createSupport,replySupport,supportDetail,listSupport}=require('../src/customer-services');
const {listPromotions}=require('../src/promotions');
const {saveReview,moderateReview,publicReviews,listReviews}=require('../src/reviews');
const {listRecords}=require('../src/management-list');
const {importSqlite}=require('../scripts/import-sqlite-to-postgres');

const enabled=process.env.POSTGRES_TEST==='1'&&!!process.env.DATABASE_URL;
test('PostgreSQL: favorites, recent views, durable watch notifications and image ordering',{skip:!enabled},t=>{
  const {db,user,admin}=fixture(t),engagement=require('../src/engagement');
  assert.equal(engagement.favorite(db,{id:user},1,'add').status,200);
  engagement.recordView(db,{id:user},2);engagement.recordView(db,{id:user},1);
  assert.deepEqual(engagement.recent(db,{id:user}).map(row=>row.id),[1,2]);
  assert.equal(engagement.favorites(db,{id:user}).rows.length,1);
  db.exec('UPDATE product_variants SET on_hand=0 WHERE id=1');
  assert.equal(engagement.watch(db,{id:user},1,{stock_enabled:'1',price_enabled:'1'}).status,200);
  db.exec('UPDATE product_variants SET on_hand=3,price=price-1000,version=version+1 WHERE id=1');
  engagement.scan(db);engagement.scan(db);
  assert.deepEqual(engagement.notifications(db,{id:user}).rows.map(row=>row.kind).sort(),['PRICE','RESTOCK']);
  const insert=db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)');
  const first=Number(insert.run(1,'pg-first',Buffer.from('first'),'First',0).lastInsertRowid);
  const second=Number(insert.run(1,'pg-second',Buffer.from('second'),'Second',1).lastInsertRowid);
  const version=db.prepare('SELECT version FROM products WHERE id=1').get().version;
  assert.equal(require('../src/product-images').reorderImages(db,{id:admin,role:'ADMIN'},1,{version:String(version),ids:[second,first]}).status,200);
  assert.equal(db.prepare('SELECT id FROM product_images WHERE product_id=1 ORDER BY sort_order,id LIMIT 1').get().id,second);
});
const config={tmnCode:'TESTCODE',secret:'test-only-key'};
function fixture(t) {
  const root=new PostgresDatabase(process.env.DATABASE_URL);
  const schema='test_pg_'+randomBytes(8).toString('hex');
  root.exec(`CREATE SCHEMA "${schema}"`);
  const db=new PostgresDatabase(process.env.DATABASE_URL,{schema});
  t.after(()=>{db.close();root.exec(`DROP SCHEMA "${schema}" CASCADE`);root.close();});
  migratePostgres(db);migratePostgres(db);seed(db);
  const user=Number(db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Customer','pg@test.com','hash','CUSTOMER').lastInsertRowid);
  const admin=Number(db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Admin','admin-pg@test.com','hash','ADMIN').lastInsertRowid);
  return {db,schema,user,admin};
}
function online(db,user) {
  const key=issueCheckout(db,user,{'1':1},'','ONLINE');
  const result=submitCheckout(db,user,key,{'1':1},'Customer','0901234567','123 Example street','','ONLINE');
  assert.ok(result.id);return {key,id:result.id,payment:db.prepare('SELECT * FROM payments WHERE order_id=?').get(result.id)};
}
function signed(payment,transaction='123456') {
  const query={vnp_TmnCode:config.tmnCode,vnp_TxnRef:payment.reference,vnp_Amount:String(payment.amount*100),vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:transaction,vnp_PayDate:pay.vnpDate(Date.now()-1000)};
  return {...query,vnp_SecureHash:pay.signature(query,config.secret)};
}
function move(db,id,status,admin) {
  if(['SHIPPING','DELIVERED'].includes(status)) {
    const shipmentService=require('../src/shipments'),order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    const proof={occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19),evidence_ref:'PG-HANDOFF',reason:'Verified carrier record'};
    if(status==='SHIPPING') {
      const created=shipmentService.createShipment(db,{id:admin},id,{version:String(order.version),provider:'TEST PG',tracking_number:'TRACK-'+id,...proof});assert.equal(created.status,200);
    }
    const shipment=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(id);
    return shipmentService.changeShipment(db,{id:admin},shipment.id,{status:status==='SHIPPING'?'IN_TRANSIT':'DELIVERED',version:String(shipment.version),order_version:String(order.version),request_key:randomBytes(16).toString('hex'),...proof});
  }
  return transitionOrder(db,id,status,admin,{version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(id).version),reason:'Verified PostgreSQL transition'});
}

test('PostgreSQL: checkout replay, signed IPN, delivery and report money totals',{skip:!enabled},t=>{
  const {db,user,admin}=fixture(t),order=online(db,user);
  assert.equal(submitCheckout(db,user,order.key,{},'Customer','0901234567','123 Example street','','ONLINE').id,order.id);
  const query=signed(order.payment);
  assert.equal(pay.processIpn(db,query,config).RspCode,'00');
  assert.equal(pay.processIpn(db,query,config).RspCode,'02');
  for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) assert.equal(move(db,order.id,status,admin).status,200);
  const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10),report=salesReport(db,{from:day,to:day});
  assert.equal(report.summary.revenue,order.payment.amount);
  assert.equal(report.summary.onlineCash,order.payment.amount);
  assert.equal(report.summary.recognizedOrders,1);
  assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,0);
});

test('PostgreSQL: late capture cancels once and full refund leaves stock unchanged',{skip:!enabled},t=>{
  const {db,user,admin}=fixture(t),order=online(db,user);
  db.prepare('UPDATE orders SET payment_deadline=? WHERE id=?').run(Date.now()-1,order.id);
  assert.equal(pay.processIpn(db,signed(order.payment),config).RspCode,'00');
  assert.equal(db.prepare('SELECT status,payment_status FROM orders WHERE id=?').get(order.id).payment_status,'REFUND_PENDING');
  const before=db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get();
  const input={version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(order.id).version),amount:String(order.payment.amount),reference:'REFUND-PG',evidence_ref:'BANK-PG',note:'Confirmed full refund',occurred_at:new Date(Date.now()+7*3600000).toISOString().slice(0,19)};
  assert.equal(pay.recordRefund(db,{id:admin},order.payment.id,input).status,200);
  assert.equal(pay.recordRefund(db,{id:admin},order.payment.id,input).status,200);
  assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(order.id).payment_status,'REFUNDED');
  assert.deepEqual(db.prepare('SELECT on_hand,reserved FROM product_variants WHERE id=1').get(),before);
});

test('PostgreSQL: failed delivery and duplicate return restore stock once and retain refund liability',{skip:!enabled},t=>{
  const {db,user,admin}=fixture(t),order=online(db,user),shipments=require('../src/shipments');
  const original=db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand;
  assert.equal(pay.processIpn(db,signed(order.payment),config).RspCode,'00');
  for(const status of ['CONFIRMED','PREPARING','SHIPPING']) assert.equal(move(db,order.id,status,admin).status,200);
  const shipment=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(order.id);
  const body=status=>({status,version:String(db.prepare('SELECT version FROM shipments WHERE id=?').get(shipment.id).version),order_version:String(db.prepare('SELECT version FROM orders WHERE id=?').get(order.id).version),request_key:randomBytes(16).toString('hex'),evidence_ref:'PG-RETURN-RECEIPT',reason:'Warehouse verified physical return',occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19)});
  assert.equal(shipments.changeShipment(db,{id:admin},shipment.id,body('FAILED')).status,200);
  assert.equal(db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand,original-1);
  const returned=body('RETURNED');
  assert.equal(shipments.changeShipment(db,{id:admin},shipment.id,returned).status,200);
  assert.equal(shipments.changeShipment(db,{id:admin},shipment.id,returned).status,200);
  assert.equal(db.prepare('SELECT on_hand FROM product_variants WHERE id=1').get().on_hand,original);
  assert.equal(pay.listRefunds(db).rows.length,1);
  assert.equal(shipments.list(db,{id:admin},{q:'TRACK',status:'RETURNED'}).rows.length,1);
});

test('PostgreSQL: promotion limits, review moderation, private support and list filters',{skip:!enabled},t=>{
  const {db,user,admin}=fixture(t);
  db.prepare("INSERT INTO promotions(code,kind,value,scope,starts_at,ends_at,total_limit,user_limit) VALUES('PG-LAST','FIXED',100,'ALL',?,?,1,1)").run(Date.now()-60000,Date.now()+3600000);
  assert.equal(listPromotions(db,{q:'pg'}).rows.length,1);
  assert.equal(listPromotions(db,{active:'0'}).rows.length,0);
  const key=issueCheckout(db,user,{'1':1},'PG-LAST'),key2=issueCheckout(db,user,{'1':1},'PG-LAST');
  const {id}=submitCheckout(db,user,key,{'1':1},'Customer','0901234567','123 Example street','PG-LAST');
  assert.equal(db.prepare('SELECT discount FROM orders WHERE id=?').get(id).discount,100);
  assert.throws(()=>submitCheckout(db,user,key2,{'1':1},'Customer','0901234567','123 Example street','PG-LAST'));
  for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']) assert.equal(move(db,id,status,admin).status,200);
  const item=db.prepare('SELECT id FROM order_items WHERE order_id=?').get(id).id;
  const review=saveReview(db,{id:user},item,{version:'0',rating:'5',content:'Verified PostgreSQL purchase'});
  assert.equal(review.status,200);
  assert.equal(publicReviews(db,1).summary.count,0);
  const reviewId=db.prepare('SELECT id FROM reviews WHERE order_item_id=?').get(item).id;
  assert.equal(moderateReview(db,{id:admin},reviewId,{version:'1',status:'APPROVED',reason:'Verified review'}).status,200);
  assert.equal(publicReviews(db,1).summary.average,5);
  assert.equal(listReviews(db,{status:'APPROVED',q:'PostgreSQL'}).rows.length,1);
  const ticket=createSupport(db,{id:user},{order_id:String(id),subject:'Order help',content:'Public question'});
  assert.equal(ticket.status,200);
  assert.equal(replySupport(db,{id:admin},ticket.id,{version:'1',content:'Private staff note',internal:'1'}).status,200);
  assert.equal(supportDetail(db,{id:user},ticket.id).messages.length,1);
  assert.equal(supportDetail(db,{id:admin},ticket.id).messages.length,2);
  assert.equal(listSupport(db,{id:user},{q:'help'}).rows.length,1);
  assert.equal(listRecords(db,'accounts',{q:'customer'}).rows.length,1);
  assert.equal(listRecords(db,'orders',{q:'customer'}).rows.length,1);
});

test('PostgreSQL: transaction rollback, bytea roundtrip, catalog rename and addresses',{skip:!enabled},t=>{
  const {db,user}=fixture(t);
  const before=db.prepare('SELECT COUNT(*) n FROM users').get().n;
  assert.throws(()=>{db.exec('BEGIN IMMEDIATE');try {
    db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run('New','unique-pg@test.com','hash');
    db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run('Duplicate','pg@test.com','hash');db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}},/UNIQUE/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,before);
  const image=Buffer.from([0,255,10,20,30]);
  db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text) VALUES(1,?,?,?)').run('pg-image',image,'Image');
  assert.deepEqual(db.prepare('SELECT data FROM product_images WHERE storage_key=?').get('pg-image').data,image);
  db.prepare('UPDATE categories SET name=? WHERE id=1').run('Updated category');
  assert.equal(db.prepare('SELECT category FROM products WHERE category_id=1 LIMIT 1').get().category,'Updated category');
  assert.equal(saveAddress(db,{id:user},null,{label:'Home',recipient:'Customer',phone:'0901234567',address:'123 Example street'}).status,200);
  assert.equal(rateLimit(db,'pg-limit',1),true);
  assert.equal(rateLimit(db,'pg-limit',1),false);
  const reset=issuePasswordReset(db,'pg@test.com');
  assert.equal(resetPassword(db,reset.token,{password:'NewPassword12345',confirm_password:'NewPassword12345'}).status,200);
  assert.equal(resetPassword(db,reset.token,{password:'NewPassword12345',confirm_password:'NewPassword12345'}).status,400);
});

test('PostgreSQL: import preserves SQLite bytes, IDs, blobs and resets sequences; refuses overwrite',{skip:!enabled},t=>{
  const root=new PostgresDatabase(process.env.DATABASE_URL),schema='test_import_'+randomBytes(8).toString('hex');
  root.exec(`CREATE SCHEMA "${schema}"`);
  t.after(()=>{root.exec(`DROP SCHEMA "${schema}" CASCADE`);root.close();});
  const directory=mkdtempSync(join(tmpdir(),'electro-pg-import-')),file=join(directory,'source.sqlite');
  t.after(()=>{const backups=join(directory,'backups');for(const name of readdirSync(backups)) unlinkSync(join(backups,name));rmdirSync(backups);for(const name of readdirSync(directory)) unlinkSync(join(directory,name));rmdirSync(directory);});
  const source=openDatabase(file);seed(source);
  source.prepare('INSERT INTO users(id,name,email,password) VALUES(?,?,?,?)').run(500,'Imported','import@test.com','hash');
  const image=Buffer.from([0,255,22,11]);source.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text) VALUES(1,?,?,?)').run('import-image',image,'Imported image');source.close();
  const fingerprint=()=>createHash('sha256').update(readFileSync(file)).digest('hex'),before=fingerprint();
  const result=importSqlite(file,process.env.DATABASE_URL,{schema});
  assert.equal(fingerprint(),before);assert.equal(result.counts.users,1);assert.equal(result.counts.products,6);
  const target=new PostgresDatabase(process.env.DATABASE_URL,{schema});
  try {
    assert.equal(target.prepare('SELECT name FROM users WHERE id=500').get().name,'Imported');
    assert.deepEqual(target.prepare('SELECT data FROM product_images').get().data,image);
    assert.equal(target.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run('Next','next@test.com','hash').lastInsertRowid,501);
    assert.throws(()=>importSqlite(file,process.env.DATABASE_URL,{schema}),/đã có dữ liệu/);
    assert.equal(target.prepare('SELECT COUNT(*) n FROM users').get().n,2);
  } finally {target.close();}
});

test('PostgreSQL: two connections compete for last SKU without overselling',{skip:!enabled,timeout:30000},async t=>{
  const {db,user,schema}=fixture(t);
  db.exec('UPDATE product_variants SET on_hand=1,reserved=0 WHERE id=1');
  const keys=[issueCheckout(db,user,{'1':1}),issueCheckout(db,user,{'1':1})];
  const workers=[];
  t.after(async()=>{await Promise.all(workers.map(worker=>worker.terminate()));});
  const tasks=keys.map(key=>new Promise((resolve,reject)=>{
    const worker=new Worker(`const {parentPort,workerData:d}=require('node:worker_threads');const db=new (require(d.pg).PostgresDatabase)(d.url,{schema:d.schema});parentPort.once('message',()=>{try{parentPort.postMessage(require(d.checkout).submitCheckout(db,d.user,d.key,{'1':1},'Customer','0901234567','123 Example street'));}catch(e){parentPort.postMessage({status:409});}finally{db.close();}});parentPort.postMessage('ready');`,{eval:true,workerData:{pg:require.resolve('../src/postgres'),checkout:require.resolve('../src/checkout'),url:process.env.DATABASE_URL,schema,user,key}});
    workers.push(worker);worker.on('error',reject);worker.on('message',message=>{if(message==='ready'){worker.postMessage('go');}else resolve(message);});
  }));
  const results=await Promise.all(tasks);
  assert.equal(results.filter(result=>result.id).length,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
  assert.equal(db.prepare('SELECT reserved FROM product_variants WHERE id=1').get().reserved,1);
});
