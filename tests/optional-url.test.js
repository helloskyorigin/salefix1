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

test('landing starts one two-input form and blank input has clear validation',async()=>{
  const app={innerHTML:''},events={};
  globalThis.location={hash:'#/'};
  globalThis.window={scrollTo(){},addEventListener(name,fn){events[name]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(s){return s==='#app'?app:null;},getElementById(){return null;},addEventListener(name,fn){events[name]=fn;}};
  globalThis.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(k){return this.values[k]}};
  await import('../app.js?optional-url-test');
  assert.match(app.innerHTML,/lf-hero-start/);
  assert.match(app.innerHTML,/href="#\/analyze"/);
  assert.doesNotMatch(app.innerHTML,/id="hero-form"|id="hero-url"/);
  location.hash='#/analyze';events.hashchange();
  assert.match(app.innerHTML,/Product page link/);
  assert.match(app.innerHTML,/Upload product files/);
  assert.equal((app.innerHTML.match(/<input/g)||[]).length,2);
  assert.doesNotMatch(app.innerHTML,/type="url" name="url" required/);
  const values={url:''};
  events.submit({target:{id:'analyze-form',values},preventDefault(){}});
  assert.equal(location.hash,'#/analyze');
  assert.match(app.innerHTML,/Add a product file or paste a product link/);
  assert.match(app.innerHTML,/role="alert"/);
});
