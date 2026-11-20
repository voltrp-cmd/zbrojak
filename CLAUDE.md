# Zbroják – pravidla projektu

## O projektu
Výuková PWA aplikace pro přípravu na teoretickou zkoušku ke zbrojnímu oprávnění
v České republice podle zákona č. 90/2024 Sb., o zbraních a střelivu.

## Technologie
- Jen čisté HTML, CSS a JavaScript.
- Žádné frameworky (React, Vue apod.) ani knihovny, pokud to výslovně neschválím.
- Žádné build nástroje (npm, bundlery, transpilery). Soubory musí jít otevřít přímo v prohlížeči.
- Aplikace je PWA (manifest + service worker), aby šla nainstalovat a fungovala offline.

## Spuštění aplikace
- Lokální server (v Terminálu ve složce projektu): `python3 -m http.server 8080`
- Aplikace: http://localhost:8080
- Ladicí režim: http://localhost:8080/?ladeni=1
- Port 8000 nepoužívat, na tomto počítači ho blokuje jiný program.
- Otevření `index.html` dvojklikem nefunguje (prohlížeč pak nenačte `data/otazky.json`).

## Názvy souborů a složek
- Bez diakritiky a bez mezer (např. `posuvnik.js`, ne `posuvník.js` ani `muj soubor.js`).
- Více slov oddělovat pomlčkou nebo podtržítkem (`otazky-mv.pdf`).

## Ladicí nástroje
- Ladicí a kontrolní prvky v aplikaci (např. posuvník otázek `posuvnik.js`) se zapínají
  jen přes parametr v adrese `?ladeni=1` (např. `http://localhost:8080/?ladeni=1`).
- Bez tohoto parametru je běžný uživatel nesmí vidět a jejich skripty se nemají ani načíst.

## Pomocné nástroje (Python)
Všechny pomocné skripty patří do složky `nastroje/` (ne do `scripts/` ani jinam).
Samotná aplikace Python nepotřebuje.

- `nastroje/prevod.py` – převod oficiálního PDF (`data/zdroj/`) do `data/otazky.json`
  a obrázků do `data/obrazky/`. Spouštět přes `.venv/bin/python` (potřebuje pdfplumber).
- `nastroje/kontrola.py` – ověří `data/otazky.json` (unikátní čísla, 3 odpovědi, jedna
  správná, žádný prázdný text, existující obrázky) a vypíše počty po okruzích.
  Stačí `python3 nastroje/kontrola.py`. Spustit po každé změně otázek.
 Knihovny se instalují jen do virtuálního prostředí `.venv` v tomto
projektu, nikdy globálně. Složka `.venv` je v `.gitignore`.

- Aktivace (v Terminálu ve složce projektu): `source .venv/bin/activate`
- Deaktivace: `deactivate`
- Bez aktivace lze spustit přímo: `.venv/bin/python skript.py`
- Instalace knihovny: `.venv/bin/python -m pip install nazev`
- Vytvoření prostředí znovu (např. na jiném počítači): `python3 -m venv .venv` a pak
  `.venv/bin/python -m pip install pdfplumber`
- K PDF nástrojům potřebujeme i `poppler` (`brew install poppler`).

## Mobil na prvním místě
- Navrhuj nejdřív pro úzkou obrazovku telefonu, pak teprve pro větší.
- Tlačítka a odkazy dost velké na ovládání prstem (aspoň 44 × 44 px).
- Žádné vodorovné posouvání stránky, čitelné písmo (aspoň 16 px).

## Jazyk
- Všechny texty v aplikaci piš česky.
- Komentáře v kódu piš česky.

## Jak se mnou pracovat
- Jsem začátečník.
- Dělej malé změny, jednu věc po druhé.
- Po každé změně mi krátce vysvětli, co jsi udělal a proč.

## Git
- Nic necommituj ani nepushuj do gitu. Commity dělám sám.
