import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProduct} from '../lib/audit.js';

test('a real text file submits and produces a results screen WITHOUT a website URL',async()=>{
  const events={};
  const app={innerHTML:''};
  const selected={innerHTML:''};
  const clear={hidden:true};
  let submitted=null;
  let resolveRequest;
  const requestStarted=new Promise(resolve=>{resolveRequest=resolve;});
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(name,fn){events['window:'+name]=fn;}};
  globalThis.document={
    title:'',body:{dataset:{}},
    querySelector(sel){
      if(sel==='#app')return app;
      if(sel==='#selected-product-files')return selected;
      if(sel==='#clear-product-files')return clear;
      if(sel==='#manual-details')return {open:true};
      return null;
    },
    getElementById(){return null;},
    addEventListener(name,fn){events[name]=fn;}
  };
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(name){return this.values[name]}};
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'/api/analyze');
    submitted=JSON.parse(options.body);
    const data=await analyzeProduct(submitted);
    resolveRequest();
    return {ok:true,json:async()=>data};
  };
  await import('../app.js?file-only-integration');
  assert.match(app.innerHTML,/Upload product files/);

  const name='My Creator Playbook.txt';
  const content='Introduction. This digital product is a printable 30-day creator planner. '.repeat(20);
  const file={name,size:new TextEncoder().encode(content).length,text:async()=>content};
  events.change({target:{id:'product-files',files:[file],value:'selected'}});
  assert.match(selected.innerHTML,/My Creator Playbook/);
  assert.equal(clear.hidden,false);

  const values={url:''};
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  assert.equal(location.hash,'#/loading');
  await requestStarted;
  await new Promise(resolve=>setImmediate(resolve));

  assert.ok(submitted);
  assert.equal(submitted.url,'');
  assert.equal(submitted.fileExtracts.length,1);
  assert.deepEqual(Object.keys(submitted).sort(),['fileExtracts','url']);
  assert.match(submitted.fileExtracts[0].text,/30-day creator planner/);
  assert.equal(submitted.fileExtracts[0].inspected,true);
  assert.equal(submitted.fileExtracts[0].size,file.size);
  assert.equal(location.hash,'#/results');
  assert.match(app.innerHTML,/Product audit — key findings/);
  assert.match(app.innerHTML,/From your uploaded product files/);
  assert.match(app.innerHTML,/Creator Playbook/);
});

test('file picker immediately rejects unsupported or empty files with an accessible error',async()=>{
  const events={},app={innerHTML:''};
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(){}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){return s==='#app'?app:null;},getElementById(){return null;},addEventListener(n,fn){events[n]=fn;}};
  globalThis.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};
  await import('../app.js?invalid-upload-qa');
  const bad={id:'product-files',files:[{name:'setup.exe',size:100}],value:'chosen'};
  events.change({target:bad});
  assert.equal(bad.value,'');
  assert.match(app.innerHTML,/Unsupported file format/);
  assert.match(app.innerHTML,/role="alert"/);
});