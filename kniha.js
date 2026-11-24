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
// Z řádků „Otázky: …“ se sestaví rejstřík „číslo otázky → kapitola a část“. Podle něj
// tlačítko „Vysvětlení v knize“ (u otázky v procvičování a ve výsledku testu) otevře
// správné místo a tlačítko Zpět vrátí uživatele tam, odkud přišel.
//
// Bezpečnost: každý text se nejdřív escapuje (< > & " ' se změní na entity) a teprve potom
// se převádí **tučně**. Do stránky se tak nikdy nedostane HTML přímo ze souboru knihy.
//
// Místo čtení (poslední kapitola a kde v ní uživatel je) se ukládá do localStorage pod vlastním
// klíčem, mimo strukturu pokroku v pokrok.js:
//   { "soubor": "02-nauka-o-zbranich.md", "cast": "kniha-cast-3", "odsazeni": 420, "datum": "…" }
//   "cast" = id části (##) nahoře na obrazovce (null = úvod kapitoly),
//   "odsazeni" = o kolik pixelů je stránka odrolovaná od začátku té části.
// Při čtení přes „Vysvětlení v knize“ se místo neukládá – je to jen odskok od otázky.
//
// Využívá z app.js: ukazObrazovku, slovoOtazek, nastavObrazek, vsechnyOtazky, nacitani;
// z test.js: manualDalsiHodnoty, doplnManual; z pokrok.js: POKROK_LADENI.

const knihaSeznamEl = document.getElementById("kniha-seznam");
const knihaZpravaEl = document.getElementById("kniha-zprava");
const knihaPodnadpisEl = document.getElementById("kniha-podnadpis");
const kapitolaPoradiEl = document.getElementById("kapitola-poradi");
const kapitolaObsahEl = document.getElementById("kapitola-obsah");
const kapitolaObsahSeznamEl = document.getElementById("kapitola-obsah-seznam");
const kapitolaTextEl = document.getElementById("kapitola-text");
const kapitolaPredchoziEl = document.getElementById("kapitola-predchozi");
const kapitolaDalsiEl = document.getElementById("kapitola-dalsi");
const kapitolaZpetEl = document.getElementById("kapitola-zpet");
const kapitolaSeznamEl = document.getElementById("kapitola-seznam");
const kapitolaNavratEl = document.getElementById("kapitola-navrat");
const oknoEl = document.getElementById("otazka-okno");
const cteniPokracovatEl = document.getElementById("cteni-pokracovat");

// Klíč v localStorage pro místo čtení; v ladicím režimu zvlášť, stejně jako pokrok
const CTENI_KLIC = POKROK_LADENI ? "zbrojak-cteni-ladeni" : "zbrojak-cteni";

// Obsah kniha/kapitoly.json (null, dokud se nenačte nebo když se načíst nepodaří)
let kniha = null;

// Už stažené texty kapitol: název souboru → text v Markdownu
const textyKapitol = {};

// Převedené kapitoly: název souboru → výsledek prevedMarkdown (aby se nepřeváděly znovu)
const prevedeneKapitoly = {};

// Index právě otevřené kapitoly v kniha.kapitoly (-1 = žádná)
let aktualniKapitola = -1;

// Rejstřík: číslo otázky → pole míst v knize [{ kapitola: index, cast: id části }]
// (některé otázky jsou vysvětlené na víc místech; tlačítko otevře první z nich)
const rejstrik = {};

// Kam se vrátit z kapitoly otevřené přes „Vysvětlení v knize“:
// { obrazovka: "kviz" | "vysledek", posun: kam byla stránka odrolovaná }; null = do seznamu kapitol
let navrat = null;

// Popisky tlačítka Zpět podle toho, odkud uživatel do knihy přišel
const POPISKY_NAVRATU = {
  kviz: "← Zpět k otázce",
  vysledek: "← Zpět k výsledku testu",
};

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

// „720, 721, 780–799“ → [720, 721, 780, 781, …, 799]. Neznámé kousky přeskočí.
function cislaOtazek(text) {
  const cisla = [];
  text.split(",").forEach(function (kus) {
    const t = kus.trim();
    let shoda = t.match(/^(\d+)$/);
    if (shoda) {
      cisla.push(Number(shoda[1]));
      return;
    }
    shoda = t.match(/^(\d+)\s*[–-]\s*(\d+)$/);
    if (shoda) {
      for (let c = Number(shoda[1]); c <= Number(shoda[2]); c++) cisla.push(c);
    }
  });
  return cisla;
}

// Řádek „Otázky v testu“: každé číslo je tlačítko, které ukáže znění otázky.
// Čísla jsou jen číslice (z cislaOtazek), takže je lze bezpečně vložit do HTML.
function otazkyHtml(cisla) {
  return (
    '<p class="kniha-otazky">Otázky v testu: ' +
    cisla
      .map(function (c) {
        return '<button type="button" class="kniha-cislo" data-cislo="' + c + '">' + c + "</button>";
      })
      .join(" ") +
    "</p>"
  );
}

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

// Převede celý text kapitoly. Vrátí { nazev, html, casti: [{ id, nazev, otazky }], uvod }.
// "otazky" = čísla z řádků „Otázky:“ v té části, "uvod" = čísla z úvodu před první částí.
function prevedMarkdown(text) {
  const radky = text.split(/\r?\n/);
  const casti = [];
  const uvod = [];
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
      casti.push({ id: id, nazev: nazevCasti, otazky: [] });
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
      // Čísla otázek ze souboru MV, které část vysvětluje
      const cisla = cislaOtazek(radek.trim().match(VZOR_OTAZEK)[1]);
      const kam = casti.length > 0 ? casti[casti.length - 1].otazky : uvod;
      cisla.forEach(function (c) {
        kam.push(c);
      });
      html += otazkyHtml(cisla);
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
  return { nazev: nazev, html: html, casti: casti, uvod: uvod };
}

// --- Seznam kapitol ---------------------------------------------------------

function zpravaKnihy(text) {
  knihaZpravaEl.textContent = text;
  knihaZpravaEl.hidden = !text;
}

// --- Místo čtení (localStorage) ---------------------------------------------

// Vrátí uložené místo čtení, nebo null (nic uloženo, poškozená data, kapitola už neexistuje)
function nactiMistoCteni() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(CTENI_KLIC));
  } catch (chyba) {
    return null; // úložiště nefunguje nebo jsou data poškozená – prostě nic nenabídneme
  }
  if (!data || typeof data.soubor !== "string" || !kniha) return null;
  const index = kniha.kapitoly.findIndex(function (k) {
    return k.soubor === data.soubor;
  });
  if (index < 0) return null;
  return {
    index: index,
    cast: typeof data.cast === "string" ? data.cast : null,
    odsazeni: Number(data.odsazeni) || 0,
  };
}

function ulozMistoCteni(soubor, cast, odsazeni) {
  try {
    localStorage.setItem(CTENI_KLIC, JSON.stringify({
      soubor: soubor,
      cast: cast,
      odsazeni: Math.round(odsazeni),
      datum: new Date().toISOString(),
    }));
  } catch (chyba) {
    console.error(chyba); // bez úložiště se místo čtení jen nezapamatuje
  }
}

// Zjistí, kde v otevřené kapitole uživatel je: poslední část, jejíž začátek už odroloval
// nad horní okraj obrazovky, a o kolik pixelů dál od jejího začátku je.
function zjistiMistoCteni() {
  let cast = null;
  let odsazeni = -kapitolaTextEl.getBoundingClientRect().top; // vůči začátku textu kapitoly
  kapitolaTextEl.querySelectorAll(".kniha-cast").forEach(function (el) {
    const nahore = el.getBoundingClientRect().top;
    if (nahore <= 1) {
      cast = el.id;
      odsazeni = -nahore;
    }
  });
  return { cast: cast, odsazeni: Math.max(0, odsazeni) };
}

// Při rolování si místo ukládáme s malým zpožděním (ne při každém pixelu)
let casovacCteni = null;
window.addEventListener("scroll", function () {
  clearTimeout(casovacCteni);
  casovacCteni = setTimeout(function () {
    const kapitolaViditelna = !document.getElementById("kapitola").hidden;
    if (!kapitolaViditelna || navrat || aktualniKapitola < 0 || !kniha) return;
    const misto = zjistiMistoCteni();
    ulozMistoCteni(kniha.kapitoly[aktualniKapitola].soubor, misto.cast, misto.odsazeni);
  }, 300);
}, { passive: true });

// Tlačítko „Pokračovat ve čtení“ nad seznamem kapitol
function vykresliPokracovaniCteni() {
  const misto = nactiMistoCteni();
  cteniPokracovatEl.hidden = !misto;
  if (!misto) return;

  const kapitola = kniha.kapitoly[misto.index];
  document.getElementById("cteni-pokracovat-nazev").textContent =
    "Pokračovat ve čtení: " + kapitola.nazev;

  // Název části vezmeme z převedené kapitoly (když už je načtená)
  const prevod = prevedeneKapitoly[kapitola.soubor];
  const cast = prevod && misto.cast
    ? prevod.casti.find(function (c) {
        return c.id === misto.cast;
      })
    : null;
  document.getElementById("cteni-pokracovat-popis").textContent =
    cast ? "Část: " + cast.nazev : "Od začátku kapitoly";
}

// Ukáže seznam kapitol (s aktuální nabídkou „Pokračovat ve čtení“)
function ukazSeznamKapitol() {
  if (kniha) vykresliPokracovaniCteni();
  ukazObrazovku("kniha");
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

  // Texty všech kapitol stáhneme hned (jsou malé), abychom sestavili rejstřík otázek.
  // Kapitola, která se nenačte, v rejstříku jen chybí – ostatní fungují dál.
  await Promise.all(
    kniha.kapitoly.map(async function (kapitola, index) {
      try {
        pridejDoRejstriku(index, await prevedenaKapitola(kapitola.soubor));
      } catch (chyba) {
        console.error(chyba);
      }
    })
  );

  // Čísla do manuálu
  manualDalsiHodnoty["kniha-kapitol"] = kniha.kapitoly.length;
  manualDalsiHodnoty["kniha-otazek"] = Object.keys(rejstrik).length;
  doplnManual();
  return true;
}

// Zapíše do rejstříku všechna čísla otázek z jedné převedené kapitoly
function pridejDoRejstriku(indexKapitoly, prevod) {
  function pridej(cislo, cast) {
    const mista = rejstrik[cislo] || (rejstrik[cislo] = []);
    const uzTamJe = mista.some(function (m) {
      return m.kapitola === indexKapitoly && m.cast === cast;
    });
    if (!uzTamJe) mista.push({ kapitola: indexKapitoly, cast: cast });
  }
  prevod.uvod.forEach(function (c) {
    pridej(c, null); // null = úvod kapitoly (začátek stránky)
  });
  prevod.casti.forEach(function (cast) {
    cast.otazky.forEach(function (c) {
      pridej(c, cast.id);
    });
  });
}

// První místo v knize, kde je otázka vysvětlená, nebo null
function mistoVKnize(cislo) {
  const mista = rejstrik[cislo];
  return mista && mista.length > 0 ? mista[0] : null;
}

// --- Čtení kapitoly ---------------------------------------------------------

// Převede kapitolu do HTML (jen poprvé, pak vezme hotový výsledek)
async function prevedenaKapitola(soubor) {
  if (!prevedeneKapitoly[soubor]) {
    prevedeneKapitoly[soubor] = prevedMarkdown(await textKapitoly(soubor));
  }
  return prevedeneKapitoly[soubor];
}

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

// Otevře kapitolu. Nepovinný "cil":
//   { cast, cislo } – vysvětlení otázky: odroluje na část, krátce ji zvýrazní a označí číslo otázky,
//   { cast, odsazeni } – pokračování ve čtení: odroluje na uložené místo.
// Bez cíle začne kapitola nahoře.
async function otevriKapitolu(index, cil) {
  if (!kniha || index < 0 || index >= kniha.kapitoly.length) return;
  const kapitola = kniha.kapitoly[index];
  aktualniKapitola = index;

  kapitolaPoradiEl.textContent = "Kapitola " + (index + 1) + " z " + kniha.kapitoly.length;
  kapitolaPredchoziEl.disabled = index === 0;
  kapitolaDalsiEl.disabled = index === kniha.kapitoly.length - 1;

  let prevod;
  try {
    prevod = await prevedenaKapitola(kapitola.soubor);
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

  kapitolaTextEl.innerHTML = prevod.html; // bezpečné: veškerý text prošel escapujHtml
  vykresliObsahKapitoly(prevod.casti);
  ukazObrazovku("kapitola");
  if (cil && cil.cislo !== undefined) {
    ukazMistoVKapitole(cil);
  } else if (cil) {
    obnovMistoCteni(cil);
  } else if (!navrat) {
    ulozMistoCteni(kapitola.soubor, null, 0); // nová kapitola od začátku
  }
}

// Pokud se obrázky nad cílem ještě načítají, mohou text posunout dolů. Funkce "roluj"
// se proto zavolá hned a krátce po otevření znovu po načtení každého obrázku
// (jen dokud uživatel nezačal rolovat sám).
function drzCil(roluj) {
  roluj();
  const konecSrovnavani = Date.now() + 2000;
  let uzivatelRoluje = false;
  function uzivatelSahl() {
    uzivatelRoluje = true;
  }
  window.addEventListener("touchstart", uzivatelSahl, { once: true, passive: true });
  window.addEventListener("wheel", uzivatelSahl, { once: true, passive: true });
  kapitolaTextEl.querySelectorAll("img").forEach(function (obrazek) {
    if (obrazek.complete) return;
    obrazek.addEventListener("load", function () {
      if (!uzivatelRoluje && Date.now() < konecSrovnavani && !kapitolaTextEl.closest("[hidden]")) {
        roluj();
      }
    }, { once: true });
  });
}

// Odroluje na uložené místo čtení (část + odsazení od jejího začátku)
function obnovMistoCteni(cil) {
  const cast = cil.cast ? document.getElementById(cil.cast) : null;
  // Úvod kapitoly: odsazení je od začátku textu. Když uložená část v kapitole už není
  // (kniha se mezitím změnila), začneme od začátku kapitoly.
  const zaklad = cast || kapitolaTextEl;
  const odsazeni = cast || !cil.cast ? cil.odsazeni : 0;
  drzCil(function () {
    const y = zaklad.getBoundingClientRect().top + window.scrollY + odsazeni;
    window.scrollTo(0, Math.max(0, y));
  });
}

// Odroluje na část kapitoly, krátce ji zvýrazní a označí v ní číslo otázky
function ukazMistoVKapitole(cil) {
  const cast = cil.cast ? document.getElementById(cil.cast) : null;
  const cislo = kapitolaTextEl.querySelector(
    (cast ? "#" + cil.cast + " " : "") + '.kniha-cislo[data-cislo="' + Number(cil.cislo) + '"]'
  );
  if (cislo) cislo.classList.add("kniha-cislo-hledane");
  if (!cast) return; // otázka je v úvodu kapitoly – stačí začátek stránky

  drzCil(function () {
    cast.scrollIntoView({ block: "start" });
  });

  // Zvýraznění je animace v CSS; odebrání a nové přidání třídy ji spustí znovu
  cast.classList.remove("kniha-zvyrazneni");
  void cast.offsetWidth;
  cast.classList.add("kniha-zvyrazneni");
}

// --- Z otázky do knihy a zpět -----------------------------------------------

// Popisky obou tlačítek Zpět v kapitole podle toho, kam se vracíme
function nastavTlacitkaZpet() {
  const popisek = navrat ? POPISKY_NAVRATU[navrat.obrazovka] : "← Seznam kapitol";
  kapitolaZpetEl.textContent = popisek;
  kapitolaSeznamEl.textContent = popisek;
  // Připnuté tlačítko dole na obrazovce (je vidět vždy, ať je kapitola odrolovaná kamkoli)
  kapitolaNavratEl.textContent = popisek;
}

// Otevře v knize vysvětlení otázky. "odkud" je obrazovka, na kterou se pak vrátit
// ("kviz" nebo "vysledek"). Obrazovka zůstane, jak byla (rozpracované kolo se nemění),
// zapamatujeme si jen, kam byla odrolovaná.
function otevriVysvetleni(cislo, odkud) {
  const misto = mistoVKnize(cislo);
  if (!misto) return;
  navrat = { obrazovka: odkud, posun: window.scrollY };
  nastavTlacitkaZpet();
  otevriKapitolu(misto.kapitola, { cast: misto.cast, cislo: cislo });
}

// Tlačítko Zpět v kapitole: k otázce / výsledku testu, nebo do seznamu kapitol
function zpetZKapitoly() {
  if (navrat) {
    const kam = navrat;
    navrat = null;
    nastavTlacitkaZpet();
    ukazObrazovku(kam.obrazovka);
    window.scrollTo(0, kam.posun);
  } else {
    ukazSeznamKapitol();
  }
}

// --- Okno se zněním otázky (klepnutí na číslo v řádku „Otázky v testu“) -----

// Ukáže otázku se správnou odpovědí. Jen náhled – do pokroku se nic nezapisuje.
function ukazOtazkuVOkne(cislo) {
  const o = vsechnyOtazky.find(function (q) {
    return q.cislo === cislo;
  });
  if (!o) return;

  document.getElementById("okno-cislo").textContent = "Otázka č. " + o.cislo + " v souboru MV";
  nastavObrazek(document.getElementById("okno-obrazek"), o);
  document.getElementById("okno-otazka").textContent = o.otazka;

  const odpovediEl = document.getElementById("okno-odpovedi");
  odpovediEl.innerHTML = "";
  o.odpovedi.forEach(function (text, i) {
    const radek = document.createElement("div");
    radek.className = "odpoved" + (i === o.spravna ? " spravne" : "");
    radek.textContent = text + (i === o.spravna ? "  ✓ správně" : "");
    odpovediEl.appendChild(radek);
  });

  if (typeof oknoEl.showModal === "function") {
    oknoEl.showModal();
  } else {
    oknoEl.setAttribute("open", ""); // starší prohlížeč bez <dialog>
  }
  oknoEl.scrollTop = 0;
}

function zavriOkno() {
  if (typeof oknoEl.close === "function") oknoEl.close();
  else oknoEl.removeAttribute("open");
}

// Čísla otázek v textu vznikají při každém vykreslení znovu, proto jedno společné obsloužení
kapitolaTextEl.addEventListener("click", function (udalost) {
  const tlacitko = udalost.target.closest(".kniha-cislo");
  if (tlacitko) ukazOtazkuVOkne(Number(tlacitko.dataset.cislo));
});
document.getElementById("okno-zavrit").addEventListener("click", zavriOkno);
// Ťuknutí na ztmavené pozadí mimo okno ho také zavře
oknoEl.addEventListener("click", function (udalost) {
  if (udalost.target === oknoEl) zavriOkno();
});

// --- Tlačítka ---------------------------------------------------------------

document.getElementById("kniha-otevrit").addEventListener("click", function () {
  // Z menu otevřená kniha se vrací do seznamu kapitol, ne k otázce
  navrat = null;
  nastavTlacitkaZpet();
  ukazSeznamKapitol();
});
cteniPokracovatEl.addEventListener("click", function () {
  const misto = nactiMistoCteni();
  if (misto) otevriKapitolu(misto.index, { cast: misto.cast, odsazeni: misto.odsazeni });
});
document.getElementById("kniha-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});
kapitolaZpetEl.addEventListener("click", zpetZKapitoly);
kapitolaSeznamEl.addEventListener("click", zpetZKapitoly);
kapitolaNavratEl.addEventListener("click", zpetZKapitoly);
kapitolaPredchoziEl.addEventListener("click", function () {
  otevriKapitolu(aktualniKapitola - 1);
});
kapitolaDalsiEl.addEventListener("click", function () {
  otevriKapitolu(aktualniKapitola + 1);
});

// Knihu načteme hned při startu (seznam kapitol i texty kvůli rejstříku)
const nacitaniKnihy = nactiKnihu();

// Ladicí režim (?ladeni=1): kontrola do konzole, že každá otázka má v knize aspoň jedno místo
// a že kniha neodkazuje na otázku, která neexistuje
if (POKROK_LADENI) {
  Promise.all([nacitani, nacitaniKnihy]).then(function (vysledky) {
    if (!vysledky[0] || !vysledky[1]) {
      console.warn("Kontrola rejstříku knihy: otázky nebo kniha se nenačetly.");
      return;
    }
    const existuje = {};
    vsechnyOtazky.forEach(function (o) {
      existuje[o.cislo] = true;
    });
    const bezMista = vsechnyOtazky
      .filter(function (o) {
        return !rejstrik[o.cislo];
      })
      .map(function (o) {
        return o.cislo;
      });
    const neznama = Object.keys(rejstrik)
      .map(Number)
      .filter(function (c) {
        return !existuje[c];
      });
    const naVicMistech = Object.keys(rejstrik).filter(function (c) {
      return rejstrik[c].length > 1;
    });

    if (bezMista.length === 0 && neznama.length === 0) {
      console.info(
        "Kontrola rejstříku knihy: OK – všech " + vsechnyOtazky.length +
        " otázek má v knize aspoň jedno místo (" + naVicMistech.length + " na víc místech: " +
        naVicMistech.join(", ") + ")."
      );
    } else {
      if (bezMista.length > 0) {
        console.warn("Kontrola rejstříku knihy: " + bezMista.length + " otázek nemá v knize místo:", bezMista);
      }
      if (neznama.length > 0) {
        console.warn("Kontrola rejstříku knihy: kniha odkazuje na neexistující otázky:", neznama);
      }
    }
  });
}
