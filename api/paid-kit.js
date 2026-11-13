import {verifyKitAccess, buildPaidKit} from '../lib/paid-kit.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.SALEFIX_KIT_SECRET;
  if(!secret || secret.length<32)return res.status(503).json({error:'Secure paid access is not configured yet.'});
  try {
    const header=String(req.headers.authorization||'');
    if(!header.startsWith('Bearer '))return res.status(401).json({error:'Open your verified purchase access link.'});
    const verified=verifyKitAccess(header.slice(7),secret);
    return res.status(200).json({kit:buildPaidKit(verified)});
  }catch(err){return res.status(403).json({error:String(err.message||'Purchase access could not be verified.')});}
}
