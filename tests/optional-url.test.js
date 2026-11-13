import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductUrl,analyzeProduct} from '../lib/audit.js';
const copy='A useful collection of real lessons, exercises, detailed examples, and checklists to help creators improve their digital product pages and descriptions. Includes usable templates and costs $19.';
test('plain domains and full URLs normalize safely',()=>{
  assert.equal(normalizeProductUrl('Google.com'),'https://google.com/');
  assert.equal(normalizeProductUrl('www.example.com/offer?ref=1'),'https://www.example.com/offer?ref=1');
  assert.equal(normalizeProductUrl('http://example.com/offer'),'http://example.com/offer');
  assert.equal(normalizeProductUrl('https://example.com/offer'),'https://example.com/offer');
  assert.equal(normalizeProductUrl(''),'');
});
test('unsafe schemes, local URLs, credentials and malformed sites remain blocked',()=>{
  for(const url of ['localhost','http://127.0.0.1','192.168.0.1','file:///etc/passwd','javascript:alert(1)','https://me:secret@example.com','example.com:3000','bad domain name']){
    assert.throws(()=>normalizeProductUrl(url),Error,url);
  }
});
test('manual-only audits work without a link and disclose the source',async()=>{
  const result=await analyzeProduct({url:'',productName:'Creator Pages Toolkit',manual:copy,audience:'creators'});
  assert.equal(result.product.url,'');
  assert.equal(result.product.title,'Creator Pages Toolkit');
  assert.equal(result.product.source,'User-provided product copy');
  assert.match(result.note,/No website link was supplied/);
  assert.ok(result.issues.length>0);
  await assert.rejects(analyzeProduct({url:'',manual:'Too short'}),/at least 60 characters/);
});
test('landing and Analyze screens accept optional website text',async()=>{
  const app={innerHTML:''};const listeners={};
  globalThis.location={hash:'#/'};
  globalThis.window={scrollTo(){},addEventListener(type,fn){listeners[type]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){if(s==='#app')return app;if(s==='#hero-url')return {value:'google.com'};if(s==='#manual-details')return {open:true};return null;},addEventListener(type,fn){listeners[type]=fn;},getElementById(){return null;}};
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(k){return this.values[k];}};
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Cannot scan this site.'})});
  await import('../app.js?url-optionality-test');
  assert.match(app.innerHTML,/Product link or google.com \(optional\)/);
  assert.match(app.innerHTML,/id="manual-start"/);
  listeners.submit({target:{id:'hero-form'},preventDefault(){}});
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Product link or domain/);
  assert.doesNotMatch(app.innerHTML,/type="url" name="url" required/);
  listeners.submit({target:{id:'analyze-form',values:{url:'',audience:'creators',benefit:'',manual:'',productName:'sample'}},preventDefault(){}});
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Without a link, paste at least 60 characters/);
  assert.match(app.innerHTML,/id="manual-details" class="manual-details" open/);
});
