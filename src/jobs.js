const {randomBytes}=require('node:crypto');
const {transaction}=require('./products');
function enqueue(db,kind,key,payload,at=Date.now()) {
  const json=JSON.stringify(payload);
  db.prepare('INSERT OR IGNORE INTO integration_jobs(kind,request_key,payload_json,available_at,created_at) VALUES(?,?,?,?,?)').run(kind,key,json,at,Date.now());
  const job=db.prepare('SELECT * FROM integration_jobs WHERE request_key=?').get(key);
  if(job.kind!==kind||job.payload_json!==json) throw new Error('Job request key reused with different payload');
  return job.id;
}
function claim(db,now=Date.now(),lease=60000) {
  return transaction(db,()=>{
    const job=db.prepare("SELECT * FROM integration_jobs WHERE (status='PENDING' AND available_at<=?) OR (status='RUNNING' AND lease_until<=?) ORDER BY available_at,id LIMIT 1").get(now,now);
    if(!job) return null;
    const token=randomBytes(16).toString('hex');
    db.prepare("UPDATE integration_jobs SET status='RUNNING',attempts=attempts+1,lease_until=?,lease_token=? WHERE id=?").run(now+lease,token,job.id);
    db.prepare('INSERT INTO job_events(job_id,status,occurred_at) VALUES(?,?,?)').run(job.id,'RUNNING',now);
    return {...job,attempts:job.attempts+1,lease_token:token,payload:JSON.parse(job.payload_json)};
  });
}
function finish(db,job,error=null,now=Date.now()) {
  return transaction(db,()=>{
    const status=error?(job.attempts>=5?'FAILED':'PENDING'):'DONE';
    // Never persist provider messages: they can contain credentials or private data.
    const result=db.prepare("UPDATE integration_jobs SET status=?,available_at=?,lease_until=NULL,lease_token=NULL,last_error=?,completed_at=?,payload_json=CASE WHEN ?='DONE' THEN '{}' ELSE payload_json END WHERE id=? AND status='RUNNING' AND lease_token=?").run(status,now+Math.min(3600000,1000*2**job.attempts),error?'PROVIDER_ERROR':null,error?null:now,status,job.id,job.lease_token);
    if(result.changes) db.prepare('INSERT INTO job_events(job_id,status,occurred_at) VALUES(?,?,?)').run(job.id,status,now);
    return Boolean(result.changes);
  });
}
async function runOne(db,handlers) {
  const job=claim(db);if(!job) return false;
  try {if(!handlers[job.kind]) throw new Error('Unsupported job');await handlers[job.kind](job.payload,job.request_key);finish(db,job);}
  catch(error) {finish(db,job,error);}
  return true;
}
module.exports={enqueue,claim,finish,runOne};
