// Evidence-backed, conservative digital-product review. The browser extracts file content;
// the server receives only excerpts, structure and metadata, never the raw uploaded files.
const TYPES = new Set(['pdf','zip','docx','xlsx','pptx','epub','txt','md','csv','tsv','json','png','jpg','jpeg','webp','svg']);
const trim=(x,n=160)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const count=(n,max)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.floor(Number(n)))):0;
const has=(text,re)=>re.test(text);
const finding=(id,label,evidence,fix,severity='medium')=>({id,label,evidence,fix,severity});
export function reviewProductFiles(input){
  if(!Array.isArray(input)||!input.length)return null;
  if(input.length>3)throw new Error('Choose up to 3 product files per audit.');
  let total=0;
  const files=input.map((item,i)=>{
    if(!item||typeof item!=='object')throw new Error('Invalid product file details.');
    const name=trim(item.name,145);
    const ext=name.toLowerCase().split('.').pop();
    if(!name||!TYPES.has(ext)||ext!==item.ext)throw new Error('File type is not supported.');
    const size=count(item.size,25_000_000);
    if(size<1||Number(item.size)>20_000_000)throw new Error('Each file must be 20 MB or less.');
    total+=Number(item.size);
    if(total>45_000_000)throw new Error('Combined files must be 45 MB or less.');
    const text=trim(item.text,20000);
    const entries=Array.isArray(item.entries)?item.entries.slice(0,120).map(v=>trim(v,120)):[];
    const warnings=Array.isArray(item.warnings)?item.warnings.slice(0,8).map(v=>trim(v,210)):[];
    const parts=Array.isArray(item.parts)?item.parts.slice(0,16).map(p=>({name:trim(p?.name,120),chars:count(p?.chars,200000),excerpt:trim(p?.excerpt,190)})):[];
    return {name,ext,size,text,entries,warnings,parts,pages:count(item.pages,100000),pagesRead:count(item.pagesRead,100000),sheets:count(item.sheets,500),slides:count(item.slides,10000),formulas:count(item.formulas,50000),imageCount:count(item.imageCount,20000),imageWidth:count(item.imageWidth,20000),imageHeight:count(item.imageHeight,20000),inspected:!!item.inspected};
  });
  const suggestions=[];
  const notices=[];
  let extracted=0;
  for(const f of files){
    const t=f.text;
    extracted+=t.length;
    const readable=t.length>=120;
    const archive=f.ext==='zip';
    const document=['pdf','epub','docx','md','txt'].includes(f.ext);
    const presentation=f.ext==='pptx';
    const spreadsheet=['xlsx','csv','tsv'].includes(f.ext);
    const image=['png','jpg','jpeg','webp','svg'].includes(f.ext);
    const label=trim(f.name,70);
    if(!f.inspected){notices.push(`${label}: only file metadata could be inspected.`);continue;}
    if(f.warnings.length)notices.push(...f.warnings.map(w=>`${label}: ${w}`));
    if(archive){
      const useful=f.entries.filter(x=>!x.endsWith('/')&&!x.startsWith('__MACOSX/')&&!x.endsWith('.DS_Store'));
      if(useful.length>=3&&!useful.some(n=>/(^|\/)(?:readme|start[ -]?here|instructions|how[ -]?to|usage|guide)(?:\b|[._-])/i.test(n)))
        suggestions.push(finding('zip-guide','Add clear setup and usage instructions',`${label} includes ${useful.length} files, but no obviously named README or getting-started guide was found.`, 'Include a START-HERE guide: contents, tools needed, how to customize, and usage examples.','high'));
      if(useful.length>=4&&useful.every(n=>!n.includes('/')))
        suggestions.push(finding('zip-folders','Organize the bundle for first-time users',`${label} contains ${useful.length} top-level files without folders.`, 'Group deliverables, examples, assets and instructions into clearly named folders.','medium'));
      if(useful.length<2)
        notices.push(`${label}: only ${useful.length} deliverable file(s) were found; confirm the bundle contains everything promised.`);
    }
    if(f.ext==='pdf'&&f.pages>4&&f.pagesRead>0&&!readable){
      suggestions.push(finding('pdf-text','Make your PDF readable and searchable',`${label}: ${f.pagesRead} of ${f.pages} pages inspected, but little selectable text was extracted.`, 'Provide a text-layer PDF or add accessible text. Scanned pages may need OCR.','high'));
    }else if(f.ext==='pdf'&&f.pages>=14&&readable&&!has(t,/(?:table of contents|contents\s+(?:page|chapter)|chapter\s+\d|introduction|section\s+\d)/i)){
      suggestions.push(finding('pdf-nav','Help buyers navigate the material',`${label} has ${f.pages} pages; no obvious chapter/contents marker appeared in the extracted sample.`, 'Consider a clickable table of contents, section headings and page navigation. Verify whether the original PDF already has them.','medium'));
    }
    if(document&&readable&&t.length>700&&!has(t,/(?:example|exercise|checklist|worksheet|practice|step\s*[1-9]|try this|walkthrough|worked example)/i))
      suggestions.push(finding('actionable-content','Add examples or practical exercises',`${label}: sampled content has ${Math.round(t.length/5)} approximate characters of prose but no explicit example/exercise marker was detected.`, 'Add a concrete example, exercise, checklist or finished outcome to help the buyer apply the material.','medium'));
    if(presentation&&f.slides>=6&&t.length<160)
      suggestions.push(finding('slides-copy','Make slide templates easier to understand',`${label} has ${f.slides} slides with little editable text in the inspected sample.`, 'Add a short usage guide, explanatory slide or editable placeholder instructions.','medium'));
    if(spreadsheet&&f.ext==='xlsx'&&f.sheets>=1&&f.formulas===0)
      notices.push(`${label}: no formulas were detected in sampled worksheets; this may be fine for a tracker or static template.`);
    if(image)notices.push(`${label}: image dimensions/metadata were checked; design quality and visual legibility were not evaluated automatically.`);
    if(f.ext==='zip'&&f.entries.some(n=>/\.(exe|bat|cmd|sh|ps1|js|apk|dmg)$/i.test(n)))
      notices.push(`${label}: includes executable or script files; SaleFix did not run them.`);
  }
  if(!suggestions.length){
    if(extracted>100)suggestions.push(finding('quality-review','Review usability with a new customer',`SaleFix extracted readable content from ${files.length} file(s), but found no clear structural issue using its automated checks.`, "Test a first-time user’s ability to open, understand and apply the deliverables; manually review content accuracy.",'low'));
    else suggestions.push(finding('extraction-limit','Provide a readable preview for a deeper review',`Little readable text was extracted from ${files.map(f=>f.name).join(', ').slice(0,165)}.`, 'Attach an accessible text version or describe what each asset contains. The automatic review cannot assess unseen content.','medium'));
  }
  const first=files[0];
  const filesPublic=files.map(({text,entries,parts,...f})=>({...f,entries:entries.slice(0,25),contentSample:parts.slice(0,6)}));
  return {
    title:trim(first.name.replace(/\.[^.]+$/,''),90),
    description:trim(first.text,270)||`${files.length} digital product file(s) provided for review.`,
    fileCount:files.length,
    files:filesPublic,
    findings:suggestions.slice(0,5),
    notices:notices.slice(0,12),
    textCoverage:extracted,
    disclaimer:'Heuristic file-content review, not a full editorial, visual-design or factual accuracy check. Archives and long documents may be sampled; files are not executed.'
  };
}
