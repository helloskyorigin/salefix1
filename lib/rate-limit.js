import {redisReady,redisCommand,keyHash} from './redis.js';

// EVAL is atomic: increment and expiry happen together, even across regions.
const FIXED_WINDOW_SCRIPT="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";
const memory=new Map();
export async function enforceRateLimit(req,group,{limit=12,windowSeconds=3600,now=Date.now(),env=process.env,redis=redisCommand}={}){
  const proxyIp=String(req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const key='salefix:limit:'+group+':'+Math.floor(now/(windowSeconds*1000))+':'+keyHash(proxyIp);
  let count;
  if(redisReady(env)){
    count=Number(await redis(['EVAL',FIXED_WINDOW_SCRIPT,1,key,windowSeconds],{env}));
  }else{
    // Keep the free deterministic audit usable even before storage setup.
    // This memory fallback is per-instance only, NOT a durable global limit.
    // Paid/LLM-backed operations must NOT run without an atomic Redis limit.
    if(group!=='audit'||env.SALEFIX_ENABLE_HEADLINE_AI==='true'&&env.GEMINI_API_KEY||env.SALEFIX_ENABLE_FILE_AI==='true'&&env.GEMINI_API_KEY){
      return {allowed:false,status:503,retryAfter:60,reason:'This operation requires persistent rate-limit storage.'};
    }
    const seen=memory.get(key)||0;count=seen+1;memory.set(key,count);
    if(memory.size>2000)memory.clear();
  }
  const remaining=Math.max(0,limit-count);
  const retryAfter=Math.max(1,Math.ceil((Math.ceil((now+1)/(windowSeconds*1000))*(windowSeconds*1000)-now)/1000));
  return {allowed:count<=limit,status:count<=limit?200:429,remaining,retryAfter,reason:'Too many audits. Please try again later.'};
}
