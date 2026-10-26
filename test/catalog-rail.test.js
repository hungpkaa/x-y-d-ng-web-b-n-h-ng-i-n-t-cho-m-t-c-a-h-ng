const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ejs=require('ejs');
const source=fs.readFileSync(require.resolve('../public/catalog-rail.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function card(id) {
  const link={getAttribute:()=>'/products/'+id};
  return {offsetLeft:(id-1)*240,classList:{contains:name=>name==='product-card'},querySelector:()=>link,link};
}
function setup({count=20,next='/?category=Phone&q=phone&sort=price_asc&page=2',fetcher}={}) {
  const handlers={},windowHandlers={},status={},retry={hidden:true,addEventListener:(name,fn)=>{retry[name]=fn;}};
  const previous={addEventListener:(name,fn)=>{previous[name]=fn;}},nextButton={addEventListener:(name,fn)=>{nextButton[name]=fn;}},controls={hidden:true};
  const rail={dataset:{next,category:'Phone'},children:Array.from({length:count},(_,i)=>card(i+1)),clientWidth:1000,scrollWidth:4800,scrollLeft:0,
    addEventListener:(name,fn)=>{handlers[name]=fn;},setAttribute(){},removeAttribute(){},
    querySelectorAll(){return this.children.map(c=>c.link);},append(...cards){this.children.push(...cards);},classList:{add(){}},
    scrollTo(options){this.scrollLeft=options.left;}};
  const elements={'[data-catalog-rail]':rail,'[data-catalog-status]':status,'[data-catalog-retry]':retry,'[data-catalog-prev]':previous,'[data-catalog-next]':nextButton,'[data-catalog-controls]':controls};
  const group={querySelector:selector=>elements[selector]};
  let calls=0;
  const context={document:{querySelectorAll:()=>[group]},
    window:{addEventListener:(name,fn)=>{windowHandlers[name]=fn;},matchMedia:()=>({matches:true})},
    location:{href:'http://store.test/?q=phone&sort=price_asc',origin:'http://store.test'},URL,Set,
    fetch:async(url)=>{calls++;return fetcher(url,calls);},
    DOMParser:class{parseFromString(page){return {querySelectorAll:()=>page};}}};
  vm.runInNewContext(source,context);
  return {rail,handlers,windowHandlers,status,retry,previous,nextButton,controls,calls:()=>calls};
}
test('catalog separates categories into labelled rows with independent arrows',()=>{
  const template=fs.readFileSync(require.resolve('../views/catalog.ejs'),'utf8');
  for(const count of [0,1,13,20]) {
    const groups=count?['Phone','Laptop'].map(category=>({category,products:Array.from({length:count},(_,id)=>({id})),paging:{total:count,next:null}})):[];
    const html=ejs.render(template,{q:'phone',category:'',brand:'',min:'',max:'',catalogGroups:groups,paging:{total:count*2,page:1},
      include:name=>name==='product-card'?'<article class="product-card"></article>':name==='pagination'?'<nav>Trang sau</nav>':''});
    assert.equal((html.match(/<article/g)||[]).length,count*2);
    assert.equal((html.match(/data-catalog-group/g)||[]).length,count?2:0);
    if(count) {assert.match(html,/data-category="Phone"/);assert.match(html,/data-category="Laptop"/);assert.match(html,/data-catalog-prev/);}
    else assert.match(html,/Chưa tìm thấy/);
    assert.doesNotMatch(html,/Kéo ngang/);
  }
});
test('loading reaches 33 products without mixing categories or repeating requests',async()=>{
  let finish;
  const state=setup({fetcher:url=>{
    assert.match(url,/category=Phone&q=phone&sort=price_asc&page=2/);
    return new Promise(resolve=>{finish=()=>resolve({ok:true,text:async()=>[
      {children:[card(99)],dataset:{category:'Laptop',next:''}},
      {children:Array.from({length:13},(_,i)=>card(i+21)),dataset:{category:'Phone',next:''}}
    ]});});
  }});
  state.rail.scrollLeft=3500;state.handlers.scroll();state.handlers.scroll();
  assert.equal(state.calls(),1);finish();await tick();
  assert.equal(state.rail.children.length,33);
  assert.equal(state.rail.children.some(item=>item===99),false);
  state.handlers.scroll();assert.equal(state.calls(),1);
  state.rail.scrollLeft=3800;state.handlers.scroll();assert.equal(state.nextButton.disabled,true);
});
test('failed category load waits for retry',async()=>{
  const state=setup({fetcher:async(url,count)=>{
    if(count===1) throw new Error('offline');
    return {ok:true,text:async()=>[{children:[card(21)],dataset:{category:'Phone',next:''}}]};
  }});
  state.rail.scrollLeft=3500;state.handlers.scroll();await tick();
  assert.equal(state.retry.hidden,false);state.handlers.scroll();assert.equal(state.calls(),1);
  state.retry.click();await tick();assert.equal(state.rail.children.length,21);assert.equal(state.retry.hidden,true);
});
test('arrows move exactly one card per click including repeated clicks; left boundary is disabled',()=>{
  const state=setup({next:''});
  assert.equal(state.controls.hidden,false);assert.equal(state.previous.disabled,true);
  state.nextButton.click();assert.equal(state.rail.scrollLeft,240);
  state.nextButton.click();assert.equal(state.rail.scrollLeft,480);
  state.previous.click();assert.equal(state.rail.scrollLeft,240);
  state.previous.click();assert.equal(state.rail.scrollLeft,0);assert.equal(state.previous.disabled,true);
  state.handlers.keydown({target:{},key:'ArrowRight',preventDefault(){throw new Error('child key intercepted');}});
  state.handlers.keydown({target:state.rail,key:'ArrowRight',preventDefault(){}});assert.equal(state.rail.scrollLeft,240);
  assert.equal(state.handlers.pointerdown,undefined);
});
