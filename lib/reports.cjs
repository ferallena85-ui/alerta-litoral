/* Alerta Litoral: datos oficiales. No inferimos que la falta de datos implique seguridad. */
'use strict';
const { createHash } = require('node:crypto');
const SOURCES = Object.freeze({
  inaDaily: 'https://alerta.ina.gob.ar/a5/diario/reporte_diario',
  inaMap: 'https://alerta.ina.gob.ar/',
  enso: 'https://www.argentina.gob.ar/ina/el-nino-situacion-hidrometeorologica-en-argentina',
  ensoDirect: 'https://ws2.smn.gob.ar/enos',
  municipal: 'https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/monitoreo/',
  feed: 'https://santafeciudad.gov.ar/feed/',
  feedNews: 'https://santafenoticias.gob.ar/feed/',
  inaRec:'https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=103',
  inaSF:'https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=30'
});
const ents = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',ordm:'º',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'};
function decode(s='') { return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,k)=>{
 if(k[0]==='#'){const code=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return Number.isFinite(code)&&code>0?String.fromCodePoint(Math.min(code,0x10ffff)):' '};return ents[k.toLowerCase()]??' ';}); }
function clean(x=''){return decode(String(x).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()}
function tagTexts(html, tag){let arr=[];let regex=new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'gi'); for(const m of String(html).matchAll(regex))arr.push(clean(m[1]));return arr;}
function num(s) {const v=String(s??'').trim().replace(/\s/g,'');if(!/^[+-]?\d{1,3}(?:[.,]\d{1,3})?$/.test(v))return null;const n=Number(v.replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=40?n:null}
function day(s){if(!s)return null; const d=new Date(s); return Number.isNaN(d.getTime())?null:d.toISOString();}
function dateAgeHours(d,now=new Date()){const x=day(d);return x?(now.getTime()-new Date(x).getTime())/3600000:null}
function strip(html){return clean(html.replace(/<\/(?:p|tr|h[1-6]|li|div|br|section)>/gi,' $& '))}
function rows(html){const out=[];for(const m of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const c=[];for(const t of m[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi))c.push(clean(t[2]));if(c.length>=3)out.push(c)}return out}
function parseMap(html){
 const result=[];
 for (const cells of rows(html)){
  const n=cells.findIndex(c=>/^(Santa Fe|Recreo\s*-\s*Ruta Provincial[^]*70|Tostado)$/i.test(c));
  if(n<0)continue;
  const dateIndex=cells.findIndex(c=>/^20\d\d-\d\d-\d\dT/.test(c));
  if(dateIndex<0)continue;
  const value=num(cells[dateIndex+1]); const previous=num(cells[dateIndex+2]);
  if(value===null)continue;
  const name=cells[n];const rio=cells.some(c=>/SALADOSANTAFE|Salado Santafesino/i.test(c))?'Salado':cells.some(c=>/PARANAINF|^Paran[aá]$/i.test(c))?'Paraná':null;
  if(!rio)continue;
  const station= name.toLowerCase()==='santa fe'?'Santa Fe (Puerto)':name.toLowerCase()==='tostado'?'Tostado':'Recreo · Ruta 70';
  const trend=cells.slice(dateIndex+3,dateIndex+8).find(c=>/^(crece|baja|estable)$/i.test(c))||null;
  const record={river:rio,station,value,previous,trend,observedAt:day(cells[dateIndex]),source:SOURCES.inaMap,alertThreshold:null,evacuationThreshold:null};
  // La tabla de INA incluye niveles específicos por estación, no por zona urbana.
  if (n+6<cells.length){
   const alert=num(cells[n+5]),evac=num(cells[n+6]);
   record.alertThreshold=alert>0?alert:null; record.evacuationThreshold=evac>0?evac:null;
  }
  result.push(record);
 }
 return result;
}
function parseDaily(html){
 const text=strip(html);
 const dm=text.match(/Fecha de actualizaci[oó]n\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const date=dm?dm[1].split('/').reverse().join('-'):null;
 let santaFe=null;
 for(const cells of rows(html)){
   if(cells.some(c=>/^Santa Fe$/i.test(c)) && cells.some(c=>/^Paran[aá]$/i.test(c))){
     const i=cells.findIndex(c=>/^Santa Fe$/i.test(c));const start=cells.slice(i+1);const p=start.findIndex(c=>/^Paran[aá]$/i.test(c));
     if(p>=0){const value=num(start[p+1]),alert=num(start[p+2]),evac=num(start[p+3]);
       if(value!==null) santaFe={river:'Paraná',station:'Santa Fe (Puerto)',value,alertThreshold:alert,evacuationThreshold:evac,trend:null,observedAt:null,reportedOn:date,source:SOURCES.inaDaily};
     }
   }
 }
 // Conservar los términos del INA, sin convertirlos en pronósticos propios.
 const sentencePattern=/Aguas abajo,?\s*sobre Santa Fe\s*\/\s*Paran[aá]\s*-\s*Rosario[^]*?(?=\s*(?:\n\s*[-•]|Gr[aá]ficos de nivel|####|Notas|$))/i;
 let outlook='';
 const m=text.match(/Aguas abajo,?\s*sobre Santa Fe\s*\/\s*Paran[aá]\s*-\s*Rosario[\s\S]{0,1300}/i);
 if(m)outlook=m[0].split(/(?:Gráficos de nivel|Pronóstico|Image:)/i)[0].slice(0,850).trim();
 return {date,santaFe,outlook};
}
// Extrae solo lecturas observadas, nunca extrapola alturas ni usa predicciones como observaciones.
function parseObservations(raw,river,station,source){
 let obj;try{obj=typeof raw==='string'?JSON.parse(raw):raw}catch{return null}
 let arr=Array.isArray(obj)?obj:[];
 if(!arr.length&&obj&&typeof obj==='object')for(const k of ['observaciones','observations','data','items','result','results']){
   const found=obj[k];if(Array.isArray(found)){arr=found;break}
   if(found&&typeof found==='object'){
    const sub=found.observaciones||found.data||found.items;if(Array.isArray(sub)){arr=sub;break}
   }
 }
 const valid=[];
 for(const x of arr){if(!x||typeof x!=='object')continue;
   const v=num(x.valor??x.value??x.obs??x.altura);
   const dt=day(x.timestart??x.fecha??x.date??x.time??x.timestamp);
   if(v!==null&&dt)valid.push({value:v,observedAt:dt});
 }
 valid.sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
 if(!valid.length)return null;
 return {river,station,value:valid[0].value,previous:valid[1]?.value??null,trend:valid.length<2?null:valid[0].value>valid[1].value?'crece':valid[0].value<valid[1].value?'baja':'permanece',observedAt:valid[0].observedAt,source,alertThreshold:null,evacuationThreshold:null};
}
function parseBulletin(html){
 const links=[];
 for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const title=clean(m[2]);if(!/bolet[ií]n\s*(?:n[°ºo.]*)?\s*\d+/i.test(title))continue;
  const date=title.match(/publicado\s*:\s*(\d{2})\/(\d{2})\/(20\d{2})/i);
  const href=m[1].match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href||!date)continue;
  let url;try{url=new URL(decode(href),SOURCES.enso).href}catch{continue}
  if(!/^https:\/\/www\.argentina\.gob\.ar\//.test(url))continue;
  links.push({title,publishedAt:`${date[3]}-${date[2]}-${date[1]}T12:00:00-03:00`,url,sourceName:'Boletín oficial nacional'});
 }
 return links.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0]||null;
}
function parseEnso(html,source=SOURCES.enso){
 const text=strip(html);
 const titleMatch=text.match(/El fen[oó]meno El Ni[nñ]o[^\n]{0,110}?[-–]\s*(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(20\d\d)/i)
  ||text.match(/El Ni[nñ]o\s*\/\s*La Ni[nñ]a\s*\(([^)]*20\d\d)\)/i);
 const rawMonth=titleMatch?(titleMatch[1]||''):'',year=titleMatch?Number(titleMatch[2]||((titleMatch[1]||'').match(/20\d\d/)||[])[0]):null;
 const mon=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(rawMonth.trim().toLowerCase().split(' ')[0]);
 let published=mon>=0&&year?`${year}-${String(mon+1).padStart(2,'0')}-01`:null;
 const exactDate=text.match(/(?:Servicio Meteorol[oó]gico Nacional[. ,]*)?\(\s*20\d\d-\d\d-\d\d\s*\)/);
 if(exactDate)published=exactDate[0].match(/20\d\d-\d\d-\d\d/)[0];
 const phrases=text.match(/(?:Las condiciones del ENOS|Las condiciones del fen[oó]meno|De acuerdo a los modelos)[\s\S]{100,850}?(?=\s*(?:Colecciones|Fecha|Metadatos|Enviar|Ficheros|Informes anteriores|El Niño\/La Niña \())/i);
 let description=phrases?.[0]?.slice(0,620)?.trim()||'';
 if(!description){const m=text.match(/(?:Las condiciones del ENOS|La temperatura del agua del mar)[\s\S]{80,720}/i);description=m?.[0]?.slice(0,580).trim()||''}
 // Rechazar contenido contaminado con navegación.
 description=description.replace(/\s+(?:Colecciones|Fecha de publicaci[oó]n|Metadatos|Ficheros en el [ií]tem|Informes anteriores)[\s\S]*$/i,'').trim();
 const warm=/fase c[aá]lida|El Ni[nñ]o de fuerte|fase de El Ni[nñ]o/i.test(description);
 const cold=/fase fr[ií]a|La Ni[nñ]a/i.test(description);
 return {title:titleMatch?`Informe ENOS · ${rawMonth} ${year||''}`.trim(): 'Informe ENOS · SMN',status:warm?'Fase cálida / El Niño':cold?'Fase fría / La Niña':'Consultar informe oficial',summary:description||'Consultá el último informe oficial del Servicio Meteorológico Nacional.',publishedAt:published,source};
}
function parseFeed(xml,now=new Date()){
 const result=[];const kw=/lluv|aneg|inund|evacua|salado|paran[aá]|defensa h[ií]drica|alerta meteorol|desag[uü]e|estaciones de bombeo|riesgo h[ií]drico|precipit|crecida|tormenta|emergencia/i;
 for(const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const item=match[1];
  function get(tag){const m=item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return clean(m?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')||'')}
  const title=get('title'),link=get('link'),description=get('description'),date=day(get('pubDate'));
  if(!title||!/^https:\/\/(?:www\.)?(?:santafeciudad\.gov\.ar|santafenoticias\.gob\.ar)\//i.test(link))continue;
  if(!kw.test(title+' '+description))continue;
  const age=date?dateAgeHours(date,now):null;
  if(age===null||age< -3||age>30*24)continue;
  result.push({title,summary:description.slice(0,180),publishedAt:date,url:link,sourceName:link.includes('santafenoticias.gob.ar')?'Gobierno de Santa Fe':'Municipalidad de Santa Fe'});
 }
 return result.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,6);
}
async function get(url){const response=await fetch(url,{headers:{'User-Agent':'AlertaLitoral/1.0 (+fuentes-publicas; contacto-via-sitio) Accept-Language: es-AR','Accept':'text/html, application/rss+xml, */*'},signal:AbortSignal.timeout(10500),redirect:'follow'});if(!response.ok)throw Error('HTTP '+response.status);const ct=response.headers.get('content-type')||'';if(/image|pdf|binary/.test(ct))throw Error('No HTML/XML');const raw=await response.text();return raw.slice(0,1500000)}
async function collect({fetcher=get,now=new Date()}={}){
 const d0=new Date(now.getTime()-6*86400000).toISOString().slice(0,10);const d1=now.toISOString().slice(0,10);
 const urls=[SOURCES.inaDaily,SOURCES.inaMap,SOURCES.enso,SOURCES.ensoDirect,SOURCES.feed,SOURCES.feedNews,`${SOURCES.inaRec}&timestart=${d0}&timeend=${d1}`,`${SOURCES.inaSF}&timestart=${d0}&timeend=${d1}`];
 const response=await Promise.allSettled(urls.map(x=>fetcher(x)));
 const content=response.map(r=>r.status==='fulfilled'?r.value:null);
 let daily={date:null,santaFe:null,outlook:''};try{if(content[0])daily=parseDaily(content[0])}catch(e){}
 let stations=[];try{if(content[1])stations=parseMap(content[1])}catch(e){}
 const apiSalado=content[6]?parseObservations(content[6],'Salado','Recreo · Ruta 70',SOURCES.inaRec):null;
 const apiParana=content[7]?parseObservations(content[7],'Paraná','Santa Fe (Puerto)',SOURCES.inaSF):null;
 const parana= daily.santaFe||stations.find(s=>s.river==='Paraná'&&s.station.startsWith('Santa Fe'))||apiParana||null;
 const salado=stations.find(s=>s.station.startsWith('Recreo'))||apiSalado||null;
 let tostado=stations.find(s=>s.station.startsWith('Tostado'))||null;
 let enso=null;
 try{const a=content[2]?parseEnso(content[2],SOURCES.enso):null, b=content[3]?parseEnso(content[3],SOURCES.ensoDirect):null;
  enso=b?.summary&&!b.summary.startsWith('Consultá')?b:(a||b);
 }catch(e){}
 let news=[];try{if(content[4])news.push(...parseFeed(content[4],now));if(content[5])news.push(...parseFeed(content[5],now));const bulletin=content[2]?parseBulletin(content[2]):null;if(bulletin)news.unshift({...bulletin,summary:'Boletín semanal oficial con escenarios de El Niño, lluvias y situación hidrometeorológica de Argentina. Consultá el documento oficial para más detalles.'});news=[...new Map(news.map(n=>[n.url,n])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,6)}catch(e){}
 const stationsFound=[parana,salado,tostado].filter(Boolean).map(s=>{const ref=s.observedAt||(s.reportedOn?`${s.reportedOn}T12:00:00Z`:null);const age=dateAgeHours(ref,now);return {...s,ageHours:age,stale:age===null||age>72};});
 const forecast=daily.outlook?{text:daily.outlook,source:SOURCES.inaDaily,issuedAt:daily.date}:null;
 const noteworthy=[];
 if(parana?.alertThreshold!=null&&parana.value>=parana.alertThreshold)noteworthy.push({type:'official',title:'El Paraná alcanzó o superó el umbral de alerta de la estación Santa Fe',source:parana.source});
 else if(parana?.alertThreshold!=null&&parana.value>=parana.alertThreshold-0.5)noteworthy.push({type:'tracking',title:'El Paraná se encuentra a menos de 50 cm del umbral de alerta de la estación',source:parana.source});
 if(news.length)noteworthy.push({type:'news',title:`${news.length} publicación(es) oficial(es) relacionada(s) identificada(s)`,source:SOURCES.municipal});
 const digest=JSON.stringify({stations:stationsFound.map(s=>[s.station,s.value,s.observedAt,s.reportedOn]),daily:daily.date,forecast:forecast?.text,enso:enso?.summary,news:news.map(x=>x.url)});
 const hasAny=!!(stationsFound.length||forecast||enso?.summary&&!enso.summary.startsWith('Consultá')||news.length);
 return {
  version:1,checkedAt:now.toISOString(),reportId:createHash('sha256').update(digest).digest('hex').slice(0,12),
  status:hasAny?'partial_or_available':'unavailable',
  reportDate:daily.date,stations:stationsFound,forecast,enso,news,noteworthy,
  sources:[{name:'Instituto Nacional del Agua · reporte diario',url:SOURCES.inaDaily},{name:'INA · estaciones hidrométricas',url:SOURCES.inaMap},{name:'Boletines nacionales de El Niño (INA, SMN y otros organismos)',url:SOURCES.enso},{name:'SMN · El Niño/La Niña',url:SOURCES.ensoDirect},{name:'Municipalidad · Gestión de Riesgo',url:SOURCES.municipal}],
  fetched:{inaDaily:!!content[0],inaMap:!!(content[1]||content[6]||content[7]),smnEnso:!!(content[2]||content[3]),municipality:!!(content[4]||content[5])},
  notice:'Se actualiza el contenido al vencer la caché de ocho horas y recibir una visita. Los organismos publican en sus propios horarios. No sustituye avisos oficiales ni constituye una orden de evacuación.'
 };
}
module.exports={SOURCES,decode,clean,rows,num,parseMap,parseDaily,parseEnso,parseFeed,parseObservations,parseBulletin,collect};
