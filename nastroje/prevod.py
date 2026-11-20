"""
Převod oficiálního PDF Ministerstva vnitra s testovými otázkami do JSON.

Spuštění (ve složce projektu):
    .venv/bin/python nastroje/prevod.py
Jen vybrané stránky na zkoušku, výstup jinam:
    .venv/bin/python nastroje/prevod.py --strany 2-5,158 --vystup /cesta/otazky.json

Jak skript poznává části PDF:
  - číslo otázky je tučně na začátku řádku („649.“),
  - text otázky jsou řádky mezi číslem otázky a odpovědí A),
  - odpovědi začínají „A)“, „B)“, „C)“,
  - správná odpověď je psaná kurzívou a má šedý podklad (kontrolujeme obojí),
  - obrázek patří k otázce, jejíž číslo je nad ním.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber
import pdfminer.pdffont

PROJEKT = Path(__file__).resolve().parent.parent
PDF = PROJEKT / "data" / "zdroj" / "otazky-mv.pdf"

ODDILY = {
    "I": "Zákon o zbraních a střelivu",
    "II": "Prováděcí právní předpisy",
    "III": "Jiné právní předpisy",
    "IV": "Nauka o zbraních a střelivu",
    "V": "Zdravotnické minimum",
}

# --- Oprava poškozených písmen -------------------------------------------
# V písmu Calibri jsou spojená písmena (ligatury) uložená bez překladu na text,
# takže by se z nich stal znak „�“. Podle čísla glyfu víme, o co jde.
LIGATURY = {0x19F: "ti", 0x1A1: "tí", 0x14C: "ft"}

_puvodni_to_unichr = pdfminer.pdffont.PDFCIDFont.to_unichr


def _opraveny_to_unichr(self, cid):
    text = _puvodni_to_unichr(self, cid)
    if text == "�" and cid in LIGATURY:
        return LIGATURY[cid]
    return text


pdfminer.pdffont.PDFCIDFont.to_unichr = _opraveny_to_unichr

# --- Pomocné funkce ---------------------------------------------------------
RE_ODDIL = re.compile(r"^(I|II|III|IV|V)\.\s+(.+?):\s*$")
RE_OTAZKA = re.compile(r"^(\d{1,4})\.\s*(.*)$")
# Odpovědi bývají „A)“, výjimečně i malým písmenem „a)“ (otázka 108)
RE_ODPOVED = re.compile(r"^([ABCabc])\)\s*(.*)$")


def podil_pisma(znaky, slovo):
    """Jaká část znaků (bez mezer) má v názvu písma dané slovo, např. 'Bold'."""
    pismena = [z for z in znaky if z["text"].strip()]
    if not pismena:
        return 0
    return sum(slovo in z["fontname"] for z in pismena) / len(pismena)


def ma_sedy_podklad(radek, obdelniky):
    """Leží pod řádkem šedý obdélník (zvýraznění správné odpovědi)?"""
    for r in obdelniky:
        barva = r.get("non_stroking_color")
        if isinstance(barva, (list, tuple)):
            barva = barva[0] if len(barva) == 1 else None
        if not isinstance(barva, (int, float)) or not 0.5 < barva < 0.95:
            continue
        if r["top"] <= radek["top"] + 3 and r["bottom"] >= radek["bottom"] - 3:
            return True
    return False


def spoj(casti):
    """Spojí řádky do jednoho textu a odstraní zbytečné mezery.
    Řádek končící spojovníkem po písmenu („jde-“) se s dalším spojí bez mezery („jde-li“)."""
    text = ""
    for cast in casti:
        cast = cast.strip()
        if re.search(r"\w-$", text):
            text += cast
        else:
            text += " " + cast
    return re.sub(r"\s+", " ", text).strip()


def parsuj_strany(text, pocet):
    """'2-5,158' -> [2, 3, 4, 5, 158]"""
    if not text:
        return list(range(1, pocet + 1))
    vysledek = []
    for kus in text.split(","):
        if "-" in kus:
            od, do = kus.split("-")
            vysledek.extend(range(int(od), int(do) + 1))
        else:
            vysledek.append(int(kus))
    return vysledek


# --- Hlavní převod ----------------------------------------------------------
def preved(strany, slozka_obrazku):
    otazky = []
    oddil = None
    aktualni = None  # rozpracovaná otázka
    odpoved = None  # rozpracovaná odpověď

    def uzavri_otazku():
        if aktualni is not None:
            otazky.append(aktualni)

    with pdfplumber.open(PDF) as pdf:
        for cislo_strany in strany:
            if cislo_strany == 1:
                continue  # titulní strana s obsahem
            strana = pdf.pages[cislo_strany - 1]
            obdelniky = strana.rects

            # Obrázky na stránce (seřazené shora dolů)
            obrazky = sorted(strana.images, key=lambda o: o["top"])

            for radek in strana.extract_text_lines(return_chars=True):
                text = radek["text"].strip()
                znaky = radek["chars"]

                # Číslo stránky dole
                if text.isdigit() and radek["top"] > 760:
                    continue

                # Nadpis oddílu
                m = RE_ODDIL.match(text)
                if m and m.group(1) in ODDILY:
                    oddil = m.group(1)
                    continue

                # Začátek nové otázky (tučné číslo s tečkou)
                m = RE_OTAZKA.match(text)
                if m and podil_pisma(znaky, "Bold") > 0.5:
                    uzavri_otazku()
                    aktualni = {
                        "cislo": int(m.group(1)),
                        "oddil": oddil,
                        "_text": [m.group(2)] if m.group(2) else [],
                        "_odpovedi": [],
                        "obrazek": None,
                        "_strana": cislo_strany,
                        "_top": radek["top"],
                    }
                    odpoved = None
                    continue

                if aktualni is None:
                    continue

                # Začátek odpovědi A) B) C) – jen ve správném pořadí, aby se výčet
                # „a), b)“ uvnitř textu odpovědi nepovažoval za novou odpověď
                m = RE_ODPOVED.match(text)
                ocekavane = "ABC"[len(aktualni["_odpovedi"])] if len(aktualni["_odpovedi"]) < 3 else None
                if m and m.group(1).upper() == ocekavane:
                    odpoved = {
                        "pismeno": m.group(1).upper(),
                        "_text": [m.group(2)],
                        "_znaky": list(znaky),
                        "_podklad": ma_sedy_podklad(radek, obdelniky),
                    }
                    aktualni["_odpovedi"].append(odpoved)
                    continue

                # Pokračování odpovědi, nebo textu otázky
                if odpoved is not None:
                    odpoved["_text"].append(text)
                    odpoved["_znaky"].extend(znaky)
                    odpoved["_podklad"] = odpoved["_podklad"] or ma_sedy_podklad(radek, obdelniky)
                else:
                    aktualni["_text"].append(text)

            # Obrázky přiřadíme otázce, jejíž číslo je nad obrázkem na téže stránce.
            # Některé obrazce jsou složené z víc obrázků (např. u otázky 609 tři
            # řádky značek) – proto je spojíme do jednoho výřezu přes všechny.
            oblasti = {}  # otázka -> [x0, top, x1, bottom]
            for obr in obrazky:
                kandidati = [
                    o for o in otazky + ([aktualni] if aktualni else [])
                    if o["_strana"] == cislo_strany and o["_top"] < obr["top"]
                ]
                if not kandidati:
                    print(f"POZOR: obrázek na str. {cislo_strany} bez otázky", file=sys.stderr)
                    continue
                o = max(kandidati, key=lambda o: o["_top"])
                if o["obrazek"] is not None:
                    print(f"POZOR: otázka {o['cislo']} má obrázky na víc stránkách", file=sys.stderr)
                    continue
                b = oblasti.setdefault(o["cislo"], [obr["x0"], obr["top"], obr["x1"], obr["bottom"]])
                b[:] = [min(b[0], obr["x0"]), min(b[1], obr["top"]),
                        max(b[2], obr["x1"]), max(b[3], obr["bottom"])]

            for o in otazky + ([aktualni] if aktualni else []):
                if o["cislo"] not in oblasti:
                    continue
                slozka_obrazku.mkdir(parents=True, exist_ok=True)
                soubor = slozka_obrazku / f"{o['cislo']}.jpg"
                # Výřez nesmí přesáhnout okraj stránky
                x0, top, x1, bottom = oblasti[o["cislo"]]
                oblast = (max(x0, 0), max(top, 0), min(x1, strana.width), min(bottom, strana.height))
                strana.crop(oblast).to_image(resolution=150).original.convert(
                    "RGB"
                ).save(soubor, quality=85)
                o["obrazek"] = f"data/obrazky/{soubor.name}"

        uzavri_otazku()

    return [dokonci(o) for o in otazky]


def dokonci(o):
    """Z rozpracované otázky udělá výsledný objekt a zapíše případné problémy."""
    # Správnou odpověď určuje šedý podklad. Kurzíva je jen pro kontrolu –
    # u některých otázek (např. 716) chybí, i když podklad je.
    kurziva = [podil_pisma(od["_znaky"], "Italic") > 0.5 for od in o["_odpovedi"]]
    podklad = [od["_podklad"] for od in o["_odpovedi"]]
    spravne = [i for i, p in enumerate(podklad) if p]
    vysledek = {
        "cislo": o["cislo"],
        "oddil": o["oddil"],
        "otazka": spoj(o["_text"]),
        "odpovedi": [spoj(od["_text"]) for od in o["_odpovedi"]],
        "spravna": spravne[0] if len(spravne) == 1 else None,
        "obrazek": o["obrazek"],
    }
    problemy = []
    if [od["pismeno"] for od in o["_odpovedi"]] != ["A", "B", "C"]:
        problemy.append("nemá přesně odpovědi A, B, C")
    if len(spravne) != 1:
        problemy.append(f"počet odpovědí se šedým podkladem je {len(spravne)}")
    upozorneni = []
    if kurziva != podklad:
        upozorneni.append("správná odpověď není v kurzívě (ověřit ručně)")
    if not vysledek["otazka"]:
        problemy.append("prázdný text otázky")
    if "�" in json.dumps(vysledek, ensure_ascii=False):
        problemy.append("obsahuje poškozený znak �")
    vysledek["_problemy"] = problemy
    vysledek["_upozorneni"] = upozorneni
    return vysledek


def main():
    parser = argparse.ArgumentParser(description="Převod PDF s otázkami do JSON")
    parser.add_argument("--strany", help="např. 2-5,158 (výchozí: všechny)")
    parser.add_argument("--vystup", default=str(PROJEKT / "data" / "otazky.json"))
    args = parser.parse_args()

    vystup = Path(args.vystup)
    with pdfplumber.open(PDF) as pdf:
        strany = parsuj_strany(args.strany, len(pdf.pages))

    otazky = preved(strany, vystup.parent / "obrazky")

    # Kontrola a souhrn
    problemy = [(o["cislo"], p) for o in otazky for p in o.pop("_problemy")]
    upozorneni = [(o["cislo"], u) for o in otazky for u in o.pop("_upozorneni")]
    cisla = [o["cislo"] for o in otazky]
    mezery = [(a, b) for a, b in zip(cisla, cisla[1:]) if b != a + 1]
    if mezery:
        problemy.append(("-", f"nesouvislé číslování: {mezery}"))

    print(f"Otázek: {len(otazky)}")
    for kod, nazev in ODDILY.items():
        pocet = sum(o["oddil"] == kod for o in otazky)
        if pocet:
            print(f"  {kod}. {nazev}: {pocet}")
    print(f"S obrázkem: {sum(o['obrazek'] is not None for o in otazky)}")
    print(f"Problémů: {len(problemy)}")
    for cislo, p in problemy:
        print(f"  otázka {cislo}: {p}")
    print(f"Upozornění: {len(upozorneni)}")
    for cislo, u in upozorneni:
        print(f"  otázka {cislo}: {u}")

    data = {
        "zdroj": "Ministerstvo vnitra – testové otázky ke zkoušce odborné způsobilosti",
        "verze_pdf": "2025-12-15",
        "oddily": ODDILY,
        "otazky": otazky,
    }
    vystup.parent.mkdir(parents=True, exist_ok=True)
    vystup.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Uloženo do {vystup}")
    return 1 if problemy else 0


if __name__ == "__main__":
    sys.exit(main())
