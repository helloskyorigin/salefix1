import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import analyzeHandler from './api/analyze.js';
import checkoutHandler from './api/checkout.js';
import paidKitHandler from './api/paid-kit.js';
import healthHandler from './api/health.js';
import statusHandler from './api/status.js';
import webhookHandler from './api/dodo-webhook.js';
import recoveryHandler from './api/recover.js';
import publishHandler from './api/publish.js';
import publicPageHandler from './api/public-page.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const handlers={
  '/api/analyze':analyzeHandler,'/api/checkout':checkoutHandler,
  '/api/paid-kit':paidKitHandler,'/api/health':healthHandler,
  '/api/status':statusHandler,'/api/dodo-webhook':webhookHandler,
  '/api/recover':recoveryHandler,'/api/publish':publishHandler,
  '/api/public-page':publicPageHandler
};
const server=http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`)}catch{res.writeHead(400);res.end('Invalid URL');return}
  const pageMatch=url.pathname.match(/^\/p\/([a-f0-9-]{36})$/);
  const apiPath=pageMatch?'/api/public-page':url.pathname;
  if(handlers[apiPath]){
    let body='';
    if(req.method==='POST'){
      const chunks=[];let length=0;
      try{
        for await(const chunk of req){
          length+=chunk.length;
          if(length>250000){res.writeHead(413);res.end('Request too large');return}
          chunks.push(chunk);
        }
      }catch{res.writeHead(400);res.end('Invalid request body');return}
      body=Buffer.concat(chunks).toString('utf8');
      if(apiPath==='/api/dodo-webhook')req.rawBody=body;
      else{
        try{req.body=body?JSON.parse(body):{}}catch{res.writeHead(400);res.end('Invalid JSON');return}
      }
    }
    req.query=Object.fromEntries(url.searchParams.entries());
    if(pageMatch)req.query.slug=pageMatch[1];
    const adapter={
      statusCode:200,headers:{},
      setHeader(key,value){this.headers[key]=value;return this},
      status(code){this.statusCode=code;return this},
      json(value){res.writeHead(this.statusCode,{'Content-Type':'application/json; charset=utf-8',...this.headers});res.end(req.method==='HEAD'?'':JSON.stringify(value));return this},
      send(value){res.writeHead(this.statusCode,{'Content-Type':'text/plain; charset=utf-8',...this.headers});res.end(req.method==='HEAD'?'':String(value));return this}
    };
    try{await handlers[apiPath](req,adapter)}catch{if(!res.headersSent){res.writeHead(503);res.end('Request unavailable')}}
    return;
  }
  if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return}
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end('Invalid path');return}
  if(pathname==='/')pathname='/index.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
  try{
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?'':bytes);
  }catch{res.writeHead(404);res.end('Not found')}
});
const port=Number(process.env.PORT||3000);
server.listen(port,()=>console.log(`SaleFix running on http://localhost:${port}`));
