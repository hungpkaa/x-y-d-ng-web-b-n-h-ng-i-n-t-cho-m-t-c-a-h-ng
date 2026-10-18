function migrateBankLedger(db) {
  rebuildSqliteTable(db,'payments',/provider IN \('COD','VNPAY'\)/,"provider IN ('COD','VNPAY','BANK_TRANSFER')");
}
function rebuildSqliteTable(db,table,pattern,replacement) {
  // Migration runner disables FK enforcement before BEGIN and checks every FK
  // before commit. Rebuild preserves IDs, columns, indexes and triggers.
  const definition=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table).sql;
  const extras=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL").all(table);
  const expanded=definition.replace(pattern,replacement);
  if(expanded===definition) throw new Error('Unexpected payments provider schema');
  const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(row=>'"'+row.name+'"').join(',');
  db.exec(expanded.replace(new RegExp('CREATE TABLE\\s+"?'+table+'"?','i'),'CREATE TABLE '+table+'_next'));
  db.exec(`INSERT INTO ${table}_next(${columns}) SELECT ${columns} FROM ${table}; DROP TABLE ${table}; ALTER TABLE ${table}_next RENAME TO ${table};`);
  for(const row of extras) db.exec(row.sql);
}
const postgresBankLedger="ALTER TABLE payments DROP CONSTRAINT payments_provider_check; ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK(provider IN ('COD','VNPAY','BANK_TRANSFER'));";
module.exports={migrateBankLedger,postgresBankLedger,rebuildSqliteTable};
