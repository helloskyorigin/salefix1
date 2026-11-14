import net from 'node:net';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const plain=(value,max=1800)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
export function validatePublicLink(value,origin=''){
  const raw=String(value??'').trim();
  if(!raw)return '';
  let url;
  try{url=new URL(raw)}catch{return ''}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||net.isIP(url.hostname)||!url.hostname.includes('.')||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal')||url.href.length>1800)return '';
  if(origin&&url.origin===origin&&url.pathname.startsWith('/p/'))return '';
  return url.href;
}
export function pageContent(body,{origin='' }={}){
  const title=plain(body?.title,140),headline=plain(body?.headline,180),description=plain(body?.description,1800);
  const checkoutUrl=validatePublicLink(body?.checkoutUrl,origin);
  if(title.length<3||headline.length<10||description.length<30||!checkoutUrl)throw Error('A title, honest headline, 30+ character description and real product checkout URL are required.');
  return {title,headline,description,checkoutUrl};
}
export function htmlPage(page){
  const title=escapeHTML(page.title),headline=escapeHTML(page.headline),summary=escapeHTML(page.description),url=escapeHTML(page.checkoutUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="referrer" content="strict-origin-when-cross-origin"/><meta name="description" content="${summary.slice(0,155)}"/><title>${title}</title><style>:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#112241;background:#f7faff}*{box-sizing:border-box}body{margin:0}.wrap{width:min(100% - 40px,940px);margin:auto}.nav{padding:26px 0;font-size:17px;font-weight:800;color:#2156bb}.hero{padding:86px 0 105px}h1{font-size:clamp(38px,7vw,74px);line-height:1.07;letter-spacing:-.055em;max-width:880px;margin:0 0 28px;overflow-wrap:anywhere}p{color:#526381;max-width:690px;font-size:clamp(17px,2vw,20px);line-height:1.7;white-space:pre-wrap}.cta{display:inline-flex;margin-top:25px;background:#145bea;color:white;text-decoration:none;border-radius:15px;padding:16px 26px;font-weight:800}.cta:focus-visible{outline:3px solid #4a7be9;outline-offset:4px}footer{border-top:1px solid #dce4f2;padding:24px 0 40px;color:#697691;font-size:13px}</style></head><body><div class="wrap"><header class="nav">${title}</header><main class="hero"><h1>${headline}</h1><p>${summary}</p><a class="cta" href="${url}" rel="nofollow noopener noreferrer">See the product and checkout →</a></main><footer>Review the seller's complete product details, pricing, delivery terms and refund conditions before purchasing. This page was created using SaleFix.</footer></div></body></html>`;
}
