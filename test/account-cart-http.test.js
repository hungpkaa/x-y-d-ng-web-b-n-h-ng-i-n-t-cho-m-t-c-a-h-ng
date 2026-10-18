const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');

test('AT-35..38 HTTP: giỏ tài khoản qua logout, gộp một lần, hai phiên, checkout replay và phiên cũ',async()=>{
  const password=randomBytes(16).toString('hex');
  const bootstrap=`const data=require(${JSON.stringify(require.resolve('../src/db'))});const db=data.defaultDatabase();for(const id of [1,2])db.prepare('INSERT INTO users(id,name,email,password) VALUES(?,?,?,?)').run(id,'Customer '+id,id+'@test.com',data.hashPassword(process.env.TEST_PASSWORD));const sid='legacy-session',secret=require(${JSON.stringify(require.resolve('../src/session-store'))}).sessionSecret(db);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid,JSON.stringify({userId:2,authVersion:1,cartVersion:2,csrf:'legacy-csrf',cookie:{originalMaxAge:600000,expires:new Date(Date.now()+600000),httpOnly:true,path:'/'},cart:{'2':2}}),Date.now()+600000);process.send({legacy:encodeURIComponent('s:'+require('cookie-signature').sign(sid,secret))});data.defaultDatabase=()=>db;require(${JSON.stringify(require.resolve('../src/server'))});`;
  const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,NODE_ENV:'test',DB_PATH:':memory:',PORT:'0',HOST:'127.0.0.1',ADMIN_EMAIL:'',ADMIN_PASSWORD:'',TEST_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let base,legacy,errors='';child.stderr.on('data',chunk=>errors+=chunk);child.on('message',message=>{if(message.legacy)legacy=message.legacy;});
  const request=(url,who,options={})=>fetch(base+url,{redirect:'manual',...options,headers:{...(who?{cookie:who.cookie}:{}),...options.headers}});
  const post=(url,who,body={})=>request(url,who,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:who.csrf,...body})});
  const csrf=html=>html.match(/name="_csrf" value="([^"]+)"/)[1];
  const quantity=html=>html.match(/name="quantity"[^>]*value="(\d+)"/)?.[1];
  async function anonymous() {const response=await request('/login');return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:csrf(await response.text())};}
  async function cart(who) {const response=await request('/cart',who);assert.equal(response.status,200);const html=await response.text();who.csrf=csrf(html);return html;}
  async function login(id,who=undefined,pass=password) {
    who ||= await anonymous();const response=await post('/login',who,{email:id+'@test.com',password:pass});
    assert.equal(response.headers.get('location'),'/');who.cookie=response.headers.get('set-cookie').split(';')[0];await cart(who);return who;
  }
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/localhost:(\d+)/);if(m){base='http://127.0.0.1:'+m[1];clearTimeout(timer);resolve();}});
    });
    const guest=await anonymous();await post('/cart',guest,{id:'1',quantity:'2',action:'add'});
    const a=await login(1,guest);
    assert.equal(quantity(await cart(a)),'2');assert.equal(quantity(await cart(a)),'2');
    const b=await login(2);assert.equal(quantity(await cart(b)),undefined);
    const a2=await login(1);const stale=await cart(a2),oldVersion=stale.match(/name="cart_version" value="(\d+)"/)[1];
    await post('/cart',a,{id:'1',quantity:'3'});
    await post('/cart',a2,{id:'1',quantity:'1',cart_version:oldVersion});
    assert.equal(quantity(await cart(a2)),'3');
    await post('/logout',a);assert.equal((await request('/checkout',a)).headers.get('location'),'/login');
    const newGuest=await anonymous();assert.equal(quantity(await cart(newGuest)),undefined);
    const again=await login(1,newGuest);assert.equal(quantity(await cart(again)),'3');
    const quote=await (await request('/checkout',again)).text(),token=quote.match(/name="token" value="([^"]+)"/)[1];
    const body={token,recipient:'Customer One',phone:'0901234567',address:'123 Example street',method:'COD'};
    const placed=await post('/checkout',again,body),orderUrl=placed.headers.get('location');assert.match(orderUrl,/^\/orders\/\d+$/);
    assert.equal(quantity(await cart(again)),undefined);assert.equal((await request(orderUrl,b)).status,404);
    await post('/cart',again,{id:'2',quantity:'1'});await post('/checkout',again,body);
    assert.equal(quantity(await cart(again)),'1');
    const oldSession={cookie:'connect.sid='+legacy,csrf:'legacy-csrf'};
    assert.equal(quantity(await cart(oldSession)),'2');assert.equal(quantity(await cart(oldSession)),'2');
    await post('/logout',oldSession);assert.equal(quantity(await cart(await login(2))),'2');
    const profile=await (await request('/profile',again)).text(),newPassword=randomBytes(16).toString('hex');
    await post('/profile/password',again,{version:profile.match(/name="version" value="(\d+)"/)[1],current_password:password,new_password:newPassword,confirm_password:newPassword});
    assert.equal((await request('/checkout',a2)).headers.get('location'),'/login');
    assert.equal(quantity(await cart(await login(1,undefined,newPassword))),'1');
  } finally {if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
});
