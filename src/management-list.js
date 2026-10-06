const {labels}=require('./orders');
function listRecords(db,kind,query={},userId=null) {
  const accounts=kind==='accounts',page=Number(query.page||1),q=typeof query.q==='string'?query.q.trim():'';
  const status=typeof query.status==='string'?query.status:'',role=typeof query.role==='string'?query.role:'';
  const from=typeof query.from==='string'?query.from:'',to=typeof query.to==='string'?query.to:'';
  const validDate=value=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!Number.isSafeInteger(page)||page<1||page>1000000||q.length>150||status&&!(accounts?['ACTIVE','LOCKED']:Object.keys(labels)).includes(status)||role&&!['CUSTOMER','STAFF','ADMIN'].includes(role)||!validDate(from)||!validDate(to)||from&&to&&from>to) return {status:400,message:'Bộ lọc hoặc trang không hợp lệ.'};
  const where=[],args=[];
  if(!accounts&&userId!==null) {where.push('user_id=?');args.push(userId);}
  if(status) {where.push('status=?');args.push(status);}
  if(accounts&&role) {where.push('role=?');args.push(role);}
  if(q) {
    where.push(accounts?'(instr(lower(name),lower(?))>0 OR instr(lower(email),lower(?))>0 OR instr(phone,?)>0)':'(CAST(id AS TEXT)=? OR instr(lower(recipient),lower(?))>0 OR instr(phone,?)>0)');args.push(q,q,q);
  }
  if(!accounts&&from) {where.push('created_at>=?');args.push(from+' 00:00:00');}
  if(!accounts&&to) {where.push('created_at<?');const end=new Date(to);end.setUTCDate(end.getUTCDate()+1);args.push(end.toISOString().slice(0,10)+' 00:00:00');}
  const table=accounts?'users':'orders',condition=where.length?' WHERE '+where.join(' AND '):'';
  const total=db.prepare(`SELECT COUNT(*) n FROM ${table}${condition}`).get(...args).n,pages=Math.max(1,Math.ceil(total/20)),actual=Math.min(page,pages);
  const rows=db.prepare(`SELECT ${accounts?'id,name,email,role,status,version,phone':'*'} FROM ${table}${condition} ORDER BY id DESC LIMIT 20 OFFSET ?`).all(...args,(actual-1)*20);
  const base=accounts?'/admin/accounts':userId===null?'/admin/orders':'/orders';
  const link=number=>{
    const params=new URLSearchParams({q,status,...(accounts?{role}:{from,to}),page:String(number)});
    for(const key of [...params.keys()]) if(!params.get(key)) params.delete(key);
    return base+'?'+params.toString();
  };
  return {status:200,rows,filters:{q,status,role,from,to},paging:{total,page:actual,pages,previous:actual>1?link(actual-1):null,next:actual<pages?link(actual+1):null}};
}
module.exports={listRecords};
