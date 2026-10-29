'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {SOURCES,num,parseMap,parseDaily,parseEnso,parseObservations,parseBulletin,parseFeed,collect}=require('../lib/reports.cjs');
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
 const d=await collect({fetcher:async()=>{throw Error('offline')},now:new Date('2026-10-28T21:00:00Z')});assert.equal(d.status,'unavailable');assert.equal(d.stations.length,0);assert.equal(d.noteworthy.length,0);
});
test('Agregación con reporte real simulado mantiene fuente y fechas',async()=>{
 const d=await collect({fetcher:async(u)=>u===SOURCES.inaDaily?htmlDaily:'',now:new Date('2026-10-28T21:00:00Z')});assert.equal(d.stations[0].value,4.23);assert.equal(d.stations[0].stale,false);assert.equal(d.stations[0].source,SOURCES.inaDaily)
});
