import test from 'node:test';
import assert from 'node:assert/strict';

test('Analyze screen preserves inputs and shows manual fallback when a page is blocked',async()=>{
  const app={innerHTML:''},events={};
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(type,fn){events[type]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){if(s==='#app')return app;if(s==='#manual-details')return {open:false};return null;},addEventListener(type,fn){events[type]=fn;},getElementById(){return null;}};
  globalThis.sessionStorage={getItem(){return null;},removeItem(){},setItem(){}};
  globalThis.FormData=class {constructor(form){this.values=form.values;}get(k){return this.values[k];}};
  globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:'Product website timed out. Use manual details instead.'})});
  await import('../app.js?analyze-screen-test');
  assert.match(app.innerHTML,/aria-describedby="product-url-help"/);
  const values={url:'https://example.com/product',audience:'Creators',benefit:'Build a simple website',manual:'',productName:''};
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  for(let i=0;i<8;i++)await new Promise(done=>setTimeout(done,0));
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/role="alert"/);
  assert.match(app.innerHTML,/Product website timed out/);
  assert.match(app.innerHTML,/id="manual-details" class="manual-details" open/);
  assert.match(app.innerHTML,/value="Creators"/);
  assert.match(app.innerHTML,/Build a simple website/);
  let aborted=false;
  globalThis.fetch=async (_url,opts)=>new Promise((_resolve,reject)=>{
    opts.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));});
  });
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  assert.equal(location.hash,'#/loading');
  location.hash='#/analyze';events.hashchange();
  assert.equal(aborted,true);
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Analyze My Product/);
});
