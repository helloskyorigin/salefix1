import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProduct} from '../lib/audit.js';
test('rejects unsafe URLs and does not fake a page scan',async()=>{
 await assert.rejects(analyzeProduct({url:'http://localhost/'}),/public product URL/i);
 await assert.rejects(analyzeProduct({url:'file:///etc/passwd'}),/http\/https/i);
 await assert.rejects(analyzeProduct({url:'http://127.0.0.1'}),/public product URL/i);
});
test('manual fallback explicitly discloses its source',async()=>{
 const result=await analyzeProduct({url:'https://127.example.invalid/product',productName:'Project Toolkit',audience:'developers',benefit:'Build simple browser extensions',manual:'Project Toolkit is a practical set of exercises for building browser extensions. Includes source code, checklists and exercises. Costs $19.'});
 assert.equal(result.product.source,'User-provided product copy');
 assert.ok(result.note.includes('could not be fetched'));
 assert.ok(result.issues.length<=3);
 assert.ok(result.improvedHeadline.includes('Project Toolkit'));
});
