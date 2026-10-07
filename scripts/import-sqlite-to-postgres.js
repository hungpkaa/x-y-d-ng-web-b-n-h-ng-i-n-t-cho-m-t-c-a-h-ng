const {DatabaseSync}=require('node:sqlite');
const {existsSync,mkdirSync}=require('node:fs');
const {resolve,dirname,join}=require('node:path');
const {PostgresDatabase}=require('../src/postgres');
const {migratePostgres}=require('../src/postgres-migrations');
const {migrate}=require('../src/migrations');
const {randomBytes}=require('node:crypto');

function importSqlite(file,url,{schema='public'}={}) {
  if(!existsSync(file)) throw new Error('Không tìm thấy file SQLite nguồn.');
  let source,target;
  try {
    // Copy before upgrading the source. The actual import always reads the copy,
    // so the original SQLite store remains unchanged and available for rollback.
    source=new DatabaseSync(file,{readOnly:true});
    const directory=join(dirname(file),'backups');mkdirSync(directory,{recursive:true});
    const backup=join(directory,`before-postgres-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`);
    source.prepare('VACUUM INTO ?').run(backup);source.close();
    source=new DatabaseSync(backup);
    source.exec('PRAGMA foreign_keys=ON');migrate(source,':memory:');
    if(source.prepare('PRAGMA foreign_key_check').all().length) throw new Error('SQLite nguồn có khóa ngoại không hợp lệ.');
    target=new PostgresDatabase(url,{schema});migratePostgres(target);
    target.exec('BEGIN IMMEDIATE');
    try {
      const tables=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all();
      const allowedTables=new Set(target.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' AND table_name<>'postgres_migrations' AND table_name<>'schema_migrations'").all().map(row=>row.table_name));
      if(tables.length!==allowedTables.size||tables.some(row=>!allowedTables.has(row.name))) throw new Error('Schema SQLite không khớp các bảng ứng dụng được hỗ trợ.');
      for(const {name} of tables) {
        // The only allowed bootstrap row is the untouched default shipping rule.
        const count=target.prepare(`SELECT COUNT(*) n FROM "${name}"`).get().n;
        if(count&&(name!=='shipping_policy'||count!==1||target.prepare('SELECT fee,version FROM shipping_policy WHERE id=1').get()?.fee!==0||target.prepare('SELECT version FROM shipping_policy WHERE id=1').get()?.version!==1)) throw new Error('PostgreSQL đã có dữ liệu; không ghi đè.');
      }
      target.exec('DELETE FROM shipping_policy');
      const counts={};
      for(const {name} of tables) {
        const columns=source.prepare(`PRAGMA table_info("${name}")`).all().map(row=>row.name);
        const allowedColumns=new Set(target.prepare('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?').all(name).map(row=>row.column_name));
        if(columns.length!==allowedColumns.size||columns.some(column=>!allowedColumns.has(column))) throw new Error('Cấu trúc cột SQLite không khớp PostgreSQL.');
        const insert=target.prepare(`INSERT INTO "${name}"(${columns.map(column=>`"${column}"`).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
        let count=0;
        for(const row of source.prepare(`SELECT * FROM "${name}"`).iterate()) {insert.run(...columns.map(column=>row[column]));count++;}
        if(target.prepare(`SELECT COUNT(*) n FROM "${name}"`).get().n!==count) throw new Error('Số bản ghi sau nhập không khớp.');
        counts[name]=count;
        if(target.ids.has(name)) target.prepare(`SELECT setval(pg_get_serial_sequence(?, 'id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM "${name}"`).get(name);
      }
      target.exec('COMMIT');return {backup,counts};
    } catch(error) {target.exec('ROLLBACK');throw error;}
  } finally {source?.close();target?.close();}
}
if(require.main===module) {
  try {
    if(!process.env.DATABASE_URL) throw new Error('Chưa cấu hình DATABASE_URL.');
    const result=importSqlite(resolve(process.argv[2]||'data/store.sqlite'),process.env.DATABASE_URL,{schema:process.env.DATABASE_SCHEMA||'public'});
    console.log('Đã nhập SQLite vào PostgreSQL. Bản sao lưu: '+result.backup);
    console.log(JSON.stringify(result.counts,null,2));
  } catch(error) {console.error('Nhập dữ liệu thất bại: '+error.message+' (mã '+(error.code||'VALIDATION')+').');process.exitCode=1;}
}
module.exports={importSqlite};
