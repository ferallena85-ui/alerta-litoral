#!/usr/bin/env node
'use strict';
/**
 * Parche reproducible de Alerta Litoral, basado en main del 13/11/2026.
 * No publica ni ejecuta git push. `node aplicar_ajuste_alturas.js --check` valida.
 * `node aplicar_ajuste_alturas.js --apply` respalda y modifica los archivos.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const apply=process.argv.includes('--apply');
const expected=['lib/reports.cjs','api/reporte.js','app.js','index.html','tests/reports.test.cjs'];
const original=new Map();
const revised=new Map();
for(const f of expected){
  const full=path.join(root,f);
  if(!fs.existsSync(full))throw Error('No encuentro '+f+'; ejecutá esto en la raíz del proyecto alerta-litoral.');
  original.set(f,fs.readFileSync(full,'utf8'));
  revised.set(f,original.get(f));
}
function patch(file,from,to,label){
  const s=revised.get(file);
  const matches=s.split(from).length-1;
  if(matches!==1)throw Error(`El archivo ${file} cambió: esperaba una sola coincidencia (${label}), encontré ${matches}. No se modificó ningún archivo.`);
  revised.set(file,s.replace(from,to));
}

// 1) Incorporar el parte diario de FICH-UNL que republica la tabla de Prefectura.
patch('lib/reports.cjs',
  "  fichSalado: 'https://cim.fich.unl.edu.ar/rios/salado/alturas',",
  "  fichSalado: 'https://cim.fich.unl.edu.ar/rios/salado/alturas',\n  fichParana: 'https://cim.fich.unl.edu.ar/rios/parana/alturas',",
  'nueva fuente FICH Paraná');
const parser=`// FICH-UNL publica el parte de la cuenca del Paraná con datos atribuidos a Prefectura.
// Tiene FECHA del parte, pero NO hora de observación individual; jamás inventar la hora.
function parseFichParana(html){
 const text=strip(html);
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 const m=text.match(/\\b(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+de\\s+(20\\d{2})\\b/i);
 if(!m)return null;
 const reportedOn=m[3]+'-'+String(months.indexOf(m[2].toLowerCase())+1).padStart(2,'0')+'-'+m[1].padStart(2,'0');
 for(const c of rows(html)){
  if(c.length<8||!/^Santa Fe$/i.test(c[0])||!/^Paran[aá]$/i.test(c[1]))continue;
  const value=num(c[2]),previous=num(c[5]),alert=num(c[6]),evacuation=num(c[7]);
  if(value===null)return null;
  const diff=Number(String(c[3]).trim().replace(',','.'));
  const trend=Number.isFinite(diff)?diff>0?'crece':diff<0?'baja':'estable':previous!==null?value>previous?'crece':value<previous?'baja':'estable':null;
  return {river:'Paraná',station:'Santa Fe (Puerto)',value,previous,trend,
   observedAt:null,reportedOn,source:SOURCES.fichParana,
   sourceName:'FICH-UNL · parte Paraná (datos de Prefectura)',
   alertThreshold:alert,evacuationThreshold:evacuation,
   kind:'observed',periodDescription:'Parte diario; hora individual no informada'};
 }
 return null;
}
`;
patch('lib/reports.cjs','function parseFichHistory(html,station,source){',parser+'function parseFichHistory(html,station,source){','lector del parte Paraná');
// La fecha de edición de un parte no representa una observación a las 12:00.
// Si los dos registros pertenecen al mismo día local, preferir el fechado por hora.
patch('lib/reports.cjs',
`function latestRecord(a,b){
 if(!a)return b||null;if(!b)return a;
 const aTime=recordTimestamp(a),bTime=recordTimestamp(b);
 if(!Number.isFinite(aTime))return Number.isFinite(bTime)?b:a;
 if(!Number.isFinite(bTime))return a;
 return bTime>aTime?b:a;
}`,
`function localObservationDay(s){
 if(!s)return null;
 if(!s.observedAt)return s.reportedOn||null;
 const date=new Date(s.observedAt);
 if(Number.isNaN(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return map.year+'-'+map.month+'-'+map.day;
}
function latestRecord(a,b){
 if(!a)return b||null;if(!b)return a;
 const aDay=localObservationDay(a),bDay=localObservationDay(b);
 if(aDay&&aDay===bDay&&Boolean(a.observedAt)!==Boolean(b.observedAt))return a.observedAt?a:b;
 const aTime=recordTimestamp(a),bTime=recordTimestamp(b);
 if(!Number.isFinite(aTime))return Number.isFinite(bTime)?b:a;
 if(!Number.isFinite(bTime))return a;
 return bTime>aTime?b:a;
}`,'evitar que parte sin hora tape observación');
patch('lib/reports.cjs',
"  'INA mapa':stations.length,",
"  'INA diario':daily.santaFe?1:0,\n  'INA mapa':stations.length,\n  'INA API Santa Fe':apiParana?1:0,",
'registrar cuántas lecturas reales devuelve INA Paraná');
patch('lib/reports.cjs',
'Se actualiza el contenido al vencer la cach\\u00e9 de ocho horas y recibir una visita.',
'El reporte se consulta peri\u00f3dicamente; cada fuente publica observaciones seg\u00fan sus propios horarios.',
'corregir el aviso de caché incorrecto');
patch('lib/reports.cjs','parseFichSalado,parseFichHistory,','parseFichSalado,parseFichParana,parseFichHistory,','exportar parser Paraná');

// 2) Incorporar la nueva fuente a la agregación, sin eliminar INA/PNA.
patch('api/reporte.js',
'collect,parseFichSalado,parseFichHistory,SOURCES,',
'collect,parseFichSalado,parseFichParana,parseFichHistory,SOURCES,',
'importación del parser');
patch('api/reporte.js',
'read(SOURCES.fichSantoTome),read(SOURCES.fichRecreo)]);',
'read(SOURCES.fichSantoTome),read(SOURCES.fichRecreo),read(SOURCES.fichParana)]);',
'consultar FICH Paraná en paralelo');
patch('api/reporte.js',
' const pnaResult=results[3].status',
` const fichParanaResponse=results[6];
 let fichParana=null;
 let fichParanaDetail='No disponible';
 if(fichParanaResponse.status==='fulfilled'){
  try{
   const parsed=parseFichParana(fichParanaResponse.value);
   if(valid(parsed,now)){fichParana=parsed;fichParanaDetail='Parte diario con fecha válida; hora individual de observación no publicada';}
   else fichParanaDetail='Respuesta recibida sin parte vigente interpretable para Santa Fe / Paraná';
  }catch(e){fichParanaDetail='Error de interpretación: '+String(e.message||e).slice(0,120);}
 }else fichParanaDetail='Error de consulta: '+String(fichParanaResponse.reason?.message||'Sin conexión').slice(0,120);
 r.sourceChecks.push({name:'FICH-UNL · Paraná (datos Prefectura)',ok:!!fichParana,records:fichParana?1:0,detail:fichParanaDetail});
 if(fichParana){r.sources.push({name:'FICH-UNL · parte del Paraná con datos de Prefectura',url:SOURCES.fichParana});r.fetched.fichParana=true;}
 const pnaResult=results[3].status`,
'seleccionar parte verificable');
patch('api/reporte.js',
'candidates.push(...(r.stations||[]));if(pna)candidates.push(pna);',
'candidates.push(...(r.stations||[]));if(pna)candidates.push(pna);if(fichParana)candidates.push(thresholds(fichParana));',
'incluir candidato FICH en el selector');
patch('api/reporte.js',
"'public, max-age=0, s-maxage=900, stale-while-revalidate=60'",
"'public, max-age=0, s-maxage=60, stale-while-revalidate=30'",
'acortar caché HTTP de 15 a 1 minuto');

// 3) Evitar cache de navegador del reporte de alturas, y acelerar la consulta de pantalla.
patch('app.js',
"fetch('/api/reporte?version=hydrometry-v4',{headers:{Accept:'application/json'}})",
"fetch('/api/reporte?version=hydrometry-v5-fich',{headers:{Accept:'application/json'},cache:'no-store'})",
'solicitud frontend sin caché local');
patch('index.html',
'const FIVE_MIN=5*60*1000;',
'const REFRESH_INTERVAL_MS=60*1000;',
'intervalo de actualización de pantalla');
patch('index.html','setInterval(refreshIfDue,FIVE_MIN)','setInterval(refreshIfDue,REFRESH_INTERVAL_MS)','temporizador');
patch('index.html','Date.now()-lastCheck>=FIVE_MIN','Date.now()-lastCheck>=REFRESH_INTERVAL_MS','reanudación al abrir la app');
patch('index.html',
'Consulta automática cada 5 minutos mientras la app esté abierta; las alturas pueden tener hasta 15 minutos de caché.',
'Consulta automática aproximadamente cada minuto mientras la app está abierta. Las alturas cambian solo cuando se publica una observación nueva.',
'aclarar frecuencia de consultas y observaciones');

// 4) Pruebas específicas de regresión para el valor de FICH y la fecha sin hora.
patch('tests/reports.test.cjs',
'parseFichSalado,parseFichHistory,',
'parseFichSalado,parseFichParana,parseFichHistory,',
'importar nueva prueba');
const tests=`
const fichParanaHoy=\`<h3>Viernes, 13 de noviembre de 2026</h3><table>
<tr><th>Puerto</th><th>Río</th><th>Altura</th><th>Variación</th><th>Cambio</th><th>Alt. Ant.</th><th>Alerta</th><th>Evacuación</th></tr>
<tr><td>Paraná</td><td>Paraná</td><td>5,57</td><td>0,09</td><td>Crece</td><td>5,48</td><td>4,70</td><td>5,00</td></tr>
<tr><td>Santa Fe</td><td>Paraná</td><td>5,50</td><td>0,11</td><td>Crece</td><td>5,39</td><td>5,30</td><td>5,70</td></tr>
<tr><td>San Javier (Santa Fe)</td><td>San Javier</td><td>7,98</td><td>0,01</td><td>Crece</td><td>7,97</td><td>6,00</td><td>6,50</td></tr>
</table>\`;
test('FICH Paraná: lectura Santa Fe 5,50, no ciudad Paraná ni San Javier',()=>{
 const p=parseFichParana(fichParanaHoy);
 assert.equal(p.value,5.50);assert.equal(p.previous,5.39);
 assert.equal(p.reportedOn,'2026-11-13');assert.equal(p.observedAt,null);
 assert.equal(p.alertThreshold,5.3);assert.equal(p.evacuationThreshold,5.7);
 assert.equal(p.trend,'crece');
});
test('FICH Paraná: no inventar fecha si falta encabezado del parte',()=>{
 assert.equal(parseFichParana('<table><tr><td>Santa Fe</td><td>Paraná</td><td>5,50</td><td>0,11</td><td>Crece</td><td>5,39</td><td>5,30</td><td>5,70</td></tr></table>'),null);
});
test('Un dato INA con hora verificada del mismo día prevalece sobre parte diario sin hora',()=>{
 const part=parseFichParana(fichParanaHoy);
 const point={river:'Paraná',station:'Santa Fe (Puerto)',value:5.52,observedAt:'2026-11-13T10:00:00Z'};
 assert.equal(latestRecord(part,point).value,5.52);
 assert.equal(latestRecord(point,part).value,5.52);
});
`;
revised.set('tests/reports.test.cjs',revised.get('tests/reports.test.cjs')+tests);

const integration=`'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildReport}=require('../api/reporte.js');
const {SOURCES}=require('../lib/reports.cjs');
const html=\`<h3>Viernes, 13 de noviembre de 2026</h3><table><tr>
<th>Puerto</th><th>Río</th><th>Altura</th><th>Variación</th><th>Cambio</th><th>Alt. Ant.</th><th>Alerta</th><th>Evacuación</th></tr>
<tr><td>Santa Fe</td><td>Paraná</td><td>5,50</td><td>0,11</td><td>Crece</td><td>5,39</td><td>5,30</td><td>5,70</td></tr></table>\`;
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
`;
const newTest='tests/parana-fich-integration.test.cjs';
if(fs.existsSync(path.join(root,newTest)))throw Error('Ya existe '+newTest+'; no sobrescribo pruebas ajenas.');
revised.set(newTest,integration);

// Confirmación previa: nunca tocar archivos si el esquema local difiere del verificado.
for(const [f,s] of revised){if(!s||typeof s!=='string')throw Error('Contenido inválido para '+f)}
if(!apply){
 console.log('REVISIÓN OK. Archivos que se modificarían:');
 for(const f of revised.keys())console.log(' - '+f);
 console.log('No se escribieron cambios. Ejecutá con --apply para aplicar y luego npm test.');
 process.exit(0);
}
const backups=fs.existsSync(path.join(root,'.git'))?path.join(root,'.git','backups-hidrometria-20261113'):path.join(root,'.backup-hidrometria-20261113');
fs.mkdirSync(backups,{recursive:true});
for(const [f] of original){const backup=path.join(backups,f);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,original.get(f),'utf8');}
for(const [f,s] of revised){const output=path.join(root,f);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,s,'utf8');}
console.log('Corrección aplicada en archivos locales. Respaldos: '+backups);
console.log('Ahora ejecutá: npm test');
console.log('Después: npm run dev, y verificá /api/reporte y las tres estaciones.');
console.log('No se hizo push ni despliegue en producción.');
