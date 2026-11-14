import {getJSON} from '../lib/redis.js';
import {htmlPage} from '../lib/public-page.js';
export default async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).send('Method not allowed');
  const slug=String(req.query?.slug||new URL(req.url||'/', 'https://salefix.invalid').searchParams.get('slug')||'');
  if(!/^[a-f0-9-]{36}$/.test(slug))return res.status(404).send('Sales page not found.');
  try{
    const [page,order]=await Promise.all([getJSON('salefix:page:'+slug),getJSON('salefix:order:'+slug)]);
    if(!page||order?.status!=='paid')return res.status(404).send('Sales page not found.');
    const body=htmlPage(page);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=120');
    return res.status(200).send(req.method==='HEAD'?'':body);
  }catch{return res.status(503).send('Page temporarily unavailable.')}
}
