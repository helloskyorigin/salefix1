import {reviewProductFiles} from './file-audit.js';
import {reviewFileWithGemini} from './ai-file-review.js';
// SaleFix: lightweight, dependency-free public-page extraction + evidence-based checks.
// These recommendations use page content, not invented sales or performance data.
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

function publicIP(ip) {
  const family = net.isIP(ip);
  if (!family) return false;
  if (family === 4) {
    const p = ip.split('.').map(Number); const [a,b,c]=p;
    if (a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&b===168 || a===100&&b>=64&&b<=127 || a===192&&b===0&&c===0 || a===198&&[18,19].includes(b)) return false;
    return true;
  }
  const s=ip.toLowerCase();
  // Reject localhost, ULA, link-local, multicast, mapped, NAT64, and unusual tunnel ranges.
  if (s==='::' || s==='::1' || s.startsWith('fc') || s.startsWith('fd') || /^fe[89ab]/.test(s) || s.startsWith('ff') || s.includes(':ffff:') || s.startsWith('64:ff9b:') || s.startsWith('2002:') || s.startsWith('2001:') || s.startsWith('::ffff')) return false;
  return true;
}
export function normalizeProductUrl(input) {
  const raw=String(input??'').trim();
  if(!raw)return '';
  if(raw.length>1200||/\s/.test(raw))throw new Error('Enter a valid public domain such as google.com or https://example.com/product.');
  const candidate=/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:`https://${raw}`;
  let url;
  try{url=new URL(candidate)}catch{throw new Error('Enter a valid public domain such as google.com or https://example.com/product.')}
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only http/https product links are supported.');
  checkedUrl(url.href);
  if(!url.hostname.includes('.'))throw new Error('Enter a valid public product domain, such as google.com.');
  return url.href;
}
function checkedUrl(input) {
  const url = new URL(input);
  if (!['https:','http:'].includes(url.protocol)) throw new Error('Only http/https product links are supported.');
  if (url.username || url.password || url.port && !['80','443'].includes(url.port)) throw new Error('Please use a standard public product URL.');
  if (url.hostname==='localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal') || net.isIP(url.hostname)) throw new Error('Please use a public product URL.');
  return url;
}
async function readPage(input, hops=0) {
  if (hops>2) throw new Error('This link redirects too many times.');
  const url=checkedUrl(input);
  const addresses=await dns.lookup(url.hostname,{all:true,verbatim:true});
  const address=addresses.find(x=>publicIP(x.address));
  if (!address || addresses.some(x=>!publicIP(x.address))) throw new Error('Product link must resolve to a public website.');
  return new Promise((resolve,reject)=>{
    const mod=url.protocol==='https:'?https:http;
    const req=mod.request(url,{
      method:'GET',timeout:8500,headers:{'User-Agent':'SaleFixAuditBot/0.1 (+public sales-page review)','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'},
      // Pin DNS resolution to the already-validated public IP to reduce SSRF exposure.
      lookup(_host,_opts,cb){cb(null,address.address,address.family)}
    },res=>{
      const status=res.statusCode||500;
      if ([301,302,303,307,308].includes(status)) {
        const location=res.headers.location;res.resume();
        if (!location) return reject(new Error('The website redirected without a destination.'));
        let target;try {target=new URL(location,url).toString()} catch{return reject(new Error('Invalid redirect from product website.'))}
        readPage(target,hops+1).then(resolve,reject); return;
      }
      if (status<200||status>=300) {res.resume();return reject(new Error(`This site returned HTTP ${status}. Upload your product files instead.`))}
      if (!String(res.headers['content-type']||'').includes('text/html')) {res.resume();return reject(new Error('This link does not return an HTML sales page.'))}
      let length=0;const chunks=[];
      res.on('data',chunk=>{
        length+=chunk.length;
        if(length>850_000){req.destroy(new Error('The webpage is too large to analyze.'));return}
        chunks.push(chunk);
      });
      res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.toString()}));
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new Error('Product website timed out. Try uploading your product files instead.')));
    req.on('error',reject);req.end();
  });
}
function decoded(str='') {
  return String(str).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),65535))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),65535))).replace(/&(?:amp|lt|gt|quot|apos|nbsp|rsquo|ldquo|rdquo|ndash|mdash);/g,m=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&rsquo;':'’','&ldquo;':'“','&rdquo;':'”','&ndash;':'–','&mdash;':'—'}[m]||m));
}
function clean(value='',max=600) { return decoded(String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).slice(0,max); }
function tagContent(html,tag) {const m=html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`,'i'));return m?clean(m[1]):''}
function meta(html,name){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  const match=tags.find(t=>new RegExp(`(?:name|property)\\s*=\\s*["']${name}["']`,'i').test(t));
  return match?clean((match.match(/content\s*=\s*["']([^"']*)["']/i)||[])[1]||''):'';
}
function pageSignals(html,url) {
  const safe=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ');
  const h1=tagContent(safe,'h1');
  const title=meta(safe,'og:title')||tagContent(safe,'title')||h1||new URL(url).hostname;
  const description=meta(safe,'og:description')||meta(safe,'description')||'';
  const heads=[...safe.matchAll(/<h[2-3]\b[^>]*>([\s\S]*?)<\/h[2-3]\s*>/gi)].slice(0,18).map(x=>clean(x[1],140)).filter(Boolean);
  const actions=[...safe.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)\s*>/gi)].slice(0,160).map(x=>clean(x[1],85)).filter(Boolean);
  const text=clean(safe.replace(/<[^>]*>/g,' '),8500);
  const prices=[...text.matchAll(/(?:\$|USD\s*|₹|Rs\.?\s*)\s*\d+(?:[.,]\d{1,2})?/gi)].slice(0,5).map(x=>x[0]);
  // Use only a genuine page-provided thumbnail; never invent product artwork.
  const imageRaw=meta(safe,'og:image')||meta(safe,'twitter:image');
  let imageUrl='';
  if(imageRaw){
    try{
      const image=new URL(imageRaw,url);
      if(image.protocol==='https:'&&!image.username&&!image.password&&!net.isIP(image.hostname)&&image.hostname.includes('.')&&!/\.(?:local|internal)$/i.test(image.hostname)&&image.href.length<=1800) imageUrl=image.href;
    }catch{}
  }

  return {title:title.slice(0,145),h1,description,heads,actions,text,price:prices[0]||'',url,imageUrl,source:'Website content'};
}
function headlineFor(data,audience,benefit){
  const name=data.h1||data.title;
  const nameOnly=name.split(/\s[|–-]\s/)[0].trim().slice(0,72);
  const b=clean(benefit,150).replace(/[.!]$/,'');
  const who=clean(audience,65);
  if(b && who) return `${nameOnly}: ${b.charAt(0).toUpperCase()+b.slice(1)} — for ${who}`.slice(0,150);
  if(b) return `${nameOnly}: ${b.charAt(0).toUpperCase()+b.slice(1)}`.slice(0,150);
  if(who) return `${nameOnly} — Made for ${who}`.slice(0,150);
  if(data.description.length>35){return `${nameOnly}: ${data.description.slice(0,82).replace(/[.!]$/,'')}`.slice(0,150)}
  return `What can ${nameOnly} help you do? Make the main outcome clear.`.slice(0,150);
}
function createFindings(data, audience, benefit) {
  const out=[];
  const title=data.h1||data.title;
  const weakTitle=!data.h1 || title.length<17 || /^(home|buy now|my (guide|ebook|course|product)|welcome|product|untitled)/i.test(title);
  if(weakTitle)out.push({id:'headline',label:'Main headline needs a clearer outcome',evidence:data.h1?`Current headline: “${data.h1.slice(0,100)}”`:'No prominent H1 headline was found in the readable page.',fix:'Lead with the specific result your product delivers and who it serves.',severity:'high'});
  if(!data.description || data.description.length<55) out.push({id:'benefits',label:'Product value is hard to scan',evidence:data.description?`Description is short: “${data.description.slice(0,130)}”`:'The page did not expose a meaningful product description.',fix:'Add a concise promise and 3 factual, concrete benefits from the product.',severity:'high'});
  const purchaseActions=data.actions.filter(x=>/buy|purchase|checkout|get (it|the|instant)|download|enroll|order|add to cart/i.test(x));
  if(!purchaseActions.length)out.push({id:'cta',label:'Purchase action is not clear in extracted content',evidence:'No readable purchase-specific button text was detected.',fix:'Use an unmistakable CTA next to the offer and price.',severity:'medium'});
  if(!data.price)out.push({id:'price',label:'Price was not detectable',evidence:'No clear currency amount was found in accessible page text.',fix:'Show the actual product price close to the main purchase button.',severity:'medium'});
  if(!/faq|frequently asked|common questions/i.test(data.text))out.push({id:'faq',label:'Buyer questions may be unanswered',evidence:'No visible FAQ heading was found in extracted text.',fix:'Answer genuine questions on format, access, requirements, and support.',severity:'low'});
  if(!/review|testimonial|rating|case study/i.test(data.text))out.push({id:'proof',label:'Trust evidence was not visible',evidence:'No recognizable review or testimonial wording was detected.',fix:'Add real previews, samples, or verified testimonials if available—never fabricate reviews.',severity:'low'});
  if(!out.length)out.push({id:'clarity',label:'An opportunity to sharpen positioning',evidence:`Primary headline: “${title.slice(0,110)}”`,fix:'Test a headline that says exactly what is included and who benefits.',severity:'low'});
  // Cap to three observations and be explicit that extraction can miss dynamically rendered material.
  return out.slice(0,3);
}
async function geminiHeadline(data,audience,benefit){
  const key=process.env.GEMINI_API_KEY;
  // Do not incur billable LLM usage merely because the operator added a key.
  if(!key||process.env.SALEFIX_ENABLE_HEADLINE_AI!=='true')return '';
  const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:controller.signal,
      body:JSON.stringify({contents:[{role:'user',parts:[{text:`Suggest ONE concise, honest, specific headline for this existing product. Return only the headline, no quotes. Do not add any fact, claim, earnings, audience, outcome or timeframe that isn't provided.\nProduct title: ${data.title}\nActual H1: ${data.h1}\nDescription: ${data.description}\nAudience supplied by owner: ${audience}\nBenefit supplied by owner: ${benefit}` }]}],generationConfig:{temperature:0.3,maxOutputTokens:150}})
    });
    if(!resp.ok)return '';
    const json=await resp.json();
    const h=clean(json.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'',165).replace(/^['"“”]|['"“”]$/g,'');
    return h.length>=20&&h.length<=150?h:'';
  }catch{return ''}finally{clearTimeout(timer)}
}
export async function analyzeProduct(body){
  const url=normalizeProductUrl(body?.url);
  const audience=clean(body?.audience||'',130);
  const benefit=clean(body?.benefit||'',200);
  const manual=clean(body?.manual||'',6000);
  const productName=clean(body?.productName||'',100);
  const fileAudit=reviewProductFiles(body?.fileExtracts);
  if(fileAudit){
    // Uploaded content is the primary audit; any URL is supplementary sales-page context.
    let page=null;let pageNote='';
    if(url){try{const loaded=await readPage(url);page=pageSignals(loaded.html,loaded.url)}catch{pageNote='The optional sales-page link could not be read; the uploaded files were still inspected.'}}
    const title=productName||fileAudit.title;
    const data={title,h1:title,description:manual||fileAudit.description,price:page?.price||'',url,imageUrl:page?.imageUrl||'',source:'Uploaded product files'};
    // AI content analysis is opt-in, so an open audit endpoint cannot silently
    // incur API bills. Unverified AI claims are discarded by validateAiFindings.
    const [fromAI,aiFindings]=await Promise.all([
      geminiHeadline(data,audience,benefit),
      process.env.SALEFIX_ENABLE_FILE_AI==='true'?reviewFileWithGemini(body.fileExtracts):Promise.resolve(null)
    ]);
    const grounded=Array.isArray(aiFindings)?aiFindings:[];
    const findings=[...fileAudit.findings.filter(f=>f.severity==='high'),...grounded,...fileAudit.findings]
      .filter((f,index,all)=>all.findIndex(x=>x.id===f.id)===index).slice(0,3);
    fileAudit.reviewMethod=grounded.length?'AI-assisted with exact file quotations, plus structural checks':'Evidence-based file structure and text checks';
    return {product:{title:data.title,h1:data.h1,description:data.description,price:data.price,url,imageUrl:data.imageUrl,source:data.source},audience,benefit,issues:findings,fileAudit,salesIssues:page?createFindings(page,audience,benefit):[],improvedHeadline:fromAI||headlineFor(data,audience,benefit),headlineSource:fromAI?'AI-assisted':'Based on provided product files',note:[pageNote,`Reviewed ${fileAudit.fileCount} uploaded file(s) in the browser; raw files were not transferred to our server.`].filter(Boolean).join(' '),disclaimer:fileAudit.disclaimer};
  }
  if(!url && manual.length<60)throw new Error('Without a link, paste at least 60 characters of your real product description.');
  let data;let note='';
  if(url){
    try{
      const page=await readPage(url);
      data=pageSignals(page.html,page.url);
      if(data.text.length<110)throw new Error('Page content could not be read.');
    }catch(err){
      if(manual.length<60)throw new Error(`${err.message} Upload the product files instead, or try a public product link.`);
      data={title:productName||new URL(url).hostname,h1:productName,description:manual.slice(0,300),heads:[],actions:[],text:manual,price:(manual.match(/(?:\$|USD\s*|₹|Rs\.?\s*)\s*\d+(?:[.,]\d{1,2})?/i)||[])[0]||'',url,imageUrl:'',source:'User-provided product copy'};
      note='The original link could not be fetched; results are based on the product copy you supplied.';
    }
  }else{
    data={title:productName||'Your product',h1:productName,description:manual.slice(0,300),heads:[],actions:[],text:manual,price:(manual.match(/(?:\$|USD\s*|₹|Rs\.?\s*)\s*\d+(?:[.,]\d{1,2})?/i)||[])[0]||'',url:'',imageUrl:'',source:'User-provided product copy'};
    note='No website link was supplied. This audit uses only the product details you entered.';
  }
  const issues=createFindings(data,audience,benefit);
  const fromAI=await geminiHeadline(data,audience,benefit);
  return {product:{title:data.title,h1:data.h1,description:data.description,price:data.price,url:data.url,imageUrl:data.imageUrl||'',source:data.source},audience,benefit,issues,improvedHeadline:fromAI||headlineFor(data,audience,benefit),headlineSource:fromAI?'AI-assisted':'Based on available product details',note,disclaimer:'This is a content audit, not a prediction of actual sales. Some dynamic page sections may not be readable.'};
}
