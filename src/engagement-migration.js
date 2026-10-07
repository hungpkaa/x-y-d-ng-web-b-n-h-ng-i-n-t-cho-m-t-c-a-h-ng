function migrateEngagement(db) {
  db.exec(`CREATE TABLE favorites(user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,product_id));
  CREATE TABLE recent_products(user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,product_id));
  CREATE TABLE notification_preferences(user_id INTEGER PRIMARY KEY REFERENCES users(id),orders_enabled INTEGER NOT NULL DEFAULT 1 CHECK(orders_enabled IN (0,1)),history_cursor INTEGER NOT NULL DEFAULT 0 CHECK(history_cursor>=0),version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE product_watches(user_id INTEGER NOT NULL REFERENCES users(id),variant_id INTEGER NOT NULL REFERENCES product_variants(id),stock_enabled INTEGER NOT NULL CHECK(stock_enabled IN (0,1)),price_enabled INTEGER NOT NULL CHECK(price_enabled IN (0,1)),last_stock INTEGER NOT NULL,last_price INTEGER NOT NULL,PRIMARY KEY(user_id,variant_id));
  CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),event_key TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('ORDER','RESTOCK','PRICE')),title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,event_key));
  CREATE INDEX favorites_user_idx ON favorites(user_id,created_at);
  CREATE INDEX recent_user_idx ON recent_products(user_id,viewed_at);
  CREATE INDEX notifications_user_idx ON notifications(user_id,is_read,id);
  INSERT INTO notification_preferences(user_id,history_cursor) SELECT u.id,COALESCE((SELECT MAX(h.id) FROM order_history h JOIN orders o ON o.id=h.order_id WHERE o.user_id=u.id),0) FROM users u WHERE u.role='CUSTOMER';`);
}
module.exports={migrateEngagement};
