const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
test('HTTP so sánh vãng lai có CSRF, giữ qua đăng nhập; chặn khác danh mục/quá 3, số 0/false/thiếu, gợi ý chọn đúng SKU',async()=>{
  const password=randomBytes(16).toString('hex');
  const bootstrap=`const data=require(${JSON.stringify(require.resolve('../src/db'))});const db=data.defaultDatabase();const category=db.prepare('SELECT category_id FROM products WHERE id=1').get().category_id;db.prepare("UPDATE products SET category_id=?,category='Phone' WHERE id IN (2,3,4)").run(category);db.exec("INSERT INTO attribute_definitions(id,category_id,code,label,data_type,unit) VALUES(900,1,'test_ram','Test RAM','NUMBER','GB'),(901,1,'test_wifi','Test Wi-Fi','BOOLEAN','');INSERT INTO variant_attribute_values(variant_id,attribute_id,value_number) VALUES(1,900,0),(2,900,8);INSERT INTO variant_attribute_values(variant_id,attribute_id,value_boolean) VALUES(1,901,0),(2,901,1);INSERT INTO product_variants(id,product_id,sku,price,on_hand,active) VALUES(901,1,'TEST-COMPARE-EXTRA',30000000,2,1),(902,1,'PRIVATE-SKU',1,1,0)");data.defaultDatabase=()=>db;require(${JSON.stringify(require.resolve('../src/server'))});`;
  const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,NODE_ENV:'test',PORT:'0',DB_PATH:':memory:',ADMIN_EMAIL:'admin@test.com',ADMIN_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let base,cookie,csrf,errors='';child.stderr.on('data',chunk=>errors+=chunk);
  const get=url=>fetch(base+url,{redirect:'manual',headers:cookie?{cookie}:{}});
  const post=(url,body)=>fetch(base+url,{redirect:'manual',method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...body})});
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){base=`http://127.0.0.1:${match[1]}`;clearTimeout(timer);resolve();}});
    });
    let response=await get('/products/1');cookie=response.headers.get('set-cookie').split(';')[0];
    csrf=(await response.text()).match(/name="_csrf" value="([^"]+)"/)[1];
    assert.equal((await post('/compare/add',{id:'1',_csrf:'invalid'})).status,403);
    assert.equal((await post('/compare/add',{id:'902'})).status,404);
    await post('/compare/add',{id:'1'});await post('/compare/add',{id:'2'});await post('/compare/add',{id:'3'});
    let html=await (await get('/compare')).text();assert.match(html,/So sánh SKU \(3\/3\)/);assert.match(html,/Test RAM/);assert.match(html,/\(GB\)/);assert.match(html,/<td>0<\/td>/);assert.match(html,/<td>Không<\/td>/);assert.match(html,/Chưa có thông tin/);assert.match(html,/is-different/);
    await post('/compare/add',{id:'4'});html=await (await get('/compare')).text();assert.match(html,/tối đa 3 SKU/);assert.match(html,/So sánh SKU \(3\/3\)/);
    await post('/compare/add',{id:'5'});html=await (await get('/compare')).text();assert.match(html,/cùng danh mục/);
    await post('/compare/remove',{id:'2'});html=await (await get('/compare')).text();assert.match(html,/So sánh SKU \(2\/3\)/);assert.match(html,/name="id" value="1"/);assert.match(html,/name="id" value="3"/);assert.ok(!html.includes('name="id" value="2"'));
    await post('/compare/add',{id:'901'});
    await post('/register',{name:'Customer',email:'discovery@test.com',password});
    response=await post('/login',{email:'discovery@test.com',password});cookie=response.headers.get('set-cookie').split(';')[0];
    html=await (await get('/compare')).text();csrf=html.match(/name="_csrf" value="([^"]+)"/)[1];assert.match(html,/So sánh SKU \(3\/3\)/);assert.match(html,/TEST-COMPARE-EXTRA/);
    await post('/compare/clear',{});html=await (await get('/compare')).text();assert.match(html,/Chưa có SKU để so sánh/);
    response=await get('/recommendations?category_id=1&min=25000000&max=35000000');assert.equal(response.status,200);html=await response.text();assert.match(html,/TEST-COMPARE-EXTRA/);assert.match(html,/\?sku=901#sku-901/);assert.ok(!html.includes('PRIVATE-SKU'));
    response=await get('/products/1?sku=901');assert.equal(response.status,200);html=await response.text();assert.match(html,/Tham chiếu: iPhone 16 · TEST-COMPARE-EXTRA/);assert.match(html,/id="sku-901" class="panel selected-sku"/);
    assert.equal((await get('/products/1?sku=2')).status,404);assert.equal((await get('/products/1?sku=902')).status,404);
    assert.equal((await get('/recommendations?max=bad')).status,400);assert.equal((await get('/recommendations?max=1&max=2')).status,400);
    assert.equal((await get('/recommendations?source=1&sku=2')).status,404);
    html=await (await get('/recommendations?max=0')).text();assert.match(html,/Chưa có sản phẩm còn hàng phù hợp/);assert.ok(!html.includes('Đã giao 1 sản phẩm'));
    await post('/compare/add',{id:'1'});await post('/compare/add',{id:'2'});
    response=await post('/login',{email:'admin@test.com',password});cookie=response.headers.get('set-cookie').split(';')[0];
    html=await (await get('/compare')).text();csrf=html.match(/name="_csrf" value="([^"]+)"/)[1];assert.match(html,/So sánh SKU \(2\/3\)/);
    await post('/admin/products/2/publish',{status:'HIDDEN',version:'1'});
    html=await (await get('/compare')).text();assert.match(html,/So sánh SKU \(1\/3\)/);assert.match(html,/bỏ các SKU không còn được công bố/);assert.ok(!html.includes('name="id" value="2"'));
    assert.equal((await get('/recommendations?source=2')).status,404);
  } finally {if(child.exitCode===null) await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
});
