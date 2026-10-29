// Solo para previsualización local. Production: Vercel despliega /api/reporte.js automáticamente.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=process.env.PORT||3000;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
 if(req.url?.startsWith('/api/reporte')){
  res.status=(code)=>{res.statusCode=code;return {json:(body)=>res.end(JSON.stringify(body))}};
  res.json=(body)=>res.end(JSON.stringify(body));
  return require('./api/reporte.js')(req,res);
 }
 const filename=path.resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.statusCode=404;return res.end('404')}
 res.setHeader('Content-Type',(mime[path.extname(filename)]||'text/plain')+'; charset=utf-8');fs.createReadStream(filename).pipe(res)
}).listen(port,()=>console.log(`Alerta Litoral http://localhost:${port}`));
