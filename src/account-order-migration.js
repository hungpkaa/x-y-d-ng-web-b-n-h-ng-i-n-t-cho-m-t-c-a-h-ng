function migrateAccountsOrders(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','LOCKED'));
    ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE orders ADD COLUMN subtotal INTEGER NOT NULL DEFAULT 0 CHECK(subtotal>=0);
    ALTER TABLE orders ADD COLUMN shipping_fee INTEGER NOT NULL DEFAULT 0 CHECK(shipping_fee>=0);
    UPDATE orders SET subtotal=total;
    ALTER TABLE order_history ADD COLUMN previous_status TEXT;
    ALTER TABLE order_history ADD COLUMN note TEXT NOT NULL DEFAULT '';
    ALTER TABLE checkout_requests ADD COLUMN shipping_fee INTEGER NOT NULL DEFAULT 0 CHECK(shipping_fee>=0);
    CREATE TABLE shipping_policy(id INTEGER PRIMARY KEY CHECK(id=1),fee INTEGER NOT NULL CHECK(fee BETWEEN 0 AND 1000000),version INTEGER NOT NULL DEFAULT 1);
    INSERT INTO shipping_policy(id,fee) VALUES(1,0);
    CREATE TABLE cod_receipts(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),actor_id INTEGER NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),reference TEXT NOT NULL UNIQUE,note TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX users_role_status_idx ON users(role,status,id);
    CREATE INDEX orders_user_created_idx ON orders(user_id,created_at,id);
    CREATE INDEX orders_status_created_idx ON orders(status,created_at,id);
  `);
}
module.exports={migrateAccountsOrders};
