const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {changeComparison,readComparison,comparisonTable}=require('../src/comparison');
const {recommendProducts}=require('../src/recommendations');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec("INSERT INTO users(id,name,email,password) VALUES(1,'Customer','c@test.com','test'); INSERT INTO categories(id,name,slug) VALUES(1,'Phone','phone'),(2,'Laptop','laptop'); INSERT INTO brands(id,name,slug) VALUES(1,'Alpha','alpha'),(2,'Beta','beta')");
  for(const [id,category,brand,price] of [[1,1,1,100],[2,1,1,100],[3,1,1,200],[4,1,2,120],[5,2,1,80],[6,2,2,400]]) addProduct(db,id,category,brand,price);
  db.exec("INSERT INTO attribute_definitions(id,category_id,code,label,data_type,unit) VALUES(1,1,'ram','RAM','NUMBER','GB'),(2,1,'wifi','Wi-Fi','BOOLEAN',''),(3,1,'screen','Screen','TEXT',''); INSERT INTO variant_attribute_values(variant_id,attribute_id,value_number) VALUES(11,1,0),(21,1,8); INSERT INTO variant_attribute_values(variant_id,attribute_id,value_boolean) VALUES(11,2,0),(21,2,1); INSERT INTO variant_attribute_values(variant_id,attribute_id,value_text) VALUES(11,3,'OLED'),(21,3,'OLED')");
  return db;
}
function addProduct(db,id,category,brand,price) {
  db.prepare("INSERT INTO products(id,name,category,brand,category_id,brand_id,description,price,stock) VALUES(?,?,?,?,?,?,'Demo',999999,10)").run(id,`Product ${id}`,category===1?'Phone':'Laptop',brand===1?'Alpha':'Beta',category,brand);
  db.prepare("INSERT INTO product_variants(id,product_id,sku,configuration,price,on_hand,active) VALUES(?,?,?,'Basic',?,10,1)").run(id*10+1,id,`SKU-${id}`,price);
}
function sale(db,productId,quantity,status) {
  const id=Number(db.prepare("INSERT INTO orders(user_id,recipient,phone,address,total,status) VALUES(1,'Customer','0901234567','Demo address',100,?)").run(status).lastInsertRowid);
  db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,name,price,quantity) VALUES(?,?,?,'Snapshot',100,?)").run(id,productId,productId*10+1,quantity);
}
test('So sánh tối đa 3 SKU cùng danh mục, không trùng; bỏ một mục giữ các mục khác',()=>{
  const db=fixture();
  try {
    let state=changeComparison(db,[],'add','11');assert.equal(state.status,200);
    assert.deepEqual(changeComparison(db,state.ids,'add','11').ids,[11]);
    assert.equal(changeComparison(db,state.ids,'add','51').status,409);
    state=changeComparison(db,state.ids,'add','21');state=changeComparison(db,state.ids,'add','31');
    assert.deepEqual(state.ids,[11,21,31]);assert.equal(changeComparison(db,state.ids,'add','41').status,409);
    assert.deepEqual(changeComparison(db,state.ids,'remove','21').ids,[11,31]);
    assert.deepEqual(changeComparison(db,state.ids,'clear').ids,[]);
    for(const value of ['1 OR 1=1','-11','1.5','Infinity','',[],{},9007199254740992]) assert.equal(changeComparison(db,[],'add',value).status,400);
    assert.equal(changeComparison(db,[],'add','9999').status,404);
    assert.equal(changeComparison(db,[],'unknown','11').status,400);
  } finally {db.close();}
});
test('So sánh loại nháp/ẩn và SKU tắt; SKU hết hàng còn so sánh được, trạng thái cũ tự làm sạch',()=>{
  const db=fixture();
  try {
    db.exec("UPDATE products SET status='HIDDEN' WHERE id=2; UPDATE product_variants SET active=0 WHERE id=31; UPDATE product_variants SET on_hand=0 WHERE id=11");
    assert.deepEqual(readComparison(db,[11,21,31]).ids,[11]);
    assert.equal(changeComparison(db,[],'add','21').status,404);assert.equal(changeComparison(db,[],'add','31').status,404);
    assert.equal(changeComparison(db,[],'add','11').status,200);assert.equal(comparisonTable(db,[11]).variants[0].stock,0);
    db.exec("UPDATE products SET status='DRAFT' WHERE id=4");assert.equal(changeComparison(db,[],'add','41').status,404);
    assert.deepEqual(readComparison(db,[11,11,'bad',51]).ids,[11]);
    assert.deepEqual(readComparison(db,{unexpected:'value'}).ids,[]);
    db.exec("UPDATE products SET category_id=2,category='Laptop' WHERE id=1");
    assert.deepEqual(readComparison(db,[11,51]).ids,[11,51]);
  } finally {db.close();}
});
test('Bảng so sánh giữ kiểu/đơn vị, phân biệt 0, false và thiếu; phát hiện khác biệt đúng',()=>{
  const db=fixture();
  try {
    const table=comparisonTable(db,[11,21,31]);
    const ram=table.attributes.find(row=>row.id===1),wifi=table.attributes.find(row=>row.id===2),screen=table.attributes.find(row=>row.id===3);
    assert.equal(ram.unit,'GB');assert.equal(ram.data_type,'NUMBER');assert.deepEqual(ram.values,[0,8,null]);assert.equal(ram.different,true);
    assert.deepEqual(wifi.values,[0,1,null]);assert.equal(wifi.different,true);
    assert.deepEqual(screen.values,['OLED','OLED',null]);assert.equal(screen.different,true);
    assert.equal(comparisonTable(db,[11,21]).attributes.find(row=>row.id===3).different,false);
    assert.deepEqual(comparisonTable(db,[51]).attributes,[]);
    assert.deepEqual(comparisonTable(db,[]).attributes,[]);
  } finally {db.close();}
});
test('Gợi ý theo +50 danh mục, +20 thương hiệu, +10 giá lệch <=20%; SKU tham chiếu đúng chủ',()=>{
  const db=fixture();
  try {
    const result=recommendProducts(db,{sourceId:1});assert.equal(result.status,200);
    assert.deepEqual(result.products.map(row=>[row.id,row.score]),[[2,80],[3,70],[4,60],[5,30],[6,0]]);
    assert.equal(result.anchor.price,100);assert.ok(result.products.every(row=>row.id!==1));
    assert.ok(result.products.find(row=>row.id===4).reasons.includes('Giá chênh lệch không quá 20%'));
    db.exec("INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(12,1,'SOURCE-EXPENSIVE',200,10,1)");
    assert.equal(recommendProducts(db,{sourceId:1,variantId:12}).products[0].id,3);
    assert.equal(recommendProducts(db,{sourceId:1,variantId:21}).status,404);
    assert.equal(recommendProducts(db,{sourceId:'bad'}).status,400);
    assert.equal(recommendProducts(db,{variantId:11}).status,400);
  } finally {db.close();}
});
test('Gợi ý dùng lượng đã giao phá hòa rồi ID; không dùng đơn chờ/hủy, không lặp sản phẩm, giới hạn 6',()=>{
  const db=fixture();
  try {
    for(const id of [7,8,9]) addProduct(db,id,1,1,200);
    sale(db,3,10,'DELIVERED');sale(db,7,11,'DELIVERED');sale(db,8,11,'DELIVERED');sale(db,9,99,'CANCELLED');sale(db,9,99,'PENDING');
    db.exec("INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(22,2,'DUPLICATE-PRODUCT',100,10,1)");
    const result=recommendProducts(db,{sourceId:1});
    assert.deepEqual(result.products.map(row=>row.id),[2,7,8,3,9,4]);assert.equal(result.products.length,6);
    assert.equal(result.products.find(row=>row.id===9).delivered_quantity,0);
    assert.equal(result.products.find(row=>row.id===2).variant_id,21);
    assert.deepEqual(recommendProducts(db,{sourceId:1}).products.map(row=>row.id),result.products.map(row=>row.id));
    const popular=recommendProducts(db);assert.deepEqual(popular.products.slice(0,3).map(row=>row.id),[7,8,3]);
  } finally {db.close();}
});
test('Gợi ý chỉ sản phẩm ACTIVE với SKU còn hàng; giữ tồn/giá theo SKU, không dùng giá legacy',()=>{
  const db=fixture();
  try {
    db.exec("UPDATE products SET status='DRAFT' WHERE id=2; UPDATE products SET status='HIDDEN' WHERE id=3; UPDATE product_variants SET active=0 WHERE id=41; UPDATE product_variants SET reserved=on_hand WHERE id=51; UPDATE product_variants SET on_hand=0 WHERE id=61");
    assert.deepEqual(recommendProducts(db,{sourceId:1}).products,[]);
    assert.equal(recommendProducts(db,{sourceId:2}).status,404);
    db.exec("INSERT INTO product_variants(id,product_id,sku,price,on_hand,reserved,active) VALUES(62,6,'AVAILABLE-EXPENSIVE',500,5,4,1)");
    const row=recommendProducts(db,{sourceId:1}).products[0];assert.equal(row.variant_id,62);assert.equal(row.price,500);assert.equal(row.stock,1);
  } finally {db.close();}
});
test('Ngân sách lọc đúng SKU còn hàng, chọn cấu hình rẻ nhất trong khoảng; bộ lọc sai bị chặn',()=>{
  const db=fixture();
  try {
    db.exec("INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(22,2,'EXPENSIVE',300,5,1),(23,2,'SOLD-OUT',250,0,1)");
    const result=recommendProducts(db,{query:{category_id:'1',brand_id:'1',min:'250',max:'350'}});
    assert.equal(result.products.length,1);assert.equal(result.products[0].variant_id,22);assert.equal(result.products[0].price,300);
    for(const query of [{max:'bad'},{min:'300',max:'100'},{max:'1000000001'},{max:'-1'},{max:'1.5'},{max:['100','200']},{category_id:'999'},{brand_id:'bad'}]) assert.equal(recommendProducts(db,{query}).status,400);
    assert.deepEqual(recommendProducts(db,{query:{max:'0'}}).products,[]);
  } finally {db.close();}
});
test('Chưa có giao hàng không giả bán chạy; có lịch sử đúng lượng; đọc gợi ý/so sánh không đổi nghiệp vụ',()=>{
  const db=fixture();
  try {
    const before=JSON.stringify(db.prepare('SELECT * FROM product_variants ORDER BY id').all());
    let result=recommendProducts(db);assert.equal(result.heading,'Sản phẩm sẵn có');assert.ok(result.products.every(row=>row.delivered_quantity===0&&row.reasons.includes('Đang bán và còn hàng')));
    comparisonTable(db,[11,21]);assert.equal(JSON.stringify(db.prepare('SELECT * FROM product_variants ORDER BY id').all()),before);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_logs').get().n,0);
    sale(db,2,3,'DELIVERED');result=recommendProducts(db);assert.equal(result.heading,'Sản phẩm được giao nhiều');assert.equal(result.products[0].id,2);assert.equal(result.products[0].delivered_quantity,3);
    assert.ok(result.products[0].reasons.includes('Đã giao 3 sản phẩm'));
  } finally {db.close();}
});
test('Gợi ý không cắt ứng viên ở 100 sản phẩm: sản phẩm mới có giao hàng vẫn được xếp hạng',()=>{
  const db=fixture();
  try {
    for(let id=7;id<=115;id++) addProduct(db,id,1,1,100);
    sale(db,115,5,'DELIVERED');
    const result=recommendProducts(db,{sourceId:1});assert.equal(result.products.length,6);assert.equal(result.products[0].id,115);assert.equal(result.products[0].variant_id,1151);
  } finally {db.close();}
});
