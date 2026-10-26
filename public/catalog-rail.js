'use strict';
document.querySelectorAll('[data-catalog-group]').forEach(group=>{
  const rail=group.querySelector('[data-catalog-rail]');
  if(!rail) return;
  const status=group.querySelector('[data-catalog-status]');
  const retry=group.querySelector('[data-catalog-retry]');
  const previous=group.querySelector('[data-catalog-prev]');
  const next=group.querySelector('[data-catalog-next]');
  group.querySelector('[data-catalog-controls]').hidden=false;
  rail.classList.add('is-arrow-controlled');
  let loading=false,failed=false,targetLeft=null;
  const visited=new Set([new URL(location.href).href]);
  const maxScroll=()=>Math.max(0,rail.scrollWidth-rail.clientWidth);
  const updateControls=()=>{
    previous.disabled=rail.scrollLeft<=1;
    next.disabled=rail.scrollLeft>=maxScroll()-1&&(!rail.dataset.next||loading);
  };
  async function loadNext() {
    if(loading||!rail.dataset.next) return false;
    const url=new URL(rail.dataset.next,location.href);
    if(url.origin!==location.origin||visited.has(url.href)) return false;
    loading=true;failed=false;retry.hidden=true;updateControls();
    rail.setAttribute('aria-busy','true');
    status.textContent='Đang tải thêm sản phẩm…';
    try {
      const response=await fetch(url.href,{headers:{Accept:'text/html'}});
      if(!response.ok) throw new Error('Unable to load products');
      const page=new DOMParser().parseFromString(await response.text(),'text/html');
      const nextRail=[...page.querySelectorAll('[data-catalog-rail]')].find(item=>item.dataset.category===rail.dataset.category);
      const cards=nextRail?[...nextRail.children].filter(card=>card.classList.contains('product-card')):[];
      if(!cards.length) throw new Error('Missing product list');
      const existing=new Set([...rail.querySelectorAll('.product-art')].map(link=>link.getAttribute('href')));
      const fresh=cards.filter(card=>!existing.has(card.querySelector('.product-art')?.getAttribute('href')));
      if(!fresh.length) throw new Error('Repeated product list');
      rail.append(...fresh);
      visited.add(url.href);
      rail.dataset.next=nextRail.dataset.next||'';
      status.textContent=rail.dataset.next?'Đã tải thêm '+fresh.length+' sản phẩm.':'Đã tải tất cả sản phẩm trong danh mục.';
      return true;
    } catch {
      failed=true;status.textContent='Không tải được sản phẩm. Vui lòng thử lại.';retry.hidden=false;
      return false;
    } finally {
      loading=false;rail.removeAttribute('aria-busy');updateControls();
    }
  }
  const nearEnd=()=>{
    updateControls();
    if(!failed&&maxScroll()-rail.scrollLeft<Math.max(320,rail.clientWidth)) void loadNext();
  };
  async function move(direction) {
    if(direction>0&&rail.scrollLeft>=maxScroll()-1&&rail.dataset.next) {
      if(!await loadNext()) return;
    }
    const first=rail.children[0],second=rail.children[1];
    const step=second?second.offsetLeft-first.offsetLeft:(first?.getBoundingClientRect().width||240)+16;
    targetLeft=Math.max(0,Math.min(maxScroll(),(targetLeft??rail.scrollLeft)+direction*step));
    rail.scrollTo({left:targetLeft,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    updateControls();
  }
  previous.addEventListener('click',()=>void move(-1));
  next.addEventListener('click',()=>void move(1));
  rail.addEventListener('scroll',nearEnd,{passive:true});
  rail.addEventListener('scrollend',()=>{targetLeft=null;updateControls();});
  window.addEventListener('resize',()=>{targetLeft=null;nearEnd();});
  retry.addEventListener('click',()=>void loadNext());
  rail.addEventListener('keydown',event=>{
    if(event.target!==rail||!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();void move(event.key==='ArrowRight'?1:-1);
  });
  // Keep focused product links visible when navigating by Tab.
  rail.addEventListener('focusin',event=>{
    if(event.target===rail) return;
    targetLeft=null;
    event.target.closest('.product-card')?.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  nearEnd();
});
