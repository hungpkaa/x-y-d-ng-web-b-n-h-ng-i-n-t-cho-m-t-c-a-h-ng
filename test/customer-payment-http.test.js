const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {signature,vnpDate}=require('../src/payments');
test('HTTP địa chỉ, hỗ trợ/nội bộ, SMTP giả, vô hiệu phiên, VNPay return/IPN và hoàn tiền',async()=>{
  const password=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex'),mails=[];
  const bootstrap=`const data=require(${JSON.stringify(require.resolve('../src/db'))});const db=data.defaultDatabase();for(const [id,role] of [[2,'STAFF'],[3,'CUSTOMER'],[4,'CUSTOMER']]) db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').run(id,role,id+'@test.com',data.hashPassword(process.env.TEST_PASSWORD),role);data.defaultDatabase=()=>db;require(${JSON.stringify(require.resolve('../src/mail'))}).createMailer=()=>({sendReset:async mail=>process.send({mail})});require(${JSON.stringify(require.resolve('../src/server'))});`;
  const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,NODE_ENV:'test',PORT:'0',DB_PATH:':memory:',ADMIN_EMAIL:'admin@test.com',ADMIN_PASSWORD:password,TEST_PASSWORD:password,VNPAY_TMN_CODE:'TESTCODE',VNPAY_HASH_SECRET:secret,APP_URL:'http://localhost:3000',TRUST_PROXY_HOPS:''},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let base,errors='';child.stderr.on('data',chunk=>errors+=chunk);child.on('message',message=>{if(message.mail)mails.push(message.mail);});
  const request=(url,identity,options={})=>fetch(base+url,{redirect:'manual',...options,headers:{...(identity?{cookie:identity.cookie}:{}),...options.headers}});
  const post=(url,identity,body={})=>request(url,identity,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:identity.csrf,...body})});
  async function anonymous(url='/login') {
    const response=await request(url),html=await response.text();
    return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:html.match(/name="_csrf" value="([^"]+)"/)[1]};
  }
  async function login(email,pass=password) {
    const identity=await anonymous();
    const response=await post('/login',identity,{email,password:pass});
    assert.equal(response.headers.get('location'),'/');
    identity.cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await (await request('/profile',identity)).text();identity.csrf=html.match(/name="_csrf" value="([^"]+)"/)[1];
    return identity;
  }
  const version=html=>html.match(/name="version" value="([^"]+)"/)[1];
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Startup exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});
    });
    const admin=await login('admin@test.com'),staff=await login('2@test.com'),customer=await login('3@test.com'),other=await login('4@test.com');
    assert.equal((await request('/addresses',staff)).status,403);
    assert.equal((await request('/admin/support',customer)).status,403);
    assert.equal((await request('/admin/support',staff)).status,200);
    assert.equal((await request('/admin/refunds',staff)).status,403);
    assert.equal((await request('/admin/refunds',admin)).status,200);
    const addressInput={label:'Work address',recipient:'Office receiver',phone:'0901234567',address:'123 Office delivery street'};
    await post('/addresses',customer,addressInput);
    const addressHtml=await (await request('/addresses',customer)).text();assert.match(addressHtml,/Work address/);
    const addressId=addressHtml.match(/action="\/addresses\/(\d+)"/)[1];
    assert.equal((await post('/addresses/'+addressId,other,{...addressInput,version:'1'})).status,404);
    assert.equal((await post('/addresses/'+addressId+'/delete',customer,{version:'1',_csrf:'wrong'})).status,403);
    await post('/cart',customer,{id:'1',quantity:'1'});
    assert.equal((await request('/checkout?address='+addressId,other)).headers.get('location'),'/cart');
    const checkout=await (await request('/checkout?method=ONLINE&address='+addressId,customer)).text();
    assert.match(checkout,/Office receiver/);assert.match(checkout,/123 Office delivery street/);
    assert.match(checkout,/name="method" value="ONLINE"/);
    const token=checkout.match(/name="token" value="([^"]+)"/)[1];
    const placed=await post('/checkout',customer,{token,method:'ONLINE',recipient:addressInput.recipient,phone:addressInput.phone,address:addressInput.address});
    const orderUrl=placed.headers.get('location');assert.match(orderUrl,/^\/orders\/\d+$/);
    assert.match(await (await request(orderUrl,customer)).text(),/Thanh toán VNPay sandbox/);
    const supportPage=await (await request('/support/new?order='+orderUrl.split('/').pop(),customer)).text();assert.match(supportPage,/Hỗ trợ đơn/);
    const created=await post('/support',customer,{order_id:orderUrl.split('/').pop(),subject:'Where is my order?',content:'Public question'});
    const ticketUrl=created.headers.get('location');assert.match(ticketUrl,/^\/support\/\d+$/);
    assert.equal((await request(ticketUrl,other)).status,404);
    let ticket=await (await request(ticketUrl,staff)).text();
    await post(ticketUrl+'/messages',staff,{version:version(ticket),content:'INTERNAL-SECRET-CONTENT',internal:'1'});
    ticket=await (await request(ticketUrl,staff)).text();
    await post(ticketUrl+'/messages',staff,{version:version(ticket),content:'PUBLIC-ANSWER',internal:'0'});
    const publicTicket=await (await request(ticketUrl,customer)).text();assert.match(publicTicket,/PUBLIC-ANSWER/);assert.doesNotMatch(publicTicket,/INTERNAL-SECRET-CONTENT/);
    assert.match(await (await request(ticketUrl,staff)).text(),/INTERNAL-SECRET-CONTENT/);
    const goPay=await post(orderUrl+'/pay',customer);
    const gateway=new URL(goPay.headers.get('location'));assert.equal(gateway.host,'sandbox.vnpayment.vn');
    const reference=gateway.searchParams.get('vnp_TxnRef'),amount=gateway.searchParams.get('vnp_Amount');
    const params={vnp_TmnCode:'TESTCODE',vnp_TxnRef:reference,vnp_Amount:amount,vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'12345',vnp_PayDate:vnpDate(Date.now()-1000)};
    params.vnp_SecureHash=signature(params,secret);
    const query=new URLSearchParams(params).toString();
    const returned=await request('/payments/vnpay/return?'+query,customer);assert.equal(returned.headers.get('location'),orderUrl);
    assert.match(await (await request(orderUrl,customer)).text(),/Chờ thanh toán/);
    assert.equal((await request('/payments/vnpay/return?'+query,other)).status,404);
    const invalid=await request('/payments/vnpay/ipn?'+new URLSearchParams({...params,vnp_Amount:'1'}));assert.equal((await invalid.json()).RspCode,'97');
    assert.equal((await (await request('/payments/vnpay/ipn?'+query)).json()).RspCode,'00');
    assert.equal((await (await request('/payments/vnpay/ipn?'+query)).json()).RspCode,'02');
    const paidHtml=await (await request(orderUrl,customer)).text();assert.match(paidHtml,/Đã thu tiền/);
    await post(orderUrl+'/cancel',customer,{version:version(paidHtml),reason:'Changed purchase plan'});
    const refundHtml=await (await request('/admin/refunds',admin)).text();assert.match(refundHtml,/Ghi nhận hoàn tiền/);
    const refundRoute=refundHtml.match(/action="(\/admin\/payments\/\d+\/refund)"/)[1];
    const refundBody={version:version(refundHtml),amount:String(Number(amount)/100),reference:'HTTP-REFUND',evidence_ref:'BANK-RECEIPT',note:'Confirmed refund',occurred_at:new Date(Date.now()+7*3600000).toISOString().slice(0,19)};
    assert.equal((await post(refundRoute,staff,refundBody)).status,403);
    assert.equal((await post(refundRoute,admin,refundBody)).status,302);
    assert.match(await (await request(orderUrl,customer)).text(),/Đã hoàn tiền/);
    const secondSession=await login('3@test.com');
    const visitor=await anonymous('/forgot-password');
    const unknown=await post('/forgot-password',visitor,{email:'missing@test.com'});
    assert.equal(unknown.status,302);
    await post('/forgot-password',visitor,{email:'3@test.com'});
    // Wait for the mock email IPC, without contacting any real SMTP recipient.
    if(!mails.length) await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Mock email timeout')),2000);const receive=message=>{if(message.mail){clearTimeout(timer);child.off('message',receive);resolve();}};child.on('message',receive);});
    assert.equal(mails.length,1);
    const resetToken=mails[0].token;
    const resetVisitor=await anonymous('/reset-password?token='+resetToken);
    const resetResponse=await post('/reset-password',resetVisitor,{token:resetToken,password:'ChangedPassword12345',confirm_password:'ChangedPassword12345'});
    assert.equal(resetResponse.headers.get('location'),'/login');
    assert.equal((await request('/profile',customer)).headers.get('location'),'/login');
    assert.equal((await request('/profile',secondSession)).headers.get('location'),'/login');
    assert.ok(await login('3@test.com','ChangedPassword12345'));
    const newVisitor=await anonymous('/reset-password?token='+resetToken);
    assert.equal((await post('/reset-password',newVisitor,{token:resetToken,password:'ChangedPassword12345',confirm_password:'ChangedPassword12345'})).status,400);
    assert.match(errors,/97/);
    assert.doesNotMatch(errors,new RegExp(secret+'|'+resetToken+'|ChangedPassword12345'));
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
  }
});
