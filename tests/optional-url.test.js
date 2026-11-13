import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductUrl,analyzeProduct} from '../lib/audit.js';

const manual='A useful collection of real lessons, exercises, and detailed checklists to help creators prepare and improve their product pages. Includes clear examples and costs $19.';

test('accepts bare domains and existing http(s) product links',()=>{
  assert.equal(normalizeProductUrl('Google.com'),'https://google.com/');
  assert.equal(normalizeProductUrl('www.example.com/course?ref=test'),'https://www.example.com/course?ref=test');
  assert.equal(normalizeProductUrl('https://example.com/product'),'https://example.com/product');
  assert.equal(normalizeProductUrl('http://example.com/test'),'http://example.com/test');
  assert.equal(normalizeProductUrl(''),'');
});

test('still blocks local, non-web, credentialed or malformed inputs',()=>{
  for(const url of ['localhost','http://127.0.0.1','192.168.0.1','file:///etc/passwd','javascript:alert(1)','https://me:password@example.com','example.com:3000','some invalid website']){
    assert.throws(()=>normalizeProductUrl(url),Error,`Should reject ${url}`);
  }
});

test('no-link manual analysis returns meaningful source and no fake page URL',async()=>{
  const result=await analyzeProduct({url:'',productName:'Creator Pages Toolkit',audience:'creators',benefit:'Improve product descriptions',manual});
  assert.equal(result.product.url,'');
  assert.equal(result.product.title,'Creator Pages Toolkit');
  assert.equal(result.product.source,'User-provided product copy');
  assert.match(result.note,/No website link was supplied/);
  assert.ok(result.improvedHeadline);
  assert.ok(result.issues.length>0);
  await assert.rejects(analyzeProduct({url:'',manual:'Too short'}),/at least 60 characters/);
});

test('bare domain fallback is normalized even if the public page cannot be fetched',async()=>{
  const result=await analyzeProduct({url:'not-a-real-test-subdomain.invalid/tool',manual,productName:'Creator Pages Toolkit'});
  assert.equal(result.product.url,'https://not-a-real-test-subdomain.invalid/tool');
  assert.equal(result.product.source,'User-provided product copy');
  assert.match(result.note,/could not be fetched/);
});

test('UI accepts optional link and offers manual path',async()=>{
  const app={innerHTML:''},events={};
  globalThis.location={hash:'#/'};
  globalThis.window={scrollTo(){},addEventListener(name,fn){events[name]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){if(s==='#app')return app;if(s==='#hero-url')return {value:'google.com'};if(s==='#manual-details')return {open:true};return null;},getElementById(){return null;},addEventListener(name,fn){events[name]=fn;}};
  globalThis.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(k){return this.values[k]}};
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Sample'})});
  await import('../app.js?optional-url-test');
  assert.match(app.innerHTML,/Product link \(optional\)/);
  assert.match(app.innerHTML,/id="manual-start"/);
  events.submit({target:{id:'hero-form'},preventDefault(){}});
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Product link or domain/);
  assert.doesNotMatch(app.innerHTML,/type="url" name="url" required/);
  const values={url:'',audience:'Creators',benefit:'Better offers',manual:'',productName:'Sample'};
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Without a link, paste at least 60 characters/);
  assert.match(app.innerHTML,/id="manual-details" class="manual-details" open/);
});
