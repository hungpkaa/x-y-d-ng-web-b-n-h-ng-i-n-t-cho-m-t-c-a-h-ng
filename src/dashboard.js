function dashboard(db,actor) {
  const stats={products:db.prepare('SELECT COUNT(*) n FROM products').get().n,
    drafts:db.prepare("SELECT COUNT(*) n FROM products WHERE status='DRAFT'").get().n,
    pending:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='PENDING'").get().n,
    preparing:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='PREPARING'").get().n,
    shipping:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='SHIPPING'").get().n,
    lowstock:db.prepare("SELECT COUNT(*) n FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.active=1 AND p.status='ACTIVE' AND v.on_hand-v.reserved<=5").get().n,
    tickets:db.prepare("SELECT COUNT(*) n FROM support_requests WHERE status IN ('OPEN','IN_PROGRESS')").get().n};
  return {stats,latestOrders:db.prepare('SELECT id,recipient,status,total,created_at FROM orders ORDER BY id DESC LIMIT 6').all(),report:actor.role==='ADMIN'?require('./reporting').salesReport(db):null};
}
module.exports={dashboard};
