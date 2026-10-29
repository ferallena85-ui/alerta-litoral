'use strict';
const $=s=>document.querySelector(s);
const localDate=(date,settings={})=>{if(!date)return 'Fecha no disponible';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(date)?date+'T12:00:00Z':date);return Number.isNaN(d.getTime())?'Fecha no disponible':new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',...settings}).format(d)};
const fmt=n=>Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const el=(tag,cl,text)=>{let item=document.createElement(tag);if(cl)item.className=cl;if(text!==undefined)item.textContent=text;return item};
const safeLink=(u)=>{try{const x=new URL(u);return x.protocol==='https:'&&(/(^|\.)argentina\.gob\.ar$|(^|\.)ina\.gob\.ar$|(^|\.)smn\.gob\.ar$|(^|\.)santafeciudad\.gov\.ar$|(^|\.)santafenoticias\.gob\.ar$|^fich\.unl\.edu\.ar$|(^|\.)santotome\.gob\.ar$|(^|\.)argentina\.gob\.ar$|(^|\.)santafe\.gob\.ar$|(^|\.)santafenoticias\.gob\.ar$/).test(x.hostname)?x.href:null}catch{return null}};
function addLink(container,label,url,className='source-link'){const href=safeLink(url);if(!href)return;const a=el('a',className,label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';container.append(a)}
function openCard(button){const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));const panel=document.getElementById(button.getAttribute('aria-controls'));if(panel)panel.hidden=open}
document.querySelectorAll('.card-toggle').forEach(button=>button.addEventListener('click',()=>openCard(button)));
document.querySelectorAll('[data-scroll]').forEach(button=>button.addEventListener('click',()=>{const target=document.getElementById(button.dataset.scroll);target?.scrollIntoView({behavior:'smooth',block:'start'});const b=target?.querySelector('.card-toggle');if(b?.getAttribute('aria-expanded')==='false')openCard(b)}));
$('#installBtn').addEventListener('click',()=>{const box=$('#installInfo');box.hidden=!box.hidden;box.scrollIntoView({behavior:'smooth',block:'nearest'})});
$('#shareBtn').addEventListener('click',async()=>{const data={title:'Alerta Litoral',text:'Informes del Niño · Paraná y Salado en Santa Fe',url:location.origin};if(navigator.share){try{await navigator.share(data)}catch{}}else{try{await navigator.clipboard.writeText(data.url);$('#shareBtn').title='Enlace copiado'}catch{window.prompt('Copiá el enlace:',data.url)}}});
const reportDate=report=>{const x=report.reportDate;if(!x)return null;const d=new Date(x+'T12:00:00-03:00');return localDate(d,{hour:undefined,minute:undefined})};
function makeRiverGroup(wrap,title,subtitle,stations,emptyText,links){
 const section=el('section','river-group');section.append(el('h3','river-group-title',title));
 section.append(el('p','river-group-subtitle',subtitle));
 if(!stations.length)section.append(el('p','section-note',emptyText));
 for(const s of stations){
  const item=el('article','river-item'),left=el('div'),right=el('div','reading');
  left.append(el('strong',null,s.station));
  left.append(el('small',null,s.observedAt?`Medición: ${localDate(s.observedAt)}`:s.reportedOn?`Parte publicado: ${localDate(s.reportedOn,{hour:undefined,minute:undefined})}`:'Fecha no confirmada'));
  if(s.archivedReference)left.append(el('small','stale-tag','REFERENCIA HISTÓRICA VERIFICADA · no es una lectura nueva; no se pudo actualizar esta estación'));else if(s.stale)left.append(el('small','stale-tag','Dato anterior a 72 horas · verificar fuente'));
  if(s.alertThreshold!=null)left.append(el('small',null,`Alerta${s.alertType==='técnica'?' técnica':''} en esta estación: ${fmt(s.alertThreshold)} m`));
  if(s.evacuationThreshold!=null&&s.evacuationThreshold>0)left.append(el('small',null,`Umbral de evacuación de estación: ${fmt(s.evacuationThreshold)} m`));
  if(s.source)addLink(left,'Fuente de esta lectura ↗',s.source,'reading-source');
  right.append(el('b',null,`${fmt(s.value)} m`));if(s.trend)right.append(el('span',null,`Tendencia: ${s.trend}`));
  item.append(left,right);section.append(item);
 }
 const linkBox=el('div','river-links');for(const [label,url] of links)addLink(linkBox,label,url,'source-link');section.append(linkBox);wrap.append(section);
}
function renderRivers(stations){
 const wrap=$('#rivers');wrap.replaceChildren();
 const priority={'Recreo · Ruta 70':0,'Santo Tomé':1,'Emilia · Ruta 62':2,'San Justo · Ruta 2':3,'Tostado':4};
 const parana=(stations||[]).filter(s=>s.river==='Paraná');
 const salado=(stations||[]).filter(s=>s.river==='Salado').sort((a,b)=>(priority[a.station]??10)-(priority[b.station]??10));
 makeRiverGroup(wrap,'Río Paraná','Puerto de Santa Fe · niveles y perspectiva oficial',parana,'Sin lectura verificable del Paraná en esta consulta.',[['INA · Paraná','https://alerta.ina.gob.ar/a5/diario/reporte_diario']]);
 makeRiverGroup(wrap,'Río Salado','Estaciones Recreo y Santo Tomé · seguimiento de la cuenca',salado,'No se pudo recuperar una lectura verificable del Salado en esta consulta. Podés abrir las mediciones oficiales directamente.',[['FICH · toda la cuenca','https://fich.unl.edu.ar/cim/rios/salado/alturas'],['Santo Tomé · historial','https://fich.unl.edu.ar/cim/rios/historico/6'],['Recreo · historial','https://fich.unl.edu.ar/cim/rios/historico/5']]);
 wrap.append(el('p','river-note','Las escalas de Santo Tomé, Recreo y Santa Fe son distintas. El umbral técnico de una estación no determina por sí solo inundación o evacuación de barrios.'));
}
function renderEnso(enso){if(!enso){$('#ensoStatus').textContent='No se pudo verificar el estado actual';$('#ensoText').textContent='Consultá el informe del SMN. No atribuimos una fase del fenómeno sin respaldo oficial reciente.';$('#ensoDate').textContent='';return}$('#ensoStatus').textContent=enso.status||'Consultar informe oficial';$('#ensoText').textContent=enso.summary||'El informe no tiene un resumen disponible en formato accesible.';$('#ensoDate').textContent=enso.publishedAt?`Fecha de referencia: ${enso.publishedAt.slice(0,10)} · fuente: ${new URL(enso.source).hostname}`:'La fuente no informa claramente fecha de publicación.';let a=$('#ensoSource');if(safeLink(enso.source))a.href=enso.source;}
function renderNews(news){const box=$('#news');box.replaceChildren();if(!news?.length){box.append(el('p','section-note','No se detectaron nuevas publicaciones hídricas en el canal oficial consultado en los últimos 30 días, o no estuvo disponible. Esto no descarta novedades en otras fuentes.'));return}news.forEach(n=>{const row=el('article','news-item');addLink(row,n.title+' ↗',n.url,'news-link');if(n.summary)row.append(el('p',null,n.summary));if(n.publishedAt)row.append(el('time',null,localDate(n.publishedAt)));else if(n.sourceName?.includes('Santo Tomé'))row.append(el('time',null,'Fecha: consultar publicación municipal'));box.append(row)})}
function renderReport(r){
 const good=(r.stations||[]).filter(s=>!s.stale);
 const parana=good.filter(s=>s.river==='Paraná');const salado=good.filter(s=>s.river==='Salado');
 const archived=(r.stations||[]).filter(s=>s.river==='Salado'&&s.archivedReference);
 const fmtGroup=(arr,kind)=>arr.length?`${kind}: ${arr.map(s=>`${s.station} ${fmt(s.value)} m${s.trend?' ('+s.trend+')':''}`).join(', ')}.`:kind==='Salado'&&archived.length?`${kind}: sin mediciones nuevas recuperadas; última referencia histórica: ${archived.map(s=>`${s.station} ${fmt(s.value)} m (28/10/2026)`).join(', ')}. No equivale a un registro actual.`:`${kind}: sin medición reciente verificable; consultar la fuente.`;
 $('#reportSummary').textContent=[fmtGroup(parana,'Paraná'),fmtGroup(salado,'Salado')].join(' ')+' Cada estación conserva su propia fecha de medición.';
 const hints=$('#highlights');hints.replaceChildren();for(const n of r.noteworthy||[])hints.append(el('div','notice',n.title));
 const forecast=$('#forecastWrap');if(r.forecast?.text){forecast.hidden=false;$('#forecastText').textContent=r.forecast.text;const link=$('#forecastLink');if(safeLink(r.forecast.source))link.href=r.forecast.source}else forecast.hidden=true;
 const sources=$('#sources');sources.replaceChildren();for(const source of r.sources||[]){const li=el('li');addLink(li,source.name+' ↗',source.url,'ordinary-link');sources.append(li)}
}
function render(data){const checked=$('#checkedAt'),badge=$('#statusBadge');checked.textContent=localDate(data.checkedAt);const success=data.status!=='unavailable';const bad=[data.fetched?.inaDaily,data.fetched?.inaMap,data.fetched?.smnEnso,data.fetched?.municipality].filter(Boolean).length;badge.className='status-pill '+(!success?'unavailable':bad<4?'warning':'available');badge.textContent=!success?'Sin datos nuevos':data.archivedSaladoShown?'Parcial · Salado histórico':bad<4?'Parcial':'Consultado';renderRivers(data.stations||[]);renderEnso(data.enso);renderNews(data.news);renderReport(data);}
let requesting=false;
async function loadReport(){if(requesting)return;requesting=true;$('#refreshBtn').disabled=true;$('#statusBadge').textContent='Consultando…';try{const res=await fetch('/api/reporte?version=salado-santotome-v2',{headers:{Accept:'application/json'}});if(!res.ok)throw Error('Falla en fuente');const result=await res.json();if(result?.version!==1)throw Error('Respuesta inesperada');render(result);$('#reloadError').classList.add('hidden')}catch(e){$('#reloadError').classList.remove('hidden');$('#checkedAt').textContent='No disponible';$('#statusBadge').className='status-pill unavailable';$('#statusBadge').textContent='Sin conexión';$('#reportSummary').textContent='No fue posible obtener el reporte. El sitio no mostrará cifras simuladas. Consultá las fuentes oficiales.';renderRivers([]);renderEnso(null);renderNews([])}finally{$('#refreshBtn').disabled=false;requesting=false}}
$('#refreshBtn').addEventListener('click',loadReport);$('#retryBtn').addEventListener('click',loadReport);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck>1800000){lastCheck=Date.now();loadReport()}});let lastCheck=Date.now();loadReport();if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
