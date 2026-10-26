const {test}=require('node:test');
const assert=require('node:assert/strict');
const {productCardInfo}=require('../src/product-presentation');
const {listProducts}=require('../src/product-list');
const {openDatabase}=require('../src/db');
const ejs=require('ejs');
const path=require('node:path');
test('card configuration belongs to the variant at the filtered displayed price',()=>{
  const db=openDatabase(':memory:');
  try {
    db.exec("INSERT INTO products(id,name,category,brand,description,price,stock,active,status) VALUES(1,'Phone','Phone','Demo','Existing description',100,10,1,'ACTIVE'); INSERT INTO product_variants(product_id,sku,configuration,price,on_hand,active) VALUES(1,'SMALL','128GB · RAM 8GB',100,3,1),(1,'LARGE','256GB · RAM 12GB',200,4,1),(1,'HIDDEN','Inactive configuration',50,3,0)");
    const cheapest=listProducts(db,{}).products[0];
    assert.equal(cheapest.price,100);assert.deepEqual(productCardInfo(cheapest).specs,['128GB','RAM 8GB']);
    const filtered=listProducts(db,{min:'150'}).products[0];
    assert.equal(filtered.price,200);assert.deepEqual(productCardInfo(filtered).specs,['256GB','RAM 12GB']);
  } finally {db.close();}
});
test('sample cards keep a sample badge without repeating the full disclaimer or presenting unverified specs',async()=>{
  const p={id:1,brand:'Demo',category:'Phone',name:'Sample phone',price:100,stock:12,image_key:null,description:'DỮ LIỆU MẪU — Giá và tồn kho phục vụ thử nghiệm website, không phải báo giá bán thực tế.',card_configuration:'Unverified RAM 128GB'};
  assert.deepEqual(productCardInfo(p),{sample:true,specs:[]});
  const html=await ejs.renderFile(path.join(__dirname,'../views/product-card.ejs'),{p,productCardInfo,money:String});
  assert.match(html,/product-sample-badge/);
  assert.doesNotMatch(html,/Unverified|Giá và tồn kho phục vụ thử nghiệm/);
  assert.match(html,/Ảnh và cấu hình tham khảo/);
});
