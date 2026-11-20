// Obrazovka „Můj pokrok“: souhrn, historie cvičných testů, záloha (export/import) a smazání.
//
// Data čte a mění přes funkce z pokrok.js (pokrok, textZalohy, zkontrolujZalohu,
// nahradPokrok, smazPokrok, umimOtazku, jeChyba, POKROK_LADENI).
// Využívá z app.js: vsechnyOtazky, oblasti, verzePdf, ukazObrazovku, slovoOtazek
// a z test.js: zobrazSeriiTestu.

// Krátké názvy typů oprávnění pro řádek v historii
const KRATKE_TYPY = { obecne: "Obecné", rozsirene: "Rozšířené" };

const pokrokSouhrnEl = document.getElementById("pokrok-souhrn");
const pokrokHistorieEl = document.getElementById("pokrok-historie");
const pokrokZpravaEl = document.getElementById("pokrok-zprava");
const pokrokSouborEl = document.getElementById("pokrok-soubor");

// "2026-11-20T17:30:00.000Z" → "20. 11. 2026 18:30" (v místním čase)
function formatDatumu(iso) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Kolik otázek umím a kolik testů je v zadaných datech pokroku (pro porovnání při importu)
function popisPokroku(data) {
  const umim = Object.keys(data.otazky).filter(function (cislo) {
    return data.otazky[cislo].serie >= UMIM_HRANICE;
  }).length;
  return "umím " + umim + " " + slovoOtazek(umim) + ", testů " + data.testy.length;
}

// Ukáže zprávu na obrazovce pokroku (výsledek exportu, importu, smazání)
function zpravaPokroku(text) {
  pokrokZpravaEl.textContent = text;
  pokrokZpravaEl.hidden = !text;
}

// Překreslí celou obrazovku podle aktuálních dat
function vykresliMujPokrok() {
  // Souhrn
  const umim = vsechnyOtazky.filter(function (o) {
    return umimOtazku(o.cislo);
  }).length;
  const zkouseno = vsechnyOtazky.filter(function (o) {
    return pokrok.otazky[String(o.cislo)];
  }).length;
  const chyby = vsechnyOtazky.filter(function (o) {
    return jeChyba(o.cislo);
  }).length;
  const prospelo = pokrok.testy.filter(function (t) {
    return t.prospel;
  }).length;

  pokrokSouhrnEl.innerHTML = "";
  [
    "Umím " + umim + " z " + vsechnyOtazky.length + " " + slovoOtazek(vsechnyOtazky.length),
    "Zkoušeno " + zkouseno + " " + slovoOtazek(zkouseno) + ", z toho " + chyby + " s poslední odpovědí špatně",
    "Cvičných testů " + pokrok.testy.length + ", z toho prospěl " + prospelo + "×",
  ].forEach(function (text) {
    const li = document.createElement("li");
    li.textContent = text;
    pokrokSouhrnEl.appendChild(li);
  });

  // Historie testů – od nejnovějšího; ťuknutím se rozbalí podrobnosti (<details>)
  pokrokHistorieEl.innerHTML = "";
  if (pokrok.testy.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Zatím žádný cvičný test.";
    pokrokHistorieEl.appendChild(p);
  }
  pokrok.testy
    .slice()
    .reverse()
    .forEach(function (t) {
      const detail = document.createElement("details");
      detail.className = "historie-polozka " + (t.prospel ? "prospel" : "neprospel");

      const shrnuti = document.createElement("summary");
      const typ = KRATKE_TYPY[t.typ] || t.typ;
      shrnuti.textContent =
        formatDatumu(t.datum) + " · " + typ + " · " + t.spravne + "/" + t.celkem + " · " +
        (t.prospel ? "PROSPĚL" : "NEPROSPĚL");
      detail.appendChild(shrnuti);

      const seznam = document.createElement("ul");
      const radky = [
        "Potřeba alespoň " + t.minimum + " správných",
        "Čas " + Math.floor(t.cas_s / 60) + " min " + (t.cas_s % 60) + " s" + (t.cas_vyprsel ? " (čas vypršel)" : ""),
      ];
      Object.keys(t.oblasti || {}).forEach(function (kod) {
        const nazev = oblasti[kod] ? oblasti[kod].nazev : kod;
        radky.push(nazev + ": " + t.oblasti[kod].spravne + " / " + t.oblasti[kod].celkem);
      });
      radky.forEach(function (text) {
        const li = document.createElement("li");
        li.textContent = text;
        seznam.appendChild(li);
      });
      detail.appendChild(seznam);

      pokrokHistorieEl.appendChild(detail);
    });
}

// Po importu nebo smazání se změnila data – obnovíme obrazovku i řádek se sérií v menu
function poZmenePokroku(zprava) {
  vykresliMujPokrok();
  zobrazSeriiTestu();
  zpravaPokroku(zprava);
}

// --- Otevření a zavření obrazovky ---------------------------------------------

document.getElementById("pokrok-otevrit").addEventListener("click", function () {
  zpravaPokroku(POKROK_LADENI ? "Ladicí režim: pracujete s ladicím pokrokem, ne s běžným." : "");
  vykresliMujPokrok();
  ukazObrazovku("muj-pokrok");
});

document.getElementById("pokrok-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});

// --- Export: stažení zálohy jako souboru JSON -----------------------------------

document.getElementById("pokrok-export").addEventListener("click", function () {
  // Blob = obsah souboru v paměti; odkaz s atributem download ho prohlížeč stáhne
  const soubor = new Blob([textZalohy()], { type: "application/json" });
  const odkaz = document.createElement("a");
  odkaz.href = URL.createObjectURL(soubor);
  const dnes = new Date().toISOString().slice(0, 10); // "2026-11-20"
  odkaz.download = (POKROK_LADENI ? "zbrojak-pokrok-ladeni-" : "zbrojak-pokrok-") + dnes + ".json";
  document.body.appendChild(odkaz);
  odkaz.click();
  odkaz.remove();
  // Paměť souboru uvolníme až za chvíli – okamžité uvolnění by v Safari mohlo stahování zrušit
  setTimeout(function () {
    URL.revokeObjectURL(odkaz.href);
  }, 1000);
  zpravaPokroku("Záloha se stahuje jako " + odkaz.download + ".");
});

// --- Import: nahrání zálohy ze souboru -----------------------------------------

// Tlačítko otevře výběr souboru (samotné políčko pro soubor je skryté)
document.getElementById("pokrok-import").addEventListener("click", function () {
  pokrokSouborEl.value = ""; // aby šel znovu vybrat i stejný soubor
  pokrokSouborEl.click();
});

pokrokSouborEl.addEventListener("change", async function () {
  const vybrany = pokrokSouborEl.files[0];
  if (!vybrany) return;

  let data;
  try {
    data = JSON.parse(await vybrany.text());
  } catch (chyba) {
    zpravaPokroku("Soubor se nepodařilo přečíst – není to platný JSON.");
    return;
  }

  const chyba = zkontrolujZalohu(data);
  if (chyba) {
    zpravaPokroku(chyba);
    return;
  }

  let otazka =
    "Nahradit současný pokrok (" + popisPokroku(pokrok) + ") pokrokem ze zálohy (" + popisPokroku(data) + ")?";
  if (data.verze_pdf && verzePdf && data.verze_pdf !== verzePdf) {
    otazka += "\n\nPozor: záloha je k otázkám z jiné verze PDF (" + data.verze_pdf + "), čísla otázek nemusí sedět.";
  }
  if (!confirm(otazka)) return;

  poZmenePokroku(
    nahradPokrok(data) ? "Pokrok byl nahrán ze zálohy " + vybrany.name + "." : "Pokrok se nepodařilo uložit."
  );
});

// --- Smazání pokroku ---------------------------------------------------------------

document.getElementById("pokrok-smazat").addEventListener("click", function () {
  if (!confirm("Opravdu smazat veškerý pokrok (" + popisPokroku(pokrok) + ")? Doporučuji si nejdřív stáhnout zálohu.")) {
    return;
  }
  if (!confirm("Smazání nejde vrátit. Opravdu smazat?")) {
    return;
  }
  poZmenePokroku(smazPokrok(verzePdf) ? "Pokrok byl smazán." : "Pokrok se nepodařilo smazat.");
});
