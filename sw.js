const CACHE='alerta-litoral-shell-v2';
const files=['/','/index.html','/app.js','/styles.css','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(files)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return; // nunca servir datos hidrológicos cacheados como actuales
 e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
