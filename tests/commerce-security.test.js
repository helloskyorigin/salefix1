import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {commerceReady,checkoutProduct,createDodoSession,verifyDodoWebhook,verifiedSale,emailKitLink} from '../lib/payment.js';
import {enforceRateLimit} from '../lib/rate-limit.js';
import {pageContent,htmlPage,validatePublicLink} from '../lib/public-page.js';
import checkoutHandler from '../api/checkout.js';
import webhookHandler,{rawBody} from '../api/dodo-webhook.js';
import {Readable} from 'node:stream';
import publishHandler from '../api/publish.js';

const env={
  VERCEL:'1',SALEFIX_PAYMENTS_ENABLED:'true',DODO_PAYMENTS_API_KEY:'test-secret',
  DODO_PRODUCT_ID:'pdt_49_usd',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+Buffer.alloc(32,3).toString('base64'),
  SALEFIX_KIT_SECRET:'s'.repeat(48),SALEFIX_PUBLIC_ORIGIN:'https://sale.example',
  RESEND_API_KEY:'test-resend',SALEFIX_DELIVERY_FROM:'SaleFix <support@example.com>',
  UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-redis'
};
function response(){
  let code=200,payload;
  return {headers:{},setHeader(k,v){this.headers[k]=v;return this},status(v){code=v;return this},json(v){payload=v;return this},get code(){return code},get payload(){return payload}};
}
test('payment remains blocked with one missing merchant, email or storage prerequisite',()=>{
  assert.equal(commerceReady({}),false);
  assert.equal(commerceReady(env),true);
  for(const k of ['RESEND_API_KEY','DODO_PAYMENTS_WEBHOOK_KEY','UPSTASH_REDIS_REST_TOKEN','SALEFIX_KIT_SECRET','SALEFIX_PAYMENTS_ENABLED']){
    assert.equal(commerceReady({...env,[k]:undefined}),false,k);
  }
});
test('Dodo session is server-priced and accepts no arbitrary browser-supplied amount',async()=>{
  const calls=[];
  const fake=async(url,opts)=>{
    calls.push({url,opts,body:JSON.parse(opts.body)});
    return {ok:true,json:async()=>({checkout_url:'https://checkout.dodopayments.com/session/test',session_id:'s123'})};
  };
  const session=await createDodoSession({orderId:'11111111-2222-4333-8444-555555555555',env,fetchImpl:fake});
  assert.match(session.checkoutUrl,/checkout.dodopayments.com/);
  assert.equal(calls[0].url,'https://test.dodopayments.com/checkouts');
  assert.deepEqual(calls[0].body.product_cart,[{product_id:'pdt_49_usd',quantity:1}]);
  assert.equal(calls[0].body.metadata.salefix_order,'11111111-2222-4333-8444-555555555555');
  assert.ok(!JSON.stringify(calls[0].body).includes('user_requested_price'));
  assert.equal(checkoutProduct({title:'Real Product',price:'$0',url:'https://seller.example/product'}).title,'Real Product');
  await assert.rejects(createDodoSession({orderId:'invalid',env,fetchImpl:fake}),/order reference/);
});
test('Standard Webhooks raw-body signature, replay window and evidence checks',()=>{
  const body=JSON.stringify({type:'payment.succeeded',data:{
    status:'succeeded',currency:'USD',total_amount:4900,
    payment_id:'pay123',metadata:{salefix_order:'11111111-2222-4333-8444-555555555555'},
    product_cart:[{product_id:'pdt_49_usd',quantity:1}],customer:{email:'buyer@example.com'}}});
  const id='msg_evt_12345',timestamp='1794649000',key=Buffer.alloc(32,3);
  const signature='v1,'+crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+body).digest('base64');
  const headers={'webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':signature};
  const verified=verifyDodoWebhook({headers,rawBody:body,secret:env.DODO_PAYMENTS_WEBHOOK_KEY,now:Number(timestamp)});
  assert.equal(verified.event.type,'payment.succeeded');
  const sale=verifiedSale(verified.event,env.DODO_PRODUCT_ID);
  assert.equal(sale.email,'buyer@example.com');
  assert.equal(sale.paymentId,'pay123');
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,total_amount:490}},env.DODO_PRODUCT_ID),null);
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,total_amount:4901}},env.DODO_PRODUCT_ID),null);
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,total_amount:5400,tax:500}},env.DODO_PRODUCT_ID)?.paymentId,'pay123');
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,total_amount:5400,tax:200}},env.DODO_PRODUCT_ID),null);
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,product_cart:[{product_id:'different',quantity:1}]}},env.DODO_PRODUCT_ID),null);
  assert.equal(verifiedSale({...verified.event,data:{...verified.event.data,status:'failed'}},env.DODO_PRODUCT_ID),null);
  assert.throws(()=>verifyDodoWebhook({headers,rawBody:body+' ',secret:env.DODO_PAYMENTS_WEBHOOK_KEY,now:Number(timestamp)}),/signature/);
  assert.throws(()=>verifyDodoWebhook({headers,rawBody:body,secret:env.DODO_PAYMENTS_WEBHOOK_KEY,now:Number(timestamp)+301}),/headers/);
});
test('public sales page escapes injected HTML and requires real checkout destination',()=>{
  assert.equal(validatePublicLink('javascript:alert(1)'), '');
  assert.equal(validatePublicLink('http://127.0.0.1'),'');
  assert.equal(validatePublicLink('https://sale.example/p/11111111-2222-4333-8444-555555555555','https://sale.example'),'');
  assert.throws(()=>pageContent({title:'Test',headline:'Short',description:'Long enough product description to be valid',checkoutUrl:'https://seller.example'}),/title, honest headline/);
  const p=pageContent({title:'Useful Product',headline:'Useful Product for great teams',description:'<script>alert(1)</script> A real product with useful details and examples.',checkoutUrl:'https://seller.example/buy'});
  const html=htmlPage(p);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/https:\/\/seller.example\/buy/);
});
test('unconfigured money, webhook, and publish routes fail closed and never accept payment',async()=>{
  const prev=process.env.SALEFIX_PAYMENTS_ENABLED;delete process.env.SALEFIX_PAYMENTS_ENABLED;
  try{
    for(const [handler,req] of [
      [checkoutHandler,{method:'POST',body:{product:{title:'Test'}}}],
      [webhookHandler,{method:'POST',headers:{}}],
      [publishHandler,{method:'POST',headers:{}}]
    ]){
      const res=response();await handler(req,res);assert.equal(res.code,503);
    }
  }finally{if(prev===undefined)delete process.env.SALEFIX_PAYMENTS_ENABLED;else process.env.SALEFIX_PAYMENTS_ENABLED=prev}
});
test('production analysis rate limiting requires shared storage and atomic Redis',async()=>{
  const missing=await enforceRateLimit({headers:{}},'audit',{env:{VERCEL:'1'}});
  assert.equal(missing.allowed,false);
  assert.equal(missing.status,503);
  const commands=[];
  const mock=async(cmd)=>{
    commands.push(cmd);
    return commands.length;
  };
  const req={headers:{'x-vercel-forwarded-for':'198.51.100.5'}};
  const limit1=await enforceRateLimit(req,'audit',{limit:1,windowSeconds:60,now:100000,env,redis:mock});
  const limit2=await enforceRateLimit(req,'audit',{limit:1,windowSeconds:60,now:100000,env,redis:mock});
  assert.equal(limit1.allowed,true);
  assert.equal(limit2.status,429);
  assert.equal(commands[0][0],'EVAL');
  assert.equal(commands[0][2],1);
  assert.equal(commands[0][3],commands[1][3]);
});
test('email fulfillment never delivers a link without an actual secure token',async()=>{
  let message;
  await emailKitLink({to:'buyer@example.com',token:'signed.payload',env,fetchImpl:async(_url,opts)=>{
    message=JSON.parse(opts.body);
    return {ok:true};
  }});
  assert.equal(message.to[0],'buyer@example.com');
  assert.match(message.text,/#\/kit\?access=/);
});

test('raw signed webhook stream is read without triggering Vercel lazy body getter',async()=>{
  const request=Readable.from([Buffer.from('{"type":'),Buffer.from('"payment.succeeded"}')]);
  Object.defineProperty(request,'body',{get(){throw Error('Never use the parsed body getter for signed webhooks');}});
  assert.equal(await rawBody(request),'{"type":"payment.succeeded"}');
});
