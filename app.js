// DOČASNÉ: ukázkové otázky jen pro vyzkoušení aplikace.
// Nejsou to oficiální otázky ze zkoušky, později je nahradíme skutečnými.
// "spravna" je pořadí správné odpovědi v poli "odpovedi" (počítá se od 0).
const otazky = [
  {
    otazka: "(Ukázka) Jak se má se zbraní vždy zacházet?",
    odpovedi: [
      "Jako by byla nabitá",
      "Jako by byla nenabitá",
      "Záleží na tom, jestli je zajištěná",
    ],
    spravna: 0,
  },
  {
    otazka: "(Ukázka) Kam smí směřovat ústí hlavně zbraně?",
    odpovedi: [
      "Kamkoli, pokud je zbraň zajištěná",
      "Na kamaráda, pokud jde o žert",
      "Jen bezpečným směrem",
    ],
    spravna: 2,
  },
  {
    otazka: "(Ukázka) Kdy má být prst na spoušti?",
    odpovedi: [
      "Pořád, aby byla zbraň připravená",
      "Až když chci vystřelit",
      "Vždy při nošení zbraně",
    ],
    spravna: 1,
  },
  {
    otazka: "(Ukázka) Kdy nemá být prst na spoušti?",
    odpovedi: [
      "Když nechci vystřelit",
      "Až když chci vystřelit",
      "Při strílení",
    ],
    spravna: 0,
  },
];

// Prvky stránky, se kterými budeme pracovat
const pocitadloEl = document.getElementById("pocitadlo");
const otazkaEl = document.getElementById("otazka");
const odpovediEl = document.getElementById("odpovedi");
const dalsiEl = document.getElementById("dalsi");

// Pořadí právě zobrazené otázky
let aktualni = 0;

// Zobrazí otázku podle proměnné "aktualni"
function zobrazOtazku() {
  const o = otazky[aktualni];

  pocitadloEl.textContent = "Otázka " + (aktualni + 1) + " z " + otazky.length;
  otazkaEl.textContent = o.otazka;

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

// Spuštění po načtení stránky
zobrazOtazku();
