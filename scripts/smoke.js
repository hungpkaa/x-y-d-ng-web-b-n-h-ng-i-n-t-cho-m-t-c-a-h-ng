const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const postgres=process.argv.includes('--postgres');
let postgresRoot,postgresSchema;
if(postgres) {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL smoke');
  const {PostgresDatabase}=require('../src/postgres');
  postgresRoot=new PostgresDatabase(process.env.DATABASE_URL);
  postgresSchema='test_smoke_'+randomBytes(8).toString('hex');
  postgresRoot.exec(`CREATE SCHEMA "${postgresSchema}"`);
}
const port = '3107';
const adminPassword = randomBytes(16).toString('hex');
const staffPassword = randomBytes(16).toString('hex');
const bootstrap=`const data=require(${JSON.stringify(path.join(__dirname,'..','src','db.js'))});const db=data.defaultDatabase();db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Staff smoke','smoke-staff@example.com',data.hashPassword(process.env.SMOKE_STAFF_PASSWORD),'STAFF');data.defaultDatabase=()=>db;require(${JSON.stringify(path.join(__dirname,'..','src','server.js'))});`;
const child = spawn(process.execPath,['-e',bootstrap],{env:{...process.env,PORT:port,DB_PATH:postgres?'':':memory:',DATABASE_SCHEMA:postgresSchema||'public',ADMIN_EMAIL:'smoke-admin@example.com',ADMIN_PASSWORD:adminPassword,SMOKE_STAFF_PASSWORD:staffPassword},stdio:['ignore','pipe','pipe'],windowsHide:true});
let errors='';
child.stderr.on('data',chunk=>errors+=chunk);
async function request(url,options={}) {
  return fetch(`http://127.0.0.1:${port}${url}`,{redirect:'manual',...options});
}
async function session() {
  const response=await request('/login');
  const html=await response.text();
  return { cookie:response.headers.get('set-cookie').split(';')[0],csrf:html.match(/name="_csrf" value="([^"]+)"/)[1] };
}
async function post(url,identity,body) {
  return request(url,{method:'POST',headers:{cookie:identity.cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:identity.csrf,...body})});
}
async function refresh(identity) {
  const response=await request('/',{headers:{cookie:identity.cookie}});
  identity.csrf=(await response.text()).match(/name="_csrf" value="([^"]+)"/)[1];
}
(async()=>{
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Server không khởi động: '+errors)),10000);
      child.once('error',reject);
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server thoát ${code}: ${errors}`));});
      child.stdout.on('data',chunk=>{if(String(chunk).includes('Electro Store:')){clearTimeout(timer);resolve();}});
    });
    const customer=await session();
    const chatbotResponse=await request('/chatbot/message',{method:'POST',headers:{cookie:customer.cookie,'content-type':'application/json'},body:JSON.stringify({_csrf:customer.csrf,message:'laptop dưới 25 triệu'})});
    assert.equal(chatbotResponse.status,200);assert.ok((await chatbotResponse.json()).links.some(link=>link.url==='/products/3'));
    assert.equal((await request('/chatbot/message',{method:'POST',headers:{cookie:customer.cookie,'content-type':'application/json'},body:JSON.stringify({message:'đơn hàng của tôi'})})).status,403);
    await request('/products/2',{headers:{cookie:customer.cookie}});
    const email=`smoke-${randomBytes(6).toString('hex')}@example.com`,password=randomBytes(16).toString('hex');
    assert.equal((await post('/register',customer,{name:'Khách kiểm thử',email,password})).status,302);
    const login=await post('/login',customer,{email,password});
    assert.equal(login.headers.get('location'),'/');
    customer.cookie=login.headers.get('set-cookie').split(';')[0];
    await refresh(customer);
    assert.match(await (await request('/recent',{headers:{cookie:customer.cookie}})).text(),/Galaxy S25/);
    assert.equal((await request('/admin',{headers:{cookie:customer.cookie}})).status,403);
    assert.equal((await request('/admin/catalog',{headers:{cookie:customer.cookie}})).status,403);
    assert.equal((await post('/admin/catalog/categories',customer,{name:'Không được tạo',slug:'no-access',active:'1'})).status,403);
    assert.equal((await request('/cart',{method:'POST',headers:{cookie:customer.cookie,'content-type':'application/x-www-form-urlencoded'},body:'id=1&quantity=1'})).status,403);
    const catalog=await request('/');
    assert.equal(catalog.status,200);
    const productId=(await catalog.text()).match(/href="\/products\/(\d+)"/)[1];
    const productDetail=await request(`/products/${productId}`);
    assert.equal(productDetail.status,200);
    const variantId=(await productDetail.text()).match(/name="id" value="(\d+)"/)[1];
    await post('/cart',customer,{id:variantId,quantity:'1',action:'add'});
    const checkout=await request('/checkout',{headers:{cookie:customer.cookie}});
    assert.equal(checkout.status,200);
    const token=(await checkout.text()).match(/name="token" value="([^"]+)"/)[1];
    const order=await post('/checkout',customer,{token,recipient:'Khách kiểm thử',phone:'0901234567',address:'123 Đường kiểm thử, TP HCM'});
    const orderUrl=order.headers.get('location');
    assert.match(orderUrl,/^\/orders\/\d+$/);
    assert.equal((await request(orderUrl,{headers:{cookie:customer.cookie}})).status,200);
    const chatOrder=await request('/chatbot/message',{method:'POST',headers:{cookie:customer.cookie,'content-type':'application/json'},body:JSON.stringify({_csrf:customer.csrf,message:'trạng thái đơn #'+orderUrl.split('/').at(-1)})});
    assert.equal(chatOrder.status,200);assert.equal((await chatOrder.json()).links[0].url,orderUrl);
    const repeated=await post('/checkout',customer,{token,recipient:'Khách kiểm thử',phone:'0901234567',address:'123 Đường kiểm thử, TP HCM'});
    assert.equal(repeated.headers.get('location'),order.headers.get('location'));
    const other=await session();
    const otherEmail=`smoke-${randomBytes(6).toString('hex')}@example.com`;
    await post('/register',other,{name:'Khách khác',email:otherEmail,password});
    const otherLogin=await post('/login',other,{email:otherEmail,password});
    other.cookie=otherLogin.headers.get('set-cookie').split(';')[0];
    await refresh(other);
    const chatOther=await request('/chatbot/message',{method:'POST',headers:{cookie:other.cookie,'content-type':'application/json'},body:JSON.stringify({_csrf:other.csrf,message:'trạng thái đơn #'+orderUrl.split('/').at(-1)})});
    assert.equal(chatOther.status,200);assert.ok((await chatOther.json()).links.every(link=>link.url!==orderUrl));
    assert.equal((await request(orderUrl,{headers:{cookie:other.cookie}})).status,404);
    const admin=await session();
    const adminLogin=await post('/login',admin,{email:'smoke-admin@example.com',password:adminPassword});
    admin.cookie=adminLogin.headers.get('set-cookie').split(';')[0];
    await refresh(admin);
    assert.equal((await request('/admin',{headers:{cookie:admin.cookie}})).status,200);
    assert.equal((await request('/admin/orders',{headers:{cookie:admin.cookie}})).status,200);
    const catalogManagement=await request('/admin/catalog',{headers:{cookie:admin.cookie}});
    assert.equal(catalogManagement.status,200);
    assert.match(await catalogManagement.text(),/name="slug"/);
    assert.equal((await post('/admin/catalog/categories',admin,{name:'Thiết bị kiểm thử',slug:'thiet-bi-kiem-thu',active:'1'})).headers.get('location'),'/admin/catalog');
    assert.equal((await post('/admin/catalog/brands',admin,{name:'Smoke Brand',slug:'smoke-brand',active:'1'})).headers.get('location'),'/admin/catalog');
    const form=await request('/admin',{headers:{cookie:admin.cookie}});
    assert.match(await form.text(),/<option value="Thiết bị kiểm thử"/);
    const staff=await session();
    const staffLogin=await post('/login',staff,{email:'smoke-staff@example.com',password:staffPassword});
    staff.cookie=staffLogin.headers.get('set-cookie').split(';')[0];
    await refresh(staff);
    assert.equal((await request('/checkout',{headers:{cookie:staff.cookie}})).status,403);
    assert.equal((await request('/admin/catalog',{headers:{cookie:staff.cookie}})).status,403);
    const createPage=await (await request('/admin',{headers:{cookie:staff.cookie}})).text();
    assert.match(createPage,/name="product_image"/);
    assert.match(createPage,/Điều hướng quản trị/);
    const dashboard=await request('/admin/dashboard',{headers:{cookie:staff.cookie}});
    assert.equal(dashboard.status,200);assert.match(await dashboard.text(),/Tổng quan cửa hàng/);
    assert.equal((await request('/admin/dashboard',{headers:{cookie:customer.cookie}})).status,403);
    assert.equal((await request('/favorites',{headers:{cookie:staff.cookie}})).status,403);
    await post('/favorites/1/add',customer,{});
    assert.match(await (await request('/favorites',{headers:{cookie:customer.cookie}})).text(),/iPhone 16/);
    await request('/products/1',{headers:{cookie:customer.cookie}});
    assert.match(await (await request('/recent',{headers:{cookie:customer.cookie}})).text(),/iPhone 16/);
    assert.equal((await request('/notifications',{headers:{cookie:customer.cookie}})).status,200);
    const draft=await request('/admin/products',{method:'POST',headers:{cookie:staff.cookie,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({_csrf:staff.csrf,name:'Sản phẩm kiểm thử catalog',category:'Thiết bị kiểm thử',brand:'Smoke Brand',description:'Mô tả kiểm thử'})});
    assert.equal(draft.status,200);
    const createdDraft=await draft.json();assert.equal(createdDraft.version,1);
    const draftUrl=createdDraft.url;
    assert.match(draftUrl,/^\/admin\/products\/\d+$/);
    const draftId=draftUrl.split('/').pop();
    assert.equal((await request(`/products/${draftId}`)).status,404);
    assert.equal((await post(`/admin/products/${draftId}/publish`,staff,{status:'ACTIVE',version:'1'})).status,403);
    const fixtureImage=await require('sharp')({create:{width:12,height:12,channels:3,background:'white'}}).png().toBuffer();
    const imageBody={_csrf:staff.csrf,version:'1',alt:'Ảnh sản phẩm kiểm thử',data:fixtureImage.toString('base64')};
    assert.equal((await request(`${draftUrl}/images`,{method:'POST',headers:{cookie:customer.cookie,'content-type':'application/json'},body:JSON.stringify({...imageBody,_csrf:customer.csrf})})).status,403);
    assert.equal((await request(`${draftUrl}/images`,{method:'POST',headers:{cookie:staff.cookie,'content-type':'application/json'},body:JSON.stringify(imageBody)})).status,200);
    const imagesPage=await request(draftUrl,{headers:{cookie:staff.cookie}});
    const imageKey=(await imagesPage.text()).match(/src="\/media\/([a-f0-9]+\.webp)"/)[1];
    assert.equal((await request(`/media/${imageKey}`)).status,404);
    assert.equal((await request('/admin/attributes',{headers:{cookie:staff.cookie}})).status,403);
    const definitionPage=await request('/admin/attributes',{headers:{cookie:admin.cookie}});
    const definitionHtml=await definitionPage.text();
    const categoryId=definitionHtml.match(/<option value="(\d+)"[^>]*>Thiết bị kiểm thử<\/option>/)[1];
    await post('/admin/attributes',admin,{category_id:categoryId,code:'ram_gb',label:'RAM',data_type:'NUMBER',unit:'GB',required:'1'});
    const definitionsAfter=await request('/admin/attributes',{headers:{cookie:admin.cookie}});
    assert.match(await definitionsAfter.text(),/RAM/);
    await post(`${draftUrl}/variants`,staff,{sku:'SMOKE-BLACK-128',color:'Đen',configuration:'128GB'});
    const skuForm=await request(draftUrl,{headers:{cookie:admin.cookie}});
    const newVariantId=(await skuForm.text()).match(/action="\/admin\/variants\/(\d+)\/price"/)[1];
    const specForm=await request(draftUrl,{headers:{cookie:staff.cookie}});
    const attrId=(await specForm.text()).match(/name="attr_(\d+)"/)[1];
    assert.equal((await post(`/admin/variants/${newVariantId}/price`,staff,{price:'123456',active:'1',version:'1'})).status,403);
    await post(`/admin/variants/${newVariantId}/price`,admin,{price:'123456',active:'1',version:'1'});
    await post(`/admin/variants/${newVariantId}/stock`,staff,{delta:'2',reason:'Tồn kiểm thử',version:'2'});
    await post(`/admin/variants/${newVariantId}/attributes`,staff,{version:'3',[`attr_${attrId}`]:'16'});
    await post(`${draftUrl}/publish`,admin,{status:'ACTIVE',version:'2'});
    const afterCreate=await request('/?category='+encodeURIComponent('Thiết bị kiểm thử'));
    assert.match(await afterCreate.text(),/Sản phẩm kiểm thử catalog/);
    const published=await request(`/products/${draftId}`);
    assert.match(await published.text(),/SMOKE-BLACK-128/);
    const publicMedia=await request(`/media/${imageKey}`);
    assert.equal(publicMedia.status,200);assert.match(publicMedia.headers.get('content-type'),/image\/webp/);
    const publicSpecs=await request(`/products/${draftId}`);
    assert.match(await publicSpecs.text(),/16 GB/);
    assert.equal((await request('/?min=invalid')).status,400);
    const paginated=await request('/?page=2&sort=price_asc');
    assert.equal(paginated.status,200);assert.match(await paginated.text(),/aria-label="Phân trang"/);
    await post('/cart',customer,{id:newVariantId,quantity:'1',action:'add'});
    const skuCheckout=await request('/checkout',{headers:{cookie:customer.cookie}});
    const skuToken=(await skuCheckout.text()).match(/name="token" value="([^"]+)"/)[1];
    const skuOrder=await post('/checkout',customer,{token:skuToken,recipient:'Khách kiểm thử',phone:'0901234567',address:'123 Đường kiểm thử, TP HCM'});
    const skuOrderHtml=await request(skuOrder.headers.get('location'),{headers:{cookie:customer.cookie}});
    const skuOrderText=await skuOrderHtml.text();
    assert.match(skuOrderText,/SMOKE-BLACK-128/);
    assert.match(skuOrderText,/128GB/);
    const orderId=orderUrl.split('/').pop();
    for(const [index,status] of ['CONFIRMED','PREPARING'].entries()) {
      assert.equal((await post(`/admin/orders/${orderId}/status`,admin,{status,version:String(index+1),reason:'Smoke order processing'})).status,302);
    }
    const proof={occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19),evidence_ref:'SMOKE-HANDOFF-1',reason:'Smoke carrier evidence'};
    await post(`/admin/orders/${orderId}/shipment`,admin,{version:'3',provider:'MANUAL TEST',tracking_number:'SMOKE-TRACK-1',...proof});
    const shipmentHtml=await (await request(orderUrl,{headers:{cookie:admin.cookie}})).text();
    const shipmentId=shipmentHtml.match(/action="\/admin\/shipments\/(\d+)\/status"/)[1];
    for(const [index,status] of ['IN_TRANSIT','DELIVERED'].entries()) {
      await post(`/admin/shipments/${shipmentId}/status`,admin,{version:String(index+1),order_version:String(index+3),request_key:randomBytes(16).toString('hex'),status,...proof});
    }
    const receiptPage=await request(orderUrl,{headers:{cookie:admin.cookie}});
    const receiptHtml=await receiptPage.text();
    const receiptAmount=receiptHtml.match(/name="amount"[^>]*value="(\d+)"/)[1];
    assert.equal((await post(`/admin/orders/${orderId}/cod`,admin,{version:'5',amount:receiptAmount,reference:'SMOKE-COD-1',note:'Collected in full'})).status,302);
    const delivered=await request(orderUrl,{headers:{cookie:customer.cookie}});
    assert.match(await delivered.text(),/Đã thu tiền/);
    console.log('PASS: quyền STAFF/ADMIN, ảnh WebP và quyền xem ảnh nháp, thông số typed, phân trang/lọc, SKU/đơn COD và giao hàng.');
  } finally {
    if(child.exitCode===null) {
      const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;
    }
    if(postgresRoot) {try {postgresRoot.exec(`DROP SCHEMA "${postgresSchema}" CASCADE`);} finally {postgresRoot.close();}}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
