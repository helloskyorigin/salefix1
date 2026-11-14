import {commerceReady,verifyDodoWebhook,verifiedSale,emailKitLink,KIT_PRICE_CENTS} from '../lib/payment.js';
import {getJSON,saveJSON,setOnce,redisCommand,keyHash} from '../lib/redis.js';
import {issueKitAccess} from '../lib/paid-kit.js';

export const config={api:{bodyParser:false}};
const RELEASE_LOCK="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0";
const PURCHASE_TTL=365*86400;
const WEBHOOK_TTL=30*86400;

export async function rawBody(req,max=250000){
  // Standard Webhooks signatures cover the untouched bytes, not parsed JSON.
  // Vercel's req.body getter can consume the raw request: do not access it.
  if(Buffer.isBuffer(req.rawBody))return req.rawBody.toString('utf8');
  if(typeof req.rawBody==='string')return req.rawBody;
  const chunks=[];let length=0;
  for await(const part of req){
    length+=part.length;
    if(length>max)throw Error('Webhook payload exceeds limit.');
    chunks.push(part);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Webhook processor is not configured.'});
  let verified;
  try{
    verified=verifyDodoWebhook({
      headers:req.headers,rawBody:await rawBody(req),
      secret:process.env.DODO_PAYMENTS_WEBHOOK_KEY
    });
  }catch{return res.status(401).json({error:'Invalid webhook signature or payload.'})}

  const {event,id}=verified;
  const replayKey='salefix:webhook:'+id;
  let paymentId=String(event?.data?.payment_id||'');
  // Ignore unrelated notifications and still acknowledge valid signatures.
  const success=event?.type==='payment.succeeded';
  const reversal=['refund.succeeded','dispute.opened','dispute.lost'].includes(event?.type);
  if(!success&&!reversal)return res.status(200).json({received:true});
  if(!/^[A-Za-z0-9_-]{4,150}$/.test(paymentId))return res.status(200).json({received:true,fulfilled:false});

  const lock='salefix:payment-lock:'+keyHash(paymentId);
  let acquired=false;
  try{
    if((await getJSON(replayKey))?.done)return res.status(200).json({received:true});
    acquired=await setOnce(lock,id,45);
    if(!acquired)return res.status(503).json({error:'Concurrent payment event; please retry.'});
    if((await getJSON(replayKey))?.done)return res.status(200).json({received:true});

    if(reversal){
      // Tombstones protect against a refund/dispute notification arriving
      // BEFORE payment.succeeded or before our order/payment index was saved.
      await saveJSON('salefix:revoked:'+keyHash(paymentId),{reason:event.type},PURCHASE_TTL);
      const index=await getJSON('salefix:payment:'+paymentId);
      if(index?.orderId){
        const key='salefix:order:'+index.orderId;
        const order=await getJSON(key);
        if(order?.paymentId===paymentId)await saveJSON(key,{...order,status:'revoked',revokedAt:Date.now()},PURCHASE_TTL);
      }
      await saveJSON(replayKey,{done:true},WEBHOOK_TTL);
      return res.status(200).json({received:true});
    }

    const sale=verifiedSale(event,process.env.DODO_PRODUCT_ID);
    if(!sale){
      await saveJSON(replayKey,{done:true,fulfilled:false},WEBHOOK_TTL);
      return res.status(200).json({received:true,fulfilled:false});
    }
    if((await getJSON('salefix:revoked:'+keyHash(sale.paymentId)))){
      await saveJSON(replayKey,{done:true,fulfilled:false},WEBHOOK_TTL);
      return res.status(200).json({received:true,fulfilled:false});
    }

    const orderKey='salefix:order:'+sale.orderId;
    const stored=await getJSON(orderKey);
    if(!stored||!['pending','paid'].includes(stored.status)||
       stored.paymentId&&stored.paymentId!==sale.paymentId){
      await saveJSON(replayKey,{done:true,fulfilled:false},WEBHOOK_TTL);
      return res.status(200).json({received:true,fulfilled:false});
    }
    // Store the payment before delivering; a failing email triggers provider retry
    // but never loses the verified purchase or issues an unverified entitlement.
    const record={
      ...stored,status:'paid',paymentId:sale.paymentId,email:sale.email,
      paidAt:stored.paidAt||Date.now()
    };
    await saveJSON(orderKey,record,PURCHASE_TTL);
    await saveJSON('salefix:payment:'+sale.paymentId,{orderId:sale.orderId},PURCHASE_TTL);
    // Only a hashed email index is stored. Buyer recovery looks up the order.
    await saveJSON('salefix:email:'+keyHash(sale.email),{orderId:sale.orderId},PURCHASE_TTL);

    if(!record.deliveryCompletedAt){
      const token=issueKitAccess({
        verifiedProviderEvent:true,status:'succeeded',amountCents:KIT_PRICE_CENTS,currency:'USD',
        paymentId:sale.paymentId,email:sale.email,product:record.product
      },process.env.SALEFIX_KIT_SECRET,Math.floor(record.paidAt/1000));
      await emailKitLink({
        to:sale.email,token,idempotencyKey:'salefix-purchase-'+keyHash(sale.paymentId)
      });
      await saveJSON(orderKey,{...record,deliveryCompletedAt:Date.now()},PURCHASE_TTL);
    }
    await saveJSON(replayKey,{done:true,fulfilled:true},WEBHOOK_TTL);
    return res.status(200).json({received:true});
  }catch{
    return res.status(500).json({error:'Delivery not confirmed; retry webhook.'});
  }finally{
    if(acquired){
      try{await redisCommand(['EVAL',RELEASE_LOCK,1,lock,id])}catch{}
    }
  }
}
