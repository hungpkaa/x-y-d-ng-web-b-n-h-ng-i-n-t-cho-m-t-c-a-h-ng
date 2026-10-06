const {getAttributes}=require('./attributes');
const validId=value=>(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)||(typeof value==='string'&&/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value)));
function publicVariant(db,id) {
  if(!validId(id)) return null;
  return db.prepare(`SELECT v.id,v.sku,v.color,v.configuration,v.price,v.on_hand-v.reserved AS stock,
    p.id AS product_id,p.name,p.category_id,p.category,p.brand,
    (SELECT storage_key FROM product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) AS image_key
    FROM product_variants v JOIN products p ON p.id=v.product_id
    WHERE v.id=? AND v.active=1 AND v.price>0 AND p.status='ACTIVE' AND p.category_id IS NOT NULL`).get(Number(id))||null;
}
function readComparison(db,raw) {
  const input=Array.isArray(raw)?raw:[],variants=[];
  for(const id of input) {
    if(variants.length===3) break;
    const variant=publicVariant(db,id);
    if(!variant||variants.some(item=>item.id===variant.id)||(variants.length&&variant.category_id!==variants[0].category_id)) continue;
    variants.push(variant);
  }
  const ids=variants.map(item=>item.id);
  return {ids,variants,removed:JSON.stringify(ids)!==JSON.stringify(input)};
}
function changeComparison(db,raw,action,id) {
  const current=readComparison(db,raw),result=(status,message,ids=current.ids)=>({status,message,ids});
  if(action==='clear') return result(200,'Đã xóa danh sách so sánh.',[]);
  if(!['add','remove'].includes(action)||!validId(id)) return result(400,'SKU hoặc thao tác so sánh không hợp lệ.');
  const numericId=Number(id);
  if(action==='remove') return result(200,'Đã bỏ SKU khỏi so sánh.',current.ids.filter(value=>value!==numericId));
  const variant=publicVariant(db,numericId);
  if(!variant) return result(404,'SKU không còn được công bố để so sánh.');
  if(current.ids.includes(numericId)) return result(200,'SKU đã có trong danh sách so sánh.');
  if(current.variants.length&&current.variants[0].category_id!==variant.category_id) return result(409,'Chỉ so sánh các SKU cùng danh mục. Hãy xóa danh sách hiện tại để đổi danh mục.');
  if(current.ids.length===3) return result(409,'Chỉ được so sánh tối đa 3 SKU. Hãy bỏ một SKU trước khi thêm.');
  return result(200,'Đã thêm SKU vào so sánh.',[...current.ids,numericId]);
}
function attributeValue(definition) {
  const value=definition.data_type==='NUMBER'?definition.value_number:definition.data_type==='BOOLEAN'?definition.value_boolean:definition.value_text;
  return value??null;
}
function comparisonTable(db,raw) {
  const selection=readComparison(db,raw);
  if(!selection.variants.length) return {...selection,attributes:[]};
  const values=selection.variants.map(variant=>getAttributes(db,variant.id));
  const attributes=values[0].map((definition,index)=>{
    const cells=values.map(list=>attributeValue(list[index]));
    return {id:definition.id,label:definition.label,data_type:definition.data_type,unit:definition.unit,values:cells,different:new Set(cells.map(value=>JSON.stringify(value))).size>1};
  });
  return {...selection,attributes};
}
module.exports={publicVariant,readComparison,changeComparison,comparisonTable};
