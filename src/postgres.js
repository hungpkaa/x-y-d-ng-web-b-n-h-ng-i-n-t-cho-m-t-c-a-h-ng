const { Worker }=require('node:worker_threads');
const { join }=require('node:path');
const { translate }=require('./postgres-sql');

// A worker owns the asynchronous pg client; this bridge preserves the existing
// synchronous service API during the database migration. Like DatabaseSync,
// it blocks the application thread. See docs/11_POSTGRESQL.md for limits.
class PostgresDatabase {
  constructor(url,{schema='public'}={}) {
    if(!url) throw new Error('DATABASE_URL is required');
    if(!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid PostgreSQL schema');
    this.dialect='postgres';this.closed=false;
    this.worker=new Worker(join(__dirname,'postgres-worker.js'),{workerData:{url}});
    this.worker.on('error',()=>{});
    this.worker.unref();
    try {
      this.exec(`SET search_path TO "${schema}"`);
      this.ids=new Set(this.prepare("SELECT table_name FROM information_schema.columns WHERE table_schema=? AND column_name='id'").all(schema).map(row=>row.table_name));
    } catch(error) {this.worker.terminate();throw error;}
  }
  query(sql,args=[]) {
    if(this.closed) throw new Error('PostgreSQL connection is closed');
    const state=new Int32Array(new SharedArrayBuffer(8));
    const buffer=new SharedArrayBuffer(16*1024*1024);
    this.worker.postMessage({sql,args,state:state.buffer,buffer});
    if(Atomics.wait(state,0,0,20000)==='timed-out') {
      this.closed=true;this.worker.terminate();
      throw new Error('PostgreSQL response timed out; connection was closed');
    }
    const output=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,0,Atomics.load(state,1))),(_,value)=>typeof value?.postgresBytea==='string'?Buffer.from(value.postgresBytea,'base64'):value);
    if(output.error) {const error=new Error(output.error.message);error.code=output.error.code;error.hint=output.error.hint;throw error;}
    return output;
  }
  exec(sql) {this.query(sql==='BEGIN IMMEDIATE'||sql==='BEGIN'?sql:translate(sql));}
  prepare(sql) {
    const converted=translate(sql),self=this;
    return {
      get(...args) {return self.query(converted,args).rows[0];},
      all(...args) {return self.query(converted,args).rows;},
      run(...args) {
        const table=/^\s*INSERT INTO\s+"?([a-z_]+)"?/i.exec(converted)?.[1];
        const returning=table&&self.ids?.has(table)&&! /\bRETURNING\b/i.test(converted);
        const result=self.query(returning?converted.replace(/;\s*$/,'')+' RETURNING id':converted,args);
        return {changes:result.changes,lastInsertRowid:result.rows[0]?.id??0};
      }
    };
  }
  close() {if(!this.closed) {this.closed=true;this.worker.terminate();}}
}
module.exports={PostgresDatabase};
