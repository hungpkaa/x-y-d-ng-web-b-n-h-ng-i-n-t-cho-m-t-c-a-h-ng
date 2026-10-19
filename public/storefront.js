'use strict';
document.querySelector('[data-print-invoice]')?.addEventListener('click',()=>window.print());
const checkoutOptions=document.querySelector('[data-checkout-options]');
if(checkoutOptions) {
  const choiceCards=document.querySelector('.payment-choice-cards');
  if(choiceCards) {
    choiceCards.hidden=false;
    checkoutOptions.elements.method.closest('label').hidden=true;
    choiceCards.querySelectorAll('[data-payment-choice]').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.paymentChoice===checkoutOptions.elements.method.value) return;
      checkoutOptions.elements.method.value=button.dataset.paymentChoice;
      checkoutOptions.requestSubmit();
    }));
  }
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
if(gallery) {
  const thumbnails=[...gallery.querySelectorAll('[data-image]')];
  const main=gallery.querySelector('.gallery-main');
  const dialog=gallery.querySelector('[data-gallery-dialog]');
  const large=gallery.querySelector('[data-gallery-large]');
  const opener=gallery.querySelector('[data-gallery-open]');
  let selected=0;
  const select=index=>{
    selected=(index+thumbnails.length)%thumbnails.length;
    const button=thumbnails[selected];
    main.src=button.dataset.image;main.alt=button.dataset.alt;
    thumbnails.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));
    const counter=gallery.querySelector('[data-gallery-counter]');
    if(counter) counter.textContent=(selected+1)+' / '+thumbnails.length;
    if(dialog?.open) {
      large.src=main.src;large.alt=main.alt;
      gallery.querySelector('[data-gallery-caption]').textContent='Ảnh '+(selected+1)+' / '+thumbnails.length+' · '+main.alt;
    }
  };
  thumbnails.forEach((button,index)=>button.addEventListener('click',()=>select(index)));
  gallery.querySelector('[data-gallery-controls]')?.removeAttribute('hidden');
  gallery.querySelectorAll('[data-gallery-prev],[data-gallery-next]').forEach(button=>{
    button.disabled=thumbnails.length<2;
    button.addEventListener('click',()=>select(selected+(button.hasAttribute('data-gallery-prev')?-1:1)));
  });
  if(dialog&&typeof dialog.showModal==='function'&&opener) {
    opener.hidden=false;
    opener.addEventListener('click',()=>{dialog.showModal();document.body.classList.add('gallery-modal-open');select(selected);});
    gallery.querySelector('[data-gallery-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{document.body.classList.remove('gallery-modal-open');opener.focus();});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();select(selected+(event.key==='ArrowLeft'?-1:1));}
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  }
  for(const surface of [main,large].filter(Boolean)) {
    let start=null;
    surface.addEventListener('touchstart',event=>{start=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
    surface.addEventListener('touchend',event=>{
      if(!start||!event.changedTouches.length)return;
      const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)select(selected+(dx<0?1:-1));
      start=null;
    },{passive:true});
    surface.addEventListener('touchcancel',()=>{start=null;},{passive:true});
  }
}
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
