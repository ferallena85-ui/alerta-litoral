/* Alerta Litoral: datos oficiales. No inferimos que la falta de datos implique seguridad. */
'use strict';
const { createHash } = require('node:crypto');
const SOURCES = Object.freeze({
  inaDaily: 'https://alerta.ina.gob.ar/a5/diario/reporte_diario',
  inaMap: 'https://alerta.ina.gob.ar/',
  inaSaladoStation: 'https://alerta.ina.gob.ar/a5/secciones',
  provinceAlert: 'https://www.santafe.gob.ar/noticias/noticia/287215/',
  fichSalado: 'https://cim.fich.unl.edu.ar/rios/salado/alturas',
  fichSantoTome:'https://fich.unl.edu.ar/cim/rios/historico/6',
  fichRecreo:'https://fich.unl.edu.ar/cim/rios/historico/5',
  municipalSantoTome:'https://www.santotome.gob.ar/Otros/noticias_ciudad',
  municipalSantoTomeHome:'https://www.santotome.gob.ar/',
  enso: 'https://www.argentina.gob.ar/ina/el-nino-situacion-hidrometeorologica-en-argentina',
  ensoDirect: 'https://ws2.smn.gob.ar/enos',
  municipal: 'https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/monitoreo/',
  feed: 'https://santafeciudad.gov.ar/feed/',
  feedNews: 'https://santafenoticias.gob.ar/feed/',
  inaRec:'https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=103',
  inaSanto:'https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=3044',
  inaSF:'https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=30',
  inaCsvBase:'https://alerta.ina.gob.ar/a5/obs/puntual/series',
  inaSeriesBase:'https://alerta.ina.gob.ar/a5/getSeriesBySiteAndVar'
});
const ents = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'Ã¡',eacute:'Ã©',iacute:'Ã­',oacute:'Ã³',uacute:'Ãº',ntilde:'Ã±',ordm:'Âº',hellip:'â¦',lsquo:'â',rsquo:'â',ldquo:'â',rdquo:'â'};
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
 for(const cells of rows(html)){
  const nameIndex=cells.findIndex(c=>/^(?:Santa Fe|Santo Tom[eÃ©]|Recreo\s*[-â]\s*(?:Ruta\s*Provincial|RP|R\.?P\.?)\s*(?:n[Â°Âºo.]*)?\s*70|Tostado|Emilia(?:\s*[-â]\s*.*)?|San Justo(?:\s*[-â]\s*.*)?)$/i.test(c));
  if(nameIndex<0)continue;
  const dateIndex=cells.findIndex(c=>/^20\d\d-\d\d-\d\dT/.test(c));
  if(dateIndex<0)continue;
  const value=num(cells[dateIndex+1]), previous=num(cells[dateIndex+2]);
  if(value===null)continue;
  const name=cells[nameIndex];
  const river=cells.some(c=>/SALADOSANTAFE|Salado Santafesino/i.test(c))?'Salado':cells.some(c=>/PARANAINF|^Paran[aÃ¡]$/i.test(c))?'ParanÃ¡':null;
  if(!river)continue;
  let station=null;
  if(river==='ParanÃ¡'&&/^Santa Fe$/i.test(name))station='Santa Fe (Puerto)';
  if(river==='Salado'){
    if(/^Santo Tom[eÃ©]$/i.test(name))station='Santo TomÃ©';
    else if(/^Recreo/i.test(name))station='Recreo Â· Ruta 70';
    else if(/^Tostado/i.test(name))station='Tostado';
    else if(/^Emilia/i.test(name))station='Emilia Â· Ruta 62';
    else if(/^San Justo/i.test(name))station='San Justo Â· Ruta 2';
  }
  if(!station)continue;
  const trend=cells.slice(dateIndex+3,dateIndex+8).find(c=>/^(crece|baja|estable)$/i.test(c))||null;
  // La alerta es un umbral de estaciÃ³n; no representa altura de inundaciÃ³n de barrios.
  const alert=num(cells[nameIndex+5]),evac=num(cells[nameIndex+6]);
  result.push({river,station,value,previous,trend,observedAt:day(cells[dateIndex]),source:SOURCES.inaMap,alertThreshold:alert>0?alert:null,evacuationThreshold:evac>0?evac:null,alertType:river==='Salado'?'tÃ©cnica':null});
 }
 return result;
}
// Informe hidromÃ©trico diario FICHâUNL basado en datos de la red de monitoreo
// provincial. Es un respaldo independiente del visualizador del INA.
function parseFichSalado(html){
 const text=strip(html);
 const monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 const match=text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(20\d\d)\b/i);
 const reportDate=match ? `${match[3]}-${String(monthNames.indexOf(match[2].toLowerCase())+1).padStart(2,'0')}-${match[1].padStart(2,'0')}` : null;
 const records=[];
 for(const cells of rows(html)){
  if(cells.length<7)continue;
  const raw=cells[0];
  const riverName=cells[1];
  if(!/^r[iÃ­]o\s+salado$/i.test(riverName))continue; // no mezclar CululÃº y CalchaquÃ­
  const station=/\brecreo\b/i.test(raw)?'Recreo Â· Ruta 70':/\bsanto\s+tom[eÃ©](?!\w)/i.test(raw)?'Santo TomÃ©':/\bemilia\b/i.test(raw)?'Emilia Â· Ruta 62':/\bsan\s+justo\b/i.test(raw)?'San Justo Â· Ruta 2':/\btostado\b/i.test(raw)?'Tostado':null;
  if(!station)continue;
  const value=num(cells[2]),previous=num(cells[5]),alert=num(cells[6]);
  if(value===null)continue;
  // El parte de FICH indica el dÃ­a, pero no la hora de cada lectura.
  // No inventar una hora especÃ­fica en observedAt.
  const variation=Number(String(cells[3]).trim().replace(',','.'));
  const trend=Number.isFinite(variation)?variation>0?'crece':variation<0?'baja':'estable':null;
  records.push({river:'Salado',station,value,previous,trend,observedAt:null,reportedOn:reportDate,
   source:SOURCES.fichSalado,alertThreshold:alert,evacuationThreshold:null,alertType:'tÃ©cnica'});
 }
 return records;
}
// HistÃ³rico FICH: primera fila con fecha vÃ¡lida, sin valores fijados en cÃ³digo.
function parseFichHistory(html,station,source){
 const table=rows(html);
 const items=[];
 for(const c of table){
  if(c.length<6)continue;
  const m=String(c[0]).match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
  const time=String(c[1]).match(/^(\d{1,2}):(\d{2})$/);
  if(!m||!time)continue;
  const value=num(c[2]),previous=num(c[5]);if(value===null)continue;
  const iso=`${m[3]}-${m[2]}-${m[1]}T${time[1].padStart(2,'0')}:${time[2]}:00-03:00`;
  const observedAt=day(iso);if(!observedAt||observedAt.slice(0,10)!==`${m[3]}-${m[2]}-${m[1]}`)continue;
  const variation=Number(c[3].replace(',','.'));
  const trend=Number.isFinite(variation)?variation>0?'crece':variation<0?'baja':'estable':null;
  const limit=(strip(html).match(/Nivel de alerta\s*:\s*(\d+[,.]\d+)\s*m/i)||[])[1];
  const alertThreshold=num(limit);
  items.push({river:'Salado',station,value,previous,trend,observedAt,source,alertThreshold,evacuationThreshold:null,alertType:'tÃ©cnica'});
 }
 return items.sort((a,b)=>b.observedAt.localeCompare(a.observedAt))[0]||null;
}
function recordTimestamp(s){
 const ref=s?.observedAt || (s?.reportedOn ? `${s.reportedOn}T12:00:00-03:00` : null);
 return ref ? new Date(ref).getTime() : NaN;
}
function latestRecord(a,b){
 if(!a)return b||null;if(!b)return a;
 const aTime=recordTimestamp(a),bTime=recordTimestamp(b);
 if(!Number.isFinite(aTime))return Number.isFinite(bTime)?b:a;
 if(!Number.isFinite(bTime))return a;
 return bTime>aTime?b:a;
}

function parseDaily(html){
 const text=strip(html);
 const dm=text.match(/Fecha de actualizaci[oÃ³]n\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const date=dm?dm[1].split('/').reverse().join('-'):null;
 let santaFe=null;
 for(const cells of rows(html)){
   if(cells.some(c=>/^Santa Fe$/i.test(c)) && cells.some(c=>/^Paran[aÃ¡]$/i.test(c))){
     const i=cells.findIndex(c=>/^Santa Fe$/i.test(c));const start=cells.slice(i+1);const p=start.findIndex(c=>/^Paran[aÃ¡]$/i.test(c));
     if(p>=0){const value=num(start[p+1]),alert=num(start[p+2]),evac=num(start[p+3]);
       if(value!==null) santaFe={river:'ParanÃ¡',station:'Santa Fe (Puerto)',value,alertThreshold:alert,evacuationThreshold:evac,trend:null,observedAt:null,reportedOn:date,source:SOURCES.inaDaily};
     }
   }
 }
 // Conservar los tÃ©rminos del INA, sin convertirlos en pronÃ³sticos propios.
 const sentencePattern=/Aguas abajo,?\s*sobre Santa Fe\s*\/\s*Paran[aÃ¡]\s*-\s*Rosario[^]*?(?=\s*(?:\n\s*[-â¢]|Gr[aÃ¡]ficos de nivel|####|Notas|$))/i;
 let outlook='';
 const m=text.match(/Aguas abajo,?\s*sobre Santa Fe\s*\/\s*Paran[aÃ¡]\s*-\s*Rosario[\s\S]{0,1300}/i);
 if(m)outlook=m[0].split(/(?:GrÃ¡ficos de nivel|PronÃ³stico|Image:)/i)[0].slice(0,850).trim();
 return {date,santaFe,outlook};
}
// Extrae solo lecturas observadas, nunca extrapola alturas ni usa predicciones como observaciones.
// Lectura conservadora de observaciones REALES de INA: JSON anidado o CSV.
// No se leen pronÃ³sticos para presentarlos como altura medida.
function parseObservations(raw,river,station,source){
 const valid=[];
 const add=(v,t)=>{
  const value=num(v),observedAt=day(t);
  if(value!==null&&observedAt)valid.push({value,observedAt});
 };
 let parsed;
 try{parsed=typeof raw==='string'?JSON.parse(raw):raw}catch{parsed=null}
 if(parsed&&typeof parsed==='object'){
  const seen=new WeakSet(); let count=0;
  function visit(node,depth=0){
   if(!node||typeof node!=='object'||depth>8||count++>15000||seen.has(node))return;
   seen.add(node);
   if(Array.isArray(node)){for(const child of node)visit(child,depth+1);return}
   const time=node.timestart??node.timeStart??node.fecha??node.date??node.timestamp??node.time??node.fecha_hora;
   const value=node.valor??node.value??node.altura??node.obs??node.nivel;
   if(time!==undefined&&value!==undefined&&typeof value!=='object')add(value,time);
   for(const key of ['observaciones','observations','data','datos','items','results','result','series','records','values','serie','series_observadas','query']){
     if(Object.hasOwn(node,key))visit(node[key],depth+1);
   }
  }
  visit(parsed);
 }else if(typeof raw==='string'&&!/\s*<(!doctype|html|head|script)/i.test(raw.slice(0,400))){
  // CSV sin metadatos: cabeceras timestart/valor, comillas y delimitador ; o ,.
  const lines=raw.replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(0,5000);
  if(lines.length>=2){
   const delim=lines[0].includes(';')?';':',';
   function cells(line){
    const result=[];let item='',quoted=false;
    for(let i=0;i<line.length;i++){
     const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){item+='"';i++}
     else if(c==='"')quoted=!quoted;
     else if(c===delim&&!quoted){result.push(item.trim());item=''}else item+=c;
    }
    result.push(item.trim());return result;
   }
   const heads=cells(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z]/g,''));
   const dateIndex=heads.findIndex(x=>['timestart','fecha','date','timestamp','time'].includes(x));
   const valIndex=heads.findIndex(x=>['valor','value','altura','nivel'].includes(x));
   if(dateIndex>=0&&valIndex>=0)for(const line of lines.slice(1)){
    const c=cells(line);add(c[valIndex],c[dateIndex]);
   }
  }
 }
 // Deduplicar por instante, y rechazar valores fuera de la escala plausible.
 const unique=[...new Map(valid.map(x=>[x.observedAt,x])).values()].sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
 if(!unique.length)return null;
 return {river,station,value:unique[0].value,previous:unique[1]?.value??null,
  trend:unique.length<2?null:unique[0].value>unique[1].value?'crece':unique[0].value<unique[1].value?'baja':'estable',
  observedAt:unique[0].observedAt,source,alertThreshold:null,evacuationThreshold:null};
}
function thresholds(record){
 if(!record)return null;
 const station=record.station;
 const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 if(record.river==='Paran\u00e1'&&station==='Santa Fe (Puerto)')return {...record,
  alertThreshold:positive(record.alertThreshold)?record.alertThreshold:5.30,
  evacuationThreshold:positive(record.evacuationThreshold)?record.evacuationThreshold:5.70,
  alertType:'oficial',
  thresholdSource:SOURCES.inaDaily};
 if(record.river==='Salado'&&['Santo Tom\u00e9','Recreo \u00b7 Ruta 70'].includes(station))return {...record,
  alertThreshold:positive(record.alertThreshold)?record.alertThreshold:4.70,
  alertType:'t\u00e9cnica',
  alertSource:'https://cim.fich.unl.edu.ar/rios/salado/alturas',
  provincialAlertThreshold:5.70,
  provincialAlertSource:SOURCES.provinceAlert,
  provincialAlertPublished:'2026-09-04',
  evacuationThreshold:null,
  evacuationStatus:'Sin cota de evacuaci\u00f3n publicada para esta escala; las autoridades definen las medidas.'};
 return record;
}
function parseBulletin(html){
 const links=[];
 for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const title=clean(m[2]);if(!/bolet[iÃ­]n\s*(?:n[Â°Âºo.]*)?\s*\d+/i.test(title))continue;
  const date=title.match(/publicado\s*:\s*(\d{2})\/(\d{2})\/(20\d{2})/i);
  const href=m[1].match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href||!date)continue;
  let url;try{url=new URL(decode(href),SOURCES.enso).href}catch{continue}
  if(!/^https:\/\/www\.argentina\.gob\.ar\//.test(url))continue;
  links.push({title,publishedAt:`${date[3]}-${date[2]}-${date[1]}T12:00:00-03:00`,url,sourceName:'BoletÃ­n oficial nacional'});
 }
 return links.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0]||null;
}
function parseEnso(html,source=SOURCES.enso){
 const text=strip(html);
 const titleMatch=text.match(/El fen[oÃ³]meno El Ni[nÃ±]o[^\n]{0,110}?[-â]\s*(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(20\d\d)/i)
  ||text.match(/El Ni[nÃ±]o\s*\/\s*La Ni[nÃ±]a\s*\(([^)]*20\d\d)\)/i);
 const rawMonth=titleMatch?(titleMatch[1]||''):'',year=titleMatch?Number(titleMatch[2]||((titleMatch[1]||'').match(/20\d\d/)||[])[0]):null;
 const mon=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(rawMonth.trim().toLowerCase().split(' ')[0]);
 let published=mon>=0&&year?`${year}-${String(mon+1).padStart(2,'0')}-01`:null;
 const exactDate=text.match(/(?:Servicio Meteorol[oÃ³]gico Nacional[. ,]*)?\(\s*20\d\d-\d\d-\d\d\s*\)/);
 if(exactDate)published=exactDate[0].match(/20\d\d-\d\d-\d\d/)[0];
 const phrases=text.match(/(?:Las condiciones del ENOS|Las condiciones del fen[oÃ³]meno|De acuerdo a los modelos)[\s\S]{100,850}?(?=\s*(?:Colecciones|Fecha|Metadatos|Enviar|Ficheros|Informes anteriores|El NiÃ±o\/La NiÃ±a \())/i);
 let description=phrases?.[0]?.slice(0,620)?.trim()||'';
 if(!description){const m=text.match(/(?:Las condiciones del ENOS|La temperatura del agua del mar)[\s\S]{80,720}/i);description=m?.[0]?.slice(0,580).trim()||''}
 // Rechazar contenido contaminado con navegaciÃ³n.
 description=description.replace(/\s+(?:Colecciones|Fecha de publicaci[oÃ³]n|Metadatos|Ficheros en el [iÃ­]tem|Informes anteriores)[\s\S]*$/i,'').trim();
 const warm=/fase c[aÃ¡]lida|El Ni[nÃ±]o de fuerte|fase de El Ni[nÃ±]o/i.test(description);
 const cold=/fase fr[iÃ­]a|La Ni[nÃ±]a/i.test(description);
 return {title:titleMatch?`Informe ENOS Â· ${rawMonth} ${year||''}`.trim(): 'Informe ENOS Â· SMN',status:warm?'Fase cÃ¡lida / El NiÃ±o':cold?'Fase frÃ­a / La NiÃ±a':'Consultar informe oficial',summary:description||'ConsultÃ¡ el Ãºltimo informe oficial del Servicio MeteorolÃ³gico Nacional.',publishedAt:published,source};
}
function parseFeed(xml,now=new Date()){
 const result=[];const kw=/lluv|aneg|inund|evacua|salado|paran[aÃ¡]|defensa h[iÃ­]drica|alerta meteorol|desag[uÃ¼]e|estaciones de bombeo|riesgo h[iÃ­]drico|precipit|crecida|tormenta|emergencia/i;
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
// Sitio oficial de Santo TomÃ© (Santa Fe), no confundir con Santo TomÃ©, Corrientes.
// Sus tarjetas pÃºblicas no siempre incluyen fecha, por eso jamÃ¡s se marca un artÃ­culo como reciente sin confirmarla.
function parseSantoTomeNews(html){
 const list=[];
 const kw=/h[iÃ­]dric|r[iÃ­]o salado|inund|aneg|evacu|desag[uÃ¼]e|defensa|protecci[oÃ³]n civil|lluvia|tormenta|crecida/i;
 for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!href)continue;
  let url;try{url=new URL(decode(href),SOURCES.municipalSantoTomeHome).href}catch{continue}
  if(!/^https:\/\/www\.santotome\.gob\.ar\/Otros\/noticias_ciudad\/\d+-/i.test(url))continue;
  const title=clean(m[2]);if(title.length<12||!kw.test(title))continue;
  list.push({title,publishedAt:null,url,summary:'Comunicado institucional de Santo TomÃ©. ConsultÃ¡ su fecha y el contenido en la fuente.',sourceName:'Municipalidad de Santo TomÃ© (Santa Fe)'});
 }
 return [...new Map(list.map(x=>[x.url,x])).values()].slice(0,3);
}
async function get(url){const response=await fetch(url,{headers:{'User-Agent':'AlertaLitoral/1.0 (+fuentes-publicas; contacto-via-sitio) Accept-Language: es-AR','Accept':'text/html, application/rss+xml, */*'},signal:AbortSignal.timeout(10500),redirect:'follow'});if(!response.ok)throw Error('HTTP '+response.status);const ct=response.headers.get('content-type')||'';if(/image|pdf|binary/.test(ct))throw Error('No HTML/XML');const raw=await response.text();return raw.slice(0,1500000)}
// Referencias histÃ³ricas DOCUMENTADAS, no son lecturas en vivo ni datos del dÃ­a.
// Se usan Ãºnicamente cuando ningÃºn origen consultado devolviÃ³ la estaciÃ³n.
// La app etiqueta explÃ­citamente su condiciÃ³n histÃ³rica y su fecha.
const LAST_VERIFIED_ARCHIVE=Object.freeze({
 'Recreo Â· Ruta 70':Object.freeze({river:'Salado',station:'Recreo Â· Ruta 70',value:2.15,previous:2.22,trend:'baja',observedAt:'2026-10-28T15:51:00.000Z',source:SOURCES.inaMap,alertThreshold:4.70,evacuationThreshold:null,alertType:'tÃ©cnica'}),
 'Santo TomÃ©':Object.freeze({river:'Salado',station:'Santo TomÃ©',value:4.33,previous:4.30,trend:'crece',observedAt:'2026-10-28T15:52:00.000Z',source:SOURCES.inaMap,alertThreshold:4.70,evacuationThreshold:null,alertType:'tÃ©cnica'})
});
function archivedFallback(station){const previous=LAST_VERIFIED_ARCHIVE[station];return previous?{...previous,archivedReference:true}:null;}

async function collect({fetcher=get,now=new Date()}={}){
 const d0=new Date(now.getTime()-6*86400000).toISOString().slice(0,10);const d1=now.toISOString().slice(0,10);
 const urls=[SOURCES.inaDaily,SOURCES.inaMap,SOURCES.enso,SOURCES.ensoDirect,SOURCES.feed,SOURCES.feedNews,`${SOURCES.inaRec}&timestart=${d0}&timeend=${d1}`,`${SOURCES.inaSF}&timestart=${d0}&timeend=${d1}`,SOURCES.municipalSantoTomeHome,`${SOURCES.inaSanto}&timestart=${d0}&timeend=${d1}`,
  `${SOURCES.inaCsvBase}/103/observaciones?timestart=${d0}&timeend=${d1}&format=csv`,
  `${SOURCES.inaCsvBase}/3044/observaciones?timestart=${d0}&timeend=${d1}&format=csv`,
  `${SOURCES.inaSeriesBase}?tipo=puntual&series_id=103&timestart=${d0}&timeend=${d1}`,
  `${SOURCES.inaSeriesBase}?tipo=puntual&series_id=3044&timestart=${d0}&timeend=${d1}`];
 const response=await Promise.allSettled(urls.map(x=>fetcher(x)));
 const content=response.map(r=>r.status==='fulfilled'?r.value:null);
 const sourceNames=['INA diario','INA mapa','INA boletÃ­n ENOS','SMN ENOS','Municipio Santa Fe RSS','Provincia RSS','INA API Recreo','INA API Santa Fe','Municipio Santo TomÃ©','INA API Santo TomÃ© (Salado)','INA CSV Recreo','INA CSV Santo TomÃ©','INA serie Recreo','INA serie Santo TomÃ©'];
 const sourceChecks=response.map((r,i)=>({name:sourceNames[i],ok:r.status==='fulfilled' && !!r.value,detail:r.status==='fulfilled'?'Recibida':String(r.reason?.message||'Falla al consultar').slice(0,100)}));
 let daily={date:null,santaFe:null,outlook:''};try{if(content[0])daily=parseDaily(content[0])}catch(e){}
 let stations=[];try{if(content[1])stations=parseMap(content[1])}catch(e){}
 const apiSalado=content[6]?parseObservations(content[6],'Salado','Recreo Â· Ruta 70',SOURCES.inaRec):null;
 const apiParana=content[7]?parseObservations(content[7],'ParanÃ¡','Santa Fe (Puerto)',SOURCES.inaSF):null;
 const apiSanto=content[9]?parseObservations(content[9],'Salado','Santo TomÃ©',SOURCES.inaSanto):null;
 const csvRec=content[10]?parseObservations(content[10],'Salado','Recreo Â· Ruta 70',urls[10]):null;
 const csvSanto=content[11]?parseObservations(content[11],'Salado','Santo TomÃ©',urls[11]):null;
 const seriesRec=content[12]?parseObservations(content[12],'Salado','Recreo Â· Ruta 70',urls[12]):null;
 const seriesSanto=content[13]?parseObservations(content[13],'Salado','Santo TomÃ©',urls[13]):null;
 const parana=latestRecord(latestRecord(daily.santaFe,stations.find(s=>s.river==='ParanÃ¡'&&s.station.startsWith('Santa Fe'))),apiParana);
 // Un dato de altura reciente del INA puede venir sin metadatos de umbrales.
 // Conservar entonces los valores verificados en el parte diario del INA.
 if(parana&&daily.santaFe){
  const d=daily.santaFe;
  if((typeof parana.alertThreshold!=='number'||!Number.isFinite(parana.alertThreshold)||parana.alertThreshold<=0)&&typeof d.alertThreshold==='number'&&Number.isFinite(d.alertThreshold)&&d.alertThreshold>0)
   parana.alertThreshold=d.alertThreshold;
  if((typeof parana.evacuationThreshold!=='number'||!Number.isFinite(parana.evacuationThreshold)||parana.evacuationThreshold<=0)&&typeof d.evacuationThreshold==='number'&&Number.isFinite(d.evacuationThreshold)&&d.evacuationThreshold>0)
   parana.evacuationThreshold=d.evacuationThreshold;
 }

 const salado=[stations.find(s=>s.station.startsWith('Recreo')),apiSalado,csvRec,seriesRec].reduce(latestRecord,null);
 const santoTome=[stations.find(s=>s.station==='Santo TomÃ©'),apiSanto,csvSanto,seriesSanto].reduce(latestRecord,null);
 const tostado=stations.find(s=>s.station.startsWith('Tostado'))||null;
 const emilia=stations.find(s=>s.station.startsWith('Emilia'))||null;
 const sanJusto=stations.find(s=>s.station.startsWith('San Justo'))||null;
 let enso=null;
 try{const a=content[2]?parseEnso(content[2],SOURCES.enso):null, b=content[3]?parseEnso(content[3],SOURCES.ensoDirect):null;
  enso=b?.summary&&!b.summary.startsWith('ConsultÃ¡')?b:(a||b);
 }catch(e){}
 let news=[];try{if(content[4])news.push(...parseFeed(content[4],now));if(content[5])news.push(...parseFeed(content[5],now));if(content[8])news.push(...parseSantoTomeNews(content[8]));const bulletin=content[2]?parseBulletin(content[2]):null;if(bulletin)news.unshift({...bulletin,summary:'BoletÃ­n semanal oficial con escenarios de El NiÃ±o, lluvias y situaciÃ³n hidrometeorolÃ³gica de Argentina. ConsultÃ¡ el documento oficial para mÃ¡s detalles.'});news=[...new Map(news.map(n=>[n.url,n])).values()].sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')).slice(0,8)}catch(e){}
 // Si los orÃ­genes de Salado fallan, no dejar vacÃ­o el cuadro: mostrar Ãºnicamente
 // la Ãºltima lectura oficial VERIFICADA previamente, marcÃ¡ndola como ARCHIVO.
 const recentRecreo=salado || archivedFallback('Recreo Â· Ruta 70');
 const recentSanto=santoTome || archivedFallback('Santo TomÃ©');
 const stationsFound=[parana,recentRecreo,recentSanto,emilia,sanJusto,tostado].filter(Boolean).map(raw=>{
  const s=thresholds(raw);
  const ref=s.observedAt||(s.reportedOn?`${s.reportedOn}T12:00:00-03:00`:null);
  const age=dateAgeHours(ref,now);
  return {...s,ageHours:age,stale:!!s.archivedReference||age===null||age>72};
 });
 const recoveredLiveSalado=[salado,santoTome].filter(Boolean).length;
 const latestSaladoDate=stationsFound.filter(s=>s.river==='Salado').map(s=>s.observedAt||s.reportedOn).filter(Boolean).sort().at(-1)||null;
 // Detallar no sÃ³lo la accesibilidad de la web sino si contiene datos legibles.
 const extraction={
  'INA mapa':stations.length,
  'INA API Recreo':apiSalado?1:0,
  'INA API Santo TomÃ© (Salado)':apiSanto?1:0,
  'INA CSV Recreo':csvRec?1:0,
  'INA CSV Santo TomÃ©':csvSanto?1:0,
  'INA serie Recreo':seriesRec?1:0,
  'INA serie Santo TomÃ©':seriesSanto?1:0
 };
 for(const check of sourceChecks){
  if(Object.hasOwn(extraction,check.name)){
    check.records=extraction[check.name];
    if(check.ok&&check.records===0)check.detail='Se recibiÃ³ la fuente, pero no se detectaron mediciones interpretables';
  }
 }
 const forecast=daily.outlook?{text:daily.outlook,source:SOURCES.inaDaily,issuedAt:daily.date}:null;
 const noteworthy=[];
 if(parana?.alertThreshold!=null&&parana.value>=parana.alertThreshold)noteworthy.push({type:'official',title:'El ParanÃ¡ alcanzÃ³ o superÃ³ el umbral de alerta de la estaciÃ³n Santa Fe',source:parana.source});
 else if(parana?.alertThreshold!=null&&parana.value>=parana.alertThreshold-0.5)noteworthy.push({type:'tracking',title:'El ParanÃ¡ se encuentra a menos de 50 cm del umbral de alerta de la estaciÃ³n',source:parana.source});
 if(news.length)noteworthy.push({type:'news',title:`${news.length} publicaciÃ³n(es) oficial(es) relacionada(s) identificada(s)`,source:SOURCES.municipal});
 const digest=JSON.stringify({stations:stationsFound.map(s=>[s.station,s.value,s.observedAt,s.reportedOn]),daily:daily.date,forecast:forecast?.text,enso:enso?.summary,news:news.map(x=>x.url)});
 const hasAny=!!(stationsFound.length||forecast||enso?.summary&&!enso.summary.startsWith('ConsultÃ¡')||news.length);
 return {
  version:1,checkedAt:now.toISOString(),reportId:createHash('sha256').update(digest).digest('hex').slice(0,12),
  status:hasAny?'partial_or_available':'unavailable',
  sourceChecks:sourceChecks.map(s=>({...s,detail:s.detail})),
  saladoStationsFound:recoveredLiveSalado,latestSaladoDate,archivedSaladoShown:stationsFound.some(s=>s.archivedReference),
  reportDate:daily.date,stations:stationsFound,forecast,enso,news,noteworthy,
  sources:[{name:'Instituto Nacional del Agua Â· reporte diario',url:SOURCES.inaDaily},{name:'INA Â· estaciones hidromÃ©tricas',url:SOURCES.inaMap},{name:'INA Â· umbrales tÃ©cnicos y niveles del Salado',url:SOURCES.inaMap},{name:'Gobierno de Santa Fe Â· referencias de alerta del Salado (04/09/2026)',url:SOURCES.provinceAlert},{name:'Municipalidad de Santo TomÃ© Â· noticias oficiales',url:SOURCES.municipalSantoTome},{name:'Boletines nacionales de El NiÃ±o (INA, SMN y otros organismos)',url:SOURCES.enso},{name:'SMN Â· El NiÃ±o/La NiÃ±a',url:SOURCES.ensoDirect},{name:'Municipalidad Â· GestiÃ³n de Riesgo',url:SOURCES.municipal}],
  fetched:{inaDaily:!!content[0],inaMap:!!(content[1]||content[6]||content[7]),inaSaladoAlternativos:!!(content[10]||content[11]||content[12]||content[13]),inaSanto:!!content[9],smnEnso:!!(content[2]||content[3]),municipality:!!(content[4]||content[5]||content[8])},
  notice:'Se actualiza el contenido al vencer la cachÃ© de ocho horas y recibir una visita. Los organismos publican en sus propios horarios. No sustituye avisos oficiales ni constituye una orden de evacuaciÃ³n.'
 };
}
module.exports={SOURCES,decode,clean,rows,num,parseMap,parseFichSalado,parseFichHistory,latestRecord,thresholds,parseDaily,parseEnso,parseFeed,parseSantoTomeNews,parseObservations,parseBulletin,collect};
