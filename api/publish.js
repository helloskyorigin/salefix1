import {commerceReady} from '../lib/payment.js';
import {getJSON,saveJSON} from '../lib/redis.js';
import {verifyKitAccess} from '../lib/paid-kit.js';
import {pageContent} from '../lib/public-page.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!commerceReady())return res.status(503).json({error:'Publishing is not yet available.'});
  let token;
  try{token=verifyKitAccess(String(req.headers?.authorization||'').replace(/^Bearer /,''),process.env.SALEFIX_KIT_SECRET)}
  catch{return res.status(401).json({error:'Open your verified purchase access link.'})}
  try{
    const index=await getJSON('salefix:payment:'+token.id);
    const order=index?.orderId?await getJSON('salefix:order:'+index.orderId):null;
    if(!order||order.status!=='paid'||order.paymentId!==token.id||order.email!==token.email)return res.status(403).json({error:'This purchase is no longer active.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||JSON.stringify(body).length>7000)return res.status(400).json({error:'Sales-page text is too long.'});
    const origin=new URL(process.env.SALEFIX_PUBLIC_ORIGIN).origin;
    const page=pageContent(body,{origin});
    await saveJSON('salefix:page:'+index.orderId,page,365*86400);
    return res.status(200).json({url:origin+'/p/'+encodeURIComponent(index.orderId)});
  }catch(e){
    if(/title, honest headline|checkout URL/.test(e.message))return res.status(422).json({error:e.message});
    return res.status(503).json({error:'Could not publish right now. Please try again.'});
  }
}
