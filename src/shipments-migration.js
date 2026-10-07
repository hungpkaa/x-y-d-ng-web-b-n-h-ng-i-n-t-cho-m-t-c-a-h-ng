function migrateShipments(db) {
  db.exec(`CREATE TABLE shipments(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),provider TEXT NOT NULL,tracking_number TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK(mode='MANUAL'),status TEXT NOT NULL CHECK(status IN ('READY','IN_TRANSIT','DELIVERED','FAILED','RETURNED','CANCELLED')),cod_amount INTEGER NOT NULL CHECK(cod_amount>=0),version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(provider,tracking_number));
  CREATE TABLE shipment_events(id INTEGER PRIMARY KEY,shipment_id INTEGER NOT NULL REFERENCES shipments(id),event_key TEXT NOT NULL UNIQUE,actor_id INTEGER NOT NULL REFERENCES users(id),previous_status TEXT,status TEXT NOT NULL,evidence_ref TEXT NOT NULL,note TEXT NOT NULL,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,source TEXT NOT NULL DEFAULT 'USER' CHECK(source='USER'));
  CREATE INDEX shipment_status_idx ON shipments(status,id);
  CREATE INDEX shipment_events_idx ON shipment_events(shipment_id,id);`);
}
module.exports={migrateShipments};
