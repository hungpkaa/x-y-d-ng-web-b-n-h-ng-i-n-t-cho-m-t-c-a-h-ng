const {labels}=require('./orders');
const {pagination}=require('./product-list');
const DAY=86400000,OFFSET=7*3600000;
function dateRange(query={},now=Date.now()) {
  const today=new Date(now+OFFSET).toISOString().slice(0,10);
  const from=query.from??today.slice(0,8)+'01',to=query.to??today;
  const valid=value=>typeof value==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))<9999&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(to)||from>to) return {status:400,message:'Chọn ngày bắt đầu/kết thúc hợp lệ.'};
  const start=Date.parse(from+'T00:00:00Z')-OFFSET,end=Date.parse(to+'T00:00:00Z')-OFFSET+DAY;
  if((end-start)/DAY>366) return {status:400,message:'Khoảng báo cáo tối đa 366 ngày.'};
  const utc=value=>new Date(value).toISOString().slice(0,19).replace('T',' ');
  return {status:200,from,to,start,end,startUtc:utc(start),endUtc:utc(end)};
}
function localDateTime(value) {
  const time=Date.parse(value.endsWith('Z')?value:value.replace(' ','T')+'Z');
  return Number.isFinite(time)?new Date(time+OFFSET).toISOString().slice(0,19).replace('T',' '):'Không rõ thời điểm';
}
// First delivery and receipt times come from persisted events, never the order creation date.
const events=`WITH delivered AS (SELECT order_id,MIN(created_at) delivered_at FROM order_history WHERE status='DELIVERED' GROUP BY order_id),
cash_events AS (SELECT order_id,amount,occurred_at,provider FROM payments WHERE status='SUCCEEDED' UNION ALL SELECT r.order_id,r.amount,r.created_at,'COD' FROM cod_receipts r WHERE NOT EXISTS(SELECT 1 FROM payments p WHERE p.order_id=r.order_id AND p.provider='COD')),
paid AS (SELECT order_id,MIN(occurred_at) paid_at FROM cash_events GROUP BY order_id),
recognized AS (SELECT o.*,COALESCE(o.recognition_at,MAX(d.delivered_at,p.paid_at)) recognized_at FROM orders o JOIN delivered d ON d.order_id=o.id JOIN paid p ON p.order_id=o.id WHERE o.status='DELIVERED' AND o.payment_status='PAID')`;
function salesReport(db,query={},now=Date.now()) {
  const range=dateRange(query,now);
  const low=query.low??'5';
  if(range.status!==200) return range;
  if(typeof low!=='string'||!/^\d+$/.test(low)||Number(low)>1000000) return {status:400,message:'Ngưỡng tồn thấp phải là số nguyên từ 0 đến 1.000.000.'};
  db.exec('BEGIN');
  try {
    const daily=new Map();
    for(let time=range.start;time<range.end;time+=DAY) {
      const date=new Date(time+OFFSET).toISOString().slice(0,10);
      daily.set(date,{date,newOrders:0,deliveredOrders:0,recognizedOrders:0,subtotal:0,discount:0,revenue:0,shipping:0,cash:0,onlineCash:0,totalCash:0,refunds:0,netCash:0});
    }
    const merge=(rows)=>{for(const row of rows) Object.assign(daily.get(row.date),row);};
    const args=[range.startUtc,range.endUtc];
    merge(db.prepare("SELECT date(created_at,'+7 hours') date,COUNT(*) newOrders FROM orders WHERE created_at>=? AND created_at<? GROUP BY date").all(...args));
    merge(db.prepare(`${events} SELECT date(d.delivered_at,'+7 hours') date,COUNT(*) deliveredOrders FROM delivered d JOIN orders o ON o.id=d.order_id WHERE o.status='DELIVERED' AND d.delivered_at>=? AND d.delivered_at<? GROUP BY date`).all(...args));
    merge(db.prepare(`${events} SELECT date(recognized_at,'+7 hours') date,COUNT(*) recognizedOrders,SUM(subtotal) subtotal,SUM(discount) discount,SUM(subtotal-discount) revenue,SUM(shipping_fee) shipping FROM recognized WHERE recognized_at>=? AND recognized_at<? GROUP BY date`).all(...args));
    merge(db.prepare(`${events} SELECT date(occurred_at,'+7 hours') date,SUM(CASE WHEN provider='COD' THEN amount ELSE 0 END) cash,SUM(CASE WHEN provider='VNPAY' THEN amount ELSE 0 END) onlineCash FROM cash_events WHERE occurred_at>=? AND occurred_at<? GROUP BY date`).all(...args));
    merge(db.prepare("SELECT date(occurred_at,'+7 hours') date,SUM(amount) refunds FROM refunds WHERE occurred_at>=? AND occurred_at<? GROUP BY date").all(...args));
    const rows=[...daily.values()],summary={newOrders:0,deliveredOrders:0,recognizedOrders:0,subtotal:0,discount:0,revenue:0,shipping:0,cash:0,onlineCash:0,totalCash:0,refunds:0,netCash:0};
    for(const row of rows) {row.totalCash=row.cash+row.onlineCash;row.netCash=row.totalCash-row.refunds;}
    for(const row of rows) for(const key of Object.keys(summary)) summary[key]+=row[key];
    const statuses=db.prepare('SELECT status,COUNT(*) count FROM orders WHERE created_at>=? AND created_at<? GROUP BY status ORDER BY status').all(...args);
    const bestSellers=db.prepare(`${events} SELECT i.product_id,i.sku_snapshot sku,i.name,SUM(i.quantity) quantity,SUM(i.quantity*i.price) gross FROM order_items i JOIN orders o ON o.id=i.order_id JOIN delivered d ON d.order_id=o.id WHERE o.status='DELIVERED' AND d.delivered_at>=? AND d.delivered_at<? GROUP BY i.product_id,i.sku_snapshot ORDER BY quantity DESC,i.product_id,i.sku_snapshot LIMIT 10`).all(...args);
    const lowStock=db.prepare("SELECT v.id,v.sku,p.name,v.on_hand,v.reserved,v.on_hand-v.reserved available FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='ACTIVE' AND v.active=1 AND v.on_hand-v.reserved<=? ORDER BY available,v.id").all(Number(low));
    const unknown=db.prepare(`${events} SELECT COUNT(*) count FROM orders o LEFT JOIN delivered d ON d.order_id=o.id LEFT JOIN paid p ON p.order_id=o.id WHERE o.status='DELIVERED' AND o.payment_status='PAID' AND (d.delivered_at IS NULL OR p.paid_at IS NULL)`).get().count;
    const pendingRefunds=db.prepare("SELECT COALESCE(SUM(p.amount),0) amount FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.status='SUCCEEDED' AND NOT EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=p.id) AND (o.status IN ('CANCELLED','DELIVERY_FAILED') OR EXISTS(SELECT 1 FROM payments first WHERE first.order_id=p.order_id AND first.status='SUCCEEDED' AND (first.occurred_at<p.occurred_at OR (first.occurred_at=p.occurred_at AND first.id<p.id))))").get().amount;
    db.exec('COMMIT');
    return {status:200,filters:{from:range.from,to:range.to,low},summary,daily:rows,statuses,bestSellers,lowStock,unknown,pendingRefunds};
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
function csvCell(value) {
  let text=String(value??'');
  if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
function reportCsv(report) {
  const rows=[['Nhóm','Ngày','Chỉ tiêu / SKU','Đối tượng','Số lượng','Số tiền VND']];
  const metrics={newOrders:'Đơn mới',deliveredOrders:'Đơn đã giao',recognizedOrders:'Đơn ghi nhận doanh thu',subtotal:'Tiền hàng trước giảm',discount:'Giảm giá',revenue:'Doanh thu hàng đã giao và thu tiền',shipping:'Phí giao của đơn ghi nhận',cash:'COD thực thu',onlineCash:'VNPay thực thu',totalCash:'Tổng tiền thu',refunds:'Tiền đã hoàn',netCash:'Thu trừ hoàn'};
  for(const daily of report.daily) for(const [key,label] of Object.entries(metrics)) rows.push(['Theo ngày',daily.date,label,'',key.endsWith('Orders')?daily[key]:'',key.endsWith('Orders')?'':daily[key]]);
  for(const row of report.statuses) rows.push(['Đơn mới theo trạng thái','',labels[row.status]??row.status,'',row.count,'']);
  for(const row of report.bestSellers) rows.push(['Top 10 SKU đã giao','',row.sku,row.name,row.quantity,row.gross]);
  for(const row of report.lowStock) rows.push(['Tồn khả dụng hiện tại','',row.sku,row.name,row.available,'']);
  rows.push(['Dữ liệu thiếu mốc ghi nhận','','Đơn đã giao/PAID chưa đủ bằng chứng thời điểm','',report.unknown,'']);
  rows.push(['Khoản chờ hoàn hiện tại','','Toàn bộ dữ liệu','','',report.pendingRefunds]);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const sensitive=/password|passwd|secret|token|csrf|signature|cookie|session|authorization|email|phone|address|recipient/i;
function redactJson(raw) {
  if(raw===null||raw===undefined) return null;
  try {
    const walk=(value)=>{
      if(Array.isArray(value)) return value.map(walk);
      if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sensitive.test(key)?'[Đã che]':walk(item)]));
      return value;
    };
    return JSON.stringify(walk(JSON.parse(raw)),null,2);
  } catch {return '[Dữ liệu không hợp lệ]';}
}
function auditRecords(db,query={},now=Date.now()) {
  const range=dateRange(query,now);
  if(range.status!==200) return range;
  const actor=query.actor??'',action=query.action??'',entity=query.entity??'',id=query.id??'',page=query.page??'1';
  if([actor,action,entity,id,page].some(value=>typeof value!=='string')||actor&&!/^(system|[1-9]\d*)$/.test(actor)||id&&!/^\d+$/.test(id)||[actor,id].some(value=>value!=='system'&&value!==''&&!Number.isSafeInteger(Number(value)))||!/^\d+$/.test(page)||!Number.isSafeInteger(Number(page))||Number(page)<1||Number(page)>1000000||action.length>100||entity.length>100) return {status:400,message:'Bộ lọc nhật ký không hợp lệ.'};
  const where=['a.created_at>=?','a.created_at<?'],args=[range.startUtc,range.endUtc];
  if(actor) {where.push(actor==='system'?'a.actor_id IS NULL':'a.actor_id=?');if(actor!=='system') args.push(Number(actor));}
  for(const [column,value] of [['action',action],['entity_type',entity],['entity_id',id]]) if(value) {where.push(`a.${column}=?`);args.push(value);}
  const condition=' WHERE '+where.join(' AND ');
  const total=db.prepare('SELECT COUNT(*) n FROM audit_logs a'+condition).get(...args).n;
  const filters={from:range.from,to:range.to,actor,action,entity,id};
  const paging=pagination(total,page,20,'/admin/audit',filters);
  const rows=db.prepare('SELECT a.*,u.name actor_name,u.role actor_role FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id'+condition+' ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?').all(...args,paging.size,paging.offset).map(row=>({...row,before_json:redactJson(row.before_json),after_json:redactJson(row.after_json)}));
  return {status:200,rows,paging,filters,actors:db.prepare('SELECT id,name,role FROM users WHERE id IN (SELECT DISTINCT actor_id FROM audit_logs) ORDER BY name,id').all(),actions:db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all(),entities:db.prepare('SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type').all()};
}
module.exports={dateRange,localDateTime,salesReport,reportCsv,csvCell,redactJson,auditRecords};
