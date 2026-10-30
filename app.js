
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
// Instalaci\u00f3n PWA Android: el navegador requiere confirmaci\u00f3n expresa del usuario.
const installButton = $('#installBtn');
const installDetails = $('#installInfo');
const installTab = document.querySelector('.bottom-nav a[href="#instalar"]');
const installUA = navigator.userAgent || '';
const androidDevice = /Android/i.test(installUA);
const iosDevice = /iPhone|iPad|iPod/i.test(installUA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const alreadyInstalled = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  navigator.standalone === true;
let pendingInstallPrompt = null;

function displayInstallHelp(message) {
  installDetails.hidden = false;
  let info = document.getElementById('installHint');
  if (!info) {
    info = document.createElement('p');
    info.id = 'installHint';
    installDetails.prepend(info);
  }
  info.textContent = message;
  document.getElementById('instalar').scrollIntoView({behavior:'smooth',block:'center'});
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingInstallPrompt = event;
  if (androidDevice && !alreadyInstalled()) installButton.textContent = 'Instalar aplicaci\u00f3n';
});
window.addEventListener('appinstalled', () => {
  pendingInstallPrompt = null;
  installButton.textContent = 'Aplicaci\u00f3n instalada';
  // No hay notificaciones: solo se confirma que la PWA se instal\u00f3.
  displayInstallHelp('Alerta Litoral ya est\u00e1 instalada en tu dispositivo. Busc\u00e1 el \u00edcono entre tus aplicaciones.');
});

async function requestAppInstall() {
  if (alreadyInstalled()) {
    displayInstallHelp('Ya est\u00e1s usando Alerta Litoral como aplicaci\u00f3n instalada.');
    return;
  }
  if (androidDevice && pendingInstallPrompt) {
    const event = pendingInstallPrompt;
    pendingInstallPrompt = null;
    try {
      // El prompt se llama directamente a partir del clic del usuario.
      await event.prompt();
      const choice = await event.userChoice;
      if (choice?.outcome === 'dismissed') {
        displayInstallHelp('Si cambi\u00e1s de opini\u00f3n, pod\u00e9s usar el men\u00fa \u22ee de Chrome y tocar \u00abInstalar aplicaci\u00f3n\u00bb.');
      }
    } catch (err) {
      displayInstallHelp('Abr\u00ed Alerta Litoral en Google Chrome, toc\u00e1 el men\u00fa \u22ee y eleg\u00ed \u00abInstalar aplicaci\u00f3n\u00bb o \u00abAgregar a pantalla principal\u00bb.');
    }
    return;
  }
  if (androidDevice) {
    displayInstallHelp('Abr\u00ed este enlace directamente en Google Chrome (no dentro de WhatsApp). Toc\u00e1 el men\u00fa \u22ee y eleg\u00ed \u00abInstalar aplicaci\u00f3n\u00bb o \u00abAgregar a pantalla principal\u00bb. Si el navegador todav\u00eda no ofrece instalaci\u00f3n directa, pod\u00e9s crear el acceso desde ese men\u00fa.');
  } else if (iosDevice) {
    displayInstallHelp('En iPhone, abr\u00ed el enlace en Safari, toc\u00e1 Compartir y eleg\u00ed \u00abAgregar a pantalla de inicio\u00bb.');
  } else {
    displayInstallHelp('Abr\u00ed el men\u00fa de tu navegador y busc\u00e1 \u00abInstalar aplicaci\u00f3n\u00bb o \u00abCrear acceso directo\u00bb.');
  }
}
installButton.addEventListener('click', requestAppInstall);
if (installTab) installTab.addEventListener('click', event => {
  event.preventDefault();
  requestAppInstall();
});
installButton.textContent = alreadyInstalled() ? 'Aplicaci\u00f3n instalada' : androidDevice ? 'Instalar aplicaci\u00f3n' : 'C\u00f3mo instalar';

$('#shareBtn').addEventListener('click',async()=>{const data={title:'Alerta Litoral',text:'Informes del Ni\u00f1o \u00b7 Paran\u00e1 y Salado en Santa Fe',url:location.origin};if(navigator.share){try{await navigator.share(data)}catch{}}else{try{await navigator.clipboard.writeText(data.url);$('#shareBtn').title='Enlace copiado'}catch{window.prompt('Copi\u00e1 el enlace:',data.url)}}});
const reportDate=report=>{const x=report.reportDate;if(!x)return null;const d=new Date(x+'T12:00:00-03:00');return localDate(d,{hour:undefined,minute:undefined})};
function makeRiverGroup(wrap,title,subtitle,stations,emptyText,links){
 const section=el('section','river-group');section.append(el('h3','river-group-title',title));
 section.append(el('p','river-group-subtitle',subtitle));
 if(!stations.length)section.append(el('p','section-note',emptyText));
 for(const s of stations){
  const item=el('article','river-item'),left=el('div'),right=el('div','reading');
  left.append(el('strong',null,s.station));
  left.append(el('small',null,s.observedAt?`Medici\u00f3n: ${localDate(s.observedAt)}`:s.reportedOn?`Parte publicado: ${localDate(s.reportedOn,{hour:undefined,minute:undefined})}`:'Fecha no confirmada'));
  if(s.archivedReference)left.append(el('small','stale-tag','REFERENCIA HIST\u00d3RICA VERIFICADA \u00b7 no es una lectura nueva; no se pudo actualizar esta estaci\u00f3n'));else if(s.stale)left.append(el('small','stale-tag','Dato anterior a 72 horas \u00b7 verificar fuente'));
  if(s.alertThreshold!=null){
    left.append(el('small',null,`${s.alertType==='t\u00e9cnica'?'Umbral t\u00e9cnico INA (aviso / alerta de escala)':'Nivel de alerta'}: ${fmt(s.alertThreshold)} m`));
    if(s.alertSource)addLink(left,'Fuente del umbral t\u00e9cnico \u2197',s.alertSource,'reading-source');
  }
  if(s.provincialAlertThreshold!=null){
    left.append(el('small',null,`Referencia de alerta provincial: ${fmt(s.provincialAlertThreshold)} m (comunicada 04/09/2026)`));
    if(s.provincialAlertSource)addLink(left,'Fuente: Gobierno de Santa Fe \u2197',s.provincialAlertSource,'reading-source');
  }
  if(s.evacuationThreshold!=null&&s.evacuationThreshold>0){
    left.append(el('small',null,`Umbral de evacuaci\u00f3n de esta estaci\u00f3n: ${fmt(s.evacuationThreshold)} m`));
  }else if(s.river==='Salado'){
    left.append(el('small','stale-tag','Cota de evacuaci\u00f3n: sin valor oficial publicado para esta escala. Segu\u00ed las indicaciones de Protecci\u00f3n Civil.'));
  }
  if(s.source)addLink(left,'Fuente de esta lectura \u2197',s.source,'reading-source');
  right.append(el('b',null,`${fmt(s.value)} m`));if(s.trend)right.append(el('span',null,`Tendencia: ${s.trend}`));
  
  item.append(left,right);
  const value=Number(s.value);
  if(Number.isFinite(value)&&value>=0){
   const valid=n=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):null;
   const alert=valid(s.alertThreshold);
   const evac=valid(s.evacuationThreshold);
   const provincial=valid(s.provincialAlertThreshold);
   const max=Math.max(1,value,alert||0,evac||0,provincial||0)*1.10;
   const pct=n=>(Math.min(100,Math.max(0,100*n/max))).toFixed(2)+'%';
   const old=!!(s.stale||s.archivedReference);
   const color=old?'#8b99aa':alert!==null&&value>=alert?(evac!==null&&value>=evac?'#951e35':'#c63741'):alert!==null&&value>=alert*0.9?'#c98b1e':'#1686bd';
   const box=el('div');
   box.style.cssText='flex:0 0 100%;width:100%;min-width:0;margin-top:6px;padding-top:12px;border-top:1px solid #e0eaf4';
   const heading=el('div',null,old?'Escala visual - dato anterior':'Escala visual de la altura');
   heading.style.cssText='font-size:11px;font-weight:700;color:#536f89;margin-bottom:8px';
   box.append(heading);
   const track=el('div');
   track.style.cssText='position:relative;height:19px;border-radius:10px;overflow:hidden;background:#e4edf6';
   track.setAttribute('role','meter');
   track.setAttribute('aria-label','Altura del rio en '+s.station);
   track.setAttribute('aria-valuemin','0');
   track.setAttribute('aria-valuemax',max.toFixed(2));
   track.setAttribute('aria-valuenow',value.toFixed(2));
   track.setAttribute('aria-valuetext',fmt(value)+' metros');
   const fill=el('div');
   fill.style.cssText='width:'+pct(value)+';height:100%;background:'+color+';border-radius:10px;transition:width .4s';
   track.append(fill);
   const limits=[
    [s.alertType==='t\u00e9cnica'?'Alerta t\u00e9cnica':'Alerta',alert,'#ae7619'],
    ['Evacuaci\u00f3n',evac,'#a12842'],
    ['Referencia provincial (04/09/2026)',provincial,'#6557a5']
   ];
   for(const [name,height,tint] of limits){
    if(height===null)continue;
    const marker=el('span');
    marker.style.cssText='position:absolute;left:'+pct(height)+';top:0;bottom:0;width:3px;border-left:1px solid white;background:'+tint;
    marker.setAttribute('title',name+': '+fmt(height)+' m');
    track.append(marker);
   }
   box.append(track);
   const axis=el('div');
   axis.style.cssText='display:flex;justify-content:space-between;font-size:10px;color:#617b93;margin-top:4px';
   axis.append(el('span',null,'0 m'),el('span',null,'Escala orientativa'));
   box.append(axis);
   const legend=el('div');
   legend.style.cssText='display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:9px;font-size:11px;line-height:1.4';
   const now=el('span',null,'Lectura: '+fmt(value)+' m');
   now.style.cssText='font-weight:750;color:'+color;
   legend.append(now);
   for(const [name,height,tint] of limits){
    if(height===null)continue;
    const label=el('span',null,name+': '+fmt(height)+' m');
    label.style.cssText='font-weight:650;color:'+tint;
    legend.append(label);
   }
   box.append(legend);
   const note=el('div',null,old?'Referencia historica: no indica la situacion actual.':'La altura no representa la profundidad en viviendas ni una orden de evacuacion.');
   note.style.cssText='font-size:10px;line-height:1.45;color:#697c91;margin-top:8px';
   box.append(note);
   item.style.flexWrap='wrap';
   item.append(box);
  }
  section.append(item);

 }
 const linkBox=el('div','river-links');for(const [label,url] of links)addLink(linkBox,label,url,'source-link');section.append(linkBox);wrap.append(section);
}
function renderRivers(stations){
 const wrap=$('#rivers');wrap.replaceChildren();
 const priority={'Recreo \u00b7 Ruta 70':0,'Santo Tom\u00e9':1,'Emilia \u00b7 Ruta 62':2,'San Justo \u00b7 Ruta 2':3,'Tostado':4};
 const parana=(stations||[]).filter(s=>s.river==='Paran\u00e1');
 const salado=(stations||[]).filter(s=>s.river==='Salado').sort((a,b)=>(priority[a.station]??10)-(priority[b.station]??10));
 makeRiverGroup(wrap,'R\u00edo Paran\u00e1','Puerto de Santa Fe \u00b7 niveles y perspectiva oficial',parana,'Sin lectura verificable del Paran\u00e1 en esta consulta.',[['INA \u00b7 Paran\u00e1','https://alerta.ina.gob.ar/a5/diario/reporte_diario']]);
 makeRiverGroup(wrap,'R\u00edo Salado','Estaciones Recreo y Santo Tom\u00e9 \u00b7 seguimiento de la cuenca',salado,'No se pudo recuperar una lectura verificable del Salado en esta consulta. Pod\u00e9s abrir las mediciones oficiales directamente.',[['INA \u00b7 mapa de escalas','https://alerta.ina.gob.ar/'],['Gobierno de Santa Fe \u00b7 niveles de referencia','https://www.santafe.gob.ar/noticias/noticia/287215/']]);
 wrap.append(el('p','river-note','Las escalas de Santo Tom\u00e9, Recreo y Santa Fe son distintas. El umbral t\u00e9cnico de una estaci\u00f3n no determina por s\u00ed solo inundaci\u00f3n o evacuaci\u00f3n de barrios.'));
}
function renderEnso(enso){if(!enso){$('#ensoStatus').textContent='No se pudo verificar el estado actual';$('#ensoText').textContent='Consult\u00e1 el informe del SMN. No atribuimos una fase del fen\u00f3meno sin respaldo oficial reciente.';$('#ensoDate').textContent='';return}$('#ensoStatus').textContent=enso.status||'Consultar informe oficial';$('#ensoText').textContent=enso.summary||'El informe no tiene un resumen disponible en formato accesible.';$('#ensoDate').textContent=enso.publishedAt?`Fecha de referencia: ${enso.publishedAt.slice(0,10)} \u00b7 fuente: ${new URL(enso.source).hostname}`:'La fuente no informa claramente fecha de publicaci\u00f3n.';let a=$('#ensoSource');if(safeLink(enso.source))a.href=enso.source;}
function renderNews(news){const box=$('#news');box.replaceChildren();if(!news?.length){box.append(el('p','section-note','No se detectaron nuevas publicaciones h\u00eddricas en el canal oficial consultado en los \u00faltimos 30 d\u00edas, o no estuvo disponible. Esto no descarta novedades en otras fuentes.'));return}news.forEach(n=>{const row=el('article','news-item');addLink(row,n.title+' \u2197',n.url,'news-link');if(n.summary)row.append(el('p',null,n.summary));if(n.publishedAt)row.append(el('time',null,localDate(n.publishedAt)));else if(n.sourceName?.includes('Santo Tom\u00e9'))row.append(el('time',null,'Fecha: consultar publicaci\u00f3n municipal'));box.append(row)})}
function renderReport(r){
 const good=(r.stations||[]).filter(s=>!s.stale);
 const parana=good.filter(s=>s.river==='Paran\u00e1');const salado=good.filter(s=>s.river==='Salado');
 const archived=(r.stations||[]).filter(s=>s.river==='Salado'&&s.archivedReference);
 const fmtGroup=(arr,kind)=>arr.length?`${kind}: ${arr.map(s=>`${s.station} ${fmt(s.value)} m${s.trend?' ('+s.trend+')':''}`).join(', ')}.`:kind==='Salado'&&archived.length?`${kind}: sin mediciones nuevas recuperadas; \u00faltima referencia hist\u00f3rica: ${archived.map(s=>`${s.station} ${fmt(s.value)} m (28/10/2026)`).join(', ')}. No equivale a un registro actual.`:`${kind}: sin medici\u00f3n reciente verificable; consultar la fuente.`;
 $('#reportSummary').textContent=[fmtGroup(parana,'Paran\u00e1'),fmtGroup(salado,'Salado')].join(' ')+' Cada estaci\u00f3n conserva su propia fecha de medici\u00f3n. Para Recreo y Santo Tom\u00e9: umbral t\u00e9cnico INA 4,70 m; referencia de alerta provincial informada el 04/09/2026: 5,70 m. No se dispone de una cota de evacuaci\u00f3n oficial publicada para estas escalas.';
 const hints=$('#highlights');hints.replaceChildren();for(const n of r.noteworthy||[])hints.append(el('div','notice',n.title));
 const forecast=$('#forecastWrap');if(r.forecast?.text){forecast.hidden=false;$('#forecastText').textContent=r.forecast.text;const link=$('#forecastLink');if(safeLink(r.forecast.source))link.href=r.forecast.source}else forecast.hidden=true;
 const sources=$('#sources');sources.replaceChildren();for(const source of r.sources||[]){const li=el('li');addLink(li,source.name+' \u2197',source.url,'ordinary-link');sources.append(li)}
}
function render(data){const checked=$('#checkedAt'),badge=$('#statusBadge');checked.textContent=localDate(data.checkedAt);const success=data.status!=='unavailable';const bad=[data.fetched?.inaDaily,data.fetched?.inaMap,data.fetched?.smnEnso,data.fetched?.municipality].filter(Boolean).length;badge.className='status-pill '+(!success?'unavailable':bad<4?'warning':'available');badge.textContent=!success?'Sin datos nuevos':data.archivedSaladoShown?'Parcial \u00b7 Salado hist\u00f3rico':bad<4?'Parcial':'Consultado';renderRivers(data.stations||[]);renderEnso(data.enso);renderNews(data.news);renderReport(data);}
let requesting=false;
async function loadReport(){if(requesting)return;requesting=true;$('#refreshBtn').disabled=true;$('#statusBadge').textContent='Consultando\u2026';try{const res=await fetch('/api/reporte?version=salado-santotome-v2',{headers:{Accept:'application/json'}});if(!res.ok)throw Error('Falla en fuente');const result=await res.json();if(result?.version!==1)throw Error('Respuesta inesperada');render(result);$('#reloadError').classList.add('hidden')}catch(e){$('#reloadError').classList.remove('hidden');$('#checkedAt').textContent='No disponible';$('#statusBadge').className='status-pill unavailable';$('#statusBadge').textContent='Sin conexi\u00f3n';$('#reportSummary').textContent='No fue posible obtener el reporte. El sitio no mostrar\u00e1 cifras simuladas. Consult\u00e1 las fuentes oficiales.';renderRivers([]);renderEnso(null);renderNews([])}finally{$('#refreshBtn').disabled=false;requesting=false}}
$('#refreshBtn').addEventListener('click',loadReport);$('#retryBtn').addEventListener('click',loadReport);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck>1800000){lastCheck=Date.now();loadReport()}});let lastCheck=Date.now();loadReport();if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
