function migratePromotionsReviews(db) {
  db.exec(`CREATE TABLE promotions(id INTEGER PRIMARY KEY,code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    kind TEXT NOT NULL CHECK(kind IN ('FIXED','PERCENT')),value INTEGER NOT NULL CHECK(value>0),cap INTEGER CHECK(cap>0),
    minimum INTEGER NOT NULL DEFAULT 0 CHECK(minimum>=0),scope TEXT NOT NULL CHECK(scope IN ('ALL','PRODUCT')),
    starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
    total_limit INTEGER NOT NULL CHECK(total_limit>0),user_limit INTEGER NOT NULL CHECK(user_limit>0 AND user_limit<=total_limit),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1,
    CHECK(kind='FIXED' OR (value<=100 AND cap IS NOT NULL)));
    CREATE TABLE promotion_products(promotion_id INTEGER NOT NULL REFERENCES promotions(id),product_id INTEGER NOT NULL REFERENCES products(id),PRIMARY KEY(promotion_id,product_id));
    CREATE TABLE promotion_redemptions(id INTEGER PRIMARY KEY,promotion_id INTEGER NOT NULL REFERENCES promotions(id),user_id INTEGER NOT NULL REFERENCES users(id),order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('HELD','USED','RELEASED')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX redemption_limit_idx ON promotion_redemptions(promotion_id,status,user_id);
    ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0 CHECK(discount>=0 AND (discount=0 OR discount<subtotal));
    ALTER TABLE orders ADD COLUMN promotion_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE checkout_requests ADD COLUMN promotion_id INTEGER REFERENCES promotions(id);
    ALTER TABLE checkout_requests ADD COLUMN promotion_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE checkout_requests ADD COLUMN discount INTEGER NOT NULL DEFAULT 0 CHECK(discount>=0);
    CREATE TABLE reviews(id INTEGER PRIMARY KEY,order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 2000),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','HIDDEN','REJECTED')),version INTEGER NOT NULL DEFAULT 1,moderator_id INTEGER REFERENCES users(id),moderation_reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX reviews_status_idx ON reviews(status,id);
  `);
}
module.exports={migratePromotionsReviews};
