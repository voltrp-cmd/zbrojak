// DOČASNÉ: panel pro kontrolu převedených otázek.
// Umožní listovat otázkami bez odpovídání a ukázat správnou odpověď.
//
// Jak panel odstranit:
//   1. smazat tento soubor kontrola.js,
//   2. v index.html smazat řádek <script src="kontrola.js"></script>,
//   3. v app.js smazat řádek s kontrolaPoZobrazeni (označený DOČASNÉ),
//   4. ve style.css smazat blok označený DOČASNÉ.
//
// Využívá proměnné a funkce z app.js (otazky, aktualni, zobrazOtazku).

// Vytvoříme panel a vložíme ho nad kartičku s otázkou
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
document.querySelector(".karta").before(kontrolaEl);

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

// Skok na otázku podle čísla v PDF (1–837)
function kontrolaSkoc() {
  const cislo = Number(kontrolaCisloEl.value);
  const index = otazky.findIndex(function (o) {
    return o.cislo === cislo;
  });
  if (index === -1) {
    kontrolaInfoEl.textContent = "Otázka č. " + kontrolaCisloEl.value + " neexistuje.";
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
