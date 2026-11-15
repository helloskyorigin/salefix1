import {commerceReady,emailKitLink,KIT_PRICE_CENTS} from '../lib/payment.js';
import {getJSON,keyHash} from '../lib/redis.js';
import {enforceRateLimit} from '../lib/rate-limit.js';
import {issueKitAccess} from '../lib/paid-kit.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Email access recovery is not ready yet.'});
  try{
    const limit=await enforceRateLimit(req,'recover',{limit:3,windowSeconds:3600});
    if(!limit.allowed){res.setHeader('Retry-After',String(limit.retryAfter));return res.status(limit.status).json({error:limit.reason})}
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const email=String(body?.email||'').trim().toLowerCase();
    if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid purchase email.'});
    const index=await getJSON('salefix:email:'+keyHash(email));
    if(index?.orderId){
      const order=await getJSON('salefix:order:'+index.orderId);
      if(order?.status==='paid'&&order.email===email){
        const token=issueKitAccess({verifiedProviderEvent:true,status:'succeeded',
          amountCents:KIT_PRICE_CENTS,currency:'USD',paymentId:order.paymentId,email,product:order.product
        },process.env.SALEFIX_KIT_SECRET);
        await emailKitLink({to:email,token});
      }
    }
    // Always give the same answer to avoid disclosing which addresses purchased.
    return res.status(200).json({message:'If this email has an active SaleFix purchase, a new link will arrive shortly.'});
  }catch{return res.status(503).json({error:'Recovery is temporarily unavailable. Please try again later.'})}
}
