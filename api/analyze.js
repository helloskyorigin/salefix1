import {analyzeProduct} from '../lib/audit.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const raw=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!raw || JSON.stringify(raw).length>14_000)return res.status(400).json({error:'Request is too large.'});
    const result=await analyzeProduct(raw);
    return res.status(200).json(result);
  }catch(e){return res.status(400).json({error:String(e.message||'Could not analyze this product.')})}
}
