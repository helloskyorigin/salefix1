// Product files are parsed locally in the user's browser. Only text excerpts,
// archive inventory and metadata are sent to the audit endpoint (never raw files).
const MAX_FILES=3, MAX_FILE=20_000_000, MAX_TOTAL=45_000_000;
const ALLOWED=new Set(['pdf','zip','docx','xlsx','pptx','epub','txt','md','csv','tsv','json','png','jpg','jpeg','webp','svg']);
const ZIP_LIBRARY='/vendor/jszip.min.js';
const PDF_LIBRARY='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const loadedScripts=new Map();
function getLibrary(url,globalName){
  if(globalThis[globalName])return Promise.resolve(globalThis[globalName]);
  if(loadedScripts.has(url))return loadedScripts.get(url);
  const p=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=true;script.crossOrigin='anonymous';
    const timer=setTimeout(()=>{script.remove();reject(new Error('The file reader could not load. Check your connection and retry.'));},16000);
    script.onload=()=>{clearTimeout(timer);globalThis[globalName]?resolve(globalThis[globalName]):reject(new Error('File reader failed to initialize.'))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('File reader could not load. Check your connection and retry.'))};
    document.head.appendChild(script);
  }).catch(e=>{loadedScripts.delete(url);throw e});
  loadedScripts.set(url,p);return p;
}
function cleanText(s,n=20000){return String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}
function kind(name){return name.toLowerCase().split('.').pop()}
function xmlText(source,tag){
  // Treat the XML as inert data, not DOM inserted into the document.
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if(doc.querySelector('parsererror'))return cleanText(source.replace(/<[^>]+>/g,' '));
  let nodes=doc.getElementsByTagName(tag),texts=[];
  if(!nodes.length&&tag.includes(':'))nodes=doc.getElementsByTagNameNS('*',tag.split(':').pop());
  for(const x of [...nodes].slice(0,3500))texts.push(x.textContent);
  return cleanText(texts.join(' '));
}
async function loadZip(file){
  const JSZip=await getLibrary(ZIP_LIBRARY,'JSZip');
  let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false})}catch{throw new Error('Could not read this ZIP/Office file. It may be damaged or password-protected.');}
  const members=Object.values(zip.files);
  const sum=members.reduce((n,e)=>n+(e._data?.uncompressedSize||0),0);
  if(members.length>220||sum>75_000_000)throw new Error('Archive is too large to safely inspect (max 220 entries / 75 MB unpacked).');
  return {zip,members};
}
async function unzipText(entry,max=160000){
  if(!entry||entry.dir)return '';
  const size=entry._data?.uncompressedSize;
  if(!Number.isFinite(size)||size>max)return '';
  try{return await entry.async('string')}catch{return ''}
}
async function parsePdf(file,record){
  const pdfjs=await getLibrary(PDF_LIBRARY,'pdfjsLib');pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
  let doc;
  try{doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
    record.pages=doc.numPages;record.pagesRead=Math.min(doc.numPages,90);
    const text=[];
    for(let i=1;i<=record.pagesRead;i++){
      const page=await doc.getPage(i);const items=await page.getTextContent();
      const contents=cleanText(items.items.map(v=>v.str||'').join(' '),1700);
      if(contents&&record.parts.length<12)record.parts.push({name:`Page ${i}`,chars:contents.length,excerpt:contents.slice(0,180)});
      text.push(contents);if(text.join(' ').length>19500){record.pagesRead=i;break;}
    }
    record.text=cleanText(text.join(' '));record.inspected=true;
    if(doc.numPages>record.pagesRead)record.warnings.push(`Reviewed the first ${record.pagesRead} of ${doc.numPages} pages; remaining pages were not inspected.`);
    if(record.text.length<80)record.warnings.push('Very little selectable text was found; scanned or image-only pages require OCR for detailed review.');
  }catch(e){if(/password/i.test(String(e?.message||e)))throw new Error('PDF is password-protected. Upload an unlocked copy.');throw new Error('The PDF reader could not inspect this file. Try a standard, unlocked PDF.');}
  finally{try{await doc?.destroy()}catch{}}
}
async function parseZip(file,record){
  const {zip,members}=await loadZip(file);
  record.entries=members.filter(m=>!m.dir).slice(0,120).map(m=>m.name);
  const entries=members.filter(m=>!m.dir);
  record.imageCount=entries.filter(m=>/\.(png|jpe?g|webp|gif|svg)$/i.test(m.name)).length;
  let text='';
  for(const entry of entries.filter(m=>/\.(txt|md|csv|tsv|json|html|htm)$/i.test(m.name)).slice(0,15)){
    const contents=cleanText(await unzipText(entry),1600);
    if(contents){record.parts.push({name:entry.name.slice(0,110),chars:contents.length,excerpt:contents.slice(0,180)});text+=` ${entry.name}: ${contents}`;}
    if(text.length>19500)break;
  }
  record.text=cleanText(text);record.inspected=true;
  if(!record.text)record.warnings.push('Archive contents were inventoried, but no supported readable text files were found inside. Nested PDFs, designs and binaries were not content-reviewed.');
  if(entries.length>120)record.warnings.push('The file list was sampled to 120 entries.');
}
async function parseOffice(file,record){
  const {zip,members}=await loadZip(file);
  let content='';
  if(record.ext==='docx'){
    const names=['word/document.xml','word/footnotes.xml','word/endnotes.xml'];
    for(const n of names)content+=' '+xmlText(await unzipText(zip.file(n),1_500_000),'w:t');
    if(!zip.file('word/document.xml'))throw new Error('DOCX document content was missing.');
  }else if(record.ext==='xlsx'){
    const sheets=members.filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x.name));
    record.sheets=sheets.length;
    content+=' '+xmlText(await unzipText(zip.file('xl/sharedStrings.xml'),1_500_000),'t');
    for(const sheet of sheets.slice(0,15)){
      const xml=await unzipText(sheet,800_000);record.formulas+=(xml.match(/<f(?:\s|>)/g)||[]).length;
      content+=' '+xmlText(xml,'v')+' '+xmlText(xml,'t');
    }
    if(sheets.length>15)record.warnings.push('Reviewed the first 15 worksheets only.');
  }else if(record.ext==='pptx'){
    const slides=members.filter(x=>/^ppt\/slides\/slide\d+\.xml$/.test(x.name));
    record.slides=slides.length;
    for(const slide of slides.slice(0,70)){
      const t=xmlText(await unzipText(slide,300_000),'a:t');
      content+=' '+t;if(t&&record.parts.length<12)record.parts.push({name:slide.name,chars:t.length,excerpt:t.slice(0,180)});
    }
    if(slides.length>70)record.warnings.push('Reviewed the first 70 slides only.');
  }else if(record.ext==='epub'){
    const docs=members.filter(m=>/\.(xhtml|html|htm)$/i.test(m.name)&&!m.dir);
    record.pages=docs.length;record.pagesRead=Math.min(35,docs.length);
    for(const page of docs.slice(0,35)){
      const raw=await unzipText(page,250_000);
      const dom=new DOMParser().parseFromString(raw,'text/html');
      dom.querySelectorAll('script,style,nav').forEach(el=>el.remove());
      const t=cleanText(dom.body?.textContent||'',1100);
      content+=' '+t;if(t&&record.parts.length<12)record.parts.push({name:page.name,chars:t.length,excerpt:t.slice(0,180)});
    }
    if(docs.length>35)record.warnings.push('Reviewed the first 35 EPUB sections only.');
  }
  record.text=cleanText(content);record.inspected=true;
  if(!record.text)record.warnings.push('No readable text was found in the document content inspected.');
}
async function parseImage(file,record){
  if(record.ext==='svg'){
    const raw=await file.text();if(!/^\s*(<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg\b/i.test(raw))throw new Error('Invalid SVG file.');
    record.text=cleanText(raw.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,' ').replace(/<[^>]+>/g,' '),2000);
    record.inspected=true;return;
  }
  if(typeof createImageBitmap==='function'){
    try{const bitmap=await createImageBitmap(file);record.imageWidth=bitmap.width;record.imageHeight=bitmap.height;bitmap.close();record.inspected=true;}catch{record.warnings.push('Could not decode image dimensions.');}
  }else record.warnings.push('Image dimensions were not available in this browser.');
}
export async function extractProductFiles(files,{onProgress}={}){
  const list=Array.from(files||[]);
  if(!list.length)return [];
  if(list.length>MAX_FILES)throw new Error(`Choose up to ${MAX_FILES} product files.`);
  const sum=list.reduce((n,f)=>n+f.size,0);
  if(sum>MAX_TOTAL)throw new Error('Choose up to 45 MB total of product files.');
  const output=[];
  for(let index=0;index<list.length;index++){
    const file=list[index],ext=kind(file.name||'');
    if(!ALLOWED.has(ext))throw new Error(`${file.name}: unsupported format. Choose PDF, ZIP, DOCX, XLSX, PPTX, EPUB, TXT, MD, CSV, JSON or images.`);
    if(!file.size||file.size>MAX_FILE)throw new Error(`${file.name}: each file must be under 20 MB.`);
    onProgress?.(`Reading ${index+1} of ${list.length}: ${file.name.slice(0,55)}`);
    const record={name:file.name.slice(0,145),ext,size:file.size,text:'',entries:[],parts:[],warnings:[],pages:0,pagesRead:0,sheets:0,slides:0,formulas:0,imageCount:0,imageWidth:0,imageHeight:0,inspected:false};
    if(ext==='pdf')await parsePdf(file,record);
    else if(ext==='zip')await parseZip(file,record);
    else if(['docx','xlsx','pptx','epub'].includes(ext))await parseOffice(file,record);
    else if(['txt','md','csv','tsv','json'].includes(ext)){record.text=cleanText(await file.text());record.inspected=true;}
    else await parseImage(file,record);
    output.push(record);
  }
  return output;
}
