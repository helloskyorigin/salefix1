import test from 'node:test';
import assert from 'node:assert/strict';

test('Analyze is a two-input optional form and URL errors preserve the entry',async()=>{
  const app={innerHTML:''},events={};
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(type,fn){events[type]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){return s==='#app'?app:null;},addEventListener(type,fn){events[type]=fn;},getElementById(){return null;}};
  globalThis.sessionStorage={getItem(){return null;},removeItem(){},setItem(){}};
  globalThis.FormData=class {constructor(form){this.values=form.values;}get(k){return this.values[k]}};
  globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:'Product website timed out.'})});
  await import('../app.js?analyze-screen-test');
  assert.match(app.innerHTML,/name="url"/);
  assert.match(app.innerHTML,/id="product-files"/);
  assert.match(app.innerHTML,/Upload product files/);
  assert.match(app.innerHTML,/Product page link/);
  assert.equal((app.innerHTML.match(/<input/g)||[]).length,2);
  for(const field of ['audience','benefit','productName','manual'])assert.doesNotMatch(app.innerHTML,new RegExp('name="'+field+'"'));
  assert.doesNotMatch(app.innerHTML,/manual-details|hero-url/);
  const values={url:'https://example.com/product'};
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  for(let i=0;i<8;i++)await new Promise(done=>setTimeout(done,0));
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/role="alert"/);
  assert.match(app.innerHTML,/Product website timed out/);
  assert.match(app.innerHTML,/upload your product file instead/i);
  assert.match(app.innerHTML,/value="https:\/\/example.com\/product"/);
  let aborted=false;
  globalThis.fetch=async (_url,opts)=>new Promise((_resolve,reject)=>{
    opts.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));});
  });
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  assert.equal(location.hash,'#/loading');
  location.hash='#/analyze';events.hashchange();
  assert.equal(aborted,true);
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Analyze for Free/);
});
