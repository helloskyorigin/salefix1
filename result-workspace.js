// SaleFix audit results workspace: grounded source details, usable actions and an export.
// No invented conversion scores, testimonials, customer figures or performance claims.
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text=(value,fallback='')=>String(value??'').trim()||fallback;
const safeURL=value=>{
  try{
    const u=new URL(String(value||''));
    return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:'';
  }catch{return ''}
};
const previewURL=value=>{
  try{
    const u=new URL(String(value||''));
    return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&u.href.length<=1800?u.href:'';
  }catch{return ''}
};
const sizeLabel=bytes=>{
  const value=Number(bytes);
  if(!Number.isFinite(value)||value<=0)return 'Size unknown';
  return value>=1048576?(value/1048576).toFixed(1)+' MB':Math.max(1,Math.round(value/1024))+' KB';
};
const positiveCount=(n,max=100000)=>{
  const value=Number(n);
  return Number.isFinite(value)&&value>0?Math.min(Math.floor(value),max):0;
};
export function auditFindings(result){
  const list=Array.isArray(result?.issues)?result.issues:[];
  const seen=new Set();
  return list.filter(issue=>{
    if(!issue||typeof issue!=='object'||!text(issue.label)||!text(issue.fix))return false;
    const key=(text(issue.label)+'|'+text(issue.fix)).toLowerCase().replace(/\s+/g,' ');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,8);
}
function auditKey(result){
  const source=String(result?.product?.title||'')+'|'+String(result?.product?.url||'')+'|'+auditFindings(result).map(f=>f.id+'|'+f.label+'|'+f.fix).join('|');
  let hash=2166136261;
  for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  return 'salefix-reviewed:'+((hash>>>0).toString(36));
}
export function reviewedIndexes(result){
  try{
    const raw=JSON.parse(sessionStorage.getItem(auditKey(result))||'[]');
    const max=auditFindings(result).length;
    return new Set(Array.isArray(raw)?raw.filter(i=>Number.isSafeInteger(i)&&i>=0&&i<max):[]);
  }catch{return new Set()}
}
export function markReviewed(result,index,checked){
  const count=auditFindings(result).length;
  if(!Number.isSafeInteger(index)||index<0||index>=count)return false;
  const marked=reviewedIndexes(result);
  if(checked)marked.add(index);else marked.delete(index);
  try{sessionStorage.setItem(auditKey(result),JSON.stringify([...marked].sort((a,b)=>a-b)))}catch{}
  return true;
}
function formatFindings(result){
  const findings=auditFindings(result);
  return findings.length===1?'1 finding':findings.length+' findings';
}
function sourceName(result){
  return result?.fileAudit?'From your uploaded product files':
    result?.product?.source==='User-provided product copy'?'From your provided product copy':'From readable public page content';
}
function sourceType(result){
  return result?.fileAudit?'Uploaded files':result?.product?.source==='User-provided product copy'?'Provided copy':'Public website';
}
export function auditPlainText(result){
  const product=result?.product||{};
  const findings=auditFindings(result);
  const lines=[
    'SALEFIX — FREE PRODUCT AUDIT',
    '===========================',
    '',
    'Product: '+text(product.title,'Your product'),
    'Source: '+sourceName(result),
    'Public link: '+(safeURL(product.url)||'Not provided'),
    product.price?'Price found in source: '+text(product.price):'',
    '',
    'PRODUCT DESCRIPTION',
    text(product.description,'No readable description available.'),
    '',
    'ACTIONABLE FINDINGS ('+findings.length+')',
    ...findings.flatMap((f,i)=>[
      '',
      String(i+1)+'. '+text(f.label),
      'Observed: '+text(f.evidence,'No additional evidence excerpt was provided.'),
      'Recommended: '+text(f.fix)
    ]),
    '',
    'HEADLINE: BEFORE → SUGGESTED',
    'Original: '+text(product.h1||product.title,'No readable headline found'),
    'Suggested: '+text(result?.improvedHeadline,'No revised headline available'),
    'Suggestion source: '+text(result?.headlineSource,'Based on available details'),
  ];
  if(result?.fileAudit){
    lines.push('','INSPECTED FILES');
    const files=Array.isArray(result.fileAudit.files)?result.fileAudit.files:[];
    for(const f of files)lines.push('- '+text(f.name,'Unnamed file')+' — '+(f.inspected?'Readable content inspected':'Metadata only'));
    if(Array.isArray(result.fileAudit.notices)&&result.fileAudit.notices.length)lines.push('','FILE LIMITATIONS',...result.fileAudit.notices.map(x=>'- '+text(x)));
  }
  if(Array.isArray(result?.salesIssues)&&result.salesIssues.length){
    lines.push('','ADDITIONAL SALES-PAGE FINDINGS');
    for(const issue of result.salesIssues.slice(0,8)){
      lines.push('- '+text(issue.label)+' | Evidence: '+text(issue.evidence)+' | Suggested action: '+text(issue.fix));
    }
  }
  if(result?.note)lines.push('','SOURCE NOTE',String(result.note));
  lines.push('','IMPORTANT LIMITATIONS',text(result?.disclaimer,'This report reflects only the readable content supplied. It does not predict sales.'),'','Content recommendations, not a sales score or a prediction of purchases.','Review facts, prices and claims before publishing.','Generated with SaleFix.');
  return lines.filter(x=>x!==null&&x!==undefined).join('\n');
}
function sourceFiles(result,icon){
  const review=result?.fileAudit;
  if(!review)return '';
  const files=Array.isArray(review.files)?review.files.slice(0,8):[];
  const rows=files.map(f=>{
    const facts=[text(f.ext).toUpperCase(),sizeLabel(f.size)];
    if(positiveCount(f.pages))facts.push(positiveCount(f.pages)+' pages');
    if(positiveCount(f.slides))facts.push(positiveCount(f.slides)+' slides');
    if(positiveCount(f.sheets))facts.push(positiveCount(f.sheets)+' sheets');
    if(Array.isArray(f.entries)&&f.entries.length)facts.push(f.entries.length+' entries');
    return '<li class="rv-source-file"><span class="rv-file-icon">'+icon('layers',19)+'</span><span class="rv-file-main"><strong>'+esc(text(f.name,'Unnamed file'))+'</strong><small>'+esc(facts.filter(Boolean).join(' · '))+'</small></span><span class="rv-file-state '+(f.inspected?'is-read':'')+'">'+(f.inspected?'Text inspected':'Metadata only')+'</span></li>';
  }).join('');
  const notices=Array.isArray(review.notices)?review.notices.filter(Boolean).slice(0,12):[];
  return '<div class="rv-coverage-block"><h3>Uploaded content</h3><ul class="rv-source-files">'+(rows||'<li>No file inventory available.</li>')+'</ul>'+
    (notices.length?'<details class="rv-coverage-notes"><summary>'+icon('alert',16)+' What could not be verified ('+notices.length+')</summary><ul>'+notices.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></details>':'')+
    (review.reviewMethod?'<p class="rv-review-method">'+esc(review.reviewMethod)+'</p>':'')+
    '</div>';
}
function findingsSection(result,icon){
  const items=auditFindings(result),reviewed=reviewedIndexes(result);
  const cards=items.map((item,i)=>{
    const flagged=item.severity==='high'?'High priority':item.severity==='medium'?'Worth reviewing':'Suggestion';
    const evidence=text(item.evidence,'The source did not provide a specific evidence excerpt.');
    return '<article class="rv-fix '+(reviewed.has(i)?'is-reviewed':'')+'" id="rv-fix-'+i+'">'+
      '<div class="rv-fix-top"><span class="rv-fix-number">'+String(i+1).padStart(2,'0')+'</span><div class="rv-fix-topcopy"><span class="rv-fix-eyebrow">'+esc(flagged)+'</span><h3>'+esc(item.label)+'</h3></div></div>'+
      '<div class="rv-fix-grid"><div class="rv-evidence"><span class="rv-mini-label">'+icon('eye',15)+' What we observed</span><p>'+esc(evidence)+'</p></div>'+
      '<div class="rv-recommend"><span class="rv-mini-label">'+icon('checkcircle',15)+' What to change</span><p>'+esc(item.fix)+'</p></div></div>'+
      '<div class="rv-fix-actions"><button class="rv-link-button" type="button" data-rv-copy-fix="'+i+'">'+icon('text',16)+' Copy fix</button><span class="rv-fix-feedback" id="rv-fix-feedback-'+i+'" role="status" aria-live="polite"></span>'+
      '<label class="rv-review-label"><input type="checkbox" data-rv-reviewed="'+i+'" '+(reviewed.has(i)?'checked':'')+'/><span>Mark reviewed</span></label></div>'+
      '</article>';
  }).join('');
  return '<section class="rv-section rv-findings" id="rv-findings" aria-labelledby="rv-findings-heading">'+
    '<div class="rv-section-heading"><div><span class="rv-kicker">02 / ACTION PLAN</span><h2 id="rv-findings-heading">'+(result.fileAudit?'Product audit — key findings':'Sales audit — key findings')+'</h2><p>Practical changes based on content we could inspect—not assumptions about your revenue.</p></div>'+
    '<div class="rv-reviewed-status" aria-live="polite"><strong data-rv-reviewed-count>'+reviewed.size+' of '+items.length+'</strong><span>reviewed</span></div></div>'+
    '<div class="rv-fix-stack">'+(cards||'<div class="rv-empty-findings">'+icon('checkcircle',23)+'<div><strong>No specific problems identified in readable text.</strong><p>That does not mean the product is perfect. Review the headline suggestion and source limitations below.</p></div></div>')+'</div>'+
    '<p class="rv-findings-foot">'+icon('shield',16)+' Content recommendations, not a sales score or a prediction of purchases.</p></section>';
}
function headlineSection(result,icon){
  const product=result.product||{};
  const before=text(product.h1||product.title,'No readable headline found');
  const after=text(result.improvedHeadline,'No revised headline is available for this product.');
  const hasSuggestion=Boolean(text(result.improvedHeadline));
  const same=before.toLowerCase()===after.toLowerCase();
  return '<section class="rv-section rv-headline" id="rv-headline" aria-labelledby="rv-headline-heading">'+
    '<div class="rv-section-heading"><div><span class="rv-kicker">03 / MESSAGE MAKEOVER</span><h2 id="rv-headline-heading">Your first impression, reworked.</h2>'+
    '<p>Compare what we saw with suggested wording. Use it only if it accurately describes your product.</p></div></div>'+
    '<div class="rv-headline-pair"><div class="rv-headline-tile rv-original"><div class="rv-headline-tile-top"><span>FROM YOUR SOURCE</span><small>Original</small></div><div class="rv-headline-copy">'+esc(before)+'</div></div>'+
    '<div class="rv-headline-divider" aria-hidden="true">'+icon('arrow',20)+'</div><div class="rv-headline-tile rv-suggested"><div class="rv-headline-tile-top"><span>SALEFIX SUGGESTION</span><small>'+(same?'Unchanged':'Alternative')+'</small></div><div class="rv-headline-copy">'+esc(after)+'</div></div></div>'+
    '<div class="rv-headline-bottom"><span>'+icon('spark',16)+' '+esc(text(result.headlineSource,'Based on available product information'))+'</span>'+
    (hasSuggestion?'<button type="button" class="rv-button rv-button-secondary rf-copy-btn" data-copy-headline="1" aria-label="Copy suggested headline">'+icon('text',17)+' Copy suggested headline</button>':'')+
    '</div><p class="rf-copy-feedback" role="status" aria-live="polite"></p></section>';
}
function productSection(result,icon){
  const product=result.product||{},url=safeURL(product.url),image=previewURL(product.imageUrl);
  const cover=image?'<img class="rv-cover-img" src="'+esc(image)+'" loading="lazy" referrerpolicy="no-referrer" alt="Product image from the source page"/>':
    '<div class="rv-cover-fallback" aria-hidden="true">'+icon('layers',37)+'<span>PRODUCT<br/>REVIEW</span></div>';
  return '<section class="rv-section rv-product" id="rv-overview" aria-labelledby="rv-product-heading">'+
    '<div class="rv-section-heading"><div><span class="rv-kicker">01 / PRODUCT SNAPSHOT</span><h2 id="rv-product-heading">What we reviewed</h2><p>This is the product context our recommendations are based on.</p></div></div>'+
    '<div class="rv-product-layout"><div class="rv-cover">'+cover+'</div><div class="rv-product-details"><h3>'+esc(text(product.title,'Your product'))+'</h3>'+
    '<p>'+esc(text(product.description,'No readable product description was available from the supplied source.'))+'</p>'+
    '<div class="rv-product-meta"><span>'+icon('shield',16)+' '+esc(sourceName(result))+'</span>'+
    (product.price?'<span>'+icon('bolt',16)+' Source price: '+esc(product.price)+'</span>':'')+
    (url?'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">'+icon('external',16)+' Visit original page</a>':'')+
    '</div></div></div></section>';
}
function coverageSection(result,icon){
  const url=safeURL(result?.product?.url),file=Boolean(result?.fileAudit);
  const publicSite=url?new URL(url).hostname.replace(/^www\./,''):'';
  const sourceNote=text(result.note),disclaimer=text(result.disclaimer,'This audit covers only readable content. Some pages or files may not be fully accessible.');
  const extra=Array.isArray(result?.salesIssues)?result.salesIssues.filter(f=>f?.label&&f?.fix).slice(0,6):[];
  return '<section class="rv-section rv-coverage" id="rv-coverage" aria-labelledby="rv-coverage-heading">'+
    '<div class="rv-section-heading"><div><span class="rv-kicker">04 / TRANSPARENCY</span><h2 id="rv-coverage-heading">What this audit could see</h2><p>Useful recommendations start with honest source coverage.</p></div></div>'+
    '<div class="rv-coverage-status">'+icon('shield',20)+'<span>'+esc(sourceName(result))+'</span></div>'+
    (url?'<p class="rv-source-url">'+icon('globe',16)+' Public source: <a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">'+esc(publicSite)+'</a></p>':'')+
    sourceFiles(result,icon)+
    (extra.length?'<details class="rv-coverage-notes"><summary>'+icon('layers',16)+' Separate sales-page observations ('+extra.length+')</summary><div class="rv-extra-findings">'+extra.map(f=>'<article><h3>'+esc(f.label)+'</h3><p>'+esc(text(f.evidence))+'</p><strong>'+esc(f.fix)+'</strong></article>').join('')+'</div></details>':'')+
    (sourceNote?'<div class="rv-source-note">'+icon('alert',17)+'<p>'+esc(sourceNote)+'</p></div>':'')+
    '<p class="rv-limits">'+icon('shield',17)+' '+esc(disclaimer)+'</p></section>';
}
function paidSection(icon){
  return '<section class="rv-paid-card" id="rv-paid" aria-labelledby="rv-paid-heading">'+
    '<div class="rv-paid-head"><span class="rv-paid-symbol">'+icon('spark',21)+'</span><span>OPTIONAL NEXT STEP</span></div>'+
    '<h2 id="rv-paid-heading">Turn your audit into launch assets.</h2><p>Use this free report as your starting point, then create ready-to-edit materials for the same product.</p>'+
    '<div class="rv-paid-amount"><strong>$29</strong><span>one-time<br/>per product</span></div>'+
    '<ul class="rv-paid-list"><li>'+icon('check',16)+' Editable sales-page HTML</li><li>'+icon('check',16)+' 10 marketing posts</li><li>'+icon('check',16)+' 3 promotional SVG graphics</li><li>'+icon('check',16)+' Buyer replies &amp; 7-day plan</li><li>'+icon('check',16)+' Complete ZIP download</li></ul>'+
    '<button type="button" class="rv-button rv-button-primary" id="unlock-button">Explore the $29 Sales Kit '+icon('arrow',18)+'</button>'+
    '<small>Payment availability is checked at checkout. No sales outcomes are promised.</small></section>';
}
export function renderAuditWorkspace(result,icon,header,footer){
  if(!result?.product||!Array.isArray(result.issues))return header(true)+'<main class="container empty-state surface" role="status"><h1>No audit available</h1><p>Upload your product file or paste a sales-page link to begin.</p><a class="button button-primary" href="#/analyze">Analyze a product '+icon('arrow',18)+'</a></main>'+footer();
  const product=result.product,items=auditFindings(result);
  const fileCount=positiveCount(result.fileAudit?.fileCount,50);
  const sourceCount=fileCount?fileCount+' file'+(fileCount===1?'':'s'):'1 source';
  const hasHeadline=Boolean(text(result.improvedHeadline));
  return header(true)+'<main class="container workspace results-v3" id="rv-report">'+
    '<nav class="rv-steps" aria-label="Audit progress"><span>'+icon('checkcircle',17)+' Product submitted</span><i></i><span>'+icon('checkcircle',17)+' Content reviewed</span><i></i><strong aria-current="step">Your report</strong></nav>'+
    '<section class="rv-hero"><div class="rv-hero-copy"><span class="rv-top-eyebrow"><span></span> FREE PRODUCT REPORT</span><h1>Your next improvements, <em>clearly.</em></h1>'+
    '<p>We reviewed the information available for <strong>'+esc(text(product.title,'your product'))+'</strong>. Here are practical things you can change—without made-up conversion numbers.</p>'+
    '<div class="rv-hero-actions"><button type="button" data-rv-download="1" class="rv-button rv-button-primary">'+icon('download',19)+' Download free report</button><a href="#/analyze" class="rv-button rv-button-secondary">'+icon('refresh',17)+' Analyze another</a></div>'+
    '<p class="rv-hero-caption">'+icon('shield',15)+' Evidence first. No invented performance scores.</p></div>'+
    '<div class="rv-snapshot"><div class="rv-snapshot-top"><span>YOUR AUDIT AT A GLANCE</span><span class="rv-snapshot-glint">'+icon('spark',20)+'</span></div>'+
    '<div class="rv-snapshot-main"><strong>'+items.length+'</strong><span>Actionable<br/>findings</span></div>'+
    '<div class="rv-snapshot-rule"></div><div class="rv-snapshot-facts"><div><small>SOURCE REVIEWED</small><strong>'+esc(sourceType(result))+'</strong></div><div><small>SOURCE MATERIAL</small><strong>'+esc(sourceCount)+'</strong></div><div><small>HEADLINE</small><strong>'+(hasHeadline?'Suggestion included':'Not available')+'</strong></div></div>'+
    '<p>These are content observations, not verified traffic or sales results.</p></div></section>'+
    '<div class="rv-jumpnav" role="navigation" aria-label="Report sections"><span>Jump to</span>'+
    '<button type="button" data-rv-jump="rv-overview">Overview</button><button type="button" data-rv-jump="rv-findings">Action plan</button>'+
    '<button type="button" data-rv-jump="rv-headline">Headline</button><button type="button" data-rv-jump="rv-coverage">Sources</button></div>'+
    '<div class="rv-workspace-grid"><div class="rv-maincol">'+productSection(result,icon)+findingsSection(result,icon)+headlineSection(result,icon)+'</div>'+
    '<aside class="rv-sidecol" aria-label="Report source details and next steps">'+coverageSection(result,icon)+paidSection(icon)+'</aside></div>'+
    '<div class="rv-bottom-bar"><div>'+icon('shield',19)+'<span><strong>Your report is yours to use.</strong><small>Review claims, copy what helps, and keep the downloadable report for reference.</small></span></div>'+
    '<button type="button" class="rv-button rv-button-secondary" data-rv-download="1">'+icon('download',17)+' Save report</button></div>'+
    '</main>'+footer();
}
