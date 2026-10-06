function migrateCatalogContent(db) {
  db.exec(`CREATE TABLE product_images(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),storage_key TEXT NOT NULL UNIQUE,data BLOB NOT NULL,mime TEXT NOT NULL DEFAULT 'image/webp',alt_text TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order>=0));
    CREATE INDEX images_product_idx ON product_images(product_id,sort_order,id);
    CREATE TABLE attribute_definitions(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL REFERENCES categories(id),code TEXT NOT NULL,label TEXT NOT NULL,data_type TEXT NOT NULL CHECK(data_type IN ('TEXT','NUMBER','BOOLEAN')),unit TEXT NOT NULL DEFAULT '',required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),version INTEGER NOT NULL DEFAULT 1,UNIQUE(category_id,code));
    CREATE TABLE variant_attribute_values(id INTEGER PRIMARY KEY,variant_id INTEGER NOT NULL REFERENCES product_variants(id),attribute_id INTEGER NOT NULL REFERENCES attribute_definitions(id),value_text TEXT,value_number REAL,value_boolean INTEGER CHECK(value_boolean IN (0,1)),UNIQUE(variant_id,attribute_id),CHECK((value_text IS NOT NULL)+(value_number IS NOT NULL)+(value_boolean IS NOT NULL)=1));
    CREATE INDEX attributes_category_idx ON attribute_definitions(category_id);
    CREATE INDEX values_variant_idx ON variant_attribute_values(variant_id);`);
}
module.exports={migrateCatalogContent};
