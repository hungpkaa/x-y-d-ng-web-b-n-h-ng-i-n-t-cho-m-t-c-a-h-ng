// Add display-only media without changing price, availability or cart identity.
function withCartImages(db,items) {
  if(!items.length)return items;
  const ids=[...new Set(items.map(item=>Number(item.id)).filter(Number.isSafeInteger))];
  if(!ids.length)return items;
  const rows=db.prepare(`SELECT v.id,p.id AS product_id,
    (SELECT storage_key FROM product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) AS image_key
    FROM product_variants v JOIN products p ON p.id=v.product_id
    WHERE p.status='ACTIVE' AND v.id IN (${ids.map(()=>'?').join(',')})`).all(...ids);
  const lookup=new Map(rows.map(row=>[row.id,row]));
  return items.map(item=>{
    const row=lookup.get(Number(item.id));
    return {...item,image_key:row?.image_key??null,product_url:row?`/products/${row.product_id}?sku=${item.id}`:null};
  });
}
module.exports={withCartImages};
