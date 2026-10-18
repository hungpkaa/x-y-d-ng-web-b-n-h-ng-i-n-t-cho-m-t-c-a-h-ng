const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');

test('QD-23 HTTP: own delivered item → pending → approve → edit → reapprove; public content is escaped',async()=>{
  const password=randomBytes(16).toString('hex');
  const bootstrap=`const data=require(${JSON.stringify(require.resolve('../src/db'))});const db=data.defaultDatabase();
    for(const [id,role] of [[2,'STAFF'],[3,'CUSTOMER'],[4,'CUSTOMER']])db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').run(id,role,id+'@test.com',data.hashPassword(process.env.TEST_PASSWORD),role);
    const orders=require(${JSON.stringify(require.resolve('../src/orders'))}),advance=require(${JSON.stringify(require.resolve('../test-support/shipping'))}).advanceOrder;
    const id=orders.createOrder(db,3,{'1':1},'Buyer','0901234567','123 Example street');
    for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED']){const result=advance(db,id,status,2,{version:db.prepare('SELECT version FROM orders WHERE id=?').get(id).version,reason:'Verified delivery'});if(result.status!==200)throw Error(result.message);}
    data.defaultDatabase=()=>db;require(${JSON.stringify(require.resolve('../src/server'))});`;
  const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,NODE_ENV:'test',DB_PATH:':memory:',PORT:'0',HOST:'127.0.0.1',ADMIN_EMAIL:'admin@test.com',ADMIN_PASSWORD:password,TEST_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let base,errors='';child.stderr.on('data',chunk=>errors+=chunk);
  const request=(url,who,options={})=>fetch(base+url,{redirect:'manual',...options,headers:{...(who?{cookie:who.cookie}:{}),...options.headers}});
  const post=(url,who,body)=>request(url,who,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:who.csrf,...body})});
  const csrf=html=>html.match(/name="_csrf" value="([^"]+)"/)[1];
  async function login(email) {
    const response=await request('/login'),who={cookie:response.headers.get('set-cookie').split(';')[0],csrf:csrf(await response.text())};
    const logged=await post('/login',who,{email,password});assert.equal(logged.headers.get('location'),'/');
    who.cookie=logged.headers.get('set-cookie').split(';')[0];
    who.csrf=csrf(await (await request('/profile',who)).text());return who;
  }
  const publicPage=async()=>{const response=await request('/products/1');assert.equal(response.status,200);return response.text();};
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});
    });
    const buyer=await login('3@test.com'),other=await login('4@test.com'),staff=await login('2@test.com'),admin=await login('admin@test.com');
    const endpoint='/orders/1/items/1/review',content='<script>REVIEW_HTTP_MARKER</script>';
    const body={version:'0',rating:'5',content};
    assert.equal((await post(endpoint,other,body)).status,404);
    assert.equal((await post(endpoint,staff,body)).status,403);
    assert.equal((await post('/orders/999/items/1/review',buyer,body)).status,404);
    assert.equal((await post(endpoint,buyer,body)).headers.get('location'),'/orders/1');
    assert.ok(!(await publicPage()).includes('REVIEW_HTTP_MARKER'));
    const pending=await (await request('/admin/reviews',admin)).text();
    assert.ok(pending.includes('&lt;script&gt;REVIEW_HTTP_MARKER&lt;/script&gt;'));
    const decision={version:'1',status:'APPROVED',reason:''};
    assert.equal((await post('/admin/reviews/1/status',staff,decision)).status,403);
    assert.equal((await post('/admin/reviews/1/status',admin,decision)).headers.get('location'),'/admin/reviews');
    const approved=await publicPage();
    assert.ok(approved.includes('&lt;script&gt;REVIEW_HTTP_MARKER&lt;/script&gt;'));
    assert.ok(!approved.includes(content));assert.ok(approved.includes('5.0/5'));
    await post(endpoint,buyer,{version:'2',rating:'4',content:'REVIEW_EDITED_MARKER'});
    const edited=await publicPage();assert.ok(!edited.includes('REVIEW_EDITED_MARKER'));assert.ok(!edited.includes('REVIEW_HTTP_MARKER'));
    await post('/admin/reviews/1/status',admin,{version:'3',status:'APPROVED',reason:''});
    const reapproved=await publicPage();assert.ok(reapproved.includes('REVIEW_EDITED_MARKER'));assert.ok(reapproved.includes('4.0/5'));
    const ownOrder=await (await request('/orders/1',buyer)).text();
    assert.equal((ownOrder.match(/Sửa đánh giá/g)||[]).length,1);
    await post('/admin/reviews/1/status',admin,{version:'4',status:'HIDDEN',reason:'Verified moderation reason'});
    assert.ok(!(await publicPage()).includes('REVIEW_EDITED_MARKER'));
  } finally {if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
});
