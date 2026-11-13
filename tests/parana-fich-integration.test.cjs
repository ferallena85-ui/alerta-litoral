'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildReport}=require('../api/reporte.js');
const {SOURCES}=require('../lib/reports.cjs');
const html=`<h3>Viernes, 13 de noviembre de 2026</h3><table><tr>
<th>Puerto</th><th>Río</th><th>Altura</th><th>Variación</th><th>Cambio</th><th>Alt. Ant.</th><th>Alerta</th><th>Evacuación</th></tr>
<tr><td>Santa Fe</td><td>Paraná</td><td>5,50</td><td>0,11</td><td>Crece</td><td>5,39</td><td>5,30</td><td>5,70</td></tr></table>`;
const now=new Date('2026-11-13T15:00:00Z');
test('Parte FICH del 13 reemplaza observación INA del 12 cuando PNA no conecta',async()=>{
 const base=async()=>({version:1,status:'partial_or_available',stations:[{river:'Paraná',station:'Santa Fe (Puerto)',value:5.39,observedAt:'2026-11-12T09:00:00Z',source:'https://alerta.ina.gob.ar/'}],news:[],noteworthy:[],sources:[],fetched:{}});
 const read=async(url)=>url===SOURCES.fichParana?html:'';
 const pnaClient={get:async()=>({reading:null,diagnostic:{ok:false,category:'connect_timeout',detail:'timeout'}})};
 const result=await buildReport({base,read,now,pnaClient});
 const parana=result.stations.find(x=>x.river==='Paraná');
 assert.equal(parana.value,5.50);
 assert.equal(parana.reportedOn,'2026-11-13');
 assert.equal(parana.observedAt,null);
 assert.equal(parana.source,SOURCES.fichParana);
 assert.equal(result.sourceChecks.find(x=>x.name.startsWith('FICH-UNL · Paraná')).ok,true);
});
