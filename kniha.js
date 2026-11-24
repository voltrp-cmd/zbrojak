// Studijní materiály: seznam kapitol knihy a čtení kapitoly.
//
// Text knihy je v kniha/*.md, pořadí a názvy kapitol v kniha/kapitoly.json.
// Tyto soubory se tu jen čtou – jsou zdrojem i pro PDF verzi knihy (nastroje/sazba_knihy.py).
//
// Převod Markdownu do HTML je napsaný ručně a umí jen podmnožinu, kterou kniha používá:
//   # Nadpis kapitoly, ## Část kapitoly, odstavce, odrážky „- “ (vnoření po 2 mezerách),
//   číslované seznamy „1. “, **tučně**, obrázky ![popisek](cesta) (i víc na jednom řádku),
//   rámečky („**Na zkoušce:**“, „**Tip**“, „**Pozor**“, „**Důležité**“), řádek „Otázky: …“,
//   část „## Shrnutí do kapsy“. Komentáře <!-- … --> (např. nova-strana) se vynechají.
//
// Bezpečnost: každý text se nejdřív escapuje (< > & " ' se změní na entity) a teprve potom
// se převádí **tučně**. Do stránky se tak nikdy nedostane HTML přímo ze souboru knihy.
//
// Využívá z app.js: ukazObrazovku, slovoOtazek; z test.js: manualDalsiHodnoty, doplnManual.

const knihaSeznamEl = document.getElementById("kniha-seznam");
const knihaZpravaEl = document.getElementById("kniha-zprava");
const knihaPodnadpisEl = document.getElementById("kniha-podnadpis");
const kapitolaPoradiEl = document.getElementById("kapitola-poradi");
const kapitolaObsahEl = document.getElementById("kapitola-obsah");
const kapitolaObsahSeznamEl = document.getElementById("kapitola-obsah-seznam");
const kapitolaTextEl = document.getElementById("kapitola-text");
const kapitolaPredchoziEl = document.getElementById("kapitola-predchozi");
const kapitolaDalsiEl = document.getElementById("kapitola-dalsi");

// Obsah kniha/kapitoly.json (null, dokud se nenačte nebo když se načíst nepodaří)
let kniha = null;

// Už stažené texty kapitol: název souboru → text v Markdownu
const textyKapitol = {};

// Index právě otevřené kapitoly v kniha.kapitoly (-1 = žádná)
let aktualniKapitola = -1;

// --- Převod Markdownu -------------------------------------------------------

// Nahradí znaky, které mají v HTML zvláštní význam. Volat na každý text ze souboru knihy.
function escapujHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Převede jeden řádek textu: nejdřív escapovat, potom **tučně** → <strong>
function prevedRadek(text) {
  return escapujHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Cesta k obrázku v knize je relativní ke složce kniha/ (např. ../data/obrazky/656.jpg).
// Vrátí cestu relativní k aplikaci (data/obrazky/656.jpg), nebo null u podezřelé cesty.
function cestaObrazku(cesta) {
  const vysledek = cesta.startsWith("../") ? cesta.slice(3) : "kniha/" + cesta;
  // Povolíme jen písmena, číslice, pomlčky, podtržítka, tečky a lomítka, a žádné „..“
  if (!/^[A-Za-z0-9_\-./]+$/.test(vysledek) || vysledek.includes("..")) return null;
  return vysledek;
}

const VZOR_OBRAZKU = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const VZOR_RADKU_S_OBRAZKY = /^\s*(!\[[^\]]*\]\([^)\s]+\)\s*)+$/;
const VZOR_POLOZKY = /^( *)(-|\d+\.) (.*)$/;
const VZOR_OTAZEK = /^Otázky:\s*(.+)$/;

// Řádek s jedním nebo více obrázky → <figure> s popiskem (víc obrázků vedle sebe)
function obrazkyHtml(radek) {
  let html = "";
  let pocet = 0;
  radek.replace(VZOR_OBRAZKU, function (cely, popisek, cesta) {
    const src = cestaObrazku(cesta);
    if (!src) return cely;
    pocet++;
    html +=
      '<figure class="kniha-obrazek">' +
      '<img src="' + escapujHtml(src) + '" alt="' + escapujHtml(popisek) + '" loading="lazy">' +
      (popisek ? "<figcaption>" + prevedRadek(popisek) + "</figcaption>" : "") +
      "</figure>";
    return cely;
  });
  if (pocet === 0) return "";
  return '<div class="kniha-obrazky">' + html + "</div>";
}

// Seznam položek {uroven, znacka, cislo, text} → vnořené <ul>/<ol>
function seznamHtml(polozky) {
  let html = "";
  const otevrene = []; // otevřené seznamy, každý { uroven, tag }

  function posledni() {
    return otevrene[otevrene.length - 1];
  }
  function zavri() {
    html += "</li></" + otevrene.pop().tag + ">";
  }

  polozky.forEach(function (p) {
    const tag = p.znacka === "-" ? "ul" : "ol";
    // Zavřeme hlubší seznamy
    while (otevrene.length && posledni().uroven > p.uroven) zavri();
    // Na stejné úrovni se změnil druh seznamu (odrážky ↔ čísla) → zavřít a otevřít nový
    if (otevrene.length && posledni().uroven === p.uroven && posledni().tag !== tag) zavri();

    if (otevrene.length && posledni().uroven === p.uroven) {
      html += "</li>"; // další položka téhož seznamu
    } else {
      // Nový (případně vnořený) seznam; číslovaný začne číslem první položky
      const zacatek = tag === "ol" && p.cislo !== 1 ? ' start="' + p.cislo + '"' : "";
      html += "<" + tag + zacatek + ">";
      otevrene.push({ uroven: p.uroven, tag: tag });
    }
    html += "<li>" + prevedRadek(p.text);
  });

  while (otevrene.length) zavri();
  return html;
}

// Odstavec → <p>, nebo rámeček podle toho, čím začíná
function odstavecHtml(text) {
  const obsah = prevedRadek(text);
  if (text.startsWith("**Na zkoušce:**")) {
    return '<div class="kniha-ramecek kniha-ramecek-zkouska"><p>' + obsah + "</p></div>";
  }
  if (/^\*\*(Tip|Pozor|Důležité)/.test(text)) {
    return '<div class="kniha-ramecek kniha-ramecek-rada"><p>' + obsah + "</p></div>";
  }
  return "<p>" + obsah + "</p>";
}

// Převede celý text kapitoly. Vrátí { nazev, html, casti: [{ id, nazev }] }.
function prevedMarkdown(text) {
  const radky = text.split(/\r?\n/);
  const casti = [];
  let nazev = "";
  let html = "";
  let castOtevrena = false;
  let i = 0;

  function prazdny(radek) {
    return radek.trim() === "" || /^\s*<!--.*-->\s*$/.test(radek);
  }

  while (i < radky.length) {
    const radek = radky[i];

    if (prazdny(radek)) {
      i++;
    } else if (radek.startsWith("# ")) {
      // Název kapitoly (první řádek souboru)
      nazev = radek.slice(2).trim();
      html += '<h2 class="kniha-nazev-kapitoly">' + prevedRadek(nazev) + "</h2>";
      i++;
    } else if (radek.startsWith("## ")) {
      // Nová část kapitoly: zabalíme ji do <section>, aby šla zvýraznit a najít v obsahu
      if (castOtevrena) html += "</section>";
      const nazevCasti = radek.slice(3).trim();
      const id = "kniha-cast-" + (casti.length + 1);
      const shrnuti = nazevCasti === "Shrnutí do kapsy";
      casti.push({ id: id, nazev: nazevCasti });
      html +=
        '<section class="kniha-cast' + (shrnuti ? " kniha-shrnuti" : "") + '" id="' + id + '">' +
        "<h3>" + prevedRadek(nazevCasti) + "</h3>";
      castOtevrena = true;
      i++;
    } else if (VZOR_POLOZKY.test(radek)) {
      // Seznam: posbíráme všechny řádky, které za sebou následují
      const polozky = [];
      while (i < radky.length && VZOR_POLOZKY.test(radky[i])) {
        const shoda = radky[i].match(VZOR_POLOZKY);
        polozky.push({
          uroven: Math.floor(shoda[1].length / 2),
          znacka: shoda[2] === "-" ? "-" : "1.",
          cislo: shoda[2] === "-" ? 0 : parseInt(shoda[2], 10),
          text: shoda[3],
        });
        i++;
      }
      html += seznamHtml(polozky);
    } else if (VZOR_RADKU_S_OBRAZKY.test(radek)) {
      html += obrazkyHtml(radek);
      i++;
    } else if (VZOR_OTAZEK.test(radek.trim())) {
      // Čísla otázek ze souboru MV, které část vysvětluje (zatím jen jako šedý text)
      const cisla = radek.trim().match(VZOR_OTAZEK)[1];
      html += '<p class="kniha-otazky">Otázky v testu: ' + escapujHtml(cisla) + "</p>";
      i++;
    } else {
      // Odstavec: řádky až do prázdného řádku (nebo do nadpisu či seznamu)
      const radkyOdstavce = [];
      while (
        i < radky.length && !prazdny(radky[i]) && !radky[i].startsWith("#") &&
        !VZOR_POLOZKY.test(radky[i])
      ) {
        radkyOdstavce.push(radky[i].trim());
        i++;
      }
      html += odstavecHtml(radkyOdstavce.join(" "));
    }
  }

  if (castOtevrena) html += "</section>";
  return { nazev: nazev, html: html, casti: casti };
}

// --- Seznam kapitol ---------------------------------------------------------

function zpravaKnihy(text) {
  knihaZpravaEl.textContent = text;
  knihaZpravaEl.hidden = !text;
}

function vykresliSeznamKapitol() {
  knihaSeznamEl.innerHTML = "";
  if (!kniha) return;

  kniha.kapitoly.forEach(function (kapitola, index) {
    const tlacitko = document.createElement("button");
    tlacitko.type = "button";
    tlacitko.className = "tlacitko-oblast tlacitko-kapitola";

    const nazev = document.createElement("span");
    nazev.className = "tlacitko-oblast-nazev";
    nazev.textContent = kapitola.nazev;

    const popis = document.createElement("span");
    popis.className = "tlacitko-oblast-pocet";
    const pocet = kapitola.pocet_otazek || 0;
    popis.textContent = pocet > 0
      ? pocet + " " + slovoOtazek(pocet) + " z testu"
      : "bez otázek z testu";

    tlacitko.appendChild(nazev);
    tlacitko.appendChild(popis);
    tlacitko.addEventListener("click", function () {
      otevriKapitolu(index);
    });
    knihaSeznamEl.appendChild(tlacitko);
  });
}

// Načte kniha/kapitoly.json. Vrátí true, když se to povedlo.
async function nactiKnihu() {
  try {
    const odpoved = await fetch("kniha/kapitoly.json");
    if (!odpoved.ok) throw new Error("Soubor nenalezen (kód " + odpoved.status + ")");
    const data = await odpoved.json();
    if (!data || !Array.isArray(data.kapitoly) || data.kapitoly.length === 0) {
      throw new Error("Soubor kniha/kapitoly.json neobsahuje žádné kapitoly");
    }
    kniha = data;
  } catch (chyba) {
    console.error(chyba);
    zpravaKnihy("Studijní materiály se nepodařilo načíst.");
    return false;
  }

  knihaPodnadpisEl.textContent = kniha.nazev || "";
  zpravaKnihy("");
  vykresliSeznamKapitol();

  // Počet kapitol do manuálu
  manualDalsiHodnoty["kniha-kapitol"] = kniha.kapitoly.length;
  doplnManual();
  return true;
}

// --- Čtení kapitoly ---------------------------------------------------------

// Stáhne text kapitoly (jen poprvé, pak ho vezme z textyKapitol)
async function textKapitoly(soubor) {
  if (textyKapitol[soubor] !== undefined) return textyKapitol[soubor];
  // Název souboru bereme jen v bezpečném tvaru (např. 01a-pravo-zaklady.md)
  if (!/^[A-Za-z0-9_\-]+\.md$/.test(soubor)) throw new Error("Neplatný název souboru: " + soubor);
  const odpoved = await fetch("kniha/" + soubor);
  if (!odpoved.ok) throw new Error("Soubor nenalezen (kód " + odpoved.status + ")");
  textyKapitol[soubor] = await odpoved.text();
  return textyKapitol[soubor];
}

// Obsah kapitoly (rozbalovací seznam částí ##)
function vykresliObsahKapitoly(casti) {
  kapitolaObsahSeznamEl.innerHTML = "";
  kapitolaObsahEl.open = false;
  kapitolaObsahEl.hidden = casti.length === 0;

  casti.forEach(function (cast) {
    const polozka = document.createElement("li");
    const odkaz = document.createElement("a");
    odkaz.href = "#" + cast.id;
    odkaz.textContent = cast.nazev;
    odkaz.addEventListener("click", function (udalost) {
      // Odrolujeme sami, aby se neměnila adresa stránky (#…)
      udalost.preventDefault();
      kapitolaObsahEl.open = false;
      document.getElementById(cast.id).scrollIntoView({ behavior: "smooth", block: "start" });
    });
    polozka.appendChild(odkaz);
    kapitolaObsahSeznamEl.appendChild(polozka);
  });
}

async function otevriKapitolu(index) {
  if (!kniha || index < 0 || index >= kniha.kapitoly.length) return;
  const kapitola = kniha.kapitoly[index];
  aktualniKapitola = index;

  kapitolaPoradiEl.textContent = "Kapitola " + (index + 1) + " z " + kniha.kapitoly.length;
  kapitolaPredchoziEl.disabled = index === 0;
  kapitolaDalsiEl.disabled = index === kniha.kapitoly.length - 1;

  let text;
  try {
    text = await textKapitoly(kapitola.soubor);
  } catch (chyba) {
    console.error(chyba);
    kapitolaObsahEl.hidden = true;
    kapitolaTextEl.innerHTML = "";
    const zprava = document.createElement("p");
    zprava.className = "menu-zprava";
    zprava.textContent = "Kapitolu „" + kapitola.nazev + "“ se nepodařilo načíst.";
    kapitolaTextEl.appendChild(zprava);
    ukazObrazovku("kapitola");
    return;
  }
  // Mezitím mohl uživatel ťuknout na jinou kapitolu – pak tuhle už nevykreslujeme
  if (aktualniKapitola !== index) return;

  const prevod = prevedMarkdown(text);
  kapitolaTextEl.innerHTML = prevod.html; // bezpečné: veškerý text prošel escapujHtml
  vykresliObsahKapitoly(prevod.casti);
  ukazObrazovku("kapitola");
}

// --- Tlačítka ---------------------------------------------------------------

document.getElementById("kniha-otevrit").addEventListener("click", function () {
  ukazObrazovku("kniha");
});
document.getElementById("kniha-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});
document.getElementById("kapitola-zpet").addEventListener("click", function () {
  ukazObrazovku("kniha");
});
document.getElementById("kapitola-seznam").addEventListener("click", function () {
  ukazObrazovku("kniha");
});
kapitolaPredchoziEl.addEventListener("click", function () {
  otevriKapitolu(aktualniKapitola - 1);
});
kapitolaDalsiEl.addEventListener("click", function () {
  otevriKapitolu(aktualniKapitola + 1);
});

// Seznam kapitol načteme hned při startu (texty kapitol až při otevření)
const nacitaniKnihy = nactiKnihu();
