const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {defaultDatabase}=require('../src/db');
const {importDemoCatalog}=require('../src/demo-catalog');
const products=[...require('../fixtures/catalog/products.json'),...require('../fixtures/catalog/extra-products.json')];
const db=defaultDatabase();
try {
  console.log(JSON.stringify(importDemoCatalog(db,products,(id,index)=>{
    const buffer=readFileSync(join(__dirname,`../data/catalog-import/images/${id}-${index}.webp`));
    if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP') throw new Error('Ảnh không hợp lệ');
    return buffer;
  })));
} finally {db.close();}
