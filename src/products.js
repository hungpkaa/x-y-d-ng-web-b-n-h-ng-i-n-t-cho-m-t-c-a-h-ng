const { randomBytes } = require('node:crypto');
function transaction(db,work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result=work(); db.exec('COMMIT'); return result; }
  catch(error) { db.exec('ROLLBACK'); if(error.status) return {status:error.status,message:error.message}; throw error; }
}
function conflict(message='Thông tin đã thay đổi. Hãy tải lại trang.') { const error=new Error(message); error.status=409; throw error; }
function assertFresh(db,table,id,version) {
  if(db.prepare(`SELECT version FROM ${table} WHERE id=?`).get(id)?.version!==version) conflict();
}
function audit(db,actor,action,type,id,before,after) {
  db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?)').run(actor.id??null,action,type,id,before?JSON.stringify(before):null,JSON.stringify(after));
}
const fail=(status,message)=>({status,message});
function saveProduct(db,actor,input) {
  if (!['ADMIN','STAFF'].includes(actor.role)) return fail(403,'Bạn không có quyền truy cập.');
  if (['price','stock','active','status'].some(key=>input[key]!==undefined)) return fail(403,'Giá, trạng thái và tồn được cập nhật bằng thao tác riêng trên SKU.');
  const id=input.id?Number(input.id):null;
  if (id!==null && (!Number.isSafeInteger(id)||id<=0)) return fail(400,'Mã sản phẩm không hợp lệ.');
  const existing=id===null?null:db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (id!==null&&!existing) return fail(404,'Không tìm thấy sản phẩm.');
  if (existing && Number(input.version)!==existing.version) return fail(409,'Thông tin đã thay đổi. Hãy tải lại trang.');
  const fields=['name','category','brand','description'].map(key=>typeof input[key]==='string'?input[key].trim():'');
  if(fields.some((value,i)=>!value||value.length>(i===3?2000:120))) return fail(400,'Kiểm tra tên, danh mục, thương hiệu và mô tả.');
  const category=db.prepare('SELECT * FROM categories WHERE name=?').get(fields[1]);
  const brand=db.prepare('SELECT * FROM brands WHERE name=?').get(fields[2]);
  if(!category||!brand||(!category.active&&existing?.category_id!==category.id)||(!brand.active&&existing?.brand_id!==brand.id)) return fail(400,'Chọn danh mục và thương hiệu đang được sử dụng.');
  return transaction(db,()=>{
    if(existing) assertFresh(db,'products',id,existing.version);
    if(existing&&existing.category_id!==category.id&&existing.status==='ACTIVE') return {status:409,message:'Hãy ẩn sản phẩm trước khi đổi danh mục để kiểm tra lại thông số.'};
    if(existing&&existing.category_id!==category.id&&db.prepare('SELECT a.id FROM variant_attribute_values a JOIN product_variants v ON v.id=a.variant_id WHERE v.product_id=? LIMIT 1').get(id)) return {status:409,message:'SKU đã có thông số. Hãy xóa các giá trị trước khi đổi danh mục.'};
    const latestCategory=db.prepare('SELECT name,active FROM categories WHERE id=?').get(category.id);
    const latestBrand=db.prepare('SELECT name,active FROM brands WHERE id=?').get(brand.id);
    if(!latestCategory||!latestBrand||latestCategory.name!==fields[1]||latestBrand.name!==fields[2]||(!latestCategory.active&&existing?.category_id!==category.id)||(!latestBrand.active&&existing?.brand_id!==brand.id)) conflict('Danh mục hoặc thương hiệu đã thay đổi. Hãy tải lại trang.');
    let productId=id;
    if(existing) db.prepare('UPDATE products SET name=?,category=?,brand=?,description=?,category_id=?,brand_id=?,version=version+1 WHERE id=?').run(...fields,category.id,brand.id,id);
    // Old price/stock columns are compatibility values, never used for selling.
    else productId=Number(db.prepare("INSERT INTO products(name,category,brand,description,category_id,brand_id,price,stock,active,status) VALUES(?,?,?,?,?,?,1,0,0,'DRAFT')").run(...fields,category.id,brand.id).lastInsertRowid);
    audit(db,actor,'SAVE_PRODUCT','product',productId,existing,db.prepare('SELECT * FROM products WHERE id=?').get(productId));
    return {status:200,message:'Đã lưu sản phẩm. Bản nháp cần có SKU và được quản trị viên công bố.',id:productId};
  });
}
function saveVariant(db,actor,productId,input) {
  if(!['ADMIN','STAFF'].includes(actor.role)) return fail(403,'Bạn không có quyền truy cập.');
  if(['price','active','on_hand','reserved','stock'].some(key=>input[key]!==undefined)) return fail(403,'Đặt giá, bật bán và điều chỉnh tồn bằng thao tác riêng.');
  if(!db.prepare('SELECT id FROM products WHERE id=?').get(productId)) return fail(404,'Không tìm thấy sản phẩm.');
  const id=input.id?Number(input.id):null;
  if(id!==null&&(!Number.isSafeInteger(id)||id<=0)) return fail(400,'Mã SKU không hợp lệ.');
  const existing=id===null?null:db.prepare('SELECT * FROM product_variants WHERE id=? AND product_id=?').get(id,productId);
  if(id!==null&&!existing) return fail(404,'Không tìm thấy SKU.');
  if(existing&&Number(input.version)!==existing.version) return fail(409,'SKU đã thay đổi. Hãy tải lại trang.');
  const sku=typeof input.sku==='string'?input.sku.trim().toUpperCase():'';
  const color=typeof input.color==='string'?input.color.trim():'';
  const configuration=typeof input.configuration==='string'?input.configuration.trim():'';
  if(!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(sku)||color.length>80||configuration.length>2000) return fail(400,'Mã SKU dùng chữ không dấu, số, dấu gạch ngang/gạch dưới; kiểm tra màu và cấu hình.');
  if(existing && sku!==existing.sku && db.prepare('SELECT id FROM order_items WHERE variant_id=? LIMIT 1').get(id)) return fail(409,'SKU đã có đơn không được đổi mã.');
  try {
    return transaction(db,()=>{
      if(existing) {
        assertFresh(db,'product_variants',id,existing.version);
        if(sku!==existing.sku && db.prepare('SELECT id FROM order_items WHERE variant_id=? LIMIT 1').get(id)) conflict('SKU đã có đơn không được đổi mã.');
      }
      let variantId=id;
      if(existing) db.prepare('UPDATE product_variants SET sku=?,color=?,configuration=?,version=version+1 WHERE id=?').run(sku,color,configuration,id);
      else variantId=Number(db.prepare('INSERT INTO product_variants(product_id,sku,color,configuration) VALUES(?,?,?,?)').run(productId,sku,color,configuration).lastInsertRowid);
      audit(db,actor,'SAVE_SKU','variant',variantId,existing,db.prepare('SELECT * FROM product_variants WHERE id=?').get(variantId));
      return {status:200,message:'Đã lưu SKU. SKU mới chưa có giá và chưa bật bán.',id:variantId};
    });
  } catch(error) { if(String(error.message).includes('UNIQUE constraint failed')) return fail(409,'Mã SKU đã tồn tại.'); throw error; }
}
function priceVariant(db,actor,id,input) {
  if(actor.role!=='ADMIN') return fail(403,'Chỉ quản trị viên được đặt giá và bật bán SKU.');
  const existing=db.prepare('SELECT * FROM product_variants WHERE id=?').get(id);
  if(!existing) return fail(404,'Không tìm thấy SKU.');
  if(Number(input.version)!==existing.version) return fail(409,'SKU đã thay đổi. Hãy tải lại trang.');
  const price=Number(input.price),active=input.active==='1'?1:input.active==='0'?0:null;
  if(!Number.isSafeInteger(price)||price<1||price>1000000000||active===null) return fail(400,'Giá hoặc trạng thái SKU không hợp lệ.');
  if(!active && db.prepare('SELECT status FROM products WHERE id=?').get(existing.product_id).status==='ACTIVE' && !db.prepare('SELECT id FROM product_variants WHERE product_id=? AND id<>? AND active=1 LIMIT 1').get(existing.product_id,id)) return fail(409,'Hãy ẩn sản phẩm trước khi tắt SKU đang bán cuối cùng.');
  return transaction(db,()=>{
    assertFresh(db,'product_variants',id,existing.version);
    if(active && db.prepare('SELECT status FROM products WHERE id=?').get(existing.product_id).status==='ACTIVE' && db.prepare('SELECT d.id FROM attribute_definitions d JOIN products p ON p.category_id=d.category_id WHERE p.id=? AND d.required=1 AND NOT EXISTS(SELECT 1 FROM variant_attribute_values a WHERE a.variant_id=? AND a.attribute_id=d.id) LIMIT 1').get(existing.product_id,id)) return {status:400,message:'SKU thiếu thông số bắt buộc. Hãy nhập trước khi bật bán.'};
    if(!active && db.prepare('SELECT status FROM products WHERE id=?').get(existing.product_id).status==='ACTIVE' && !db.prepare('SELECT id FROM product_variants WHERE product_id=? AND id<>? AND active=1 LIMIT 1').get(existing.product_id,id)) conflict('Hãy ẩn sản phẩm trước khi tắt SKU đang bán cuối cùng.');
    db.prepare('UPDATE product_variants SET price=?,active=?,version=version+1 WHERE id=?').run(price,active,id);
    audit(db,actor,'PRICE_SKU','variant',id,existing,db.prepare('SELECT * FROM product_variants WHERE id=?').get(id));
    return {status:200,message:'Đã cập nhật giá và trạng thái SKU.'};
  });
}
function adjustStock(db,actor,id,input) {
  if(!['ADMIN','STAFF'].includes(actor.role)) return fail(403,'Bạn không có quyền truy cập.');
  const existing=db.prepare('SELECT * FROM product_variants WHERE id=?').get(id);
  if(!existing) return fail(404,'Không tìm thấy SKU.');
  if(Number(input.version)!==existing.version) return fail(409,'Tồn kho đã thay đổi. Hãy tải lại trang.');
  const delta=Number(input.delta),reason=typeof input.reason==='string'?input.reason.trim():'';
  if(!Number.isSafeInteger(delta)||delta===0||existing.on_hand+delta<existing.reserved||existing.on_hand+delta>1000000||reason.length<2||reason.length>300) return fail(400,'Điều chỉnh tồn không hợp lệ hoặc làm giảm hàng đã giữ. Cần có lý do.');
  return transaction(db,()=>{
    assertFresh(db,'product_variants',id,existing.version);
    db.prepare('UPDATE product_variants SET on_hand=on_hand+?,version=version+1 WHERE id=?').run(delta,id);
    db.prepare('INSERT INTO inventory_movements(variant_id,actor_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,?,0,?,?)').run(id,actor.id??null,delta,`adjust:${randomBytes(16).toString('hex')}`,reason);
    audit(db,actor,'ADJUST_STOCK','variant',id,existing,db.prepare('SELECT * FROM product_variants WHERE id=?').get(id));
    return {status:200,message:'Đã điều chỉnh tồn và lưu lịch sử.'};
  });
}
function publishProduct(db,actor,id,input) {
  if(actor.role!=='ADMIN') return fail(403,'Chỉ quản trị viên được công bố hoặc ẩn sản phẩm.');
  const existing=db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if(!existing) return fail(404,'Không tìm thấy sản phẩm.');
  if(Number(input.version)!==existing.version) return fail(409,'Sản phẩm đã thay đổi. Hãy tải lại trang.');
  if(!['ACTIVE','HIDDEN'].includes(input.status)) return fail(400,'Trạng thái không hợp lệ.');
  if(input.status==='ACTIVE'&&!db.prepare('SELECT id FROM product_variants WHERE product_id=? AND active=1 AND price>0 LIMIT 1').get(id)) return fail(400,'Cần ít nhất một SKU có giá hợp lệ và được bật bán.');
  return transaction(db,()=>{
    assertFresh(db,'products',id,existing.version);
    if(input.status==='ACTIVE'&&!db.prepare('SELECT id FROM product_variants WHERE product_id=? AND active=1 AND price>0 LIMIT 1').get(id)) conflict('Cần ít nhất một SKU có giá hợp lệ và được bật bán.');
    if(input.status==='ACTIVE') {
      const problem=require('./attributes').publicationProblem(db,id);
      if(problem) return {status:400,message:problem};
    }
    db.prepare('UPDATE products SET status=?,active=?,version=version+1 WHERE id=?').run(input.status,input.status==='ACTIVE'?1:0,id);
    audit(db,actor,'PUBLISH_PRODUCT','product',id,existing,{status:input.status});
    return {status:200,message:input.status==='ACTIVE'?'Đã công bố sản phẩm.':'Đã ẩn sản phẩm; đơn cũ vẫn được giữ.'};
  });
}
module.exports={saveProduct,saveVariant,priceVariant,adjustStock,publishProduct,transaction};
