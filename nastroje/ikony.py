"""
Vytvoří ikony aplikace (PWA) do složky ikony/.

Spuštění (ve složce projektu):
    .venv/bin/python nastroje/ikony.py

Ikona: bílý terč s křížem na modrém pozadí (barva aplikace #1f5fbf), pozadí přes celou plochu.

Vznikají dvě sady:
  - ikona-192.png, ikona-512.png (purpose „any“) – běžná ikona, motiv sahá do 72 % plochy,
  - ikona-maskable-192.png, ikona-maskable-512.png (purpose „maskable“) – stejný motiv
    zmenšený na 80 % (sahá asi do 58 % plochy). Android takovou ikonu ořezává do kruhu
    nebo jiného tvaru a zaručeně zobrazí jen vnitřních 80 %, motiv se tak nikdy neořízne.
"""

from pathlib import Path

from PIL import Image, ImageDraw

PROJEKT = Path(__file__).resolve().parent.parent
SLOZKA = PROJEKT / "ikony"
MODRA = (31, 95, 191)
BILA = (255, 255, 255)

# Zmenšení motivu pro maskable ikonu (1.0 = stejně velký jako běžná ikona)
MERITKO_MASKABLE = 0.8


def nakresli(velikost, meritko=1.0):
    """Nakreslí ikonu. meritko zmenší celý motiv (kruhy, kříž i tloušťku čar), pozadí zůstane celé."""
    # Kreslíme 4× větší a pak zmenšíme – okraje kruhů budou hladké
    v = velikost * 4
    obr = Image.new("RGB", (v, v), MODRA)
    d = ImageDraw.Draw(obr)
    stred = v / 2
    m = v * meritko  # velikost, ke které se vztahují rozměry motivu
    tloustka = m * 0.035

    # Tři soustředné kruhy (terč) – největší má poloměr 30 % (krát měřítko)
    for polomer in (0.30, 0.20, 0.10):
        r = m * polomer
        d.ellipse((stred - r, stred - r, stred + r, stred + r), outline=BILA, width=round(tloustka))

    # Střed terče
    r = m * 0.035
    d.ellipse((stred - r, stred - r, stred + r, stred + r), fill=BILA)

    # Kříž přes celý terč
    delka = m * 0.36
    d.line((stred - delka, stred, stred + delka, stred), fill=BILA, width=round(tloustka * 0.6))
    d.line((stred, stred - delka, stred, stred + delka), fill=BILA, width=round(tloustka * 0.6))

    return obr.resize((velikost, velikost), Image.LANCZOS)


def main():
    SLOZKA.mkdir(exist_ok=True)
    for velikost in (192, 512):
        for jmeno, meritko in ((f"ikona-{velikost}.png", 1.0),
                               (f"ikona-maskable-{velikost}.png", MERITKO_MASKABLE)):
            soubor = SLOZKA / jmeno
            nakresli(velikost, meritko).save(soubor, optimize=True)
            print(f"Uloženo {soubor.relative_to(PROJEKT)}")


if __name__ == "__main__":
    main()
