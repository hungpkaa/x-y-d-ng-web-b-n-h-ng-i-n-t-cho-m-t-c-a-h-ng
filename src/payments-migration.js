function migratePayments(db) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_deadline INTEGER;
    ALTER TABLE orders ADD COLUMN recognition_at TEXT;
    ALTER TABLE checkout_requests ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'COD' CHECK(payment_method IN ('COD','ONLINE'));
    CREATE TABLE payments(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),provider TEXT NOT NULL CHECK(provider IN ('COD','VNPAY')),reference TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('PENDING','FAILED','EXPIRED','SUCCEEDED')),provider_transaction_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at INTEGER,occurred_at TEXT,evidence_ref TEXT,ip_address TEXT NOT NULL DEFAULT '127.0.0.1',UNIQUE(provider,provider_transaction_id));
    CREATE UNIQUE INDEX payments_pending_idx ON payments(order_id) WHERE status='PENDING';
    CREATE INDEX payments_order_idx ON payments(order_id,status);
    CREATE INDEX payments_occurred_idx ON payments(status,occurred_at);
    INSERT INTO payments(order_id,provider,reference,amount,status,occurred_at,evidence_ref,created_at) SELECT order_id,'COD','COD-'||id,amount,'SUCCEEDED',created_at,reference,created_at FROM cod_receipts;
    CREATE TABLE payment_events(id INTEGER PRIMARY KEY,payment_id INTEGER NOT NULL REFERENCES payments(id),event_key TEXT NOT NULL UNIQUE,response_code TEXT NOT NULL,transaction_status TEXT NOT NULL,outcome TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE refunds(id INTEGER PRIMARY KEY,payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),order_id INTEGER NOT NULL REFERENCES orders(id),actor_id INTEGER NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),reference TEXT NOT NULL UNIQUE,evidence_ref TEXT NOT NULL,note TEXT NOT NULL,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX refunds_occurred_idx ON refunds(occurred_at);
    CREATE TABLE order_history_new(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),actor_id INTEGER REFERENCES users(id),status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,previous_status TEXT,note TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'USER' CHECK(source IN ('USER','SYSTEM','PROVIDER')));
    INSERT INTO order_history_new(id,order_id,actor_id,status,created_at,previous_status,note) SELECT id,order_id,actor_id,status,created_at,previous_status,note FROM order_history;
    DROP TABLE order_history;
    ALTER TABLE order_history_new RENAME TO order_history;
    CREATE INDEX order_history_order_idx ON order_history(order_id,status,created_at);
    UPDATE orders SET recognition_at=(SELECT MAX((SELECT MIN(h.created_at) FROM order_history h WHERE h.order_id=orders.id AND h.status='DELIVERED'),r.created_at) FROM cod_receipts r WHERE r.order_id=orders.id) WHERE status='DELIVERED' AND payment_status='PAID';`);
}
module.exports={migratePayments};
