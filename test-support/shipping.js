const { randomBytes } = require('node:crypto');
const { transitionOrder } = require('../src/orders');
const { createShipment, changeShipment } = require('../src/shipments');

// Exercise the real shipment services; never write order status directly.
function advanceOrder(db, id, status, actor, input = {}) {
  if (!['SHIPPING', 'DELIVERED'].includes(status)) return transitionOrder(db, id, status, actor, input);
  const manager = typeof actor === 'number' ? { id: actor } : actor;
  const proof = {
    occurred_at: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19),
    evidence_ref: `TEST-EVIDENCE-${id}`,
    reason: input.reason || 'Test fixture: verified carrier handling'
  };
  try {
    let shipment = db.prepare('SELECT * FROM shipments WHERE order_id=?').get(id);
    if (!shipment && status === 'SHIPPING') {
      const result = createShipment(db, manager, id, {
        version: input.version, provider: 'TEST CARRIER', tracking_number: `TEST-TRACK-${id}`, ...proof
      });
      if (result.status !== 200) return result;
      shipment = db.prepare('SELECT * FROM shipments WHERE id=?').get(result.id);
    }
    // Preserve invalid direct-transition checks when no shipment exists.
    if (!shipment) return transitionOrder(db, id, status, actor, input);
    return changeShipment(db, manager, shipment.id, {
      version: shipment.version, order_version: input.version,
      request_key: randomBytes(16).toString('hex'),
      status: status === 'SHIPPING' ? 'IN_TRANSIT' : 'DELIVERED', ...proof
    });
  } catch (error) {
    if (error.status) return { status: error.status, message: error.message };
    throw error;
  }
}
module.exports = { advanceOrder };
