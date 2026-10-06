const sharp=require('sharp');
const { randomBytes }=require('node:crypto');
const { transaction }=require('./products');
function allowed(actor) {return ['STAFF','ADMIN'].includes(actor.role);}
function log(db,actor,action,id,after) {db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,after_json) VALUES(?,?,?,?,?)').run(actor.id??null,action,'image',id,JSON.stringify(after));}
async function addImage(db,actor,productId,input) {
  if(!allowed(actor)) return {status:403,message:'Bạn không có quyền tải ảnh.'};
  const alt=typeof input.alt==='string'?input.alt.trim():'';
  if(!alt||alt.length>120||typeof input.data!=='string'||input.data.length>Math.ceil(5*1024*1024/3)*4||!input.data.length||input.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) return {status:400,message:'Ảnh tối đa 5MB; cần mô tả ảnh tối đa 120 ký tự.'};
  const product=db.prepare('SELECT version FROM products WHERE id=?').get(productId);
  if(!product) return {status:404,message:'Không tìm thấy sản phẩm.'};
  if(Number(input.version)!==product.version) return {status:409,message:'Sản phẩm đã thay đổi. Hãy tải lại trang.'};
  let data;
  try {
    const buffer=Buffer.from(input.data,'base64');
    if(buffer.length>5*1024*1024) return {status:400,message:'Ảnh vượt 5MB.'};
    const raster=buffer.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))||buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP');
    if(!raster) return {status:400,message:'Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ.'};
    const image=sharp(buffer,{limitInputPixels:20000000,failOn:'warning'});
    const metadata=await image.metadata();
    if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1) return {status:400,message:'Chỉ nhận ảnh JPEG, PNG hoặc WebP tĩnh.'};
    data=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch {return {status:400,message:'Không đọc được ảnh hoặc ảnh quá lớn. Hãy chọn JPEG, PNG hoặc WebP hợp lệ.'};}
  return transaction(db,()=>{
    if(db.prepare('SELECT version FROM products WHERE id=?').get(productId)?.version!==product.version) return {status:409,message:'Sản phẩm đã thay đổi trong lúc xử lý ảnh. Hãy tải lại trang.'};
    if(db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id=?').get(productId).n>=10) return {status:400,message:'Mỗi sản phẩm tối đa 10 ảnh.'};
    const key=`${randomBytes(16).toString('hex')}.webp`;
    const order=db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM product_images WHERE product_id=?').get(productId).n;
    const id=Number(db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)').run(productId,key,data,alt,order).lastInsertRowid);
    db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(productId);
    log(db,actor,'ADD_IMAGE',id,{productId,key,alt});
    return {status:200,message:'Đã tải ảnh sản phẩm.',id};
  });
}
function changeImage(db,actor,productId,imageId,input,remove=false) {
  if(!allowed(actor)) return {status:403,message:'Bạn không có quyền sửa ảnh.'};
  return transaction(db,()=>{
    const product=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
    const image=db.prepare('SELECT id FROM product_images WHERE id=? AND product_id=?').get(imageId,productId);
    if(!product||!image) return {status:404,message:'Không tìm thấy ảnh.'};
    if(Number(input.version)!==product.version) return {status:409,message:'Sản phẩm đã thay đổi. Hãy tải lại trang.'};
    if(remove) {
      if(product.status==='ACTIVE'&&db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id=?').get(productId).n<=1) return {status:409,message:'Hãy ẩn sản phẩm trước khi xóa ảnh cuối cùng.'};
      db.prepare('DELETE FROM product_images WHERE id=?').run(imageId);
    } else {
      const alt=typeof input.alt==='string'?input.alt.trim():'',order=Number(input.sort_order);
      if(!alt||alt.length>120||!Number.isSafeInteger(order)||order<0||order>1000) return {status:400,message:'Mô tả hoặc thứ tự ảnh không hợp lệ.'};
      db.prepare('UPDATE product_images SET alt_text=?,sort_order=? WHERE id=?').run(alt,order,imageId);
    }
    db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(productId);
    log(db,actor,remove?'DELETE_IMAGE':'UPDATE_IMAGE',imageId,{productId});
    return {status:200,message:remove?'Đã xóa ảnh.':'Đã cập nhật ảnh.'};
  });
}
module.exports={addImage,changeImage};
