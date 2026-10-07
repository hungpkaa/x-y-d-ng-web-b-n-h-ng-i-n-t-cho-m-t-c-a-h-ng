const {spawnSync}=require('node:child_process');
const {mkdirSync}=require('node:fs');
const {resolve,join}=require('node:path');
const {randomBytes}=require('node:crypto');
try {
  if(!process.env.DATABASE_URL) throw new Error('Chưa cấu hình DATABASE_URL.');
  const url=new URL(process.env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL không hợp lệ.');
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Lệnh sao lưu này dành cho PostgreSQL local.');
  const directory=resolve('data/backups');mkdirSync(directory,{recursive:true});
  const file=join(directory,`postgres-${Date.now()}-${randomBytes(4).toString('hex')}.dump`);
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1))};
  delete env.DATABASE_URL;
  const result=spawnSync('pg_dump',['--no-password','--format=custom','--file',file],{env,encoding:'utf8',timeout:30000,windowsHide:true});
  if(result.error||result.status!==0) throw new Error('Không sao lưu được. Kiểm tra pg_dump trong PATH và kết nối PostgreSQL.');
  console.log('Đã sao lưu PostgreSQL: '+file);
} catch(error) {console.error(error.message);process.exitCode=1;}
