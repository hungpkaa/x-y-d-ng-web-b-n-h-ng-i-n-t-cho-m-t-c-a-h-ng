'use strict';
document.querySelectorAll('[data-quantity-control]').forEach(control=>{
  const input=control.querySelector('input');
  const minus=control.querySelector('[data-quantity-minus]');
  const plus=control.querySelector('[data-quantity-plus]');
  minus.hidden=false;plus.hidden=false;
  const update=()=>{
    minus.disabled=input.value!==''&&Number(input.value)<=Number(input.min);
    plus.disabled=input.value!==''&&Number(input.value)>=Number(input.max);
  };
  const change=direction=>{
    const current=Number(input.value);
    const base=Number.isFinite(current)&&input.value!==''?current:Number(input.min);
    input.value=String(Math.min(Number(input.max),Math.max(Number(input.min),Math.trunc(base)+direction)));
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    update();
  };
  minus.addEventListener('click',()=>change(-1));
  plus.addEventListener('click',()=>change(1));
  input.addEventListener('input',update);
  input.addEventListener('change',update);
  update();
});
