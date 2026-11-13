import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateKit,renderVerifiedKit} from '../kit-dashboard.js';
import {buildPaidKit} from '../lib/paid-kit.js';
const fixture=buildPaidKit({id:'test-campaign',email:'buyer@example.com',iat:100,exp:200,product:{title:'Creator Kit',description:'A collection of creator tools with examples.',audience:'Creators',url:'https://example.com/creator-kit',benefit:'Plan a better creator workflow'}});
test('paid dashboard renders all 6 sections only with verified kit data',()=>{
  const html=renderVerifiedKit(fixture);
  assert.match(html,/Purchase access verified/);
  assert.match(html,/Export complete kit/);
  assert.match(html,/Marketing posts/);
  assert.match(html,/Buyer replies/);
  assert.match(html,/Launch plan/);
  assert.match(html,/Creator Kit/);
  assert.doesNotMatch(html,/fake sales|earned \$[0-9]/i);
});
test('paid workspace does not fetch or render buyer assets without access token',async()=>{
  const target={innerHTML:''};let calls=0;
  const oldDoc=globalThis.document,oldLocation=globalThis.location,oldFetch=globalThis.fetch;
  globalThis.document={querySelector(){return target;}};
  globalThis.location={hash:'#/kit'};
  globalThis.fetch=async()=>{calls++;throw new Error('should not be called');};
  try{await hydrateKit();assert.equal(calls,0);assert.match(target.innerHTML,/verified purchase link is required/i);assert.doesNotMatch(target.innerHTML,/Export complete kit/);}finally{globalThis.document=oldDoc;globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
test('invalid purchase token cannot unlock paid dashboard',async()=>{
  const target={innerHTML:''};let sentAuth;
  const oldDoc=globalThis.document,oldLocation=globalThis.location,oldFetch=globalThis.fetch;
  globalThis.document={querySelector(){return target;}};
  globalThis.location={hash:'#/kit?access=invalidtoken'};
  globalThis.fetch=async(_url,opts)=>{sentAuth=opts.headers.Authorization;return{ok:false,json:async()=>({error:'This purchase link could not be verified.'})}};
  try{await hydrateKit();assert.equal(sentAuth,'Bearer invalidtoken');assert.match(target.innerHTML,/could not be verified/i);assert.doesNotMatch(target.innerHTML,/Export complete kit/);}finally{globalThis.document=oldDoc;globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
