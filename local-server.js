import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeProduct} from './lib/audit.js';
import paidKitHandler from './api/paid-kit.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  if(req.url?.split('?')[0]==='/api/analyze'){
    if(req.method!=='POST'){res.writeHead(405);res.end('Method not allowed');return}
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>16000){res.writeHead(413);res.end('Too large');return}chunks.push(chunk)}
    try{const result=await analyzeProduct(JSON.parse(Buffer.concat(chunks).toString('utf8')));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result))}
    catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(e.message)}))};return;
  }
  if(req.url?.split('?')[0]==='/api/paid-kit'){
    const headers={};let code=200;
    const adapter={setHeader(name,value){headers[name]=value;return this},status(value){code=value;return this},json(payload){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(payload));return this}};
    return paidKitHandler(req,adapter);
  }
  if(req.url?.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Checkout is not configured.'}));return}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url||'/',`http://${req.headers.host}`).pathname)}catch{res.writeHead(400);res.end();return}
  if(pathname==='/')pathname='/index.html';
  let file=path.resolve(root, '.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes)}catch{res.writeHead(404);res.end('Not found')}
});
const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`SaleFix running on http://localhost:${port}`));
