const {mkdirSync,existsSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const sharp=require('sharp');
const products=[...require('../fixtures/catalog/products.json'),...require('../fixtures/catalog/extra-products.json')];
const directory=join(__dirname,'../data/catalog-import/images');
async function main() {
  mkdirSync(directory,{recursive:true});
  const queue=products.flatMap(p=>p.images.map((url,index)=>({url,file:join(directory,`${p.id}-${index}.webp`)})));
  let completed=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(queue.length) {
      const {url,file}=queue.shift();
      if(!existsSync(file)) {
        if(!['cdn.dummyjson.com','fakestoreapi.com'].includes(new URL(url).hostname)) throw new Error('Unexpected image host');
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
        if(!response.ok) throw new Error(`Image returned ${response.status}`);
        const input=Buffer.from(await response.arrayBuffer());
        if(input.length>5*1024*1024) throw new Error('Image too large');
        const output=await sharp(input,{limitInputPixels:20000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
        writeFileSync(file,output);
      }
      completed++;
    }
  }));
  console.log(`Ready: ${completed} local WebP images.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
