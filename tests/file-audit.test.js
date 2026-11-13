import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewProductFiles} from '../lib/file-audit.js';
import {analyzeProduct} from '../lib/audit.js';

const base={name:'Launch Templates.zip',ext:'zip',size:12800,text:'Quick start templates included.',entries:['banner.png','ad-template.svg','caption.csv','cover.png'],parts:[],warnings:[],inspected:true};
test('ZIP audit finds missing instructions and flat asset inventory from actual entries',()=>{
  const r=reviewProductFiles([base]);
  assert.equal(r.fileCount,1);
  assert.equal(r.files[0].entries.length,4);
  assert.ok(r.findings.some(f=>f.id==='zip-guide'));
  assert.ok(r.findings.some(f=>f.id==='zip-folders'));
  assert.ok(r.findings.every(f=>f.fix&&f.evidence&&f.severity));
  assert.equal('text' in r.files[0],false);
});
test('ZIP with README does not invent missing instructions',()=>{
  const r=reviewProductFiles([{...base,entries:['README.md','assets/cover.png','assets/social.svg','examples/sample.csv']}]);
  assert.equal(r.findings.some(f=>f.id==='zip-guide'),false);
});
test('Scanned PDF surfaces a precise limited-coverage warning',()=>{
  const r=reviewProductFiles([{name:'handbook.pdf',ext:'pdf',size:720000,text:'',pages:33,pagesRead:33,inspected:true}]);
  assert.equal(r.findings[0].id,'pdf-text');
  assert.match(r.findings[0].evidence,/33 of 33/);
  assert.match(r.disclaimer,/not a full editorial/);
});
test('XLSX format is measured conservatively without claiming broken formulas',()=>{
  const r=reviewProductFiles([{name:'budget.xlsx',ext:'xlsx',size:21000,text:'Sales Cost Revenue',sheets:3,formulas:0,inspected:true}]);
  assert.ok(r.notices.some(x=>/no formulas/.test(x)));
  assert.ok(!r.findings.some(x=>/broken|incorrect formula/i.test(x.label)));
});
test('Rejects excessive or malicious file metadata and unsupported formats',()=>{
  assert.throws(()=>reviewProductFiles([base,base,base,base]),/up to 3/);
  assert.throws(()=>reviewProductFiles([{...base,name:'virus.exe',ext:'exe'}]),/not supported/);
  assert.throws(()=>reviewProductFiles([{...base,size:21_000_000}]),/20 MB/);
  assert.throws(()=>reviewProductFiles([{...base,ext:'pdf'}]),/not supported/);
});
test('File-backed review works without link, and remains distinct from sales-page review',async()=>{
  const result=await analyzeProduct({fileExtracts:[base],productName:'Launch Templates',url:'',audience:'digital creators'});
  assert.equal(result.product.title,'Launch Templates');
  assert.equal(result.product.source,'Uploaded product files');
  assert.equal(result.fileAudit.fileCount,1);
  assert.equal(result.issues[0].id,'zip-guide');
  assert.deepEqual(result.salesIssues,[]);
  assert.match(result.note,/raw files were not transferred/);
});
