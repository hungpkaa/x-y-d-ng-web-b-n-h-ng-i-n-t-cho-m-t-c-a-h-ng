const { parentPort,workerData }=require('node:worker_threads');
const { Client,types }=require('pg');

types.setTypeParser(20,value=>{
  const number=Number(value);
  if(!Number.isSafeInteger(number)) throw new Error('PostgreSQL integer exceeds safe range');
  return number;
});
types.setTypeParser(1700,value=>Number(value));
const client=new Client({connectionString:workerData.url,connectionTimeoutMillis:5000,
  application_name:'electro-store',statement_timeout:10000,lock_timeout:10000});
// One physical connection per adapter: BEGIN, writes and COMMIT must stay on it.
const ready=client.connect().then(()=>client.query("SET timezone='UTC'"));
ready.catch(()=>{});
const encoder=new TextEncoder();
parentPort.on('message',async message=>{
  const state=new Int32Array(message.state),buffer=new Uint8Array(message.buffer);
  let output;
  try {
    await ready;
    if(message.close) {await client.end();output={ok:true};}
    else {
      let result;
      if(message.sql==='BEGIN IMMEDIATE') {
        await client.query('BEGIN');
        // Match the existing single-writer contract. This lock is shared by all
        // store processes and released automatically by COMMIT/ROLLBACK.
        try { result=await client.query('SELECT pg_advisory_xact_lock(194731,1)'); }
        catch(error) {await client.query('ROLLBACK');throw error;}
      } else if(message.sql==='BEGIN') result=await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      else result=await client.query(message.sql,message.args.length?message.args.map(arg=>arg instanceof Uint8Array?Buffer.from(arg):arg):undefined);
      if(Array.isArray(result)) result=result.at(-1);
      output={rows:result.rows,changes:result.rowCount??0};
    }
  } catch(error) {
    // Do not send connection strings, query parameters or PostgreSQL DETAIL
    // (which may contain private values) back to logs.
    output={error:{code:error.code||'POSTGRES_ERROR',message:error.code==='23505'
      ? 'UNIQUE constraint failed' : 'PostgreSQL operation failed',hint:error.code==='42601'?error.message:undefined}};
  }
  let bytes=encoder.encode(JSON.stringify(output,(_,value)=>value?.type==='Buffer'&&Array.isArray(value.data)?{postgresBytea:Buffer.from(value.data).toString('base64')}:value));
  if(bytes.length>buffer.length) bytes=encoder.encode(JSON.stringify({error:{code:'POSTGRES_RESULT_TOO_LARGE',message:'PostgreSQL result exceeds configured limit'}}));
  buffer.set(bytes);Atomics.store(state,1,bytes.length);Atomics.store(state,0,1);Atomics.notify(state,0);
});
