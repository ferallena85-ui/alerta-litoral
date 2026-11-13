#!/usr/bin/env node
'use strict';
// Ejecutar con Node >=20 desde la carpeta del proyecto, después de aplicar el parche.
const path=require('node:path');
(async()=>{
 const {buildReport}=require(path.join(process.cwd(),'api/reporte.js'));
 const r=await buildReport({now:new Date()});
 const keys=['Paraná|Santa Fe (Puerto)','Salado|Santo Tomé','Salado|Recreo · Ruta 70'];
 console.log('\nALERTA LITORAL — DIAGNÓSTICO DE LECTURAS LOCALES');
 console.log('Consulta del backend:',r.checkedAt);
 console.table(keys.map(key=>{
  const s=r.stations?.find(x=>x.river+'|'+x.station===key);
  return {estacion:key,altura_m:s?.value??'SIN DATO',observada:s?.observedAt??'sin hora',parte:s?.reportedOn??'-',fuente:s?.source??'-',antiguedad_h:s?.ageHours?.toFixed(1)??'-'};
 }));
 console.log('DIAGNÓSTICO DE FUENTES (la recepción HTTP sola no implica lectura válida):');
 console.table((r.sourceChecks||[]).filter(s=>/INA diario|INA API Santa Fe|FICH-UNL · Paraná|Prefectura|FICH histórico|FICH-UNL Salado/i.test(s.name)).map(s=>({fuente:s.name,valida:s.ok,lecturas:s.records??'-',resultado:String(s.detail||s.category||'-').slice(0,120)})));
 const p=r.stations?.find(x=>x.river==='Paraná'&&x.station==='Santa Fe (Puerto)');
 if(!p){console.error('FALLO: no hay medición Paraná válida.');process.exitCode=1;}
 else if(p.ageHours>48){console.warn('ATENCIÓN: el Paraná tiene más de 48 horas de antigüedad.');process.exitCode=2;}
 else console.log('El backend muestra una lectura Paraná fechada: ',p.value,'m. Confirmar que la UI refleje este mismo valor.');
})().catch(e=>{console.error('ERROR EN DIAGNÓSTICO:',e?.stack||e);process.exitCode=1});
