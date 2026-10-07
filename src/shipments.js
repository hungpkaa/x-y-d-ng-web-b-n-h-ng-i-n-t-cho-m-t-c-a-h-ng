const {transaction}=require('./products');
const {actorUser,reject}=require('./accounts');
const {pagination}=require('./product-list');
const transitions={READY:['IN_TRANSIT'],IN_TRANSIT:['DELIVERED','FAILED'],FAILED:['IN_TRANSIT','RETURNED'],DELIVERED:[],RETURNED:[],CANCELLED:[]};
const labels={READY:'Sẵn sàng bàn giao',IN_TRANSIT:'Đang vận chuyển',DELIVERED:'Giao thành công',FAILED:'Giao thất bại, chờ xử lý',RETURNED:'Đã nhận hàng về',CANCELLED:'Đã hủy trước bàn giao'};
const text=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
function enabled(db) {
  return db.dialect==='postgres'
    ? !!db.prepare("SELECT to_regclass('shipments') name").get().name
    : !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shipments'").get();
}
function audit(db,actor,id,before,after) {
  db.prepare("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'SHIPMENT_CHANGE','SHIPMENT',?,?,?)").run(actor.id,id,before?JSON.stringify(before):null,JSON.stringify(after));
}
function evidence(input,now=Date.now()) {
  if(!text(input.evidence_ref,3,200)||!text(input.reason,3,300)) reject(400,'Nhập bằng chứng (3–200 ký tự) và lý do (3–300 ký tự).');
  const local=input.occurred_at;
  if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) reject(400,'Nhập thời điểm thực tế theo giờ Việt Nam.');
  const normalized=local.length===16?local+':00':local,time=Date.parse(normalized+'+07:00');
  if(!Number.isFinite(time)||new Date(time+25200000).toISOString().slice(0,19)!==normalized||time>now+60000) reject(400,'Thời điểm vận chuyển không hợp lệ hoặc ở tương lai.');
  return {evidence:input.evidence_ref.trim(),note:input.reason.trim(),occurred:new Date(time).toISOString().slice(0,19).replace('T',' ')};
}
function event(db,actor,shipment,previous,status,proof,key) {
  db.prepare('INSERT INTO shipment_events(shipment_id,event_key,actor_id,previous_status,status,evidence_ref,note,occurred_at) VALUES(?,?,?,?,?,?,?,?)').run(shipment.id,key,actor.id,previous,status,proof.evidence,proof.note,proof.occurred);
}
function createShipment(db,actor,orderId,input) {
  return transaction(db,()=>{
    if(!Number.isSafeInteger(orderId)||orderId<1) reject(404,'Không tìm thấy đơn.');
    const manager=actorUser(db,actor,['STAFF','ADMIN']),order=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    if(!order) reject(404,'Không tìm thấy đơn.');
    if(!text(input.provider,2,80)||!text(input.tracking_number,3,100)) reject(400,'Nhập hãng vận chuyển và mã vận đơn hợp lệ.');
    const provider=input.provider.trim().toUpperCase(),tracking=input.tracking_number.trim().toUpperCase(),proof=evidence(input);
    const old=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(orderId);
    if(old) {
      const first=db.prepare('SELECT * FROM shipment_events WHERE shipment_id=? ORDER BY id LIMIT 1').get(old.id);
      if(old.provider!==provider||old.tracking_number!==tracking||first.evidence_ref!==proof.evidence||first.note!==proof.note||first.occurred_at!==proof.occurred) reject(409,'Đơn đã có vận đơn khác hoặc bằng chứng khác.');
      return {status:200,id:old.id,message:'Vận đơn đã được ghi nhận trước đó.'};
    }
    if(Number(input.version)!==order.version) reject(409,'Đơn đã thay đổi. Hãy tải lại.');
    if(!['PREPARING','SHIPPING'].includes(order.status)||order.payment_method!=='COD'&&order.payment_status!=='PAID') reject(409,'Chỉ tạo vận đơn khi đang chuẩn bị và đáp ứng điều kiện thanh toán.');
    if(!order.recipient||!order.phone||!order.address) reject(409,'Đơn thiếu thông tin nhận hàng.');
    if(db.prepare('SELECT id FROM shipments WHERE provider=? AND tracking_number=?').get(provider,tracking)) reject(409,'Mã vận đơn đã dùng cho đơn khác.');
    if(proof.occurred<order.created_at) reject(400,'Thời điểm ghi nhận không được trước lúc đặt đơn.');
    // Legacy orders already SHIPPING can attach their actual tracking record;
    // no reservation is consumed again and no handoff event is fabricated.
    const status=order.status==='SHIPPING'?'IN_TRANSIT':'READY',cod=order.payment_method==='COD'&&order.payment_status!=='PAID'?order.total:0;
    const id=Number(db.prepare('INSERT INTO shipments(order_id,provider,tracking_number,status,cod_amount) VALUES(?,?,?,?,?)').run(orderId,provider,tracking,status,cod).lastInsertRowid);
    event(db,manager,{id},null,status,proof,'shipment:create:'+id);
    audit(db,manager,id,null,{order_id:orderId,provider,tracking_number:tracking,status,cod_amount:cod,reason:proof.note});
    return {status:200,id,message:'Đã ghi nhận vận đơn. Tồn kho chưa thay đổi.'};
  });
}
function changeShipment(db,actor,id,input) {
  return transaction(db,()=>{
    if(!Number.isSafeInteger(id)||id<1) reject(404,'Không tìm thấy vận đơn.');
    const manager=actorUser(db,actor,['STAFF','ADMIN']),shipment=db.prepare('SELECT * FROM shipments WHERE id=?').get(id);
    if(!shipment) reject(404,'Không tìm thấy vận đơn.');
    const proof=evidence(input),status=input.status;
    if(!Object.hasOwn(labels,status)) reject(400,'Trạng thái vận chuyển không hợp lệ.');
    if(typeof input.request_key!=='string'||! /^[a-f0-9]{32}$/.test(input.request_key)) reject(400,'Yêu cầu không hợp lệ. Hãy tải lại trang.');
    const key='shipment:update:'+input.request_key,old=db.prepare('SELECT * FROM shipment_events WHERE event_key=?').get(key);
    if(old) {
      if(old.shipment_id!==id||old.actor_id!==manager.id||old.status!==status||old.evidence_ref!==proof.evidence||old.note!==proof.note||old.occurred_at!==proof.occurred) reject(409,'Khóa yêu cầu đã được dùng cho nội dung khác.');
      return {status:200,message:'Sự kiện đã được ghi nhận trước đó.'};
    }
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(shipment.order_id);
    if(Number(input.version)!==shipment.version||Number(input.order_version)!==order.version) reject(409,'Vận đơn hoặc đơn hàng đã thay đổi. Hãy tải lại.');
    if(!transitions[shipment.status].includes(status)) reject(409,'Không được chuyển sang trạng thái vận chuyển này.');
    const latest=db.prepare('SELECT occurred_at FROM shipment_events WHERE shipment_id=? ORDER BY id DESC LIMIT 1').get(id);
    if(proof.occurred<latest.occurred_at) reject(409,'Sự kiện cũ không được làm lùi tiến trình vận chuyển.');
    if(status==='IN_TRANSIT'&&shipment.status==='READY') {
      if(order.status!=='PREPARING') reject(409,'Đơn chưa sẵn sàng bàn giao hoặc đã hủy.');
      if(order.payment_method!=='COD'&&order.payment_status!=='PAID') reject(409,'Đơn trực tuyến chưa được thanh toán.');
      require('./orders').inventoryTransitionWork(db,order.id,'SHIPPING',manager.id);
      orderStatus(db,manager,order,'SHIPPING',proof.note);
    } else {
      if(order.status!=='SHIPPING') reject(409,'Đơn không còn trong quá trình giao hàng.');
      if(status==='DELIVERED') {
        orderStatus(db,manager,order,'DELIVERED',proof.note);
        require('./payments').recognizeWork(db,order.id);
      } else if(status==='RETURNED') {
        const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
        for(const item of items) {
          const reservation=db.prepare('SELECT status FROM inventory_reservations WHERE order_item_id=?').get(item.id);
          if(reservation?.status!=='CONSUMED') reject(409,'Không có bằng chứng hàng đã xuất cho dòng đơn.');
          db.prepare('UPDATE product_variants SET on_hand=on_hand+?,version=version+1 WHERE id=?').run(item.quantity,item.variant_id);
          db.prepare('INSERT INTO inventory_movements(variant_id,actor_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,?,0,?,?)').run(item.variant_id,manager.id,item.quantity,'returned:'+item.id,'Nhận lại hàng: '+proof.note);
        }
        orderStatus(db,manager,order,'DELIVERY_FAILED',proof.note);
        db.prepare("UPDATE orders SET payment_status=CASE WHEN payment_status='PAID' THEN 'REFUND_PENDING' ELSE payment_status END WHERE id=?").run(order.id);
      }
    }
    db.prepare('UPDATE shipments SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);
    event(db,manager,shipment,shipment.status,status,proof,key);
    audit(db,manager,id,{status:shipment.status,version:shipment.version},{status,version:shipment.version+1,reason:proof.note});
    return {status:200,message:status==='RETURNED'?'Đã xác nhận hàng thực về và cộng kho một lần.':'Đã cập nhật vận chuyển.'};
  });
}
function orderStatus(db,actor,order,status,note) {
  db.prepare('UPDATE orders SET status=?,version=version+1 WHERE id=?').run(status,order.id);
  db.prepare('INSERT INTO order_history(order_id,actor_id,status,previous_status,note) VALUES(?,?,?,?,?)').run(order.id,actor.id,status,order.status,note);
}
function cancelWork(db,orderId,actorId,note) {
  if(!enabled(db)) return;
  const shipment=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(orderId);
  if(!shipment) return;
  if(shipment.status!=='READY') reject(409,'Vận đơn đã bàn giao; không hủy trực tiếp.');
  db.prepare("UPDATE shipments SET status='CANCELLED',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(shipment.id);
  const occurred=new Date().toISOString().slice(0,19).replace('T',' ');
  event(db,{id:actorId},shipment,shipment.status,'CANCELLED',{evidence:'ORDER-'+orderId,note,occurred},'shipment:cancel:'+shipment.id);
  // This is a local manual record, not a claim that a carrier API accepted a cancellation.
  audit(db,{id:actorId},shipment.id,{status:'READY'},{status:'CANCELLED',reason:note,manual_carrier_cancellation_required:true});
}
function detail(db,actor,orderId) {
  const user=actorUser(db,actor),order=db.prepare('SELECT user_id FROM orders WHERE id=?').get(orderId);
  if(!order||user.role==='CUSTOMER'&&order.user_id!==user.id) reject(404,'Không tìm thấy đơn.');
  if(!enabled(db)) return {shipment:null,events:[]};
  const shipment=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(orderId);
  if(!shipment) return {shipment:null,events:[]};
  const columns=user.role==='CUSTOMER'?'status,occurred_at':'*';
  return {shipment,events:db.prepare(`SELECT ${columns} FROM shipment_events WHERE shipment_id=? ORDER BY id`).all(shipment.id)};
}
function list(db,actor,query={}) {
  actorUser(db,actor,['STAFF','ADMIN']);
  const status=query.status??'',q=typeof query.q==='string'?query.q.trim():'';
  if(status&&!Object.hasOwn(labels,status)||q.length>100) return {status:400,message:'Bộ lọc không hợp lệ.'};
  const where="WHERE (?='' OR s.status=?) AND (instr(lower(s.tracking_number),lower(?))>0 OR CAST(s.order_id AS TEXT)=?)",args=[status,status,q,q];
  const total=db.prepare(`SELECT COUNT(*) n FROM shipments s ${where}`).get(...args).n,paging=pagination(total,query.page||'1',20,'/admin/shipments',{status,q});
  return {status:200,rows:db.prepare(`SELECT s.* FROM shipments s ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args,paging.size,paging.offset),paging,filters:{status,q}};
}
module.exports={enabled,createShipment,changeShipment,cancelWork,detail,list,labels,transitions};
