/* Sénégal Immersif — mode hors connexion */
const CACHE = "senegal-immersif-v1";

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(["./","./index.html"]).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(req, ms){
  const cache = await caches.open(CACHE);
  try{
    const r = await Promise.race([
      fetch(req),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms))
    ]);
    if(r && r.ok) cache.put(req, r.clone());
    return r;
  }catch(err){
    const hit = await cache.match(req);
    if(hit) return hit;
    throw err;
  }
}

async function cacheFirstImage(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url);
  if(hit) return hit;
  try{
    const r = await fetch(req.url, {mode:"cors", credentials:"omit"});
    if(r && r.ok) cache.put(req.url, r.clone());
    return r;
  }catch(err){
    return fetch(req);
  }
}

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const u = new URL(req.url);
  if(u.origin === self.location.origin){
    e.respondWith(
      networkFirst(req, 4000).catch(async ()=>{
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      })
    );
  }else if(u.hostname === "upload.wikimedia.org"){
    e.respondWith(cacheFirstImage(req));
  }else if(u.hostname === "fr.wikipedia.org" || u.hostname.indexOf("githubusercontent.com")!==-1 || u.hostname === "github.com" || u.hostname.indexOf("geoboundaries")!==-1){
    e.respondWith(networkFirst(req, 7000));
  }
});
