function pageNumber(value) { return typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0?Math.min(Number(value),1000000):1; }
function pagination(total,page,size,base,filters={}) {
  const pages=Math.max(1,Math.ceil(total/size));
  const current=Math.min(pageNumber(String(page)),pages);
  const link=n=>`${base}?${new URLSearchParams({...filters,page:String(n)})}`;
  return {total,page:current,pages,size,offset:(current-1)*size,previous:current>1?link(current-1):null,next:current<pages?link(current+1):null};
}
function listProducts(db,query={},management=false) {
  const q=String(query.q||'').slice(0,100),category=String(query.category||'').slice(0,120),brand=String(query.brand||'').slice(0,120);
  const sort=['newest','price_asc','price_desc'].includes(query.sort)?query.sort:'newest';
  const min=String(query.min||''),max=String(query.max||'');
  const priceValue=value=>value===''?null:/^\d+$/.test(value)&&Number(value)<=1000000000?Number(value):NaN;
  const minimum=priceValue(min),maximum=priceValue(max);
  if(Number.isNaN(minimum)||Number.isNaN(maximum)||(minimum!==null&&maximum!==null&&minimum>maximum)) return {status:400,message:'Khoảng giá không hợp lệ.'};
  const status=management&&['DRAFT','ACTIVE','HIDDEN'].includes(query.status)?query.status:'';
  const params=[`%${q}%`,`%${q}%`,category,category,brand,brand];
  let where="(p.name LIKE ? OR p.brand LIKE ?) AND (?='' OR p.category=?) AND (?='' OR p.brand=?)";
  if(!management) where+=" AND p.status='ACTIVE' AND s.price IS NOT NULL";
  if(status) {where+=' AND p.status=?';params.push(status);}
  const skuParams=[];
  let skuWhere='active=1';
  if(minimum!==null) {skuWhere+=' AND price>=?';skuParams.push(minimum);}
  if(maximum!==null) {skuWhere+=' AND price<=?';skuParams.push(maximum);}
  if(minimum!==null||maximum!==null) where+=' AND s.price IS NOT NULL';
  params.unshift(...skuParams);
  const from=`FROM products p LEFT JOIN (SELECT product_id,MIN(price) AS price,SUM(on_hand-reserved) AS stock FROM product_variants WHERE ${skuWhere} GROUP BY product_id) s ON s.product_id=p.id WHERE ${where}`;
  const total=db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params).n;
  const filters={q,category,brand,sort,min,max,...(management?{status}:{})};
  const paging=pagination(total,pageNumber(query.page),20,management?'/admin':'/',filters);
  const order={newest:'p.id DESC',price_asc:'s.price ASC,p.id DESC',price_desc:'s.price DESC,p.id DESC'}[sort];
  const products=db.prepare(`SELECT p.*,s.price,s.stock,(SELECT storage_key FROM product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) AS image_key ${from} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params,paging.size,paging.offset);
  return {...filters,status:200,productStatus:status,products,paging};
}
module.exports={listProducts,pagination};
