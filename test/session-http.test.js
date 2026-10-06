const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,readdirSync,unlinkSync,rmdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
test('HTTP restart giữ cookie đăng nhập, CSRF và giỏ; logout vô hiệu cookie cũ',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'electro-http-'));
  let child,base,cookie,csrf;
  const start=()=>new Promise((resolve,reject)=>{
    child=spawn(process.execPath,[require.resolve('../src/server')],{env:{...process.env,NODE_ENV:'test',PORT:'0',DB_PATH:join(folder,'store.sqlite'),ADMIN_EMAIL:'',ADMIN_PASSWORD:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>reject(new Error('Startup timeout')),10000);
    child.once('error',reject);
    child.stdout.on('data',chunk=>{
      const match=String(chunk).match(/http:\/\/localhost:(\d+)/);
      if(match){base=`http://127.0.0.1:${match[1]}`;clearTimeout(timer);resolve();}
    });
  });
  const stop=()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();});
  const get=url=>fetch(base+url,{headers:cookie?{cookie}:{},redirect:'manual'});
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...body}),redirect:'manual'});
  try {
    await start();
    let response=await get('/login');cookie=response.headers.get('set-cookie').split(';')[0];
    csrf=(await response.text()).match(/name="_csrf" value="([^"]+)"/)[1];
    await post('/register',{name:'Customer',email:'persist@test.com',password:'test-password-123'});
    response=await post('/login',{email:'persist@test.com',password:'test-password-123'});
    cookie=response.headers.get('set-cookie').split(';')[0];
    csrf=(await (await get('/')).text()).match(/name="_csrf" value="([^"]+)"/)[1];
    assert.equal((await post('/cart',{id:'1',quantity:'1'})).status,302);
    assert.equal((await post('/compare/add',{id:'1'})).status,302);
    await stop();await start();
    response=await get('/checkout');assert.equal(response.status,200);
    const html=await response.text();assert.match(html,/name="token"/);
    assert.ok(html.includes(csrf));
    const comparisonHtml=await (await get('/compare')).text();assert.match(comparisonHtml,/So sánh SKU \(1\/3\)/);assert.match(comparisonHtml,/DEMO-1/);
    assert.equal((await post('/logout',{})).status,302);
    assert.equal((await get('/checkout')).headers.get('location'),'/login');
  } finally {
    if(child?.exitCode===null) await stop();
    const backups=join(folder,'backups');
    for(const name of readdirSync(backups)) unlinkSync(join(backups,name));
    rmdirSync(backups);
    for(const name of readdirSync(folder)) unlinkSync(join(folder,name));
    rmdirSync(folder);
  }
});
