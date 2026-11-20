// Registrace service workeru (sw.js) a nabídka „Je dostupná nová verze – načíst“.
//
// Jak aktualizace funguje:
//   1. Prohlížeč při otevření aplikace zkontroluje, jestli se sw.js změnil
//      (změna = zvýšené CACHE_VERZE).
//   2. Nový service worker stáhne nové soubory a čeká („waiting“).
//   3. Aplikace ukáže lištu s nabídkou. Po kliknutí pošle novému service workeru
//      zprávu, ten se aktivuje a stránka se znovu načte s novými soubory.

const aktualizaceEl = document.getElementById("aktualizace");

// True až po kliknutí na „načíst“ – jen tehdy se má stránka po výměně verze znovu načíst
// (při úplně první instalaci service worker také převezme řízení, ale tam načítat nechceme)
let aktualizaceVyzadana = false;

// Ukáže lištu s nabídkou; kliknutí aktivuje čekající verzi
function nabidniAktualizaci(cekajici) {
  aktualizaceEl.hidden = false;
  aktualizaceEl.onclick = function () {
    aktualizaceVyzadana = true;
    aktualizaceEl.disabled = true;
    cekajici.postMessage({ typ: "aktivovat" });
  };
}

if ("serviceWorker" in navigator) {
  // Když nová verze převezme řízení po kliknutí na „načíst“, načteme stránku znovu (jen jednou)
  let uzNacitam = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!aktualizaceVyzadana || uzNacitam) return;
    uzNacitam = true;
    location.reload();
  });

  navigator.serviceWorker
    .register("sw.js")
    .then(function (registrace) {
      // Nová verze už čeká (stáhla se při minulé návštěvě)
      if (registrace.waiting && navigator.serviceWorker.controller) {
        nabidniAktualizaci(registrace.waiting);
      }

      // Nová verze se právě stahuje – počkáme, až bude připravená
      registrace.addEventListener("updatefound", function () {
        const nova = registrace.installing;
        nova.addEventListener("statechange", function () {
          // "installed" + existující controller = aktualizace (ne úplně první instalace)
          if (nova.state === "installed" && navigator.serviceWorker.controller) {
            nabidniAktualizaci(nova);
          }
        });
      });
    })
    .catch(function (chyba) {
      // Např. otevření přes adresu, kde service worker nejde (ne localhost ani https)
      console.error("Service worker se nepodařilo zaregistrovat:", chyba);
    });
}
