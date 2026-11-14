import crypto from 'node:crypto';

// Dependency-free Upstash Redis REST client. Secrets are only read on the server.
export function redisReady(env=process.env){
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
export async function redisCommand(command,{env=process.env,fetchImpl=globalThis.fetch}={}){
  if(!redisReady(env))throw Error('Persistent Redis storage is not configured.');
  const url=new URL(env.UPSTASH_REDIS_REST_URL);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('Redis requires an HTTPS endpoint.');
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),5000);
  try{
    const res=await fetchImpl(url.toString(),{
      method:'POST',signal:control.signal,
      headers:{Authorization:'Bearer '+env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify(command)
    });
    if(!res.ok)throw Error('Persistent storage unavailable.');
    const body=await res.json();
    if(body.error)throw Error('Persistent storage operation failed.');
    return body.result;
  }finally{clearTimeout(timer)}
}
export const keyHash=(value)=>crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,48);
export async function saveJSON(key,value,seconds=60*60*24*30,options={}){
  return redisCommand(['SET',key,JSON.stringify(value),'EX',seconds],options);
}
export async function getJSON(key,options={}){
  const value=await redisCommand(['GET',key],options);
  if(value==null)return null;
  try{return JSON.parse(value)}catch{return null}
}
export async function setOnce(key,value,seconds,options={}){
  return (await redisCommand(['SET',key,String(value),'NX','EX',seconds],options))==='OK';
}
