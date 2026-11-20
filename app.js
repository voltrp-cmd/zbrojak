// Otázky se načítají ze souboru data/otazky.json (z položky "otazky").
// Každá otázka má mimo jiné:
//   "otazka"   – text otázky
//   "odpovedi" – pole tří odpovědí
//   "spravna"  – pořadí správné odpovědi v poli "odpovedi" (počítá se od 0)
// Dokud se soubor nenačte, je pole prázdné.
let otazky = [];

// Prvky stránky, se kterými budeme pracovat
const pocitadloEl = document.getElementById("pocitadlo");
const otazkaEl = document.getElementById("otazka");
const obrazekEl = document.getElementById("obrazek");
const odpovediEl = document.getElementById("odpovedi");
const dalsiEl = document.getElementById("dalsi");

// Pořadí právě zobrazené otázky
let aktualni = 0;

// Zobrazí otázku podle proměnné "aktualni"
function zobrazOtazku() {
  const o = otazky[aktualni];

  pocitadloEl.textContent = "Otázka " + (aktualni + 1) + " z " + otazky.length;
  otazkaEl.textContent = o.otazka;

  // Obrázek ukážeme jen u otázek, které ho mají ("obrazek" není null)
  if (o.obrazek) {
    obrazekEl.src = o.obrazek;
    obrazekEl.alt = "Obrázek k otázce č. " + o.cislo;
    obrazekEl.hidden = false;
  } else {
    obrazekEl.removeAttribute("src");
    obrazekEl.alt = "";
    obrazekEl.hidden = true;
  }

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

// Když se otázky nepodaří načíst, ukážeme místo otázky srozumitelnou chybu
function zobrazChybu(zprava) {
  pocitadloEl.textContent = "";
  otazkaEl.textContent = zprava;
  odpovediEl.innerHTML = "";
  dalsiEl.hidden = true;
}

// Načte otázky ze souboru a zobrazí první z nich.
// fetch() stáhne soubor; trvá to chvíli, proto používáme async/await (počkáme na výsledek).
async function nactiOtazky() {
  otazkaEl.textContent = "Načítám otázky…";

  try {
    const odpoved = await fetch("data/otazky.json");
    if (!odpoved.ok) {
      throw new Error("Soubor nenalezen (kód " + odpoved.status + ")");
    }
    const data = await odpoved.json();
    // Soubor obsahuje i údaje o zdroji a oddílech, otázky jsou v položce "otazky"
    otazky = data.otazky;
  } catch (chyba) {
    console.error(chyba);
    zobrazChybu("Otázky se nepodařilo načíst. Chybí soubor data/otazky.json, nebo je aplikace otevřená přímo ze souboru místo přes webový server.");
    return;
  }

  if (otazky.length === 0) {
    zobrazChybu("Soubor s otázkami je prázdný.");
    return;
  }

  zobrazOtazku();
}

// Spuštění po načtení stránky
nactiOtazky();
