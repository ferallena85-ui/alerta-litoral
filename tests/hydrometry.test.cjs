'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parsePna,pnaDate,select,valid,PNA}=require('../lib/hydrometry.cjs');
const {buildReport}=require('../api/reporte.js');
const {parseObservations,parseFichHistory,SOURCES}=require('../lib/reports.cjs');
const now=new Date('2026-11-12T23:30:00Z');
const row=(name='SANTA FE',river='PARANA',date='12/NOV/26 - 2000',value='5.47')=>'<table><tr>'+[name,river,value,'0.01','2',date,'ALERTA CRECE','','5.46','12/NOV/26 - 1800','5.30','5.70'].map(c=>'<td>'+c+'</td>').join('')+'</tr></table>';
const ina={river:'Paraná',station:'Santa Fe (Puerto)',value:5.39,observedAt:'2026-11-12T03:00:00Z',source:'https://alerta.ina.gob.ar/',alertThreshold:5.3,evacuationThreshold:5.7};
test('PNA extrae solo Santa Fe / Paraná y conserva ambos horarios reales',()=>{
 const r=parsePna(row(),now);assert.equal(r.value,5.47);assert.equal(r.observedAt,'2026-11-12T23:00:00.000Z');assert.equal(r.previousObservedAt,'2026-11-12T21:00:00.000Z');assert.equal(r.history.length,2);assert.equal(r.source,PNA);
 assert.equal(parsePna(row('SANTO TOME','URUGUAY'),now),null);assert.equal(parsePna(row('SANTA FE','URUGUAY'),now),null);
});
test('Rechaza fechas imposibles, futuras, números ausentes y estimaciones',()=>{
 assert.equal(pnaDate('31/NOV/26 - 2000'),null);assert.equal(pnaDate('12/NOV/26 - 2460'),null);
 assert.equal(parsePna(row('SANTA FE','PARANA','13/NOV/26 - 2000'),now),null);
 assert.equal(parsePna(row('SANTA FE','PARANA','12/NOV/26 - 2000','S/E'),now),null);
 assert.equal(valid({...ina,kind:'forecast'},now),false);
});
test('Selecciona por observación, conserva INA y marca discrepancias próximas',()=>{
 const pna=parsePna(row(),now),chosen=select([ina,pna],now);assert.equal(chosen.value,5.47);assert.equal(chosen.alternatives[0].value,5.39);assert.equal(chosen.variationCm,1);
 const conflict={...ina,value:4.9,observedAt:'2026-11-12T22:45:00Z'};assert.equal(select([pna,conflict],now).review.length,1);
 assert.equal(select([pna,{...ina,observedAt:'2026-11-12T23:15:00Z'}],now).source,ina.source);
});
test('Un parte sin hora no desplaza una observación confirmada del mismo día',()=>{
 const daily={...ina,observedAt:null,reportedOn:'2026-11-12',value:5.5};assert.equal(select([daily,ina],now).value,ina.value);
 assert.equal(select([{...daily,reportedOn:'2026-11-11'}],now).observedAt,null);
});
test('La API consulta PNA una sola vez, conserva INA y no consulta retransmisores',async()=>{
 const calls=[];const r=await buildReport({now,base:async()=>({stations:[ina],sources:[],fetched:{}}),read:async url=>{calls.push(url);if(url===PNA)return row();throw Error('sin fuente')}});
 assert.equal(calls.filter(x=>x===PNA).length,1);assert.ok(!calls.some(x=>/rioalert/.test(x)));assert.equal(r.stations[0].value,5.47);assert.ok(r.stations[0].alternatives.some(x=>x.value===5.39));assert.equal(r.checkedAt,now.toISOString());
});
test('Una falla de PNA mantiene la lectura válida anterior con antigüedad',async()=>{
 const r=await buildReport({now:new Date('2026-11-16T23:30:00Z'),base:async()=>({stations:[ina],sources:[],fetched:{}}),read:async()=>{throw Error('sin fuente')}});
 const s=r.stations.find(x=>x.station===ina.station);assert.equal(s.value,5.47);assert.equal(s.retained,true);assert.equal(s.stale,true);assert.equal(s.observedAt,'2026-11-12T23:00:00.000Z');
});
test('INA descarta series ajenas, pronósticos y fechas futuras sin perder la lectura válida',()=>{
 const raw={series:[{series_id:99,observaciones:[{valor:9,timestart:'2026-11-12T20:00:00Z'}]},{series_id:30,observaciones:[{valor:5.4,timestart:'2026-11-12T18:00:00Z'},{valor:9,timestart:'2026-11-15T18:00:00Z'},{valor:8,timestart:'2026-11-12T19:00:00'}],pronosticos:[{valor:9,timestart:'2026-11-12T20:00:00Z'}]}]};
 const r=parseObservations(raw,'Paraná','Santa Fe (Puerto)',SOURCES.inaSF,now);assert.equal(r.value,5.4);assert.equal(r.history.length,1);
});
test('Histórico FICH comprueba la estación y respeta la fecha argentina después de las 21 h',()=>{
 const html='<h2>Estación: Santo Tomé</h2><table><tr>'+['12/11/2026','22:26','5,41','0,14','','5,27'].map(c=>'<td>'+c+'</td>').join('')+'</tr></table>';
 const r=parseFichHistory(html,'Santo Tomé',SOURCES.fichSantoTome);assert.equal(r.observedAt,'2026-11-13T01:26:00.000Z');assert.equal(parseFichHistory(html,'Recreo · Ruta 70',SOURCES.fichRecreo),null);
});
test('El respaldo INA conserva umbrales aunque la alternativa de API no los incluya',async()=>{
 const station={...ina,alternatives:[{...ina,alertThreshold:null,evacuationThreshold:null}]};
 const r=await buildReport({now:new Date('2026-11-12T04:00:00Z'),base:async()=>({stations:[station],sources:[],fetched:{}}),read:async()=>{throw Error('sin fuente')}});
 const s=r.stations.find(x=>x.station===ina.station);assert.equal(s.alertThreshold,5.3);assert.equal(s.evacuationThreshold,5.7);
});
