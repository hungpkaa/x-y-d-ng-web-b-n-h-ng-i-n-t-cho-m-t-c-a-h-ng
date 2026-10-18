const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');

test('HTTP login: thành công không tính lần sai; vượt 10 lần sai bị 429, không bỏ bảo vệ',async()=>{
  const password=randomBytes(16).toString('hex');
  const child=spawn(process.execPath,[require.resolve('../src/server')],{
    env:{...process.env,NODE_ENV:'test',DB_PATH:':memory:',PORT:'0',HOST:'127.0.0.1',ADMIN_EMAIL:'rate@test.com',ADMIN_PASSWORD:password},
    windowsHide:true,stdio:['ignore','pipe','pipe']
  });
  let base,errors='';child.stderr.on('data',chunk=>errors+=chunk);
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exit '+code+': '+errors));});
      child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});
    });
    async function login(email,attemptPassword) {
      const page=await fetch(base+'/login'),html=await page.text();
      return fetch(base+'/login',{
        method:'POST',redirect:'manual',headers:{cookie:page.headers.get('set-cookie').split(';')[0],'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({_csrf:html.match(/name="_csrf" value="([^"]+)"/)[1],email,password:attemptPassword})
      });
    }
    for(let index=0;index<12;index++) {
      const response=await login('rate@test.com',password);
      assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/');
    }
    for(let index=0;index<10;index++) {
      const response=await login(index%2?'unknown@test.com':'rate@test.com','wrong-password');
      assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/login');
    }
    const blocked=await login('rate@test.com',password);
    assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'900');
    assert.match(await blocked.text(),/Hãy thử lại sau 15 phút/);
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
  }
});
