// Cvičný test jako na zkoušce.
//
// Pravidla (časový limit, minimum správných odpovědí) jsou v data/pravidla.json.
// Počty otázek z jednotlivých oblastí jsou v hlavičce data/otazky.json (oblasti → otazek_v_testu).
//
// Využívá z app.js: vsechnyOtazky, oblasti, nacitani, ukazObrazovku, nastavObrazek, slovoOtazek.

// Názvy typů zbrojního oprávnění (klíče odpovídají "minimum_spravnych" v pravidla.json)
const TYPY_OPRAVNENI = {
  obecne: "Obecné zbrojní oprávnění",
  rozsirene: "Rozšířené zbrojní oprávnění",
};

// Pravidla ze souboru data/pravidla.json (část "cvicny_test"), dokud se nenačtou, je tu null
let pravidla = null;

// Stav běžícího testu:
//   typ      – "obecne" nebo "rozsirene"
//   otazky   – vybrané otázky testu
//   odpovedi – pro každou otázku zvolená odpověď (0, 1, 2), nebo null = nezodpovězeno
//   aktualni – pořadí právě zobrazené otázky
//   start, konec – čas začátku a konce limitu v milisekundách (Date.now())
//   casovac  – odkaz na opakovaný časovač, který každou sekundu překresluje odpočet
let test = null;

// --- Sestavení testu --------------------------------------------------------

// Zamíchá pole náhodně (Fisher–Yates) a vrátí nové pole, původní nezmění
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

// Sestaví otázky pro jeden test: z každé oblasti náhodně tolik otázek, kolik určuje
// "otazek_v_testu", bez opakování, a nakonec je všechny promíchá.
// Jde zavolat i samostatně, např. v ladicím režimu v konzoli prohlížeče:
//   sestavTest(vsechnyOtazky, oblasti)
function sestavTest(vsechny, popisOblasti) {
  let vybrane = [];

  Object.keys(popisOblasti).forEach(function (kod) {
    const potreba = popisOblasti[kod].otazek_v_testu;
    const zasobnik = vsechny.filter(function (o) {
      return o.oblast === kod;
    });
    if (zasobnik.length < potreba) {
      throw new Error("Oblast " + kod + " má jen " + zasobnik.length + " otázek, test jich potřebuje " + potreba);
    }
    vybrane = vybrane.concat(zamichej(zasobnik).slice(0, potreba));
  });

  return zamichej(vybrane);
}

// --- Prvky stránky ----------------------------------------------------------
const testStartEl = document.getElementById("test-start");
const testStartPopisEl = document.getElementById("test-start-popis");
const testVyberInfoEl = document.getElementById("test-vyber-info");
const testCasEl = document.getElementById("test-cas");
const testPocitadloEl = document.getElementById("test-pocitadlo");
const testObrazekEl = document.getElementById("test-obrazek");
const testOtazkaEl = document.getElementById("test-otazka");
const testOdpovediEl = document.getElementById("test-odpovedi");
const testMrizkaEl = document.getElementById("test-mrizka");
const vysledekSeznamEl = document.getElementById("vysledek-seznam");

// Celkový počet otázek v testu (součet za oblasti)
function pocetOtazekTestu() {
  return Object.keys(oblasti).reduce(function (soucet, kod) {
    return soucet + oblasti[kod].otazek_v_testu;
  }, 0);
}

// Převede milisekundy na text „mm:ss“
function formatCasu(ms) {
  const sekundy = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(sekundy / 60);
  const sek = sekundy % 60;
  return String(min).padStart(2, "0") + ":" + String(sek).padStart(2, "0");
}

// --- Výběr typu oprávnění ---------------------------------------------------

testStartEl.addEventListener("click", function () {
  if (!pravidla) return; // pravidla se ještě nenačetla nebo chybí
  ukazObrazovku("test-vyber");
});

document.getElementById("test-vyber-zpet").addEventListener("click", function () {
  ukazObrazovku("menu");
});

document.querySelectorAll("#test-vyber [data-typ]").forEach(function (tlacitko) {
  tlacitko.addEventListener("click", function () {
    spustTest(tlacitko.dataset.typ);
  });
});

// --- Průběh testu -----------------------------------------------------------

function spustTest(typ) {
  zastavCasovac();
  const otazkyTestu = sestavTest(vsechnyOtazky, oblasti);
  const start = Date.now();

  test = {
    typ: typ,
    otazky: otazkyTestu,
    odpovedi: otazkyTestu.map(function () {
      return null;
    }),
    aktualni: 0,
    start: start,
    konec: start + pravidla.casovy_limit_minut * 60 * 1000,
    casovac: null,
  };

  vytvorMrizku();
  ukazObrazovku("test");
  testZobrazOtazku();
  aktualizujCas();
  // Čas počítáme podle hodin, ne odpočítáváním – když telefon usne, zůstane přesný
  test.casovac = setInterval(aktualizujCas, 1000);
}

function zastavCasovac() {
  if (test && test.casovac) {
    clearInterval(test.casovac);
    test.casovac = null;
  }
}

// Překreslí odpočet; po vypršení limitu test sám ukončí
function aktualizujCas() {
  const zbyva = test.konec - Date.now();
  testCasEl.textContent = formatCasu(zbyva);
  // Posledních 5 minut je odpočet červený
  testCasEl.classList.toggle("dochazi", zbyva <= 5 * 60 * 1000);
  if (zbyva <= 0) {
    ukonciTest(true);
  }
}

// Zobrazí otázku test.aktualni; zvolená odpověď je zvýrazněná modře, správnost se neukazuje
function testZobrazOtazku() {
  const o = test.otazky[test.aktualni];

  testPocitadloEl.textContent = "Otázka " + (test.aktualni + 1) + " z " + test.otazky.length;
  nastavObrazek(testObrazekEl, o);
  testOtazkaEl.textContent = o.otazka;

  testOdpovediEl.innerHTML = "";
  o.odpovedi.forEach(function (text, index) {
    const tlacitko = document.createElement("button");
    tlacitko.type = "button";
    tlacitko.className = "odpoved";
    if (test.odpovedi[test.aktualni] === index) {
      tlacitko.classList.add("zvolena");
    }
    tlacitko.textContent = text;
    tlacitko.addEventListener("click", function () {
      test.odpovedi[test.aktualni] = index;
      testZobrazOtazku();
    });
    testOdpovediEl.appendChild(tlacitko);
  });

  aktualizujMrizku();
}

function testPrejdiNa(index) {
  if (index < 0 || index >= test.otazky.length) return;
  test.aktualni = index;
  testZobrazOtazku();
  window.scrollTo(0, 0);
}

document.getElementById("test-predchozi").addEventListener("click", function () {
  testPrejdiNa(test.aktualni - 1);
});

document.getElementById("test-dalsi").addEventListener("click", function () {
  testPrejdiNa(test.aktualni + 1);
});

// Mřížka s čísly 1–30 pro rychlý přechod na otázku
function vytvorMrizku() {
  testMrizkaEl.innerHTML = "";
  test.otazky.forEach(function (o, index) {
    const bunka = document.createElement("button");
    bunka.type = "button";
    bunka.className = "mrizka-bunka";
    bunka.textContent = index + 1;
    bunka.addEventListener("click", function () {
      testPrejdiNa(index);
    });
    testMrizkaEl.appendChild(bunka);
  });
}

// Vybarví zodpovězené otázky a označí aktuální
function aktualizujMrizku() {
  testMrizkaEl.querySelectorAll(".mrizka-bunka").forEach(function (bunka, index) {
    bunka.classList.toggle("zodpovezeno", test.odpovedi[index] !== null);
    bunka.classList.toggle("aktualni", index === test.aktualni);
  });
}

function pocetNezodpovezenych() {
  return test.odpovedi.filter(function (odp) {
    return odp === null;
  }).length;
}

document.getElementById("test-ukoncit").addEventListener("click", function () {
  const chybi = pocetNezodpovezenych();
  if (chybi > 0) {
    const otazka = "Nezodpovězeno: " + chybi + " " + slovoOtazek(chybi) + ". Opravdu test ukončit?";
    if (!confirm(otazka)) return;
  }
  ukonciTest(false);
});

document.getElementById("test-zpet").addEventListener("click", function () {
  if (!confirm("Test se zahodí. Opravdu odejít do menu?")) return;
  zastavCasovac();
  test = null;
  ukazObrazovku("menu");
});

// --- Vyhodnocení ------------------------------------------------------------

// casVyprsel = true, když test ukončil časový limit
function ukonciTest(casVyprsel) {
  zastavCasovac();
  const konec = Math.min(Date.now(), test.konec);

  // Spočítáme správné odpovědi celkem i po oblastech
  let spravne = 0;
  const poOblastech = {};
  Object.keys(oblasti).forEach(function (kod) {
    poOblastech[kod] = { spravne: 0, celkem: 0 };
  });
  test.otazky.forEach(function (o, index) {
    const jeSpravne = test.odpovedi[index] === o.spravna;
    if (jeSpravne) spravne++;
    // Do pokroku (pokrok.js) zapíšeme jen zodpovězené otázky – nestihnutá otázka není chyba ve znalostech
    if (test.odpovedi[index] !== null) {
      zaznamenejOdpoved(o.cislo, jeSpravne);
    }
    poOblastech[o.oblast].celkem++;
    if (jeSpravne) poOblastech[o.oblast].spravne++;
  });

  const minimum = pravidla.minimum_spravnych[test.typ];
  const prospel = spravne >= minimum;

  // Hlavička s výsledkem
  const hlavickaEl = document.getElementById("vysledek-hlavicka");
  hlavickaEl.classList.toggle("prospel", prospel);
  hlavickaEl.classList.toggle("neprospel", !prospel);
  document.getElementById("vysledek-titulek").textContent = prospel ? "PROSPĚL" : "NEPROSPĚL";
  document.getElementById("vysledek-skore").textContent =
    spravne + " z " + test.otazky.length + " správně, potřeba je alespoň " + minimum;

  const uplynulo = Math.round((konec - test.start) / 1000);
  document.getElementById("vysledek-info").textContent =
    TYPY_OPRAVNENI[test.typ] +
    " · čas " + Math.floor(uplynulo / 60) + " min " + (uplynulo % 60) + " s" +
    (casVyprsel ? " · Čas vypršel" : "");

  // Výsledky po oblastech
  const oblastiEl = document.getElementById("vysledek-oblasti");
  oblastiEl.innerHTML = "";
  Object.keys(oblasti).forEach(function (kod) {
    const li = document.createElement("li");
    li.textContent = oblasti[kod].nazev + ": " + poOblastech[kod].spravne + " / " + poOblastech[kod].celkem;
    oblastiEl.appendChild(li);
  });

  vykresliPrehled();
  document.getElementById("vysledek-jen-chybne").checked = false;
  vysledekSeznamEl.classList.remove("jen-chybne");
  ukazObrazovku("vysledek");
}

// Přehled všech otázek testu s vaší a správnou odpovědí
function vykresliPrehled() {
  vysledekSeznamEl.innerHTML = "";

  test.otazky.forEach(function (o, index) {
    const zvolena = test.odpovedi[index];
    const polozka = document.createElement("div");
    polozka.className = "karta vysledek-polozka " + (zvolena === o.spravna ? "je-spravne" : "je-chybne");

    const hlavicka = document.createElement("p");
    hlavicka.className = "pocitadlo";
    hlavicka.textContent =
      "Otázka " + (index + 1) + " · č. " + o.cislo + " v PDF · " + oblasti[o.oblast].nazev +
      (zvolena === null ? " · bez odpovědi" : "");
    polozka.appendChild(hlavicka);

    if (o.obrazek) {
      const obrazek = document.createElement("img");
      obrazek.className = "obrazek";
      nastavObrazek(obrazek, o);
      polozka.appendChild(obrazek);
    }

    const text = document.createElement("p");
    text.className = "otazka";
    text.textContent = o.otazka;
    polozka.appendChild(text);

    const seznam = document.createElement("div");
    seznam.className = "odpovedi";
    o.odpovedi.forEach(function (odpoved, i) {
      const radek = document.createElement("div");
      radek.className = "odpoved";
      if (i === o.spravna) radek.classList.add("spravne");
      else if (i === zvolena) radek.classList.add("spatne");
      radek.textContent = odpoved + (i === zvolena ? "  ← vaše odpověď" : "");
      seznam.appendChild(radek);
    });
    polozka.appendChild(seznam);

    vysledekSeznamEl.appendChild(polozka);
  });
}

document.getElementById("vysledek-jen-chybne").addEventListener("change", function (e) {
  vysledekSeznamEl.classList.toggle("jen-chybne", e.target.checked);
});

document.getElementById("vysledek-novy").addEventListener("click", function () {
  spustTest(test.typ);
});

document.getElementById("vysledek-menu").addEventListener("click", function () {
  test = null;
  ukazObrazovku("menu");
});

// --- Načtení pravidel -------------------------------------------------------

async function nactiPravidla() {
  try {
    const odpoved = await fetch("data/pravidla.json");
    if (!odpoved.ok) throw new Error("Soubor nenalezen (kód " + odpoved.status + ")");
    return (await odpoved.json()).cvicny_test;
  } catch (chyba) {
    console.error(chyba);
    return null;
  }
}

// Po načtení otázek i pravidel doplníme popisky a zpřístupníme test
Promise.all([nacitani, nactiPravidla()]).then(function (vysledky) {
  const otazkyNacteny = vysledky[0];
  pravidla = vysledky[1];

  if (!otazkyNacteny || !pravidla) {
    pravidla = null;
    testStartPopisEl.textContent = "Nedostupný – nepodařilo se načíst otázky nebo pravidla.";
    testStartEl.disabled = true;
    return;
  }

  const pocet = pocetOtazekTestu();
  testStartPopisEl.textContent =
    pocet + " " + slovoOtazek(pocet) + " · " + pravidla.casovy_limit_minut + " minut";
  testVyberInfoEl.textContent =
    pocet + " " + slovoOtazek(pocet) + " ze všech oblastí, časový limit " +
    pravidla.casovy_limit_minut + " minut. Správné odpovědi uvidíte až na konci.";

  document.querySelectorAll("[data-minimum]").forEach(function (el) {
    el.textContent = "Nejméně " + pravidla.minimum_spravnych[el.dataset.minimum] + " správných z " + pocet;
  });
  document.querySelectorAll("[data-poznamka]").forEach(function (el) {
    el.textContent = "Cvičný test je neoficiální. Časový limit a minima – " + pravidla.poznamka + ".";
  });
});
