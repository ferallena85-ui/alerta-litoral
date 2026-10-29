'use strict';
const {collect} = require('../lib/reports.cjs');
module.exports = async function handler(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end('Método no permitido')}
 try{
   const report=await collect();
   // CDN Vercel: la siguiente solicitud tras las 8 horas obtiene una revisión nueva.
   res.setHeader('Content-Type','application/json; charset=utf-8');
   res.setHeader('Cache-Control',report.status==='unavailable'?'public, max-age=0, s-maxage=300':'public, max-age=0, s-maxage=28800, stale-while-revalidate=60');
   res.setHeader('X-Content-Type-Options','nosniff');
   return res.status(200).json(report);
 }catch(e){
   res.setHeader('Cache-Control','no-store');
   return res.status(503).json({status:'unavailable',message:'No fue posible consultar las fuentes ahora. No se muestran alturas no verificadas.'});
 }
};
