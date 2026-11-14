import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {legalContent,SUPPORT_EMAIL} from '../legal-content.js';

test('every public policy contains its correct title and business email',()=>{
  for(const [path,title] of Object.entries({privacy:'Privacy Policy',terms:'Terms of Service',refunds:'Refund Policy',contact:'Contact & Support'})){
    const html=legalContent(path);
    assert.ok(html.includes(title),path);
    assert.ok(html.includes(SUPPORT_EMAIL),path);
    assert.ok(html.includes('mailto:'+SUPPORT_EMAIL),path);
  }
});
test('policy copy accurately describes checkout and data storage',()=>{
  assert.match(legalContent('refunds'),/checkout is only offered if secure merchant checkout/i);
  assert.match(legalContent('privacy'),/Upstash Redis/);
  assert.match(legalContent('privacy'),/Resend/);
  assert.match(legalContent('privacy'),/original uploaded binaries/);
  assert.match(legalContent('terms'),/US\$49/);
  assert.match(legalContent('privacy'),/sessionStorage/);
});
test('app has legal links and no fabricated sales-readiness score',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(app.includes('#/refunds'));
  assert.ok(app.includes('#/contact'));
  assert.ok(app.includes('legalContent(which)'));
  assert.ok(!app.includes('Overall Sales Readiness'));
});