# Zbroják – pravidla projektu

## O projektu
Výuková PWA aplikace pro přípravu na teoretickou zkoušku ke zbrojnímu oprávnění
v České republice podle zákona č. 90/2024 Sb., o zbraních a střelivu.

## Technologie
- Jen čisté HTML, CSS a JavaScript.
- Žádné frameworky (React, Vue apod.) ani knihovny, pokud to výslovně neschválím.
- Žádné build nástroje (npm, bundlery, transpilery). Soubory musí jít otevřít přímo v prohlížeči.
- Aplikace je PWA (manifest + service worker), aby šla nainstalovat a fungovala offline.

## Pomocné nástroje (Python)
Převod oficiálního PDF s otázkami do JSON dělají skripty v Pythonu. Samotná aplikace
Python nepotřebuje. Knihovny se instalují jen do virtuálního prostředí `.venv` v tomto
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
