const { transaction } = require('./products');
const { actorUser, reject } = require('./accounts');
const { getVariant } = require('./orders');
const { createHash } = require('node:crypto');

function cartForUser(db, userId) {
  return db.prepare('SELECT id,version FROM carts WHERE user_id=?').get(userId);
}
function pendingRows(db,cartId) {
  return cartId ? db.prepare("SELECT id,pending_json FROM cart_merges WHERE cart_id=? AND pending_json<>'{}'").all(cartId) : [];
}
function pendingQuantities(db,cartId) {
  const pending={};
  for(const row of pendingRows(db,cartId)) for(const [id,q] of Object.entries(JSON.parse(row.pending_json))) pending[id]=(pending[id]||0)+q;
  return pending;
}
function clearPending(db,cartId,variantId) {
  for(const row of pendingRows(db,cartId)) {
    const pending=JSON.parse(row.pending_json);
    if(Object.hasOwn(pending,String(variantId))) {delete pending[variantId];db.prepare('UPDATE cart_merges SET pending_json=? WHERE id=?').run(JSON.stringify(pending),row.id);}
  }
}
function resultForUser(db, userId) {
  const cart = cartForUser(db, userId);
  const rows = cart ? db.prepare('SELECT variant_id,quantity FROM cart_items WHERE cart_id=? ORDER BY variant_id').all(cart.id) : [];
  const pending=pendingQuantities(db,cart?.id);
  const quantities=Object.fromEntries(rows.map(row=>[String(row.variant_id),row.quantity]));
  for(const [id,q] of Object.entries(pending)) quantities[id]=(quantities[id]||0)+q;
  const items = Object.entries(quantities).map(([id,quantity]) => {
    const row={variant_id:Number(id),quantity};
    const variant = getVariant(db, row.variant_id);
    const publicSku = variant?.product_status === 'ACTIVE' && variant.active && variant.price > 0;
    const purchasable = Boolean(publicSku && variant.stock >= row.quantity && !pending[id]);
    return {
      variantId: row.variant_id, quantity: row.quantity,
      name: publicSku ? variant.name : 'SKU không còn bán',
      sku: publicSku ? variant.sku : null,
      color: publicSku ? variant.color : '', configuration: publicSku ? variant.configuration : '',
      needsAdjustment: Boolean(pending[id]),
      unitPrice: publicSku ? variant.price : null,
      available: publicSku ? variant.stock : 0,
      purchasable
    };
  });
  return {
    status: 200, cartId: cart?.id ?? null, version: cart?.version ?? 0, items,
    quantities,
    subtotal: items.reduce((total, item) => total + (item.unitPrice ?? 0) * item.quantity, 0),
    canCheckout: items.length > 0 && items.every(item => item.purchasable)
  };
}
function readCart(db, actor) {
  return transaction(db, () => resultForUser(db, actorUser(db, actor, ['CUSTOMER']).id));
}
function updateCart(db, actor, input) {
  return transaction(db, () => {
    const user = actorUser(db, actor, ['CUSTOMER']);
    if (['user_id', 'cart_id', 'price', 'total', 'role'].some(key => input[key] !== undefined)) reject(403, 'Không được chỉ định chủ giỏ hoặc giá từ biểu mẫu.');
    const variantId = Number(input.variant_id), quantity = Number(input.quantity), version = Number(input.version);
    const action = input.action ?? 'set';
    if (!Number.isSafeInteger(variantId) || variantId <= 0 || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99 || !Number.isSafeInteger(version) || version < 0 || !['set', 'add'].includes(action)) reject(400, 'SKU, số lượng hoặc phiên bản giỏ không hợp lệ.');
    let cart = cartForUser(db, user.id);
    if ((cart?.version ?? 0) !== version) reject(409, 'Giỏ đã thay đổi. Hãy tải lại trước khi cập nhật.');
    const oldItem = cart && db.prepare('SELECT quantity FROM cart_items WHERE cart_id=? AND variant_id=?').get(cart.id, variantId);
    const hasPending=Boolean(pendingQuantities(db,cart?.id)[variantId]);
    if(hasPending&&action==='add') reject(409,'SKU đang chờ điều chỉnh sau gộp giỏ. Hãy cập nhật số lượng tại giỏ hàng.');
    const nextQuantity = action === 'add' ? (oldItem?.quantity ?? 0) + quantity : quantity;
    if (nextQuantity === 0) {
      if (oldItem || hasPending) {
        db.prepare('DELETE FROM cart_items WHERE cart_id=? AND variant_id=?').run(cart.id, variantId);
        clearPending(db,cart.id,variantId);
        db.prepare('UPDATE carts SET version=version+1 WHERE id=?').run(cart.id);
      }
      return resultForUser(db, user.id);
    }
    const variant = getVariant(db, variantId);
    if (!variant || variant.product_status !== 'ACTIVE' || !variant.active || !variant.price) reject(400, 'SKU không còn bán.');
    if (nextQuantity > 99 || nextQuantity > variant.stock) reject(400, 'Số lượng vượt tồn khả dụng hoặc giới hạn 99.');
    if (cart && !oldItem && db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart_id=?').get(cart.id).n >= 100) reject(400, 'Giỏ tối đa 100 dòng sản phẩm.');
    if (!cart) {
      db.prepare('INSERT INTO carts(user_id) VALUES(?)').run(user.id);
      cart = cartForUser(db, user.id);
    }
    db.prepare('INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES(?,?,?) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=excluded.quantity').run(cart.id, variantId, nextQuantity);
    clearPending(db,cart.id,variantId);
    db.prepare('UPDATE carts SET version=version+1 WHERE id=?').run(cart.id);
    return resultForUser(db, user.id);
  });
}
function mergeCart(db,actor,sourceKey,source) {
  return transaction(db,()=>{
    const user=actorUser(db,actor,['CUSTOMER']);
    if(typeof sourceKey!=='string'||!/^[a-f0-9]{64}$/.test(sourceKey)) reject(400,'Nguồn giỏ không hợp lệ.');
    const entries=Object.entries(source).sort((a,b)=>Number(a[0])-Number(b[0]));
    if(entries.length>100||entries.some(([id,q])=>!Number.isSafeInteger(Number(id))||Number(id)<=0||!Number.isSafeInteger(q)||q<1||q>99)) reject(400,'Giỏ nguồn không hợp lệ.');
    const hash=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    const old=db.prepare('SELECT m.*,c.user_id FROM cart_merges m JOIN carts c ON c.id=m.cart_id WHERE source_key=?').get(sourceKey);
    if(old) {
      if(old.user_id!==user.id||old.source_hash!==hash) reject(409,'Nguồn giỏ đã được xử lý cho nội dung khác.');
      return {...resultForUser(db,user.id),replayed:true};
    }
    if(!entries.length) return resultForUser(db,user.id);
    let cart=cartForUser(db,user.id);
    if(!cart) {db.prepare('INSERT INTO carts(user_id) VALUES(?)').run(user.id);cart=cartForUser(db,user.id);}
    const waiting=pendingQuantities(db,cart.id),pending={};
    let count=db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart_id=?').get(cart.id).n;
    for(const [id,q] of entries) {
      const current=db.prepare('SELECT quantity FROM cart_items WHERE cart_id=? AND variant_id=?').get(cart.id,Number(id));
      if(waiting[id]||(current?.quantity||0)+q>99||(!current&&count>=100)||!getVariant(db,Number(id))) {pending[id]=q;continue;}
      db.prepare('INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES(?,?,?) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=excluded.quantity').run(cart.id,Number(id),(current?.quantity||0)+q);
      if(!current) count++;
    }
    db.prepare('INSERT INTO cart_merges(cart_id,source_key,source_hash,pending_json) VALUES(?,?,?,?)').run(cart.id,sourceKey,hash,JSON.stringify(pending));
    db.prepare('UPDATE carts SET version=version+1 WHERE id=?').run(cart.id);
    return resultForUser(db,user.id);
  });
}
function consumeCartWork(db,userId,quantities) {
  const cart=cartForUser(db,userId);
  if(!cart) return;
  for(const [id,q] of Object.entries(quantities)) {
    const row=db.prepare('SELECT quantity FROM cart_items WHERE cart_id=? AND variant_id=?').get(cart.id,Number(id));
    if(!row||row.quantity<q) reject(409,'Giỏ đã thay đổi. Hãy xác nhận lại.');
    if(row.quantity===q) db.prepare('DELETE FROM cart_items WHERE cart_id=? AND variant_id=?').run(cart.id,Number(id));
    else db.prepare('UPDATE cart_items SET quantity=quantity-? WHERE cart_id=? AND variant_id=?').run(q,cart.id,Number(id));
  }
  db.prepare('UPDATE carts SET version=version+1 WHERE id=?').run(cart.id);
}
module.exports = { readCart, updateCart, mergeCart, resultForUser, consumeCartWork };
