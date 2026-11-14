import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import health from '../api/health.js';

function mockRequest(method='GET'){
  const headers={};let code=200,payload=null;
  const res={
    setHeader(k,v){headers[k]=v;return this;},
    status(v){code=v;return this;},
    json(v){payload=v;return this;}
  };
  health({method},res);
  return {code,payload,headers};
}

test('API health endpoint accepts GET/HEAD and declines unsupported methods',()=>{
  const ok=mockRequest();
  assert.equal(ok.code,200);
  assert.deepEqual(ok.payload,{ok:true,service:'salefix',component:'api'});
  assert.equal(ok.headers['Cache-Control'],'no-store');
  assert.equal(mockRequest('HEAD').code,200);
  assert.equal(mockRequest('POST').code,405);
});

test('Vercel explicitly serves static root and builds functions without a frontend build step',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.framework,null);
  assert.equal(config.buildCommand,'');
  assert.equal(config.outputDirectory,'.');
  assert.ok(config.functions['api/*.js']);
  assert.ok(config.functions['api/*.js'].maxDuration<=60);
});

test('root HTML asset references resolve to tracked files',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const assetPaths=[...html.matchAll(/(?:href|src)="\/(?!\/)([^"]+)"/g)].map(m=>m[1]);
  assert.ok(assetPaths.length>5);
  for(const part of assetPaths){
    const data=await readFile(new URL('../'+part,import.meta.url));
    assert.ok(data.length>0,`Missing asset ${part}`);
  }
});
