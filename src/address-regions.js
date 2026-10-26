const provinces=require('../public/vietnam-regions.json');
function addressParts(address='') {
  if(typeof address!=='string') address='';
  for(const province of provinces) {
    const suffix=', '+province.name;
    if(!address.endsWith(suffix)) continue;
    const local=address.slice(0,-suffix.length);
    for(const ward of province.wards) {
      const wardSuffix=', '+ward.name;
      if(local.endsWith(wardSuffix)) return {province_code:province.code,ward_code:ward.code,address_line:local.slice(0,-wardSuffix.length)};
    }
  }
  return {province_code:'',ward_code:'',address_line:address};
}
function resolveAddress(input) {
  if(!Object.hasOwn(input,'province_code')&&!Object.hasOwn(input,'ward_code')&&!Object.hasOwn(input,'address_line')) return typeof input.address==='string'?input.address.trim():'';
  const province=provinces.find(p=>p.code===input.province_code);
  const ward=province?.wards.find(w=>w.code===input.ward_code);
  const line=typeof input.address_line==='string'?input.address_line.trim():'';
  let message='';
  if(!province) message='Hãy chọn tỉnh/thành phố nhận hàng.';
  else if(!ward) message='Hãy chọn phường/xã thuộc tỉnh/thành phố đã chọn.';
  else if(line.length<3||line.length>200) message='Nhập số nhà và tên đường từ 3 đến 200 ký tự.';
  const address=ward?`${line}, ${ward.name}, ${province.name}`:'';
  if(!message&&address.length>300) message='Địa chỉ quá dài, vui lòng rút gọn số nhà và tên đường.';
  if(message) {const error=new Error(message);error.status=400;throw error;}
  return address;
}
function addressDraft(input) {
  return Object.fromEntries(['province_code','ward_code','address_line'].filter(key=>typeof input[key]==='string').map(key=>[key,input[key].slice(0,200)]));
}
module.exports={provinces,addressParts,resolveAddress,addressDraft};
