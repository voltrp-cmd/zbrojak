"""Sazba knihy Zbroják do PDF A5. Použití: python3 sazba_knihy.py kniha/ vystup.pdf
Potřebuje reportlab, pyphen (české dělení slov) a písma DejaVu (na Linuxu /usr/share/fonts/truetype/dejavu/)."""
import json, re, sys, datetime
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
                                ListFlowable, ListItem, KeepTogether, NextPageTemplate, Table,
                                TableStyle, CondPageBreak, Flowable)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import Image as Obr
import os
from PIL import Image as PILImage

KNIHA, VYSTUP = sys.argv[1], sys.argv[2]
F = '/usr/share/fonts/truetype/dejavu/'
for jm, sb in [('Serif', 'DejaVuSerif'), ('Serif-B', 'DejaVuSerif-Bold'), ('Serif-I', 'DejaVuSerif-Italic'),
               ('Serif-BI', 'DejaVuSerif-BoldItalic'), ('Sans', 'DejaVuSans'), ('Sans-B', 'DejaVuSans-Bold')]:
    pdfmetrics.registerFont(TTFont(jm, F + sb + '.ttf'))
registerFontFamily('Serif', normal='Serif', bold='Serif-B', italic='Serif-I', boldItalic='Serif-BI')
registerFontFamily('Sans', normal='Sans', bold='Sans-B', italic='Sans', boldItalic='Sans-B')

AKCENT = colors.HexColor('#7a3b1d')
SEDA = colors.HexColor('#6b6b6b')
PODKLAD = colors.HexColor('#f6efe9')      # box „Na zkoušce“
PODKLAD2 = colors.HexColor('#eef2ee')     # box „Tip“
PODKLAD3 = colors.HexColor('#f3f3f3')     # shrnutí

SPOL = dict(hyphenationLang='cs_CZ', allowWidows=0, allowOrphans=0, uriWasteReduce=0.3)
zaklad = ParagraphStyle('zaklad', fontName='Serif', fontSize=10.5, leading=14.2,
                        alignment=TA_JUSTIFY, spaceAfter=5, **SPOL)
s = {
    'stitek': ParagraphStyle('stitek', fontName='Sans', fontSize=9, leading=11, textColor=SEDA,
                             spaceAfter=2),
    'kapitola': ParagraphStyle('kapitola', fontName='Sans-B', fontSize=18, leading=22,
                               textColor=AKCENT, spaceAfter=4),
    'linka': None,
    'uvod': ParagraphStyle('uvod', parent=zaklad, fontName='Serif-I', fontSize=10.5, leading=14.5,
                           textColor=colors.HexColor('#333333')),
    'oddil': ParagraphStyle('oddil', fontName='Sans-B', fontSize=12, leading=15, textColor=AKCENT,
                            spaceBefore=12, spaceAfter=5, keepWithNext=1),
    'pododdil': ParagraphStyle('pododdil', fontName='Sans-B', fontSize=10.5, leading=13.5,
                               spaceBefore=6, spaceAfter=3, keepWithNext=1),
    'text': zaklad,
    'polozka': ParagraphStyle('polozka', parent=zaklad, alignment=TA_LEFT, spaceAfter=2),
    'box': ParagraphStyle('box', parent=zaklad, fontSize=10, leading=13.5, spaceAfter=0, alignment=TA_LEFT),
    'popisek': ParagraphStyle('popisek', fontName='Serif-I', fontSize=8.5, leading=11, alignment=TA_CENTER,
                              textColor=colors.HexColor('#444444'), spaceBefore=2, spaceAfter=0, **SPOL),
    'otazky': ParagraphStyle('otazky', fontName='Sans', fontSize=7.5, leading=9.5, textColor=SEDA,
                             spaceBefore=1, spaceAfter=6),
    'zdroj': ParagraphStyle('zdroj', fontName='Sans', fontSize=8, leading=10.5, textColor=SEDA,
                            spaceBefore=2, spaceAfter=8, alignment=TA_LEFT),
    'titul': ParagraphStyle('titul', fontName='Sans-B', fontSize=28, leading=33, textColor=AKCENT,
                            alignment=TA_CENTER),
    'podtitul': ParagraphStyle('podtitul', fontName='Serif', fontSize=12, leading=16, alignment=TA_CENTER),
    'drobne': ParagraphStyle('drobne', fontName='Serif-I', fontSize=9, leading=12.5, alignment=TA_CENTER,
                             textColor=SEDA),
    'cast_cislo': ParagraphStyle('cast_cislo', fontName='Sans', fontSize=11, leading=14, textColor=SEDA,
                                 alignment=TA_CENTER, spaceAfter=6),
    'cast': ParagraphStyle('cast', fontName='Sans-B', fontSize=22, leading=27, textColor=AKCENT,
                           alignment=TA_CENTER, spaceAfter=10),
    'cast_text': ParagraphStyle('cast_text', fontName='Serif-I', fontSize=10.5, leading=14.5,
                                alignment=TA_CENTER, textColor=colors.HexColor('#333333')),
    'obsahnadpis': ParagraphStyle('obsahnadpis', fontName='Sans-B', fontSize=18, leading=22,
                                  textColor=AKCENT, spaceAfter=10),
    'toc0': ParagraphStyle('toc0', fontName='Sans-B', fontSize=9.5, leading=13, spaceBefore=7,
                           textColor=AKCENT),
    'toc1': ParagraphStyle('toc1', fontName='Serif', fontSize=10, leading=13.5, leftIndent=10,
                           firstLineIndent=0),
}

# Uspořádání do částí a číslování kapitol
CASTI = [
    ('01', 'Část první', 'Právní předpisy',
     'Zákon o zbraních a střelivu, prováděcí předpisy, nutná obrana a krajní nouze. '
     'V testu 17 otázek z 30.'),
    ('02', 'Část druhá', 'Zbraně, bezpečnost a zdraví',
     'Nauka o zbraních a střelivu, bezpečné zacházení a zdravotnické minimum. V testu 13 otázek z 30.'),
    ('05', 'Část třetí', 'Praktická část a závěr',
     'Co vás čeká na střelnici, a celá kniha v kostce.'),
]


def inline(t):
    t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    # česká typografie: jednopísmenné předložky a spojky nenechávat na konci řádku
    t = re.sub(r'(?<![\w\-])([vkszouaiVKSZOUAI]) ', '\\1\u00a0', t)
    # čísla s jednotkami držet pohromadě
    t = re.sub(r'(\d) (mm|cm|m|km|J|kg|%|let|dnů|dní|minut|hodin|Kč|ran|nábojů|zbraní|zásahů|stran)\b',
               '\\1\u00a0\\2', t)
    t = t.replace(' – ', '\u00a0– ')
    return t


def box(obsah, podklad, okraj=AKCENT):
    t = Table([[obsah]], colWidths=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), podklad),
        ('LINEBEFORE', (0, 0), (0, -1), 2.2, okraj),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return [Spacer(1, 2), t, Spacer(1, 7)]



def pridej(cilovy, fl):
    """Přidá blok; před podnadpis vloží podmíněný zlom, aby nezůstal osiřelý na konci strany."""
    if isinstance(fl, Paragraph) and fl.style.name == 'pododdil':
        cilovy.append(CondPageBreak(20 * mm))
    cilovy.append(fl)



class ObrazekBlok(KeepTogether):
    """Obrázek (nebo řada obrázků) s popisky. Když se na stranu nevejde, může ho sazba
    posunout až za následující text (na začátek další strany), aby nezůstala prázdná místa."""
    pass


def obrazky_z_radku(r, sirka_ramu):
    """Řádek ![popisek](cesta) ... -> blok s obrázky vedle sebe a popisky pod nimi.
    Všechny obrázky mají jednotnou šířku, aby kapitola působila uspořádaně."""
    nalezy = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', r)
    n = len(nalezy)
    mezera = 4 * mm
    if n == 1:
        sirka = sirka_ramu * 0.78          # jednotná šířka samostatného obrázku
        max_v = 44 * mm
        sloupce = [sirka_ramu]
    else:
        sirka = (sirka_ramu - (n - 1) * mezera) / n
        max_v = 34 * mm if n == 2 else 30 * mm
        sloupce = [sirka + (mezera if i < n - 1 else 0) for i in range(n)]
    bunky_obr, bunky_pop = [], []
    for popisek, cesta in nalezy:
        cesta = os.path.normpath(os.path.join(KNIHA, cesta))
        w, h = PILImage.open(cesta).size
        mer = min(sirka / w, max_v / h)
        if w < 300:                         # malé obrázky (značky) nezvětšovat přes míru
            mer = min(mer, 0.55)
        bunky_obr.append(Obr(cesta, width=w * mer, height=h * mer))
        bunky_pop.append(Paragraph(inline(popisek), s['popisek']))
    if n == 1:
        # popisek stejně široký jako obrázek
        sloupce = [sirka]
    tab = Table([bunky_obr, bunky_pop], colWidths=sloupce)
    tab.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
                             ('VALIGN', (0, 1), (-1, 1), 'TOP'),
                             ('LEFTPADDING', (0, 0), (-1, -1), 1), ('RIGHTPADDING', (0, 0), (-1, -1), 1),
                             ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    tab.hAlign = 'CENTER'
    return ObrazekBlok([Spacer(1, 6), tab, Spacer(1, 8)])


class _Skupina(Flowable):
    """Několik odstavců vykreslených pod sebou jako jeden celek (nedělí se)."""
    def __init__(self, cast):
        super().__init__(); self.cast = cast
    def wrap(self, aw, ah):
        self.width = aw
        self.height = sum(f.wrapOn(self.canv, aw, ah)[1] + f.getSpaceBefore() + f.getSpaceAfter()
                          for f in self.cast)
        return aw, self.height
    def split(self, aw, ah):
        return []
    def drawOn(self, canv, x, y, _sW=0):
        yy = y + self.height
        for f in self.cast:
            yy -= f.getSpaceBefore()
            w, h = f.wrapOn(canv, self.width, 10000)
            yy -= h
            f.drawOn(canv, x, yy, _sW)
            yy -= f.getSpaceAfter()


class Pruzne(Flowable):
    """Úvod + seznam: když se nevejde a na straně zbývá málo místa, jde celé na další stranu;
    když by vznikla velká mezera, rozdělí se (úvod zůstane aspoň s prvními dvěma položkami)."""
    MAX_MEZERA = 30 * mm
    def __init__(self, hlava, cely, prvni, zbytek):
        super().__init__(); self.hlava, self.cely, self.prvni, self.zbytek = hlava, cely, prvni, zbytek
    def wrap(self, aw, ah):
        self.width = aw
        self.height = sum(f.wrapOn(self.canv, aw, ah)[1] + f.getSpaceBefore() + f.getSpaceAfter()
                          for f in self.hlava + [self.cely])
        return aw, self.height
    def split(self, aw, ah):
        if ah < self.MAX_MEZERA or self.zbytek is None:
            return []
        vyska = sum(f.wrapOn(self.canv, aw, ah)[1] + f.getSpaceBefore() + f.getSpaceAfter()
                    for f in self.hlava + [self.prvni])
        if vyska > ah:
            return []
        return [_Skupina(self.hlava + [self.prvni]), self.zbytek]
    def drawOn(self, canv, x, y, _sW=0):
        yy = y + self.height
        for f in self.hlava + [self.cely]:
            yy -= f.getSpaceBefore()
            w, h = f.wrapOn(canv, self.width, 10000)
            yy -= h
            f.drawOn(canv, x, yy, _sW)
            yy -= f.getSpaceAfter()

class Linka(Flowable):
    def __init__(self, sirka=28 * mm):
        super().__init__(); self.sirka = sirka
    def wrap(self, *a): return (self.sirka, 10)
    def draw(self):
        self.canv.setStrokeColor(AKCENT); self.canv.setLineWidth(1.5); self.canv.line(0, 6, self.sirka, 6)


class Znacka(Flowable):
    """Neviditelná značka – nese název kapitoly do záhlaví."""
    def __init__(self, nazev): super().__init__(); self.nazev = nazev
    def wrap(self, *a): return (0, 0)
    def draw(self): pass


class Kniha(BaseDocTemplate):
    aktualni = ''
    otviraci = -1

    def handle_flowable(self, flowables):
        """Obrázek, který se už na stranu nevejde, prohodí s následujícím textem,
        pokud se ten text na stranu vejde celý. Obrázek pak přijde na další stranu."""
        f = flowables[0] if flowables else None
        if isinstance(f, ObrazekBlok) and len(flowables) > 1 and getattr(self, 'frame', None):
            fr = self.frame
            volno = fr._y - fr._y1p
            _, vf = f.wrapOn(self.canv, fr._aW, fr._y2 - fr._y1p)
            g = flowables[1]
            def odstavce(x):
                # všechny odstavce uvnitř skupin (KeepTogether, _Skupina, Pruzne)
                if isinstance(x, Paragraph):
                    return [x]
                vnitrek = getattr(x, '_content', None) or getattr(x, 'cast', None) \
                    or (getattr(x, 'hlava', None) and x.hlava)
                return [o for y in (vnitrek or []) for o in odstavce(y)]
            ods = odstavce(g)
            nadpis = any(o.style.name in ('oddil', 'pododdil', 'kapitola', 'cast', 'otazky') for o in ods) or (
                # odstavec začínající tučným heslem je nové téma -> obrázek za něj nepřesouvat
                bool(ods) and ods[0].text.lstrip().startswith('<b>'))
            if vf > volno and not nadpis and not isinstance(g, (PageBreak, CondPageBreak, ObrazekBlok)) \
                    and getattr(f, '_posunu', 0) < 6:
                try:
                    _, vg = g.wrapOn(self.canv, fr._aW, volno)
                except Exception:
                    vg = volno + 1
                lze = vg + g.getSpaceBefore() <= volno
                if not lze and volno > 25 * mm:
                    # text se vejde aspoň zčásti (rozdělí se) -> obrázek půjde za jeho konec
                    try:
                        lze = len(g.splitOn(self.canv, fr._aW, volno)) > 1
                    except Exception:
                        lze = False
                if lze:
                    f._posunu = getattr(f, '_posunu', 0) + 1
                    flowables[0], flowables[1] = g, f
        return super().handle_flowable(flowables)

    def afterFlowable(self, fl):
        if isinstance(fl, Znacka):
            Kniha.aktualni = fl.nazev
            Kniha.otviraci = self.page
        if isinstance(fl, Paragraph) and fl.style.name in ('kapitola', 'cast'):
            text = fl.getPlainText()
            uroven = 0 if fl.style.name == 'cast' else 1
            key = 'k%d_%s' % (self.page, uroven)
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=uroven, closed=False)
            self.notify('TOCEntry', (uroven, text, self.page, key))


def zahlavi(c, d):
    c.saveState()
    c.setFont('Sans', 7.5); c.setFillColor(SEDA)
    c.drawCentredString(A5[0] / 2, 9 * mm, str(d.page))
    if Kniha.aktualni and d.page != Kniha.otviraci:
        c.drawString(d.leftMargin, A5[1] - 9 * mm, 'Zbroják')
        c.drawRightString(A5[0] - d.rightMargin, A5[1] - 9 * mm, Kniha.aktualni)
        c.setStrokeColor(colors.HexColor('#d9d0c8')); c.setLineWidth(0.4)
        c.line(d.leftMargin, A5[1] - 10.5 * mm, A5[0] - d.rightMargin, A5[1] - 10.5 * mm)
    c.restoreState()


def jen_cislo(c, d):
    c.saveState(); c.setFont('Sans', 7.5); c.setFillColor(SEDA)
    c.drawCentredString(A5[0] / 2, 9 * mm, str(d.page)); c.restoreState()


doc = Kniha(VYSTUP, pagesize=A5, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=17 * mm,
            bottomMargin=17 * mm, title='Zbroják – studijní text', author='Petr (koncept: Claude)',
            subject='Příprava na zkoušku odborné způsobilosti ke zbrojnímu oprávnění')
ram = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate('titul', [ram]),
                      PageTemplate('uvodni', [ram], onPage=jen_cislo),
                      PageTemplate('text', [ram], onPageEnd=zahlavi)])

P = []
dnes = datetime.date.today().strftime('%-d. %-m. %Y')
P += [Spacer(1, 42 * mm), Paragraph('Zbroják', s['titul']), Spacer(1, 3 * mm),
      Table([['']], colWidths=[30 * mm], style=[('LINEABOVE', (0, 0), (-1, -1), 1.5, AKCENT)]),
      Spacer(1, 5 * mm),
      Paragraph('Studijní text k teoretické a praktické části zkoušky odborné způsobilosti '
                'ke zbrojnímu oprávnění', s['podtitul']), Spacer(1, 4 * mm),
      Paragraph('podle zákona č. 90/2024 Sb., o zbraních a střelivu', s['podtitul']),
      Spacer(1, 45 * mm),
      Paragraph('Koncept k revizi · verze ze dne %s' % dnes, s['drobne']),
      Paragraph('Neoficiální výukový text. Otázky: soubor testových otázek MV ČR. Bez záruky správnosti.',
                s['drobne']),
      NextPageTemplate('uvodni'), PageBreak()]

toc = TableOfContents()
toc.levelStyles = [s['toc0'], s['toc1']]
toc.dotsMinLevel = 1
toc.rightColumnWidth = 26
P += [Paragraph('Obsah', s['obsahnadpis']), toc, Spacer(1, 5 * mm)]
P += box(Paragraph('<b>Jak číst tuto knihu.</b> Každá kapitola začíná krátkým úvodem a končí '
                   'shrnutím do kapsy. Rámečky <b>Na zkoušce</b> upozorňují na chytáky v testu, '
                   'rámečky <b>Tip</b> na praktické rady. Šedé řádky „Otázky v testu“ na konci částí '
                   'uvádějí čísla otázek ze souboru MV ČR, které daná část vysvětluje.', s['box']),
         PODKLAD3, SEDA)
P += [NextPageTemplate('text'), PageBreak()]

kap = json.load(open(KNIHA + '/kapitoly.json'))['kapitoly']
cislo_kap = 0
for i, k in enumerate(kap):
    # dělicí strana části
    for prefix, poradi, nazev, popis in CASTI:
        if k['soubor'].startswith(prefix) and (i == 0 or not kap[i - 1]['soubor'].startswith(prefix[:2])):
            if not (prefix == '05' and kap[i - 1]['soubor'].startswith('05')):
                P += [Znacka(''), Spacer(1, 55 * mm),
                      Paragraph(poradi, s['cast_cislo']), Paragraph(nazev, s['cast']),
                      Paragraph(popis, s['cast_text']), PageBreak()]
    radky = open(KNIHA + '/' + k['soubor'], encoding='utf-8').read().splitlines()
    nazev = radky[0].lstrip('# ').strip()
    zavěr = k['soubor'].startswith('06')
    if not zavěr:
        cislo_kap += 1
    kratky = re.sub(r'^Právo [IVX]+: ', '', nazev)
    P += [Znacka(('%d. ' % cislo_kap if not zavěr else '') + kratky)]
    P += [Spacer(1, 14 * mm),
          Paragraph('Kapitola %d' % cislo_kap if not zavěr else 'Na závěr', s['stitek']),
          Paragraph(inline(nazev), s['kapitola']), Linka(), Spacer(1, 4 * mm)]

    odstavec, seznam = [], []
    prvni = [True]
    v_shrnuti = [False]
    shrnuti_obsah = []

    def cil():
        return shrnuti_obsah if v_shrnuti[0] else P

    def vylij_odstavec():
        if not odstavec:
            return
        text = ' '.join(odstavec); odstavec.clear()
        if text.startswith('Zdroj:') or text.startswith('Zdroje:'):
            pridej(cil(), Paragraph(inline(text), s['zdroj'])); return
        if text.startswith('**Na zkoušce:**'):
            pridej(cil(), KeepTogether(box(Paragraph(inline(text), s['box']), PODKLAD, AKCENT))); return
        if text.startswith('**Tip') or text.startswith('**Pozor') or text.startswith('**Důležité'):
            pridej(cil(), KeepTogether(box(Paragraph(inline(text), s['box']), PODKLAD2, colors.HexColor('#4f7a52')))); return
        if re.fullmatch(r'\*\*[^*]+\*\*', text) and len(text) < 90:
            pridej(cil(), Paragraph(inline(text.strip('*')), s['pododdil'])); return
        styl = s['uvod'] if prvni[0] else s['text']
        prvni[0] = False
        pridej(cil(), Paragraph(inline(text), styl))

    def vylij_seznam():
        if not seznam:
            return
        cislovany = seznam[0][0] == 'n'
        def udelej(cast, start, posledni):
            polozky = [ListItem(Paragraph(inline(t), s['polozka']), leftIndent=12 + 12 * u,
                                bulletText=None if cislovany else ('•' if u == 0 else '–'))
                       for _, u, t in cast]
            kw = dict(bulletType='1' if cislovany else 'bullet', bulletFontName='Serif', bulletFontSize=10,
                      leftIndent=14 if cislovany else 12, spaceAfter=5 if posledni else 0)
            if cislovany:
                kw['start'] = start
            return ListFlowable(polozky, **kw)
        c = cil()
        if v_shrnuti[0]:
            c.append(udelej(seznam, 1, True)); seznam.clear(); return
        uvod = c[-1] if c else None
        je_uvod = isinstance(uvod, Paragraph) and (uvod.style.name in ('oddil', 'pododdil')
                                                   or uvod.getPlainText().rstrip().endswith(':'))
        if je_uvod:
            # uvozující řádek a celý jeho seznam držet na jedné straně (pokud se na stranu vejdou);
            # stojí-li před uvozujícím řádkem nadpis, jde na novou stranu s nimi
            hlava = [uvod]
            c.pop()
            while c and isinstance(c[-1], CondPageBreak):
                c.pop()
            if c and isinstance(c[-1], Paragraph) and (
                    c[-1].style.name == 'oddil'
                    or (c[-1].style.name == 'pododdil' and uvod.style.name not in ('oddil', 'pododdil'))):
                hlava.insert(0, c.pop())
            if len(seznam) <= 2:
                c.append(KeepTogether(hlava + [udelej(seznam, 1, True)]))
            else:
                c.append(Pruzne(hlava, udelej(seznam, 1, True), udelej(seznam[:2], 1, False),
                                udelej(seznam[2:], 3, True)))
        elif len(seznam) == 1:
            pridej(c, KeepTogether([udelej(seznam, 1, True)]))
        elif len(seznam) <= 6:
            # kratší seznam nedělit, pokud by tím nevznikla velká mezera
            k = 1 if len(seznam) == 2 else 2
            pridej(c, Pruzne([], udelej(seznam, 1, True), udelej(seznam[:k], 1, False),
                             udelej(seznam[k:], k + 1, True)))
        else:
            pridej(c, udelej(seznam, 1, True))
        seznam.clear()

    def zavri_shrnuti():
        if v_shrnuti[0]:
            v_shrnuti[0] = False
            obsah = [Paragraph('Shrnutí do kapsy', ParagraphStyle('sh', parent=s['oddil'], spaceBefore=0))]
            obsah += shrnuti_obsah
            P.append(CondPageBreak(60 * mm))
            P.extend(box(obsah, PODKLAD3, SEDA))
            shrnuti_obsah.clear()

    for r in radky[1:]:
        if r.strip() == '<!-- nova-strana -->':
            # ruční zalomení: další text začne na nové straně
            vylij_odstavec(); vylij_seznam()
            P.append(PageBreak())
            continue
        if r.startswith('## '):
            vylij_odstavec(); vylij_seznam(); zavri_shrnuti()
            prvni[0] = False
            if r[3:].strip() == 'Shrnutí do kapsy':
                v_shrnuti[0] = True
                continue
            P.append(CondPageBreak(32 * mm))
            P.append(Paragraph(inline(r[3:]), s['oddil']))
        elif r.startswith('!['):
            vylij_odstavec(); vylij_seznam()
            cil().append(obrazky_z_radku(r, doc.width))
        elif r.startswith('Otázky:'):
            vylij_odstavec(); vylij_seznam()
            o = Paragraph('Otázky v testu: ' + r[len('Otázky:'):].strip(), s['otazky'])
            # řádek s otázkami držet s předchozím blokem
            if P and isinstance(P[-1], Paragraph) and P[-1].style.name in ('text', 'uvod') and len(P[-1].getPlainText()) < 260:
                P[-1] = KeepTogether([P[-1], o])
            elif P and isinstance(P[-1], ObrazekBlok):
                # obrázek na konci části: řádek s otázkami jde s ním (nezůstane sám nahoře na straně)
                P[-1] = ObrazekBlok(P[-1]._content[:-1] + [o, Spacer(1, 6)])
            else:
                P.append(o)
        elif re.match(r'^\s*- ', r):
            vylij_odstavec()
            seznam.append(('b', (len(r) - len(r.lstrip(' '))) // 2, r.strip()[2:]))
        elif re.match(r'^\s*\d+\. ', r):
            vylij_odstavec()
            seznam.append(('n', (len(r) - len(r.lstrip(' '))) // 2, re.sub(r'^\s*\d+\. ', '', r)))
        elif r.strip() == '':
            vylij_odstavec(); vylij_seznam()
        else:
            vylij_seznam(); odstavec.append(r.strip())
    vylij_odstavec(); vylij_seznam(); zavri_shrnuti()
    if i < len(kap) - 1:
        P.append(PageBreak())

doc.multiBuild(P)
print('hotovo')
