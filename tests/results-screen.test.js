import test from 'node:test';
import assert from 'node:assert/strict';

const sample = {
  product: {title:'Creator Toolkit <script>alert(1)</script>',h1:'Creator Toolkit',url:'https://example.com/creator-kit',source:'User-provided product copy',description:'Real text from creator',price:'$19',imageUrl:''},
  issues: [{id:'headline',label:'Unclear headline',evidence:'Headline is only a title',fix:'Describe the actual outcome',severity:'high'}],
  improvedHeadline:'Practical tools for creators',headlineSource:'Based on provided details',note:'Original website could not be fetched',disclaimer:'Content audit only, not a prediction.'
};

test('Results screen shows grounded info, guarded links and a truthful payment status', async () => {
  const app={innerHTML:''};const events={};let copied='';
  globalThis.location={hash:'#/results'};
  globalThis.window={scrollTo(){},isSecureContext:true,addEventListener(name,fn){events[name]=fn;}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(sel){if(sel==='#app')return app;if(sel==='.rf-copy-feedback')return feedback;return null;},getElementById(){return null;},addEventListener(name,fn){events[name]=fn;}};
  globalThis.sessionStorage={getItem(key){return key==='salefix-analysis'?JSON.stringify(sample):null;},setItem(){},removeItem(){}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text;}}}});
  const feedback={textContent:''};
  await import('../app.js?results-screen-qa');
  assert.match(app.innerHTML,/Sales audit — key findings/);
  assert.match(app.innerHTML,/Content recommendations, not a sales score/);
  assert.match(app.innerHTML,/From your provided product copy/);
  assert.match(app.innerHTML,/Paid checkout is not active yet/);
  assert.match(app.innerHTML,/href="https:\/\/example.com\/creator-kit"/);
  assert.match(app.innerHTML,/Creator Toolkit &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(app.innerHTML,/<script>alert\(1\)<\/script>/);
  assert.match(app.innerHTML,/Original website could not be fetched/);
  await events.click({target:{closest(sel){return sel==='[data-copy-headline]'?{}:null;}}});
  assert.equal(copied,'Practical tools for creators');
  assert.equal(feedback.textContent,'Headline copied!');
});

test('Results view survives partial or corrupt stored data without crashing', async()=>{
  const app={innerHTML:''};
  globalThis.location={hash:'#/results'};
  globalThis.window={scrollTo(){},addEventListener(){}};
  globalThis.document={title:'',body:{dataset:{}},querySelector(sel){return sel==='#app'?app:null;},getElementById(){return null;},addEventListener(){}};
  globalThis.sessionStorage={getItem(){return JSON.stringify({product:{title:'Partial'}});},setItem(){},removeItem(){}};
  await import('../app.js?results-corrupt-qa');
  assert.match(app.innerHTML,/No audit available/);
  assert.match(app.innerHTML,/Analyze a product/);
});