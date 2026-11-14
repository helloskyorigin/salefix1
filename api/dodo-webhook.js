import {commerceReady,verifyDodoWebhook,verifiedSale,emailKitLink} from '../lib/payment.js';
import {getJSON,saveJSON,setOnce,keyHash} from '../lib/redis.js';
import {issueKitAccess} from '../lib/paid-kit.js';

// Preserve the exact raw payload for Standard Webhooks HMAC verification.
// No JSON reserialization is used, and no browser redirect can grant access.
export const config={api:{bodyParser:false}};
async function rawBody(req,max=250000){
  if(Buffer.isBuffer(req.rawBody))return req.rawBody.toString('utf8');
  if(typeof req.body==='string')return req.body;
  if(req.body!==undefined&&req.body!==null)throw Error('Raw webhook body unavailable.');
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>max)throw Error('Webhook too large.');chunks.push(chunk)}
  return Buffer.concat(chunks).toString('utf8');
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Webhook processing is not configured.'});
  let verified;
  try{verified=verifyDodoWebhook({headers:req.headers,rawBody:await rawBody(req),secret:process.env.DODO_PAYMENTS_WEBHOOK_KEY})}
  catch{return res.status(401).json({error:'Unverified webhook.'})}
  const {event,id}=verified;
  try{
    // Acknowledgements are recorded only AFTER durable storage and delivery succeed.
    const replayKey='salefix:webhook:'+id;
    const previous=await getJSON(replayKey);
    if(previous?.done)return res.status(200).json({received:true});
    if(event?.type==='payment.succeeded'){
      const sale=verifiedSale(event,process.env.DODO_PRODUCT_ID);
      if(!sale)return res.status(200).json({received:true,fulfilled:false});
      const key='salefix:order:'+sale.orderId;
      const order=await getJSON(key);
      if(!order||(!['pending','paid'].includes(order.status))||order.paymentId&&order.paymentId!==sale.paymentId){
        return res.status(200).json({received:true,fulfilled:false});
      }
      const product=order.product;
      const record={
        ...order,status:'paid',paymentId:sale.paymentId,email:sale.email,paidAt:Date.now(),product
      };
      await saveJSON(key,record,365*86400);
      await saveJSON('salefix:payment:'+sale.paymentId,{orderId:sale.orderId},365*86400);
      await saveJSON('salefix:email:'+keyHash(sale.email),{orderId:sale.orderId},365*86400);
      const token=issueKitAccess({
        verifiedProviderEvent:true,status:'succeeded',amountCents:4900,currency:'USD',
        paymentId:sale.paymentId,email:sale.email,product
      },process.env.SALEFIX_KIT_SECRET);
      await emailKitLink({to:sale.email,token});
    }else if(['refund.succeeded','payment.refunded','dispute.opened'].includes(event?.type)){
      const paymentId=String(event.data?.payment_id||'');
      if(paymentId){
        const index=await getJSON('salefix:payment:'+paymentId);
        if(index?.orderId){
          const order=await getJSON('salefix:order:'+index.orderId);
          if(order&&order.paymentId===paymentId){
            await saveJSON('salefix:order:'+index.orderId,{...order,status:'revoked'},365*86400);
          }
        }
      }
    }
    await saveJSON(replayKey,{done:true},30*86400);
    return res.status(200).json({received:true});
  }catch{
    // Provider retries, which is safer than claiming delivery before it succeeded.
    return res.status(500).json({error:'Webhook fulfillment pending retry.'});
  }
}
