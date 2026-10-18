function migrateCompletion(db) {
  db.exec(`
ALTER TABLE product_variants ADD COLUMN weight_grams INTEGER CHECK(weight_grams IS NULL OR weight_grams BETWEEN 1 AND 1000000);
ALTER TABLE checkout_requests ADD COLUMN shipping_quote_json TEXT;
ALTER TABLE orders ADD COLUMN shipping_quote_json TEXT;
CREATE TABLE shipping_regions(code TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
CREATE TABLE shipping_rates(id INTEGER PRIMARY KEY,region_code TEXT NOT NULL REFERENCES shipping_regions(code),min_grams INTEGER NOT NULL CHECK(min_grams>=0),max_grams INTEGER NOT NULL CHECK(max_grams>min_grams),fee INTEGER NOT NULL CHECK(fee BETWEEN 0 AND 1000000),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX shipping_rates_lookup ON shipping_rates(region_code,active,starts_at,ends_at);
CREATE TABLE integration_jobs(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','DONE','FAILED')),attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,lease_until INTEGER,lease_token TEXT,last_error TEXT,created_at INTEGER NOT NULL,completed_at INTEGER);
CREATE INDEX integration_jobs_ready ON integration_jobs(status,available_at,lease_until);
CREATE TABLE job_events(id INTEGER PRIMARY KEY,job_id INTEGER NOT NULL REFERENCES integration_jobs(id),status TEXT NOT NULL,occurred_at INTEGER NOT NULL);
CREATE TABLE payment_exceptions(id INTEGER PRIMARY KEY,payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),order_id INTEGER NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')),note TEXT,version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,resolved_by INTEGER REFERENCES users(id));
CREATE TABLE store_content(id INTEGER PRIMARY KEY CHECK(id=1),title TEXT NOT NULL,subtitle TEXT NOT NULL,contact TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
INSERT INTO store_content(id,title,subtitle) VALUES(1,'Công nghệ cho mọi ngày','Khám phá điện thoại, laptop và phụ kiện phù hợp với bạn.');
  `);
}
module.exports={migrateCompletion};
