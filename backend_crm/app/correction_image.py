"""Davomat vaqti tuzatilganda zamdirektorga boradigan rasm — davomat_tuzatish.png
shabloni ustiga xodim, bo'lim, sana, eski/yangi vaqt, xodim izohi va kadr sababini
yozib, PNG bayt qaytaradi. Qarordan keyin rasmga "TASDIQLANDI"/"BEKOR QILINDI" muhri tushadi."""
import os
from datetime import datetime
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
TEMPLATE_PATH = os.path.join(_DIR, "davomat_tuzatish.png")
_FONTS = os.path.join(_DIR, "fonts")

NAVY = (14, 24, 52)
TEXT = (30, 38, 66)
RED = (226, 30, 45)
GREEN = (0, 140, 80)
ORANGE = (196, 120, 0)
GRAY = (120, 128, 145)

WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]

_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _font(size: int, style: str = "Regular") -> ImageFont.FreeTypeFont:
    key = (style, size)
    if key not in _cache:
        _cache[key] = ImageFont.truetype(os.path.join(_FONTS, f"Inter-{style}.ttf"), size)
    return _cache[key]


def _w(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    return draw.textlength(text, font=font)


def _wrap(draw, text: str, font, max_w: float) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        cand = f"{cur} {word}".strip()
        if _w(draw, cand, font) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _fit_lines(draw, text: str, max_w: float, max_lines: int, sizes: range, style: str):
    """Matn max_lines qatorga sig'adigan eng katta shrift; sig'masa — oxiri "…" bilan kesiladi."""
    for size in sizes:
        f = _font(size, style)
        lines = _wrap(draw, text, f, max_w)
        if len(lines) <= max_lines:
            return f, lines
    f = _font(sizes[-1], style)
    lines = _wrap(draw, text, f, max_w)[:max_lines]
    last = lines[-1]
    while last and _w(draw, last + "…", f) > max_w:
        last = last[:-1]
    lines[-1] = last.rstrip() + "…"
    return f, lines


def _one_line(draw, text: str, max_w: float, size: int, style: str, min_size: int = 16):
    while size > min_size and _w(draw, text, _font(size, style)) > max_w:
        size -= 1
    f = _font(size, style)
    if _w(draw, text, f) > max_w:
        while text and _w(draw, text + "…", f) > max_w:
            text = text[:-1]
        text = text.rstrip() + "…"
    return f, text


def fmt_late(m: Optional[int]) -> str:
    if m is None:
        return ""
    if m <= 0:
        return "kechikmagan"
    h, mm = divmod(m, 60)
    return (f"{h} soat " if h else "") + (f"{mm} daqiqa" if mm or not h else "") + " kechikkan"


STATUS_BAR = {
    "kutilmoqda":  ("TASDIG'INGIZ KUTILMOQDA", (214, 140, 0)),
    "tasdiqlandi": ("TASDIQLANDI — VAQT O'ZGARTIRILDI", (0, 150, 90)),
    "rad_etildi":  ("BEKOR QILINDI — VAQT O'ZGARMADI", (220, 45, 55)),
}


def _status_bar(img: Image.Image, status: str, note: str = "") -> None:
    """Pastki bezak ustiga holat lentasi (kartalarni yopmaydi)."""
    if status not in STATUS_BAR:
        return
    text, color = STATUS_BAR[status]
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = (75, 1160, 1127, 1240)
    d.rounded_rectangle((box[0], box[1] + 6, box[2], box[3] + 6), radius=22, fill=color + (60,))
    d.rounded_rectangle(box, radius=22, fill=color + (245,))
    cy = (box[1] + box[3]) / 2
    f = _font(30, "Bold")
    if note:
        fs = _font(20, "Medium")
        d.text((600, cy - 15), text, font=f, fill=(255, 255, 255, 255), anchor="mm")
        d.text((600, cy + 20), note, font=fs, fill=(255, 255, 255, 235), anchor="mm")
    else:
        d.text((600, cy), text, font=f, fill=(255, 255, 255, 255), anchor="mm")
    img.alpha_composite(layer)


def render(*, full_name: str, department: str, date: str, old_time: Optional[str], new_time: str,
           late_before: Optional[int], late_after: Optional[int], note: Optional[str],
           reason: Optional[str], status: str = "kutilmoqda", status_note: str = "") -> bytes:
    img = Image.open(TEMPLATE_PATH).convert("RGBA")
    draw = ImageDraw.Draw(img)

    # 1) Xodim | Bo'lim (shablon yorlig'i ostida)
    f, t = _one_line(draw, full_name, 290, 30, "Bold", 20)
    draw.text((203, 512), t, font=f, fill=NAVY, anchor="lm")
    if department:
        f, lines = _fit_lines(draw, department, 455, 1, range(24, 18, -1), "Medium")
        if lines[0].endswith("…"):
            f, lines = _fit_lines(draw, department, 455, 2, range(20, 15, -1), "Medium")
        y0 = 512 if len(lines) == 1 else 501
        for i, ln in enumerate(lines):
            draw.text((651, y0 + i * (f.size + 5)), ln, font=f, fill=TEXT, anchor="lm")

    # 2) Sana
    try:
        d = datetime.strptime(date, "%Y-%m-%d")
        sana = f"{d:%d.%m.%Y}  ({WEEKDAYS[d.weekday()]})"
    except ValueError:
        sana = date
    draw.text((203, 638), sana, font=_font(32, "Bold"), fill=NAVY, anchor="lm")

    # 3) Tizimdagi vaqt → yangi vaqt
    if old_time:
        draw.text((212, 778), old_time, font=_font(50, "Bold"), fill=RED, anchor="lm")
    else:
        draw.text((212, 778), "Belgilanmagan", font=_font(30, "Bold"), fill=RED, anchor="lm")
    lb = fmt_late(late_before)
    if lb:
        draw.line((392, 752, 392, 804), fill=(240, 150, 158), width=2)
        f, lines = _fit_lines(draw, lb, 170, 2, range(22, 15, -1), "SemiBold")
        y0 = 778 - (len(lines) - 1) * (f.size + 6) / 2
        for i, ln in enumerate(lines):
            draw.text((408, y0 + i * (f.size + 6)), ln, font=f, fill=RED, anchor="lm")
    draw.text((828, 778), new_time, font=_font(50, "Bold"), fill=GREEN, anchor="lm")
    la = fmt_late(late_after)
    if la:
        draw.line((996, 752, 996, 804), fill=(150, 215, 180), width=2)
        f, lines = _fit_lines(draw, la, 112, 2, range(18, 13, -1), "SemiBold")
        y0 = 778 - (len(lines) - 1) * (f.size + 5) / 2
        for i, ln in enumerate(lines):
            draw.text((1008, y0 + i * (f.size + 5)), ln, font=f,
                      fill=GREEN if la == "kechikmagan" else ORANGE, anchor="lm")

    # 4) Xodim izohi (kulrang quti: 208..1110 × 897..990)
    if note:
        f, lines = _fit_lines(draw, f"“{note}”", 860, 2, range(24, 16, -1), "Italic")
        lh = f.size + 10
        y0 = 943 - (len(lines) - 1) * lh / 2
        for i, ln in enumerate(lines):
            draw.text((230, y0 + i * lh), ln, font=f, fill=TEXT, anchor="lm")
    else:
        draw.text((230, 943), "Sababsiz", font=_font(24, "SemiBold"), fill=RED, anchor="lm")

    # 5) Kadr sababi
    f, lines = _fit_lines(draw, reason or "Ko'rsatilmagan", 890, 2, range(24, 16, -1), "Medium")
    y0 = 1103 if len(lines) == 1 else 1092
    for i, ln in enumerate(lines):
        draw.text((210, y0 + i * (f.size + 6)), ln, font=f, fill=TEXT, anchor="lm")

    _status_bar(img, status, status_note)

    out = BytesIO()
    img.convert("RGB").save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue()


def render_correction(c, status_note: str = "") -> bytes:
    """AttendanceCorrection yozuvidan (employee yuklangan bo'lishi kerak)."""
    e = c.employee
    return render(full_name=e.full_name if e else "—",
                  department=e.department.name if e and e.department else "",
                  date=c.date, old_time=c.old_check_in, new_time=c.new_check_in,
                  late_before=c.late_before, late_after=c.late_after,
                  note=c.note_text, reason=c.reason, status=c.status or "tasdiqlandi",
                  status_note=status_note)
