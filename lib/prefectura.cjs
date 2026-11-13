'use strict';
const {PNA,parsePna,valid}=require('./hydrometry.cjs');
const TTL_MS=15*60*1000;
const TIMEOUT_MS=15000;
const SNAPSHOT_KEY='pna-santa-fe-observed-v2';
const LAST_GOOD_KEY='pna-santa-fe-last-good-v2';
function errorInfo(error){
 const nested=error?.cause?.errors||[];
 const code=error?.code||error?.cause?.code||nested[0]?.code||null;
 const category=error?.category||(['TimeoutError','AbortError'].includes(error?.name)?'timeout':code==='UND_ERR_CONNECT_TIMEOUT'?'connect_timeout':code&&/^EAI_|^ENOTFOUND$/.test(code)?'dns':code==='EACCES'||code==='EPERM'?'environment_access':code&&/CERT|TLS|SSL/.test(code)?'tls':'network');
 return {category,code,name:error?.name||'Error',message:String(error?.message||'Error de consulta').slice(0,240)};
}
async function requestHtml(url,{fetcher=fetch,timeoutMs=TIMEOUT_MS}={}){
 const start=Date.now();let httpStatus=null,stage='response_headers';
 try{
  const response=await fetcher(url,{headers:{Accept:'text/html','User-Agent':'AlertaLitoral/1.0 (consulta de alturas publicas)'},signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
  httpStatus=response.status;
  if(!response.ok)throw Object.assign(Error('HTTP '+httpStatus),{category:'http'});
  stage='response_body';
  const html=await response.text();
  if(html.length>1200000)throw Object.assign(Error('Respuesta HTML demasiado grande'),{category:'response_size'});
  if(!/<table\b/i.test(html))throw Object.assign(Error('La respuesta no contiene la tabla de alturas'),{category:'parse'});
  return {html,httpStatus,elapsedMs:Date.now()-start,finalUrl:response.url||url};
 }catch(error){
  error.diagnostic={url,httpStatus,stage,elapsedMs:Date.now()-start,timeoutMs,...errorInfo(error)};throw error;
 }
}
function createPnaClient({request=requestHtml,store=null,now=()=>Date.now(),ttlMs=TTL_MS,cacheMode=store?'shared':'process'}={}){
 let snapshot=null,lastGood=null,pending=null;
 const fresh=entry=>entry?.version===2&&Number.isFinite(entry.expiresAt)&&entry.expiresAt>now()&&entry.checkedAt<=now();
 const output=(entry,cacheHit,extra={})=>{
  const sourceReading=entry.reading;
  const reading=sourceReading&&valid(sourceReading,new Date(now()))?{...sourceReading,retained:!entry.diagnostic.ok}:null;
  return {reading,diagnostic:{...entry.diagnostic,cacheHit,cacheMode,sourceCheckedAt:new Date(entry.checkedAt).toISOString(),nextSourceCheckAt:new Date(entry.expiresAt).toISOString(),...extra}};
 };
 async function refresh(){
  let cacheWarning=null;
  if(store){
   try{const saved=await store.get(SNAPSHOT_KEY);if(fresh(saved)){snapshot=saved;return output(saved,true)}lastGood=await store.get(LAST_GOOD_KEY)||lastGood;}
   catch(error){
    // En Vercel no amplificar el tráfico oficial si el caché compartido falla.
    const checkedAt=now();snapshot={version:2,checkedAt,expiresAt:checkedAt+ttlMs,reading:lastGood,diagnostic:{ok:false,url:PNA,category:'cache_unavailable',httpStatus:null,detail:'No se consulta Prefectura porque falló el caché compartido; se mantiene el respaldo INA',...errorInfo(error)}};
    snapshot.diagnostic.category='cache_unavailable';return output(snapshot,false);
   }
  }
  const checkedAt=now();let reading=null,diagnostic;
  try{
   const response=await request(PNA);
   reading=parsePna(response.html,new Date(now()));
   if(!reading)throw Object.assign(Error('No se encontró una fila SANTA FE / PARANA con altura y fecha válidas'),{category:'parse',diagnostic:{url:PNA,httpStatus:response.httpStatus,elapsedMs:response.elapsedMs,stage:'parse',category:'parse'}});
   diagnostic={ok:true,url:PNA,httpStatus:response.httpStatus,elapsedMs:response.elapsedMs,finalUrl:response.finalUrl,category:'success',detail:reading.qualityWarnings.length?'Observación válida con advertencias en los metadatos':'Observación fechada de SANTA FE / PARANA verificada'};
   lastGood=reading;
  }catch(error){diagnostic={ok:false,url:PNA,httpStatus:null,...errorInfo(error),...error.diagnostic,detail:error.message};reading=lastGood;}
  snapshot={version:2,checkedAt,expiresAt:checkedAt+ttlMs,reading,diagnostic};
  if(store){try{await store.set(SNAPSHOT_KEY,snapshot,{ttl:Math.ceil(ttlMs/1000),name:'Prefectura Santa Fe · última consulta'});if(diagnostic.ok)await store.set(LAST_GOOD_KEY,reading,{ttl:7*24*3600,name:'Prefectura Santa Fe · última observación válida'});}catch(error){cacheWarning='No se pudo guardar el caché compartido: '+errorInfo(error).message;}}
  return output(snapshot,false,cacheWarning?{cacheWarning}:{});
 }
 async function get(){
  if(fresh(snapshot))return output(snapshot,true);
  if(pending)return pending;
  pending=refresh();try{return await pending}finally{pending=null}
 }
 return {get};
}
let defaultClient;
function getPna(){
 if(!defaultClient){
  const store=process.env.VERCEL==='1'?require('@vercel/functions').getCache({namespace:'alerta-litoral-hydrometry'}):null;
  defaultClient=createPnaClient({store,cacheMode:store?'vercel-runtime':'process'});
 }
 return defaultClient.get();
}
module.exports={TTL_MS,TIMEOUT_MS,PNA,requestHtml,errorInfo,createPnaClient,getPna};
