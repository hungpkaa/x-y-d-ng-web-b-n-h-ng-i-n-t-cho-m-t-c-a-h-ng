const {test}=require('node:test');
const assert=require('node:assert/strict');
const {checkIntegrations}=require('../scripts/check-integrations');
const ready={APP_URL:'http://localhost:3000',SMTP_HOST:'mail.test',SMTP_FROM:'sender@test.com',SMTP_PORT:'587',SMTP_USER:'test-user',SMTP_PASS:'test-password',VNPAY_TMN_CODE:'LOCALTEST',VNPAY_HASH_SECRET:'test-signing-key'};

test('Integration preflight detects missing/partial/invalid configuration without returning secret values',()=>{
  assert.deepEqual(checkIntegrations({}).map(row=>row.status),['MISSING','MISSING']);
  assert.deepEqual(checkIntegrations(ready).map(row=>row.status),['CONFIGURED','CONFIGURED']);
  assert.equal(checkIntegrations({...ready,SMTP_PASS:''})[0].status,'INVALID');
  assert.equal(checkIntegrations({...ready,SMTP_PORT:'bad'})[0].status,'INVALID');
  assert.deepEqual(checkIntegrations({...ready,APP_URL:'https://user:private-secret@test.com'}).map(row=>row.status),['INVALID','INVALID']);
  assert.deepEqual(checkIntegrations({...ready,NODE_ENV:'production'}).map(row=>row.status),['INVALID','INVALID']);
  assert.deepEqual(checkIntegrations({...ready,NODE_ENV:'production',APP_URL:'https://store.test'}).map(row=>row.status),['CONFIGURED','CONFIGURED']);
  const output=JSON.stringify(checkIntegrations({...ready,APP_URL:'invalid-secret-url',SMTP_HOST:'private-host'}));
  for(const value of ['invalid-secret-url','private-host',ready.SMTP_USER,ready.SMTP_PASS,ready.VNPAY_HASH_SECRET]) assert.ok(!output.includes(value));
});
