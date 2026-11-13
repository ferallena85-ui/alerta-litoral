'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createPnaClient,requestHtml,errorInfo,TTL_MS,PNA}=require('../lib/prefectura.cjs');
const {parsePna}=require('../lib/hydrometry.cjs');
const date=Date.parse('2026-11-13T02:00:00Z');
const labels={'Puerto:':'SANTA FE','Río:':'PARANA','Ultimo Registro:':'5.48',Variacion:'0.01',Periodo:'2','Fecha Hora:':'12/NOV/26 - 2200','Estado:':'ALERTA CRECE','Registro Anterior:':'5.47','Fecha Anterior:':'12/NOV/26 - 2000','Alerta:':'5.30','Evacuación:':'5.70'};
const html=(cells=labels)=>'<table><tr>'+Object.entries(cells).reverse().map(([label,text])=>'<td data-label="'+label+'">'+text+'</td>').join('')+'</tr></table>';
const response=()=>({html:html(),httpStatus:200,elapsedMs:5,finalUrl:PNA});
const shared=()=>{const values=new Map();return {get:async key=>values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))}};
test('Tabla etiquetada: orden de columnas independiente, variación real y umbrales con fuente PNA',()=>{
 const s=parsePna(html(),new Date(date));assert.equal(s.value,5.48);assert.equal(s.variationCm,1);assert.equal(s.variationPeriodHours,2);assert.equal(s.reportedPeriodHours,2);assert.equal(s.sourceState,'ALERTA CRECE');assert.equal(s.thresholdSource,PNA);assert.deepEqual(s.qualityWarnings,[]);
 const conflict=parsePna(html({...labels,Periodo:'24',Variacion:'0.14'}),new Date(date));assert.equal(conflict.variationPeriodHours,2);assert.equal(conflict.variationCm,1);assert.equal(conflict.qualityWarnings.length,2);
});
test('Solicitudes simultáneas y recargas sucesivas comparten una consulta durante 15 minutos',async()=>{
 let clock=date,calls=0;const client=createPnaClient({now:()=>clock,request:async()=>{calls++;return response()}});
 const first=await Promise.all(Array.from({length:20},()=>client.get()));assert.equal(calls,1);assert.ok(first.every(s=>s.reading.value===5.48));
 const cached=await client.get();assert.equal(cached.diagnostic.cacheHit,true);assert.equal(calls,1);assert.equal(cached.diagnostic.sourceCheckedAt,new Date(date).toISOString());
 clock+=TTL_MS+1;await client.get();assert.equal(calls,2);
});
test('Dos instancias reutilizan el snapshot compartido sin volver a consultar Prefectura',async()=>{
 const store=shared();let calls=0;const options={store,now:()=>date,request:async()=>{calls++;return response()}};
 await createPnaClient(options).get();const next=await createPnaClient(options).get();assert.equal(calls,1);assert.equal(next.diagnostic.cacheMode,'shared');assert.equal(next.diagnostic.cacheHit,true);
});
test('Las fallas HTTP se cachean sin reintentos por usuario',async()=>{
 let calls=0;const client=createPnaClient({now:()=>date,request:async()=>{calls++;throw Object.assign(Error('HTTP 403'),{category:'http',diagnostic:{category:'http',httpStatus:403}})}});
 const a=await client.get(),b=await client.get();assert.equal(calls,1);assert.equal(a.reading,null);assert.equal(a.diagnostic.httpStatus,403);assert.equal(a.diagnostic.category,'http');assert.equal(b.diagnostic.cacheHit,true);
});
test('Último dato válido compartido conserva fecha cuando una nueva consulta falla',async()=>{
 let clock=date;const store=shared();await createPnaClient({store,now:()=>clock,request:async()=>response()}).get();clock+=TTL_MS+1;
 const failed=await createPnaClient({store,now:()=>clock,request:async()=>{throw Object.assign(Error('Espera agotada'),{name:'TimeoutError'})}}).get();
 assert.equal(failed.reading.value,5.48);assert.equal(failed.reading.retained,true);assert.equal(failed.reading.observedAt,'2026-11-13T01:00:00.000Z');assert.equal(failed.diagnostic.ok,false);assert.equal(failed.diagnostic.category,'timeout');
});
test('Si falla el caché compartido no se genera una consulta oficial por visitante',async()=>{
 let calls=0;const client=createPnaClient({store:{get:async()=>{throw Error('Cache no disponible')}},now:()=>date,request:async()=>{calls++;return response()}});
 assert.equal((await client.get()).diagnostic.category,'cache_unavailable');await client.get();assert.equal(calls,0);
});
test('Diagnóstico distingue HTTP, timeout, DNS, permisos y parsing',async()=>{
 await assert.rejects(requestHtml(PNA,{fetcher:async()=>({ok:false,status:404})}),e=>e.diagnostic.httpStatus===404&&e.diagnostic.category==='http'&&e.diagnostic.stage==='response_headers');
 await assert.rejects(requestHtml(PNA,{fetcher:async()=>{throw Object.assign(Error('límite alcanzado'),{name:'TimeoutError'})}}),e=>e.diagnostic.category==='timeout'&&e.diagnostic.httpStatus===null);
 assert.equal(errorInfo({cause:{code:'ENOTFOUND'}}).category,'dns');assert.equal(errorInfo({cause:{code:'EACCES'}}).category,'environment_access');
 const client=createPnaClient({now:()=>date,request:async()=>({html:'<table><tr><td>Otro puerto</td></tr></table>',httpStatus:200})});const r=await client.get();assert.equal(r.diagnostic.category,'parse');assert.equal(r.diagnostic.httpStatus,200);assert.equal(r.reading,null);
});
