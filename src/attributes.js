const { transaction }=require('./products');
function log(db,actor,action,id,after) {db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,?,?,?,?)').run(actor.id??null,action,action==='SAVE_VALUES'?'variant':'attribute',id,JSON.stringify(after));}
function saveDefinition(db,actor,input) {
  if(actor.role!=='ADMIN') return {status:403,message:'Chỉ quản trị viên được định nghĩa thông số.'};
  const id=input.id?Number(input.id):null,categoryId=Number(input.category_id);
  const code=String(input.code||'').trim(),label=String(input.label||'').trim(),unit=String(input.unit||'').trim();
  const required=input.required==='1'?1:input.required==='0'?0:null;
  if((id!==null&&(!Number.isSafeInteger(id)||id<=0))||!Number.isSafeInteger(categoryId)||!db.prepare('SELECT id FROM categories WHERE id=?').get(categoryId)||!/^[a-z][a-z0-9_]{0,59}$/.test(code)||!label||label.length>120||unit.length>30||!['TEXT','NUMBER','BOOLEAN'].includes(input.data_type)||required===null||(input.data_type!=='NUMBER'&&unit)) return {status:400,message:'Kiểm tra danh mục, mã thông số, tên, kiểu dữ liệu và đơn vị.'};
  try {return transaction(db,()=>{
    const existing=id===null?null:db.prepare('SELECT * FROM attribute_definitions WHERE id=?').get(id);
    if(id!==null&&!existing) return {status:404,message:'Không tìm thấy thông số.'};
    if(existing&&Number(input.version)!==existing.version) return {status:409,message:'Thông số đã thay đổi. Hãy tải lại trang.'};
    if(existing && (existing.category_id!==categoryId||existing.data_type!==input.data_type||existing.code!==code||existing.unit!==unit) && db.prepare('SELECT id FROM variant_attribute_values WHERE attribute_id=? LIMIT 1').get(id)) return {status:409,message:'Thông số đã có dữ liệu: không đổi danh mục, mã, kiểu hoặc đơn vị.'};
    if(required && db.prepare(`SELECT v.id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.category_id=? AND p.status='ACTIVE' AND v.active=1 AND NOT EXISTS(SELECT 1 FROM variant_attribute_values a WHERE a.variant_id=v.id AND a.attribute_id=?) LIMIT 1`).get(categoryId,id??-1)) return {status:409,message:'Hãy ẩn sản phẩm hoặc bổ sung giá trị trước khi đặt thông số bắt buộc.'};
    const attrId=existing?id:Number(db.prepare('INSERT INTO attribute_definitions(category_id,code,label,data_type,unit,required) VALUES(?,?,?,?,?,?)').run(categoryId,code,label,input.data_type,unit,required).lastInsertRowid);
    if(existing) db.prepare('UPDATE attribute_definitions SET category_id=?,code=?,label=?,data_type=?,unit=?,required=?,version=version+1 WHERE id=?').run(categoryId,code,label,input.data_type,unit,required,id);
    log(db,actor,'SAVE_DEFINITION',attrId,db.prepare('SELECT * FROM attribute_definitions WHERE id=?').get(attrId));
    return {status:200,message:'Đã lưu định nghĩa thông số.'};
  });} catch(error) {if(String(error.message).includes('UNIQUE constraint failed')) return {status:409,message:'Mã thông số đã tồn tại trong danh mục.'};throw error;}
}
function getAttributes(db,variantId) {
  return db.prepare(`SELECT d.*,a.value_text,a.value_number,a.value_boolean FROM product_variants v JOIN products p ON p.id=v.product_id JOIN attribute_definitions d ON d.category_id=p.category_id LEFT JOIN variant_attribute_values a ON a.attribute_id=d.id AND a.variant_id=v.id WHERE v.id=? ORDER BY d.id`).all(variantId);
}
function saveAttributes(db,actor,variantId,input) {
  if(!['ADMIN','STAFF'].includes(actor.role)) return {status:403,message:'Bạn không có quyền cập nhật thông số.'};
  return transaction(db,()=>{
    const variant=db.prepare('SELECT v.*,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=?').get(variantId);
    if(!variant) return {status:404,message:'Không tìm thấy SKU.'};
    if(Number(input.version)!==variant.version) return {status:409,message:'SKU đã thay đổi. Hãy tải lại trang.'};
    const definitions=getAttributes(db,variantId),ids=new Set(definitions.map(d=>`attr_${d.id}`));
    if(Object.keys(input).some(key=>key.startsWith('attr_')&&!ids.has(key))) return {status:400,message:'Thông số không thuộc danh mục SKU.'};
    const values=[];
    for(const d of definitions) {
      const value=typeof input[`attr_${d.id}`]==='string'?input[`attr_${d.id}`].trim():'';
      if(!value) {if(d.required&&variant.active&&variant.product_status==='ACTIVE') return {status:400,message:`Cần nhập ${d.label}.`};values.push([d.id,null,null,null]);continue;}
      if(value.length>500) return {status:400,message:`${d.label} quá dài.`};
      if(d.data_type==='NUMBER' && (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)||!Number.isFinite(Number(value))||Math.abs(Number(value))>1000000000000)) return {status:400,message:`${d.label} phải là số hợp lệ.`};
      if(d.data_type==='BOOLEAN'&&!['0','1'].includes(value)) return {status:400,message:`${d.label} phải chọn Có hoặc Không.`};
      values.push([d.id,d.data_type==='TEXT'?value:null,d.data_type==='NUMBER'?Number(value):null,d.data_type==='BOOLEAN'?Number(value):null]);
    }
    for(const [id,text,number,boolean] of values) {
      db.prepare('DELETE FROM variant_attribute_values WHERE variant_id=? AND attribute_id=?').run(variantId,id);
      if(text!==null||number!==null||boolean!==null) db.prepare('INSERT INTO variant_attribute_values(variant_id,attribute_id,value_text,value_number,value_boolean) VALUES(?,?,?,?,?)').run(variantId,id,text,number,boolean);
    }
    db.prepare('UPDATE product_variants SET version=version+1 WHERE id=?').run(variantId);
    log(db,actor,'SAVE_VALUES',variantId,values);
    return {status:200,message:'Đã cập nhật thông số kỹ thuật.'};
  });
}
function publicationProblem(db,productId) {
  if(!db.prepare('SELECT id FROM product_images WHERE product_id=? LIMIT 1').get(productId)) return 'Cần tải ít nhất một ảnh sản phẩm trước khi công bố.';
  const missing=db.prepare(`SELECT d.label FROM product_variants v JOIN products p ON p.id=v.product_id JOIN attribute_definitions d ON d.category_id=p.category_id AND d.required=1 WHERE p.id=? AND v.active=1 AND NOT EXISTS(SELECT 1 FROM variant_attribute_values a WHERE a.variant_id=v.id AND a.attribute_id=d.id) LIMIT 1`).get(productId);
  return missing?`SKU đang bán còn thiếu thông số bắt buộc: ${missing.label}.`:null;
}
module.exports={saveDefinition,saveAttributes,getAttributes,publicationProblem};
