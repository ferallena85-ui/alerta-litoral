'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {SOURCES,num,parseMap,parseFichSalado,parseFichHistory,parseSantoTomeNews,latestRecord,parseDaily,parseEnso,parseObservations,parseBulletin,parseFeed,thresholds,collect}=require('../lib/reports.cjs');
test('Lecturas en metros con coma y punto; no acepta números de miles ni inverosímiles',()=>{
 assert.equal(num('4,23'),4.23);assert.equal(num('2.22'),2.22);assert.equal(num('17700'),null);assert.equal(num('-3'),null);assert.equal(num(''),null)
});
const htmlDaily=`<h2>Fecha de actualización: 28/10/2026</h2><table><tr><th>Estación</th><th>Río</th><th>Nivel (m)</th><th>Alerta</th><th>Evacuación</th><th>Perspectiva</th></tr><tr><td>Santa Fe</td><td>Paraná</td><td>4,23</td><td>5,30</td><td>5,70</td><td>aguas medias</td></tr></table><h3>Aguas abajo, sobre Santa Fe / Paraná - Rosario</h3><p>Estabilidad con oscilaciones.</p>`;
test('Extrae altura, umbrales oficiales y fecha del reporte INA',()=>{
 const d=parseDaily(htmlDaily);assert.equal(d.santaFe.value,4.23);assert.equal(d.santaFe.alertThreshold,5.3);assert.equal(d.santaFe.evacuationThreshold,5.7);assert.equal(d.date,'2026-10-28')
});
test('Lecturas oficiales de estaciones Salado',()=>{
 const row=['103','2026-10-27T13:40:00Z','2.22','2.25','baja','normal','n','baja:n','Recreo - Ruta Provincial nº 70','alturas_bdhi','11.09','103','2','4.7','0','0','2026-10-21T14:31:00.000Z','2026-10-27T13:40:00.000Z','SALADOSANTAFE',''];
 const map=parseMap('<table><tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr></table>');assert.equal(map[0].river,'Salado');assert.equal(map[0].value,2.22);assert.equal(map[0].alertThreshold,4.7);assert.equal(map[0].evacuationThreshold,null);
});
test('API INA JSON no inventa datos ausentes',()=>{
 const x=parseObservations(JSON.stringify({observaciones:[{valor:2.25,timestart:'2026-10-27T11:00:00Z'},{valor:2.22,timestart:'2026-10-28T11:00:00Z'}]}),'Salado','Recreo',SOURCES.inaRec);assert.equal(x.value,2.22);assert.equal(x.trend,'baja');assert.equal(parseObservations('<html>no disponible</html>','Salado','Recreo','source'),null)
});
test('Boletín más nuevo con su fecha, fuente y PDF',()=>{
 const html=`<a href="/sites/default/files/boletin8.pdf">BOLETIN N°8 (Publicado: 22/10/2026 – Pronósticos emitidos al: 20/10/2026)</a><a href="/sites/default/files/boletin7.pdf">BOLETIN N°7 (Publicado: 15/10/2026)</a>`;
 const b=parseBulletin(html);assert.equal(b.publishedAt.slice(0,10),'2026-10-22');assert.match(b.url,/boletin8\.pdf/);
});
test('Agregación no inventa mediciones ante caídas de fuente',async()=>{
 const d=await collect({fetcher:async()=>{throw Error('offline')},now:new Date('2026-10-28T21:00:00Z')});assert.equal(d.stations.length,2);assert.equal(d.archivedSaladoShown,true);assert.equal(d.stations.every(s=>s.archivedReference&&s.stale),true);assert.equal(d.noteworthy.length,0);
});
test('Agregación con reporte real simulado mantiene fuente y fechas',async()=>{
 const d=await collect({fetcher:async(u)=>u===SOURCES.inaDaily?htmlDaily:'',now:new Date('2026-10-28T21:00:00Z')});assert.equal(d.stations[0].value,4.23);assert.equal(d.stations[0].stale,false);assert.equal(d.stations[0].source,SOURCES.inaDaily)
});

const fichHtml=`<h3>Miércoles 28 de octubre de 2026</h3><table>
<tr><th>Estación</th><th>Río</th><th>Altura</th><th>Variación</th><th>Cambio</th><th>Alt. Ant</th><th>Alerta Técnica</th></tr>
<tr><td><a>Recreo (R.P. 70)</a></td><td>Río Salado</td><td>2,15</td><td>-0,07</td><td><img alt="Baja"></td><td>2,22</td><td>4,70</td></tr>
<tr><td>Santo Tomé</td><td>Río Salado</td><td>4,33</td><td>0,03</td><td><img alt="Crece"></td><td>4,30</td><td>4,70</td></tr>
<tr><td>Cululú (R.P. 50-s)</td><td>Arroyo Cululú</td><td>0,39</td><td>-0,07</td><td>Baja</td><td>0,46</td><td>4,00</td></tr>
</table>`;
test('FICH–UNL: Recreo y Santo Tomé; no confunde el arroyo Cululú',()=>{
 const a=parseFichSalado(fichHtml);
 assert.equal(a.length,2);assert.equal(a[0].value,2.15);assert.equal(a[0].alertThreshold,4.7);
 assert.equal(a[0].reportedOn,'2026-10-28');assert.equal(a[0].observedAt,null);
 assert.equal(a[1].station,'Santo Tomé');assert.equal(a[1].trend,'crece');
});
test('Consulta alternativa CSV INA conserva fecha original y reemplaza archivo cuando llega una lectura nueva',async()=>{
 const csv='timestart,valor\n2026-10-27T15:51:00Z,2.22\n2026-10-29T15:51:00Z,2.36';
 const data=await collect({now:new Date('2026-10-29T21:00:00Z'),fetcher:async url=>url.includes('/103/observaciones')?csv:''});
 const r=data.stations.find(x=>x.station==='Recreo · Ruta 70');
 assert.equal(r.value,2.36);assert.equal(r.archivedReference,undefined);assert.equal(r.stale,false);
 assert.equal(data.saladoStationsFound,1);
});
test('Prioriza fuente con fecha de publicación/lectura más nueva',()=>{
 const old={station:'Recreo · Ruta 70',value:2.3,observedAt:'2026-10-26T12:00:00Z'};
 const newer={station:'Recreo · Ruta 70',value:2.15,reportedOn:'2026-10-28'};
 assert.equal(latestRecord(old,newer).value,2.15);
 assert.equal(latestRecord(newer,old).value,2.15);
});

const inaSaladoRows=`<table><tr><td>1679</td><td>2026-10-28T15:52:00Z</td><td>4.33</td><td>4.3</td><td>crece</td><td>normal</td><td>n</td><td>crece:n</td><td>Santo Tomé</td><td>alturas_bdhi</td><td></td><td>3044</td><td>2</td><td>4.7</td><td>0</td><td>0</td><td>2026-10-22T14:23:00.000Z</td><td>2026-10-28T15:52:00.000Z</td><td>SALADOSANTAFE</td><td></td></tr></table>`;
test('INA mapa extrae Santo Tomé y su umbral técnico',()=>{
 const x=parseMap(inaSaladoRows);assert.equal(x.length,1);assert.equal(x[0].station,'Santo Tomé');assert.equal(x[0].value,4.33);assert.equal(x[0].river,'Salado');assert.equal(x[0].alertThreshold,4.7);
});
const hist=`<h2>Estación: Santo Tomé</h2><p>Nivel de alerta: 4,70 m</p><table><tr><td>28/10/2026</td><td>12:52</td><td>4,33</td><td>0,03</td><td><img alt="Crece"></td><td>4,30</td></tr><tr><td>27/10/2026</td><td>10:40</td><td>4,30</td><td>0,05</td><td>Crece</td><td>4,25</td></tr></table>`;
test('Historial FICH permite recuperar última lectura de Santo Tomé con fecha y hora',()=>{
 const r=parseFichHistory(hist,'Santo Tomé',SOURCES.fichSantoTome);
 assert.equal(r.value,4.33);assert.equal(r.observedAt,'2026-10-28T15:52:00.000Z');assert.equal(r.alertThreshold,4.7);
});
test('Agregación usa mapa INA si FICH no responde',async()=>{
 const r=await collect({now:new Date('2026-10-29T12:00:00Z'),fetcher:async url=>url===SOURCES.inaMap?inaSaladoRows:''});
 assert.equal(r.stations.filter(s=>!s.archivedReference).length,1);assert.equal(r.stations.find(s=>!s.archivedReference).station,'Santo Tomé');
});
test('JSON de INA con estructura anidada recupera Santo Tomé',async()=>{
 const payload=JSON.stringify({data:{series:[{observaciones:[{timeStart:'2026-10-29T15:52:00Z',value:4.35},{timeStart:'2026-10-28T15:52:00Z',value:4.33}]}]}});
 const r=await collect({now:new Date('2026-10-29T21:00:00Z'),fetcher:async url=>url.startsWith(SOURCES.inaSanto)?payload:''});
 const s=r.stations.find(s=>s.station==='Santo Tomé');
 assert.equal(s.value,4.35);assert.equal(s.archivedReference,undefined);assert.equal(s.stale,false);
});
test('Municipalidad Santo Tomé SF: solo enlaza noticias oficiales relevantes',()=>{
 const html='<a href="/Otros/noticias_ciudad/5746-el_intendente_weiss_ackerley_declara_la_emergencia_hidrica">El Intendente declara la Emergencia Hídrica</a><a href="https://municipiosantotome.gob.ar/crecida-del-rio-uruguay/">Crecida del río Uruguay</a>';
 const news=parseSantoTomeNews(html);assert.equal(news.length,1);assert.equal(news[0].publishedAt,null);assert.match(news[0].url,/www\.santotome\.gob\.ar/);
});

test('La lectura del Paraná del 29 tiene prioridad sobre un parte INA del 28', async()=>{
 const mapRow=['30','2026-10-29T11:00:00Z','4.38','4.23','crece','normal','n','crece:n','Santa Fe','alturas_bdhi','','30','2','5.3','5.7','0','2026-10-22T14:00:00Z','2026-10-29T11:00:00Z','PARANAINF',''];
 const map='<table><tr>'+mapRow.map(v=>'<td>'+v+'</td>').join('')+'</tr></table>';
 const r=await collect({fetcher:async url=>url===SOURCES.inaDaily?htmlDaily:url===SOURCES.inaMap?map:'',now:new Date('2026-10-29T15:00:00Z')});
 const parana=r.stations.find(x=>x.river==='Paraná');
 assert.equal(parana.value,4.38); assert.equal(parana.observedAt,'2026-10-29T11:00:00.000Z');
});
test('Diagnóstico visible y sin inventar datos cuando falla una fuente',async()=>{
 const r=await collect({fetcher:async url=>url===SOURCES.inaDaily?htmlDaily:'',now:new Date('2026-10-29T15:00:00Z')});
 assert.equal(r.saladoStationsFound,0);assert.equal(r.archivedSaladoShown,true);
 assert.equal(r.sourceChecks.find(s=>s.name==='INA CSV Recreo').records,0);
 assert.equal(r.sourceChecks.find(s=>s.name==='INA diario').ok,true);
});

test('API directa INA serie 3044 permite Santo Tomé en el Salado',async()=>{
 const payload=JSON.stringify({observaciones:[{valor:4.30,timestart:'2026-10-27T15:52:00Z'},{valor:4.33,timestart:'2026-10-28T15:52:00Z'}]});
 const r=await collect({now:new Date('2026-10-29T12:00:00Z'),fetcher:async url=>url.startsWith(SOURCES.inaSanto)?payload:''});
 const x=r.stations.find(s=>s.station==='Santo Tomé');
 assert.equal(x.value,4.33); assert.equal(x.trend,'crece'); assert.equal(x.river,'Salado');
});


test('La referencia de evacuación de Salado NO se inventa; se informa la alerta provincial fechada',()=>{
 for(const name of ['Santo Tomé','Recreo · Ruta 70']){
  const r=thresholds({river:'Salado',station:name,alertThreshold:null});
  assert.equal(r.alertThreshold,4.7);assert.equal(r.provincialAlertThreshold,5.7);
  assert.equal(r.evacuationThreshold,null);assert.match(r.evacuationStatus,/Sin cota/);
  assert.match(r.provincialAlertSource,/santafe.gob.ar/);
 }
 const parana=thresholds({river:'Paraná',station:'Santa Fe (Puerto)',value:4.25});
 assert.equal(parana.alertThreshold,5.3);assert.equal(parana.evacuationThreshold,5.7);
});
test('El archivo histórico no se presenta como dato actual aunque se consulte hoy',async()=>{
 const r=await collect({now:new Date('2026-11-15T12:00:00Z'),fetcher:async()=>{throw Error('no hay acceso')} });
 assert.equal(r.stations.filter(x=>x.archivedReference).length,2);
 assert.equal(r.stations.every(x=>x.stale),true);
 assert.ok(r.stations.every(x=>x.observedAt.startsWith('2026-10-28')));
});

test('Lectura anidada no confunde pronósticos con observaciones',()=>{
 const payload=JSON.stringify({pronosticos:[{valor:9.99,timestart:'2026-10-30T11:00:00Z'}],observaciones:[{valor:4.35,timestart:'2026-10-29T11:00:00Z'}]});
 const r=parseObservations(payload,'Salado','Santo Tomé',SOURCES.inaSanto);
 assert.equal(r.value,4.35);
});
test('CSV de INA admite punto y coma y coma decimal',()=>{
 const csv='timestart;valor\n2026-10-27T11:00:00Z;2,15\n2026-10-28T11:00:00Z;2,22';
 const r=parseObservations(csv,'Salado','Recreo · Ruta 70',SOURCES.inaRec);
 assert.equal(r.value,2.22);assert.equal(r.trend,'crece');
});
