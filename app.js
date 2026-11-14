import {legalContent, SUPPORT_EMAIL} from './legal-content.js';
import {kitShell, hydrateKit} from './kit-dashboard.js';
import {extractProductFiles} from './product-extractor.js';
const $=s=>document.querySelector(s);
const safe=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const paths={
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',link:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
 check:'<path d="m5 12 4 4L19 6"/>',checkcircle:'<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
 spark:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 19l.6 1.5L21 21l-1.4.5L19 23l-.6-1.5L17 21l1.4-.5L19 19Z"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
 chart:'<path d="M3 3v18h18M7 16V9M12 16V5M17 16v-5"/>',
 megaphone:'<path d="m3 11 18-5v12L3 13v-2ZM7 13l2 7h4l-3-6"/>',
 globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a16 16 0 0 1 0 20M12 2a16 16 0 0 0 0 20"/>',
 lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 alert:'<circle cx="12" cy="12" r="10"/><path d="M12 7v6m0 4h.01"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
 text:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 bolt:'<path d="m13 2-9 11h7l-1 9 10-12h-7l0-8Z"/>',
 external:'<path d="M14 4h6v6M20 4l-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>'
};
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;
const logo=()=>`<a href="#/" class="logo" aria-label="SaleFix home"><img src="/assets/salefix-logo.png" alt=""/><span>SaleFix</span></a>`;
const state={url:'',manual:'',results:null,error:'',activeFaq:-1,analyzing:false,scanStarted:0};
try{state.results=JSON.parse(sessionStorage.getItem('salefix-analysis')||'null');}catch{}
let activeAnalysisController=null;
let selectedProductFiles=[];
const formatFileSize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
function selectProductFiles(files){
  const list=Array.from(files||[]);
  const valid=/\.(?:pdf|zip|docx|xlsx|pptx|epub|txt|md|csv|tsv|json|png|jpg|jpeg|webp|svg)$/i;
  let error='';
  if(list.length>3)error='Choose up to 3 files at a time.';
  else if(list.some(f=>!f.name||!valid.test(f.name)))error='Unsupported file format. Use PDF, ZIP, Office, EPUB, text, CSV, JSON or an image.';
  else if(list.some(f=>!f.size||f.size>20_000_000))error='Each product file must be non-empty and 20 MB or less.';
  else if(list.reduce((sum,f)=>sum+f.size,0)>45_000_000)error='Combined product files must be 45 MB or less.';
  if(error){selectedProductFiles=[];state.error=error;nav('analyze');return false;}
  selectedProductFiles=list;state.error='';updateSelectedFiles();return true;
}
function updateSelectedFiles(){const target=$('#selected-product-files');if(!target)return;target.innerHTML=selectedProductFiles.length?selectedProductFiles.map(f=>`<span class="pf-file-pill">${icon('checkcircle',14)} ${safe(f.name)} <small>${formatFileSize(f.size)}</small></span>`).join(''):'';const clear=$('#clear-product-files');if(clear)clear.hidden=!selectedProductFiles.length;}
function nav(route){if(route!=='loading'&&state.analyzing&&routeFromHash()==='loading'){activeAnalysisController?.abort();state.analyzing=false;}location.hash=`#/${route||''}`;window.scrollTo({top:0,behavior:'instant'});render()}
function header(compact=false){return `<header class="site-header"><div class="container header-inner">${logo()}<nav class="nav-links"><a href="#/#how">How it works</a><a href="#/#features">Features</a><a href="#/#pricing">Pricing</a><a href="#/#faq">FAQ</a></nav><a class="button button-primary button-small" href="#/analyze">${compact?'New analysis':'Analyze my product'} ${icon('arrow',15)}</a></div></header>`}
function footer(){return `<footer class="footer container"><div>${logo()}<p>Clearer offers. Better first impressions.</p><a class="footer-email" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></div><div class="footer-right"><span>© ${new Date().getFullYear()} SaleFix</span><a href="#/contact">Contact</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/refunds">Refunds</a></div></footer>`}
function browserWindow(inner,extra=''){return `<div class="browser-window ${extra}"><div class="browser-top"><span></span><span></span><span></span></div>${inner}</div>`}
function mockMiniPage(after=false){return browserWindow(`<div class="mini-page ${after?'after':''}"><div class="mini-lines">${after?'<strong>Build your next project<br/>with a clear plan.</strong>':'<strong>My Digital Guide</strong>'}<i></i><i></i>${after?'<div class="mock-cta">Get the guide</div>':'<div class="mock-cta gray">Buy now</div>'}</div><div class="mini-cover">${icon('spark',29)}</div></div>`)}
function sectionHeading(eyebrow,title,subtitle){return `<div class="section-head"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${subtitle}</p></div>`}
function landing(){
return `${header()}
<main class="landing-page">
  <section class="container lf-hero" aria-labelledby="landing-title">
    <div class="lf-hero-copy">
      <span class="pill softblue lf-kicker">${icon('spark',15)} Digital Product Audit</span>
      <h1 id="landing-title">Turn your product into a <span>better-selling</span> offer.</h1>
      <p>Check what's inside your digital product — PDFs, ZIP toolkits, templates and more. Get actionable improvements for the product itself and how you sell it.</p>
      <a class="button button-primary lf-hero-start" href="#/analyze">Analyze My Product ${icon('arrow',18)}</a>
      <p class="lf-hero-hint">Upload your product or paste its link. No extra questions.</p>
      <div class="lf-trust"><span>${icon('checkcircle',15)} No signup</span><span>${icon('checkcircle',15)} Free analysis</span><span>${icon('checkcircle',15)} No card required</span></div>
    </div>
    <div class="lf-hero-art" aria-label="Illustration of a SaleFix sales kit and product sales page">
      <div class="lf-art-halo"></div>
      <div class="lf-art-checklist surface">
        <div class="lf-art-heading"><span class="lf-art-logo">${icon('bolt',16)}</span> <b>SaleFix: Your Sales Kit</b></div>
        <div>${icon('layers',17)} Improved Sales Page <span class="lf-art-tick">${icon('check',13)}</span></div>
        <div>${icon('text',17)} 10 Marketing Posts <span class="lf-art-tick">${icon('check',13)}</span></div>
        <div>${icon('chart',17)} 3 Promotional Graphics <span class="lf-art-tick">${icon('check',13)}</span></div>
        <div>${icon('person',17)} Reply Templates <span class="lf-art-tick">${icon('check',13)}</span></div>
      </div>
      <div class="lf-art-page surface">
        <div class="lf-window-dots"><i></i><i></i><i></i></div>
        <div class="lf-art-page-content"><div><strong>Your Product<br/>Sales Page</strong><i></i><i class="short"></i><span></span></div><div class="lf-art-product-icon">${icon('lock',28)}</div></div>
      </div>
    </div>
    <div class="lf-mobile-proof" aria-label="What SaleFix can create">
      <div class="lf-mobile-proof-top"><span class="lf-art-logo">${icon('bolt',15)}</span><strong>Your SaleFix kit</strong><span class="lf-proof-pill">Preview</span></div>
      <div class="lf-mobile-proof-items"><span>${icon('checkcircle',17)} Improved sales copy</span><span>${icon('checkcircle',17)} Ready-to-post content</span></div>
      <div class="lf-mobile-proof-mini"><span class="lf-mini-lines"><strong>Your better sales page</strong><i></i><i></i><small>Direct checkout link</small></span><span class="lf-mini-icon">${icon('spark',27)}</span></div>
    </div>
  </section>

  <section class="container lf-features" id="features" aria-label="SaleFix features">
    <div class="lf-feature-strip surface">
      <div class="lf-feature"><span class="lf-feature-icon purple">${icon('bolt',25)}</span><div><strong>Product Content Audit</strong><small>Find what to fix</small></div></div>
      <div class="lf-feature"><span class="lf-feature-icon blue">${icon('layers',25)}</span><div><strong>Sales Page Builder</strong><small>A clearer sales page</small></div></div>
      <div class="lf-feature"><span class="lf-feature-icon purple">${icon('megaphone',25)}</span><div><strong>Marketing Kit</strong><small>Posts, graphics &amp; replies</small></div></div>
      <div class="lf-feature"><span class="lf-feature-icon blue">${icon('link',25)}</span><div><strong>One-Click Publish</strong><small>Planned for paid launch</small></div></div>
    </div>
  </section>

  <section class="container lf-audit-and-compare" id="preview" aria-label="How the free product audit works">
    <article class="surface lf-audit-card">
      <span class="pill lightgreen">Free Preview</span>
      <h2>Your Product Audit</h2>
      <p>We review your actual available product content for:</p>
      <div class="lf-audit-issue">${icon('scan',18)} <span>Whether the headline names a concrete benefit.</span></div>
      <div class="lf-audit-issue">${icon('text',18)} <span>How clearly the product details explain the offer.</span></div>
      <div class="lf-audit-issue">${icon('link',18)} <span>Whether buyers can identify the purchase action.</span></div>
      <div class="lf-headline-tip"><span>${icon('spark',15)} Specific Headline Suggestions</span><strong>Get wording suggestions based on your real product details.</strong></div>
    </article>
    <article class="surface lf-comparison-card">
      <h2>Before vs After</h2><p>See how a clearer message differs from a generic offer.</p>
      <div class="lf-compare-row">
        <div class="lf-compare-side"><span class="tag tag-red">Before</span><div class="lf-compare-browser"><div class="lf-window-dots"><i></i><i></i><i></i></div><div class="lf-compare-before"><strong>General Product<br/>Headline</strong><i></i><i></i><span class="lf-compare-cta muted">Buy Now</span></div></div></div>
        <div class="lf-compare-arrow">${icon('arrow',19)}</div>
        <div class="lf-compare-side"><span class="tag tag-green">After</span><div class="lf-compare-browser"><div class="lf-window-dots"><i></i><i></i><i></i></div><div class="lf-compare-after"><div><strong>Specific Product<br/>Outcome</strong><p>Explain what the buyer will receive and why it matters.</p><span class="lf-compare-cta">Get the Guide</span></div><div class="lf-compare-cover">${icon('spark',28)}</div></div></div></div>
      </div>
    </article>
  </section>

  <section class="container lf-explain" id="how" aria-labelledby="lf-explain-title">
    <div class="lf-explain-heading">
      <div><span class="lf-detail-kicker">${icon('spark',15)} THE PROCESS</span><h2 id="lf-explain-title">How does <span>SaleFix</span> work?</h2></div>
      <p>A simple path from your product files or sales-page link to useful improvements. Start free—no signup or card needed.</p>
    </div>
    <div class="lf-explain-grid">
      <article class="surface lf-explain-step"><div class="lf-step-top"><span class="lf-detail-icon blue">${icon('link',22)}</span><span class="lf-step-index">01</span></div><h3>Add files or a link</h3><p>Upload your ebook, guide or template—or paste its public selling-page URL.</p><span class="lf-step-foot">Gumroad · Payhip · Your website</span></article>
      <article class="surface lf-explain-step"><div class="lf-step-top"><span class="lf-detail-icon violet">${icon('scan',22)}</span><span class="lf-step-index">02</span></div><h3>We review available content</h3><p>SaleFix inspects readable file contents or public sales-page text for concrete improvements.</p><span class="lf-step-foot">Based on available content</span></article>
      <article class="surface lf-explain-step"><div class="lf-step-top"><span class="lf-detail-icon green">${icon('eye',22)}</span><span class="lf-step-index">03</span></div><h3>Get a free action plan</h3><p>See up to three findings, why they matter, and a suggested headline with a before-and-after view.</p><span class="lf-step-foot">Real findings · No fake scores</span></article>
      <article class="surface lf-explain-step"><div class="lf-step-top"><span class="lf-detail-icon blue">${icon('layers',22)}</span><span class="lf-step-index">04</span></div><h3>Go further with the full kit</h3><p>The planned $49 kit brings together editable sales copy, marketing posts, graphics and buyer replies.</p><span class="lf-step-foot">Paid checkout coming later</span></article>
    </div>
    <div class="lf-explain-note surface"><span class="lf-note-icon">${icon('shield',20)}</span><p><strong>What if a site blocks scanning?</strong> Upload the product files instead. Your report shows what SaleFix could actually inspect.</p><a href="#/analyze">Try free analysis ${icon('arrow',17)}</a></div>
  </section>

  <section class="container lf-inside" aria-labelledby="lf-inside-title">
    <div class="lf-inside-heading"><span class="lf-detail-kicker">${icon('scan',15)} INSIDE YOUR FREE AUDIT</span><h2 id="lf-inside-title">More clarity. <span>Less guesswork.</span></h2><p>SaleFix focuses on what a potential buyer can understand from your product page—not invented sales estimates.</p></div>
    <div class="lf-inside-grid">
      <article class="surface lf-inside-card"><span class="lf-detail-icon violet">${icon('text',21)}</span><h3>Offer clarity</h3><p>Does your headline explain what the product does and who it helps?</p><small>${icon('checkcircle',15)} Clearer headline ideas</small></article>
      <article class="surface lf-inside-card"><span class="lf-detail-icon blue">${icon('layers',21)}</span><h3>Benefits &amp; details</h3><p>Can buyers quickly see what is included and why it matters to them?</p><small>${icon('checkcircle',15)} Specific copy suggestions</small></article>
      <article class="surface lf-inside-card"><span class="lf-detail-icon green">${icon('arrow',21)}</span><h3>Buying clarity</h3><p>Are the offer, price and next purchase step easy to recognize?</p><small>${icon('checkcircle',15)} Actionable improvement tips</small></article>
    </div>
  </section>

  <section class="container lf-publish-section">
    <div class="lf-publish surface">
      <div class="lf-publish-copy"><span class="pill softblue">Planned feature</span><h2>One-Click Publish</h2><p>We are building shareable hosted sales pages for a future release.</p>
        <div class="lf-publish-bullets"><span>${icon('checkcircle',16)} AI-built sales page</span><span>${icon('checkcircle',16)} Publish with a live link</span><span>${icon('checkcircle',16)} Works with your existing checkout</span></div>
        <small>This feature is not available in the current free release.</small>
      </div>
      <div class="lf-publish-browser"><div class="lf-browser-address"><span class="lf-window-dots"><i></i><i></i><i></i></span><span>${icon('link',14)} salefix.app/p/your-product</span></div><div class="lf-publish-preview"><div><strong>Your Product</strong><i></i><i></i><i></i></div><span>${icon('spark',34)}</span></div></div>
    </div>
  </section>

  <section class="container lf-bottom" aria-label="Pricing and common questions">
    <article class="surface lf-price" id="pricing">
      <div class="lf-price-amount"><span class="pill lightviolet">♛ Complete Sales Kit</span><strong>$49</strong><small>One-time payment</small></div>
      <div class="lf-price-list"><span>${icon('checkcircle',16)} Full AI sales audit &amp; recommendations</span><span>${icon('checkcircle',16)} Improved, ready-to-use sales page</span><span>${icon('checkcircle',16)} 10 promotional posts</span><span>${icon('checkcircle',16)} 3 branded graphics concepts</span><span>${icon('checkcircle',16)} Buyer reply templates</span><span>${icon('checkcircle',16)} Hosted publishing (planned)</span></div>
      <div class="lf-price-action"><a href="#/analyze" class="button button-primary">Analyze for Free ${icon('arrow',17)}</a><span>Planned paid kit: $49 · Checkout currently unavailable</span></div>
    </article>
    <article class="surface lf-faq" id="faq"><h2>Frequently Asked Questions</h2>
      ${faqItem(0,'Which platforms does it work with?','SaleFix reviews supported product files and publicly readable sales pages, including many Gumroad, Payhip and independent sites. If a page cannot be read, upload your files instead.')}
      ${faqItem(1,'Do I need to sign up?','No login is required for the free audit. Paid publishing will use secure passwordless access after launch.')}
      ${faqItem(2,'How will I get access after payment?','Once checkout is available, paid customers will receive a secure email link to their kit. Payments are disabled until delivery is ready.')}
      ${faqItem(3,'Can I use it for multiple products?','The planned $49 purchase covers one product campaign kit. You can run a new free audit for another product.')}
      ${faqItem(4,'What if SaleFix cannot read my page?','If a site blocks automated access, upload your product files instead. Results will describe what could actually be inspected.')}
      ${faqItem(5,'Does a good audit mean I will make more sales?','No. The audit checks the clarity of visible product copy and provides improvement ideas. It cannot predict or verify future sales.')}
    </article>
  </section>
</main>${footer()}`;
}

function faqItem(i,q,a){return `<details class="surface faq-item"><summary>${safe(q)}${icon('chevron',20)}</summary><p>${safe(a)}</p></details>`}
function stepsNav(active){const working=active===2;return `<div class="progress-nav" aria-label="Analysis progress"><div class="on"><b>${active>1?icon('check',14):'1'}</b> Analyze Product</div><i></i><div class="${active>1?'on':''}"><b>2</b> ${working?'Analyzing…':'Get Results'}</div></div>`}
function analyze(){return `${header()}<main class="container workspace analyze-page simple-analyze"><div class="form-layout"><div><div class="workspace-heading"><span class="simple-form-kicker">${icon('spark',15)} FREE PRODUCT AUDIT</span><h1>One product. <span>Two easy ways.</span></h1><p>Upload your digital product <strong>or</strong> paste its selling-page link. No signup. No long form.</p></div>
<form id="analyze-form" class="surface product-form simple-product-form" novalidate>
${state.error?`<div class="error-message analyze-error" role="alert" tabindex="-1">${icon('alert',19)} <span>${safe(state.error)}</span></div>`:''}
<div class="simple-source-label"><span>${icon('upload',18)} Upload product files</span><small>Optional</small></div>
<section class="pf-upload-area" aria-label="Upload digital product files">
  <label class="pf-drop-zone" for="product-files" id="product-drop-zone">
    <span class="pf-upload-icon">${icon('upload',24)}</span>
    <strong>Drop files here or browse</strong>
    <span>PDF · ZIP · DOCX · XLSX · PPTX · EPUB · Text · Images</span>
    <small>Up to 3 files · 20 MB each</small>
    <input type="file" id="product-files" multiple accept=".pdf,.zip,.docx,.xlsx,.pptx,.epub,.txt,.md,.csv,.tsv,.json,.png,.jpg,.jpeg,.webp,.svg" aria-describedby="product-file-help" />
  </label>
  <div class="pf-selected-row"><div id="selected-product-files" role="status" aria-live="polite"></div><button id="clear-product-files" type="button" hidden>Remove files</button></div>
</section>
<div class="pf-or"><span></span> OR <span></span></div>
<div class="simple-source-label"><span>${icon('link',18)} Product page link</span><small>Optional</small></div>
<label class="simple-url-wrap"><span class="sr-only">Product link or domain</span><input type="text" name="url" placeholder="https://yourstore.com/product" maxlength="1200" autocomplete="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="product-url-help" value="${safe(state.url)}"/></label>
<p class="simple-input-note" id="product-url-help">Gumroad, Payhip or your own sales page.</p>
<div class="simple-description-head"><label for="product-description">Tell us about your product <small>Optional</small></label><output id="product-description-count" for="product-description" aria-live="off">${state.manual.length}/500</output></div>
<textarea id="product-description" name="manual" maxlength="500" rows="3" placeholder="What is your product, and who is it for? (Optional)" aria-describedby="product-description-hint product-description-count">${safe(state.manual)}</textarea>
<p class="simple-input-note" id="product-description-hint">A little context helps personalize the audit. Skip if your file or link explains it.</p>
<p class="simple-selection-tip">Upload a file or paste a link to start. This description is optional.</p>
<button type="submit" class="button button-primary full-width jumbo">${icon('spark',19)} Analyze for Free ${icon('arrow',20)}</button>
<p id="product-file-help" class="simple-privacy">${icon('shield',15)} Files stay in your browser; only extracted text and file details are sent for analysis.</p>
</form></div></div></main>${footer()}`}
function loadingProgress(){return `<div class="scan-progress" aria-label="Analysis progress"><span class="scan-progress-step completed"><span class="scan-progress-dot">${icon('check',15)}</span><span>Analyze Product</span></span><span class="scan-progress-line active"></span><span class="scan-progress-step current" aria-current="step"><span class="scan-progress-dot">2</span><span>Analyzing</span></span><span class="scan-progress-line"></span><span class="scan-progress-step pending"><span class="scan-progress-dot">3</span><span>Get Results</span></span></div>`}
function loading(){const domain=(()=>{try{return state.url?new URL(state.url).hostname.replace(/^www\./,''):'your product details'}catch{return 'your product details'}})();return `${header(true)}<main class="container workspace scan-workspace">${loadingProgress()}
<div class="scan-grid"><section class="surface scan-panel" aria-label="Analyzing your product">
<div class="scan-panel-header"><span class="scan-brand">${icon('spark',24)} <strong>SaleFix AI</strong></span><span class="scan-live-status"><i></i> Analyzing…</span></div>
<div class="scan-art" aria-hidden="true"><div class="scan-art-halo"></div><div class="scan-art-frame"><i class="scan-art-corner top-left"></i><i class="scan-art-corner top-right"></i><i class="scan-art-corner bottom-left"></i><i class="scan-art-corner bottom-right"></i></div><div class="scan-art-page"><div class="scan-art-browser"><i></i><i></i><i></i></div><div class="scan-art-content"><span class="scan-art-thumbnail"><i></i><i></i></span><span class="scan-art-rows"><i></i><i></i><i></i></span></div><div class="scan-art-bottom"><i></i><i></i></div></div><div class="scan-art-beam"></div></div>
<div class="scan-copy"><h1>Analyzing your product<span>...</span></h1><p>Inspecting your product materials and preparing evidence-based improvements.</p></div>
<div class="scan-checklist" role="status" aria-live="polite" aria-label="Analysis in progress"><div class="scan-checklist-row is-working"><span class="scan-row-spinner" aria-hidden="true"></span><span>Reviewing your product content</span><span class="scan-row-tag">In progress</span></div><div class="scan-checklist-row"><span class="scan-row-unstarted" aria-hidden="true"></span><span>Checking the available product details</span></div><div class="scan-checklist-row"><span class="scan-row-unstarted" aria-hidden="true"></span><span>Checking your sales messaging</span></div><div class="scan-checklist-row"><span class="scan-row-unstarted" aria-hidden="true"></span><span>Preparing personalized recommendations</span></div></div>
<p class="scan-notice">${icon('bolt',18)}  <span id="scan-notice-text">Your report will open automatically when the analysis is complete.</span></p><button id="cancel-analysis" type="button" class="scan-cancel-button">Cancel &amp; edit details</button>
</section>
<aside class="scan-side" aria-label="What SaleFix is reviewing"><div class="surface scan-product-card"><span class="scan-small-page" aria-hidden="true"><i></i><b></b><em></em></span><span class="scan-product-copy"><strong>Your Product</strong><small>Reviewing <b>${safe(domain)}</b> and any details you provided</small></span></div>
<div class="surface scan-criteria-card"><div class="scan-criteria-item"><span class="scan-criteria-icon lavender">${icon('scan',25)}</span><span><strong>Offer Analysis</strong><small>Is your product offer clear?</small></span></div><div class="scan-criteria-item"><span class="scan-criteria-icon sky">${icon('person',25)}</span><span><strong>Product clarity</strong><small>Are the contents easy to understand?</small></span></div><div class="scan-criteria-item"><span class="scan-criteria-icon indigo">${icon('chart',25)}</span><span><strong>Conversion Check</strong><small>Is the buying action clear?</small></span></div><div class="scan-criteria-item"><span class="scan-criteria-icon violet">${icon('spark',25)}</span><span><strong>Improvement Ideas</strong><small>Practical fixes based on your content.</small></span></div></div></aside></div></main>${footer()}`}
function showResult(){
  const r=state.results;
  if(!r || !r.product || !Array.isArray(r.issues))return `${header(true)}<main class="container empty-state surface" role="status"><h1>No audit available</h1><p>Upload your product file or paste a sales-page link to begin.</p><a class="button button-primary" href="#/analyze">Analyze a product ${icon('arrow',18)}</a></main>${footer()}`;
  const product=r.product;
  const productUrl=(()=>{try{const u=new URL(product.url||'');return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null}catch{return null}})();
  const domain=productUrl?productUrl.hostname.replace(/^www\./,''):(r.fileAudit?'Product file audit':'Link unavailable');
  const sourceProvided=product.source==='User-provided product copy';
  const fromFiles=!!r.fileAudit;
  const sourceLabel=fromFiles?'From your uploaded product files':sourceProvided?'From your provided product copy':'From readable public page content';
  const price=product.price?`<span>${icon('bolt',16)} <b>Detected:</b> ${safe(product.price)}</span>`:'';
  const imageUrl=(()=>{try{const u=new URL(product.imageUrl||'');if(u.protocol!=='https:'||u.username||u.password||u.href.length>1800||!u.hostname.includes('.'))return '';return u.href}catch{return ''}})();
  const preview=imageUrl?`<img class="rf-real-cover" src="${safe(imageUrl)}" alt="Product preview supplied by the original page" loading="lazy" referrerpolicy="no-referrer"/>`:`<div class="rf-generic-cover" aria-label="SaleFix product placeholder"><span>${icon('layers',36)}</span><small>Product overview</small></div>`;
  const issues=r.issues.filter(it=>it && typeof it==='object' && it.label && it.fix).slice(0,3);
  const issueLabel=issues.length===1?'1 finding':`${issues.length} findings`;
  const fileReport=r.fileAudit;
  const fileReportMarkup=fileReport?`<section class="surface pf-report" aria-labelledby="pf-report-heading"><div class="pf-report-head"><span class="pf-report-icon">${icon('layers',24)}</span><div><h2 id="pf-report-heading">Inside your product</h2><p>Source-backed file inspection · ${safe(fileReport.fileCount)} file(s)</p><small>${safe(fileReport.reviewMethod||'Automated file checks')}</small></div></div><div class="pf-report-files">${(fileReport.files||[]).map(f=>`<div class="pf-report-file"><div><strong>${safe(f.name)}</strong><small>${safe(f.ext.toUpperCase())} · ${formatFileSize(f.size)}${f.pages?' · '+f.pages+' pages':''}${f.slides?' · '+f.slides+' slides':''}${f.sheets?' · '+f.sheets+' sheets':''}${f.entries?.length?' · '+f.entries.length+' listed entries':''}</small></div><span>${f.inspected?'Inspected':'Metadata only'}</span></div>`).join('')}</div>${fileReport.notices?.length?`<details class="pf-limitations"><summary>What we could not verify (${fileReport.notices.length})</summary><ul>${fileReport.notices.map(n=>`<li>${safe(n)}</li>`).join('')}</ul></details>`:''}<p class="pf-report-caption">Recommendations below apply to your actual product files, not just a sales website.</p></section>`:'';
  const salesIssuesMarkup=Array.isArray(r.salesIssues)&&r.salesIssues.length?`<section class="surface pf-sales-section"><h2>Optional sales-page review</h2><p>Separate suggestions based on the readable webpage, not the uploaded files.</p><div class="pf-sales-list">${r.salesIssues.slice(0,3).map(it=>`<div><strong>${safe(it.label)}</strong><small>${safe(it.evidence)}</small><span>${safe(it.fix)}</span></div>`).join('')}</div></section>`:'';
  const issuesMarkup=issues.length?issues.map((it,i)=>`<article class="rf-row"><div class="rf-problem"><span class="rf-problem-icon">${icon('alert',18)}</span><div><b>${i+1}. ${safe(it.label)}</b><small>${safe(it.evidence||'Review this section of your product offer.')}</small></div></div><div class="rf-arrow" aria-hidden="true">${icon('arrow',18)}</div><div class="rf-solution"><span class="rf-solution-icon">${icon('checkcircle',19)}</span><div><b>${safe(it.fix)}</b></div></div></article>`).join(''):`<p class="rf-none">No specific issues were identified from the text we could read. You can still review the headline suggestion below.</p>`;
  const beforeText=safe(product.h1||product.title||'No readable headline found');
  const improvedText=String(r.improvedHeadline||'').trim();
  const afterText=safe(improvedText||'No revised headline is available for this product.');
  const sourceNote=String(r.note||'').trim();
  return `${header(true)}<main class="container workspace result-reference-page results-v2">
    <div class="rf-steps" aria-label="Analysis steps"><span class="rf-step done">${icon('check',14)} <span>Analyze product</span></span><i></i><span class="rf-step done">${icon('check',14)} <span>Analyze content</span></span><i></i><span class="rf-step active" aria-current="step"><b>3</b><span>Get results</span></span></div>
    <section class="rf-header"><div><h1>Your product audit is <span>ready.</span></h1><p>See what SaleFix could inspect inside your product and the practical improvements you can make.</p></div><span class="pill lightgreen">${icon('spark',16)} Free audit</span></section>
    <div class="rf-grid"><div class="rf-left">${fileReportMarkup}
      <section class="surface rf-product-card" aria-labelledby="rf-product-title"><div class="rf-cover">${preview}</div><div class="rf-product-info"><div class="rf-product-top"><h2 id="rf-product-title">${safe(product.title||'Your product')}</h2>${productUrl?`<a href="${safe(productUrl.href)}" rel="noopener noreferrer" target="_blank" class="mini-external" aria-label="Open original product page">${icon('external',20)}</a>`:''}</div><p>${safe(product.description||'Description was not available in the readable page content.')}</p><div class="rf-meta">${price}<span>${icon('globe',16)} ${safe(domain)}</span></div><div class="rf-source">${icon('shield',14)} ${safe(sourceLabel)}</div></div></section>
      ${salesIssuesMarkup}<section class="surface rf-findings-card" aria-labelledby="rf-findings-title"><div class="rf-card-head"><span class="circle-icon">${icon('spark',22)}</span><div><h2 id="rf-findings-title">${fromFiles?'Product audit — key findings':'Sales audit — key findings'}</h2><p>${issueLabel} based on ${fromFiles?'inspected product-file content':'the product text we could access'}.</p></div></div><div class="rf-findings-list">${issuesMarkup}</div><div class="rf-summary"><span class="rf-summary-count">${issues.length}</span><div><strong>${issues.length===1?'Opportunity to review':'Opportunities to review'}</strong><p>Content recommendations, not a sales score or a prediction of purchases.</p></div></div></section>
    </div><div class="rf-right">
      <section class="surface rf-beforeafter-card" aria-labelledby="rf-compare-title"><div class="rf-card-head"><span class="circle-icon">${icon('refresh',22)}</span><div><h2 id="rf-compare-title">Before &amp; after</h2><p>A suggested headline using your actual product information.</p></div></div><div class="rf-compare"><div class="rf-compare-col"><span class="tag tag-red">Original</span><div class="rf-browser before"><div class="rf-browser-top"><i></i><i></i><i></i></div><div class="rf-browser-body"><strong>${beforeText}</strong><em></em><em class="short"></em></div></div></div><span class="rf-compare-arrow" aria-hidden="true">${icon('arrow',20)}</span><div class="rf-compare-col"><span class="tag tag-green">Suggested</span><div class="rf-browser after"><div class="rf-browser-top"><i></i><i></i><i></i></div><div class="rf-browser-body"><strong>${afterText}</strong><em></em><em class="short"></em></div></div></div></div>${improvedText?`<div class="rf-copy-row"><span>${safe(r.headlineSource||'Suggested wording, based on available details')}</span><button type="button" class="rf-copy-btn" data-copy-headline="1" aria-label="Copy suggested headline">${icon('text',16)} Copy headline</button></div><p class="rf-copy-feedback" role="status" aria-live="polite"></p>`:''}</section>
      <section class="surface rf-kit-card" aria-labelledby="rf-kit-title"><div class="rf-card-head"><span class="circle-icon">${icon('lock',22)}</span><div><h2 id="rf-kit-title">Complete SaleFix Kit</h2><p>More tools to put these improvements into practice.</p></div></div><div class="rf-kit-list"><div>${icon('checkcircle',18)} Deeper sales copy review</div><div>${icon('checkcircle',18)} Ready-to-edit sales page</div><div>${icon('checkcircle',18)} 10 promotional posts</div><div>${icon('checkcircle',18)} 3 promotional graphics</div><div>${icon('checkcircle',18)} Buyer reply templates</div><div>${icon('checkcircle',18)} Publishing tools (planned)</div></div><div class="rf-kit-actions"><p><strong>$49 one-time</strong> · Paid checkout is not active yet.</p><button class="button button-primary jumbo full-width" id="unlock-button" type="button">View full kit details ${icon('arrow',18)}</button><small>No payment will be taken on this version.</small></div></section>
    </div></div>${sourceNote?`<div class="rf-source-note">${icon('alert',17)} ${safe(sourceNote)}</div>`:''}<div class="rf-disclaimer">${icon('shield',16)} ${safe(r.disclaimer||'This review covers readable text and may miss dynamic content. It does not predict sales.')}</div></main>${footer()}`;
}
function checkout(){const r=state.results;return `${header(true)}<main class="container checkout-page"><div class="checkout-copy"><span class="eyebrow">COMPLETE SALEFIX KIT</span><h1>One-time unlock.<br/><span>Everything in one place.</span></h1><p>You're one step away from turning your audit into a usable launch kit. We won't charge you until secure fulfillment is ready.</p><div class="checkout-items"><div>${icon('checkcircle',20)} Complete offer audit</div><div>${icon('checkcircle',20)} Rewritten page copy</div><div>${icon('checkcircle',20)} Marketing and reply templates</div><div>${icon('checkcircle',20)} Live page publishing after setup</div></div></div><div class="surface checkout-box"><div class="checkout-title">Your order <span>SaleFix</span></div><div class="order-row">SaleFix full kit <b>$49.00</b></div><div class="order-row total">Total today <b>$49.00</b></div><div class="checkout-alert">${icon('alert',19)} Secure payments and kit delivery are being connected. Checkout is disabled in this build.</div><button class="button button-primary full-width jumbo" id="checkout-button" type="button">${icon('lock',18)} Set up payment before launch</button><p>${icon('shield',16)} No payment is taken in this version.</p><a class="back-link" href="#/results">← Back to free report</a></div></main>${footer()}`}
function legal(which){return `${header(true)}${legalContent(which)}${footer()}`;}
function routeFromHash(){let hash=location.hash.replace(/^#\/?/,'');if(hash.startsWith('#'))hash=hash.slice(1);return hash.split('?')[0]}
let lastRenderedHash="";
function render(){lastRenderedHash=location.hash;const route=routeFromHash();document.title=`${route==='analyze'?'Analyze product — ':route==='loading'?'Analyzing — ':route==='results'?'Your audit — ':route==='kit'?'Your Sales Kit — ':route==='privacy'?'Privacy Policy — ':route==='terms'?'Terms of Service — ':route==='refunds'?'Refund Policy — ':route==='contact'?'Contact — ':''}SaleFix`;
document.body.dataset.page=(route===''||route.startsWith('#'))?'landing':'workspace';
const ui=route==='analyze'?analyze():route==='loading'?loading():route==='results'?showResult():route==='checkout'?checkout():route==='kit'?kitShell():['privacy','terms','refunds','contact'].includes(route)?legal(route):landing();$('#app').innerHTML=ui;
if(route==='kit')hydrateKit();
if(route==='analyze')updateSelectedFiles();
if(route==='loading'&&!state.analyzing){ if(state.results)nav('results');else nav('analyze') }
if(route===''||route.startsWith('#')){const anchor=route.slice(1);if(anchor)setTimeout(()=>document.getElementById(anchor)?.scrollIntoView({behavior:'smooth'}),50)} }
function showAnalyzeError(message){state.error=String(message||'Unable to analyze this product.');state.analyzing=false;nav('analyze');}
async function startAnalysis(){
  if(state.analyzing)return;
  state.error='';state.results=null;
  // A product upload is a complete input on its own; a sales-page URL is optional.
  const value=state.url.trim();
  if(!value&&!selectedProductFiles.length){
    showAnalyzeError('Add a product file or paste a product link to start your free audit.');return;
  }
  if(value){
    const candidate=/^[a-z][a-z0-9+.-]*:/i.test(value)?value:`https://${value}`;
    try{
      if(/\s/.test(value))throw new Error('spaces');
      const url=new URL(candidate);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))throw new Error('invalid');
      state.url=url.href;
    }catch{showAnalyzeError('Enter a valid public product link, or remove the link and upload your files.');return;}
  }else state.url='';
  try{sessionStorage.removeItem('salefix-analysis')}catch{}
  state.analyzing=true;const controller=new AbortController();activeAnalysisController=controller;nav('loading');
  let timedOut=false;
  const slowNotice=setTimeout(()=>{
    if(state.analyzing&&activeAnalysisController===controller&&routeFromHash()==='loading'){
      const notice=document.getElementById('scan-notice-text');
      if(notice)notice.textContent='This product is taking longer than usual. You can continue or cancel and try a file instead.';
    }
  },12000);
  const requestDeadline=setTimeout(()=>{timedOut=true;controller.abort();},40000);
  try{
    const fileExtracts=selectedProductFiles.length?await extractProductFiles(selectedProductFiles,{signal:controller.signal,onProgress(message){const el=document.getElementById('scan-notice-text');if(el)el.textContent=message;}}):[];
    if(controller.signal.aborted){
      if(timedOut&&routeFromHash()==='loading')showAnalyzeError('File inspection timed out. Try fewer pages or smaller product files.');
      return;
    }
    const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:state.url,manual:state.manual,fileExtracts}),signal:controller.signal});
    const data=await res.json();if(controller.signal.aborted){if(timedOut&&routeFromHash()==='loading')showAnalyzeError('Analysis timed out. Retry, or upload the product files instead of using a link.');return;}if(!res.ok)throw new Error(data.error||'Could not analyze this product. Try a product file or a different link.');
    state.results=data;try{sessionStorage.setItem('salefix-analysis',JSON.stringify(data))}catch{}
    state.analyzing=false;
    if(routeFromHash()==='loading')nav('results');
  }catch(e){
    if(controller.signal.aborted){
      if(timedOut&&routeFromHash()==='loading')showAnalyzeError('Analysis timed out. Please try again or add your product description manually.',true);
      return;
    }
    const message=String(e.message||e);
    const helpful=/manual|timed out|could not|website|site |http \d|fetch|readable|blocked|html|redirect|content/i.test(message);
    const friendly=helpful&&!selectedProductFiles.length?`${message} You can upload your product file instead.`:message;
    if(routeFromHash()==='loading')showAnalyzeError(friendly);
    else{state.error=friendly;state.analyzing=false;}
  }finally{clearTimeout(slowNotice);clearTimeout(requestDeadline);if(activeAnalysisController===controller)activeAnalysisController=null;}
}
document.addEventListener('submit',e=>{
  if(e.target.id==='analyze-form'){
    e.preventDefault();const data=new FormData(e.target);
    state.url=String(data.get('url')||'').trim();
    state.manual=String(data.get('manual')||'').slice(0,500).trim();
    startAnalysis();
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='product-description'){
    const value=String(e.target.value||'').slice(0,500);
    if(value!==e.target.value)e.target.value=value;
    state.manual=value;
    const count=$('#product-description-count');
    if(count)count.textContent=`${value.length}/500`;
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='product-files'&&!selectProductFiles(e.target.files))e.target.value='';
});
document.addEventListener('dragover',e=>{if(e.target.closest?.('#product-drop-zone'))e.preventDefault()});
document.addEventListener('drop',e=>{if(!e.target.closest?.('#product-drop-zone'))return;e.preventDefault();selectProductFiles(e.dataTransfer?.files);});
document.addEventListener('click',async e=>{if(e.target.closest('#clear-product-files')){selectedProductFiles=[];const input=$('#product-files');if(input)input.value='';updateSelectedFiles();return;}const copy=e.target.closest('[data-copy-headline]');if(copy){const text=String(state.results?.improvedHeadline||'').trim();const feedback=$('.rf-copy-feedback');if(!text){if(feedback)feedback.textContent='No suggestion available to copy.';return;}try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);}else{const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.left='-9999px';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('Clipboard not available');}if(feedback)feedback.textContent='Headline copied!';}catch{if(feedback)feedback.textContent='Could not copy automatically. Please select the headline text above.';}return;}if(e.target.closest('#cancel-analysis')){if(state.analyzing)nav('analyze');return;}if(e.target.closest('#unlock-button'))nav('checkout');if(e.target.closest('#checkout-button')){const n=$('.checkout-alert');if(n)n.textContent='Checkout is intentionally disabled until the verified payment and content delivery flow is configured.'}});
window.addEventListener('hashchange',()=>{if(state.analyzing&&lastRenderedHash==='#/loading'&&routeFromHash()!=='loading'){activeAnalysisController?.abort();state.analyzing=false;}if(location.hash!==lastRenderedHash)render()});
render();
