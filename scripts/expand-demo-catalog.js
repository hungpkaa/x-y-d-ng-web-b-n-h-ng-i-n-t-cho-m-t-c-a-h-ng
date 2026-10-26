// Refresh the additional, source-backed electronics fixture and prepare local images.
const {writeFileSync,mkdirSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const sharp=require('sharp');
const existing=require('../fixtures/catalog/products.json');
async function json(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
async function main() {
  const ids=new Set(existing.map(p=>p.id));
  const entries=[];
  for(const category of ['smartphones','tablets','mobile-accessories','kitchen-accessories']) {
    const {products}=await json(`https://dummyjson.com/products/category/${category}?limit=100`);
    for(const p of products) {
      if(ids.has(p.id)) continue;
      if(category==='mobile-accessories'&&![109,110,111].includes(p.id)) continue;
      if(category==='kitchen-accessories'&&![51,56,61,66].includes(p.id)) continue;
      entries.push({id:p.id,title:p.title,brand:p.brand||'Demo',category:category==='kitchen-accessories'?'kitchen-appliances':category,description:p.description,price:p.price,images:p.images.slice(0,2)});
    }
  }
  const electronics=await json('https://fakestoreapi.com/products/category/electronics');
  const brands={9:'Western Digital',10:'SanDisk',11:'Silicon Power',12:'Western Digital',13:'Acer',14:'Samsung'};
  for(const p of electronics) {
    if(!brands[p.id]) continue;
    entries.push({id:10000+p.id,source:'fakestore',title:p.title.trim(),brand:brands[p.id],category:p.id>=13?'monitors':'storage',description:p.description,price:p.price,images:[p.image]});
  }
  const directory=join(__dirname,'../data/catalog-import/images');
  mkdirSync(directory,{recursive:true});
  for(const p of entries) {
    for(const [index,url] of p.images.entries()) {
      if(!['cdn.dummyjson.com','fakestoreapi.com'].includes(new URL(url).hostname)) throw new Error('Unexpected image host');
      const file=join(directory,`${p.id}-${index}.webp`);
      if(existsSync(file)) continue;
      const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
      if(!response.ok) throw new Error(`Image HTTP ${response.status}: ${url}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>5*1024*1024) throw new Error('Image too large');
      const image=await sharp(bytes,{limitInputPixels:20000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
      writeFileSync(file,image);
    }
  }
  writeFileSync(join(__dirname,'../fixtures/catalog/extra-products.json'),JSON.stringify(entries,null,2)+'\n');
  console.log(JSON.stringify({products:entries.length,images:entries.reduce((n,p)=>n+p.images.length,0)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
