// Service worker: uloží soubory aplikace do mezipaměti (cache), aby fungovala offline.
//
// DŮLEŽITÉ: při každé změně souborů aplikace (HTML, CSS, JS, data, ikony, manifest)
// zvyšte CACHE_VERZE. Jinak telefon dál používá staré soubory z mezipaměti
// a o nové verzi se nedozví.
const CACHE_VERZE = 13;
const CACHE_NAZEV = "zbrojak-v" + CACHE_VERZE;

// Soubory aplikace. Nepatří sem data/zdroj (PDF) ani nastroje (skripty v Pythonu).
// Doplní se automaticky (viz install):
//   - obrázky k otázkám podle data/otazky.json,
//   - kapitoly knihy podle kniha/kapitoly.json a obrázky, které kapitoly používají.
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
  "kniha.js",
  "manifest.json",
  "ikony/ikona-192.png",
  "ikony/ikona-512.png",
  "ikony/ikona-maskable-192.png",
  "ikony/ikona-maskable-512.png",
  "data/otazky.json",
  "data/pravidla.json",
  "kniha/kapitoly.json",
];

// Obrázek v textu knihy: ![popisek](../data/obrazky/656.jpg) – cesta je relativní ke složce kniha/
const VZOR_OBRAZKU_KNIHY = /!\[[^\]]*\]\(\.\.\/(data\/obrazky\/[^)\s]+)\)/g;

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

      // Kapitoly knihy: seznam souborů vezmeme z uložené kniha/kapitoly.json
      const knihaOdpoved = await cache.match("kniha/kapitoly.json");
      const kniha = await knihaOdpoved.json();
      const kapitoly = kniha.kapitoly.map(function (k) {
        return "kniha/" + k.soubor;
      });
      await cache.addAll(kapitoly);

      // Obrázky z knihy: většina je zároveň u otázek, ale kdyby kniha použila jiný,
      // najdeme ho přímo v textu kapitol (Set zajistí, že se nic nestáhne dvakrát)
      for (const kapitola of kapitoly) {
        const text = await (await cache.match(kapitola)).text();
        for (const shoda of text.matchAll(VZOR_OBRAZKU_KNIHY)) {
          obrazky.add(shoda[1]);
        }
      }

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
