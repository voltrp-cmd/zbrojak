"""
Kontrola souboru data/otazky.json.

Spuštění (ve složce projektu):
    python3 nastroje/kontrola.py

Ověří, že:
  - čísla otázek ("cislo") se neopakují,
  - každá otázka má právě 3 odpovědi a jednu správnou ("spravna" je 0, 1 nebo 2),
  - žádný text (otázka ani odpověď) není prázdný,
  - každý odkazovaný obrázek opravdu existuje,
  - každá otázka patří do známého okruhu (oddílu) a známé oblasti zkoušky,
  - každá oblast má aspoň tolik otázek, kolik jich je v testu.
Na konci vypíše počty otázek po okruzích a po oblastech zkoušky.

Používá jen standardní knihovnu Pythonu, nepotřebuje .venv.
Když najde chybu, skončí s kódem 1 (hodí se pro automatické kontroly).
"""

import json
import sys
from collections import Counter
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
SOUBOR = PROJEKT / "data" / "otazky.json"


def je_prazdny(text):
    """Prázdný je text, který chybí, není řetězec, nebo obsahuje jen mezery."""
    return not isinstance(text, str) or not text.strip()


def main():
    data = json.loads(SOUBOR.read_text(encoding="utf-8"))
    oddily = data.get("oddily", {})
    oblasti = data.get("oblasti", {})
    otazky = data.get("otazky", [])
    chyby = []

    # 1) Čísla otázek se nesmí opakovat
    pocty_cisel = Counter(o.get("cislo") for o in otazky)
    for cislo, pocet in sorted(pocty_cisel.items(), key=lambda x: str(x[0])):
        if pocet > 1:
            chyby.append(f"číslo {cislo} se opakuje {pocet}×")

    for poradi, o in enumerate(otazky, start=1):
        # Otázku popíšeme číslem, a když chybí, aspoň pořadím v souboru
        kdo = f"otázka {o.get('cislo', f'#{poradi} (bez čísla)')}"

        if not isinstance(o.get("cislo"), int):
            chyby.append(f"{kdo}: chybí číslo nebo není celé číslo")

        # 2) Právě 3 odpovědi
        odpovedi = o.get("odpovedi")
        if not isinstance(odpovedi, list) or len(odpovedi) != 3:
            pocet = len(odpovedi) if isinstance(odpovedi, list) else 0
            chyby.append(f"{kdo}: má {pocet} odpovědí místo 3")
            odpovedi = odpovedi if isinstance(odpovedi, list) else []

        # 3) Jedna správná odpověď – "spravna" je jedno číslo 0, 1 nebo 2
        spravna = o.get("spravna")
        if not isinstance(spravna, int) or isinstance(spravna, bool) or not 0 <= spravna <= 2:
            chyby.append(f"{kdo}: správná odpověď je {spravna!r}, má být 0, 1 nebo 2")

        # 4) Žádný prázdný text
        if je_prazdny(o.get("otazka")):
            chyby.append(f"{kdo}: prázdný text otázky")
        for i, odpoved in enumerate(odpovedi):
            if je_prazdny(odpoved):
                chyby.append(f"{kdo}: prázdná odpověď {'ABC'[i] if i < 3 else i + 1}")

        # 5) Odkazovaný obrázek existuje (cesta je od složky projektu)
        obrazek = o.get("obrazek")
        if obrazek is not None and not (PROJEKT / obrazek).is_file():
            chyby.append(f"{kdo}: obrázek {obrazek} neexistuje")

        # 6) Známý okruh (oddíl PDF) a známá oblast zkoušky
        if o.get("oddil") not in oddily:
            chyby.append(f"{kdo}: neznámý okruh {o.get('oddil')!r}")
        if o.get("oblast") not in oblasti:
            chyby.append(f"{kdo}: neznámá oblast zkoušky {o.get('oblast')!r}")

    # 7) Každá oblast musí mít aspoň tolik otázek, kolik jich je v testu
    pocty_oblasti = Counter(o.get("oblast") for o in otazky)
    for kod, oblast in oblasti.items():
        if pocty_oblasti.get(kod, 0) < oblast["otazek_v_testu"]:
            chyby.append(f"oblast {kod}: má méně otázek, než je jich v testu")

    # Počty po okruzích
    pocty = Counter(o.get("oddil") for o in otazky)
    print(f"Soubor: {SOUBOR.relative_to(PROJEKT)}")
    print("Počty otázek po okruzích:")
    for kod, nazev in oddily.items():
        print(f"  {kod:>3}. {nazev}: {pocty.get(kod, 0)}")
    print(f"  Celkem: {len(otazky)} (z toho s obrázkem: {sum(o.get('obrazek') is not None for o in otazky)})")

    print(f"\nPočty otázek po oblastech zkoušky (počty v testu: {data.get('oblasti_zdroj', '?')}):")
    for kod, oblast in oblasti.items():
        print(f"  {oblast['nazev']}: {pocty_oblasti.get(kod, 0)} otázek, v testu {oblast['otazek_v_testu']}")
    print(f"  Celkem v testu: {sum(o['otazek_v_testu'] for o in oblasti.values())}")

    if chyby:
        print(f"\nNALEZENO CHYB: {len(chyby)}")
        for c in chyby:
            print(f"  - {c}")
        return 1

    print("\nVšechno v pořádku, žádné chyby.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
