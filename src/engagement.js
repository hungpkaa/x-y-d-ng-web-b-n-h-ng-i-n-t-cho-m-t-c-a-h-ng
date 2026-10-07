const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {pagination}=require('./product-list');
function enabled(db) {return db.dialect==='postgres'?!!db.prepare("SELECT to_regclass('favorites') name").get().name:!!db.prepare("SELECT name FROM sqlite_master WHERE name='favorites' AND type='table'").get();}
const productQuery=`SELECT p.*,(SELECT MIN(price) FROM product_variants WHERE product_id=p.id AND active=1) display_price,(SELECT storage_key FROM product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) image_key FROM products p`;
function favorites(db,actor,query={}) {
  const user=actorUser(db,actor,['CUSTOMER']),where="JOIN favorites f ON f.product_id=p.id WHERE f.user_id=? AND p.status='ACTIVE'";
  const count=db.prepare("SELECT COUNT(*) n FROM favorites f JOIN products p ON p.id=f.product_id WHERE f.user_id=? AND p.status='ACTIVE'").get(user.id).n;
  const paging=pagination(count,query.page||'1',12,'/favorites');
  return {rows:db.prepare(`${productQuery} ${where} ORDER BY f.created_at DESC,p.id DESC LIMIT ? OFFSET ?`).all(user.id,paging.size,paging.offset),paging};
}
function favorite(db,actor,productId,action) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(!Number.isSafeInteger(productId)||productId<1||!['add','remove'].includes(action)) reject(400,'Yêu cầu yêu thích không hợp lệ.');
    if(action==='remove') db.prepare('DELETE FROM favorites WHERE user_id=? AND product_id=?').run(user.id,productId);
    else {
      if(!db.prepare("SELECT id FROM products WHERE id=? AND status='ACTIVE'").get(productId)) reject(404,'Sản phẩm không còn được công bố.');
      const existing=db.prepare('SELECT product_id FROM favorites WHERE user_id=? AND product_id=?').get(user.id,productId);
      if(!existing&&db.prepare('SELECT COUNT(*) n FROM favorites WHERE user_id=?').get(user.id).n>=200) reject(400,'Danh sách tối đa 200 sản phẩm.');
      db.prepare('INSERT OR IGNORE INTO favorites(user_id,product_id) VALUES(?,?)').run(user.id,productId);
    }
    return {status:200,message:action==='add'?'Đã lưu sản phẩm yêu thích.':'Đã bỏ sản phẩm yêu thích.'};
  });
}
function recordView(db,actor,productId) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(!db.prepare("SELECT id FROM products WHERE id=? AND status='ACTIVE'").get(productId)) return;
    const last=db.prepare('SELECT MAX(viewed_at) value FROM recent_products WHERE user_id=?').get(user.id).value;
    const lastTime=last?Date.parse(last.replace(' ','T')+'Z'):0;
    const viewed=new Date(Math.max(Date.now(),lastTime+1)).toISOString().replace('T',' ').replace('Z','');
    db.prepare('INSERT INTO recent_products(user_id,product_id,viewed_at) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET viewed_at=excluded.viewed_at').run(user.id,productId,viewed);
    db.prepare('DELETE FROM recent_products WHERE user_id=? AND product_id NOT IN (SELECT product_id FROM recent_products WHERE user_id=? ORDER BY viewed_at DESC,product_id DESC LIMIT 20)').run(user.id,user.id);
  });
}
function recent(db,actor,guestIds=[]) {
  const user=actor?.id?actorUser(db,actor):null;
  if(user?.role==='CUSTOMER') return db.prepare(`${productQuery} JOIN recent_products r ON r.product_id=p.id WHERE r.user_id=? AND p.status='ACTIVE' ORDER BY r.viewed_at DESC,p.id DESC LIMIT 20`).all(user.id);
  const ids=Array.isArray(guestIds)?[...new Set(guestIds.filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,20):[];
  return ids.map(id=>db.prepare(`${productQuery} WHERE p.id=? AND p.status='ACTIVE'`).get(id)).filter(Boolean);
}
function preferences(db,userId) {
  db.prepare('INSERT OR IGNORE INTO notification_preferences(user_id) VALUES(?)').run(userId);
  return db.prepare('SELECT * FROM notification_preferences WHERE user_id=?').get(userId);
}
function savePreferences(db,actor,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']),old=preferences(db,user.id);
    if(Number(input.version)!==old.version) reject(409,'Cài đặt đã thay đổi. Hãy tải lại.');
    if(!['0','1'].includes(input.orders_enabled)) reject(400,'Cài đặt không hợp lệ.');
    const cursor=db.prepare('SELECT COALESCE(MAX(h.id),0) n FROM order_history h JOIN orders o ON o.id=h.order_id WHERE o.user_id=?').get(user.id).n;
    db.prepare('UPDATE notification_preferences SET orders_enabled=?,history_cursor=?,version=version+1 WHERE user_id=?').run(Number(input.orders_enabled),cursor,user.id);
    return {status:200,message:'Đã lưu cài đặt thông báo đơn hàng.'};
  });
}
function watch(db,actor,variantId,input) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(!Number.isSafeInteger(variantId)||variantId<1) reject(404,'Không tìm thấy SKU.');
    if(!['0','1'].includes(input.stock_enabled)||!['0','1'].includes(input.price_enabled)) reject(400,'Cài đặt theo dõi không hợp lệ.');
    if(input.stock_enabled==='0'&&input.price_enabled==='0') {
      db.prepare('DELETE FROM product_watches WHERE user_id=? AND variant_id=?').run(user.id,variantId);
      return {status:200,message:'Đã tắt theo dõi cấu hình.'};
    }
    const variant=db.prepare("SELECT v.*,v.on_hand-v.reserved stock FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.status='ACTIVE'").get(variantId);
    if(!variant) reject(404,'SKU không còn bán.');
    const old=db.prepare('SELECT * FROM product_watches WHERE user_id=? AND variant_id=?').get(user.id,variantId);
    if(!old&&db.prepare('SELECT COUNT(*) n FROM product_watches WHERE user_id=?').get(user.id).n>=200) reject(400,'Tối đa 200 SKU theo dõi.');
    db.prepare('INSERT INTO product_watches VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,variant_id) DO UPDATE SET stock_enabled=excluded.stock_enabled,price_enabled=excluded.price_enabled,last_stock=excluded.last_stock,last_price=excluded.last_price').run(user.id,variantId,Number(input.stock_enabled),Number(input.price_enabled),old?.last_stock??variant.stock,old?.last_price??variant.price);
    return {status:200,message:'Đã cập nhật theo dõi cấu hình sản phẩm.'};
  });
}
function notify(db,userId,key,kind,title,body,url) {
  db.prepare('INSERT OR IGNORE INTO notifications(user_id,event_key,kind,title,body,url) VALUES(?,?,?,?,?,?)').run(userId,key,kind,title,body,url);
}
function scan(db) {
  if(!enabled(db)) return;
  return transaction(db,()=>{
    // Persisted baselines/cursors and unique event keys make restarts and
    // multiple application processes safe. No email is sent without opt-in.
    db.exec("INSERT INTO notification_preferences(user_id) SELECT id FROM users WHERE role='CUSTOMER' ON CONFLICT(user_id) DO NOTHING");
    const users=db.prepare("SELECT p.* FROM notification_preferences p JOIN users u ON u.id=p.user_id WHERE u.status='ACTIVE' AND u.role='CUSTOMER'").all();
    for(const user of users) {
      const events=db.prepare('SELECT h.id,h.order_id,h.status,h.previous_status FROM order_history h JOIN orders o ON o.id=h.order_id WHERE o.user_id=? AND h.id>? ORDER BY h.id LIMIT 100').all(user.user_id,user.history_cursor);
      for(const event of events) if(user.orders_enabled&&event.status!==event.previous_status) notify(db,user.user_id,'order-history:'+event.id,'ORDER','Cập nhật đơn #'+event.order_id,require('./orders').labels[event.status]||event.status,'/orders/'+event.order_id);
      if(events.length) db.prepare('UPDATE notification_preferences SET history_cursor=? WHERE user_id=?').run(events.at(-1).id,user.user_id);
      const watches=db.prepare("SELECT w.*,v.price,v.version,v.on_hand-v.reserved stock,v.product_id,v.sku,p.name FROM product_watches w JOIN product_variants v ON v.id=w.variant_id JOIN products p ON p.id=v.product_id WHERE w.user_id=? AND v.active=1 AND p.status='ACTIVE'").all(user.user_id);
      for(const watch of watches) {
        const url='/products/'+watch.product_id+'?sku='+watch.variant_id+'#sku-'+watch.variant_id;
        if(watch.stock_enabled&&watch.last_stock<=0&&watch.stock>0) notify(db,user.user_id,'stock:'+watch.variant_id+':'+watch.version,'RESTOCK','Sản phẩm đã có hàng',watch.name+' · '+watch.sku,url);
        if(watch.price_enabled&&watch.price<watch.last_price) notify(db,user.user_id,'price:'+watch.variant_id+':'+watch.version+':'+watch.price,'PRICE','Cấu hình đang giảm giá',watch.name+' · '+watch.sku+' · Giá mới: '+watch.price.toLocaleString('vi-VN')+' VND',url);
        db.prepare('UPDATE product_watches SET last_stock=?,last_price=? WHERE user_id=? AND variant_id=?').run(watch.stock,watch.price,user.user_id,watch.variant_id);
      }
    }
  });
}
function notifications(db,actor,query={}) {
  const user=actorUser(db,actor,['CUSTOMER']),count=db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=?').get(user.id).n;
  const paging=pagination(count,query.page||'1',20,'/notifications');
  return {rows:db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?').all(user.id,paging.size,paging.offset),paging,preferences:preferences(db,user.id),watches:db.prepare('SELECT w.*,p.name,v.sku FROM product_watches w JOIN product_variants v ON v.id=w.variant_id JOIN products p ON p.id=v.product_id WHERE w.user_id=? ORDER BY p.name,v.id').all(user.id)};
}
function markRead(db,actor,id) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(id==='all') db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(user.id);
    else {
      if(!Number.isSafeInteger(id)||!db.prepare('SELECT id FROM notifications WHERE id=? AND user_id=?').get(id,user.id)) reject(404,'Không tìm thấy thông báo.');
      db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(id,user.id);
    }
    return {status:200,message:'Đã đánh dấu đã đọc.'};
  });
}
module.exports={enabled,favorites,favorite,recordView,recent,preferences,savePreferences,watch,scan,notifications,markRead};
