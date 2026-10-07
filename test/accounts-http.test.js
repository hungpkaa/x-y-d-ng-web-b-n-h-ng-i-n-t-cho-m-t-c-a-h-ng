const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
test('HTTP hồ sơ, tạo nhân viên, quyền, hủy đơn, khóa/mở khóa và đổi mật khẩu trên hai phiên',async()=>{
  const password=randomBytes(16).toString('hex');
  const bootstrap=`const data=require(${JSON.stringify(require.resolve('../src/db'))});const db=data.defaultDatabase();for(const [id,role] of [[2,'STAFF'],[3,'CUSTOMER'],[4,'CUSTOMER']])db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').run(id,role,id+'@test.com',data.hashPassword(process.env.TEST_PASSWORD),role);data.defaultDatabase=()=>db;require(${JSON.stringify(require.resolve('../src/server'))});`;
  const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,NODE_ENV:'test',PORT:'0',DB_PATH:':memory:',ADMIN_EMAIL:'admin@test.com',ADMIN_PASSWORD:password,TEST_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let base,errors='';child.stderr.on('data',chunk=>errors+=chunk);
  const request=(url,identity,options={})=>fetch(base+url,{redirect:'manual',...options,headers:{...(identity?{cookie:identity.cookie}:{}),...options.headers}});
  const post=(url,identity,body)=>request(url,identity,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:identity.csrf,...body})});
  async function login(email,pass=password) {
    const response=await request('/login'),html=await response.text();
    const identity={cookie:response.headers.get('set-cookie').split(';')[0],csrf:html.match(/name="_csrf" value="([^"]+)"/)[1]};
    const logged=await post('/login',identity,{email,password:pass});
    if(logged.headers.get('location')!=='/') return {identity,logged};
    identity.cookie=logged.headers.get('set-cookie').split(';')[0];
    identity.csrf=(await (await request('/profile',identity)).text()).match(/name="_csrf" value="([^"]+)"/)[1];
    return {identity,logged};
  }
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){base=`http://127.0.0.1:${match[1]}`;clearTimeout(timer);resolve();}});
    });
    const admin=(await login('admin@test.com')).identity,staff=(await login('2@test.com')).identity,customer=(await login('3@test.com')).identity,other=(await login('4@test.com')).identity;
    for(const [url,title] of [['/admin/promotions','Quản lý khuyến mãi'],['/admin/promotions/new','Tạo mã giảm giá'],['/admin/reviews','Kiểm duyệt đánh giá'],['/admin/reports','Báo cáo cửa hàng'],['/admin/audit','Nhật ký quản trị']]) {
      const response=await request(url,admin);
      assert.equal(response.status,200);
      assert.ok((await response.text()).includes(title));
      assert.equal((await request(url,staff)).status,403);
      assert.equal((await request(url,customer)).status,403);
      assert.equal((await request(url)).status,403);
    }
    assert.equal((await request('/admin/reports.csv',staff)).status,403);
    assert.equal((await request('/admin/reports.csv',customer)).status,403);
    assert.equal((await request('/admin/reports.csv')).status,403);
    assert.equal((await request('/admin/reports?from=2026-02-30&to=2026-03-01',admin)).status,400);
    assert.equal((await request('/admin/audit?page=invalid',admin)).status,400);
    const anonymousResponse=await request('/register'),anonymousHtml=await anonymousResponse.text();
    const anonymous={cookie:anonymousResponse.headers.get('set-cookie').split(';')[0],csrf:anonymousHtml.match(/name="_csrf" value="([^"]+)"/)[1]};
    await post('/register',anonymous,{name:'Public user',email:'public@test.com',password,role:'ADMIN',status:'LOCKED'});
    const publicUser=(await login('public@test.com')).identity;
    assert.equal((await request('/admin/accounts',publicUser)).status,403);
    assert.equal((await request('/orders',publicUser)).status,200);
    for(const url of ['/admin/accounts','/admin/accounts/3','/admin/shipping']) {
      assert.equal((await request(url,staff)).status,403);assert.equal((await request(url,customer)).status,403);
      assert.equal((await request(url,admin)).status,200);
    }
    assert.equal((await post('/profile',customer,{version:'1',name:'Customer name',role:'ADMIN'})).status,403);
    assert.equal((await post('/profile',customer,{_csrf:'invalid',version:'1',name:'Customer name'})).status,403);
    assert.equal((await post('/profile',customer,{version:'1',name:'Customer name',phone:'0901234567',address:'Saved default address'})).status,302);
    const ownProfile=await (await request('/profile',customer)).text();assert.match(ownProfile,/Saved default address/);
    const staffCreated=await post('/admin/accounts',admin,{name:'HTTP Staff',email:'newstaff@test.com',password,phone:'0901234567'});
    assert.match(staffCreated.headers.get('location'),/^\/admin\/accounts\/\d+$/);
    const staffUrl=staffCreated.headers.get('location');assert.equal((await request(staffUrl,admin)).status,200);
    assert.equal((await post(staffUrl,admin,{version:'1',name:'Renamed HTTP Staff',phone:''})).status,302);
    assert.match(await (await request(staffUrl,admin)).text(),/Renamed HTTP Staff/);
    assert.equal((await login('newstaff@test.com')).logged.headers.get('location'),'/');
    await post('/cart',customer,{id:'1',quantity:'1'});
    const checkout=await (await request('/checkout',customer)).text();assert.match(checkout,/Saved default address/);assert.match(checkout,/value="0901234567"/);
    const token=checkout.match(/name="token" value="([^"]+)"/)[1];
    const placed=await post('/checkout',customer,{token,recipient:'Customer name',phone:'0901234567',address:'Saved default address'});
    const orderUrl=placed.headers.get('location');assert.match(orderUrl,/^\/orders\/\d+$/);
    assert.equal((await request(orderUrl,other)).status,404);
    assert.equal((await post(orderUrl+'/cancel',other,{version:'1',reason:'Requested cancellation'})).status,404);
    assert.equal((await post(orderUrl+'/cancel',staff,{version:'1',reason:'Requested cancellation'})).status,403);
    assert.equal((await post(orderUrl+'/cancel',customer,{version:'1',reason:'Requested cancellation'})).status,302);
    assert.match(await (await request(orderUrl,customer)).text(),/Đã hủy/);
    const list=await request('/admin/orders?status=CANCELLED',staff);assert.equal(list.status,200);assert.match(await list.text(),/Requested cancellation|Đã hủy/);
    const createdPromotion=await post('/admin/promotions',admin,{code:'HTTPDEAL',kind:'FIXED',value:'1000',cap:'',minimum:'0',scope:'ALL',starts_at:'2020-01-01T00:00',ends_at:'2099-01-01T00:00',total_limit:'10',user_limit:'2',active:'1'});
    assert.match(createdPromotion.headers.get('location'),/^\/admin\/promotions\/\d+$/);
    assert.match(await (await request(createdPromotion.headers.get('location'),admin)).text(),/Khuyến mãi HTTPDEAL/);
    await post('/cart',customer,{id:'1',quantity:'1'});
    const discountedCheckout=await (await request('/checkout?code=HTTPDEAL',customer)).text();
    assert.match(discountedCheckout,/name="code" value="HTTPDEAL"/);
    const discountedToken=discountedCheckout.match(/name="token" value="([^"]+)"/)[1];
    const discountedOrder=await post('/checkout',customer,{token:discountedToken,code:'HTTPDEAL',recipient:'Customer name',phone:'0901234567',address:'Saved default address'});
    const discountedUrl=discountedOrder.headers.get('location');assert.match(discountedUrl,/^\/orders\/\d+$/);
    assert.match(await (await request(discountedUrl,customer)).text(),/HTTPDEAL/);
    const statusUrl='/admin/orders/'+discountedUrl.split('/').pop()+'/status';
    for(const [index,status] of ['CONFIRMED','PREPARING'].entries()) {
      await post(statusUrl,staff,{version:String(index+1),status,reason:'HTTP delivery check'});
    }
    const shippingProof={occurred_at:new Date(Date.now()+25200000).toISOString().slice(0,19),evidence_ref:'HTTP-CARRIER-EVIDENCE',reason:'HTTP carrier handling'};
    await post(statusUrl.replace('/status','/shipment'),staff,{version:'3',provider:'MANUAL TEST',tracking_number:'HTTP-TRACK-1',...shippingProof});
    const shipmentHtml=await (await request(discountedUrl,staff)).text();
    const shipmentId=shipmentHtml.match(/action="\/admin\/shipments\/(\d+)\/status"/)[1];
    for(const [index,status] of ['IN_TRANSIT','DELIVERED'].entries()) {
      await post(`/admin/shipments/${shipmentId}/status`,staff,{version:String(index+1),order_version:String(index+3),request_key:randomBytes(16).toString('hex'),status,...shippingProof});
    }
    const deliveredHtml=await (await request(discountedUrl,customer)).text();
    assert.match(deliveredHtml,/Đánh giá sản phẩm đã nhận/);
    const reviewUrl=deliveredHtml.match(/action="([^\"]+\/items\/\d+\/review)"/)[1];
    assert.equal((await post(reviewUrl,other,{version:'0',rating:'5',content:'HTTP verified review'})).status,404);
    await post(reviewUrl,customer,{version:'0',rating:'5',content:'HTTP verified review'});
    assert.doesNotMatch(await (await request('/products/1')).text(),/HTTP verified review/);
    const moderationHtml=await (await request('/admin/reviews',admin)).text();
    assert.match(moderationHtml,/HTTP verified review/);
    const moderationUrl=moderationHtml.match(/action="([^\"]+\/reviews\/\d+\/status)"/)[1];
    await post(moderationUrl,admin,{version:'1',status:'APPROVED',reason:''});
    assert.match(await (await request('/products/1')).text(),/HTTP verified review/);
    await post(reviewUrl,customer,{version:'2',rating:'4',content:'HTTP edited review'});
    assert.doesNotMatch(await (await request('/products/1')).text(),/HTTP edited review|HTTP verified review/);
    const paid=await post('/admin/orders/'+discountedUrl.split('/').pop()+'/cod',admin,{version:'5',amount:'19989000',reference:'REPORT-HTTP',note:'Report verified COD'});
    assert.equal(paid.status,302);
    const reportDay=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
    const reportQuery='?from='+reportDay+'&to='+reportDay;
    const reportHtml=await (await request('/admin/reports'+reportQuery,admin)).text();
    assert.match(reportHtml,/Doanh thu hàng/);assert.match(reportHtml,/COD thực thu/);
    const exported=await request('/admin/reports.csv'+reportQuery,admin);
    assert.equal(exported.status,200);assert.match(exported.headers.get('content-type'),/text\/csv/);
    assert.match(exported.headers.get('content-disposition'),/attachment/);
    const reportCsv=await exported.text();
    assert.ok(reportCsv.includes('"Doanh thu hàng đã giao và thu tiền","","","19989000"'));
    assert.ok(reportCsv.includes('"COD thực thu","","","19989000"'));
    const exportAudit=await (await request('/admin/audit'+reportQuery+'&action=REPORT_EXPORT',admin)).text();
    assert.match(exportAudit,/REPORT_EXPORT/);
    assert.equal((await post('/admin/audit/1/delete',admin,{})).status,404);
    assert.equal((await request('/orders?from=2026-02-30',customer)).status,400);
    await post('/admin/accounts/3/status',admin,{version:'2',status:'LOCKED',reason:'Requested lock'});
    assert.equal((await request('/profile',customer)).headers.get('location'),'/login');
    assert.equal((await login('3@test.com')).logged.headers.get('location'),'/login');
    await post('/admin/accounts/3/status',admin,{version:'3',status:'ACTIVE',reason:'Requested unlock'});
    assert.equal((await request('/profile',customer)).headers.get('location'),'/login');
    const first=(await login('3@test.com')).identity,second=(await login('3@test.com')).identity,newPassword=randomBytes(16).toString('hex');
    await post('/profile/password',first,{version:'4',current_password:password,new_password:newPassword,confirm_password:newPassword});
    assert.equal((await request('/profile',second)).headers.get('location'),'/login');
    assert.equal((await login('3@test.com',password)).logged.headers.get('location'),'/login');
    assert.equal((await login('3@test.com',newPassword)).logged.headers.get('location'),'/');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
  }
});
