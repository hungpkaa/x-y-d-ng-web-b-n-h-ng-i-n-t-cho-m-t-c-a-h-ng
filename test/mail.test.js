const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mailConfig,createMailer}=require('../src/mail');
const nodemailer=require('nodemailer');
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
  assert.throws(()=>mailConfig({...settings,SMTP_PASS:''}),/cùng nhau/);
  assert.throws(()=>mailConfig({...settings,SMTP_USER:''}),/cùng nhau/);
  assert.equal(mailConfig({...settings,SMTP_USER:'',SMTP_PASS:''}).transport.auth,undefined);
});

test('SMTP adapter creates reset email with configured origin and encoded token, without contacting SMTP',async t=>{
  const sent=[],transports=[];
  t.mock.method(nodemailer,'createTransport',config=>{
    transports.push(config);return {sendMail:async message=>{sent.push(message);}};
  });
  assert.equal(createMailer({}),null);assert.equal(transports.length,0);
  const env={SMTP_HOST:'mail.test',SMTP_PORT:'465',SMTP_FROM:'sender@test.com',SMTP_USER:'test-user',SMTP_PASS:'local-test-password',APP_URL:'https://store.test/ignored-path?ignored=query'};
  const mailer=createMailer(env);
  await mailer.sendReset({email:'recipient@test.com',token:'local+/&?token'});
  assert.equal(transports.length,1);assert.equal(transports[0].secure,true);
  assert.equal(sent.length,1);assert.equal(sent[0].to,'recipient@test.com');assert.equal(sent[0].from,env.SMTP_FROM);
  assert.ok(sent[0].text.includes('https://store.test/reset-password?token=local%2B%2F%26%3Ftoken'));
  assert.ok(sent[0].text.includes('30 phút'));assert.ok(sent[0].text.includes('một lần'));
  assert.ok(!sent[0].text.includes(env.SMTP_PASS));assert.ok(!sent[0].text.includes('ignored-path'));
});

test('SMTP send failure rejects rather than reporting a successful send',async t=>{
  t.mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>{throw new Error('simulated transport failure');}}));
  const mailer=createMailer({SMTP_HOST:'mail.test',SMTP_FROM:'sender@test.com',APP_URL:'http://localhost:3000'});
  await assert.rejects(mailer.sendReset({email:'recipient@test.com',token:'local-token'}),/simulated transport failure/);
});
