import crypto from 'node:crypto';
import {commerceReady,KIT_PRICE_CENTS} from '../lib/payment.js';
import {getJSON,keyHash} from '../lib/redis.js';
import {enforceRateLimit} from '../lib/rate-limit.js';
import {issueKitAccess} from '../lib/paid-kit.js';

// Redirect is NEVER proof of payment. Only the signed webhook-written paid order
// may be claimed, and only by someone holding its random checkout receipt secret.
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Purchase verification is not configured.'});
  try{
    const limit=await enforceRateLimit(req,'claim',{limit:90,windowSeconds:900});
    if(!limit.allowed){res.setHeader('Retry-After',String(limit.retryAfter));return res.status(limit.status).json({error:limit.reason})}
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const id=String(body?.orderId||''),secret=String(body?.claimSecret||'');
    if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(secret))return res.status(400).json({error:'Invalid purchase receipt.'});
    const record=await getJSON('salefix:order:'+id);
    const actual=Buffer.from(keyHash(secret));
    const expected=Buffer.from(String(record?.claimHash||''));
    if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return res.status(403).json({error:'This purchase receipt could not be verified.'});
    if(record.status==='revoked')return res.status(403).json({error:'This purchase is no longer active. Contact support.'});
    if(record.status!=='paid')return res.status(202).json({state:'pending',message:'Waiting for verified payment confirmation.'});
    if(!record.paymentId||!record.email||!record.product?.title)return res.status(503).json({error:'Order verification is incomplete.'});
    const index=await getJSON('salefix:payment:'+record.paymentId);
    if(index?.orderId!==id)return res.status(503).json({error:'Purchase is pending verification.'});
    const token=issueKitAccess({
      verifiedProviderEvent:true,status:'succeeded',amountCents:KIT_PRICE_CENTS,
      currency:'USD',paymentId:record.paymentId,email:record.email,product:record.product
    },process.env.SALEFIX_KIT_SECRET);
    return res.status(200).json({state:'paid',token});
  }catch(e){
    if(/storage|redis|unavailable/i.test(String(e.message||'')))return res.status(503).json({error:'Purchase verification is temporarily unavailable.'});
    return res.status(503).json({error:'Could not verify your purchase right now.'});
  }
}
