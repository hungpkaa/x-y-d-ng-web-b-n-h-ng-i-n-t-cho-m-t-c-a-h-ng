const { test }=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const { openDatabase }=require('../src/db');
const { migrate }=require('../src/migrations');
const { saveProduct,saveVariant,priceVariant,publishProduct }=require('../src/products');
const { saveDefinition,saveAttributes,getAttributes }=require('../src/attributes');
const { addImage,changeImage }=require('../src/product-images');
const { listProducts }=require('../src/product-list');
function fixture() {
  const db=openDatabase(':memory:');
  db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Admin','a@test.com','test','ADMIN'),(2,'Staff','s@test.com','test','STAFF'); INSERT INTO categories(id,name,slug) VALUES(1,'Phone','phone'),(2,'Laptop','laptop'); INSERT INTO brands(name,slug) VALUES('Demo','demo');");
  const admin={id:1,role:'ADMIN'},staff={id:2,role:'STAFF'};
  const productId=saveProduct(db,staff,{name:'Phone',category:'Phone',brand:'Demo',description:'Description'}).id;
  const variantId=saveVariant(db,staff,productId,{sku:'PHONE-TEST'}).id;
  return {db,admin,staff,productId,variantId};
}
test('Ảnh thật được decode/chuyển WebP; fake SVG, quá 5MB và quyền sai bị chặn; kiểm tra lại version sau decode',async()=>{
  const {db,admin,staff,productId,variantId}=fixture();
  try {
    const png=await sharp({create:{width:1700,height:10,channels:3,background:'white'}}).png().toBuffer();
    const input={version:'1',alt:'Real image',data:png.toString('base64')};
    assert.equal((await addImage(db,{role:'CUSTOMER'},productId,input)).status,403);
    assert.equal((await addImage(db,staff,productId,{...input,data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>').toString('base64')})).status,400);
    assert.equal((await addImage(db,staff,productId,{...input,data:Buffer.from('not an image').toString('base64')})).status,400);
    assert.equal((await addImage(db,staff,productId,{...input,data:'A'.repeat(7000000)})).status,400);
    const results=await Promise.all([addImage(db,staff,productId,input),addImage(db,staff,productId,input)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const image=db.prepare('SELECT * FROM product_images').get();
    const metadata=await sharp(Buffer.from(image.data)).metadata();
    assert.equal(metadata.format,'webp'); assert.equal(metadata.width,1600);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_images').get().n,1);
    assert.equal(changeImage(db,staff,productId,image.id,{version:'1',alt:'Changed',sort_order:'1'}).status,409);
    priceVariant(db,admin,variantId,{version:'1',price:'100',active:'1'});
    assert.equal(publishProduct(db,admin,productId,{version:'2',status:'ACTIVE'}).status,200);
    assert.equal(changeImage(db,staff,productId,image.id,{version:'3'},true).status,409);
    publishProduct(db,admin,productId,{version:'3',status:'HIDDEN'});
    assert.equal(changeImage(db,staff,productId,image.id,{version:'4'},true).status,200);
  } finally {db.close();}
});
test('Thông số có kiểu, giữ số 0/boolean false, chặn sai danh mục và bắt buộc trước công bố',()=>{
  const {db,admin,staff,productId,variantId}=fixture();
  try {
    const number={category_id:'1',code:'ram',label:'RAM',data_type:'NUMBER',unit:'GB',required:'1',_csrf:'must-not-be-logged'};
    assert.equal(saveDefinition(db,staff,number).status,403);
    assert.equal(saveDefinition(db,admin,number).status,200);
    assert.equal(saveDefinition(db,admin,{category_id:'1',code:'wireless',label:'Wireless',data_type:'BOOLEAN',required:'1'}).status,200);
    assert.equal(saveDefinition(db,admin,{...number,category_id:'2',code:'ssd',required:'0'}).status,200);
    assert.equal(saveAttributes(db,staff,variantId,{version:'1',attr_1:'16',attr_2:'0',attr_3:'512'}).status,400);
    assert.equal(saveAttributes(db,staff,variantId,{version:'1',attr_1:'invalid',attr_2:'0'}).status,400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM variant_attribute_values').get().n,0);
    priceVariant(db,admin,variantId,{version:'1',price:'100',active:'1'});
    assert.equal(publishProduct(db,admin,productId,{version:'1',status:'ACTIVE'}).status,400);
    db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text) VALUES(?,?,?,?)').run(productId,'fixture.webp',Buffer.from('52494646240000005745425056503820180000003001009d012a0100010001402625a400037000fefcf40000','hex'),'Fixture');
    assert.equal(publishProduct(db,admin,productId,{version:'1',status:'ACTIVE'}).status,400);
    assert.equal(saveAttributes(db,staff,variantId,{version:'2',attr_1:'0',attr_2:'0'}).status,200);
    const attrs=getAttributes(db,variantId);assert.equal(attrs[0].value_number,0);assert.equal(attrs[1].value_boolean,0);
    assert.equal(publishProduct(db,admin,productId,{version:'1',status:'ACTIVE'}).status,200);
    assert.equal(saveAttributes(db,staff,variantId,{version:'3',attr_1:'',attr_2:'0'}).status,400);
    assert.equal(saveDefinition(db,admin,{...number,id:'1',version:'1',unit:'MB'}).status,409);
    assert.equal(saveDefinition(db,admin,{...number,code:'new_required'}).status,409);
    assert.equal(saveProduct(db,staff,{id:productId,version:'2',name:'Changed',category:'Laptop',brand:'Demo',description:'Description'}).status,409);
    assert.equal(db.prepare('SELECT after_json FROM audit_logs WHERE action=?').get('SAVE_DEFINITION').after_json.includes('must-not-be-logged'),false);
  } finally {db.close();}
});
test('Phân trang catalog vượt 100 sản phẩm, ổn định, giữ bộ lọc và không lộ nháp/ẩn',()=>{
  const db=openDatabase(':memory:');
  try {
    for(let i=1;i<=105;i++) {
      db.prepare('INSERT INTO products(id,name,category,brand,description,price,stock,status,active) VALUES(?,?,?,?,?,?,?,?,?)').run(i,`Phone ${i}`,'Phone','Demo','Description',1,0,'ACTIVE',1);
      db.prepare('INSERT INTO product_variants(product_id,sku,price,on_hand,active) VALUES(?,?,?,?,1)').run(i,`SKU-${i}`,100,1);
    }
    db.exec("INSERT INTO products(id,name,category,brand,description,price,stock,status,active) VALUES(106,'Draft','Phone','Demo','Description',1,0,'DRAFT',0),(107,'Hidden','Phone','Demo','Description',1,0,'HIDDEN',0)");
    const first=listProducts(db,{q:'Phone',category:'Phone',brand:'Demo',sort:'price_asc',page:'1'});
    assert.equal(first.paging.total,105);assert.equal(first.products.length,20);
    const second=listProducts(db,{q:'Phone',category:'Phone',brand:'Demo',sort:'price_asc',page:'2'});
    assert.equal(first.products.some(p=>second.products.some(s=>s.id===p.id)),false);
    assert.match(first.paging.next,/brand=Demo/);assert.match(first.paging.next,/sort=price_asc/);
    const last=listProducts(db,{page:'99999999999999999'});assert.equal(last.paging.page,1);
    assert.equal(listProducts(db,{page:'9999'}).products.length,5);
    assert.equal(listProducts(db,{min:'200',max:'100'}).status,400);
    assert.equal(listProducts(db,{min:'bad'}).status,400);
    db.prepare('INSERT INTO product_variants(product_id,sku,price,on_hand,active) VALUES(?,?,?,?,1)').run(1,'SECOND-SKU',200,2);
    const range=listProducts(db,{min:'150',max:'250'});assert.equal(range.products.length,1);assert.equal(range.products[0].price,200);
    const drafts=listProducts(db,{status:'DRAFT'},true);assert.equal(drafts.status,200);assert.equal(drafts.products.length,1);assert.equal(drafts.productStatus,'DRAFT');
  } finally {db.close();}
});
test('Migration v3 không thay SKU, kho hoặc đơn và chạy lại không trùng bảng',()=>{
  const db=openDatabase(':memory:',2);
  try {
    db.exec("INSERT INTO products(id,name,category,brand,description,price,stock) VALUES(1,'Phone','Phone','Demo','Description',100,3); INSERT INTO product_variants(product_id,sku,price,on_hand,reserved,active) VALUES(1,'OLD-SKU',100,3,1,1)");
    const before=JSON.stringify(db.prepare('SELECT * FROM product_variants').all());
    migrate(db,':memory:',3);migrate(db,':memory:',3);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM product_variants').all()),before);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,3);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_images').get().n,0);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {db.close();}
});
