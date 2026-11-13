'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseRioAlert,createClient,URL}=require('../lib/rioalert.cjs');
const {buildReport}=require('../api/reporte.js');
const NOW=new Date('2026-11-13T21:10:00.000Z');
const page=({city='Santa Fe, Santa Fe · río Paraná',value='5,58',date='13 nov 2026 · 16:00'}={})=>
 `<!doctype html><html><body><h1>Altura del río Paraná en Santa Fe</h1><p>${city}</p><h2>Última medición</h2><ul><li>Altura: ${value} m, medida el ${date} (hora de Argentina).</li><li>Medido · Prefectura Naval Argentina · sin validar (el organismo publica el dato crudo).</li><li>Tendencia: creciente · en 24 h: +0,11 m.</li></ul><h2>Niveles de alerta y evacuación</h2></body></html>`;

test('Lee SANTA FE / PARANÁ sin inventar altura ni hora',()=>{
 const r=parseRioAlert(page(),NOW);
 assert.equal(r?.value,5.58);
 assert.equal(r?.observedAt,'2026-11-13T19:00:00.000Z');
 assert.equal(r?.station,'Santa Fe (Puerto)');
 assert.equal(r?.trend,'crece');
 assert.match(r?.sourceName,/secundaria/);
 assert.equal(r?.via,URL);
 assert.equal(r?.previous,null);
});
test('Rechaza estaciones ajenas, fechas futuras, HTML incompleto y pronósticos',()=>{
 assert.equal(parseRioAlert(page({city:'Diamante, Entre Ríos · río Paraná'}),NOW),null);
 assert.equal(parseRioAlert(page({date:'14 nov 2026 · 16:00'}),NOW),null);
 assert.equal(parseRioAlert(page({date:'31 nov 2026 · 16:00'}),NOW),null);
 assert.equal(parseRioAlert('<h1>Estimación de RíoAlert: 6,20 m</h1>',NOW),null);
});
test('Cachea las consultas al retransmisor por 15 minutos',async()=>{
 let calls=0;let time=NOW.getTime();
 const fetcher=async()=>{calls++;return {ok:true,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>page()}};
 const c=createClient({fetcher,now:()=>time});
 const a=await c.get(),b=await c.get();
 assert.equal(calls,1);assert.equal(a.reading.value,5.58);
 assert.equal(b.diagnostic.cacheHit,true);
 time+=15*60*1000+1;await c.get();assert.equal(calls,2);
});
test('El backend elige lectura secundaria posterior al INA cuando PNA no conecta',async()=>{
 const ina={river:'Paraná',station:'Santa Fe (Puerto)',value:5.54,observedAt:'2026-11-13T03:00:00.000Z',source:'https://alerta.ina.gob.ar/',alertThreshold:5.3,evacuationThreshold:5.7};
 const client={get:async()=>({reading:parseRioAlert(page(),NOW),diagnostic:{ok:true,detail:'Lectura real con origen indicado'}})};
 const report=await buildReport({now:NOW,base:async()=>({stations:[ina],sources:[],fetched:{}}),read:async()=>{throw Error('Sin acceso externo en test')},pnaClient:{get:async()=>({reading:null,diagnostic:{ok:false,detail:'timeout'}})},rioClient:client});
 const s=report.stations.find(x=>x.station==='Santa Fe (Puerto)');
 assert.equal(s.value,5.58);
 assert.equal(s.observedAt,'2026-11-13T19:00:00.000Z');
 assert.ok(s.alternatives.some(x=>x.value===5.54));
 assert.equal(report.sourceChecks.find(x=>x.name.startsWith('RíoAlert')).ok,true);
});
