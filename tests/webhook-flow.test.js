import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import webhook from '../api/dodo-webhook.js';
import paidKit from '../api/paid-kit.js';
import claim from '../api/claim.js';
import {keyHash} from '../lib/redis.js';

const signingKey='whsec_'+Buffer.alloc(32,9).toString('base64');
const orderId='c35d8252-597e-42d1-802e-51f1934e355e';
const claimSecret='c'.repeat(64);
const paymentId='pay_local_fixture_123';
const email='test-buyer@example.com';
const env={
  VERCEL:'1',VERCEL_ENV:'preview',SALEFIX_PAYMENTS_ENABLED:'true',
  DODO_PAYMENTS_ENVIRONMENT:'test_mode',DODO_PAYMENTS_API_KEY:'local-test-only',
  DODO_PRODUCT_ID:'pdt_test-29',DODO_PAYMENTS_WEBHOOK_KEY:signingKey,
  SALEFIX_KIT_SECRET:'z'.repeat(48),SALEFIX_PUBLIC_ORIGIN:'https://salefix.example',
  UPSTASH_REDIS_REST_URL:'https://test-redis.upstash.io',UPSTASH_REDIS_REST_TOKEN:'local-test'
};
function responder(){return {code:200,result:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.code=n;return this},json(v){this.result=v;return this}}}
function mockStore(){
  const values=new Map(),requests=[];
  const get=key=>values.get(key)??null;
  const set=(key,v)=>{values.set(key,String(v));return 'OK'};
  const fetchImpl=async(url,opts)=>{
    requests.push(url);
    assert.equal(new URL(url).origin,new URL(env.UPSTASH_REDIS_REST_URL).origin);
    const [cmd,...a]=JSON.parse(opts.body);
    let result=null;
    if(cmd==='GET')result=get(a[0]);
    else if(cmd==='SET'){
      const [k,v,...extras]=a;
      result=extras.includes('NX')&&values.has(k)?null:set(k,v);
    }else if(cmd==='EVAL'){
      const script=a[0],key=a[2],compare=a[3];
      if(script.includes("redis.call('GET'")){
        if(get(key)===compare){values.delete(key);result=1}else result=0;
      }else if(script.includes("redis.call('INCR'")){
        const n=Number(get(key)||0)+1;set(key,String(n));result=n;
      }else throw Error('Unexpected Lua script');
    }else throw Error('Unsupported Redis command: '+cmd);
    return {ok:true,json:async()=>({result})};
  };
  return {values,requests,set,get,fetchImpl};
}
let eventCounter=0;
function signed(type,data){
  const payload=JSON.stringify({type,data});
  const timestamp=String(Math.floor(Date.now()/1000));
  const id='msg_pay_'+(++eventCounter);
  const sig=crypto.createHmac('sha256',Buffer.alloc(32,9)).update(id+'.'+timestamp+'.'+payload).digest('base64');
  return {method:'POST',rawBody:payload,headers:{
    'webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':'v1,'+sig
  }};
}
function succeeded(){return {
  status:'succeeded',payment_id:paymentId,currency:'USD',total_amount:2900,tax:0,
  product_cart:[{product_id:'pdt_test-29',quantity:1}],
  metadata:{salefix_order:orderId},customer:{email}
}}
async function withMocks(stuff){
  const originalEnv=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  const prevFetch=globalThis.fetch,store=mockStore();
  Object.assign(process.env,env);globalThis.fetch=store.fetchImpl;
  const product={url:'https://store.example/product',title:'Creator Launch Kit',
    description:'Creator toolkit with practical checklists.',headline:'Launch a useful digital product',price:'$29'};
  store.set('salefix:order:'+orderId,JSON.stringify({
    id:orderId,status:'pending',claimHash:keyHash(claimSecret),product,createdAt:Date.now()
  }));
  try{return await stuff(store)}finally{
    globalThis.fetch=prevFetch;
    for(const [k,v] of Object.entries(originalEnv)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
}
const makeClaim=(secret=claimSecret,id=orderId)=>({method:'POST',headers:{'x-real-ip':'203.0.113.24'},body:{orderId:id,claimSecret:secret}});
test('website receipt is pending until signed Dodo payment event, then unlocks kit without email delivery',async()=>{
  await withMocks(async store=>{
    const before=responder();await claim(makeClaim(),before);
    assert.equal(before.code,202);
    assert.equal(before.result.state,'pending');
    const success=signed('payment.succeeded',succeeded());
    const receipt=responder();await webhook(success,receipt);
    assert.equal(receipt.code,200);
    assert.match(store.get('salefix:order:'+orderId),/"status":"paid"/);
    const claimed=responder();await claim(makeClaim(),claimed);
    assert.equal(claimed.code,200);assert.equal(claimed.result.state,'paid');
    const token=claimed.result.token;assert.match(token,/^[\w-]+\.[\w-]+$/);
    const loaded=responder();await paidKit({method:'GET',headers:{authorization:'Bearer '+token}},loaded);
    assert.equal(loaded.code,200);
    assert.equal(loaded.result.kit.product.title,'Creator Launch Kit');
    const replay=responder();await webhook(success,replay);
    assert.equal(replay.code,200);
    assert.equal(store.requests.some(x=>/resend\.com/.test(x)),false);
    const invalid=responder();await claim(makeClaim('d'.repeat(64)),invalid);
    assert.equal(invalid.code,403);
    const refunded=responder();await webhook(signed('refund.succeeded',{payment_id:paymentId}),refunded);
    assert.equal(refunded.code,200);
    const revoked=responder();await claim(makeClaim(),revoked);
    assert.equal(revoked.code,403);
    const after=responder();await paidKit({method:'GET',headers:{authorization:'Bearer '+token}},after);
    assert.equal(after.code,403);
  });
});
test('refund before payment success prevents forged or delayed website access',async()=>{
  await withMocks(async store=>{
    const reversed=responder();await webhook(signed('refund.succeeded',{payment_id:paymentId}),reversed);
    assert.equal(reversed.code,200);
    const payment=responder();await webhook(signed('payment.succeeded',succeeded()),payment);
    assert.equal(payment.code,200);assert.equal(payment.result.fulfilled,false);
    const access=responder();await claim(makeClaim(),access);
    assert.equal(access.code,202);
    assert.equal(store.requests.some(x=>x.includes('resend.com')),false);
  });
});
test('unsigned or tampered payment redirect cannot mark an unpaid order paid',async()=>{
  await withMocks(async store=>{
    const fake=signed('payment.succeeded',succeeded());
    fake.headers['webhook-signature']='v1,'+Buffer.alloc(32).toString('base64');
    const r=responder();await webhook(fake,r);
    assert.equal(r.code,401);
    const guess=responder();await claim(makeClaim('f'.repeat(64)),guess);
    assert.equal(guess.code,403);
    const original=responder();await claim(makeClaim(),original);
    assert.equal(original.code,202);
    assert.match(store.get('salefix:order:'+orderId),/"pending"/);
  });
});
