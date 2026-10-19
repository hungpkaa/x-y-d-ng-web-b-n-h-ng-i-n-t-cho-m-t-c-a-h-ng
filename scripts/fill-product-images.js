const {mkdirSync,existsSync,readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const sharp=require('sharp');
const {defaultDatabase}=require('../src/db');
const {transaction}=require('../src/products');
const entries=require('../fixtures/catalog/existing-product-images.json');
async function main(){
  const directory=join(__dirname,'../data/catalog-import/existing-images');
  mkdirSync(directory,{recursive:true});
  const prepared=[];
  for(const [index,entry] of entries.entries()){
    const images=[];
    for(const [order,path] of entry.images.entries()){
      // Skip promotional composites containing configuration text; the original
      // products do not have sufficiently specific model identifiers for those.
      if(['MacBook Air M3','ASUS Vivobook 15'].includes(entry.name)&&order===0)continue;
      const url='https://cdn2.cellphones.com.vn/insecure/rs:fit:1000:1000/q:90/plain/https://cellphones.com.vn/media/catalog/product/'+path;
      const file=join(directory,`${index}-${order}.webp`);
      if(!existsSync(file)){
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error(`Image ${index}-${order}: HTTP ${response.status}`);
        const input=Buffer.from(await response.arrayBuffer());
        if(input.length>5*1024*1024)throw new Error('Image too large');
        const data=await sharp(input,{limitInputPixels:20000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
        writeFileSync(file,data);
      }
      const data=readFileSync(file);
      await sharp(data).metadata();
      images.push({data,url});
    }
    prepared.push({...entry,images});
  }
  if(process.argv.includes('--download-only')){console.log(`Ready: ${prepared.reduce((n,p)=>n+p.images.length,0)} local WebP images.`);return;}
  const db=defaultDatabase();
  try{
    console.log(JSON.stringify(transaction(db,()=>{
      let products=0,images=0;
      for(const entry of prepared){
        const product=db.prepare('SELECT id FROM products WHERE name=?').get(entry.name);
        if(!product||db.prepare('SELECT id FROM product_images WHERE product_id=? LIMIT 1').get(product.id))continue;
        entry.images.forEach((image,order)=>{
          db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)').run(product.id,`catalog-original-${product.id}-${order}.webp`,image.data,`${entry.name} — ảnh tham khảo ${order+1}`,order);
          images++;
        });
        db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(product.id);
        db.prepare('INSERT INTO audit_logs(action,entity_type,entity_id,after_json) VALUES(?,?,?,?)').run('FILL_PRODUCT_IMAGES','product',product.id,JSON.stringify({source:entry.source,images:entry.images.map(i=>i.url),reference:true}));
        products++;
      }
      return {products,images,missing:db.prepare('SELECT id,name FROM products WHERE NOT EXISTS(SELECT 1 FROM product_images WHERE product_id=products.id)').all()};
    })));
  }finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
