"""Kunlik 'Ishga keldim' bosmagan xodimlar ro'yxatini crm.png shabloni ustiga
matn chizib, tayyor rasm (PNG bayt) sifatida qaytaradi — guruhga oddiy matn
o'rniga shu rasm yuboriladi.

Shablon (crm.png) 1024x1536 va 4 ustunli, har birida 18 tadan (jami 70 ta)
raqam oldindan chizilgan bo'sh forma. Bu yerda faqat o'zgaruvchi qismlar
(sana, hafta kuni, xodimlar soni, F.I.Sh. ro'yxati) ustiga yoziladi.
"""
import os
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(_DIR, "crm.png")

_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
_REG_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
]

NAVY   = (10, 22, 41)      # #0A1629 — CRM navy (nomlar, sana matni)
RED    = (230, 0, 0)       # #E60000 — jadval raqamlari bilan bir xil qizil
WHITE  = (255, 255, 255)

MAX_ROWS = 70          # shablon sig'imi (4 ustun x 18 qator)
ROWS_PER_COL = 18

# 4 ustunning "ism yoziladigan" boshlanish X koordinatasi va maksimal kengligi
COL_NAME_X     = [90, 326, 564, 798]
COL_NAME_MAXW  = [156, 155, 152, 157]
ROW_Y_START = 507
ROW_Y_STEP  = 50.7

HEADER_X = [100, 335, 571, 806]   # "ISMI FAMILIYASI" ustun sarlavhasi boshlanishi
HEADER_Y = 452


def _find_font(candidates: list[str]) -> str | None:
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None

_BOLD_PATH = _find_font(_BOLD_CANDIDATES)
_REG_PATH  = _find_font(_REG_CANDIDATES)

_font_cache: dict[tuple[bool, int], ImageFont.FreeTypeFont] = {}


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    key = (bold, size)
    if key not in _font_cache:
        path = _BOLD_PATH if bold else _REG_PATH
        _font_cache[key] = ImageFont.truetype(path, size) if path else ImageFont.load_default(size)
    return _font_cache[key]


def _fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, min_size: int = 12, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Matn berilgan kenglikka sig'guncha shrift o'lchamini kichraytiradi."""
    size = start_size
    while size > min_size:
        f = _font(size, bold)
        if draw.textlength(text, font=f) <= max_width:
            return f
        size -= 1
    return _font(min_size, bold)


def build_reminder_image(date_str: str, weekday: str, count: int, names: list[str]) -> bytes:
    """date_str: '10-08-2026', weekday: 'Dushanba', count: umumiy son,
    names: to'liq ism-familiyalar ro'yxati (shablonga ko'ra birinchi 70 tasi chiziladi)."""
    im = Image.open(TEMPLATE_PATH).convert("RGB")
    draw = ImageDraw.Draw(im)

    # ── Header subtitle ──
    draw.text((152, 100), "XODIMLAR DAVOMATI", font=_font(15, bold=True), fill=RED)

    # ── Sana katagi ──
    date_f = _fit_font(draw, date_str, 150, 27, bold=True)
    draw.text((721, 63), date_str, font=date_f, fill=NAVY, anchor="mm")
    draw.text((721, 92), weekday, font=_font(15, bold=False), fill=(120, 130, 145), anchor="mm")

    # ── Vaqt katagi ──
    draw.text((934, 58), "Har kuni", font=_font(13, bold=False), fill=WHITE, anchor="mm")
    draw.text((934, 89), "09:00 da", font=_font(21, bold=True), fill=WHITE, anchor="mm")

    # ── Qizil banner sarlavhasi ──
    draw.text((225, 197), "\u2018ISHGA KELDIM\u2019 TUGMASINI", font=_font(30, bold=True), fill=WHITE, anchor="lm")
    draw.text((225, 240), "BOSMAGAN XODIMLAR", font=_font(32, bold=True), fill=WHITE, anchor="lm")
    draw.text((225, 283), "Iltimos, saytga kirib \u201cIshga keldim\u201d tugmasini bosing.", font=_font(15, bold=False), fill=(255, 220, 220), anchor="lm")

    # ── To'q ko'k umumiy panel: sarlavha + son ──
    title_prefix = "\u2018ISHGA KELDIM\u2019 TUGMASINI BOSMAGAN XODIMLAR RO\u2018YXATI "
    title_count  = f"({count} NAFAR)"
    bar_font = _font(19, bold=True)
    while draw.textlength(title_prefix + title_count, font=bar_font) > 840 and bar_font.size > 13:
        bar_font = _font(bar_font.size - 1, bold=True)
    x = 130
    draw.text((x, 377), title_prefix, font=bar_font, fill=WHITE, anchor="lm")
    x += draw.textlength(title_prefix, font=bar_font)
    draw.text((x, 377), title_count, font=bar_font, fill=(255, 140, 100), anchor="lm")

    # ── Ustun sarlavhalari ──
    for hx in HEADER_X:
        draw.text((hx, HEADER_Y), "ISMI FAMILIYASI", font=_font(13, bold=True), fill=WHITE, anchor="lm")

    # ── Xodimlar ro'yxati (4 ustun x 18 qator) ──
    shown = names[:MAX_ROWS]
    for i, name in enumerate(shown):
        col = i // ROWS_PER_COL
        row = i % ROWS_PER_COL
        x = COL_NAME_X[col]
        y = ROW_Y_START + row * ROW_Y_STEP
        f = _fit_font(draw, name, COL_NAME_MAXW[col], 19, min_size=11, bold=True)
        draw.text((x, y), name, font=f, fill=NAVY, anchor="lm")

    if count > MAX_ROWS:
        extra = count - MAX_ROWS
        draw.text((COL_NAME_X[3], ROW_Y_START + (ROWS_PER_COL - 1) * ROW_Y_STEP + 30),
                   f"+{extra} yana boshqa xodim", font=_font(13, bold=True), fill=RED, anchor="lm")

    # ── Pastki eslatma banneri ──
    draw.text((180, 1450), "Eslatma: Ishga o\u2018z vaqtida kelish \u2013", font=_font(16, bold=False), fill=NAVY, anchor="lm")
    draw.text((180, 1481), "samarali ishning boshlanishi!", font=_font(19, bold=True), fill=NAVY, anchor="lm")

    buf = BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()
