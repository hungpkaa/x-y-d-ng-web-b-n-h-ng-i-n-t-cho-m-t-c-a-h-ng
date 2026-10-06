function migrateSkus(db) {
  db.exec(`ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('DRAFT','ACTIVE','HIDDEN'));
    ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    UPDATE products SET status=CASE WHEN active=1 THEN 'ACTIVE' ELSE 'HIDDEN' END;
    CREATE TABLE product_variants(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),sku TEXT NOT NULL UNIQUE,color TEXT NOT NULL DEFAULT '',configuration TEXT NOT NULL DEFAULT '',price INTEGER CHECK(price>0 AND price<=1000000000),on_hand INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1,CHECK(on_hand>=reserved AND reserved>=0 AND on_hand<=1000000),CHECK(active=0 OR price IS NOT NULL));
    CREATE INDEX variants_product_idx ON product_variants(product_id,active);
    ALTER TABLE order_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id);
    ALTER TABLE order_items ADD COLUMN sku_snapshot TEXT NOT NULL DEFAULT '';
    ALTER TABLE order_items ADD COLUMN configuration_snapshot TEXT NOT NULL DEFAULT '';
    CREATE TABLE inventory_reservations(id INTEGER PRIMARY KEY,order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id),variant_id INTEGER NOT NULL REFERENCES product_variants(id),quantity INTEGER NOT NULL CHECK(quantity>0),status TEXT NOT NULL CHECK(status IN ('HELD','RELEASED','CONSUMED')));
    CREATE TABLE inventory_movements(id INTEGER PRIMARY KEY,variant_id INTEGER NOT NULL REFERENCES product_variants(id),actor_id INTEGER REFERENCES users(id),on_hand_delta INTEGER NOT NULL,reserved_delta INTEGER NOT NULL,source_key TEXT NOT NULL UNIQUE,reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE audit_logs(id INTEGER PRIMARY KEY,actor_id INTEGER REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id INTEGER NOT NULL,before_json TEXT,after_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX movements_variant_idx ON inventory_movements(variant_id,id);`);
  for (const product of db.prepare('SELECT * FROM products ORDER BY id').all()) {
    const held=db.prepare("SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.status IN ('PENDING','CONFIRMED','PREPARING')").get(product.id).n;
    const variantId=Number(db.prepare('INSERT INTO product_variants(product_id,sku,configuration,price,on_hand,reserved,active) VALUES(?,?,?,?,?,?,?)').run(product.id,`LEGACY-${product.id}`,product.description,product.price,product.stock+held,held,product.active).lastInsertRowid);
    db.prepare('UPDATE order_items SET variant_id=?,sku_snapshot=?,configuration_snapshot=? WHERE product_id=?').run(variantId,`LEGACY-${product.id}`,product.description,product.id);
    for (const item of db.prepare('SELECT i.id,i.quantity,o.status FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=?').all(product.id)) {
      const status=item.status==='CANCELLED'?'RELEASED':['SHIPPING','DELIVERED'].includes(item.status)?'CONSUMED':'HELD';
      db.prepare('INSERT INTO inventory_reservations(order_item_id,variant_id,quantity,status) VALUES(?,?,?,?)').run(item.id,variantId,item.quantity,status);
    }
    db.prepare('INSERT INTO inventory_movements(variant_id,on_hand_delta,reserved_delta,source_key,reason) VALUES(?,?,?,?,?)').run(variantId,product.stock+held,held,`migration:sku:${variantId}`,'Số dư chuyển đổi từ sản phẩm cũ');
  }
}
module.exports={migrateSkus};
