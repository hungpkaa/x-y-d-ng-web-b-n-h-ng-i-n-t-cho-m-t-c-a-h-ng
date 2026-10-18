function migrateBankCheckout(db) {
  require('./bank-ledger-migration').rebuildSqliteTable(db,'checkout_requests',/payment_method IN \('COD','ONLINE'\)/,"payment_method IN ('COD','ONLINE','BANK_TRANSFER')");
  db.exec('ALTER TABLE checkout_requests ADD COLUMN bank_receiver_json TEXT');
}
const postgresBankCheckout="ALTER TABLE checkout_requests DROP CONSTRAINT checkout_requests_payment_method_check; ALTER TABLE checkout_requests ADD CONSTRAINT checkout_requests_payment_method_check CHECK(payment_method IN ('COD','ONLINE','BANK_TRANSFER')); ALTER TABLE checkout_requests ADD COLUMN bank_receiver_json TEXT;";
module.exports={migrateBankCheckout,postgresBankCheckout};
