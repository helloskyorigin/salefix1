import crypto from 'node:crypto';
import {checkoutProduct,commerceReady,createDodoSession,productCheckoutLink} from '../lib/payment.js';
import {saveJSON} from '../lib/redis.js';
import {enforceRateLimit} from '../lib/rate-limit.js';

// This route cannot charge or redirect a buyer until ALL merchant, fulfillment,
// webhook and durable storage credentials are configured server-side.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Secure checkout is not available yet.'});
  try{
    const limit=await enforceRateLimit(req,'checkout',{limit:4,windowSeconds:3600});
    if(!limit.allowed){res.setHeader('Retry-After',String(limit.retryAfter));return res.status(limit.status).json({error:limit.reason})}
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||JSON.stringify(body).length>8000)return res.status(400).json({error:'Invalid product details.'});
    const product=checkoutProduct(body.product);
    const orderId=crypto.randomUUID();
    product.url=productCheckoutLink(product,orderId,process.env.SALEFIX_PUBLIC_ORIGIN);
    await saveJSON('salefix:order:'+orderId,{id:orderId,status:'pending',product,createdAt:Date.now()},90*86400);
    const session=await createDodoSession({orderId});
    return res.status(200).json({checkoutUrl:session.checkoutUrl});
  }catch(e){
    return res.status(503).json({error:'Checkout could not be started. No charge was made. Please try again later.'});
  }
}
