const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
function enabled(db) {return db.prepare("SELECT value FROM app_settings WHERE key='regional_shipping'").get()?.value==='1';}
function regions(db) {return db.prepare('SELECT * FROM shipping_regions WHERE active=1 ORDER BY name').all();}
function shippingQuote(db,snapshot,region,now=Date.now()) {
  if(!enabled(db)) return null;
  if(typeof region!=='string'||!db.prepare('SELECT code FROM shipping_regions WHERE code=? AND active=1').get(region)) throw new Error('Hãy chọn khu vực giao hàng được hỗ trợ.');
  let grams=0;
  for(const [id,quantity] of snapshot) {
    const sku=db.prepare('SELECT weight_grams FROM product_variants WHERE id=?').get(id);
    if(!sku?.weight_grams) throw new Error('Sản phẩm chưa có trọng lượng giao hàng. Vui lòng liên hệ cửa hàng.');
    grams+=sku.weight_grams*quantity;
  }
  const rate=db.prepare('SELECT * FROM shipping_rates WHERE region_code=? AND active=1 AND min_grams<? AND max_grams>=? AND starts_at<=? AND ends_at>? ORDER BY id').all(region,grams,grams,now,now);
  if(rate.length!==1) throw new Error('Khu vực hoặc trọng lượng này chưa có biểu phí giao hàng hợp lệ.');
  return {region,grams,rate_id:rate[0].id,version:rate[0].version,fee:rate[0].fee};
}
function saveRate(db,actor,input) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    const code=String(input.region_code||'').trim().toUpperCase(),name=String(input.region_name||'').trim();
    const min=Number(input.min_grams),max=Number(input.max_grams),fee=Number(input.fee),start=Date.parse(String(input.starts_at)+'+07:00'),end=Date.parse(String(input.ends_at)+'+07:00');
    if(!/^[A-Z0-9_-]{2,30}$/.test(code)||name.length<2||name.length>120||![min,max,fee,start,end].every(Number.isSafeInteger)||min<0||max<=min||max>100000000||fee<0||fee>1000000||end<=start) reject(400,'Kiểm tra khu vực, trọng lượng, phí và thời gian hiệu lực.');
    const id=input.id?Number(input.id):null;
    if(id&&db.prepare('SELECT version FROM shipping_rates WHERE id=?').get(id)?.version!==Number(input.version)) reject(409,'Biểu phí đã thay đổi.');
    if(db.prepare('SELECT id FROM shipping_rates WHERE region_code=? AND active=1 AND min_grams<? AND max_grams>? AND starts_at<? AND ends_at>? AND id<>? LIMIT 1').get(code,max,min,end,start,id||0)) reject(409,'Biểu phí bị chồng khoảng trọng lượng hoặc thời gian.');
    db.prepare('INSERT INTO shipping_regions(code,name) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name').run(code,name);
    let rateId=id;
    if(id) db.prepare('UPDATE shipping_rates SET region_code=?,min_grams=?,max_grams=?,fee=?,starts_at=?,ends_at=?,version=version+1 WHERE id=?').run(code,min,max,fee,start,end,id);
    else rateId=Number(db.prepare('INSERT INTO shipping_rates(region_code,min_grams,max_grams,fee,starts_at,ends_at) VALUES(?,?,?,?,?,?)').run(code,min,max,fee,start,end).lastInsertRowid);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'SAVE_SHIPPING_RATE','shipping_rate',?,?)").run(admin.id,rateId,JSON.stringify({code,min,max,fee,start,end}));
    return {status:200,message:'Đã lưu biểu phí khu vực.'};
  });
}
function setMode(db,actor,value) {
  return transaction(db,()=>{
    const admin=actorUser(db,actor,['ADMIN']);
    if(!['0','1'].includes(value)) reject(400,'Chế độ không hợp lệ.');
    if(value==='1'&&!regions(db).length) reject(400,'Hãy tạo khu vực và biểu phí trước.');
    db.prepare("INSERT INTO app_settings(key,value) VALUES('regional_shipping',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(value);
    db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,'SHIPPING_MODE','shipping_policy',1,?)").run(admin.id,JSON.stringify({regional:value==='1'}));
    return {status:200,message:'Đã cập nhật chế độ tính phí.'};
  });
}
module.exports={enabled,regions,shippingQuote,saveRate,setMode};
