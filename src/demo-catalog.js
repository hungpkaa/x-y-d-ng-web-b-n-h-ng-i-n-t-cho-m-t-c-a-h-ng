const {slugify}=require('./catalog');
const {publicationProblem}=require('./attributes');
const categoryNames={smartphones:'Điện thoại',laptops:'Laptop',tablets:'Tablet','mobile-accessories':'Phụ kiện','kitchen-appliances':'Điện gia dụng',monitors:'Màn hình',storage:'Thiết bị lưu trữ'};
function importDemoCatalog(db,products,imageFor) {
  // Validate all local assets before making any writes. A replay never alters a SKU,
  // price, reservation or image already managed by the store.
  const prepared=products.map(p=>{
    if(!categoryNames[p.category]||!p.images.length) throw new Error('Invalid catalog entry');
    return {...p,buffers:p.images.map((_,i)=>imageFor(p.id,i))};
  });
  const result={created:0,skipped:0,images:0,drafts:0};
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const p of prepared) {
      const sku=p.source==='fakestore'?`SAMPLE-FS-${p.id}`:`SAMPLE-DJ-${p.id}`;
      if(db.prepare('SELECT id FROM product_variants WHERE sku=?').get(sku)||db.prepare('SELECT id FROM products WHERE name=?').get(p.title)) {result.skipped++;continue;}
      let brand=({Asus:'ASUS',Oppo:'OPPO',Vivo:'vivo',Realme:'realme'})[p.brand]||p.brand||'Demo';
      const category=['Apple Airpods','Apple AirPods Max Silver','Beats Flex Wireless Earphones'].includes(p.title)?'Tai nghe':categoryNames[p.category];
      const ids=[];
      for(const [table,name] of [['categories',category],['brands',brand]]) {
        let entry=db.prepare(`SELECT id,active FROM ${table} WHERE LOWER(name)=LOWER(?)`).get(name);
        if(entry&&!entry.active) throw new Error(`Danh mục/hãng đã tắt: ${name}`);
        if(!entry) entry={id:Number(db.prepare(`INSERT INTO ${table}(name,slug) VALUES(?,?)`).run(name,slugify(name)).lastInsertRowid)};
        ids.push(entry.id);
      }
      brand=db.prepare('SELECT name FROM brands WHERE id=?').get(ids[1]).name;
      const price=Math.max(10000,Math.round(p.price*25000/10000)*10000);
      const description=`DỮ LIỆU MẪU — Giá và tồn kho phục vụ thử nghiệm website, không phải báo giá bán thực tế. ${p.description}`;
      const id=Number(db.prepare("INSERT INTO products(name,category,brand,description,price,stock,active,status,category_id,brand_id) VALUES(?,?,?,?,?,0,0,'DRAFT',?,?)").run(p.title,category,brand,description,price,...ids).lastInsertRowid);
      const variantId=Number(db.prepare("INSERT INTO product_variants(product_id,sku,configuration,price,on_hand,active) VALUES(?,?,?, ?,12,1)").run(id,sku,'Phiên bản mẫu theo bộ ảnh; thông số cấu hình cần xác minh trước khi bán thật.',price).lastInsertRowid);
      db.prepare('INSERT INTO inventory_movements(variant_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,12,0,?,?)').run(variantId,`sample:${p.source==='fakestore'?'fakestore':'dummyjson'}:${p.id}`,'Nhập tồn mẫu phục vụ phát triển giao diện');
      p.buffers.forEach((buffer,i)=>{
        db.prepare('INSERT INTO product_images(product_id,storage_key,data,alt_text,sort_order) VALUES(?,?,?,?,?)').run(id,`sample-dj-${p.id}-${i}.webp`,buffer,`${p.title} — ảnh ${i+1}`,i);
        result.images++;
      });
      const problem=publicationProblem(db,id);
      if(problem) result.drafts++;
      else db.prepare("UPDATE products SET status='ACTIVE',active=1 WHERE id=?").run(id);
      db.prepare('INSERT INTO audit_logs(action,entity_type,entity_id,after_json) VALUES(?,?,?,?)').run('IMPORT_SAMPLE_CATALOG','product',id,JSON.stringify({source:p.source==='fakestore'?`https://fakestoreapi.com/products/${p.id-10000}`:`https://dummyjson.com/products/${p.id}`,sample:true,images:p.images,publicationProblem:problem}));
      result.created++;
    }
    db.exec('COMMIT');return result;
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
module.exports={importDemoCatalog};
