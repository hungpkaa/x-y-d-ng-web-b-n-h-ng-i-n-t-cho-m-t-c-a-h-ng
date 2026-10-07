const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mailConfig}=require('../src/mail');
test('SMTP không dùng Host header, yêu cầu TLS, cấu hình thiếu tắt khôi phục và production cần HTTPS',()=>{
  assert.equal(mailConfig({}),null);
  const settings={SMTP_HOST:'smtp.example.com',SMTP_FROM:'store@example.com',APP_URL:'https://store.example.com',SMTP_USER:'test-user',SMTP_PASS:'test-only-password'};
  const config=mailConfig(settings);
  assert.equal(config.base,'https://store.example.com');assert.equal(config.transport.port,587);assert.equal(config.transport.requireTLS,true);
  assert.equal(config.transport.disableFileAccess,true);assert.equal(config.transport.disableUrlAccess,true);
  assert.equal(mailConfig({...settings,SMTP_PORT:'465'}).transport.secure,true);
  assert.throws(()=>mailConfig({...settings,NODE_ENV:'production',APP_URL:'http://store.example.com'}),/HTTPS/);
  assert.throws(()=>mailConfig({...settings,APP_URL:'https://user:pass@store.example.com'}),/không hợp lệ/);
  assert.throws(()=>mailConfig({...settings,SMTP_PORT:'invalid'}),/không hợp lệ/);
});
