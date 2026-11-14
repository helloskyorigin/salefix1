import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAiFindings,reviewFileWithGemini} from '../lib/ai-file-review.js';

const files=[{
 name:'Launch Guide.txt',ext:'txt',inspected:true,size:2500,
 text:'Step 1: Write three example posts for your launch audience. Then publish each draft and review your comments. '.repeat(6),
 entries:[],pages:0
}];
const exact='Step 1: Write three example posts for your launch audience.';
const finding={file:'Launch Guide.txt',quote:exact,issue:'The first step could clarify its expected output',fix:'Add a completed sample post so readers can compare their draft against the intended result.',severity:'medium'};
test('AI content suggestions require verifiable excerpts from the uploaded source',()=>{
 const result=validateAiFindings({findings:[
  {...finding,quote:'This invented file passage never existed anywhere in the source!'},
  finding,
  finding,
  {...finding,file:'Another.pdf'}
 ]},files);
 assert.equal(result.length,1);
 assert.match(result[0].evidence,/Launch Guide.txt/);
 assert.match(result[0].evidence,/Step 1/);
 assert.equal(result[0].severity,'medium');
});
test('AI uses only excerpts, a server API key, and structured output',async()=>{
 let request=null;
 const mockFetch=async(url,init)=>{
   request={url,init};
   return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({findings:[finding]})}]}}]})};
 };
 const result=await reviewFileWithGemini(files,{apiKey:'test-private-key',fetchImpl:mockFetch,model:'gemini-3.5-flash-lite'});
 assert.equal(result.length,1);
 assert.match(request.url,/generativelanguage.googleapis.com/);
 assert.equal(request.init.headers['x-goog-api-key'],'test-private-key');
 const body=JSON.parse(request.init.body);
 assert.equal(body.generationConfig.responseMimeType,'application/json');
 assert.ok(body.generationConfig.responseJsonSchema);
 assert.match(body.contents[0].parts[0].text,/Write three example posts/);
 assert.doesNotMatch(body.contents[0].parts[0].text,/test-private-key/);
});
test('AI returns no findings and makes no API call without credentials or useful text',async()=>{
 let called=0;
 const result=await reviewFileWithGemini(files,{apiKey:'',fetchImpl:async()=>{called++;}});
 assert.equal(result,null);assert.equal(called,0);
});
