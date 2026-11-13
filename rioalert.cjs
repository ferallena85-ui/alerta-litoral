'use strict';
// Fuente secundaria. No es una API de Prefectura ni un pronóstico.
// Se usa solo cuando publica una observación identificable de SANTA FE / PARANÁ.
const {clean}=require('./reports.cjs');
const {valid}=require('./hydrometry.cjs');
const URL='https://rioalert.com.ar/puertos/santa-fe';
const OFFICIAL='https://contenidosweb.prefecturanaval.gob.ar/alturas/index.php';
const TTL_MS=15*60*1000;
const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const KEY='rioalert-santa-fe-v1';
const LAST_KEY='rioalert-santa-fe-last-good-v1';

function parseRioAlert(html,now=new Date()){
 const body=clean(String(html).replace(/<\/(?:p|li|h[1-6]|div|section|article|dd|dt)>/gi,' $& '));
 if(!/Altura del r[ií]o Paran[aá] en Santa Fe/i.test(body) ||
    !/Santa Fe,\s*Santa Fe\s*[·\-]\s*r[ií]o Paran[aá]/i.test(body))return null;
 const start=body.search(/(?:Última|Ultima) medici[oó]n/i);
 if(start<0)return null;
 const segment=body.slice(start,start+1500).split(/\bNiveles de alerta y evacuaci[oó]n\b/i)[0];
 if(!/\bMedido\s*[·\-]\s*Prefectura Naval Argentina\b/i.test(segment))return null;
 const match=segment.match(/\bAltura\s*:\s*([0-9]{1,2}[.,][0-9]{1,2})\s*m\s*,?\s*medida\s+el\s+(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+(20\d{2})\s*[·\-]\s*(\d{1,2}):(\d{2})/i);
 if(!match)return null;
 const [,raw,dd,month,yyyy,hh,mm]=match;
 const day=Number(dd),hour=Number(hh),min=Number(mm),m=MONTHS.indexOf(month.toLowerCase())+1;
 if(day<1||day>31||hour>23||min>59||!m)return null;
 const value=Number(raw.replace(',','.'));
 if(!Number.isFinite(value)||value<0||value>20)return null;
 const localDate=`${yyyy}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const timestamp=Date.parse(`${localDate}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00-03:00`);
 if(!Number.isFinite(timestamp) || new Date(timestamp-3*3600000).toISOString().slice(0,10)!==localDate)return null;
 const station={river:'Paraná',station:'Santa Fe (Puerto)',value,observedAt:new Date(timestamp).toISOString(),
  source:OFFICIAL,sourceName:'RíoAlert · lectura atribuida a Prefectura (fuente secundaria)',
  via:URL,kind:'observed',trend:null,previous:null,
  alertThreshold:null,evacuationThreshold:null};
 // La tendencia y el cambio publicados por el retransmisor no se atribuyen a
 // una lectura previa concreta; nunca afirmar 'en 24 h' sin una pareja fechada.
 const trend=segment.match(/Tendencia\s*:\s*(creciente|creciendo|decreciente|bajando|estable|estacionari[oa])/i)?.[1]?.toLowerCase();
 station.trend=trend?.startsWith('crec')?'crece':trend==='decreciente'||trend==='bajando'?'baja':trend?'estable':null;
 return valid(station,now)?station:null;
}

async function requestRio({fetcher=fetch,timeoutMs=5500,now=new Date()}={}){
 const begin=Date.now();
 const response=await fetcher(URL,{headers:{Accept:'text/html'},redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw Error(`RíoAlert HTTP ${response.status}`);
 const type=response.headers?.get?.('content-type')||'';
 if(type&&!/text\/html/i.test(type))throw Error('Tipo de respuesta no HTML');
 const html=(await response.text()).slice(0,500000);
 const reading=parseRioAlert(html,now);
 if(!reading)throw Error('RíoAlert respondió, pero no se verificó lectura SANTA FE / PARANÁ con horario');
 return {reading,elapsedMs:Date.now()-begin};
}

function createClient({fetcher=fetch,store=null,now=()=>Date.now(),ttlMs=TTL_MS}={}){
 let snapshot=null,pending=null,lastGood=null;
 const fresh=x=>x?.version===1&&Number.isFinite(x.expiresAt)&&x.expiresAt>now()&&x.checkedAt<=now();
 const present=(s,hit)=>({reading:s.reading&&valid(s.reading,new Date(now()))?{...s.reading,retained:!s.ok}:null,
  diagnostic:{ok:s.ok,category:s.ok?'success':s.category,detail:s.detail,sourceCheckedAt:new Date(s.checkedAt).toISOString(),cacheHit:hit,url:URL,records:s.reading?1:0}});
 async function refresh(){
  if(store){try{const cached=await store.get(KEY);if(fresh(cached)){snapshot=cached;return present(snapshot,true)}lastGood=await store.get(LAST_KEY)||lastGood;}
   catch(error){const t=now();snapshot={version:1,ok:false,category:'cache_unavailable',detail:'Caché compartida inaccesible: se evita una consulta por visitante',checkedAt:t,expiresAt:t+ttlMs,reading:lastGood};return present(snapshot,false);}}
  const checkedAt=now();let reading=lastGood,ok=false,category='network',detail='Sin respuesta';
  try{const res=await requestRio({fetcher,now:new Date(now())});reading=res.reading;lastGood=reading;ok=true;category='success';detail=`Lectura secundaria verificable; ${res.elapsedMs} ms`;}
  catch(error){category=error.name==='TimeoutError'?'timeout':'network_or_format';detail=String(error.message||error).slice(0,160);}
  snapshot={version:1,ok,category,detail,checkedAt,expiresAt:checkedAt+ttlMs,reading};
  if(store)try{await store.set(KEY,snapshot,{ttl:Math.ceil(ttlMs/1000),name:'RíoAlert Santa Fe · consulta'});if(ok)await store.set(LAST_KEY,reading,{ttl:48*3600,name:'RíoAlert Santa Fe · última válida'});}catch{}
  return present(snapshot,false);
 }
 async function get(){if(fresh(snapshot))return present(snapshot,true);if(pending)return pending;pending=refresh();try{return await pending}finally{pending=null}}
 return {get};
}
let singleton;
function getRioAlert(){if(!singleton){let store=null;
 if(process.env.VERCEL==='1')store=require('@vercel/functions').getCache({namespace:'alerta-litoral-hydrometry'});
 singleton=createClient({store});
}return singleton.get()}
module.exports={URL,OFFICIAL,TTL_MS,parseRioAlert,requestRio,createClient,getRioAlert};
