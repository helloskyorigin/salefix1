import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAuditWorkspace,auditFindings,auditPlainText,reviewedIndexes,markReviewed} from '../result-workspace.js';

const product={title:'Creator <img src=x onerror=alert(1)> Toolkit',h1:'Creator Toolkit',url:'https://example.com/creator-kit',
  description:'A detailed workbook for digital creators with exercises, templates and checklists.',price:'$17',
  source:'Uploaded product files',imageUrl:'javascript:alert(1)'};
const sample={
  product,
  fileAudit:{fileCount:2,reviewMethod:'Automated checks',files:[
    {name:'Toolkit.pdf',ext:'pdf',size:42000,pages:9,inspected:true},
    {name:'Assets <script>.zip',ext:'zip',size:33000,entries:['assets/a.png'],inspected:false}
  ],notices:['Archive was sampled, not exhaustively read.']},
  issues:[
    {id:'content',label:'Missing instructions',severity:'high',evidence:'No README in the inspected archive',fix:'Add a short getting-started guide.'},
    {id:'content-dupe',label:'Missing instructions',severity:'high',evidence:'Duplicate source',fix:'Add a short getting-started guide.'},
    {id:'title',label:'Generic headline',severity:'medium',evidence:'Only a product title is shown',fix:'Describe what is included in the toolkit.'}
  ],
  salesIssues:[{label:'Unclear button',evidence:'Read product',fix:'Use a meaningful product action'}],
  improvedHeadline:'Creator Toolkit with practical launch templates',headlineSource:'Based on provided product files',
  note:'Unable to inspect all pages.',disclaimer:'Partial text inspection, not a full quality assessment.'
};
const icon=()=>'<svg aria-hidden="true"></svg>';
const header=()=>'<header>SaleFix</header>',footer=()=>'<footer>SaleFix</footer>';

test('premium report shows real source, actionable steps, counts and $29 without invented conversion scores',()=>{
  const html=renderAuditWorkspace(sample,icon,header,footer);
  assert.match(html,/FREE PRODUCT REPORT/);
  assert.match(html,/Product audit — key findings/);
  assert.match(html,/Your next improvements/);
  assert.match(html,/2 files/);
  assert.match(html,/0 of 2/);
});
test('finding deduplication is source-based, stable and capped',()=>{
  assert.equal(auditFindings(sample).length,2);
  assert.equal(auditFindings({issues:null}).length,0);
  assert.equal(auditFindings({issues:[{label:'',fix:'a'},null,{label:'a',fix:''}]}).length,0);
});
test('HTML escapes all user controlled fields, rejects JavaScript images and preserves true metadata',()=>{
  const html=renderAuditWorkspace(sample,icon,header,footer);
  assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/src="javascript:/);
  assert.match(html,/Creator &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/Assets &lt;script&gt;\.zip/);
  assert.match(html,/Toolkit.pdf/);
  assert.match(html,/Metadata only/);
  assert.match(html,/Content or file structure sampled/);
  assert.match(html,/Archive was sampled/);
  assert.match(html,/Separate sales-page observations/);
  assert.match(html,/Source price: \$17/);
  assert.match(html,/Explore the \$29 Sales Kit/);
  assert.match(html,/Payment availability is checked at checkout/);
  assert.match(html,/Content recommendations, not a sales score/);
  assert.doesNotMatch(html,/guaranteed (?:results|sales)|actual conversion rate/i);
});
test('export is evidence-based readable text, not HTML, and includes the same findings',()=>{
  const report=auditPlainText(sample);
  assert.match(report,/ACTIONABLE FINDINGS \(2\)/);
  assert.match(report,/Original: Creator Toolkit/);
  assert.match(report,/Suggested: Creator Toolkit with practical launch templates/);
  assert.match(report,/Observed: No README/);
  assert.match(report,/Recommended: Add a short getting-started guide/);
  assert.match(report,/Toolkit\.pdf — Content or file structure sampled/);
  assert.match(report,/Archive was sampled/);
  assert.match(report,/ADDITIONAL SALES-PAGE FINDINGS/);
  assert.match(report,/This report reflects|Partial text inspection/);
});
test('mark reviewed persists by report fingerprint and remains independent across audits',()=>{
  const saved=new Map();
  const previous=globalThis.sessionStorage;
  globalThis.sessionStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  try{
    assert.equal(reviewedIndexes(sample).size,0);
    assert.equal(markReviewed(sample,0,true),true);
    assert.deepEqual([...reviewedIndexes(sample)],[0]);
    assert.equal(markReviewed(sample,999,true),false);
    assert.equal(reviewedIndexes({...sample,product:{...product,title:'A different product'}}).size,0);
    assert.equal(markReviewed(sample,0,false),true);
    assert.equal(reviewedIndexes(sample).size,0);
  }finally{if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous;}
});
test('zero-finding audit and invalid stored reports render without assumptions',()=>{
  const noFindings={product:{title:'Test offer',source:'Website content',url:'https://example.com'},issues:[],improvedHeadline:''};
  const html=renderAuditWorkspace(noFindings,icon,header,footer);
  assert.match(html,/No specific problems identified/);
  assert.match(html,/No revised headline/);
  assert.match(html,/0 of 0/);
  assert.match(renderAuditWorkspace(null,icon,header,footer),/No audit available/);
  assert.match(renderAuditWorkspace({product:{title:'Invalid'}},icon,header,footer),/No audit available/);
});
