import {verifyKitAccess,buildPaidKit} from '../lib/paid-kit.js';
import {commerceReady} from '../lib/payment.js';
import {getJSON} from '../lib/redis.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.SALEFIX_KIT_SECRET;
  if(!secret||secret.length<32)return res.status(503).json({error:'Secure paid access is not configured yet.'});
  try{
    const header=String(req.headers.authorization||'');
    if(!header.startsWith('Bearer '))return res.status(401).json({error:'Open your verified purchase access link.'});
    const verified=verifyKitAccess(header.slice(7),secret);
    // Once live commerce is enabled, a signature alone is not enough: a refund,
    // dispute or revoked order must immediately disable the purchased kit.
    if(commerceReady()){
      const index=await getJSON('salefix:payment:'+verified.id);
      const order=index?.orderId?await getJSON('salefix:order:'+index.orderId):null;
      if(!order||order.status!=='paid'||order.paymentId!==verified.id||order.email!==verified.email){
        return res.status(403).json({error:'Your access is no longer active. Contact support.'});
      }
    }else if(process.env.VERCEL==='1'){
      return res.status(503).json({error:'Secure paid access is not available yet.'});
    }
    return res.status(200).json({kit:buildPaidKit(verified)});
  }catch(err){
    if(/storage|redis|unavailable/i.test(String(err.message)))return res.status(503).json({error:'Purchase verification is temporarily unavailable.'});
    return res.status(403).json({error:'Purchase access could not be verified.'});
  }
}
