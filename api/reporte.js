'use strict';
const {collect,parseFichSalado,thresholds,clean}=require('../lib/reports.cjs');
const {createHash}=require('node:crypto');
const ALTURAS='https://cim.fich.unl.edu.ar/rios/salado/alturas';
const AVISOS='https://cim.fich.unl.edu.ar/advertencias';
const FICH_PARANA='https://cim.fich.unl.edu.ar/';
const PNA_RELAY='https://rioalert.com.ar/puertos/santa-fe';
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

async function leer(url){
 const r=await fetch(url,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const html=await r.text();
 if(!/<(?:html|table|tr|h[1-6])\b/i.test(html))throw Error('HTML invalido');
 return html.slice(0,1200000);
}
function fecha(s){
 const x=s?.observedAt||(s?.reportedOn?s.reportedOn+'T00:00:00-03:00':null);
 const t=x?Date.parse(x):NaN;
 return Number.isFinite(t)?t:-Infinity;
}
function mergeSalado(reporte,html,ahora){
 const datos=parseFichSalado(html).filter(x=>x.river==='Salado'&&
  ['Santo Tom\u00e9','Recreo \u00b7 Ruta 70'].includes(x.station)&&
  x.reportedOn&&fecha(x)<=ahora.getTime()+21600000);
 reporte.stations ||= [];
 let inserted=0;
 for(const dato of datos){
  const s=thresholds(dato);
  const horas=(ahora.getTime()-fecha(s))/3600000;
  const nuevo={...s,source:ALTURAS,archivedReference:false,
   ageHours:horas,stale:horas>72||horas< -6};
  const i=reporte.stations.findIndex(x=>x.river==='Salado'&&x.station===s.station);
  const previo=i<0?null:reporte.stations[i];
  if(!previo||previo.archivedReference||fecha(nuevo)>fecha(previo)){
   if(i<0)reporte.stations.push(nuevo);
   else reporte.stations[i]=nuevo;
   inserted++;
  }
 }
 reporte.saladoStationsFound=reporte.stations.filter(x=>x.river==='Salado'&&
  ['Santo Tom\u00e9','Recreo \u00b7 Ruta 70'].includes(x.station)&&!x.archivedReference).length;
 reporte.archivedSaladoShown=reporte.stations.some(x=>x.archivedReference);
 reporte.latestSaladoDate=reporte.stations.filter(x=>x.river==='Salado')
  .map(x=>x.observedAt||x.reportedOn).filter(Boolean).sort().at(-1)||null;
 reporte.fetched ||= {};
 reporte.fetched.fichSaladoActual=datos.length>0;
 reporte.sources ||= [];
 if(!reporte.sources.some(x=>x.url===ALTURAS))reporte.sources.unshift({name:'FICH-UNL - alturas oficiales del Salado',url:ALTURAS});
 if(datos.length)reporte.status='partial_or_available';
 reporte.reportId=createHash('sha256').update(JSON.stringify(reporte.stations.map(x=>[x.station,x.value,x.observedAt,x.reportedOn]))).digest('hex').slice(0,12);
 return {found:datos.length,inserted};
}
function addWarnings(reporte,html,ahora){
 const texto=clean(html);
 const f=texto.match(/(?:lunes|martes|mi[e\u00e9]rcoles|jueves|viernes|s[a\u00e1]bado|domingo)\s*,?\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})/i);
 const mes=f?MESES.indexOf(f[2].toLowerCase()):-1;
 if(mes<0)return false;
 const fechaTexto=f[3]+'-'+String(mes+1).padStart(2,'0')+'-'+f[1].padStart(2,'0');
 const edad=ahora.getTime()-Date.parse(fechaTexto+'T00:00:00-03:00');
 if(edad< -21600000||edad>72*3600000)return false;
 const m=texto.match(/R[i\u00ed]o Salado y sus afluentes en el territorio santafesino\s+(.+?)(?:\s+Direcci[o\u00f3]n\b|\s+Tel[e\u00e9]fono\b|$)/i);
 if(!m||m[1].length<30)return false;
 reporte.noteworthy ||= [];
 reporte.noteworthy.unshift({type:'official',source:AVISOS,
  title:'Parte hidrol\u00f3gico FICH-UNL ('+f[1].padStart(2,'0')+'/'+String(mes+1).padStart(2,'0')+'): '+m[1].slice(0,280)});
 reporte.sources ||= [];
 if(!reporte.sources.some(x=>x.url===AVISOS))reporte.sources.unshift({name:'FICH-UNL - advertencias hidrol\u00f3gicas',url:AVISOS});
 return true;
}
// FICH homepage provides a river height without a measurement date.
function parseFichParana(html){
 const t=clean(html);
 const m=t.match(/R[i\u00ed]o\s+Paran[a\u00e1]\s*[:|]?\s*(\d{1,2}[,.]\d{1,2})\s*m/i);
 const v=m?Number(m[1].replace(',','.')):NaN;
 return Number.isFinite(v)&&v>=0&&v<=12?v:null;
}
// A third-party relay reports a dated PNA observation: NOT an INA bulletin.
// Restrict parsing to the 'last measurement' section, never predictions.
function parseDatedPnaRelay(html){
 const t=clean(html).split(/Estimaciones\s+propias/i)[0];
 const m=t.match(/Altura\s*:\s*(\d{1,2}[,.]\d{1,2})\s*m\s*,?\s*medida\s+el\s+(\d{1,2})\s+(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\s+(20\d{2})\s*[\u00b7,.\s]*?(\d{1,2})\s*:\s*(\d{2})/i);
 if(!m)return null;
 const month={'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,'jul':7,'ago':8,'sep':9,'oct':10,'nov':11,'dic':12}[m[3].slice(0,3).toLowerCase()];
 const value=Number(m[1].replace(',','.'));
 if(!month||!Number.isFinite(value)||value<0||value>12)return null;
 const date=m[4]+'-'+String(month).padStart(2,'0')+'-'+m[2].padStart(2,'0');
 const stamp=date+'T'+m[5].padStart(2,'0')+':'+m[6]+':00-03:00';
 const parsed=Date.parse(stamp);
 if(!Number.isFinite(parsed)||new Date(parsed-10800000).toISOString().slice(0,10)!==date)return null;
 return {river:'Paran\u00e1',station:'Santa Fe (Puerto)',value,observedAt:new Date(parsed).toISOString(),
  source:PNA_RELAY,measurementOrigin:'Prefectura Naval Argentina (retransmitido por R\u00edoAlert, sin validaci\u00f3n INA)',
  verificationSource:FICH_PARANA,alertThreshold:5.3,evacuationThreshold:5.7,alertType:'oficial'};
}
function mergeParana(reporte,homeHtml,relayHtml,now){
 const fich=parseFichParana(homeHtml),relay=parseDatedPnaRelay(relayHtml);
 if(fich===null||!relay)return {found:0,inserted:0,reason:'Falta dato de FICH o medicion PNA fechada'};
 if(Math.abs(fich-relay.value)>0.011)return {found:0,inserted:0,reason:'Discrepancia entre FICH y la medicion retransmitida'};
 const hours=(now.getTime()-fecha(relay))/3600000;
 if(hours < -1||hours > 72)return {found:0,inserted:0,reason:'La medicion retransmitida no es reciente'};
 reporte.stations ||= [];
 const i=reporte.stations.findIndex(s=>s.river==='Paran\u00e1'&&s.station==='Santa Fe (Puerto)');
 const old=i===-1?null:reporte.stations[i];
 if(old&&fecha(old)>=fecha(relay))return {found:1,inserted:0,reason:'INA ya ofrece una medicion igual o mas nueva'};
 const delta=old&&Number.isFinite(old.value)?relay.value-old.value:null;
 const updated={...relay,previous:old?.value??null,
  trend:delta===null?null:delta>0.005?'crece':delta < -0.005?'baja':'estable',
  ageHours:hours,stale:false,archivedReference:false};
 if(i<0)reporte.stations.unshift(updated);else reporte.stations[i]=updated;
 reporte.noteworthy ||= [];
 reporte.noteworthy.unshift({type:'tracking',source:PNA_RELAY,
  title:'Paran\u00e1 en Santa Fe: '+relay.value.toFixed(2).replace('.',',')+' m, medici\u00f3n del '+relay.observedAt.slice(0,10)+' (Prefectura retransmitida por R\u00edoAlert; altura contrastada con FICH-UNL). El parte diario INA puede tener otra fecha.'});
 reporte.sources ||= [];
 if(!reporte.sources.some(s=>s.url===PNA_RELAY))reporte.sources.unshift({name:'R\u00edoAlert: lectura PNA retransmitida (sin validar)',url:PNA_RELAY});
 if(!reporte.sources.some(s=>s.url===FICH_PARANA))reporte.sources.unshift({name:'FICH-UNL: altura del Paran\u00e1 (sin fecha en portada)',url:FICH_PARANA});
 reporte.fetched ||= {};reporte.fetched.paranaContrastado=true;
 reporte.reportId=createHash('sha256').update(JSON.stringify(reporte.stations.map(x=>[x.station,x.value,x.observedAt,x.reportedOn]))).digest('hex').slice(0,12);
 return {found:1,inserted:1,reason:'Medicion de PNA fechada y valor coincidente FICH'};
}
async function buildReport({base=collect,read=leer,now=new Date()}={}){
 const results=await Promise.allSettled([base(),read(ALTURAS),read(AVISOS),read(FICH_PARANA),read(PNA_RELAY)]);
 const r=results[0].status==='fulfilled'?results[0].value:{version:1,status:'unavailable',stations:[],news:[],sources:[],noteworthy:[],fetched:{}};
 r.checkedAt=now.toISOString();r.version=1;r.sourceChecks ||= [];
 const diagnostico=(name,k,fn)=>{
  const x=results[k],d={name,ok:false,detail:'',records:0};
  if(x.status==='fulfilled'){
   try{const resultado=fn(x.value);d.records=typeof resultado==='object'?resultado.found:resultado?1:0;
    d.ok=d.records>0;d.detail=d.ok?'Dato oficial interpretado':'No se pudieron interpretar registros';}
   catch(e){d.detail='Error: '+String(e.message||e).slice(0,100);}
  }else d.detail=String(x.reason?.message||'Consulta fallida').slice(0,100);
  r.sourceChecks.push(d);
 };
 diagnostico('FICH-UNL Salado oficial',1,html=>mergeSalado(r,html,now));
 diagnostico('FICH-UNL parte hidrologico',2,html=>addWarnings(r,html,now));
 const fh=results[3].status==='fulfilled'?parseFichParana(results[3].value):null;
 const rd=results[4].status==='fulfilled'?parseDatedPnaRelay(results[4].value):null;
 r.sourceChecks.push({name:'FICH portada Parana',ok:fh!==null,records:fh!==null?1:0,
  detail:results[3].status==='fulfilled'?(fh===null?'Sin altura interpretable':'Altura sin fecha: '+fh+' m'):String(results[3].reason?.message||'Sin conexion').slice(0,100)});
 r.sourceChecks.push({name:'PNA retransmitido (RioAlert)',ok:!!rd,records:rd?1:0,
  detail:results[4].status==='fulfilled'?(rd?'Medicion fechada encontrada':'No se detecto medicion fechada'):String(results[4].reason?.message||'Sin conexion').slice(0,100)});
 const result=(fh!==null&&rd)?mergeParana(r,results[3].value,results[4].value,now):{found:0,inserted:0,reason:'Faltan ambas fuentes legibles'};
 r.sourceChecks.push({name:'Parana contraste FICH / PNA',ok:result.found===1,records:result.inserted,
  detail:result.reason});
 
 const parana = (r.stations || []).find(
  s => s.river === 'Paran\u00e1' &&
       s.station === 'Santa Fe (Puerto)'
 );

 if (parana && parana.source &&
     parana.source.includes('/getObservaciones')) {
  parana.source =
   'https://alerta.ina.gob.ar/a5/secciones?seriesId=30';
 }

 return r;
}
module.exports=async function handler(req,res){

 if(req.method!=='GET')return res.status(405).json({message:'Metodo no permitido'});
 try{
  const r=await buildReport();
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=900, stale-while-revalidate=60');
  return res.status(200).json(r);
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(503).json({version:1,status:'unavailable'});}
};
module.exports.buildReport=buildReport;
module.exports.mergeSalado=mergeSalado;
module.exports.addWarnings=addWarnings;
module.exports.parseFichParana=parseFichParana;
module.exports.parseDatedPnaRelay=parseDatedPnaRelay;
module.exports.mergeParana=mergeParana;
