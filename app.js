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
// InstalaciÃ³n PWA Android: el navegador requiere confirmaciÃ³n expresa del usuario.
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
  if (androidDevice && !alreadyInstalled()) installButton.textContent = 'Instalar aplicaciÃ³n';
});
window.addEventListener('appinstalled', () => {
  pendingInstallPrompt = null;
  installButton.textContent = 'AplicaciÃ³n instalada';
  // No hay notificaciones: solo se confirma que la PWA se instalÃ³.
  displayInstallHelp('Alerta Litoral ya estÃ¡ instalada en tu dispositivo. BuscÃ¡ el Ã­cono entre tus aplicaciones.');
});

async function requestAppInstall() {
  if (alreadyInstalled()) {
    displayInstallHelp('Ya estÃ¡s usando Alerta Litoral como aplicaciÃ³n instalada.');
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
        displayInstallHelp('Si cambiÃ¡s de opiniÃ³n, podÃ©s usar el menÃº â® de Chrome y tocar Â«Instalar aplicaciÃ³nÂ».');
      }
    } catch (err) {
      displayInstallHelp('AbrÃ­ Alerta Litoral en Google Chrome, tocÃ¡ el menÃº â® y elegÃ­ Â«Instalar aplicaciÃ³nÂ» o Â«Agregar a pantalla principalÂ».');
    }
    return;
  }
  if (androidDevice) {
    displayInstallHelp('AbrÃ­ este enlace directamente en Google Chrome (no dentro de WhatsApp). TocÃ¡ el menÃº â® y elegÃ­ Â«Instalar aplicaciÃ³nÂ» o Â«Agregar a pantalla principalÂ». Si el navegador todavÃ­a no ofrece instalaciÃ³n directa, podÃ©s crear el acceso desde ese menÃº.');
  } else if (iosDevice) {
    displayInstallHelp('En iPhone, abrÃ­ el enlace en Safari, tocÃ¡ Compartir y elegÃ­ Â«Agregar a pantalla de inicioÂ».');
  } else {
    displayInstallHelp('AbrÃ­ el menÃº de tu navegador y buscÃ¡ Â«Instalar aplicaciÃ³nÂ» o Â«Crear acceso directoÂ».');
  }
}
installButton.addEventListener('click', requestAppInstall);
if (installTab) installTab.addEventListener('click', event => {
  event.preventDefault();
  requestAppInstall();
});
installButton.textContent = alreadyInstalled() ? 'AplicaciÃ³n instalada' : androidDevice ? 'Instalar aplicaciÃ³n' : 'CÃ³mo instalar';

$('#shareBtn').addEventListener('click',async()=>{const data={title:'Alerta Litoral',text:'Informes del NiÃ±o Â· ParanÃ¡ y Salado en Santa Fe',url:location.origin};if(navigator.share){try{await navigator.share(data)}catch{}}else{try{await navigator.clipboard.writeText(data.url);$('#shareBtn').title='Enlace copiado'}catch{window.prompt('CopiÃ¡ el enlace:',data.url)}}});
const reportDate=report=>{const x=report.reportDate;if(!x)return null;const d=new Date(x+'T12:00:00-03:00');return localDate(d,{hour:undefined,minute:undefined})};
function makeRiverGroup(wrap,title,subtitle,stations,emptyText,links){
 const section=el('section','river-group');section.append(el('h3','river-group-title',title));
 section.append(el('p','river-group-subtitle',subtitle));
 if(!stations.length)section.append(el('p','section-note',emptyText));
 for(const s of stations){
  const item=el('article','river-item'),left=el('div'),right=el('div','reading');
  left.append(el('strong',null,s.station));
  left.append(el('small',null,s.observedAt?`MediciÃ³n: ${localDate(s.observedAt)}`:s.reportedOn?`Parte publicado: ${localDate(s.reportedOn,{hour:undefined,minute:undefined})}`:'Fecha no confirmada'));
  if(s.archivedReference)left.append(el('small','stale-tag','REFERENCIA HISTÃRICA VERIFICADA Â· no es una lectura nueva; no se pudo actualizar esta estaciÃ³n'));else if(s.stale)left.append(el('small','stale-tag','Dato anterior a 72 horas Â· verificar fuente'));
  if(s.alertThreshold!=null){
    left.append(el('small',null,`${s.alertType==='tÃ©cnica'?'Umbral tÃ©cnico INA (aviso / alerta de escala)':'Nivel de alerta'}: ${fmt(s.alertThreshold)} m`));
    if(s.alertSource)addLink(left,'Fuente del umbral tÃ©cnico â',s.alertSource,'reading-source');
  }
  if(s.provincialAlertThreshold!=null){
    left.append(el('small',null,`Referencia de alerta provincial: ${fmt(s.provincialAlertThreshold)} m (comunicada 04/09/2026)`));
    if(s.provincialAlertSource)addLink(left,'Fuente: Gobierno de Santa Fe â',s.provincialAlertSource,'reading-source');
  }
  if(s.evacuationThreshold!=null&&s.evacuationThreshold>0){
    left.append(el('small',null,`Umbral de evacuaciÃ³n de esta estaciÃ³n: ${fmt(s.evacuationThreshold)} m`));
  }else if(s.river==='Salado'){
    left.append(el('small','stale-tag','Cota de evacuaciÃ³n: sin valor oficial publicado para esta escala. SeguÃ­ las indicaciones de ProtecciÃ³n Civil.'));
  }
  // Para Santa Fe (Puerto), abrir el visualizador pÃºblico del INA y no
  // el endpoint JSON sin fechas, que responde "Faltan parÃ¡metros".
  if(s.source){
    const lecturaUrl=s.river==='ParanÃ¡'&&s.station==='Santa Fe (Puerto)'
      ? 'https://alerta.ina.gob.ar/a5/secciones?seriesId=30'
      : s.source;
    addLink(left,'Fuente de esta lectura â',lecturaUrl,'reading-source');
  }
  right.append(el('b',null,`${fmt(s.value)} m`));if(s.trend)right.append(el('span',null,`Tendencia: ${s.trend}`));
  item.append(left,right);section.append(item);
 }
 const linkBox=el('div','river-links');for(const [label,url] of links)addLink(linkBox,label,url,'source-link');section.append(linkBox);wrap.append(section);
}
function renderRivers(stations){
 const wrap=$('#rivers');wrap.replaceChildren();
 const priority={'Recreo Â· Ruta 70':0,'Santo TomÃ©':1,'Emilia Â· Ruta 62':2,'San Justo Â· Ruta 2':3,'Tostado':4};
 const parana=(stations||[]).filter(s=>s.river==='ParanÃ¡');
 const salado=(stations||[]).filter(s=>s.river==='Salado').sort((a,b)=>(priority[a.station]??10)-(priority[b.station]??10));
 makeRiverGroup(wrap,'RÃ­o ParanÃ¡','Puerto de Santa Fe Â· niveles y perspectiva oficial',parana,'Sin lectura verificable del ParanÃ¡ en esta consulta.',[['INA Â· ParanÃ¡','https://alerta.ina.gob.ar/a5/diario/reporte_diario']]);
 makeRiverGroup(wrap,'RÃ­o Salado','Estaciones Recreo y Santo TomÃ© Â· seguimiento de la cuenca',salado,'No se pudo recuperar una lectura verificable del Salado en esta consulta. PodÃ©s abrir las mediciones oficiales directamente.',[['INA Â· mapa de escalas','https://alerta.ina.gob.ar/'],['Gobierno de Santa Fe Â· niveles de referencia','https://www.santafe.gob.ar/noticias/noticia/287215/']]);
 wrap.append(el('p','river-note','Las escalas de Santo TomÃ©, Recreo y Santa Fe son distintas. El umbral tÃ©cnico de una estaciÃ³n no determina por sÃ­ solo inundaciÃ³n o evacuaciÃ³n de barrios.'));
}
function renderEnso(enso){if(!enso){$('#ensoStatus').textContent='No se pudo verificar el estado actual';$('#ensoText').textContent='ConsultÃ¡ el informe del SMN. No atribuimos una fase del fenÃ³meno sin respaldo oficial reciente.';$('#ensoDate').textContent='';return}$('#ensoStatus').textContent=enso.status||'Consultar informe oficial';$('#ensoText').textContent=enso.summary||'El informe no tiene un resumen disponible en formato accesible.';$('#ensoDate').textContent=enso.publishedAt?`Fecha de referencia: ${enso.publishedAt.slice(0,10)} Â· fuente: ${new URL(enso.source).hostname}`:'La fuente no informa claramente fecha de publicaciÃ³n.';let a=$('#ensoSource');if(safeLink(enso.source))a.href=enso.source;}
function renderNews(news){const box=$('#news');box.replaceChildren();if(!news?.length){box.append(el('p','section-note','No se detectaron nuevas publicaciones hÃ­dricas en el canal oficial consultado en los Ãºltimos 30 dÃ­as, o no estuvo disponible. Esto no descarta novedades en otras fuentes.'));return}news.forEach(n=>{const row=el('article','news-item');addLink(row,n.title+' â',n.url,'news-link');if(n.summary)row.append(el('p',null,n.summary));if(n.publishedAt)row.append(el('time',null,localDate(n.publishedAt)));else if(n.sourceName?.includes('Santo TomÃ©'))row.append(el('time',null,'Fecha: consultar publicaciÃ³n municipal'));box.append(row)})}
function renderReport(r){
 const good=(r.stations||[]).filter(s=>!s.stale);
 const parana=good.filter(s=>s.river==='ParanÃ¡');const salado=good.filter(s=>s.river==='Salado');
 const archived=(r.stations||[]).filter(s=>s.river==='Salado'&&s.archivedReference);
 const fmtGroup=(arr,kind)=>arr.length?`${kind}: ${arr.map(s=>`${s.station} ${fmt(s.value)} m${s.trend?' ('+s.trend+')':''}`).join(', ')}.`:kind==='Salado'&&archived.length?`${kind}: sin mediciones nuevas recuperadas; Ãºltima referencia histÃ³rica: ${archived.map(s=>`${s.station} ${fmt(s.value)} m (28/10/2026)`).join(', ')}. No equivale a un registro actual.`:`${kind}: sin mediciÃ³n reciente verificable; consultar la fuente.`;
 $('#reportSummary').textContent=[fmtGroup(parana,'ParanÃ¡'),fmtGroup(salado,'Salado')].join(' ')+' Cada estaciÃ³n conserva su propia fecha de mediciÃ³n. Para Recreo y Santo TomÃ©: umbral tÃ©cnico INA 4,70 m; referencia de alerta provincial informada el 04/09/2026: 5,70 m. No se dispone de una cota de evacuaciÃ³n oficial publicada para estas escalas.';
 const hints=$('#highlights');hints.replaceChildren();for(const n of r.noteworthy||[])hints.append(el('div','notice',n.title));
 const forecast=$('#forecastWrap');if(r.forecast?.text){forecast.hidden=false;$('#forecastText').textContent=r.forecast.text;const link=$('#forecastLink');if(safeLink(r.forecast.source))link.href=r.forecast.source}else forecast.hidden=true;
 const sources=$('#sources');sources.replaceChildren();for(const source of r.sources||[]){const li=el('li');addLink(li,source.name+' â',source.url,'ordinary-link');sources.append(li)}
}
function render(data){const checked=$('#checkedAt'),badge=$('#statusBadge');checked.textContent=localDate(data.checkedAt);const success=data.status!=='unavailable';const bad=[data.fetched?.inaDaily,data.fetched?.inaMap,data.fetched?.smnEnso,data.fetched?.municipality].filter(Boolean).length;badge.className='status-pill '+(!success?'unavailable':bad<4?'warning':'available');badge.textContent=!success?'Sin datos nuevos':data.archivedSaladoShown?'Parcial Â· Salado histÃ³rico':bad<4?'Parcial':'Consultado';renderRivers(data.stations||[]);renderEnso(data.enso);renderNews(data.news);renderReport(data);}
let requesting=false;
async function loadReport(){if(requesting)return;requesting=true;$('#refreshBtn').disabled=true;$('#statusBadge').textContent='Consultandoâ¦';try{const res=await fetch('/api/reporte?version=salado-santotome-v2',{headers:{Accept:'application/json'}});if(!res.ok)throw Error('Falla en fuente');const result=await res.json();if(result?.version!==1)throw Error('Respuesta inesperada');render(result);$('#reloadError').classList.add('hidden')}catch(e){$('#reloadError').classList.remove('hidden');$('#checkedAt').textContent='No disponible';$('#statusBadge').className='status-pill unavailable';$('#statusBadge').textContent='Sin conexiÃ³n';$('#reportSummary').textContent='No fue posible obtener el reporte. El sitio no mostrarÃ¡ cifras simuladas. ConsultÃ¡ las fuentes oficiales.';renderRivers([]);renderEnso(null);renderNews([])}finally{$('#refreshBtn').disabled=false;requesting=false}}
$('#refreshBtn').addEventListener('click',loadReport);$('#retryBtn').addEventListener('click',loadReport);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck>1800000){lastCheck=Date.now();loadReport()}});let lastCheck=Date.now();loadReport();if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
