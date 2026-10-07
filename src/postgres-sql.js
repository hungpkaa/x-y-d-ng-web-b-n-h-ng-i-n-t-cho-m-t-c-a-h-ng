// The domain services currently use SQLite-style placeholders. Only syntax is
// translated here; values always remain separate PostgreSQL parameters.
function translate(sql) {
  const ignore=/INSERT OR IGNORE INTO/i.test(sql);
  sql=sql.replace(/\bINSERT OR IGNORE INTO\b/gi,'INSERT INTO');
  if (ignore) sql=sql.replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
  sql=sql.replace(/date\(([\w.]+),'\+7 hours'\)/g,"to_char(($1)::timestamp + interval '7 hours','YYYY-MM-DD')");
  sql=sql.replace('MAX(d.delivered_at,p.paid_at)','GREATEST(d.delivered_at,p.paid_at)');
  sql=sql.replace("MAX((SELECT MIN(created_at) FROM order_history WHERE order_id=? AND status='DELIVERED'),(SELECT MIN(occurred_at) FROM payments WHERE order_id=? AND status='SUCCEEDED'))",
    "(SELECT CASE WHEN COUNT(v)=2 THEN MAX(v) END FROM (VALUES ((SELECT MIN(created_at) FROM order_history WHERE order_id=? AND status='DELIVERED')),((SELECT MIN(occurred_at) FROM payments WHERE order_id=? AND status='SUCCEEDED'))) AS recognition(v))");
  // SQLite permits an ungrouped item name; PostgreSQL requires it explicitly.
  sql=sql.replace('GROUP BY i.product_id,i.sku_snapshot ORDER BY','GROUP BY i.product_id,i.sku_snapshot,i.name ORDER BY');
  const parts=sql.split(/('(?:''|[^'])*'|"(?:""|[^"])*")/g);
  let index=0;
  return parts.map((part,i)=>i%2 ? part : part
    .replace(/\?/g,()=>`$${++index}`)
    .replace(/\bLIKE\b/g,'ILIKE')
    .replace(/\binstr\s*\(/g,'strpos(')
    .replace(/\bCURRENT_TIMESTAMP\b/g,"to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')")
    // Preserve the camelCase column aliases used by the report view.
    .replace(/\b(?:newOrders|deliveredOrders|recognizedOrders|onlineCash)\b/g,name=>`"${name}"`)
  ).join('');
}
module.exports={translate};
