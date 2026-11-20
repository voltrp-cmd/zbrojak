// Otázky se načítají ze souboru data/otazky.json (z položky "otazky").
// Každá otázka má mimo jiné:
//   "otazka"   – text otázky
//   "odpovedi" – pole tří odpovědí
//   "spravna"  – pořadí správné odpovědi v poli "odpovedi" (počítá se od 0)
//   "oblast"   – kód oblasti zkoušky (pravni, nauka, bezpecnost, zdravotni)

// Všechny otázky ze souboru a popis oblastí (název, počet otázek v testu)
let vsechnyOtazky = [];
let oblasti = {};
// Datum verze PDF, ze které jsou otázky (např. "2025-12-15")
let verzePdf = null;

// Otázky právě vybrané oblasti – s tímto polem pracuje kvíz (i posuvník v ladicím režimu)
let otazky = [];

// Prvky stránky, se kterými budeme pracovat
const menuZpravaEl = document.getElementById("menu-zprava");
const oblastiTlacitkaEl = document.getElementById("oblasti-tlacitka");
const nazevOblastiEl = document.getElementById("nazev-oblasti");
const zpetEl = document.getElementById("zpet");
const pocitadloEl = document.getElementById("pocitadlo");
const otazkaEl = document.getElementById("otazka");
const obrazekEl = document.getElementById("obrazek");
const odpovediEl = document.getElementById("odpovedi");
const dalsiEl = document.getElementById("dalsi");

const chybyStartEl = document.getElementById("chyby-start");
const chybyPopisEl = document.getElementById("chyby-popis");
const chybyDalsiKoloEl = document.getElementById("chyby-dalsi-kolo");

// Pořadí právě zobrazené otázky
let aktualni = 0;

// Co se právě procvičuje: "oblast" (jedna oblast dokola), nebo "chyby" (kolo opakování chyb)
let rezim = "oblast";

// Všechny obrazovky aplikace – vždy je vidět jen jedna (používá i test.js)
const OBRAZOVKY = ["menu", "kviz", "chyby-konec", "test-vyber", "test", "vysledek", "manual", "muj-pokrok"];

function ukazObrazovku(id) {
  // Při návratu do menu ho překreslíme, aby počty „umím“ odpovídaly novým odpovědím
  if (id === "menu" && vsechnyOtazky.length > 0) {
    zobrazMenu();
  }
  OBRAZOVKY.forEach(function (jina) {
    document.getElementById(jina).hidden = jina !== id;
  });
  window.scrollTo(0, 0);
}

// Zamíchá pole náhodně (Fisher–Yates) a vrátí nové pole, původní nezmění
// (používá opakování chyb, test.js i posuvnik.js)
function zamichej(pole) {
  const kopie = pole.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const docasna = kopie[i];
    kopie[i] = kopie[j];
    kopie[j] = docasna;
  }
  return kopie;
}

// Nastaví obrázek k otázce, nebo ho skryje, když ho otázka nemá (používá i test.js)
function nastavObrazek(el, o) {
  if (o.obrazek) {
    el.src = o.obrazek;
    el.alt = "Obrázek k otázce č. " + o.cislo;
    el.hidden = false;
  } else {
    el.removeAttribute("src");
    el.alt = "";
    el.hidden = true;
  }
}

// Zobrazí otázku podle proměnné "aktualni"
function zobrazOtazku() {
  const o = otazky[aktualni];

  pocitadloEl.textContent = "Otázka " + (aktualni + 1) + " z " + otazky.length;
  otazkaEl.textContent = o.otazka;

  // Obrázek ukážeme jen u otázek, které ho mají ("obrazek" není null)
  nastavObrazek(obrazekEl, o);

  // Smažeme tlačítka z předchozí otázky a skryjeme „Další otázka“
  odpovediEl.innerHTML = "";
  dalsiEl.hidden = true;

  // Pro každou odpověď vytvoříme tlačítko
  o.odpovedi.forEach(function (text, index) {
    const tlacitko = document.createElement("button");
    tlacitko.className = "odpoved";
    tlacitko.textContent = text;
    tlacitko.addEventListener("click", function () {
      vyhodnot(index);
    });
    odpovediEl.appendChild(tlacitko);
  });

  // DOČASNÉ: kontrolní panel z posuvnik.js (při odstranění panelu smazat i tento řádek)
  if (typeof kontrolaPoZobrazeni === "function") kontrolaPoZobrazeni();
}

// Obarví odpovědi po kliknutí: zvolenou zeleně/červeně a správnou vždy zeleně
function vyhodnot(zvolena) {
  const spravna = otazky[aktualni].spravna;
  const tlacitka = odpovediEl.querySelectorAll(".odpoved");

  // Uložíme odpověď do pokroku (pokrok.js)
  zaznamenejOdpoved(otazky[aktualni].cislo, zvolena === spravna);

  tlacitka.forEach(function (tlacitko, index) {
    // Po odpovědi už nejde kliknout znovu
    tlacitko.disabled = true;

    if (index === spravna) {
      tlacitko.classList.add("spravne");
    } else if (index === zvolena) {
      tlacitko.classList.add("spatne");
    }
  });

  dalsiEl.hidden = false;

  // Na malém displeji může být tlačítko pod okrajem obrazovky – posuneme k němu
  dalsiEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Přechod na další otázku. Po poslední otázce:
//   - v procvičování oblasti začneme znovu od první,
//   - v opakování chyb ukážeme obrazovku „Kolo hotovo“.
dalsiEl.addEventListener("click", function () {
  aktualni = aktualni + 1;
  if (aktualni >= otazky.length) {
    if (rezim === "chyby") {
      zobrazKonecKola();
      return;
    }
    aktualni = 0;
  }
  zobrazOtazku();

  // Nová otázka začíná nahoře, i když jsme předtím odscrollovali dolů
  window.scrollTo(0, 0);
});

// Správný tvar slova podle počtu: 1 otázka, 2–4 otázky, 5 a víc otázek
function slovoOtazek(pocet) {
  if (pocet === 1) return "otázka";
  if (pocet >= 2 && pocet <= 4) return "otázky";
  return "otázek";
}

// Vytvoří v menu jedno velké tlačítko pro každou oblast
function zobrazMenu() {
  oblastiTlacitkaEl.innerHTML = "";

  Object.keys(oblasti).forEach(function (kod) {
    const otazkyOblasti = vsechnyOtazky.filter(function (o) {
      return o.oblast === kod;
    });
    const pocet = otazkyOblasti.length;
    const umim = otazkyOblasti.filter(function (o) {
      return umimOtazku(o.cislo);
    }).length;

    const tlacitko = document.createElement("button");
    tlacitko.type = "button";
    tlacitko.className = "tlacitko-oblast";

    const nazev = document.createElement("span");
    nazev.className = "tlacitko-oblast-nazev";
    nazev.textContent = oblasti[kod].nazev;

    const popis = document.createElement("span");
    popis.className = "tlacitko-oblast-pocet";
    popis.textContent = "Umím " + umim + " z " + pocet + " " + slovoOtazek(pocet);

    // Pruh postupu: vyplněná část odpovídá podílu otázek, které umím
    const pruh = document.createElement("span");
    pruh.className = "postup";
    const vypln = document.createElement("span");
    vypln.className = "postup-vypln";
    vypln.style.width = (pocet > 0 ? (umim / pocet) * 100 : 0) + "%";
    pruh.appendChild(vypln);

    tlacitko.append(nazev, popis, pruh);
    tlacitko.addEventListener("click", function () {
      spustOblast(kod);
    });
    oblastiTlacitkaEl.appendChild(tlacitko);
  });

  // Tlačítko „Opakovat chyby“ s počtem chyb; bez chyb je neaktivní
  const pocetChyb = chybneOtazky().length;
  chybyStartEl.disabled = pocetChyb === 0;
  chybyPopisEl.textContent =
    pocetChyb === 0
      ? "Žádné chyby k opakování"
      : pocetChyb + " " + slovoOtazek(pocetChyb) + " s poslední odpovědí špatně";
}

// Po kliknutí na oblast: vybereme její otázky a ukážeme první z nich
function spustOblast(kod) {
  rezim = "oblast";
  otazky = vsechnyOtazky.filter(function (o) {
    return o.oblast === kod;
  });
  aktualni = 0;
  nazevOblastiEl.textContent = oblasti[kod].nazev;

  ukazObrazovku("kviz");
  zobrazOtazku();
}

// --- Opakování chyb ------------------------------------------------------------

// Otázky ze všech oblastí, kde byla poslední odpověď špatná (jeChyba z pokrok.js)
function chybneOtazky() {
  return vsechnyOtazky.filter(function (o) {
    return jeChyba(o.cislo);
  });
}

// Spustí jedno kolo opakování: seznam chyb se určí teď a během kola se nemění
// (opravená otázka tak nezmizí uprostřed kola)
function spustOpakovaniChyb() {
  const chyby = chybneOtazky();
  if (chyby.length === 0) {
    ukazObrazovku("menu");
    return;
  }
  rezim = "chyby";
  otazky = zamichej(chyby);
  aktualni = 0;
  nazevOblastiEl.textContent = "Opakování chyb";

  ukazObrazovku("kviz");
  zobrazOtazku();
}

// Po poslední otázce kola: kolik chyb se opravilo a jestli nějaké zbývají
function zobrazKonecKola() {
  const opraveno = otazky.filter(function (o) {
    return !jeChyba(o.cislo);
  }).length;
  const zbyva = chybneOtazky().length;

  document.getElementById("chyby-konec-text").textContent =
    "Opraveno " + opraveno + " z " + otazky.length + ". " +
    (zbyva === 0
      ? "Všechny chyby jsou opravené."
      : "Zbývá " + zbyva + " " + slovoOtazek(zbyva) + " k opakování.");
  chybyDalsiKoloEl.hidden = zbyva === 0;

  ukazObrazovku("chyby-konec");
}

chybyStartEl.addEventListener("click", spustOpakovaniChyb);
chybyDalsiKoloEl.addEventListener("click", spustOpakovaniChyb);
document.getElementById("chyby-menu").addEventListener("click", function () {
  ukazObrazovku("menu");
});

// Tlačítko „Zpět do menu“
zpetEl.addEventListener("click", function () {
  ukazObrazovku("menu");
});

// Manuál „Jak aplikace funguje“
document.getElementById("manual-otevrit").addEventListener("click", function () {
  ukazObrazovku("manual");
});

document.getElementById("manual-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});

// Když se otázky nepodaří načíst, ukážeme v menu srozumitelnou chybu
function zobrazChybu(zprava) {
  menuZpravaEl.textContent = zprava;
  menuZpravaEl.hidden = false;
}

// Načte otázky ze souboru a zobrazí menu s oblastmi.
// fetch() stáhne soubor; trvá to chvíli, proto používáme async/await (počkáme na výsledek).
async function nactiOtazky() {
  try {
    const odpoved = await fetch("data/otazky.json");
    if (!odpoved.ok) {
      throw new Error("Soubor nenalezen (kód " + odpoved.status + ")");
    }
    const data = await odpoved.json();
    // Soubor obsahuje i údaje o zdroji a oblastech, otázky jsou v položce "otazky"
    vsechnyOtazky = data.otazky || [];
    oblasti = data.oblasti || {};
    verzePdf = data.verze_pdf || null;
  } catch (chyba) {
    console.error(chyba);
    zobrazChybu("Otázky se nepodařilo načíst. Chybí soubor data/otazky.json, nebo je aplikace otevřená přímo ze souboru místo přes webový server.");
    return;
  }

  if (vsechnyOtazky.length === 0) {
    zobrazChybu("Soubor s otázkami je prázdný.");
    return;
  }

  zkontrolujVerziPdf(verzePdf);
  zobrazMenu();

  // Upozornění z pokrok.js (poškozená data, ladicí režim…) ukážeme v menu
  if (pokrokUpozorneni.length > 0) {
    menuZpravaEl.textContent = pokrokUpozorneni.join(" ");
    menuZpravaEl.hidden = false;
  } else {
    menuZpravaEl.hidden = true;
  }
  return true;
}

// Spuštění po načtení stránky.
// "nacitani" je slib (Promise), na který může počkat test.js, než otázky dorazí.
// Výsledek je true, když se otázky načetly, jinak undefined.
const nacitani = nactiOtazky();
