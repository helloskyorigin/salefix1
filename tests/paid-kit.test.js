import test from 'node:test';
import assert from 'node:assert/strict';
import {issueKitAccess,verifyKitAccess,buildPaidKit} from '../lib/paid-kit.js';
import handler from '../api/paid-kit.js';

const secret='a-private-test-key-that-is-at-least-32-characters';
const record={verifiedProviderEvent:true,status:'succeeded',amountCents:4900,currency:'USD',paymentId:'pay_test_123',email:'buyer@example.com',product:{url:'https://example.com/course',title:'AI Guide',description:'Learn to build a simple AI helper using real examples.',price:'$19',audience:'Creators',benefit:'Build a useful AI helper'}};
const now=1800000000;
test('unverified or wrong amount payments cannot issue paid access',()=>{
  for(const bad of [{...record,verifiedProviderEvent:false},{...record,amountCents:1900},{...record,status:'pending'},{...record,currency:'INR'}])assert.throws(()=>issueKitAccess(bad,secret,now));
});
test('signed tokens are scoped and expire, and are resistant to tampering',()=>{
  const token=issueKitAccess(record,secret,now);
  const payload=verifyKitAccess(token,secret,now+60);
  assert.equal(payload.id,record.paymentId);
  assert.equal(payload.product.title,'AI Guide');
  assert.throws(()=>verifyKitAccess(token.replace('A','B'),secret,now+60));
  assert.throws(()=>verifyKitAccess(token,secret,now+8*24*3600));
});
test('paid kit uses real product details without inventing revenue or testimonials',()=>{
  const payload=verifyKitAccess(issueKitAccess(record,secret,now),secret,now+1);
  const kit=buildPaidKit(payload);
  assert.equal(kit.posts.length,10);assert.equal(kit.replies.length,5);assert.equal(kit.plan.length,7);assert.equal(kit.graphics.length,3);
  assert.ok(kit.posts.every(p=>p.includes('https://example.com/course')));
  assert.doesNotMatch(JSON.stringify(kit),/guaranteed|earned \$|5-star reviews/i);
});
test('API fails closed with no key, missing token, wrong method and forged token',()=>{
  const old=process.env.SALEFIX_KIT_SECRET;
  const call=(method,authorization)=>{let status=0,body;const res={setHeader(){},status(v){status=v;return this;},json(v){body=v;return this;}};handler({method,headers:{authorization}},res);return {status,body};};
  try{
    delete process.env.SALEFIX_KIT_SECRET;
    assert.equal(call('GET').status,503);
    process.env.SALEFIX_KIT_SECRET=secret;
    assert.equal(call('POST').status,405);
    assert.equal(call('GET').status,401);
    assert.equal(call('GET','Bearer fake.token').status,403);
    const token=issueKitAccess(record,secret);
    const result=call('GET',`Bearer ${token}`);
    assert.equal(result.status,200);
    assert.equal(result.body.kit.posts.length,10);
  }finally{if(old)process.env.SALEFIX_KIT_SECRET=old;else delete process.env.SALEFIX_KIT_SECRET;}
});
