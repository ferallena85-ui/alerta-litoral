'use strict';
// Módulo independiente: no modifica las mediciones de los ríos.
const {clean}=require('../lib/reports.cjs');
const FEEDS=[
 {name:'AIRE · Santa Fe',url:'https://www.airedesantafe.com.ar/rss/pages/santa-fe.xml',domain:'airedesantafe.com.ar'},
 {name:'UNO · Último momento',url:'https://www.unosantafe.com.ar/rss/ultimo-momento.xml',domain:'unosantafe.com.ar'}
];
const FICH='https://cim.fich.unl.edu.ar/advertencias';
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function field(item,name){
 const match=String(item).match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)<\\/'+name+'>','i'));
 return match?clean(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')):'';
}
function normalized(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function validUrl(href,domain){
 try{const u=new URL(href);return u.protocol==='https:'&&(u.hostname===domain||u.hostname==='www.'+domain)?u.href:null}catch{return null}
}
function parseRss(xml,feed,now=new Date()){
 const result=[];
 // El área se evalúa en título/descripción; no extrapolar una alerta general desde una noticia.
 const subject=/(crecid|inund|evacu|aneg|hidric|desbord|parana|salado|lluv|torment|alerta meteorolog|precipit|sudestada|defensa civil|canal de desag|temporal)/;
 const place=/(santa fe|santafesin|recreo|santo tome|colastine|alto verde|setubal|salado|parana|costa|sauce viejo|santo domingo|litoral)/;
 for(const item of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const block=item[1],title=field(block,'title').slice(0,210),summary=field(block,'description').slice(0,280);
  const url=validUrl(field(block,'link'),feed.domain);
  const dateText=field(block,'pubDate')||field(block,'dc:date')||field(block,'published');
  const time=Date.parse(dateText),age=(now.getTime()-time)/3600000;
  if(!title||!url||!Number.isFinite(time)||age < -3||age>7*24)continue;
  const match=normalized(title+' '+summary);
  if(!subject.test(match)||!place.test(match))continue;
  result.push({title,summary,publishedAt:new Date(time).toISOString(),url,sourceName:feed.name,kind:'prensa'});
 }
 return result;
}
function parseFichWarning(html,now=new Date()){
 const t=clean(html);
 const m=t.match(/(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*,?\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(20\d\d)/i);
 if(!m)return null;
 const month=MONTHS.indexOf(normalized(m[2]));
 if(month<0)return null;
 const publishedOn=m[3]+'-'+String(month+1).padStart(2,'0')+'-'+m[1].padStart(2,'0');
 const age=(now.getTime()-Date.parse(publishedOn+'T12:00:00-03:00'))/3600000;
 if(age < -14||age>72)return null;
 const p=t.match(/R[ií]o Salado y sus afluentes en el territorio santafesino\s+(.+?)(?:\s+Direcci[oó]n\b|\s+Tel[eé]fono\b|$)/i);
 if(!p||p[1].length<25)return null;
 return {title:'Parte hidrológico del río Salado · '+m[1].padStart(2,'0')+'/'+String(month+1).padStart(2,'0'),
  summary:p[1].slice(0,300),publishedOn,url:FICH,sourceName:'FICH–UNL · Información oficial',kind:'oficial'};
}
async function read(url,accept){
 const response=await fetch(url,{headers:{Accept:accept,'User-Agent':'AlertaLitoral/1.0 (monitor de fuentes publicas)'},signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const value=await response.text();
 if(value.length>1500000)throw Error('Respuesta demasiado extensa');
 if(!value.trim())throw Error('Respuesta vacía');
 return value;
}
async function collectNews({now=new Date(),reader=read}={}){
 const sources=[...FEEDS,{name:'FICH–UNL · Parte hidrológico',url:FICH}];
 const results=await Promise.allSettled(sources.map((s,i)=>reader(s.url,i===2?'text/html':'application/rss+xml, text/xml, */*')));
 const checks=[];const entries=[];
 for(let i=0;i<results.length;i++){
  const r=results[i],source=sources[i];let articles=[];
  if(r.status==='fulfilled'){
   try{if(i===2){const n=parseFichWarning(r.value,now);if(n)articles=[n]}
    else {if(!/<rss\b|<feed\b|<item\b/i.test(r.value))throw Error('No es RSS valido');articles=parseRss(r.value,source,now)};
   }catch(e){checks.push({name:source.name,ok:false,records:0,detail:'Error de lectura: '+String(e.message).slice(0,80)});continue}
   checks.push({name:source.name,ok:true,records:articles.length,detail:articles.length?'Noticias pertinentes interpretadas':'Fuente accesible, sin novedades pertinentes recientes'});
   entries.push(...articles);
  }else checks.push({name:source.name,ok:false,records:0,detail:String(r.reason?.message||'No disponible').slice(0,90)});
 }
 const dedup=new Map();
 for(const n of entries)if(!dedup.has(n.url))dedup.set(n.url,n);
 const news=[...dedup.values()].sort((a,b)=>String(b.publishedAt||b.publishedOn).localeCompare(String(a.publishedAt||a.publishedOn))).slice(0,7);
 return {version:1,checkedAt:now.toISOString(),status:news.length?'available':checks.some(c=>c.ok)?'no_recent_news':'sources_unavailable',news,sourceChecks:checks,
  notice:'Noticias fechadas y enlazadas: los artículos periodísticos no sustituyen las alertas oficiales. Fecha de observación de los ríos se consulta por separado.'};
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({message:'Método no permitido'})}
 try{const data=await collectNews();res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');return res.status(200).json(data)}
 catch(e){res.setHeader('Cache-Control','no-store');return res.status(503).json({version:1,status:'sources_unavailable',news:[],sourceChecks:[]})}
}
module.exports=handler;
module.exports.parseRss=parseRss;
module.exports.parseFichWarning=parseFichWarning;
module.exports.collectNews=collectNews;
