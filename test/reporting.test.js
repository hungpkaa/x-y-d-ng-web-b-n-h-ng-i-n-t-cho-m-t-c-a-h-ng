const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {dateRange,salesReport,reportCsv,csvCell,auditRecords,redactJson,localDateTime}=require('../src/reporting');
const day={from:'2026-10-07',to:'2026-10-07'};
function fixture() {
  const db=openDatabase(':memory:');
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Customer','one@test.com','test','CUSTOMER'),(2,'Admin','admin@test.com','test','ADMIN'); INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Demo',1000,5); INSERT INTO product_variants(id,product_id,sku,price,on_hand,reserved,active) VALUES(1,1,'PHONE',1000,5,2,1),(2,1,'HIGH',1000,10,0,1),(3,1,'INACTIVE',1000,0,0,0)");
  return db;
}
function addOrder(db,id,{created='2026-10-06 17:00:00',delivered='2026-10-06 17:00:00',paid='2026-10-07 16:59:59',status='DELIVERED',payment='PAID',name='Phone'}={}) {
  db.prepare('INSERT INTO orders(id,user_id,recipient,phone,address,total,subtotal,discount,shipping_fee,status,payment_status,created_at) VALUES(?,1,?,?,?,?,?,?,?,?,?,?)').run(id,'Customer','0901234567','123 Example street',950,1000,100,50,status,payment,created);
  db.prepare('INSERT INTO order_items(order_id,product_id,variant_id,name,price,quantity,sku_snapshot) VALUES(?,1,1,?,1000,1,?)').run(id,name,'PHONE');
  if(delivered) db.prepare("INSERT INTO order_history(order_id,actor_id,status,created_at) VALUES(?,2,'DELIVERED',?)").run(id,delivered);
  if(paid) db.prepare('INSERT INTO cod_receipts(order_id,actor_id,amount,reference,note,created_at) VALUES(?,2,950,?,?,?)').run(id,'RECEIPT-'+id,'Verified cash',paid);
}
test('Khoảng ngày Việt Nam bao gồm hết ngày, chặn ngày sai/range dài và không phụ thuộc timezone máy',()=>{
  const range=dateRange(day);
  assert.equal(range.startUtc,'2026-10-06 17:00:00');assert.equal(range.endUtc,'2026-10-07 17:00:00');
  assert.equal(localDateTime('2026-10-06 17:00:00'),'2026-10-07 00:00:00');
  assert.equal(dateRange({},Date.parse('2026-09-30T18:00:00Z')).from,'2026-10-01');
  for(const query of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-10-08',to:'2026-10-07'},{from:'2025-01-01',to:'2026-01-02'},{from:['2026-10-07'],to:'2026-10-07'}]) assert.equal(dateRange(query).status,400);
  assert.equal(dateRange({from:'2024-01-01',to:'2024-12-31'}).status,200);
});
test('Báo cáo dùng kỳ đủ điều kiện giao/thu, tách cash khỏi doanh thu và không ghi nhận hủy/chưa thu/legacy',()=>{
  const db=fixture();
  try {
    addOrder(db,1); // 900 revenue, 950 cash on Oct 7.
    addOrder(db,2,{paid:'2026-10-07 17:00:00'}); // Cash and recognition next day.
    addOrder(db,3,{delivered:'2026-10-07 17:00:00',paid:'2026-10-06 17:00:00'}); // Cash this day, recognition next day.
    addOrder(db,4,{status:'CANCELLED',payment:'REFUND_PENDING',paid:'2026-10-06 17:00:00'}); // Cash remains real, no sales revenue.
    addOrder(db,5,{payment:'UNPAID',paid:null});
    addOrder(db,6,{delivered:null,paid:null}); // Legacy paid without evidence.
    addOrder(db,7,{created:'2026-10-06 16:59:59',delivered:'2026-10-06 16:59:59',paid:'2026-10-06 16:59:59'});
    const report=salesReport(db,day);
    assert.equal(report.summary.revenue,900);
    assert.equal(report.summary.cash,2850);
    assert.equal(report.summary.discount,100);assert.equal(report.summary.shipping,50);
    assert.equal(report.summary.recognizedOrders,1);assert.equal(report.summary.newOrders,6);
    assert.equal(report.summary.deliveredOrders,3);
    assert.equal(report.bestSellers[0].quantity,3);
    assert.equal(report.unknown,1);
    assert.equal(report.lowStock.length,1);assert.equal(report.lowStock[0].available,3);
    assert.equal(salesReport(db,{...day,low:'2'}).lowStock.length,0);
    const next=salesReport(db,{from:'2026-10-08',to:'2026-10-08'});
    assert.equal(next.summary.revenue,1800);assert.equal(next.summary.cash,950);
    const wide=salesReport(db,{from:'2026-10-07',to:'2026-10-08'});
    assert.equal(wide.daily.reduce((sum,row)=>sum+row.revenue,0),wide.summary.revenue);
    assert.equal(salesReport(db,{...day,low:'-1'}).status,400);
  } finally {db.close();}
});
test('Báo cáo rỗng trả 0, CSV khớp số liệu và che công thức kể cả tên SKU',()=>{
  const db=fixture();
  try {
    assert.equal(salesReport(db,day).summary.revenue,0);
    addOrder(db,1,{name:'=HYPERLINK("bad")'});
    const report=salesReport(db,day),csv=reportCsv(report);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('"Theo ngày","2026-10-07","Doanh thu hàng đã giao và thu tiền","","","900"'));
    assert.ok(csv.includes("'=HYPERLINK"));
    for(const value of ['=1+1','+cmd','-cmd','@SUM(A1)','  =1','\t=1']) assert.ok(csvCell(value).startsWith('"\''));
    assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  } finally {db.close();}
});
test('Nhật ký hơn 100 bản ghi phân trang ổn định, giữ lọc, hỗ trợ actor hệ thống và che JSON nhạy cảm',()=>{
  const db=fixture();
  try {
    const insert=db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json,created_at) VALUES(2,'PRICE','SKU',1,?,?, '2026-10-06 17:00:00')");
    const sensitive=JSON.stringify({password:'password-value',nested:{access_token:'token-value',phone:'private-phone',price:100},list:[{session_secret:'secret-value'}]});
    for(let n=0;n<105;n++) insert.run(sensitive,JSON.stringify({price:n}));
    db.exec("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json,created_at) VALUES(NULL,'SYSTEM','REPORT',0,'not-json','2026-10-06 17:00:00')");
    const query={...day,actor:'2',action:'PRICE',entity:'SKU',id:'1'};
    const first=auditRecords(db,query),second=auditRecords(db,{...query,page:'2'});
    assert.equal(first.paging.total,105);assert.equal(first.rows.length,20);
    assert.ok(second.rows.every(row=>!first.rows.some(item=>item.id===row.id)));
    const link=new URL(first.paging.next,'http://localhost');
    for(const key of Object.keys(query)) assert.equal(link.searchParams.get(key),query[key]);
    assert.doesNotMatch(first.rows[0].before_json,/password-value|token-value|private-phone|secret-value/);
    assert.match(first.rows[0].before_json,/100/);
    const system=auditRecords(db,{...day,actor:'system',entity:'REPORT',id:'0'});
    assert.equal(system.rows.length,1);assert.equal(system.rows[0].actor_id,null);
    assert.equal(system.rows[0].after_json,'[Dữ liệu không hợp lệ]');
    assert.equal(auditRecords(db,{...day,page:'no'}).status,400);
    assert.equal(auditRecords(db,{...day,actor:['2']}).status,400);
    assert.equal(db.prepare('SELECT before_json FROM audit_logs WHERE id=1').get().before_json,sensitive);
    assert.equal(redactJson(null),null);
  } finally {db.close();}
});
