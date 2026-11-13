'use strict';
const {rows,thresholds}=require('./reports.cjs');
const PNA='https://contenidosweb.prefecturanaval.gob.ar/alturas/';
const identities=new Set(['Paraná|Santa Fe (Puerto)','Salado|Santo Tomé','Salado|Recreo · Ruta 70']);
function stamp(s){return s?.observedAt?Date.parse(s.observedAt):s?.reportedOn?Date.parse(s.reportedOn+'T00:00:00-03:00'):NaN}
function valid(s,now=new Date()){
 return !!s&&identities.has(s.river+'|'+s.station)&&typeof s.value==='number'&&Number.isFinite(s.value)&&s.value>=-3&&s.value<=20&&Number.isFinite(stamp(s))&&stamp(s)<=now.getTime()+300000&&s.kind!=='forecast';
}
function pnaDate(text){
 const m=String(text).match(/^(\d{2})\/([A-Z]{3})\/(\d{2})\s*-\s*(\d{2})(\d{2})$/);
 if(!m)return null;
 const month=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'].indexOf(m[2])+1;
 if(!month||+m[4]>23||+m[5]>59)return null;
 const day='20'+m[3]+'-'+String(month).padStart(2,'0')+'-'+m[1];
 const time=Date.parse(day+'T'+m[4]+':'+m[5]+':00-03:00');
 return Number.isFinite(time)&&new Date(time-10800000).toISOString().slice(0,10)===day?new Date(time).toISOString():null;
}
function parsePna(html,now=new Date()){
 const row=rows(html).find(c=>c[0]==='SANTA FE'&&c[1]==='PARANA');
 if(!row)return null;
 const number=v=>/^-?\d+(?:[.,]\d+)?$/.test(v)?Number(v.replace(',','.')):null;
 const value=number(row[2]),observedAt=pnaDate(row[5]);
 const previous=number(row[8]),previousObservedAt=pnaDate(row[9]);
 const previousValid=previous!==null&&previous>=-3&&previous<=20&&previousObservedAt&&Date.parse(previousObservedAt)<Date.parse(observedAt);
 const s={river:'Paraná',station:'Santa Fe (Puerto)',value,observedAt,source:PNA,sourceName:'Prefectura Naval Argentina',kind:'observed',
  previous:previousValid?previous:null,previousObservedAt:previousValid?previousObservedAt:null,
  trend:previousValid?(value>previous?'crece':value<previous?'baja':'estable'):null,
  history:[...(previousValid?[{value:previous,observedAt:previousObservedAt}]:[]),{value,observedAt}],
  alertThreshold:number(row[10]),evacuationThreshold:number(row[11]),thresholdSource:PNA};
 return valid(s,now)?thresholds(s):null;
}
function select(records,now=new Date()){
 const candidates=records.filter(s=>valid(s,now)).sort((a,b)=>{
  const dateA=(a.observedAt||a.reportedOn).slice(0,10),dateB=(b.observedAt||b.reportedOn).slice(0,10);
  // Un parte con fecha de publicación no prueba una observación posterior en ese mismo día.
  if(dateA===dateB&&!!a.observedAt!==!!b.observedAt)return a.observedAt?-1:1;
  return stamp(b)-stamp(a)||Number(!!a.archivedReference)-Number(!!b.archivedReference);
 });
 if(!candidates.length)return null;
 const chosen={...candidates[0]};
 chosen.alternatives=candidates.slice(1).map(({alternatives,history,...s})=>s);
 chosen.ageHours=Math.max(0,(now-stamp(chosen))/3600000);
 chosen.stale=!!chosen.archivedReference||chosen.ageHours>72;
 chosen.review=candidates.slice(1).filter(s=>Math.abs(stamp(s)-stamp(chosen))<=3600000&&Math.abs(s.value-chosen.value)>=0.2)
  .map(s=>({source:s.source,value:s.value,observedAt:s.observedAt,reportedOn:s.reportedOn,differenceCm:Math.round((chosen.value-s.value)*100)}));
 chosen.variationCm=typeof chosen.previous==='number'&&Number.isFinite(chosen.previous)?Math.round((chosen.value-chosen.previous)*100):null;
 return chosen;
}
module.exports={PNA,stamp,valid,pnaDate,parsePna,select};
