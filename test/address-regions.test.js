const {test}=require('node:test');
const assert=require('node:assert/strict');
const {provinces,addressParts,resolveAddress,addressDraft}=require('../src/address-regions');
const ejs=require('ejs');
const path=require('node:path');
test('region snapshot has complete linked codes and round-trips canonical addresses',()=>{
  assert.equal(provinces.length,34);
  assert.equal(new Set(provinces.map(p=>p.code)).size,34);
  for(const province of provinces) {
    assert.ok(province.wards.length>0);
    assert.equal(new Set(province.wards.map(w=>w.code)).size,province.wards.length);
    const input={province_code:province.code,ward_code:province.wards[0].code,address_line:'25 Nguyễn Huệ, tầng 2'};
    assert.deepEqual(addressParts(resolveAddress(input)),input);
  }
});
test('server rejects missing, forged and cross-province selections; ignores forged full address',()=>{
  const province=provinces[0],other=provinces[1];
  const valid={province_code:province.code,ward_code:province.wards[0].code,address_line:'25 Nguyễn Huệ'};
  assert.equal(resolveAddress({...valid,address:'Forged city'}),`25 Nguyễn Huệ, ${province.wards[0].name}, ${province.name}`);
  for(const input of [{...valid,province_code:''},{...valid,ward_code:other.wards[0].code},{...valid,ward_code:''},{...valid,address_line:' '},{...valid,province_code:[province.code]}]) {
    assert.throws(()=>resolveAddress(input),error=>error.status===400);
  }
  assert.equal(resolveAddress({address:'  Địa chỉ cũ, Hà Nội  '}),'Địa chỉ cũ, Hà Nội');
  assert.deepEqual(addressParts('Địa chỉ cũ, Hà Nội'),{province_code:'',ward_code:'',address_line:'Địa chỉ cũ, Hà Nội'});
});
test('draft retains partial selection and template preserves existing and optional addresses',async()=>{
  const draft=addressDraft({province_code:provinces[0].code,ward_code:'',address_line:'25 Nguyễn Huệ',recipient:'Ignored'});
  assert.equal(draft.ward_code,'');assert.equal(draft.recipient,undefined);
  const render=optional=>ejs.renderFile(path.join(__dirname,'../views/regional-address-fields.ejs'),{addressParts,addressProvinces:provinces,value:'Địa chỉ cũ, Hà Nội',draft,optional});
  const html=await render(false);
  assert.match(html,/data-address-picker hidden disabled/);
  assert.match(html,/Địa chỉ cũ, Hà Nội/);
  assert.match(html,/name="province_code"/);assert.match(html,/name="ward_code"/);
  const optional=await render(true);
  assert.doesNotMatch(optional,/<textarea[^>]*required/);
});
