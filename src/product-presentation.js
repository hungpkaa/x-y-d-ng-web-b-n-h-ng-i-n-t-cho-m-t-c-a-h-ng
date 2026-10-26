function productCardInfo(product) {
  const sample=String(product.description||'').startsWith('DỮ LIỆU MẪU');
  const configuration=String(product.card_configuration||'').trim();
  const specs=sample?[]:[...new Set(configuration.split(/[·|]/).map(value=>value.trim()).filter(Boolean))].slice(0,3);
  return {sample,specs};
}
module.exports={productCardInfo};
