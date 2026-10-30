'use strict';
const {collect,parseFichSalado,thresholds,clean}=require('../lib/reports.cjs');
const {createHash}=require('node:crypto');
const ALTURAS='https://cim.fich.unl.edu.ar/rios/salado/alturas';
const AVISOS='https://cim.fich.unl.edu.ar/advertencias';
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
async function buildReport({base=collect,read=leer,now=new Date()}={}){
 const results=await Promise.allSettled([base(),read(ALTURAS),read(AVISOS)]);
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
