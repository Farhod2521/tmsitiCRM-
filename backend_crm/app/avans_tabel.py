"""Avans (yarim oylik) va bo'lim tabeli — bo'limma-bo'lim davomat jadvali.

Kunlik kod avtomatik olinadi (bitta manba — kadr ham, bo'lim boshlig'i ham bir xil ko'radi):
  dam olish kuni → X, bayram (kadr kalendari) → Б, kadr qo'lda tuzatgan kun → o'sha kod,
  mehnat ta'tili / o'quv ta'tili / bolnichniy / safar / BS (holatlar tarixidan) → М/Т, У/Т, К, Х/С, Б/С,
  dekret → Д, ishga kelgan (yoki hali kelmagan kelajak ish kuni) → 8 (yarim stavka — 4),
  o'tgan ish kuni, kelmagan va sababi belgilanmagan → bo'sh.
Bo'lim boshlig'i qo'lda qo'ygan kod (8/4 dan boshqa) — faqat qulflanmagan ish kunlariga qo'llanadi."""
import io
from calendar import monthrange
from datetime import date, datetime

from sqlalchemy.orm import Session

from . import models
from .routers.attendance import TZ_UZ
from .routers.holidays import month_holidays
from .status_periods import status_code_map

R, S = models.RoleEnum, models.EmployeeStatusEnum

# Avtomatik (ichki) kod → jadvaldagi kod
DISPLAY = {"MT": "М/Т", "O'": "У/Т", "B": "К", "K": "Х/С", "BS": "Б/С", "Д": "Д", "BY": "Б", "X": "X", "8": "8", "": ""}
LEGEND = [
    ("4", "Yarim stavka (4 soat)"), ("8", "Ish kuni (8 soat)"), ("X", "Dam olish"), ("Б", "Bayram"),
    ("К", "Kasallik varaqasi"), ("У/Т", "O'quv ta'tili"), ("М/Т", "Mehnat ta'tili"),
    ("Х/С", "Xizmat safari"), ("Б/С", "Ish haqisiz ta'til"), ("Д", "Dekret"),
]
WORK_CODES = {"8", "4", "Х/С"}                 # I.K. — ishlangan kunlar
ABSENT_CODES = {"М/Т", "У/Т", "К", "Б/С", "Д"}  # I.Km. — ishlanmagan (sababli) kunlar
_EXCLUDED_ROLES = {R.superadmin, R.direktor, R.zamdirektor}
_HEAD_ROLES = (R.bolim_boshligi, R.boshqarma_boshligi)


def _work_code(emp) -> str:
    return "4" if (emp.work_rate or 1) <= 0.5 else "8"


def build(db: Session, year: int, month: int, day_from: int = 1, day_to: int = 15,
          department_id: int | None = None) -> list[dict]:
    """[{id, name, head, rows: [{employee_id, full_name, position, shtat, cells, locked, ik, ikm}]}]"""
    days_in_month = monthrange(year, month)[1]
    day_to = min(day_to, days_in_month)
    days = list(range(day_from, day_to + 1))
    today = datetime.now(TZ_UZ).date()
    d_from, d_to = f"{year:04d}-{month:02d}-{day_from:02d}", f"{year:04d}-{month:02d}-{day_to:02d}"

    # is_active bu yerda filtr emas: ta'til/bolnichniy/safar paytida is_active=False bo'ladi,
    # lekin xodim tabelda turishi va kunlariga М/Т, К ... qo'yilishi kerak
    q = db.query(models.Employee).filter(models.Employee.department_id.isnot(None),
                                         models.Employee.role.notin_(_EXCLUDED_ROLES))
    if department_id is not None:
        q = q.filter(models.Employee.department_id == department_id)
    employees = q.all()
    emp_ids = [e.id for e in employees]

    holidays = month_holidays(db, year, month)
    statuses = status_code_map(db, employees, d_from, d_to)
    att = {(a.employee_id, a.date) for a in db.query(models.Attendance.employee_id, models.Attendance.date)
           .filter(models.Attendance.employee_id.in_(emp_ids), models.Attendance.date >= d_from,
                   models.Attendance.date <= d_to).all()} if emp_ids else set()
    overrides = {(o.employee_id, o.date): o.code for o in db.query(models.TabelOverride)
                 .filter(models.TabelOverride.employee_id.in_(emp_ids), models.TabelOverride.date >= d_from,
                         models.TabelOverride.date <= d_to).all()} if emp_ids else {}
    manual = {(r.employee_id, r.day): r.code for r in db.query(models.TabelRecord)
              .filter(models.TabelRecord.employee_id.in_(emp_ids), models.TabelRecord.year == year,
                      models.TabelRecord.month == month).all()} if emp_ids else {}

    def cell(emp, day: int) -> tuple[str, bool]:
        """(kod, qulflangan) — qulflangan kunni bo'lim boshlig'i o'zgartira olmaydi."""
        d = date(year, month, day)
        iso = d.isoformat()
        if (emp.id, iso) in overrides:
            code = overrides[(emp.id, iso)]
            return (_work_code(emp) if code == "8" else DISPLAY.get(code, code)), True
        if d.weekday() >= 5:
            return "X", True
        if day in holidays:
            return "Б", True
        if (emp.id, iso) in statuses:
            return DISPLAY[statuses[(emp.id, iso)]], True
        if emp.status == S.dekret:
            return "Д", True
        code = _work_code(emp) if (emp.status == S.shafyor_farrosh or (emp.id, iso) in att or d > today) else ""
        m = manual.get((emp.id, day))
        if m and m not in ("8", "4") and m != code:
            code = m   # bo'lim boshlig'i qo'lda belgilagan (masalan, К yoki У/Т)
        return code, False

    by_dept: dict[int, list] = {}
    for e in employees:
        by_dept.setdefault(e.department_id, []).append(e)
    depts = (db.query(models.Department).filter(models.Department.id.in_(list(by_dept)))
             .order_by(models.Department.order_num, models.Department.id).all()) if by_dept else []

    out = []
    for dep in depts:
        staff = by_dept[dep.id]
        head = next((e for e in staff if e.has_role(*_HEAD_ROLES)), None)
        # Bo'lim boshlig'i — birinchi qatorda, qolganlar — familiya bo'yicha
        staff.sort(key=lambda e: (e is not head, e.full_name))
        rows = []
        for e in staff:
            cells, locked = {}, []
            for day in days:
                code, lock = cell(e, day)
                cells[str(day)] = code
                if lock:
                    locked.append(day)
            vals = cells.values()
            rows.append({
                "employee_id": e.id, "full_name": e.full_name, "position": e.position or "",
                "work_rate": e.work_rate or 1, "shtat": f"{fmt_rate(e.work_rate or 1)} st.",
                "is_head": e is head, "cells": cells, "locked": locked,
                "ik": sum(1 for v in vals if v in WORK_CODES),
                "ikm": sum(1 for v in vals if v in ABSENT_CODES),
            })
        out.append({"id": dep.id, "name": dep.name, "head": head.full_name if head else None,
                    "head_position": head.position if head else None, "rows": rows})
    return out


def fmt_rate(r: float) -> str:
    return (f"{r:.2f}".rstrip("0").rstrip(".")).replace(".", ",")


# ── Word (DOCX) ──────────────────────────────────────────────────────────────

BLACK, WKND_FILL = "000000", "BFBFBF"
# Belgilar izohidagi kod kataklari — och ranglar (oq-qora printerda ham yorug' kulrang bo'lib chiqadi)
LEGEND_FILL = {"4": "EAF6FD", "8": "FFFFFF", "X": "E5E5E5", "Б": "FDFBE6", "К": "FDEEEE",
               "У/Т": "EEF3FD", "М/Т": "F5F0FD", "Х/С": "EAF8F1", "Б/С": "FDF3EA", "Д": "FCEFF6"}
MONTHS_UZ = ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"]
# Yakuniy ustunlar (vertikal sarlavha): nomi — qaysi kodlar sanaladi
SUM_COLS = [
    ("Xizmat safari", {"Х/С"}),
    ("Salomatlik ta'tili", {"К"}),
    ("Ta'til", {"М/Т", "У/Т", "Б/С", "Д"}),
]


def build_docx(depts: list[dict], year: int, month: int, day_from: int, day_to: int) -> bytes:
    """"J A D V A L" — ish vaqtini hisoblash jadvali (oq-qora, printer uchun).
    Har bir bo'lim — alohida A4 albom sahifa; bo'lim nomi va bo'lim boshlig'i jadval ichida."""
    from docx import Document
    from docx.enum.section import WD_ORIENT
    from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, Cm, RGBColor

    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
    sec.left_margin = sec.right_margin = Cm(1.0)
    sec.top_margin = sec.bottom_margin = Cm(1.0)
    st = doc.styles["Normal"]
    st.font.name, st.font.size = "Times New Roman", Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    st.paragraph_format.space_after = Pt(0)
    usable = 29.7 - 2 * 1.0   # sm
    C, L = WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT

    def run(p, text, size, bold=True):
        r = p.add_run(text)
        r.bold, r.font.size, r.font.color.rgb = bold, Pt(size), RGBColor.from_string(BLACK)
        return r

    def para(text="", size=11, bold=True, align=None, space_after=0):
        p = doc.add_paragraph()
        if align is not None:
            p.alignment = align
        p.paragraph_format.space_after = Pt(space_after)
        if text:
            run(p, text, size, bold)
        return p

    def tbl_borders(tbl, none=False):
        b = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            e = OxmlElement(f"w:{side}")
            e.set(qn("w:val"), "nil" if none else "single")
            if not none:
                e.set(qn("w:sz"), "6"); e.set(qn("w:color"), BLACK)
            b.append(e)
        tbl._tbl.tblPr.append(b)

    def fixed(tbl, widths_cm):
        tbl.autofit = False
        pr = tbl._tbl.tblPr
        lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); pr.append(lay)
        for old in pr.findall(qn("w:tblW")):
            pr.remove(old)
        tw = OxmlElement("w:tblW"); tw.set(qn("w:w"), str(int(sum(widths_cm) * 567))); tw.set(qn("w:type"), "dxa")
        pr.append(tw)
        mar = OxmlElement("w:tblCellMar")   # tor kun ustunlarida matn bo'linmasin
        for side in ("left", "right"):
            e = OxmlElement(f"w:{side}"); e.set(qn("w:w"), "28"); e.set(qn("w:type"), "dxa"); mar.append(e)
        pr.append(mar)
        for gc, w in zip(tbl._tbl.tblGrid.findall(qn("w:gridCol")), widths_cm):
            gc.set(qn("w:w"), str(int(w * 567)))
        for row in tbl.rows:
            for i, w in enumerate(widths_cm):
                row.cells[i].width = Cm(w)

    def shade(cell, fill):
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), fill)
        cell._tc.get_or_add_tcPr().append(sh)

    def vertical(cell):
        td = OxmlElement("w:textDirection"); td.set(qn("w:val"), "btLr")
        cell._tc.get_or_add_tcPr().append(td)

    def put(cell, text, size=11, bold=True, align=None, pad=1):
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = C if align is None else align
        p.paragraph_format.space_before = p.paragraph_format.space_after = Pt(pad)
        if text:
            run(p, text, size, bold)

    def height(row, cm):
        row.height = Cm(cm)
        row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST

    days = list(range(day_from, day_to + 1))
    oy = MONTHS_UZ[month]
    full = len(days) > 16
    jami_label = "Bir oy mobaynida" if (day_from == 1 and day_to == monthrange(year, month)[1]) else f"{len(days)} kun mobaynida"
    # Ustunlar: № | F.I.O | Lavozim | kunlar... | Xizmat safari | Salomatlik ta'tili | Ta'til | Bir oy mobaynida
    lead_w = [0.7, 3.0, 2.9] if full else [0.9, 4.2, 4.4]
    sum_w = [0.9, 0.9, 0.9, 2.1]
    day_w = (usable - sum(lead_w) - sum(sum_w)) / len(days)
    widths = lead_w + [day_w] * len(days) + sum_w
    ncol = len(widths)
    nd = len(days)
    fs = 9.5 if full else 11            # kun kataklari shrifti
    wkend = [date(year, month, d).weekday() >= 5 for d in days]

    for di, dep in enumerate(depts):
        if di:
            para().add_run().add_break(WD_BREAK.PAGE)

        para("J A D V A L", 13, True, C)
        para(f"{year} yil uchun  {day_from}- dan {day_to}- {oy}gacha ish vaqtini hisoblash.", 12.5, True, C, space_after=6)

        rows = dep["rows"]
        # 0: bo'lim nomi | 1: sarlavha | 2..: xodimlar
        tbl = doc.add_table(rows=2 + len(rows), cols=ncol)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl_borders(tbl); fixed(tbl, widths)

        # Bo'lim nomi
        r0 = tbl.rows[0]; height(r0, 1.0)
        put(r0.cells[0].merge(r0.cells[ncol - 1]), dep["name"], 12.5)

        # Sarlavha
        hr = tbl.rows[1]; height(hr, 3.6)
        hc = hr.cells
        for i, txt in ((0, "№"), (1, "F.I.O"), (2, "Lavozim")):
            put(hc[i], txt, 12)
        for j, d in enumerate(days):
            put(hc[3 + j], str(d), fs + 1)
        for k, (label, _) in enumerate(SUM_COLS):
            cell = hc[3 + nd + k]; vertical(cell); put(cell, label, 10.5)
        put(hc[ncol - 1], jami_label, 10.5)
        th = OxmlElement("w:tblHeader"); th.set(qn("w:val"), "true"); hr._tr.get_or_add_trPr().append(th)

        # Xodimlar
        for ri, row in enumerate(rows):
            tr = tbl.rows[2 + ri]; height(tr, 0.9)
            cs = tr.cells
            put(cs[0], str(ri + 1), 11, False)
            put(cs[1], row["full_name"], 11, False)
            put(cs[2], row["position"], 10.5 if len(row["position"]) < 26 else 9, False)
            vals = []
            for j, d in enumerate(days):
                code = row["cells"].get(str(d), "")
                vals.append(code)
                if wkend[j] and code == "X":
                    shade(cs[3 + j], WKND_FILL)          # dam olish — kulrang katak, ichida "X"
                put(cs[3 + j], code, fs - ((3 if full else 1.5) if len(code) > 1 else 0), False)
            for k, (_, codes) in enumerate(SUM_COLS):
                n = sum(1 for v in vals if v in codes)
                put(cs[3 + nd + k], str(n) if n else "", 11)
            put(cs[ncol - 1], str(row["ik"] or ""), 12)

        # Bo'lim boshlig'i — jadval ostida, chegarasiz
        para(space_after=14)
        sig = doc.add_table(rows=1, cols=2); tbl_borders(sig, none=True)
        fixed(sig, [usable * 0.62, usable * 0.38])
        put(sig.rows[0].cells[0], f"{dep['name']} boshlig'i", 12)
        put(sig.rows[0].cells[1], dep.get("head") or "", 12, align=L)

        # Belgilar izohi — 2 ustun (kod | nomi)
        para(space_after=14)
        half_n = (len(LEGEND) + 1) // 2
        leg = doc.add_table(rows=half_n, cols=4); tbl_borders(leg, none=True)
        fixed(leg, [1.2, 4.6, 1.2, 4.6])
        for k, (code, label) in enumerate(LEGEND):
            rr, cc = k % half_n, (k // half_n) * 2
            shade(leg.rows[rr].cells[cc], LEGEND_FILL.get(code, "FFFFFF"))
            put(leg.rows[rr].cells[cc], code, 11, True, pad=3)
            put(leg.rows[rr].cells[cc + 1], label, 11, False, L, pad=3)
        leg.alignment = WD_TABLE_ALIGNMENT.LEFT

    if not depts:
        para("Ma'lumot yo'q", 12, True, C)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
