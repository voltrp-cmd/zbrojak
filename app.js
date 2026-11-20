// Otázky se načítají ze souboru data/otazky.json (z položky "otazky").
// Každá otázka má mimo jiné:
//   "otazka"   – text otázky
//   "odpovedi" – pole tří odpovědí
//   "spravna"  – pořadí správné odpovědi v poli "odpovedi" (počítá se od 0)
//   "oblast"   – kód oblasti zkoušky (pravni, nauka, bezpecnost, zdravotni)

// Všechny otázky ze souboru a popis oblastí (název, počet otázek v testu)
let vsechnyOtazky = [];
let oblasti = {};

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

// Pořadí právě zobrazené otázky
let aktualni = 0;

// Všechny obrazovky aplikace – vždy je vidět jen jedna (používá i test.js)
const OBRAZOVKY = ["menu", "kviz", "test-vyber", "test", "vysledek"];

function ukazObrazovku(id) {
  OBRAZOVKY.forEach(function (jina) {
    document.getElementById(jina).hidden = jina !== id;
  });
  window.scrollTo(0, 0);
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

// Přechod na další otázku; po poslední začneme znovu od první
dalsiEl.addEventListener("click", function () {
  aktualni = aktualni + 1;
  if (aktualni >= otazky.length) {
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
    const pocet = vsechnyOtazky.filter(function (o) {
      return o.oblast === kod;
    }).length;

    const tlacitko = document.createElement("button");
    tlacitko.type = "button";
    tlacitko.className = "tlacitko-oblast";

    const nazev = document.createElement("span");
    nazev.className = "tlacitko-oblast-nazev";
    nazev.textContent = oblasti[kod].nazev;

    const popis = document.createElement("span");
    popis.className = "tlacitko-oblast-pocet";
    popis.textContent = pocet + " " + slovoOtazek(pocet);

    tlacitko.append(nazev, popis);
    tlacitko.addEventListener("click", function () {
      spustOblast(kod);
    });
    oblastiTlacitkaEl.appendChild(tlacitko);
  });
}

// Po kliknutí na oblast: vybereme její otázky a ukážeme první z nich
function spustOblast(kod) {
  otazky = vsechnyOtazky.filter(function (o) {
    return o.oblast === kod;
  });
  aktualni = 0;
  nazevOblastiEl.textContent = oblasti[kod].nazev;

  ukazObrazovku("kviz");
  zobrazOtazku();
}

// Tlačítko „Zpět do menu“
zpetEl.addEventListener("click", function () {
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
  } catch (chyba) {
    console.error(chyba);
    zobrazChybu("Otázky se nepodařilo načíst. Chybí soubor data/otazky.json, nebo je aplikace otevřená přímo ze souboru místo přes webový server.");
    return;
  }

  if (vsechnyOtazky.length === 0) {
    zobrazChybu("Soubor s otázkami je prázdný.");
    return;
  }

  menuZpravaEl.hidden = true;
  zobrazMenu();
  return true;
}

// Spuštění po načtení stránky.
// "nacitani" je slib (Promise), na který může počkat test.js, než otázky dorazí.
// Výsledek je true, když se otázky načetly, jinak undefined.
const nacitani = nactiOtazky();
