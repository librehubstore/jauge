// Service worker Jauge : consultation hors ligne (dernière recherche, carte, favoris) et notifications push.
const VERSION = "v1";
const APP = `jauge-app-${VERSION}`;
const TILES = `jauge-tiles-${VERSION}`;
const LAST_STATIONS = "/__jauge/last-stations";
const OFFLINE_PAGES = ["/", "/favorites"];
const MAX_TILES = 1500;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (![APP, TILES].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

/** Copie une réponse en y ajoutant la date de mise en cache. */
async function stamp(res) {
  const headers = new Headers(res.headers);
  headers.set("x-jauge-cached-at", new Date().toISOString());
  return new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Ressources statiques versionnées de Next : cache d'abord.
  if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(APP).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }

  // Dernière recherche de stations : réseau d'abord, sinon la dernière réponse connue, marquée hors ligne.
  if (url.origin === location.origin && url.pathname === "/api/stations") {
    event.respondWith((async () => {
      const c = await caches.open(APP);
      try {
        const res = await fetch(req);
        if (res.ok) {
          const s = await stamp(res);
          await c.put(req, s.clone());
          await c.put(LAST_STATIONS, s.clone());
        }
        return res;
      } catch {
        const hit = (await c.match(req)) ?? (await c.match(LAST_STATIONS));
        if (!hit) return Response.json({ error: "OFFLINE" }, { status: 503 });
        const headers = new Headers(hit.headers);
        headers.set("x-jauge-offline", hit.headers.get("x-jauge-cached-at") ?? "");
        return new Response(await hit.blob(), { status: 200, headers });
      }
    })());
    return;
  }

  // Pages carte et favoris : réseau d'abord, copie hors ligne de la dernière version.
  if (req.mode === "navigate" && url.origin === location.origin && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith((async () => {
      const c = await caches.open(APP);
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) await c.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await c.match(url.pathname)) ?? (await c.match("/")) ?? Response.error();
      }
    })());
    return;
  }

  // Tuiles et styles de carte : cache d'abord (borné).
  if (url.hostname === "tiles.openfreemap.org") {
    event.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { await c.put(req, res.clone()); trim(TILES, MAX_TILES); }
      return res;
    }));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Jauge", body: "" };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", data: { url: data.url ?? "/" } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window" })) {
      if ("focus" in c) { await c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
