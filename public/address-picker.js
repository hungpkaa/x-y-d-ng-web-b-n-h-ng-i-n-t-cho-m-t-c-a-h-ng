'use strict';
(() => {
  const pickers=[...document.querySelectorAll('[data-regional-address]')];
  if(!pickers.length) return;
  fetch('/vietnam-regions.json').then(response=>{
    if(!response.ok) throw new Error('Missing regions');
    return response.json();
  }).then(provinces=>{
    for(const picker of pickers) {
      const fieldset=picker.querySelector('[data-address-picker]');
      const province=picker.querySelector('[data-address-province]');
      const ward=picker.querySelector('[data-address-ward]');
      const line=picker.querySelector('[name="address_line"]');
      const legacy=picker.querySelector('[name="address"]');
      const preview=picker.querySelector('[data-address-preview]');
      function update() {
        const required=picker.dataset.optional!=='1'||Boolean(province.value||ward.value||line.value.trim());
        for(const input of [province,ward,line]) input.required=required;
        const region=provinces.find(p=>p.code===province.value);
        const selected=region?.wards.find(w=>w.code===ward.value);
        const address=[line.value.trim(),selected?.name,region?.name].filter(Boolean).join(', ');
        legacy.value=address;
        preview.textContent=selected&&line.value.trim()?'Giao đến: '+address:'';
      }
      function populate(selected='') {
        const region=provinces.find(p=>p.code===province.value);
        ward.replaceChildren(new Option(region?'Chọn phường / xã':'Chọn tỉnh / thành phố trước',''));
        for(const item of region?.wards||[]) ward.add(new Option(item.name,item.code));
        ward.value=selected;ward.disabled=!region;
        update();
      }
      populate(ward.dataset.selected);
      province.addEventListener('change',()=>populate());
      ward.addEventListener('change',update);
      line.addEventListener('input',update);
      picker.querySelector('[data-address-fallback]').hidden=true;
      legacy.required=false;
      fieldset.disabled=false;fieldset.hidden=false;
      picker.closest('form')?.addEventListener('submit',update);
    }
  }).catch(()=>{
    for(const picker of pickers) picker.querySelector('[data-address-message]').textContent='Chưa tải được danh sách khu vực. Bạn có thể nhập địa chỉ đầy đủ hoặc tải lại trang để chọn khu vực.';
  });
})();
