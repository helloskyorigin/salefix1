import test from 'node:test';
import assert from 'node:assert/strict';

test('description textarea updates live counter, enforces 500-character limit and survives retry',async()=>{
  const events={},app={innerHTML:''},counter={textContent:'0/500'};
  let sent;
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(name,fn){events[name]=fn;}};
  globalThis.document={
    title:'',body:{dataset:{}},
    querySelector(sel){if(sel==='#app')return app;if(sel==='#product-description-count')return counter;return null;},
    getElementById(){return null;},
    addEventListener(name,fn){events[name]=fn;}
  };
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(k){return this.values[k];}};
  globalThis.fetch=async(_url,opts)=>{
    sent=JSON.parse(opts.body);
    return {ok:false,status:502,json:async()=>({error:'Product website timed out.'})};
  };
  await import('../app.js?description-counter-test');
  assert.match(app.innerHTML,/name="manual" maxlength="500"/);
  const field={id:'product-description',value:'X'.repeat(531)};
  events.input({target:field});
  assert.equal(field.value.length,500);
  assert.equal(counter.textContent,'500/500');
  events.submit({target:{id:'analyze-form',values:{url:'https://example.com/product',manual:field.value}},preventDefault(){}});
  for(let n=0;n<6;n++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(sent.manual.length,500);
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Product website timed out/);
  assert.match(app.innerHTML,/500\/500/);
  assert.match(app.innerHTML,/X{200,}/);
});

test('description is optional when URL or uploaded product is supplied',async()=>{
  const events={},app={innerHTML:''};
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(){}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){return s==='#app'?app:null;},getElementById(){return null;},addEventListener(n,fn){events[n]=fn;}};
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(k){return this.values[k]}};
  let sent;
  globalThis.fetch=async(_url,opts)=>{
    sent=JSON.parse(opts.body);
    return {ok:true,json:async()=>({product:{title:'Example',url:sent.url},issues:[]})};
  };
  await import('../app.js?description-optional-test');
  events.submit({target:{id:'analyze-form',values:{url:'https://example.com/',manual:''}},preventDefault(){}});
  for(let n=0;n<5;n++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(sent.manual,'');
  assert.equal(location.hash,'#/results');
});
