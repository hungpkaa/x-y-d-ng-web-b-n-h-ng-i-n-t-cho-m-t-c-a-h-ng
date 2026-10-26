const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { randomBytes, timingSafeEqual, createHash } = require('node:crypto');
const path = require('node:path');
const { defaultDatabase, hashPassword, verifyPassword } = require('./db');
const { transitionOrder,recordCodReceipt, transitions, labels, getVariant } = require('./orders');
const { saveProduct,saveVariant,priceVariant,adjustStock,publishProduct } = require('./products');
const { saveCatalog } = require('./catalog');
const { listProducts,catalogGroups } = require('./product-list');
const {provinces:addressProvinces,addressParts,resolveAddress,addressDraft}=require('./address-regions');
const { saveDefinition,saveAttributes,getAttributes } = require('./attributes');
const { addImage,changeImage,reorderImages } = require('./product-images');
const { DatabaseSessionStore,sessionSecret }=require('./session-store');
const { issueCheckout }=require('./checkout');
const { submitAccountCheckout }=require('./checkout');
const accountCart=require('./account-cart');
const {saveProfile,changePassword,createStaff,saveStaff,setAccountStatus}=require('./accounts');
const {listRecords}=require('./management-list');
const {shippingPolicy,saveShippingPolicy}=require('./shipping');
const {readComparison,changeComparison,comparisonTable}=require('./comparison');
const {recommendProducts,recommendationFilters}=require('./recommendations');
const {savePromotion,togglePromotion,listPromotions,displayTime}=require('./promotions');
const {saveReview,moderateReview,orderReviews,publicReviews,listReviews}=require('./reviews');
const {salesReport,reportCsv,auditRecords,localDateTime}=require('./reporting');
const customerServices=require('./customer-services');
const payments=require('./payments');
const shipments=require('./shipments');
const bankTransfers=require('./bank-transfer');
const engagement=require('./engagement');
const engagementEnabled=()=>engagement.enabled(db);
const mailer=require('./mail').createMailer();
const paymentConfig=payments.vnpayConfig();
const db = defaultDatabase();
const jobs=require('./jobs');
const paymentExceptions=require('./payment-exceptions');
const storeContent=require('./store-content');
const app = express();
app.use((req,res,next)=>{req.requestId=randomBytes(12).toString('hex');res.set('X-Request-ID',req.requestId);next();});
app.get('/health/live',(req,res)=>res.json({status:'ok'}));
app.get('/health/ready',(req,res)=>{try{db.prepare('SELECT 1 AS ok').get();res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('Cần SESSION_SECRET khi chạy production');
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'..','views'));
if(process.env.TRUST_PROXY_HOPS) {
  const hops=Number(process.env.TRUST_PROXY_HOPS);
  if(!Number.isSafeInteger(hops)||hops<1||hops>5) throw new Error('TRUST_PROXY_HOPS cần từ 1 đến 5.');
  app.set('trust proxy',hops);
}
app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:["'self'",'data:','blob:']}}}));
app.get('/payments/vnpay/ipn',(req,res)=>{
  res.set('Cache-Control','no-store');
  try {
    const result=payments.processIpn(db,req.query,paymentConfig);
    if(!['00','02'].includes(result.RspCode)) console.warn('VNPay IPN bị từ chối; mã phản hồi: '+result.RspCode);
    res.json(result);
  }
  catch {console.error('Không thể xử lý VNPay IPN; giao dịch đã rollback.');res.json({RspCode:'99',Message:'Processing error'});}
});
app.use(express.static(path.join(__dirname,'..','public')));
app.use(express.urlencoded({ extended:false, limit:'32kb' }));
app.use(express.json({limit:'7mb'}));
app.use(session({ store:new DatabaseSessionStore(db), secret:sessionSecret(db), resave:false, saveUninitialized:false, cookie:{ httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', maxAge:86400000 } }));
app.use((req,res,next) => {
  req.session.csrf ||= randomBytes(32).toString('hex');
  req.session.cart ||= {};
  if(req.session.cartVersion!==2) { if(Object.keys(req.session.cart).length) req.session.notice='Giỏ hàng được đặt lại do nâng cấp SKU. Hãy chọn lại cấu hình sản phẩm.'; req.session.cart={}; req.session.cartVersion=2; }
  req.user = req.session.userId ? db.prepare('SELECT id,name,email,role,status,auth_version,version,phone,address FROM users WHERE id=?').get(req.session.userId) : null;
  if(req.session.userId&&(!req.user||req.user.status!=='ACTIVE'||req.user.auth_version!==(req.session.authVersion??1))) {
    return req.session.destroy(error=>{if(error) return next(error);res.clearCookie('connect.sid');res.redirect('/login');});
  }
  if(req.user?.role==='CUSTOMER') {
    if(Object.keys(req.session.cart).length) {
      const imported=accountCart.mergeCart(db,req.user,createHash('sha256').update('legacy:'+req.sessionID).digest('hex'),req.session.cart);
      if(imported.status!==200) return res.status(imported.status).send(imported.message);
      req.session.cart={};
    }
    req.accountCart=accountCart.readCart(db,req.user);
    if(req.accountCart.status!==200) return res.status(req.accountCart.status).send(req.accountCart.message);
  }
  res.locals.cartVersion=req.accountCart?.version??null;
  res.locals.store=storeContent.content(db);
  res.locals.storeCategories=db.prepare('SELECT name FROM categories WHERE active=1 ORDER BY name').all();
  res.locals.user = req.user;
  res.locals.addressProvinces=addressProvinces;
  res.locals.addressParts=addressParts;
  if(req.user) res.set('Cache-Control','no-store');
  res.locals.csrf = req.session.csrf;
  res.locals.money = value => new Intl.NumberFormat('vi-VN',{ style:'currency',currency:'VND' }).format(value);
  res.locals.labels = labels;
  res.locals.transitions = transitions;
  res.locals.cartCount = Object.values(req.accountCart?.quantities??req.session.cart).reduce((a,b) => a+b,0);
  const comparison=readComparison(db,req.session.comparison);
  if(comparison.removed) req.session.notice=[req.session.notice,'Danh sách so sánh đã bỏ các SKU không còn được công bố hoặc không còn cùng danh mục.'].filter(Boolean).join(' ');
  req.session.comparison=comparison.ids;
  res.locals.comparisonIds=comparison.ids;
  res.locals.comparisonCount=comparison.ids.length;
  res.locals.promotionTime=displayTime;
  res.locals.localDateTime=localDateTime;
  res.locals.notice = req.session.notice;
  res.locals.managementPath=req.path;
  res.locals.managementLayout=!!req.user&&['STAFF','ADMIN'].includes(req.user.role)&&(req.path.startsWith('/admin')||/^\/orders\/\d+$/.test(req.path));
  res.locals.unreadNotifications=engagementEnabled()&&req.user?.role==='CUSTOMER'?db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).n:0;
  delete req.session.notice;
  if (req.method === 'POST') {
    const provided = Buffer.from(String(req.body?._csrf || ''));
    const expected = Buffer.from(req.session.csrf);
    if (provided.length !== expected.length || !timingSafeEqual(provided,expected)) return res.status(403).send('Yêu cầu không hợp lệ. Tải lại trang và thử lại.');
  }
  next();
});
const auth = (req,res,next) => req.user ? next() : res.redirect('/login');
const customer = (req,res,next) => !req.user ? res.redirect('/login') : req.user.role==='CUSTOMER' ? next() : res.status(403).send('Hãy dùng tài khoản khách hàng để mua hàng.');
const cartAccess = (req,res,next) => !req.user || req.user.role==='CUSTOMER' ? next() : res.status(403).send('Hãy dùng tài khoản khách hàng để mua hàng.');
const staff = (req,res,next) => req.user && ['STAFF','ADMIN'].includes(req.user.role) ? next() : res.status(403).send('Bạn không có quyền truy cập.');
const admin = (req,res,next) => req.user?.role === 'ADMIN' ? next() : res.status(403).send('Chỉ quản trị viên được truy cập chức năng này.');
function flash(req,res,message,url) { req.session.notice=message; res.redirect(url); }
function render(res,page,data={}) { res.render('index',{ page,...data }); }
function textField(value,min,max) { return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max; }

app.post('/chatbot/message',(req,res)=>{
  res.set('Cache-Control','no-store');
  const now=Date.now(),limit=req.session.chatLimit;
  if(limit&&limit.until>now&&limit.count>=20) return res.status(429).json({message:'Bạn đã gửi nhiều câu hỏi. Hãy thử lại sau một phút.'});
  req.session.chatLimit=limit&&limit.until>now?{...limit,count:limit.count+1}:{count:1,until:now+60000};
  const result=require('./chatbot').reply(db,req.user,req.body.message);
  res.status(result.status).json(result);
});
app.get('/admin/dashboard',staff,(req,res)=>render(res,'dashboard',require('./dashboard').dashboard(db,req.user)));
app.get('/favorites',customer,(req,res)=>render(res,'saved-products',{...engagement.favorites(db,req.user,req.query),heading:'Sản phẩm yêu thích',favoriteList:true}));
app.post('/favorites/:id/:action',customer,(req,res)=>productResult(req,res,engagement.favorite(db,req.user,Number(req.params.id),req.params.action),'/favorites'));
app.get('/recent',(req,res)=>render(res,'saved-products',{rows:engagement.recent(db,req.user,req.session.recentProducts),paging:null,heading:'Sản phẩm đã xem',favoriteList:false}));
app.post('/recent/clear',cartAccess,(req,res)=>{
  if(req.user) db.prepare('DELETE FROM recent_products WHERE user_id=?').run(req.user.id);
  req.session.recentProducts=[];flash(req,res,'Đã xóa lịch sử sản phẩm đã xem.','/recent');
});
app.get('/notifications',customer,(req,res)=>{
  engagement.scan(db);
  res.locals.unreadNotifications=db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).n;
  render(res,'notifications',engagement.notifications(db,req.user,req.query));
});
app.post('/notifications/read/:id',customer,(req,res)=>productResult(req,res,engagement.markRead(db,req.user,req.params.id==='all'?'all':Number(req.params.id)),'/notifications'));
app.post('/notifications/preferences',customer,(req,res)=>productResult(req,res,engagement.savePreferences(db,req.user,req.body),'/notifications'));
app.post('/watches/:id',customer,(req,res)=>productResult(req,res,engagement.watch(db,req.user,Number(req.params.id),req.body),'/notifications'));
app.get('/',(req,res) => {
  const listing=listProducts(db,req.query);
  if(listing.status!==200) return res.status(listing.status).send(listing.message);
  const categories=db.prepare("SELECT DISTINCT category FROM products WHERE status='ACTIVE' ORDER BY category").all();
  render(res,'catalog',{...listing,categories,catalogGroups:catalogGroups(db,req.query,listing,categories),brands:db.prepare("SELECT DISTINCT brand FROM products WHERE status='ACTIVE' AND (?='' OR category=?) ORDER BY brand").all(listing.category,listing.category),categoryDesign:listing.category?require('./category-presentation').categoryPresentation(listing.category):null,recommendation:recommendProducts(db)});
});
app.get('/compare',(req,res)=>render(res,'compare',{comparison:comparisonTable(db,req.session.comparison)}));
app.post('/compare/:action',(req,res)=>{
  const result=changeComparison(db,req.session.comparison,req.params.action,req.body.id);
  req.session.comparison=result.ids;
  productResult(req,res,result,'/compare');
});
app.get('/recommendations',(req,res)=>{
  const result=recommendProducts(db,{sourceId:req.query.source??null,variantId:req.query.sku??null,query:req.query});
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'recommendations',{recommendation:result,options:recommendationFilters(db)});
});
app.get('/media/:key',(req,res)=>{
  const image=db.prepare('SELECT i.data,i.mime,p.status FROM product_images i JOIN products p ON p.id=i.product_id WHERE i.storage_key=?').get(req.params.key);
  if(!image||(image.status!=='ACTIVE'&&!['STAFF','ADMIN'].includes(req.user?.role))) return res.status(404).send('Không tìm thấy ảnh.');
  res.set('Cache-Control','no-store').type(image.mime).send(Buffer.from(image.data));
});
app.get('/products/:id',(req,res) => {
  const product = db.prepare("SELECT * FROM products WHERE id=? AND status='ACTIVE'").get(Number(req.params.id));
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm.');
  req.session.recentProducts=[product.id,...(req.session.recentProducts||[]).filter(id=>id!==product.id)].slice(0,20);
  if(engagementEnabled()&&req.user?.role==='CUSTOMER') engagement.recordView(db,req.user,product.id);
  res.locals.isFavorite=engagementEnabled()&&req.user?.role==='CUSTOMER'?!!db.prepare('SELECT product_id FROM favorites WHERE user_id=? AND product_id=?').get(req.user.id,product.id):false;
  res.locals.productWatches=engagementEnabled()&&req.user?.role==='CUSTOMER'?db.prepare('SELECT * FROM product_watches WHERE user_id=?').all(req.user.id):[];
  const recommendation=recommendProducts(db,{sourceId:product.id,variantId:req.query.sku??null});
  if(recommendation.status!==200) return res.status(recommendation.status).send(recommendation.message);
  const variants=db.prepare('SELECT *,on_hand-reserved AS stock FROM product_variants WHERE product_id=? AND active=1 ORDER BY id').all(product.id);
  const reviews=publicReviews(db,product.id,req.query.reviews_page??'1',recommendation.anchor?.id);
  if(reviews.status!==200) return res.status(reviews.status).send(reviews.message);
  render(res,'product',{product,variants:variants.map(v=>({...v,attributes:getAttributes(db,v.id)})),images:db.prepare('SELECT id,storage_key,alt_text FROM product_images WHERE product_id=? ORDER BY sort_order,id').all(product.id),recommendation,reviews});
});
app.get('/register',(req,res) => render(res,'register'));
app.get('/forgot-password',(req,res)=>render(res,'forgot-password',{available:Boolean(mailer)}));
app.post('/forgot-password',(req,res)=>{
  if(!customerServices.rateLimit(db,'reset-ip:'+req.ip,5)) return res.status(429).send('Vui lòng thử lại sau 15 phút.');
  if(!mailer) return res.status(503).send('Khôi phục mật khẩu tạm thời chưa khả dụng. Vui lòng liên hệ cửa hàng.');
  const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
  if(email.length>150||!customerServices.rateLimit(db,'reset-email:'+email,3)) return flash(req,res,'Nếu email đang được sử dụng, bạn sẽ nhận được liên kết khôi phục.','/forgot-password');
  const reset=customerServices.issuePasswordReset(db,email);
  if(reset) mailer.sendReset(reset).catch(()=>console.error('Không gửi được email khôi phục; kiểm tra cấu hình SMTP.'));
  flash(req,res,'Nếu email đang được sử dụng, bạn sẽ nhận được liên kết khôi phục.','/forgot-password');
});
app.get('/reset-password',(req,res)=>{
  res.set('Referrer-Policy','no-referrer').set('Cache-Control','no-store');
  if(typeof req.query.token!=='string'||! /^[a-f0-9]{64}$/.test(req.query.token)) return render(res.status(400),'reset-password',{token:'',resetError:'Liên kết khôi phục không hợp lệ. Hãy yêu cầu liên kết mới.'});
  render(res,'reset-password',{token:req.query.token});
});
app.post('/reset-password',(req,res,next)=>{
  res.set('Referrer-Policy','no-referrer').set('Cache-Control','no-store');
  if(!customerServices.rateLimit(db,'reset-submit:'+req.ip,10)) return res.status(429).send('Vui lòng thử lại sau 15 phút.');
  const result=customerServices.resetPassword(db,req.body.token,req.body);
  if(result.status!==200) return render(res.status(result.status),'reset-password',{token:typeof req.body.token==='string'&&/^[a-f0-9]{64}$/.test(req.body.token)?req.body.token:'',resetError:result.message});
  req.session.destroy(error=>{if(error) return next(error);res.clearCookie('connect.sid');res.redirect('/login');});
});
app.post('/register',(req,res) => {
  const { name,email,password } = req.body;
  if (!textField(name,2,80) || !textField(email,5,150) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !textField(password,10,128)) return flash(req,res,'Tên, email không hợp lệ hoặc mật khẩu chưa đủ 10 ký tự.','/register');
  try { db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name.trim(),email.trim().toLowerCase(),hashPassword(password)); }
  catch(error) { if (error.code?.startsWith('ERR_SQLITE') || error.code==='23505') return flash(req,res,'Không thể đăng ký email này.','/register'); throw error; }
  flash(req,res,'Đăng ký thành công. Hãy đăng nhập.','/login');
});
app.get('/login',(req,res) => render(res,'login'));
app.post('/login',(req,res,next) => {
  const failureKey='login-failures:'+req.ip;
  if(!customerServices.rateLimit(db,'login-requests:'+req.ip,60)||customerServices.isRateLimited(db,failureKey,10)) {
    res.set('Retry-After','900');
    return res.status(429).send('Đã thử đăng nhập quá nhiều lần. Hãy thử lại sau 15 phút.');
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const failed=()=>{customerServices.rateLimit(db,failureKey,10);return flash(req,res,'Thông tin đăng nhập không đúng.','/login');};
  if (password.length > 128) return failed();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || user.status!=='ACTIVE' || !verifyPassword(password,user.password)) return failed();

  const cart = user.role==='CUSTOMER'?req.session.cart:{};
  if(user.role==='CUSTOMER'&&Object.keys(cart).length) {
    const merged=accountCart.mergeCart(db,{id:user.id},req.session.cartSourceKey||createHash('sha256').update('guest:'+req.sessionID).digest('hex'),cart);
    if(merged.status!==200) return flash(req,res,merged.message,'/login');
  }
  const comparison=req.session.comparison;
  const recentProducts=(req.session.recentProducts||[]).slice(0,20);
  if(engagementEnabled()&&user.role==='CUSTOMER') {
    for(const id of [...recentProducts].reverse()) engagement.recordView(db,user,id);
  }
  req.session.regenerate(error => { if(error) return next(error); req.session.userId=user.id; req.session.authVersion=user.auth_version; req.session.cart={}; req.session.cartVersion=2; req.session.comparison=comparison; req.session.recentProducts=recentProducts; res.redirect('/'); });
});
app.post('/logout',(req,res,next) => req.session.destroy(error => { if(error) return next(error); res.clearCookie('connect.sid'); res.redirect('/'); }));
app.get('/profile',auth,(req,res)=>render(res,'profile'));
app.get('/addresses',customer,(req,res)=>render(res,'addresses',{addresses:customerServices.addresses(db,req.user)}));
app.post('/addresses',customer,(req,res)=>productResult(req,res,customerServices.saveAddress(db,req.user,null,req.body),'/addresses'));
app.post('/addresses/:id',customer,(req,res)=>productResult(req,res,customerServices.saveAddress(db,req.user,Number(req.params.id),req.body),'/addresses'));
for(const action of ['default','delete']) app.post('/addresses/:id/'+action,customer,(req,res)=>productResult(req,res,customerServices.changeAddress(db,req.user,Number(req.params.id),req.body,action),'/addresses'));
app.get('/support',customer,(req,res)=>{
  const result=customerServices.listSupport(db,req.user,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'support',result);
});
app.get('/support/new',customer,(req,res)=>{
  if(req.query.order===undefined) {
    const listing=listRecords(db,'orders',req.query,req.user.id);
    if(listing.status!==200) return res.status(listing.status).send(listing.message);
    // Keep pagination on the order picker rather than the normal order list.
    for(const key of ['previous','next']) if(listing.paging[key]) listing.paging[key]=listing.paging[key].replace('/orders?','/support/new?');
    return render(res,'support-select-order',{orders:listing.rows,filters:listing.filters,paging:listing.paging});
  }
  if(typeof req.query.order!=='string'||!/^[1-9]\d*$/.test(req.query.order)||!Number.isSafeInteger(Number(req.query.order))) return res.status(400).send('Hãy mở chi tiết đơn hàng và chọn yêu cầu hỗ trợ cho đơn đó.');
  const order=db.prepare('SELECT id FROM orders WHERE id=? AND user_id=?').get(Number(req.query.order),req.user.id);
  if(!order) return res.status(404).send('Không tìm thấy đơn hàng.');
  render(res,'support-new',{order});
});
app.post('/support',customer,(req,res)=>{
  if(!customerServices.rateLimit(db,'support-create:'+req.user.id,10)) return res.status(429).send('Bạn gửi yêu cầu quá nhiều. Hãy thử lại sau 15 phút.');
  const result=customerServices.createSupport(db,req.user,req.body);
  productResult(req,res,result,result.id?'/support/'+result.id:'/support');
});
app.get('/admin/support',staff,(req,res)=>{
  const result=customerServices.listSupport(db,req.user,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'support',result);
});
app.get('/support/:id',auth,(req,res)=>{
  try {render(res,'support-detail',customerServices.supportDetail(db,req.user,Number(req.params.id),req.query));}
  catch(error) {if(error.status) return res.status(error.status).send(error.message);throw error;}
});
app.post('/support/:id/messages',auth,(req,res)=>{
  if(!customerServices.rateLimit(db,'support-reply:'+req.user.id,50)) return res.status(429).send('Vui lòng thử lại sau 15 phút.');
  productResult(req,res,customerServices.replySupport(db,req.user,Number(req.params.id),req.body),'/support/'+req.params.id);
});
app.post('/support/:id/status',auth,(req,res)=>productResult(req,res,customerServices.changeSupport(db,req.user,Number(req.params.id),req.body),'/support/'+req.params.id));
app.post('/profile',auth,(req,res)=>productResult(req,res,saveProfile(db,req.user,req.body),'/profile'));
app.post('/profile/password',auth,(req,res,next)=>{
  const result=changePassword(db,req.user,req.body);
  if(result.status!==200) return productResult(req,res,result,'/profile');
  req.session.destroy(error=>{if(error) return next(error);res.clearCookie('connect.sid');res.redirect('/login');});
});
app.get('/admin/accounts',admin,(req,res)=>{
  const listing=listRecords(db,'accounts',req.query);
  if(listing.status!==200) return res.status(listing.status).send(listing.message);
  render(res,'accounts',{...listing,accounts:listing.rows});
});
app.post('/admin/accounts',admin,(req,res)=>{
  const result=createStaff(db,req.user,req.body);
  productResult(req,res,result,result.id?`/admin/accounts/${result.id}`:'/admin/accounts');
});
app.get('/admin/accounts/:id',admin,(req,res)=>{
  const account=db.prepare('SELECT id,name,email,phone,role,status,version FROM users WHERE id=?').get(Number(req.params.id));
  if(!account) return res.status(404).send('Không tìm thấy tài khoản.');
  render(res,'account',{account});
});
app.post('/admin/accounts/:id',admin,(req,res)=>productResult(req,res,saveStaff(db,req.user,Number(req.params.id),req.body),`/admin/accounts/${req.params.id}`));
app.post('/admin/accounts/:id/status',admin,(req,res)=>productResult(req,res,setAccountStatus(db,req.user,Number(req.params.id),req.body),`/admin/accounts/${req.params.id}`));
app.get('/admin/shipping',admin,(req,res)=>render(res,'shipping',{policy:shippingPolicy(db)}));
app.post('/admin/shipping',admin,(req,res)=>productResult(req,res,saveShippingPolicy(db,req.user,req.body),'/admin/shipping'));
app.get('/admin/reports',admin,(req,res)=>{
  const report=salesReport(db,req.query);
  if(report.status!==200) return res.status(report.status).send(report.message);
  render(res,'reports',{report});
});
app.get('/admin/reports.csv',admin,(req,res)=>{
  const report=salesReport(db,req.query);
  if(report.status!==200) return res.status(report.status).send(report.message);
  const csv=reportCsv(report);
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'REPORT_EXPORT','REPORT',0,?)").run(req.user.id,JSON.stringify(report.filters));
  res.attachment(`bao-cao-${report.filters.from}-${report.filters.to}.csv`).type('text/csv; charset=utf-8').send(csv);
});
app.get('/admin/audit',admin,(req,res)=>{
  const result=auditRecords(db,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'audit',result);
});
app.get('/admin/refunds',admin,(req,res)=>{
  const result=payments.listRefunds(db,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'refunds',result);
});
app.post('/admin/payments/:id/refund',admin,(req,res)=>productResult(req,res,payments.recordRefund(db,req.user,Number(req.params.id),req.body),'/admin/refunds'));
app.get('/payments/vnpay/return',customer,(req,res)=>{
  res.set('Referrer-Policy','no-referrer');
  if(!payments.verifyCallback(req.query,paymentConfig)) return res.status(400).send('Kết quả thanh toán không hợp lệ.');
  const payment=db.prepare('SELECT p.order_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.reference=? AND o.user_id=?').get(req.query.vnp_TxnRef,req.user.id);
  if(!payment) return res.status(404).send('Không tìm thấy giao dịch.');
  flash(req,res,'Đã trở về từ VNPay. Trạng thái tiền sẽ cập nhật sau khi cửa hàng nhận xác nhận từ cổng thanh toán.','/orders/'+payment.order_id);
});
app.post('/orders/:id/pay',customer,(req,res)=>{
  const result=payments.startPayment(db,req.user,Number(req.params.id),req.ip,paymentConfig);
  if(result.status!==200) return productResult(req,res,result,'/orders/'+req.params.id);
  res.redirect(result.url);
});
app.get('/admin/promotions',admin,(req,res)=>{
  const result=listPromotions(db,req.query);if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'promotions',{...result});
});
function promotionPage(res,id=null) {
  const promotion=id===null?null:db.prepare('SELECT * FROM promotions WHERE id=?').get(id);
  if(id!==null&&!promotion) return res.status(404).send('Không tìm thấy khuyến mãi.');
  const selected=id===null?[]:db.prepare('SELECT product_id FROM promotion_products WHERE promotion_id=?').all(id).map(row=>row.product_id);
  const used=id!==null&&!!db.prepare('SELECT id FROM promotion_redemptions WHERE promotion_id=? LIMIT 1').get(id);
  render(res,'promotion-form',{promotion,selected,used,products:db.prepare('SELECT id,name,status FROM products ORDER BY id DESC').all()});
}
app.get('/admin/promotions/new',admin,(req,res)=>promotionPage(res));
app.get('/admin/promotions/:id',admin,(req,res)=>promotionPage(res,Number(req.params.id)));
app.post('/admin/promotions',admin,(req,res)=>{
  const result=savePromotion(db,req.user,null,req.body);productResult(req,res,result,result.id?`/admin/promotions/${result.id}`:'/admin/promotions/new');
});
app.post('/admin/promotions/:id',admin,(req,res)=>productResult(req,res,savePromotion(db,req.user,Number(req.params.id),req.body),`/admin/promotions/${req.params.id}`));
app.post('/admin/promotions/:id/status',admin,(req,res)=>productResult(req,res,togglePromotion(db,req.user,Number(req.params.id),req.body),`/admin/promotions/${req.params.id}`));
app.get('/admin/reviews',admin,(req,res)=>{
  const result=listReviews(db,req.query);if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'reviews-admin',result);
});
app.post('/admin/reviews/:id/status',admin,(req,res)=>productResult(req,res,moderateReview(db,req.user,Number(req.params.id),req.body),'/admin/reviews'));
function cartItems(req) {
  const items=req.accountCart?req.accountCart.items.map(item=>({...item,id:item.variantId,price:item.unitPrice??0,stock:item.available})):Object.entries(req.session.cart).map(([id,quantity]) => {
    const product = getVariant(db,Number(id));
    return product ? { ...product,quantity } : null;
  }).filter(Boolean);
  return require('./cart-presentation').withCartImages(db,items);
}
app.get('/cart',cartAccess,(req,res) => { const items=cartItems(req); render(res,'cart',{items,canCheckout:req.accountCart?.canCheckout??(items.length>0&&items.every(item=>item.active&&item.product_status==='ACTIVE'&&item.price>0&&item.quantity<=item.stock&&item.quantity<=99)),total:items.reduce((sum,item)=>sum+item.price*item.quantity,0)}); });
app.post('/cart',cartAccess,(req,res) => {
  if(req.accountCart) {
    const result=accountCart.updateCart(db,req.user,{...req.body,variant_id:req.body.id,version:req.body.cart_version??req.accountCart.version});
    if(result.status===200) result.message='Đã cập nhật giỏ hàng.';
    return productResult(req,res,result,'/cart');
  }
  const id = Number(req.body.id);
  const quantity = Number(req.body.quantity);
  const product = Number.isSafeInteger(id)?getVariant(db,id):null;
  if (!product || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) return flash(req,res,'Số lượng không hợp lệ.','/cart');
  const nextQuantity = req.body.action === 'add' ? (req.session.cart[id] || 0)+quantity : quantity;
  if(!nextQuantity) { delete req.session.cart[id]; req.session.cartSourceKey=randomBytes(32).toString('hex'); return flash(req,res,'Đã xóa SKU khỏi giỏ.','/cart'); }
  if(!product.active||product.product_status!=='ACTIVE') return flash(req,res,'SKU này đã ngừng bán.','/cart');
  if (nextQuantity > product.stock || nextQuantity > 99) return flash(req,res,'Số lượng vượt tồn kho hoặc giới hạn 99.','/cart');
  if(!req.session.cart[id]&&Object.keys(req.session.cart).length>=100) return flash(req,res,'Giỏ tối đa 100 dòng sản phẩm.','/cart');
  if (!nextQuantity) delete req.session.cart[id]; else req.session.cart[id]=nextQuantity;
  req.session.cartSourceKey=randomBytes(32).toString('hex');
  flash(req,res,'Đã cập nhật giỏ hàng.','/cart');
});
app.post('/checkout/options',customer,(req,res)=>{
  if(Object.hasOwn(req.body,'recipient')) req.session.checkoutDraft={recipient:String(req.body.recipient||'').slice(0,80),phone:String(req.body.phone||'').slice(0,20),address:String(req.body.delivery_address||'').slice(0,300),...addressDraft(req.body)};
  if(req.body.address&&req.body.address!==req.body.delivery_source_address) delete req.session.checkoutDraft;
  const query=new URLSearchParams({method:String(req.body.method||'COD'),code:String(req.body.code||'')});
  if(req.body.address) query.set('address',String(req.body.address));
  res.redirect('/checkout?'+query.toString());
});
app.get('/checkout',customer,(req,res) => {
  const items=cartItems(req);
  if (!items.length) return res.redirect('/cart');
  if(!req.accountCart.canCheckout) return flash(req,res,'Giỏ có sản phẩm không hợp lệ hoặc cần điều chỉnh. Hãy kiểm tra số lượng.','/cart');
  const method=req.query.method??'COD';
  if(method==='ONLINE'&&!paymentConfig) return res.status(503).send('Thanh toán trực tuyến tạm thời chưa khả dụng.');
  const addressBook=customerServices.addresses(db,req.user);
  let selectedAddress=addressBook.find(row=>row.is_default)||{recipient:req.user.name,phone:req.user.phone,address:req.user.address};
  if(req.query.address!==undefined&&req.query.address!=='') {
    if(typeof req.query.address!=='string'||!/^\d+$/.test(req.query.address)) return res.status(400).send('Địa chỉ không hợp lệ.');
    selectedAddress=addressBook.find(row=>String(row.id)===req.query.address);
    if(!selectedAddress) return res.status(404).send('Không tìm thấy địa chỉ của bạn.');
  }
  try { req.session.checkoutToken=issueCheckout(db,req.user.id,req.accountCart.quantities,req.query.code??'',method); }
  catch(error) { return flash(req,res,error.message,req.query.code?'/checkout':'/cart'); }
  const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  const shippingFee=db.prepare('SELECT shipping_fee FROM checkout_requests WHERE user_id=? AND request_key=?').get(req.user.id,req.session.checkoutToken).shipping_fee;
  const promotion=db.prepare('SELECT promotion_code AS code,discount FROM checkout_requests WHERE user_id=? AND request_key=?').get(req.user.id,req.session.checkoutToken);
  render(res,'checkout',{items,subtotal,shippingFee,discount:promotion.discount,promotionCode:promotion.code,total:subtotal-promotion.discount+shippingFee,token:req.session.checkoutToken,method,onlineAvailable:Boolean(paymentConfig),addressBook,selectedAddress,bankReceiver:require('./bank-receiver'),bankQrAvailable:require('node:fs').existsSync(path.join(__dirname,'../public/images/payments/bidv-4801021854.png')),checkoutDraft:req.session.checkoutDraft||{}});
});
app.post('/checkout',customer,(req,res) => {
  const {recipient,phone}=req.body;
  let address;
  req.session.checkoutDraft={recipient:String(recipient||'').slice(0,80),phone:String(phone||'').slice(0,20),address:String(req.body.address||'').slice(0,300),...addressDraft(req.body)};
  try {address=resolveAddress(req.body);} catch(error) {return flash(req,res,error.message,'/checkout');}
  if (!textField(recipient,2,80) || !/^0\d{9}$/.test(phone || '') || !textField(address,10,300)) return flash(req,res,'Kiểm tra tên, số điện thoại 10 số và địa chỉ nhận hàng.','/checkout');
  try {
    if(req.body.method==='ONLINE'&&!paymentConfig) return res.status(503).send('Thanh toán trực tuyến tạm thời chưa khả dụng.');
    const result=submitAccountCheckout(db,req.user,req.body.token,recipient.trim(),phone,address.trim(),req.body.code??'',req.body.method??'COD',req.ip);
    if(result.status) return productResult(req,res,result,'/cart');
    const {id,replayed}=result;
    delete req.session.checkoutToken;
    delete req.session.checkoutDraft;
    if(!replayed) req.session.cart={};
    flash(req,res,`Đơn #${id}: ${req.body.method==='ONLINE'?'Chờ thanh toán VNPay trong 15 phút.':req.body.method==='BANK_TRANSFER'?'Chờ xác nhận chuyển khoản trong 30 phút.':'Thanh toán khi nhận hàng.'}`, `/orders/${id}`);
  } catch(error) { flash(req,res,error.message,'/checkout'); }
});
app.get('/orders',customer,(req,res)=>{
  const listing=listRecords(db,'orders',req.query,req.user.id);
  if(listing.status!==200) return res.status(listing.status).send(listing.message);
  render(res,'orders',{...listing,orders:listing.rows,management:false});
});
app.get('/orders/:id/invoice',auth,(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1) return res.status(404).send('Không tìm thấy đơn.');
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if(!order||(req.user.role==='CUSTOMER'&&order.user_id!==req.user.id)) return res.status(404).send('Không tìm thấy đơn.');
  res.set('Cache-Control','no-store');
  render(res,'invoice',{order,received:db.prepare("SELECT COUNT(*) n,COALESCE(SUM(amount),0) amount FROM payments WHERE order_id=? AND status='SUCCEEDED'").get(id),refunded:db.prepare('SELECT COALESCE(SUM(amount),0) amount FROM refunds WHERE order_id=?').get(id).amount,items:db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(id)});
});
app.get('/orders/:id',auth,(req,res) => {
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id));
  if (!order || (order.user_id !== req.user.id && req.user.role === 'CUSTOMER')) return res.status(404).send('Không tìm thấy đơn.');
  render(res,'order',{order,bankReceipts:db.prepare('SELECT amount,occurred_at,created_at FROM bank_transfer_receipts WHERE order_id=? ORDER BY id').all(order.id),bankTransfer:db.prepare('SELECT * FROM bank_transfer_orders WHERE order_id=?').get(order.id),bankQrAvailable:require('node:fs').existsSync(path.join(__dirname,'../public/images/payments/bidv-4801021854.png')),shipping:shipments.detail(db,req.user,order.id),shipmentLabels:shipments.labels,shipmentTransitions:shipments.transitions,shipmentRequestKey:randomBytes(16).toString('hex'),items:db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id),orderReviews:orderReviews(db,order.id),refunds:db.prepare('SELECT amount,occurred_at FROM refunds WHERE order_id=? ORDER BY id').all(order.id),onlineAvailable:Boolean(paymentConfig),history:db.prepare('SELECT h.*,u.name AS actor_name,u.role AS actor_role FROM order_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.order_id=? ORDER BY h.id').all(order.id),receipt:req.user.role==='ADMIN'?db.prepare('SELECT reference,amount,note,created_at FROM cod_receipts WHERE order_id=?').get(order.id):null});
});
app.get('/admin/shipments',staff,(req,res)=>{
  const result=shipments.list(db,req.user,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  render(res,'shipments',{...result,shipmentLabels:shipments.labels});
});
app.post('/admin/orders/:id/shipment',staff,(req,res)=>productResult(req,res,shipments.createShipment(db,req.user,Number(req.params.id),req.body),`/orders/${req.params.id}`));
app.post('/admin/shipments/:id/status',staff,(req,res)=>{
  const shipment=db.prepare('SELECT order_id FROM shipments WHERE id=?').get(Number(req.params.id));
  if(!shipment) return res.status(404).send('Không tìm thấy vận đơn.');
  productResult(req,res,shipments.changeShipment(db,req.user,Number(req.params.id),req.body),`/orders/${shipment.order_id}`);
});
app.post('/orders/:id/items/:itemId/review',customer,(req,res)=>{
  const item=db.prepare('SELECT i.id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=? AND o.id=? AND o.user_id=?').get(Number(req.params.itemId),Number(req.params.id),req.user.id);
  if(!item) return res.status(404).send('Không tìm thấy dòng đơn của bạn.');
  productResult(req,res,saveReview(db,req.user,item.id,req.body),`/orders/${req.params.id}`);
});
app.post('/orders/:id/cancel',customer,(req,res)=>productResult(req,res,transitionOrder(db,Number(req.params.id),'CANCELLED',req.user,req.body),`/orders/${req.params.id}`));
app.get('/admin',staff,(req,res) => {
  const listing=listProducts(db,req.query,true);
  if(listing.status!==200) return res.status(listing.status).send(listing.message);
  render(res,'admin',{...listing,catalogCategories:db.prepare('SELECT * FROM categories ORDER BY name').all(),catalogBrands:db.prepare('SELECT * FROM brands ORDER BY name').all()});
});
app.get('/admin/products/:id',staff,(req,res) => {
  const product=db.prepare('SELECT * FROM products WHERE id=?').get(Number(req.params.id));
  if(!product) return res.status(404).send('Không tìm thấy sản phẩm.');
  const variants=db.prepare('SELECT *,on_hand-reserved AS stock FROM product_variants WHERE product_id=? ORDER BY id').all(product.id).map(v=>({...v,attributes:getAttributes(db,v.id)}));
  render(res,'sku-admin',{product,variants,images:db.prepare('SELECT id,storage_key,alt_text,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order,id').all(product.id),movements:db.prepare('SELECT m.*,v.sku FROM inventory_movements m JOIN product_variants v ON v.id=m.variant_id WHERE v.product_id=? ORDER BY m.id DESC LIMIT 50').all(product.id),catalogCategories:db.prepare('SELECT * FROM categories ORDER BY name').all(),catalogBrands:db.prepare('SELECT * FROM brands ORDER BY name').all()});
});
function productResult(req,res,result,url) {
  if(result.status===403||result.status===404) return res.status(result.status).send(result.message);
  flash(req,res,result.message,url);
}
app.post('/admin/products/:id/variants',staff,(req,res)=>productResult(req,res,saveVariant(db,req.user,Number(req.params.id),req.body),`/admin/products/${req.params.id}`));
app.post('/admin/products/:id/publish',admin,(req,res)=>productResult(req,res,publishProduct(db,req.user,Number(req.params.id),req.body),`/admin/products/${req.params.id}`));
app.post('/admin/products/:id/images',staff,async(req,res)=>{
  const result=await addImage(db,req.user,Number(req.params.id),req.body);
  res.status(result.status).json(result);
});
app.post('/admin/products/:id/images/reorder',staff,(req,res)=>{
  const result=reorderImages(db,req.user,Number(req.params.id),req.body);res.status(result.status).json(result);
});
for(const action of ['save','delete']) app.post(`/admin/products/:id/images/:imageId/${action}`,staff,(req,res)=>productResult(req,res,changeImage(db,req.user,Number(req.params.id),Number(req.params.imageId),req.body,action==='delete'),`/admin/products/${req.params.id}`));
app.get('/admin/attributes',admin,(req,res)=>render(res,'attributes-admin',{definitions:db.prepare('SELECT d.*,c.name AS category_name FROM attribute_definitions d JOIN categories c ON c.id=d.category_id ORDER BY c.name,d.id').all(),catalogCategories:db.prepare('SELECT * FROM categories ORDER BY name').all()}));
app.post('/admin/attributes',admin,(req,res)=>productResult(req,res,saveDefinition(db,req.user,req.body),'/admin/attributes'));
app.post('/admin/variants/:id/attributes',staff,(req,res)=>{
  const variant=db.prepare('SELECT product_id FROM product_variants WHERE id=?').get(Number(req.params.id));
  if(!variant) return res.status(404).send('Không tìm thấy SKU.');
  productResult(req,res,saveAttributes(db,req.user,Number(req.params.id),req.body),`/admin/products/${variant.product_id}`);
});
for(const [action,guard,service] of [['price',admin,priceVariant],['stock',staff,adjustStock]]) {
  app.post(`/admin/variants/:id/${action}`,guard,(req,res)=>{
    const variant=db.prepare('SELECT product_id FROM product_variants WHERE id=?').get(Number(req.params.id));
    if(!variant) return res.status(404).send('Không tìm thấy SKU.');
    productResult(req,res,service(db,req.user,Number(req.params.id),req.body),`/admin/products/${variant.product_id}`);
  });
}
app.get('/admin/catalog',admin,(req,res) => render(res,'catalog-admin',{catalogCategories:db.prepare('SELECT * FROM categories ORDER BY name').all(),catalogBrands:db.prepare('SELECT * FROM brands ORDER BY name').all()}));
app.post('/admin/catalog/:kind',admin,(req,res) => {
  const result = saveCatalog(db,req.user,req.params.kind,req.body);
  if (result.status === 403 || result.status === 404) return res.status(result.status).send(result.message);
  flash(req,res,result.message,'/admin/catalog');
});
app.get('/admin/orders',staff,(req,res)=>{
  const listing=listRecords(db,'orders',req.query);
  if(listing.status!==200) return res.status(listing.status).send(listing.message);
  render(res,'orders',{...listing,orders:listing.rows,management:true});
});
app.post('/admin/orders/:id/status',staff,(req,res) => {
  try { productResult(req,res,transitionOrder(db,Number(req.params.id),req.body.status,req.user,req.body),`/orders/${req.params.id}`); }
  catch(error) { flash(req,res,error.message,'/admin/orders'); }
});
app.get('/admin/bank-transfers',admin,(req,res)=>{
  const result=bankTransfers.listBankTransfers(db,req.user,req.query);
  if(result.status!==200) return res.status(result.status).send(result.message);
  res.set('Cache-Control','no-store');render(res,'bank-transfers',result);
});
app.post('/admin/orders/:id/bank-transfer',admin,(req,res)=>productResult(req,res,bankTransfers.confirmBankTransfer(db,req.user,Number(req.params.id),req.body),`/orders/${req.params.id}`));
app.post('/admin/orders/:id/cod',admin,(req,res)=>productResult(req,res,recordCodReceipt(db,Number(req.params.id),req.user,req.body),`/orders/${req.params.id}`));
app.post('/admin/products',staff,(req,res) => {
  const result = saveProduct(db,req.user,req.body);
  if(req.get('accept')?.includes('application/json')) return res.status(result.status).json({...result,url:result.id?`/admin/products/${result.id}`:null,version:result.id?db.prepare('SELECT version FROM products WHERE id=?').get(result.id).version:null});
  if (result.status === 403 || result.status === 404) return res.status(result.status).send(result.message);
  flash(req,res,result.message,result.id?`/admin/products/${result.id}`:'/admin');
});
app.get('/admin/content',admin,(req,res)=>render(res,'store-content'));
app.post('/admin/content',admin,(req,res)=>productResult(req,res,storeContent.saveContent(db,req.user,req.body),'/admin/content'));
app.get('/admin/operations',admin,(req,res)=>{
  paymentExceptions.scan(db);
  render(res,'operations',{jobs:db.prepare('SELECT id,kind,status,attempts,last_error FROM integration_jobs ORDER BY id DESC LIMIT 100').all(),exceptions:db.prepare('SELECT * FROM payment_exceptions ORDER BY id DESC LIMIT 100').all()});
});
app.post('/admin/jobs/:id/retry',admin,(req,res)=>{
  const result=require('./products').transaction(db,()=>{
    const changed=db.prepare("UPDATE integration_jobs SET status='PENDING',attempts=0,available_at=? WHERE id=? AND status='FAILED'").run(Date.now(),Number(req.params.id)).changes;
    if(!changed) return {status:409,message:'T?c v? kh?ng c?n ? tr?ng th?i l?i.'};
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'RETRY_JOB','integration_job',?,'{}')").run(req.user.id,Number(req.params.id));
    return {status:200,message:'?? l?n l?ch th? l?i.'};
  });productResult(req,res,result,'/admin/operations');
});
app.use((req,res) => res.status(404).send('Trang không tồn tại.'));
app.use((error,req,res,next) => { if(error.type==='entity.too.large') return res.status(413).send('Dữ liệu gửi lên quá lớn. Ảnh tối đa 5MB.'); console.error(JSON.stringify({level:'error',requestId:req.requestId,event:'request_failed',method:req.method,route:typeof req.route?.path==='string'?req.route.path:'unmatched',query:error.queryContext,code:error.code||'INTERNAL'})); res.status(500).send('Có lỗi xử lý. Vui lòng thử lại.'); });
payments.expirePayments(db);
bankTransfers.expireBankTransfers(db);
const expiryTimer=setInterval(()=>{try {payments.expirePayments(db);bankTransfers.expireBankTransfers(db);} catch {console.error('Payment expiry transaction failed');}},30000);
expiryTimer.unref();
if(engagementEnabled()) {
  engagement.scan(db);
  const notificationTimer=setInterval(()=>{try {engagement.scan(db);} catch {console.error('Notification scan failed; transaction rolled back.');}},30000);
  notificationTimer.unref();
}
const port=Number(process.env.PORT || 3000);
const listener=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Electro Store: http://localhost:${listener.address().port}`));
