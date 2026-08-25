"""IJRO nazorati — muddati eng kam qolgan (yoki o'tib ketgan) 10 ta topshiriqni
ijro.png shabloni ustiga chizib, tayyor rasm (PNG bayt) sifatida qaytaradi.
IJRO roli "Telegram xabar yuborish" tugmasini bosganda shu rasm guruhga yuboriladi."""
import os
import re
from datetime import date, datetime
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(_DIR, "assets", "ijro.png")

_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
_REG_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "C:/Windows/Fonts/times.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
]

NAVY   = (10, 22, 41)
GRAY   = (125, 133, 146)
BLUE   = (20, 40, 245)
RED    = (255, 92, 92)
ORANGE = (200, 140, 0)
GREEN  = (0, 165, 120)

MAX_ROWS = 10
# Har bir qatorning vertikal markazi — shablon jadvalidan piksel bo'yicha o'lchangan.
ROW_Y = [259.5, 317.25, 374.0, 431.0, 487.5, 544.0, 601.0, 657.5, 714.0, 770.5]

NAME_X,    NAME_MAXW    = 215,  195
LAVOZIM_X, LAVOZIM_MAXW = 427,  278
MAZMUN_X,  MAZMUN_MAXW  = 722,  272
HUJJAT_X,  HUJJAT_MAXW  = 1045, 90
HOLATI_CX               = 1308
MUDDATI_X                = 1464

HOLATI_LABELS = {
    "yuborildi":         "Yuborildi",
    "qabul_qilindi":     "Qabul qilindi",
    "bajarilmoqda":      "Bajarilmoqda",
    "tasdiq_kutilmoqda": "Tasdiqlash kutilmoqda",
}
HOLATI_COLORS = {
    "yuborildi":         (63, 140, 255),
    "qabul_qilindi":     (0, 165, 120),
    "bajarilmoqda":      (255, 140, 0),
    "tasdiq_kutilmoqda": (230, 168, 0),
}


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


def _fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: float, start_size: int,
              min_size: int = 10, bold: bool = False) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > min_size:
        f = _font(size, bold)
        if draw.textlength(text, font=f) <= max_width:
            return f
        size -= 1
    return _font(min_size, bold)


def _truncate(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: float) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    while text and draw.textlength(text + "\u2026", font=font) > max_width:
        text = text[:-1]
    return text + "\u2026"


def _wrap_two_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: float) -> tuple[str, str]:
    """Matnni ko'pi bilan 2 qatorga bo'ladi, sig'masa 2-qatorni "…" bilan qisqartiradi."""
    words = text.split()
    line1, i = "", 0
    while i < len(words) and draw.textlength((line1 + " " + words[i]).strip(), font=font) <= max_width:
        line1 = (line1 + " " + words[i]).strip()
        i += 1
    line2 = " ".join(words[i:])
    if line2:
        line2 = _truncate(draw, line2, font, max_width)
    return line1 or _truncate(draw, text, font, max_width), line2


def _short_hujjat_code(raw: str | None) -> str | None:
    """"№ Фармон ПФ-16" -> "ПФ-16" — faqat qisqa kod qoldiriladi."""
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r"^\u2116\s*", "", s)
    s = re.sub(r"(?i)\u0444\u0430\u0440\u043c\u043e\u043d\s*", "", s)
    s = re.sub(r"(?i)\bfarmon\b\s*", "", s)
    return s.strip() or None


def _days_left(dt: date | datetime | None) -> tuple[str, tuple[int, int, int]]:
    if not dt:
        return "\u2014", GRAY
    d = dt.date() if isinstance(dt, datetime) else dt
    n = (d - date.today()).days
    if n < 0:
        return f"{abs(n)} kun o'tgan", RED
    if n == 0:
        return "Bugun", RED
    if n <= 3:
        return f"{n} kun qoldi", ORANGE
    return f"{n} kun qoldi", GREEN


def build_ijro_reminder_image(tasks: list[dict]) -> bytes:
    """tasks: har biri {full_name, position, dept_name, mazmun, hujjat_raqami, holati,
    ijro_muddati, doc_id} — muddati eng yaqinlaridan boshlab, ko'pi bilan 10 ta element
    (chaqiruvchi tomondan allaqachon saralangan va cheklangan bo'lishi kutiladi)."""
    im = Image.open(TEMPLATE_PATH).convert("RGB")
    draw = ImageDraw.Draw(im)

    shown = tasks[:MAX_ROWS]
    for i, t in enumerate(shown):
        y = ROW_Y[i]

        name_f = _fit_font(draw, t["full_name"], NAME_MAXW, 17, min_size=11, bold=True)
        draw.text((NAME_X, y), t["full_name"], font=name_f, fill=NAVY, anchor="lm")

        pos_f, dept_f = _font(13, True), _font(12, False)
        pos_txt  = _truncate(draw, t.get("position") or "\u2014", pos_f, LAVOZIM_MAXW)
        dept_txt = _truncate(draw, t.get("dept_name") or "\u2014", dept_f, LAVOZIM_MAXW)
        draw.text((LAVOZIM_X, y - 9), pos_txt,  font=pos_f,  fill=NAVY, anchor="lm")
        draw.text((LAVOZIM_X, y + 9), dept_txt, font=dept_f, fill=GRAY, anchor="lm")

        mazmun_f = _font(12, False)
        l1, l2 = _wrap_two_lines(draw, t.get("mazmun") or "\u2014", mazmun_f, MAZMUN_MAXW)
        if l2:
            draw.text((MAZMUN_X, y - 9), l1, font=mazmun_f, fill=(70, 80, 95), anchor="lm")
            draw.text((MAZMUN_X, y + 9), l2, font=mazmun_f, fill=(70, 80, 95), anchor="lm")
        else:
            draw.text((MAZMUN_X, y), l1, font=mazmun_f, fill=(70, 80, 95), anchor="lm")

        code = _short_hujjat_code(t.get("hujjat_raqami")) or f"DOC-{t.get('doc_id', '')}"
        code_f = _fit_font(draw, code, HUJJAT_MAXW, 14, min_size=10, bold=True)
        draw.text((HUJJAT_X, y), code, font=code_f, fill=BLUE, anchor="lm")

        h_key = t.get("holati") or "yuborildi"
        h_label = HOLATI_LABELS.get(h_key, h_key)
        h_color = HOLATI_COLORS.get(h_key, GRAY)
        h_f = _fit_font(draw, h_label, 150, 12, min_size=9, bold=True)
        tw = draw.textlength(h_label, font=h_f)
        pad_x, pad_y = 10, 6
        bx0, bx1 = HOLATI_CX - tw / 2 - pad_x, HOLATI_CX + tw / 2 + pad_x
        bg = tuple(min(255, c + int((255 - c) * 0.82)) for c in h_color)
        draw.rounded_rectangle([bx0, y - 13 - pad_y, bx1, y + 13 + pad_y], radius=10, fill=bg)
        draw.text((HOLATI_CX, y), h_label, font=h_f, fill=h_color, anchor="mm")

        muddati = t.get("ijro_muddati")
        date_txt = muddati.strftime("%d.%m.%Y") if muddati else "\u2014"
        rel_txt, rel_color = _days_left(muddati)
        draw.text((MUDDATI_X, y - 9), date_txt, font=_font(13, True), fill=NAVY, anchor="lm")
        draw.text((MUDDATI_X, y + 9), rel_txt,  font=_font(12, True), fill=rel_color, anchor="lm")

    # "Jami: N ta topshiriq" — shablondagi statik "10" ni haqiqiy son bilan almashtiramiz.
    draw.rectangle([98, 850, 295, 876], fill=(253, 253, 253))
    jami_text = f"Jami: {len(shown)} ta topshiriq"
    jami_f = _fit_font(draw, jami_text, 250, 20, min_size=13, bold=True)
    draw.text((100, 862), jami_text, font=jami_f, fill=BLUE, anchor="lm")

    buf = BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()
