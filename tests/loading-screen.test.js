import test from 'node:test';
import assert from 'node:assert/strict';

test('loading UI preserves only link and supports slow, timeout and cancel recovery',async()=>{
  const originalSetTimeout=globalThis.setTimeout;
  const originalClearTimeout=globalThis.clearTimeout;
  let slowTimer=null, deadlineTimer=null, abortCount=0;
  const page={innerHTML:''};
  const events={};
  const notice={textContent:'Your report will open automatically when the analysis is complete.'};
  globalThis.location={hash:'#/analyze'};
  globalThis.window={scrollTo(){},addEventListener(name,fn){events[name]=fn;}};
  globalThis.document={
    title:'',body:{dataset:{}},
    querySelector(selector){return selector==='#app'?page:null;},
    getElementById(id){return id==='scan-notice-text'?notice:null;},
    addEventListener(name,fn){events[name]=fn;}
  };
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class{constructor(form){this.fields=form.fields;}get(k){return this.fields[k]}};
  globalThis.setTimeout=(fn,ms,...args)=>{
    if(ms===12000){slowTimer=fn;return -100;}
    if(ms===40000){deadlineTimer=fn;return -200;}
    return originalSetTimeout(fn,ms,...args);
  };
  globalThis.clearTimeout=(id)=>{if(id>0)originalClearTimeout(id);};
  globalThis.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>{abortCount++;reject(new Error('aborted'));});
  });
  try{
    await import('../app.js?loading-screen-regression');
    const fields={url:'https://example.com/product'};
    const submit=()=>events.submit({target:{id:'analyze-form',fields},preventDefault(){}});
    submit();
    assert.equal(location.hash,'#/loading');
    assert.match(page.innerHTML,/id="cancel-analysis"/);
    assert.match(page.innerHTML,/In progress/);
    assert.doesNotMatch(page.innerHTML,/Fake progress|75% complete/);
    assert.equal(typeof slowTimer,'function');
    slowTimer();
    assert.match(notice.textContent,/taking longer than usual/);
    assert.equal(typeof deadlineTimer,'function');
    deadlineTimer();
    await new Promise(done=>originalSetTimeout(done,0));
    assert.equal(location.hash,'#/analyze');
    assert.match(page.innerHTML,/Analysis timed out/);
    assert.match(page.innerHTML,/value="https:\/\/example.com\/product"/);
    assert.doesNotMatch(page.innerHTML,/name="audience"|manual-details/);
    submit();
    assert.equal(location.hash,'#/loading');
    events.click({target:{closest(selector){return selector==='#cancel-analysis'?{}:null;}}});
    assert.equal(location.hash,'#/analyze');
    assert.equal(abortCount,2);
    assert.match(page.innerHTML,/id="analyze-form"/);
  }finally{
    globalThis.setTimeout=originalSetTimeout;
    globalThis.clearTimeout=originalClearTimeout;
  }
});
