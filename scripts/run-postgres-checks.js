const {spawnSync}=require('node:child_process');
const {join}=require('node:path');
if(!process.env.DATABASE_URL) {console.error('Chưa cấu hình DATABASE_URL.');process.exitCode=1;}
else {
  const result=spawnSync(process.execPath,['--test',join(__dirname,'../test/postgres.test.js')],{
    env:{...process.env,POSTGRES_TEST:'1'},stdio:'inherit',windowsHide:true
  });
  process.exitCode=result.status??1;
}
