// Service worker: uloží soubory aplikace do mezipaměti (cache), aby fungovala offline.
//
// DŮLEŽITÉ: při každé změně souborů aplikace (HTML, CSS, JS, data, ikony, manifest)
// zvyšte CACHE_VERZE. Jinak telefon dál používá staré soubory z mezipaměti
// a o nové verzi se nedozví.
const CACHE_VERZE = 2;
const CACHE_NAZEV = "zbrojak-v" + CACHE_VERZE;

// Soubory aplikace. Nepatří sem data/zdroj (PDF) ani nastroje (skripty v Pythonu).
// Obrázky k otázkám se doplní automaticky podle data/otazky.json (viz install).
const SOUBORY = [
  "./",
  "index.html",
  "style.css",
  "pokrok.js",
  "app.js",
  "test.js",
  "muj-pokrok.js",
  "pwa.js",
  "posuvnik.js",
  "manifest.json",
  "ikony/ikona-192.png",
  "ikony/ikona-512.png",
  "ikony/ikona-maskable-192.png",
  "ikony/ikona-maskable-512.png",
  "data/otazky.json",
  "data/pravidla.json",
];

// Instalace: stáhneme a uložíme všechny soubory. Když se cokoli nepovede stáhnout,
// instalace selže celá a zůstane platit předchozí verze (žádná napůl uložená aplikace).
self.addEventListener("install", function (udalost) {
  udalost.waitUntil(
    (async function () {
      const cache = await caches.open(CACHE_NAZEV);
      await cache.addAll(SOUBORY);

      // Obrázky: cesty vezmeme z uložených otázek
      const odpoved = await cache.match("data/otazky.json");
      const data = await odpoved.json();
      const obrazky = new Set();
      data.otazky.forEach(function (o) {
        if (o.obrazek) obrazky.add(o.obrazek);
      });
      await cache.addAll(Array.from(obrazky));
    })()
  );
  // Novou verzi neaktivujeme hned – počkáme, až uživatel v aplikaci klikne na „načíst“ (viz message)
});

// Aktivace: smažeme mezipaměti starších verzí
self.addEventListener("activate", function (udalost) {
  udalost.waitUntil(
    (async function () {
      const nazvy = await caches.keys();
      await Promise.all(
        nazvy
          .filter(function (nazev) {
            return nazev.startsWith("zbrojak-") && nazev !== CACHE_NAZEV;
          })
          .map(function (nazev) {
            return caches.delete(nazev);
          })
      );
      await self.clients.claim();
    })()
  );
});

// Stránka pošle zprávu, když uživatel klikne na „Je dostupná nová verze – načíst“
self.addEventListener("message", function (udalost) {
  if (udalost.data && udalost.data.typ === "aktivovat") {
    self.skipWaiting();
  }
});

// Požadavky: nejdřív mezipaměť, když tam soubor není, tak síť.
// ignoreSearch: adresa s ?ladeni=1 najde v mezipaměti stejnou stránku jako bez parametru.
self.addEventListener("fetch", function (udalost) {
  const pozadavek = udalost.request;
  if (pozadavek.method !== "GET" || new URL(pozadavek.url).origin !== self.location.origin) {
    return; // ostatní požadavky necháme prohlížeči
  }
  udalost.respondWith(
    caches.match(pozadavek, { ignoreSearch: true }).then(function (ulozena) {
      return ulozena || fetch(pozadavek);
    })
  );
});
