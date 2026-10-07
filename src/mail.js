const nodemailer=require('nodemailer');
function mailConfig(env=process.env) {
  if(!env.SMTP_HOST||!env.SMTP_FROM||!env.APP_URL) return null;
  const base=new URL(env.APP_URL),port=Number(env.SMTP_PORT||587);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||!Number.isInteger(port)||port<1||port>65535) throw new Error('Cấu hình SMTP/APP_URL không hợp lệ.');
  if(env.NODE_ENV==='production'&&base.protocol!=='https:') throw new Error('APP_URL cần HTTPS khi production.');
  return {base:base.origin,from:env.SMTP_FROM,transport:{host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASS}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true}};
}
function createMailer(env=process.env) {
  const config=mailConfig(env);
  if(!config) return null;
  const transport=nodemailer.createTransport(config.transport);
  return {async sendReset({email,token}) {
    const link=config.base+'/reset-password?token='+encodeURIComponent(token);
    await transport.sendMail({from:config.from,to:email,subject:'Khôi phục mật khẩu Electro Store',text:'Bạn đã yêu cầu khôi phục mật khẩu. Liên kết có hiệu lực 30 phút và dùng một lần:\n'+link+'\nNếu bạn không yêu cầu, hãy bỏ qua email này.'});
  }};
}
module.exports={mailConfig,createMailer};
