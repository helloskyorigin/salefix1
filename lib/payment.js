import crypto from 'node:crypto';
import {redisReady} from './redis.js';
import {validatePublicLink} from './public-page.js';

export const KIT_PRICE_CENTS=4900;
const trim=(value,max=300)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function commerceReady(env=process.env){
  const keys=['DODO_PAYMENTS_API_KEY','DODO_PRODUCT_ID','DODO_PAYMENTS_WEBHOOK_KEY',
    'SALEFIX_KIT_SECRET','SALEFIX_PUBLIC_ORIGIN','RESEND_API_KEY','SALEFIX_DELIVERY_FROM'];
  if(env.SALEFIX_PAYMENTS_ENABLED!=='true'||!redisReady(env)||keys.some(key=>!env[key]))return false;
  if(!['test_mode','live_mode'].includes(env.DODO_PAYMENTS_ENVIRONMENT))return false;
  if(env.VERCEL_ENV==='production'&&env.DODO_PAYMENTS_ENVIRONMENT!=='live_mode')return false;
  try{const site=new URL(env.SALEFIX_PUBLIC_ORIGIN);return site.protocol==='https:' && site.origin===site.href.replace(/\/$/,'') && env.SALEFIX_KIT_SECRET.length>=32}catch{return false}
}
export function checkoutProduct(raw){
  if(!raw||typeof raw!=='object')throw Error('Product audit required before checkout.');
  const title=trim(raw.title,140),description=trim(raw.description,900),headline=trim(raw.headline,160);
  const url=validatePublicLink(raw.url);
  if(title.length<3)throw Error('Analyze a product before checkout.');
  if(!url)throw Error('Add your public product purchase link to continue with the Sales Kit.');
  return {title,description,headline:headline||title,url,price:trim(raw.price,32),audience:'',benefit:''};
}
export function productCheckoutLink(product){
  return validatePublicLink(product?.url)||'';
}
export async function createDodoSession({orderId,env=process.env,fetchImpl=globalThis.fetch}){
  if(!commerceReady(env))throw Error('Secure checkout is not yet configured.');
  if(!/^[a-f0-9-]{36}$/.test(orderId))throw Error('Invalid order reference.');
  const origin=new URL(env.SALEFIX_PUBLIC_ORIGIN).origin;
  const apiBase=env.DODO_PAYMENTS_ENVIRONMENT==='live_mode'?'https://live.dodopayments.com':'https://test.dodopayments.com';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetchImpl(apiBase+'/checkouts',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:'Bearer '+env.DODO_PAYMENTS_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        product_cart:[{product_id:env.DODO_PRODUCT_ID,quantity:1}],
        billing_currency:'USD',
        metadata:{salefix_order:orderId},minimal_address:true,
        feature_flags:{allow_discount_code:false,allow_currency_selection:false},
        return_url:origin+'/#/payment-return',cancel_url:origin+'/#/checkout'
      })
    });
    if(!res.ok)throw Error('Payment provider could not start checkout.');
    const result=await res.json();
    const link=new URL(result.checkout_url);
    if(link.protocol!=='https:'||!link.hostname.endsWith('.dodopayments.com'))throw Error('Invalid provider checkout URL.');
    return {checkoutUrl:link.href,sessionId:String(result.session_id||'').slice(0,128)};
  }finally{clearTimeout(timer)}
}
export function verifyDodoWebhook({headers,rawBody,secret,now=Math.floor(Date.now()/1000)}){
  if(!secret||typeof rawBody!=='string'||rawBody.length>250000)throw Error('Invalid webhook payload.');
  const id=String(headers?.['webhook-id']||'');
  const timestamp=String(headers?.['webhook-timestamp']||'');
  const signatures=String(headers?.['webhook-signature']||'').split(' ');
  if(!/^[A-Za-z0-9_-]{8,180}$/.test(id)||!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp))>300)throw Error('Invalid webhook headers.');
  const key=Buffer.from(secret.startsWith('whsec_')?secret.slice(6):secret,'base64');
  if(key.length<16)throw Error('Invalid webhook secret.');
  const expected=crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+rawBody).digest();
  const valid=signatures.some(part=>{
    if(!part.startsWith('v1,'))return false;
    let sig;
    try{sig=Buffer.from(part.slice(3),'base64')}catch{return false}
    return sig.length===expected.length&&crypto.timingSafeEqual(sig,expected);
  });
  if(!valid)throw Error('Invalid webhook signature.');
  let event;try{event=JSON.parse(rawBody)}catch{throw Error('Invalid webhook JSON.')}
  return {id,event};
}
export function verifiedSale(event,productId){
  if(event?.type!=='payment.succeeded'||event?.data?.status!=='succeeded')return null;
  const p=event.data;
  const item=Array.isArray(p.product_cart)&&p.product_cart.length===1?p.product_cart[0]:null;
  const orderId=String(p.metadata?.salefix_order||'');
  const email=trim(p.customer?.email,254).toLowerCase();
  if(!/^[a-f0-9-]{36}$/.test(orderId)||!/^\S+@\S+\.\S+$/.test(email))return null;
  if(!item||item.product_id!==productId||item.quantity!==1||!p.payment_id)return null;
  // Enforce exactly USD $49 BEFORE tax. Dodo's total_amount includes collected tax.
  // Never authorize access for a different product price just because total >= $49.
  const tax=p.tax==null?0:p.tax;
  if(p.currency!=='USD'||!Number.isSafeInteger(p.total_amount)||!Number.isSafeInteger(tax)||tax<0||p.total_amount-tax!==KIT_PRICE_CENTS)return null;
  if(p.subscription_id||p.refund_status==='full')return null;
  return {orderId,email,paymentId:String(p.payment_id).slice(0,150)};
}
export async function emailKitLink({to,token,idempotencyKey='',env=process.env,fetchImpl=globalThis.fetch}){
  if(!env.RESEND_API_KEY||!env.SALEFIX_DELIVERY_FROM)throw Error('Email delivery is not configured.');
  const origin=new URL(env.SALEFIX_PUBLIC_ORIGIN).origin;
  const link=origin+'/#/kit?access='+encodeURIComponent(token);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetchImpl('https://api.resend.com/emails',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':String(idempotencyKey).slice(0,256)}:{})},
      body:JSON.stringify({from:env.SALEFIX_DELIVERY_FROM,to:[to],subject:'Your SaleFix Sales Kit — secure access',
        text:'Your payment was verified. Open your personal Sales Kit here:\n\n'+link+'\n\nThis link expires in 7 days. If you need a new link, request one from the SaleFix recovery form.\nSupport: hello.skyorigin@gmail.com'})
    });
    if(!response.ok)throw Error('Delivery provider could not send the access link.');
    return true;
  }finally{clearTimeout(timer)}
}
