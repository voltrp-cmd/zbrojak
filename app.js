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
const vysvetleniEl = document.getElementById("vysvetleni");

const chybyStartEl = document.getElementById("chyby-start");
const chybyPopisEl = document.getElementById("chyby-popis");
const chybyDalsiKoloEl = document.getElementById("chyby-dalsi-kolo");

// Pořadí právě zobrazené otázky
let aktualni = 0;

// Co se právě procvičuje: "oblast" (kolo v jedné oblasti), nebo "chyby" (kolo opakování chyb)
let rezim = "oblast";

// Kód oblasti, ve které běží kolo (např. "nauka"); pozice kola se ukládá přes pokrok.js
let aktualniOblast = null;

// Všechny obrazovky aplikace – vždy je vidět jen jedna (používá i test.js)
const OBRAZOVKY = [
  "menu", "oblast-volba", "kviz", "kolo-konec", "chyby-konec", "test-vyber", "test", "vysledek", "manual", "muj-pokrok",
  "kniha", "kapitola",
];

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
  vysvetleniEl.hidden = true;

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

  // V kole oblasti si zapamatujeme, kterou otázku právě vidíte (i při listování posuvníkem)
  if (rezim === "oblast") {
    const pozice = nactiPozici(aktualniOblast);
    if (pozice && pozice.index !== aktualni) {
      pozice.index = aktualni;
      ulozPozici(aktualniOblast, pozice);
    }
  }

  // DOČASNÉ: kontrolní panel z posuvnik.js (při odstranění panelu smazat i tento řádek)
  if (typeof kontrolaPoZobrazeni === "function") kontrolaPoZobrazeni();
}

// Obarví odpovědi po kliknutí: zvolenou zeleně/červeně a správnou vždy zeleně
function vyhodnot(zvolena) {
  const spravna = otazky[aktualni].spravna;
  const tlacitka = odpovediEl.querySelectorAll(".odpoved");

  // Uložíme odpověď do pokroku (pokrok.js)
  zaznamenejOdpoved(otazky[aktualni].cislo, zvolena === spravna);

  // V kole oblasti posuneme uloženou pozici na další otázku a připočteme výsledek kola.
  // Když teď odejdete, pokračuje se až další otázkou – stejnou otázku nezodpovíte dvakrát.
  if (rezim === "oblast") {
    const pozice = nactiPozici(aktualniOblast);
    if (pozice) {
      pozice.index = aktualni + 1;
      pozice.zodpovezeno++;
      if (zvolena === spravna) pozice.spravne++;
      pozice.datum = new Date().toISOString();
      ulozPozici(aktualniOblast, pozice);
    }
  }

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

  // „Vysvětlení v knize“ jen u otázek, které mají v knize místo (rejstřík v kniha.js)
  vysvetleniEl.hidden = !(typeof mistoVKnize === "function" && mistoVKnize(otazky[aktualni].cislo));

  // Na malém displeji mohou být tlačítka pod okrajem obrazovky – posuneme k nim
  (vysvetleniEl.hidden ? dalsiEl : vysvetleniEl).scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Otevře vysvětlení v knize; tlačítko Zpět v knize vrátí přesně sem (kolo se nemění)
vysvetleniEl.addEventListener("click", function () {
  otevriVysvetleni(otazky[aktualni].cislo, "kviz");
});

// Přechod na další otázku. Po poslední otázce kola:
//   - v kole oblasti se kolo dokončí (dokonciKoloOblasti),
//   - v opakování chyb ukážeme obrazovku „Kolo hotovo“.
dalsiEl.addEventListener("click", function () {
  aktualni = aktualni + 1;
  if (aktualni >= otazky.length) {
    if (rezim === "chyby") {
      zobrazKonecKola();
    } else {
      dokonciKoloOblasti();
    }
    return;
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
      zobrazVolbuOblasti(kod);
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

// --- Procvičování oblasti: volba režimu a pokračování ------------------------------

// Popis kola pro uživatele podle uložené pozice:
//   rezim "vse" (všechny otázky) nebo "neumim" (jen co ještě neumím),
//   nahodne true/false (náhodné pořadí, nebo pořadí jako v PDF).
function popisKola(pozice) {
  const coProcvicuji = pozice.rezim === "neumim" ? "jen co ještě neumím" : "všechny otázky";
  // rezim "nahodne" uložila předchozí verze tohoto kroku (jen v ladicích datech)
  const nahodne = pozice.nahodne || pozice.rezim === "nahodne";
  return coProcvicuji + " · " + (nahodne ? "náhodně" : "podle PDF");
}

// Zaškrtávátko „Náhodné pořadí“ – platí pro nové kolo
const volbaNahodneEl = document.getElementById("volba-nahodne");

// Otázky oblasti v pořadí jako v PDF
function otazkyVOblasti(kod) {
  return vsechnyOtazky.filter(function (o) {
    return o.oblast === kod;
  });
}

// Otázky kola podle uloženého pořadí; čísla, která v oblasti už nejsou, vynechá
function otazkyKolaZPozice(kod, pozice) {
  const podleCisla = {};
  otazkyVOblasti(kod).forEach(function (o) {
    podleCisla[o.cislo] = o;
  });
  return pozice.poradi
    .map(function (cislo) {
      return podleCisla[cislo];
    })
    .filter(Boolean);
}

// Vrátí platnou rozpracovanou pozici oblasti i s otázkami kola, nebo null.
// Čísla otázek, které už neexistují (např. jiná verze PDF), se vynechají.
// Když z kola nic nezbude nebo je kolo dokončené, pozice se smaže.
function platnaPozice(kod) {
  const pozice = nactiPozici(kod);
  if (!pozice || !Array.isArray(pozice.poradi)) return null;

  const otazkyKola = otazkyKolaZPozice(kod, pozice);
  if (otazkyKola.length === 0 || pozice.index >= otazkyKola.length) {
    smazPozici(kod);
    return null;
  }
  return { pozice: pozice, otazky: otazkyKola };
}

// Popisky tlačítek „Od začátku“ a „Jen co ještě neumím“ podle zaškrtávátka „Náhodné pořadí“
function aktualizujPopisyVolby(neumim) {
  const poradi = volbaNahodneEl.checked ? "v náhodném pořadí" : "v pořadí jako v PDF";
  document.getElementById("volba-zacatek-popis").textContent = "Všechny otázky " + poradi;
  document.getElementById("volba-neumim-popis").textContent =
    neumim === 0 ? "Všechno v oblasti umíte" : neumim + " " + slovoOtazek(neumim) + " " + poradi;
}

// Obrazovka po kliknutí na oblast: Pokračovat / [Náhodné pořadí] / Od začátku / Jen co ještě neumím
function zobrazVolbuOblasti(kod) {
  aktualniOblast = kod;

  // Kolo dokončené, ale souhrn se ještě neukázal (po poslední odpovědi jste odešli do menu)
  const ulozena = nactiPozici(kod);
  if (ulozena && Array.isArray(ulozena.poradi) && ulozena.zodpovezeno > 0 &&
      ulozena.index >= otazkyKolaZPozice(kod, ulozena).length) {
    dokonciKoloOblasti();
    return;
  }

  const vsechny = otazkyVOblasti(kod);
  const umim = vsechny.filter(function (o) {
    return umimOtazku(o.cislo);
  }).length;
  const neumim = vsechny.length - umim;

  document.getElementById("volba-nazev").textContent = oblasti[kod].nazev;
  document.getElementById("volba-info").textContent =
    "Umím " + umim + " z " + vsechny.length + " " + slovoOtazek(vsechny.length);

  // Pokračovat – jen když je kolo rozpracované
  const rozpracovano = platnaPozice(kod);
  const pokracovatEl = document.getElementById("volba-pokracovat");
  pokracovatEl.hidden = !rozpracovano;
  if (rozpracovano) {
    const p = rozpracovano.pozice;
    document.getElementById("volba-pokracovat-nazev").textContent =
      "Pokračovat od otázky " + (p.index + 1) + " z " + rozpracovano.otazky.length;
    document.getElementById("volba-pokracovat-popis").textContent =
      popisKola(p) + " · naposledy " +
      new Date(p.datum).toLocaleString("cs-CZ", {
        day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
      });
  }

  // Jen co ještě neumím – neaktivní, když umím všechno
  const neumimEl = document.getElementById("volba-neumim");
  neumimEl.disabled = neumim === 0;
  neumimEl.dataset.pocet = neumim; // pro překreslení popisku po změně zaškrtávátka
  aktualizujPopisyVolby(neumim);

  ukazObrazovku("oblast-volba");
}

// Spustí kolo podle uložené pozice (nové i pokračující)
function spustKoloOblasti(otazkyKola, index) {
  rezim = "oblast";
  otazky = otazkyKola;
  aktualni = index;
  const pozice = nactiPozici(aktualniOblast);
  nazevOblastiEl.textContent = oblasti[aktualniOblast].nazev + " · " + popisKola(pozice);

  ukazObrazovku("kviz");
  zobrazOtazku();
}

// Nové kolo: rezimKola "vse" nebo "neumim"; pořadí podle zaškrtávátka „Náhodné pořadí“
function noveKoloOblasti(rezimKola) {
  const nahodne = volbaNahodneEl.checked;
  const rozpracovano = platnaPozice(aktualniOblast);
  if (rozpracovano) {
    const otazka =
      "Začít nové kolo? Rozpracované pokračování od otázky " + (rozpracovano.pozice.index + 1) +
      " z " + rozpracovano.otazky.length + " se zahodí.";
    if (!confirm(otazka)) return;
  }

  let otazkyKola = otazkyVOblasti(aktualniOblast); // pořadí jako v PDF
  if (rezimKola === "neumim") {
    otazkyKola = otazkyKola.filter(function (o) {
      return !umimOtazku(o.cislo);
    });
  }
  if (nahodne) {
    otazkyKola = zamichej(otazkyKola);
  }
  if (otazkyKola.length === 0) return;

  // Pořadí si uložíme, aby šlo pokračovat (i po náhodném zamíchání)
  ulozPozici(aktualniOblast, {
    rezim: rezimKola,
    nahodne: nahodne,
    poradi: otazkyKola.map(function (o) {
      return o.cislo;
    }),
    index: 0,
    zodpovezeno: 0,
    spravne: 0,
    datum: new Date().toISOString(),
  });
  spustKoloOblasti(otazkyKola, 0);
}

// Po poslední otázce kola: ukážeme souhrn kola a pozici smažeme
function dokonciKoloOblasti() {
  const kod = aktualniOblast;
  const pozice = nactiPozici(kod);
  const zodpovezeno = pozice ? pozice.zodpovezeno : 0;
  const spravne = pozice ? pozice.spravne : 0;
  const procent = zodpovezeno > 0 ? Math.round((spravne / zodpovezeno) * 100) : 0;

  const vsechny = otazkyVOblasti(kod);
  const umim = vsechny.filter(function (o) {
    return umimOtazku(o.cislo);
  }).length;

  document.getElementById("kolo-konec-nazev").textContent =
    oblasti[kod].nazev + (pozice ? " · " + popisKola(pozice) : "");
  document.getElementById("kolo-konec-vysledek").textContent =
    "Zodpovězeno " + zodpovezeno + ", správně " + spravne + " (" + procent + " %)";
  document.getElementById("kolo-konec-umim").textContent =
    "Umím teď " + umim + " z " + vsechny.length + " " + slovoOtazek(vsechny.length);

  smazPozici(kod);
  ukazObrazovku("kolo-konec");
}

document.getElementById("kolo-konec-volba").addEventListener("click", function () {
  zobrazVolbuOblasti(aktualniOblast);
});
document.getElementById("kolo-konec-menu").addEventListener("click", function () {
  ukazObrazovku("menu");
});

document.getElementById("volba-pokracovat").addEventListener("click", function () {
  const rozpracovano = platnaPozice(aktualniOblast);
  if (rozpracovano) {
    spustKoloOblasti(rozpracovano.otazky, rozpracovano.pozice.index);
  }
});
document.getElementById("volba-zacatek").addEventListener("click", function () {
  noveKoloOblasti("vse");
});
// Po zaškrtnutí/odškrtnutí „Náhodné pořadí“ přepíšeme popisky tlačítek
volbaNahodneEl.addEventListener("change", function () {
  aktualizujPopisyVolby(Number(document.getElementById("volba-neumim").dataset.pocet));
});
document.getElementById("volba-neumim").addEventListener("click", function () {
  noveKoloOblasti("neumim");
});
document.getElementById("volba-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});

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
