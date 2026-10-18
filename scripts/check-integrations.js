const {mailConfig}=require('../src/mail');
const {vnpayConfig}=require('../src/payments');

// Validate configuration only: never open a database, transport or network connection.
function checkIntegrations(env) {
  const check=(name,required,validate)=>{
    const missing=required.filter(key=>!env[key]?.trim());
    if(missing.length) return {name,status:'MISSING',fields:missing};
    try {validate();return {name,status:'CONFIGURED'};}
    catch {return {name,status:'INVALID'};} // Provider/URL errors can contain secrets.
  };
  return [
    check('SMTP',['APP_URL','SMTP_HOST','SMTP_FROM'],()=>mailConfig(env)),
    check('VNPAY_SANDBOX',['APP_URL','VNPAY_TMN_CODE','VNPAY_HASH_SECRET'],()=>vnpayConfig(env))
  ];
}
if(require.main===module) {
  const sample=process.argv.includes('--sample');
  const env=sample?require('node:util').parseEnv(require('node:fs').readFileSync(require('node:path').join(__dirname,'../.env.example'),'utf8')):process.env;
  const results=checkIntegrations(env);
  console.log(sample?'SOURCE: .env.example (isolated from environment)':'SOURCE: process environment');
  for(const row of results) console.log(`${row.name}: ${row.status}${row.fields?' — '+row.fields.join(', '):''}`);
  console.log('Configuration only; no network, email, payment or database access. CONFIGURED does not mean connected.');
  process.exitCode=results.every(row=>row.status==='CONFIGURED')?0:1;
}
module.exports={checkIntegrations};
