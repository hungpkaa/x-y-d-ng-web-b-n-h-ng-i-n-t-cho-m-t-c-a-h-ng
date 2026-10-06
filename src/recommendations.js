function recommendProducts(db,{sourceId=null,variantId=null,query={}}={}) {
  const scalar=value=>value===undefined||typeof value==='string';
  if(!['category_id','brand_id','min','max'].every(key=>scalar(query[key]))) return {status:400,message:'Bộ lọc gợi ý không hợp lệ.'};
  const category=String(query.category_id||''),brand=String(query.brand_id||''),min=String(query.min||''),max=String(query.max||'');
  const id=value=>/^[1-9]\d*$/.test(String(value))&&Number.isSafeInteger(Number(value));
  const price=value=>value===''?null:/^\d+$/.test(value)&&Number(value)<=1000000000?Number(value):NaN;
  const minimum=price(min),maximum=price(max);
  const invalidCategory=category&&(!id(category)||!db.prepare('SELECT id FROM categories WHERE id=?').get(Number(category)));
  const invalidBrand=brand&&(!id(brand)||!db.prepare('SELECT id FROM brands WHERE id=?').get(Number(brand)));
  if(invalidCategory||invalidBrand) return {status:400,message:'Danh mục hoặc thương hiệu không hợp lệ.'};
  if(Number.isNaN(minimum)||Number.isNaN(maximum)||minimum!==null&&maximum!==null&&minimum>maximum) return {status:400,message:'Ngân sách không hợp lệ. Nhập số nguyên VND từ 0 đến 1 tỷ.'};
  let source=null,anchor=null;
  if(sourceId!==null) {
    if(!id(sourceId)) return {status:400,message:'Sản phẩm tham chiếu không hợp lệ.'};
    source=db.prepare("SELECT id,name,category_id,brand_id FROM products WHERE id=? AND status='ACTIVE'").get(Number(sourceId));
    if(!source) return {status:404,message:'Không tìm thấy sản phẩm tham chiếu.'};
    if(variantId!==null) {
      if(!id(variantId)) return {status:400,message:'SKU tham chiếu không hợp lệ.'};
      anchor=db.prepare('SELECT id,sku,price FROM product_variants WHERE id=? AND product_id=? AND active=1 AND price>0').get(Number(variantId),source.id);
      if(!anchor) return {status:404,message:'Không tìm thấy SKU đang bán của sản phẩm tham chiếu.'};
    } else {
      anchor=db.prepare('SELECT id,sku,price FROM product_variants WHERE product_id=? AND active=1 AND price>0 ORDER BY (on_hand-reserved>0) DESC,price,id LIMIT 1').get(source.id);
    }
  } else if(variantId!==null) return {status:400,message:'Cần chọn sản phẩm tham chiếu cho SKU.'};
  const params=[],skuConditions=['active=1','price>0','on_hand-reserved>0'];
  if(minimum!==null) {skuConditions.push('price>=?');params.push(minimum);}
  if(maximum!==null) {skuConditions.push('price<=?');params.push(maximum);}
  const where=["p.status='ACTIVE'"];
  if(source) {where.push('p.id<>?');params.push(source.id);}
  if(category) {where.push('p.category_id=?');params.push(Number(category));}
  if(brand) {where.push('p.brand_id=?');params.push(Number(brand));}
  const candidates=`SELECT p.id,p.name,p.description,p.category,p.brand,p.category_id,p.brand_id,
    v.id AS variant_id,v.sku,v.color,v.configuration,v.price,v.on_hand-v.reserved AS stock,
    COALESCE(sold.quantity,0) AS delivered_quantity,
    (SELECT storage_key FROM product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) AS image_key
    FROM products p JOIN product_variants v ON v.id=(SELECT id FROM product_variants WHERE product_id=p.id AND ${skuConditions.join(' AND ')} ORDER BY price,id LIMIT 1)
    LEFT JOIN (SELECT i.product_id,SUM(i.quantity) AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='DELIVERED' GROUP BY i.product_id) sold ON sold.product_id=p.id
    WHERE ${where.join(' AND ')}`;
  const score=source?'CASE WHEN category_id=? THEN 50 ELSE 0 END + CASE WHEN brand_id=? THEN 20 ELSE 0 END + CASE WHEN ABS(price-?)*5<=? THEN 10 ELSE 0 END':'0';
  if(source) params.push(source.category_id,source.brand_id,anchor?.price??-1,anchor?.price??-1);
  const rows=db.prepare(`WITH candidates AS (${candidates}) SELECT *,${score} AS score FROM candidates ORDER BY score DESC,delivered_quantity DESC,id ASC LIMIT 6`).all(...params);
  const products=rows.map(product=>{
    const reasons=[];
    if(source) {
      if(source.category_id!==null&&product.category_id===source.category_id) reasons.push('Cùng danh mục');
      if(source.brand_id!==null&&product.brand_id===source.brand_id) reasons.push('Cùng thương hiệu');
      if(anchor&&Math.abs(product.price-anchor.price)*5<=anchor.price) reasons.push('Giá chênh lệch không quá 20%');
    }
    if(product.delivered_quantity>0) reasons.push(`Đã giao ${product.delivered_quantity} sản phẩm`);
    if(!reasons.length) reasons.push('Đang bán và còn hàng');
    return {...product,reasons};
  });
  const heading=source&&products.some(product=>product.score>0)?'Sản phẩm bạn có thể quan tâm':products.some(product=>product.delivered_quantity>0)?'Sản phẩm được giao nhiều':'Sản phẩm sẵn có';
  return {status:200,products,source,anchor,heading,filters:{category_id:category,brand_id:brand,min,max}};
}
function recommendationFilters(db) {
  const available="p.status='ACTIVE' AND EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.active=1 AND v.price>0 AND v.on_hand-v.reserved>0)";
  return {
    categories:db.prepare(`SELECT DISTINCT c.id,c.name FROM categories c JOIN products p ON p.category_id=c.id WHERE ${available} ORDER BY c.name,c.id`).all(),
    brands:db.prepare(`SELECT DISTINCT b.id,b.name FROM brands b JOIN products p ON p.brand_id=b.id WHERE ${available} ORDER BY b.name,b.id`).all()
  };
}
module.exports={recommendProducts,recommendationFilters};
