// Ukládání pokroku do localStorage (úložiště prohlížeče).
//
// Ukládá se jedna položka (JSON) s touto strukturou:
//   {
//     "aplikace": "zbrojak",
//     "verze": 1,                    – verze struktury dat (POKROK_VERZE)
//     "verze_pdf": "2025-12-15",     – z jaké verze PDF jsou čísla otázek
//     "otazky": {                    – jen otázky, na které už padla odpověď
//       "649": { "spravne": 3, "spatne": 1, "serie": 2, "posledni": "2026-11-20T17:05:12.000Z" }
//     },
//     "testy": []                    – historie cvičných testů (krok b)
//   }
// "serie" = kolikrát za sebou byla odpověď správná (špatná odpověď ji vynuluje).
//
// Tento soubor nic nezobrazuje, jen data čte, mění a ukládá.
// Musí se načíst před app.js.

// Otázka se počítá jako „umím“, když na ni byla odpověď správně tolikrát za sebou
const UMIM_HRANICE = 2;

// Verze struktury ukládaných dat; při změně struktury ji zvýšíme a doplníme převod
const POKROK_VERZE = 1;

// V ladicím režimu (?ladeni=1) se pokrok ukládá zvlášť, aby testování nepokazilo skutečný pokrok
const POKROK_LADENI = new URLSearchParams(location.search).get("ladeni") === "1";
const POKROK_KLIC = POKROK_LADENI ? "zbrojak-pokrok-ladeni" : "zbrojak-pokrok";

// Zprávy pro uživatele (poškozená data, nefunkční úložiště…), zobrazí je app.js v menu
const pokrokUpozorneni = [];

// Když je false, pokrok se neukládá (úložiště nefunguje, nebo jsou v něm data novější verze)
let pokrokUkladat = true;

function prazdnyPokrok() {
  return {
    aplikace: "zbrojak",
    verze: POKROK_VERZE,
    verze_pdf: null,
    otazky: {},
    testy: [],
  };
}

// Přečte pokrok z localStorage. Při jakémkoli problému vrátí prázdný pokrok
// a do pokrokUpozorneni zapíše, co se stalo. Uložená data nikdy nesmaže.
function nactiPokrok() {
  let text;
  try {
    text = localStorage.getItem(POKROK_KLIC);
  } catch (chyba) {
    console.error(chyba);
    pokrokUkladat = false;
    pokrokUpozorneni.push("Prohlížeč nedovoluje ukládat data (např. soukromý režim). Pokrok se neuloží.");
    return prazdnyPokrok();
  }

  if (text === null) {
    return prazdnyPokrok(); // první spuštění, nic uloženo
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (chyba) {
    data = null;
  }

  const vypadaSpravne =
    data && data.aplikace === "zbrojak" && typeof data.verze === "number" &&
    data.otazky && typeof data.otazky === "object" && Array.isArray(data.testy);

  if (!vypadaSpravne) {
    // Poškozená data odložíme stranou, nemažeme je
    try {
      localStorage.setItem(POKROK_KLIC + "-poskozeno", text);
    } catch (chyba) {
      console.error(chyba);
    }
    pokrokUpozorneni.push("Uložený pokrok byl poškozený. Byl odložen stranou a začíná se nanovo.");
    return prazdnyPokrok();
  }

  if (data.verze > POKROK_VERZE) {
    // Data z novější verze aplikace – nepřepisovat
    pokrokUkladat = false;
    pokrokUpozorneni.push("Uložený pokrok je z novější verze aplikace. Pokrok se teď neukládá, aby se nepřepsal.");
  }

  return data;
}

function ulozPokrok() {
  if (!pokrokUkladat) return;
  try {
    localStorage.setItem(POKROK_KLIC, JSON.stringify(pokrok));
  } catch (chyba) {
    console.error(chyba);
    pokrokUkladat = false;
    pokrokUpozorneni.push("Pokrok se nepodařilo uložit (úložiště je plné nebo zakázané).");
  }
}

// Zavolá app.js po načtení otázek: ohlídá, že pokrok patří ke stejné verzi PDF
function zkontrolujVerziPdf(verzePdf) {
  if (pokrok.verze_pdf === null) {
    pokrok.verze_pdf = verzePdf;
  } else if (pokrok.verze_pdf !== verzePdf) {
    pokrokUpozorneni.push(
      "Pokrok je uložený k otázkám z PDF verze " + pokrok.verze_pdf + ", teď jsou otázky z verze " +
      verzePdf + ". Čísla otázek nemusí sedět."
    );
  }
}

// Zapíše jednu odpověď na otázku (podle čísla otázky z PDF) a pokrok uloží
function zaznamenejOdpoved(cislo, jeSpravne) {
  const klic = String(cislo);
  const zaznam = pokrok.otazky[klic] || { spravne: 0, spatne: 0, serie: 0, posledni: null };

  if (jeSpravne) {
    zaznam.spravne++;
    zaznam.serie++;
  } else {
    zaznam.spatne++;
    zaznam.serie = 0;
  }
  zaznam.posledni = new Date().toISOString();

  pokrok.otazky[klic] = zaznam;
  ulozPokrok();
}

// Umím otázku? (aspoň UMIM_HRANICE správných odpovědí za sebou)
function umimOtazku(cislo) {
  const zaznam = pokrok.otazky[String(cislo)];
  return Boolean(zaznam) && zaznam.serie >= UMIM_HRANICE;
}

// Načteme pokrok hned při startu
let pokrok = nactiPokrok();
if (POKROK_LADENI) {
  pokrokUpozorneni.push("Ladicí režim: pokrok se ukládá zvlášť a neovlivní běžný pokrok.");
}
