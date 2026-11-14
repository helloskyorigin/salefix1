import test from 'node:test';
import assert from 'node:assert/strict';
import '../vendor/jszip.min.js';
import {extractProductFiles} from '../product-extractor.js';
import {reviewProductFiles} from '../lib/file-audit.js';

// Node has no DOMParser; supply only the minimal parsing surface needed by these
// fixtures. Browsers use their native DOMParser in production.
globalThis.DOMParser ??= class {
  parseFromString(source,mode){
    if(mode==='text/html')return {body:{textContent:source.replace(/<[^>]+>/g,' ')},querySelectorAll(){return [];}};
    const tags=(tag)=>[...source.matchAll(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','gi'))].map(m=>({textContent:m[1]}));
    return {querySelector(){return null},getElementsByTagName:tags,getElementsByTagNameNS(_ns,name){return tags(name)}};
  }
};
const makeFile=(name,bytes)=>({name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
async function archive(name,entries){
  assert.equal(typeof globalThis.JSZip,'function','Bundled JSZip must load locally, without a CDN');
  const zip=new globalThis.JSZip();
  for(const [path,content] of Object.entries(entries))zip.file(path,content);
  return makeFile(name,await zip.generateAsync({type:'uint8array'}));
}
test('real ZIP inventory and readable sample are extracted in the browser',async()=>{
  const file=await archive('creator-bundle.zip',{'assets/cover.svg':'<svg></svg>','templates/captions.csv':'day,caption\n1,First post','docs/START-HERE.md':'Welcome to the toolkit. Start here.'});
  const [r]=await extractProductFiles([file]);
  assert.equal(r.ext,'zip');
  assert.equal(r.inspected,true);
  assert.equal(r.entries.length,3);
  assert.match(r.text,/First post/);
  assert.match(r.text,/Start here/);
  assert.equal(reviewProductFiles([r]).findings.some(f=>f.id==='zip-guide'),false);
});
test('actual DOCX, PPTX, XLSX and EPUB archives expose content/structure',async()=>{
  const docx=await archive('guide.docx',{'word/document.xml':'<w:document xmlns:w="urn:w"><w:p><w:t>Start your creator business</w:t></w:p></w:document>'});
  const pptx=await archive('slides.pptx',{'ppt/slides/slide1.xml':'<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:t>Slide heading</a:t></p:sld>'});
  const xlsx=await archive('planner.xlsx',{'xl/sharedStrings.xml':'<sst><si><t>Revenue tracker</t></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c><f>SUM(1,2)</f><v>3</v></c></row></sheetData></worksheet>'});
  const epub=await archive('book.epub',{'OEBPS/chapter1.xhtml':'<html><body><h1>Guide</h1><p>Read this lesson</p></body></html>'});
  const extracted=await extractProductFiles([docx,pptx,xlsx]);
  assert.match(extracted[0].text,/Start your creator business/);
  assert.equal(extracted[0].inspected,true);
  assert.equal(extracted[1].slides,1);
  assert.match(extracted[1].text,/Slide heading/);
  assert.equal(extracted[2].sheets,1);
  assert.equal(extracted[2].formulas,1);
  assert.match(extracted[2].text,/Revenue tracker/);
  const [book]=await extractProductFiles([epub]);
  assert.match(book.text,/Read this lesson/);
  assert.equal(book.pagesRead,1);
});
test('cancel signal stops browser extraction before reading any file',async()=>{
  const controller=new AbortController();controller.abort();
  const sample={name:'notes.txt',size:10,text:async()=>{throw Error('should not read')}};
  await assert.rejects(extractProductFiles([sample],{signal:controller.signal}),{name:'AbortError'});
});