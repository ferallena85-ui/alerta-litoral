'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {parseHTML}=require('linkedom');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function setup(){
 const {window}=parseHTML(html);let offline=false;let calls=0;
 const payload={version:1,checkedAt:new Date().toISOString(),status:'partial_or_available',stations:[{river:'Paraná',station:'Santa Fe (Puerto)',value:5.48,source:'https://contenidosweb.prefecturanaval.gob.ar/alturas/',observedAt:new Date().toISOString(),trend:'crece',previous:5.47,alertThreshold:5.3,evacuationThreshold:5.7}],sources:[],sourceChecks:[],fetched:{},news:[]};
 const storage=new Map();const context=vm.createContext({document:window.document,window,navigator:{userAgent:'test',platform:'test'},location:{protocol:'http:',origin:'http://localhost:3000'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Intl,Date,URL,console,fetch:async()=>{calls++;if(offline)throw Error('sin conexión');return {ok:true,json:async()=>structuredClone(payload)}}});
 for(const file of ['app.js','hydro.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context,{filename:file});
 return {window,context,payload,calls:()=>calls,offline:()=>{offline=true}};
}
test('Portada conserva introducción, orden, tres estaciones y desplegables iniciales',async()=>{
 const {window,context}=setup();await vm.runInContext('loadReport()',context);const d=window.document;
 assert.match(d.querySelector('.hero').textContent,/MONITOREO CIUDADANO/);assert.match(d.querySelector('.hero').textContent,/independiente y no oficial/);
 const children=[...d.querySelector('main').children];assert.ok(children.indexOf(d.querySelector('.hero'))<children.indexOf(d.querySelector('.river-summary')));assert.ok(children.indexOf(d.querySelector('.river-summary'))<children.indexOf(d.querySelector('.emergency-panel')));assert.ok(children.indexOf(d.querySelector('.emergency-panel'))<children.indexOf(d.querySelector('.status-strip')));
 assert.equal(d.querySelectorAll('#riverSummary article').length,3);assert.match(d.querySelector('#riverSummary').textContent,/Recreo \(Ruta 70\)/);assert.doesNotMatch(d.querySelector('#riverSummary').textContent,/Coronda/);
 assert.equal(d.querySelector('#hidrica .card-toggle').getAttribute('aria-expanded'),'true');assert.equal(d.querySelector('#hidricaDetail').hidden,false);assert.equal(d.querySelector('#reporteDetail').hidden,true);assert.equal(d.querySelector('.emergency-panel').hasAttribute('open'),false);
 assert.match(d.querySelector('#riverSummary').textContent,/5,48 m/);assert.equal(d.querySelectorAll('.emergency-content a').length,3);
});
test('Pestañas y tarjetas funcionan sin nuevas solicitudes',async()=>{
 const {window,context,calls}=setup();await vm.runInContext('loadReport()',context);const d=window.document,before=calls();
 d.querySelector('#tab-sources').click();assert.equal(d.querySelector('#panel-current').hidden,true);assert.equal(d.querySelector('#panel-sources').hidden,false);assert.equal(calls(),before);
 d.querySelector('#tab-forecast').click();assert.equal(d.querySelector('#panel-forecast').hidden,false);assert.match(d.querySelector('#panel-forecast').textContent,/No se pudo recuperar/);
 d.querySelector('#nino .card-toggle').click();assert.equal(d.querySelector('#ninoDetail').hidden,false);
});
test('Falla de actualización mantiene altura, fuente y fecha, con advertencia',async()=>{
 const {window,context,offline}=setup();await vm.runInContext('loadReport()',context);offline();await vm.runInContext('loadReport()',context);
 const d=window.document;assert.match(d.querySelector('#riverSummary').textContent,/5,48 m/);assert.match(d.querySelector('#riverSummary').textContent,/conservada/);assert.match(d.querySelector('#statusBadge').textContent,/Sin conexión/);assert.match(d.querySelector('#checkedAt').textContent,/última consulta exitosa/);assert.equal(d.querySelector('#refreshBtn').disabled,false);
});
