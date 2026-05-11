const CACHE_NAME = "aether-v1";

// core shell
const STATIC_ASSETS = [
  "/Aether-wether/",
  "/Aether-wether/index.html",
  "/Aether-wether/style.css",
  "/Aether-wether/app.js"
];

// install
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// activate
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => k !== CACHE_NAME && caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch logic
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // weather API → network first
  if (url.includes("weather")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // static → cache first
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});

// network-first strategy
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);

    // clone & store
    const clone = fresh.clone();
    const data = await clone.json();

    // send to page
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: "SAVE_WEATHER",
        payload: data
      });
    });

    return fresh;

  } catch (err) {
    // offline fallback
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: "OFFLINE" });
    });

    return new Response(
      JSON.stringify({ offline: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}

