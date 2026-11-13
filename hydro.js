'use strict';
const hydroKeys=[['Paraná','Santa Fe (Puerto)','Puerto de Santa Fe'],['Salado','Santo Tomé','Santo Tomé'],['Salado','Recreo · Ruta 70','Recreo (Ruta 70)']];
function hydroState(s){
 if(!s)return ['missing','Sin medición disponible'];
 if(s.stale||s.archivedReference)return ['old','Dato antiguo · verificar'];
 if(s.retained)return ['old','Última lectura conservada'];
 if(s.evacuationThreshold>0&&s.value>=s.evacuationThreshold)return ['danger','Umbral de evacuación'];
 if(s.alertThreshold>0&&s.value>=s.alertThreshold)return ['alert',s.alertType==='técnica'?'Alerta técnica':'En alerta'];
 return s.alertThreshold>0?['normal','Bajo umbral de alerta']:['missing','Sin umbral verificado'];
}
function hydroSource(s){
 if(s.sourceName)return s.sourceName;
 try{const h=new URL(s.source).hostname;return h.includes('ina.')?'Instituto Nacional del Agua':h.includes('fich.unl')?'FICH-UNL · red provincial':h.includes('prefectura')?'Prefectura Naval Argentina':h}catch{return 'Fuente no disponible'}
}
function hydroTime(s){return s.observedAt?'Observación: '+localDate(s.observedAt)+' h (Argentina)':s.reportedOn?'Parte: '+s.reportedOn.split('-').reverse().join('/')+' · hora de observación no informada':'Hora de observación no disponible'}
function hydroTrend(s){
 const names={crece:'↗ Creciendo',baja:'↘ Bajando',estable:'→ Estable',permanece:'→ Estable'};
 return names[s.trend]||'Tendencia no disponible';
}
function hydroVariation(s){
 const cm=typeof s.variationCm==='number'?s.variationCm:typeof s.previous==='number'&&Number.isFinite(s.previous)?Math.round((s.value-s.previous)*100):null;
 if(cm===null)return 'Variación no disponible';
 let interval='respecto de la lectura anterior';
 if(s.previousObservedAt&&s.observedAt){const hours=(Date.parse(s.observedAt)-Date.parse(s.previousObservedAt))/3600000;if(hours>0)interval='en '+Number(hours.toFixed(1)).toLocaleString('es-AR')+' h';}
 return (cm>0?'+':'')+cm+' cm '+interval;
}
function hydroReading(s,river,location,compact=false){
 const [state,label]=hydroState(s),article=el('article','hydro-reading '+state+(compact?' compact':''));
 const name=el('div','hydro-name');name.append(el('strong',null,'Río '+river),el('span',null,location));
 const value=el('div','hydro-value',s?fmt(s.value)+' m':'—');
 const trend=el('div','hydro-trend');trend.append(el('strong',null,s?hydroTrend(s):'Sin información'),el('small',null,s?hydroVariation(s):'No se inventan lecturas'));
 article.append(name,value,trend,el('span','hydro-badge',label));
 if(s){
  const meta=el('div','hydro-meta');meta.append(el('span',null,hydroTime(s)));addLink(meta,hydroSource(s)+' ↗',s.source,'reading-source');
  if(s.ageHours!=null)meta.append(el('span',null,'Antigüedad: '+Math.floor(s.ageHours)+' h'+(s.archivedReference?' · referencia histórica':'')));
  article.append(meta);
  if(!compact){
   const limits=el('p','hydro-limits',s.alertThreshold>0?(s.alertType==='técnica'?'Alerta técnica: ':'Alerta: ')+fmt(s.alertThreshold)+' m'+(s.evacuationThreshold>0?' · Evacuación: '+fmt(s.evacuationThreshold)+' m':' · Evacuación: sin cota oficial publicada'):'Sin umbrales oficiales verificados para esta escala.');article.append(limits);
   if(s.provincialAlertThreshold>0)article.append(el('p','small-meta','Referencia provincial comunicada el 04/09/2026: '+fmt(s.provincialAlertThreshold)+' m; no sustituye el umbral técnico de la escala.'));
   for(const other of (s.alternatives||[]).filter(x=>x.source!==s.source||x.value!==s.value||x.observedAt!==s.observedAt||x.reportedOn!==s.reportedOn).slice(0,6)){
    const ref=el('div','hydro-alternative',(other.archivedReference?'Referencia histórica · ':'')+hydroSource(other)+': '+fmt(other.value)+' m · '+hydroTime(other));addLink(ref,'Ver registro ↗',other.source);article.append(ref);
   }
   if(s.review?.length)article.append(el('p','hydro-review','Diferencia entre fuentes para horarios próximos (≥20 cm): revisar los registros antes de interpretar el nivel. Se conservan los valores de ambas fuentes.'));
  }
 }
 return article;
}
function hydroHistory(stations){
 const root=$('#panel-history');root.replaceChildren();
 for(const [river,key,location] of hydroKeys){
  const s=stations.find(x=>x.river===river&&x.station===key),box=el('section','history-card');box.append(el('h3',null,'Río '+river+' – '+location));
  const history=(s?.history||[]).filter(p=>typeof p.value==='number'&&Number.isFinite(p.value)&&Number.isFinite(Date.parse(p.observedAt))).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  if(history.length<2)box.append(el('p','section-note','La fuente no devolvió suficientes observaciones fechadas para dibujar una evolución. No se interpolan valores.'));
  else{
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Evolución observada del río '+river+' en '+location+'; valores en la tabla siguiente');
   const lo=Math.min(...history.map(p=>p.value))-.05,hi=Math.max(...history.map(p=>p.value))+.05,t0=Date.parse(history[0].observedAt),t1=Date.parse(history.at(-1).observedAt);
   const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',history.map(p=>(15+570*(Date.parse(p.observedAt)-t0)/(t1-t0||1))+','+(165-150*(p.value-lo)/(hi-lo))).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#007caa');line.setAttribute('stroke-width','3');svg.append(line);box.append(svg);
   box.append(el('p','small-meta','Alturas entre '+fmt(lo+.05)+' y '+fmt(hi-.05)+' m · '+hydroSource(s)+'. Cada gráfico corresponde a una sola estación y fuente.'));
   const details=el('details'),summary=el('summary',null,'Ver fechas y alturas ('+history.length+' observaciones)'),table=el('table','hydro-table');
   const head=el('tr');head.append(el('th',null,'Observación (Argentina)'),el('th',null,'Altura'));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
   for(const p of history){const row=el('tr');row.append(el('td',null,localDate(p.observedAt)),el('td',null,fmt(p.value)+' m'));body.append(row)}table.append(body);details.append(summary,table);box.append(details);
  }
  root.append(box);
 }
}
function renderHydrometry(data){
 const stations=data.stations||[],summary=$('#riverSummary'),current=$('#hydroCurrent');summary.replaceChildren();current.replaceChildren();
 for(const [river,key,location] of hydroKeys){const s=stations.find(x=>x.river===river&&x.station===key);summary.append(hydroReading(s,river,location,true));current.append(hydroReading(s,river,location));}
 hydroHistory(stations);
 const forecast=$('#panel-forecast');forecast.replaceChildren();forecast.append(el('h3',null,'Pronóstico del INA · Paraná en Santa Fe'));
 if(data.forecast){
  forecast.append(el('p',null,data.forecast.text),el('p','small-meta','Fecha del parte diario INA: '+(data.forecast.issuedAt||'no informada')+'. La emisión de la proyección se consulta en el gráfico oficial; la hora de esta consulta no es su fecha de emisión.'));
  const img=el('img','ina-forecast');img.src='https://alerta.ina.gob.ar/ina/08-PRONOSTICOS/graficos/santa_fe.png';img.alt='Gráfico oficial del INA: niveles observados y previstos en Santa Fe, fechas y bandas de incertidumbre';img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;forecast.append(el('p','section-note','El gráfico oficial no está disponible. Abrí el reporte del INA para consultar las proyecciones.'))});forecast.append(img);
 }else forecast.append(el('p','section-note','No se pudo recuperar un pronóstico del INA en esta consulta. Consultá la última emisión en su sitio oficial.'));
 addLink(forecast,'Abrir último reporte y proyecciones del INA ↗','https://alerta.ina.gob.ar/a5/diario/reporte_diario');
 forecast.append(el('p','section-note','Las líneas observadas y pronosticadas del gráfico son distintas. Los valores previstos nunca se usan como altura actual. No se calcula una diferencia numérica sin una proyección fechada y verificable.'));
 const sources=$('#panel-sources');sources.replaceChildren();sources.append(el('p',null,'Consulta de la aplicación: '+localDate(data.checkedAt)+'. Cada tarjeta conserva la fecha de observación o del parte. Una nueva consulta puede devolver la misma medición.'));
 sources.append(el('p','section-note','Se prioriza la observación válida más reciente de la misma estación. Un parte sin hora no se presenta como una observación con hora confirmada. Datos mayores de 72 h se señalan como antiguos. Las diferencias de 20 cm o más entre fuentes separadas por hasta una hora se marcan para revisión; ese criterio no es un umbral hidrométrico oficial.'));
 for(const check of data.sourceChecks||[])sources.append(el('p','source-check',(check.ok?'✓ ':'⚠ ')+check.name+' · '+check.detail));
 for(const source of data.sources||[])addLink(sources,source.name+' ↗',source.url);
}
document.querySelectorAll('.hydro-tabs [role="tab"]').forEach((button,index,tabs)=>{
 const activate=()=>{for(const tab of tabs){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!selected}};
 button.addEventListener('click',activate);
 button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();tabs[next].click();tabs[next].focus()}});
});
