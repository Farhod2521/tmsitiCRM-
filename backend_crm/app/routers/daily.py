"""Bugungi (yoki tanlangan kun) xodimlar davomati ro'yxati — Davomat sahifasidagi
"Bugun" yorlig'i uchun: kelish vaqti, holat, kechikish, ariza/holat (status) va
xodim rasmining kichik nusxasi."""
import base64
import io
from datetime import date as date_cls, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_employee
from ..status_periods import status_code_map
from .attendance import TZ_UZ, APPROVED_NOTE_STATUSES, late_minutes_for
from .holidays import holiday_map

router = APIRouter(prefix="/attendance/daily", tags=["Kunlik davomat"])

R = models.RoleEnum
_VIEW_ROLES = {R.kadr, R.superadmin, R.direktor, R.zamdirektor}
_EXCLUDED_ROLES = {R.superadmin, R.direktor, R.zamdirektor}
_EXCLUDED_STATUSES = {models.EmployeeStatusEnum.shafyor_farrosh, models.EmployeeStatusEnum.dekret}

STATUS_CODE_LABEL = {"MT": "Mehnat ta'tili", "B": "Bolnichniy", "K": "Xizmat safari", "O'": "O'quv ta'tili"}
EMP_STATUS_LABEL = {
    "faol": "Faol", "otpuska": "Mehnat ta'tilida", "dekret": "Dekretda", "shafyor_farrosh": "Texnik xodim",
    "xizmat_safarida": "Xizmat safarida", "oquv_tatilida": "O'quv ta'tilida",
    "mehnatga_layoqatsiz": "Bolnichniy", "online": "Online",
}
NOTE_LABEL = {"kechikish": "Kechikaman", "kelmaslik": "Kelmayman", "obyektda": "Obyektda", "ruxsat": "Ruxsat"}

# Tartib: kechikkanlar tepada (ko'p kechikkan birinchi), keyin kelganlar (erta kelgan birinchi)...
_HOLAT_ORDER = {"kechikkan": 0, "kelgan": 1, "sababli": 2, "tatilda": 3, "kelmagan": 4}


class DailyNote(BaseModel):
    type: str
    label: str
    status: str
    text: Optional[str] = None


class DailyRow(BaseModel):
    employee_id: int
    full_name: str
    position: Optional[str] = None
    department: Optional[str] = None
    avatar: Optional[str] = None          # kichik rasm (data:image/jpeg;base64,...)
    check_in: Optional[str] = None        # "08:12"
    late_min: int = 0
    holat: str                            # kelgan | kechikkan | kelmagan | sababli | tatilda
    holat_label: str
    status: str                           # xodim holati: faol, otpuska, ... (yoki ariza turi)
    status_label: str
    note: Optional[DailyNote] = None
    distance_m: Optional[float] = None


class DailyOut(BaseModel):
    date: str
    day_off: Optional[str] = None         # "Dam olish kuni" / bayram nomi
    rows: List[DailyRow]


# ── Rasm kichik nusxasi (xotirada keshlanadi) ─────────────────────────────────
_THUMB_CACHE: dict[tuple[int, int, str], Optional[str]] = {}


def _thumb(emp: models.Employee) -> Optional[str]:
    src = emp.photo_base64
    if not src:
        return None
    key = (emp.id, len(src), src[-32:])
    if key in _THUMB_CACHE:
        return _THUMB_CACHE[key]
    try:
        raw = base64.b64decode(src.split(",", 1)[1] if src.startswith("data:") else src)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size
        side = min(w, h)
        img = img.crop(((w - side) // 2, (h - side) // 4, (w - side) // 2 + side, (h - side) // 4 + side))
        img.thumbnail((72, 72))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=75)
        out = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        out = None
    if len(_THUMB_CACHE) > 2000:
        _THUMB_CACHE.clear()
    _THUMB_CACHE[key] = out
    return out


# ── Hisob ─────────────────────────────────────────────────────────────────────

def _build(db: Session, day: str, with_avatars: bool = True) -> DailyOut:
    try:
        d = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Sana formati noto'g'ri (YYYY-MM-DD)")

    employees = (
        db.query(models.Employee)
        .filter(models.Employee.role.notin_(list(_EXCLUDED_ROLES)),
                models.Employee.status.notin_(list(_EXCLUDED_STATUSES)))
        .all()
    )
    atts = {a.employee_id: a for a in db.query(models.Attendance).filter(models.Attendance.date == day).all()}
    codes = status_code_map(db, employees, day, day)
    notes: dict[int, models.AttendanceNote] = {}
    for n in (db.query(models.AttendanceNote)
              .filter(models.AttendanceNote.date_from <= day, models.AttendanceNote.date_to >= day)
              .order_by(models.AttendanceNote.created_at).all()):
        notes[n.employee_id] = n        # eng oxirgisi
    holidays = holiday_map(db, day, day)
    day_off = holidays.get(day) or ("Dam olish kuni" if d.weekday() >= 5 else None)

    rows: list[DailyRow] = []
    for e in employees:
        att = atts.get(e.id)
        note = notes.get(e.id)
        approved = note is not None and note.review_status in APPROVED_NOTE_STATUSES
        code = codes.get((e.id, day))
        late = 0
        check_in = None
        if att is not None:
            ci = att.check_in.astimezone(TZ_UZ) if att.check_in.tzinfo is not None else att.check_in
            check_in = ci.strftime("%H:%M")
            late = late_minutes_for(ci)
            if late > 0 and approved:
                holat, holat_label = "kelgan", "Kelgan"          # sababli kechikish
            elif late > 0:
                holat, holat_label = "kechikkan", "Kechikkan"
            else:
                holat, holat_label = "kelgan", "Kelgan"
        elif code:
            holat, holat_label = "tatilda", STATUS_CODE_LABEL.get(code, code)
        elif approved:
            holat, holat_label = "sababli", "Sababli"
        else:
            holat, holat_label = "kelmagan", "Kelmagan"

        # Status ustuni: kunni qamragan ariza bo'lsa — ariza turi, aks holda xodim holati
        if note is not None:
            status, status_label = f"ariza_{note.note_type}", NOTE_LABEL.get(note.note_type, note.note_type)
        elif e.status == models.EmployeeStatusEnum.faol and not e.is_active:
            status, status_label = "faol_emas", "Faol emas"
        else:
            st = e.status.value if hasattr(e.status, "value") else str(e.status)
            status, status_label = st, EMP_STATUS_LABEL.get(st, st)

        rows.append(DailyRow(
            employee_id=e.id, full_name=e.full_name, position=e.position,
            department=e.department.name if e.department else None,
            avatar=_thumb(e) if with_avatars else None,
            check_in=check_in, late_min=late if holat == "kechikkan" else 0,
            holat=holat, holat_label=holat_label, status=status, status_label=status_label,
            note=DailyNote(type=note.note_type, label=NOTE_LABEL.get(note.note_type, note.note_type),
                           status=note.review_status, text=note.text) if note else None,
            distance_m=att.distance_m if att else None,
        ))

    rows.sort(key=lambda r: (
        _HOLAT_ORDER.get(r.holat, 9),
        -r.late_min if r.holat == "kechikkan" else 0,
        r.check_in or "99:99",
        r.full_name,
    ))
    return DailyOut(date=day, day_off=day_off, rows=rows)


def _require(current: models.Employee) -> None:
    if current.role not in _VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")


@router.get("", response_model=DailyOut)
def daily_list(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    _require(current)
    return _build(db, date or datetime.now(TZ_UZ).strftime("%Y-%m-%d"))


@router.get("/xlsx")
def daily_xlsx(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    _require(current)
    day = date or datetime.now(TZ_UZ).strftime("%Y-%m-%d")
    data = _build(db, day, with_avatars=False)

    wb = Workbook()
    ws = wb.active
    ws.title = day
    y, m, dd = day.split("-")
    ws.merge_cells("A1:G1")
    ws["A1"] = f"Xodimlar davomati — {dd}.{m}.{y}" + (f" ({data.day_off})" if data.day_off else "")
    ws["A1"].font = Font(bold=True, size=13)
    ws.append([])
    ws.append(["№", "Xodim", "Bo'lim", "Kelish vaqti", "Holat", "Kechikish", "Status"])
    thin = Side(style="thin", color="FFD9E3F0")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for c in ws[3]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="FFF4F9FD")
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center")
    fills = {"kechikkan": "FFFFF3CD", "kelmagan": "FFFDE2E2", "kelgan": "FFE3F7EC", "sababli": "FFEFF1F5", "tatilda": "FFE3EEFF"}
    for i, r in enumerate(data.rows, 1):
        ws.append([i, r.full_name, r.department or "", r.check_in or "—", r.holat_label,
                   f"{r.late_min} daq" if r.late_min else "—", r.status_label])
        for c in ws[ws.max_row]:
            c.border = border
            c.alignment = Alignment(horizontal="left" if c.column in (2, 3) else "center", vertical="center")
        ws.cell(row=ws.max_row, column=5).fill = PatternFill("solid", fgColor=fills.get(r.holat, "FFFFFFFF"))
    for col, w in zip("ABCDEFG", (5, 28, 34, 13, 16, 12, 16)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A4"

    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="davomat_{day}.xlsx"'},
    )
