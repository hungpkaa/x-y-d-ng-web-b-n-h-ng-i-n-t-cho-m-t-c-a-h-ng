'use strict';
document.querySelector('[data-print-invoice]')?.addEventListener('click',()=>window.print());
const checkoutOptions=document.querySelector('[data-checkout-options]');
if(checkoutOptions) {
  checkoutOptions.addEventListener('submit',()=>{
    const delivery=document.getElementById('place-order-form');
    for(const [source,target] of [['recipient','recipient'],['phone','phone'],['address','delivery_address']]) {
      let input=checkoutOptions.querySelector('input[name="'+target+'"]');
      if(!input){input=document.createElement('input');input.type='hidden';input.name=target;checkoutOptions.append(input);}
      input.value=delivery?.elements[source]?.value||'';
    }
  });
  checkoutOptions.elements.method.addEventListener('change',()=>checkoutOptions.requestSubmit());
}

document.querySelectorAll('[data-password-toggle]').forEach(button=>{
  const input=document.getElementById(button.getAttribute('aria-controls'));
  if(!input) return;
  button.hidden=false;
  button.addEventListener('click',()=>{
    const reveal=input.type==='password';
    input.type=reveal?'text':'password';
    button.textContent=reveal?'Ẩn':'Hiện';
    button.setAttribute('aria-pressed',String(reveal));
    button.setAttribute('aria-label',reveal?'Ẩn mật khẩu':'Hiện mật khẩu');
  });
  button.setAttribute('aria-label','Hiện mật khẩu');
  const caps=document.getElementById('caps-lock-hint');
  if(caps) {
    const update=event=>{caps.hidden=!event.getModifierState?.('CapsLock');};
    input.addEventListener('keydown',update);input.addEventListener('keyup',update);
    input.addEventListener('blur',()=>{caps.hidden=true;});
  }
});
document.querySelectorAll('form[method="post"]').forEach(form=>{
  form.addEventListener('submit',event=>{
    if(form.dataset.submitting==='1'){event.preventDefault();return;}
    if(!form.checkValidity()) return;
    form.dataset.submitting='1';form.setAttribute('aria-busy','true');
    if(event.submitter){event.submitter.dataset.label=event.submitter.textContent;event.submitter.textContent='Đang xử lý…';}
  });
});
window.addEventListener('pageshow',()=>document.querySelectorAll('form[aria-busy]').forEach(form=>{
  form.removeAttribute('aria-busy');delete form.dataset.submitting;
  form.querySelectorAll('[data-label]').forEach(b=>{b.textContent=b.dataset.label;delete b.dataset.label;});
}));
const gallery=document.querySelector('[data-gallery]');
if(gallery) gallery.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{
  const main=gallery.querySelector('.gallery-main');main.src=button.dataset.image;main.alt=button.dataset.alt;
  gallery.querySelectorAll('[data-image]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
const filters=document.querySelector('.catalog-filter-panel');
if(filters&&window.matchMedia('(max-width:600px)').matches) filters.open=false;

const differenceToggle=document.querySelector('[data-compare-differences]');
const comparisonTable=document.querySelector('[data-comparison-table]');
if(differenceToggle&&comparisonTable) {
  differenceToggle.closest('label').hidden=false;
  const rows=[...comparisonTable.querySelectorAll('tbody tr')];
  const status=document.querySelector('[data-compare-status]');
  differenceToggle.addEventListener('change',()=>{
    let visible=0;
    rows.forEach(row=>{
      row.hidden=differenceToggle.checked&&!row.classList.contains('is-different');
      if(!row.hidden) visible++;
    });
    if(status) {
      status.hidden=false;
      status.textContent=differenceToggle.checked
        ?(visible?'Đang hiển thị '+visible+' thông tin khác nhau.':'Các cấu hình không có khác biệt trong những thông tin đã cung cấp.')
        :'Đang hiển thị toàn bộ thông tin so sánh.';
    }
  });
}
