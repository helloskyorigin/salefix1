import {analyzeProduct} from '../lib/audit.js';
import {enforceRateLimit} from '../lib/rate-limit.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const type=String(req.headers?.['content-type']||'application/json').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')return res.status(415).json({error:'Submit JSON product details.'});
  try{
    const limit=await enforceRateLimit(req,'audit',{limit:12,windowSeconds:3600});
    if(!limit.allowed){
      res.setHeader('Retry-After',String(limit.retryAfter));
      return res.status(limit.status).json({error:limit.reason});
    }
    const raw=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!raw||Array.isArray(raw)||typeof raw!=='object'||JSON.stringify(raw).length>85_000)return res.status(400).json({error:'Request is too large or invalid.'});
    const result=await analyzeProduct(raw);
    return res.status(200).json(result);
  }catch(e){
    if(/storage|redis|unavailable/i.test(String(e.message||'')))return res.status(503).json({error:'Analysis is temporarily unavailable. Please try later.'});
    return res.status(400).json({error:String(e.message||'Could not analyze this product.')});
  }
}
