function migrateCustomerServices(db) {
  db.exec(`CREATE TABLE addresses(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),label TEXT NOT NULL,recipient TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),version INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX addresses_user_idx ON addresses(user_id,id);
    CREATE UNIQUE INDEX addresses_default_idx ON addresses(user_id) WHERE is_default=1;
    INSERT INTO addresses(user_id,label,recipient,phone,address,is_default) SELECT id,'Địa chỉ cũ',name,phone,address,1 FROM users WHERE role='CUSTOMER' AND length(address) BETWEEN 10 AND 300 AND length(phone)=10 AND phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
    CREATE TABLE password_resets(user_id INTEGER PRIMARY KEY REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,auth_version INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE request_limits(key_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE support_requests(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),order_id INTEGER NOT NULL REFERENCES orders(id),subject TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),assigned_to INTEGER REFERENCES users(id),version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,closed_at TEXT);
    CREATE INDEX support_owner_idx ON support_requests(user_id,id);
    CREATE INDEX support_queue_idx ON support_requests(status,id);
    CREATE TABLE support_messages(id INTEGER PRIMARY KEY,request_id INTEGER NOT NULL REFERENCES support_requests(id),actor_id INTEGER NOT NULL REFERENCES users(id),content TEXT NOT NULL,internal INTEGER NOT NULL DEFAULT 0 CHECK(internal IN (0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX support_messages_request_idx ON support_messages(request_id,id);
    CREATE TABLE support_history(id INTEGER PRIMARY KEY,request_id INTEGER NOT NULL REFERENCES support_requests(id),actor_id INTEGER NOT NULL REFERENCES users(id),previous_status TEXT,status TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
}
module.exports={migrateCustomerServices};
