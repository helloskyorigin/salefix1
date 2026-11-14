import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import webhook from '../api/dodo-webhook.js';
import paidKit from '../api/paid-kit.js';

const secret='whsec_'+Buffer.alloc(32,9).toString('base64');
const orderId='c35d8252-597e-42d1-802e-51f1934e355e';
const paymentId='pay_local_fixture_123';
const email='test-buyer@example.com';
const env={
  VERCEL:'1',VERCEL_ENV:'preview',
  SALEFIX_PAYMENTS_ENABLED:'true',DODO_PAYMENTS_ENVIRONMENT:'test_mode',
  DODO_PAYMENTS_API_KEY:'local-test-only',DODO_PRODUCT_ID:'pdt_test-49',
  DODO_PAYMENTS_WEBHOOK_KEY:secret,SALEFIX_KIT_SECRET:'z'.repeat(48),
  SALEFIX_PUBLIC_ORIGIN:'https://salefix.example',
  RESEND_API_KEY:'re_test',SALEFIX_DELIVERY_FROM:'SaleFix <sales@example.com>',
  UPSTASH_REDIS_REST_URL:'https://test-redis.upstash.io',UPSTASH_REDIS_REST_TOKEN:'local-test'
};
function responder(){
  return {code:200,result:null,headers:{},setHeader(n,v){this.headers[n]=v;return this},
    status(n){this.code=n;return this},json(v){this.result=v;return this}};
}
function mockStore(){
  const values=new Map(),emails=[];
  const get=key=>values.get(key)??null;
  const set=(key,v)=>{values.set(key,v);return 'OK'};
  const fetchImpl=async(url,opts)=>{
    if(url==='https://api.resend.com/emails'){
      const mail=JSON.parse(opts.body);
      emails.push({mail,key:opts.headers['Idempotency-Key']});
      return {ok:true,json:async()=>({id:'em_test'})};
    }
    assert.equal(new URL(url).origin,new URL(env.UPSTASH_REDIS_REST_URL).origin);
    const [cmd,...a]=JSON.parse(opts.body);
    let result=null;
    if(cmd==='GET')result=get(a[0]);
    else if(cmd==='SET'){
      const [k,v,...extras]=a;
      if(extras.includes('NX')&&values.has(k))result=null;
      else result=set(k,v);
    }else if(cmd==='EVAL'){
      const key=a[2],compare=a[3];
      if(String(a[0]).includes("redis.call('GET'")){
        if(get(key)===compare){values.delete(key);result=1}else result=0;
      }else throw Error('Unexpected Lua script: '+a[0].slice(0,100));
    }else throw Error('Unsupported Redis command: '+cmd);
    return {ok:true,json:async()=>({result})};
  };
  return {values,emails,set,get,fetchImpl};
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
function succeeded(){
  return {
    status:'succeeded',payment_id:paymentId,currency:'USD',total_amount:4900,tax:0,
    product_cart:[{product_id:'pdt_test-49',quantity:1}],
    metadata:{salefix_order:orderId},customer:{email}
  };
}
async function withMocks(stuff){
  const originalEnv=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  const prevFetch=globalThis.fetch;
  const store=mockStore();
  Object.assign(process.env,env);
  globalThis.fetch=store.fetchImpl;
  const product={url:'https://store.example/product',title:'Creator Launch Kit',description:'A creator toolkit that helps organize product launches with practical checklists.',headline:'Launch a useful digital product',price:'$49'};
  store.set('salefix:order:'+orderId,JSON.stringify({id:orderId,status:'pending',product,createdAt:Date.now()}));
  try{return await stuff(store)}finally{
    globalThis.fetch=prevFetch;
    for(const [k,v] of Object.entries(originalEnv)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
}
test('real handler: verified checkout webhook sends one email, duplicate event is idempotent, refund revokes access',async()=>{
  await withMocks(async store=>{
    const success=signed('payment.succeeded',succeeded());
    const initial=responder();
    await webhook(success,initial);
    assert.equal(initial.code,200);
    assert.equal(store.emails.length,1);
    assert.match(store.emails[0].key,/salefix-purchase/);
    assert.match(store.get('salefix:order:'+orderId),/"deliveryCompletedAt"/);
    const same=responder();
    await webhook(success,same);
    assert.equal(same.code,200);
    assert.equal(store.emails.length,1);
    const encoded=store.emails[0].mail.text.match(/access=([^\s]+)/)?.[1];
    assert.ok(encoded,'email must include the actual secure link');
    const token=decodeURIComponent(encoded);
    const before=responder();
    await paidKit({method:'GET',headers:{authorization:'Bearer '+token}},before);
    assert.equal(before.code,200);
    assert.equal(before.result.kit.product.title,'Creator Launch Kit');
    const reversal=signed('refund.succeeded',{payment_id:paymentId});
    const refunded=responder();
    await webhook(reversal,refunded);
    assert.equal(refunded.code,200);
    assert.match(store.get('salefix:order:'+orderId),/"revoked"/);
    const after=responder();
    await paidKit({method:'GET',headers:{authorization:'Bearer '+token}},after);
    assert.equal(after.code,403);
  });
});
test('real handler: refund notification before payment success prevents any delivery',async()=>{
  await withMocks(async store=>{
    const reversed=responder();
    await webhook(signed('refund.succeeded',{payment_id:paymentId}),reversed);
    assert.equal(reversed.code,200);
    const payment=responder();
    await webhook(signed('payment.succeeded',succeeded()),payment);
    assert.equal(payment.code,200);
    assert.equal(payment.result.fulfilled,false);
    assert.equal(store.emails.length,0);
  });
});
test('real handler: forged webhook signature is rejected with no purchase or email',async()=>{
  await withMocks(async store=>{
    const fake=signed('payment.succeeded',succeeded());
    fake.headers['webhook-signature']='v1,'+Buffer.alloc(32).toString('base64');
    const res=responder();
    await webhook(fake,res);
    assert.equal(res.code,401);
    assert.equal(store.emails.length,0);
    assert.match(store.get('salefix:order:'+orderId),/"pending"/);
  });
});
