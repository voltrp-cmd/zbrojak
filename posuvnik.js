// DOČASNÉ: panel pro kontrolu převedených otázek.
// Umožní listovat otázkami bez odpovídání a ukázat správnou odpověď.
// Načte se jen s ?ladeni=1 v adrese stránky (zařizuje to index.html).
//
// Jak panel odstranit:
//   1. smazat tento soubor posuvnik.js,
//   2. v index.html smazat <script> s podmínkou na „ladeni“ (načítá posuvnik.js),
//   3. v app.js smazat řádek s kontrolaPoZobrazeni (označený DOČASNÉ),
//   4. ve style.css smazat blok označený DOČASNÉ.
//
// Využívá proměnné a funkce z app.js (otazky, vsechnyOtazky, oblasti, aktualni, zobrazOtazku)
// a z test.js (test, testZobrazOtazku) – v testu přidá tlačítko „Vyplnit test náhodně“.
// Pole "otazky" obsahuje jen otázky vybrané oblasti, takže posuvník listuje v rámci oblasti.

// Vytvoříme panel a vložíme ho nad kartičku s otázkou (je uvnitř obrazovky s otázkami,
// takže v menu se nezobrazuje)
const kontrolaEl = document.createElement("div");
kontrolaEl.className = "kontrola";
kontrolaEl.innerHTML =
  '<p class="kontrola-info" id="kontrola-info"></p>' +
  '<div class="kontrola-radek">' +
  '  <button type="button" id="kontrola-zpet">◀ Předchozí</button>' +
  '  <button type="button" id="kontrola-dal">Další ▶</button>' +
  "</div>" +
  '<div class="kontrola-radek">' +
  '  <input type="number" id="kontrola-cislo" min="1" inputmode="numeric" placeholder="Číslo otázky">' +
  '  <button type="button" id="kontrola-jdi">Přejít</button>' +
  "</div>" +
  '<label class="kontrola-zaskrt">' +
  '  <input type="checkbox" id="kontrola-spravna" checked> Ukázat správnou odpověď' +
  "</label>";
document.querySelector("#kviz .karta").before(kontrolaEl);

const kontrolaInfoEl = document.getElementById("kontrola-info");
const kontrolaCisloEl = document.getElementById("kontrola-cislo");
const kontrolaSpravnaEl = document.getElementById("kontrola-spravna");

// Přejde na otázku podle pořadí v poli (počítá se od 0)
function kontrolaPrejdiNa(index) {
  if (otazky.length === 0) return;
  // Z první otázky dozadu skočíme na poslední a naopak
  aktualni = (index + otazky.length) % otazky.length;
  zobrazOtazku();
}

// Volá se z app.js po každém zobrazení otázky
function kontrolaPoZobrazeni() {
  const o = otazky[aktualni];
  kontrolaInfoEl.textContent =
    "Č. " + o.cislo + " v PDF · oddíl " + o.oddil + (o.obrazek ? " · má obrázek" : "");

  if (kontrolaSpravnaEl.checked) {
    odpovediEl.querySelectorAll(".odpoved")[o.spravna].classList.add("spravne");
  }
}

document.getElementById("kontrola-zpet").addEventListener("click", function () {
  kontrolaPrejdiNa(aktualni - 1);
});

document.getElementById("kontrola-dal").addEventListener("click", function () {
  kontrolaPrejdiNa(aktualni + 1);
});

// Skok na otázku podle čísla v PDF (1–837) – jen v rámci vybrané oblasti
function kontrolaSkoc() {
  const cislo = Number(kontrolaCisloEl.value);
  const index = otazky.findIndex(function (o) {
    return o.cislo === cislo;
  });
  if (index === -1) {
    // Rozlišíme, jestli otázka vůbec neexistuje, nebo jen patří do jiné oblasti
    const jinde = vsechnyOtazky.find(function (o) {
      return o.cislo === cislo;
    });
    kontrolaInfoEl.textContent = jinde
      ? "Otázka č. " + cislo + " patří do oblasti „" + oblasti[jinde.oblast].nazev + "“."
      : "Otázka č. " + kontrolaCisloEl.value + " neexistuje.";
    return;
  }
  kontrolaPrejdiNa(index);
}

document.getElementById("kontrola-jdi").addEventListener("click", kontrolaSkoc);

// Potvrzení klávesou Enter v políčku s číslem
kontrolaCisloEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") kontrolaSkoc();
});

// Zaškrtnutí/odškrtnutí se projeví hned na aktuální otázce
kontrolaSpravnaEl.addEventListener("change", function () {
  kontrolaPrejdiNa(aktualni);
});

// --- Ladění cvičného testu (test.js) ----------------------------------------
// V testu se správné odpovědi neukazují. Panel umí všechny otázky vyplnit
// náhodnými odpověďmi – pro rychlé vyzkoušení vyhodnocení.
// Políčko „Kolik správně“:
//   - prázdné → odpovědi jsou čistě náhodné (správně jich bude zhruba třetina),
//   - číslo   → přesně tolik náhodně vybraných otázek bude správně, ostatní špatně.
const kontrolaTestEl = document.createElement("div");
kontrolaTestEl.className = "kontrola";
kontrolaTestEl.innerHTML =
  '<p class="kontrola-info" id="kontrola-test-info">Ladění testu</p>' +
  '<div class="kontrola-radek">' +
  '  <input type="number" id="kontrola-pocet-spravne" min="0" inputmode="numeric" placeholder="Kolik správně">' +
  '  <button type="button" id="kontrola-vyplnit">Vyplnit test náhodně</button>' +
  "</div>";
document.querySelector("#test .karta").before(kontrolaTestEl);

const kontrolaPocetSpravneEl = document.getElementById("kontrola-pocet-spravne");
const kontrolaTestInfoEl = document.getElementById("kontrola-test-info");

// Vrátí náhodně jednu z odpovědí 0, 1, 2 kromě zadané (tj. špatnou odpověď)
function nahodnaSpatna(spravna) {
  const spatne = [0, 1, 2].filter(function (i) {
    return i !== spravna;
  });
  return spatne[Math.floor(Math.random() * spatne.length)];
}

document.getElementById("kontrola-vyplnit").addEventListener("click", function () {
  if (!test) return;
  const zadano = kontrolaPocetSpravneEl.value.trim();

  if (zadano === "") {
    // Každé otázce náhodně jednu ze tří odpovědí
    test.odpovedi = test.otazky.map(function () {
      return Math.floor(Math.random() * 3);
    });
  } else {
    // Počet omezíme na rozsah 0 až počet otázek v testu
    const pocet = Math.min(Math.max(Math.round(Number(zadano)) || 0, 0), test.otazky.length);
    // Náhodně vybereme, které otázky budou správně (zamichej je z test.js)
    const spravneIndexy = zamichej(
      test.otazky.map(function (o, i) {
        return i;
      })
    ).slice(0, pocet);
    test.odpovedi = test.otazky.map(function (o, i) {
      return spravneIndexy.includes(i) ? o.spravna : nahodnaSpatna(o.spravna);
    });
  }

  // Kontrolní součet, ať je hned vidět, kolik je opravdu správně
  const spravne = test.odpovedi.filter(function (odp, i) {
    return odp === test.otazky[i].spravna;
  }).length;
  kontrolaTestInfoEl.textContent = "Ladění testu · vyplněno, správně " + spravne + " z " + test.otazky.length;
  testZobrazOtazku();
});

// Posuvník se načítá až dodatečně, takže otázka už může být zobrazená.
// V tom případě hned doplníme informace o ní a správnou odpověď.
if (otazky.length > 0) {
  kontrolaPoZobrazeni();
}
