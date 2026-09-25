"""Xodim holatlari (mehnat ta'tili, bolnichniy, safar, o'quv ta'tili) tarixi.

Employee.status / status_date_from / status_date_to faqat JORIY holatni saqlaydi
va muddat tugagach tozalanadi — shuning uchun tabel o'tgan kunlar uchun
EmployeeStatusPeriod jadvalidan o'qiydi.
"""
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from . import models

S = models.EmployeeStatusEnum

# Tabel kodi — holat
STATUS_CODE = {
    S.otpuska:             "MT",
    S.oquv_tatilida:       "O'",
    S.xizmat_safarida:     "K",
    S.mehnatga_layoqatsiz: "B",
}

# Muddatli (sanadan-sanagacha) holatlar — tarixga yoziladi, kelajakdagisi "rejalashtirilgan"
RANGE_STATUSES = set(STATUS_CODE) | {S.online}

# Bo'lim boshlig'i qo'lda to'ldirgan tabel kodlari -> holat (eski tarixni tiklash uchun)
_MANUAL_TABEL_CODE = {
    "М/Т": S.otpuska, "MT": S.otpuska,
    "Б": S.mehnatga_layoqatsiz, "B": S.mehnatga_layoqatsiz,
    "К": S.xizmat_safarida, "K": S.xizmat_safarida,
    "У/Т": S.oquv_tatilida, "O'": S.oquv_tatilida,
}


def _d(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def status_code_map(db: Session, employees: list, date_from: str, date_to: str) -> dict[tuple[int, str], str]:
    """{(employee_id, "YYYY-MM-DD"): "MT"/"B"/"K"/"O'"} — berilgan oraliqda
    tarixdagi va joriy muddatli holatlar bo'yicha."""
    emp_ids = [e.id for e in employees]
    result: dict[tuple[int, str], str] = {}
    if not emp_ids:
        return result

    def put(emp_id: int, status, frm: str, to: str):
        code = STATUS_CODE.get(status)
        if not code or not frm or not to:
            return
        d, end = _d(max(frm, date_from)), _d(min(to, date_to))
        while d <= end:
            result[(emp_id, d.isoformat())] = code
            d += timedelta(days=1)

    periods = (
        db.query(models.EmployeeStatusPeriod)
        .filter(
            models.EmployeeStatusPeriod.employee_id.in_(emp_ids),
            models.EmployeeStatusPeriod.date_from <= date_to,
            models.EmployeeStatusPeriod.date_to >= date_from,
        )
        .order_by(models.EmployeeStatusPeriod.created_at)
        .all()
    )
    for p in periods:
        put(p.employee_id, p.status, p.date_from, p.date_to)
    # Joriy holat (tarixga yozilmagan bo'lsa ham) — eski ma'lumotlar bilan moslik uchun
    for e in employees:
        if e.status_date_from and e.status_date_to:
            put(e.id, e.status, e.status_date_from, e.status_date_to)
    return result


def on_status_change(db: Session, emp: models.Employee, new_status, new_from: str | None,
                     new_to: str | None, actor_id: int | None) -> None:
    """set-status chaqirilganda tarixni yangilaydi (commit qilmaydi).
    - avvalgi joriy muddatli holat: yangisi boshlanishidan (yoki bugundan) bir kun
      oldin tugaydigan qilib qisqartiriladi; hali boshlanmagan bo'lsa — o'chiriladi;
    - yangi muddatli holat — tarixga qo'shiladi."""
    today = date.today()
    if emp.status_date_from and emp.status_date_to:
        prev = (
            db.query(models.EmployeeStatusPeriod)
            .filter(
                models.EmployeeStatusPeriod.employee_id == emp.id,
                models.EmployeeStatusPeriod.status == emp.status,
                models.EmployeeStatusPeriod.date_from == emp.status_date_from,
                models.EmployeeStatusPeriod.date_to == emp.status_date_to,
            )
            .first()
        )
        if prev is None and emp.status in RANGE_STATUSES:
            prev = models.EmployeeStatusPeriod(
                employee_id=emp.id, status=emp.status, date_from=emp.status_date_from,
                date_to=emp.status_date_to, source="joriy", created_by=actor_id,
            )
            db.add(prev)
        if prev is not None:
            cut = (_d(new_from) if new_from else today) - timedelta(days=1)
            if cut < _d(prev.date_from):
                db.delete(prev)
            elif cut < _d(prev.date_to):
                prev.date_to = cut.isoformat()

    if new_status in RANGE_STATUSES and new_from and new_to:
        db.add(models.EmployeeStatusPeriod(
            employee_id=emp.id, status=new_status, date_from=new_from, date_to=new_to,
            source="kadr", created_by=actor_id,
        ))


def is_future(date_from: str | None) -> bool:
    return bool(date_from) and _d(date_from) > date.today()


def defer_premature_statuses(db: Session) -> int:
    """Boshlanish sanasi hali kelmagan joriy holat (eski kod kelajakdagi ta'tilni
    darhol qo'ygan: masalan, bugun 25.09, holat "05.10–25.10 mehnat ta'tilida") —
    rejalashtirilganga aylantiriladi: tarixda saqlanadi, xodim hozircha "faol"."""
    today = date.today().isoformat()
    emps = (
        db.query(models.Employee)
        .filter(models.Employee.status.in_(list(RANGE_STATUSES)),
                models.Employee.status_date_from > today,
                models.Employee.status_date_to.isnot(None))
        .all()
    )
    for e in emps:
        exists = db.query(models.EmployeeStatusPeriod.id).filter(
            models.EmployeeStatusPeriod.employee_id == e.id,
            models.EmployeeStatusPeriod.status == e.status,
            models.EmployeeStatusPeriod.date_from == e.status_date_from,
            models.EmployeeStatusPeriod.date_to == e.status_date_to,
        ).first()
        if not exists:
            db.add(models.EmployeeStatusPeriod(
                employee_id=e.id, status=e.status, date_from=e.status_date_from,
                date_to=e.status_date_to, source="joriy",
            ))
        e.status = S.faol
        e.status_date_from = None
        e.status_date_to = None
        e.is_active = True
    if emps:
        db.commit()
    return len(emps)


def activate_due_periods(db: Session) -> int:
    """Rejalashtirilgan holat (masalan, 05.10 dan mehnat ta'tili) boshlanish kuni
    kelganda xodimning joriy holatiga aylantiradi. Faqat hozir "faol" (yoki
    avvalgi muddati tugagan) xodimga qo'llanadi — dekret, texnik xodim va
    davom etayotgan boshqa holatga tegmaydi. Qo'llanganlar sonini qaytaradi."""
    today = date.today().isoformat()
    periods = (
        db.query(models.EmployeeStatusPeriod)
        .filter(models.EmployeeStatusPeriod.date_from <= today,
                models.EmployeeStatusPeriod.date_to >= today,
                models.EmployeeStatusPeriod.status.in_(list(RANGE_STATUSES)))
        .order_by(models.EmployeeStatusPeriod.created_at)
        .all()
    )
    changed = 0
    for p in periods:
        e = db.get(models.Employee, p.employee_id)
        if not e or (e.status, e.status_date_from, e.status_date_to) == (p.status, p.date_from, p.date_to):
            continue
        current_expired = e.status_date_to is not None and e.status_date_to < today
        if e.status != S.faol and not current_expired:
            continue
        e.status = p.status
        e.status_date_from = p.date_from
        e.status_date_to = p.date_to
        e.is_active = e.role == models.RoleEnum.superadmin or p.status == S.online
        changed += 1
    if changed:
        db.commit()
    return changed


def attach_planned(db: Session, employees: list) -> list:
    """Har bir xodimga eng yaqin rejalashtirilgan (boshlanmagan) holatni
    qo'shadi: planned_status / planned_from / planned_to (EmployeeOut uchun)."""
    ids = [e.id for e in employees]
    today = date.today().isoformat()
    nearest: dict[int, models.EmployeeStatusPeriod] = {}
    if ids:
        for p in (db.query(models.EmployeeStatusPeriod)
                  .filter(models.EmployeeStatusPeriod.employee_id.in_(ids),
                          models.EmployeeStatusPeriod.date_from > today,
                          models.EmployeeStatusPeriod.status.in_(list(RANGE_STATUSES)))
                  .order_by(models.EmployeeStatusPeriod.date_from.desc())
                  .all()):
            nearest[p.employee_id] = p   # oxirida eng yaqini qoladi
    for e in employees:
        p = nearest.get(e.id)
        e.planned_status = p.status if p else None
        e.planned_from = p.date_from if p else None
        e.planned_to = p.date_to if p else None
    return employees


def backfill_status_periods(db: Session) -> int:
    """Birinchi ishga tushirishda (jadval bo'sh bo'lsa) tarixni tiklaydi:
    1) xodimlarning hozirgi muddatli holatlari;
    2) bo'lim boshliqlari qo'lda to'ldirgan tabeldagi М/Т, Б, К, У/Т kodlari —
       ketma-ket kunlar (orada faqat shanba/yakshanba bo'lsa ham) bitta davrga
       birlashtiriladi. Qaytaradi: qo'shilgan davrlar soni."""
    if db.query(models.EmployeeStatusPeriod.id).first() is not None:
        return 0

    added = 0
    for e in db.query(models.Employee).filter(models.Employee.status_date_from.isnot(None)).all():
        if e.status in STATUS_CODE and e.status_date_to:
            db.add(models.EmployeeStatusPeriod(
                employee_id=e.id, status=e.status, date_from=e.status_date_from,
                date_to=e.status_date_to, source="joriy",
            ))
            added += 1

    recs = (
        db.query(models.TabelRecord)
        .filter(models.TabelRecord.code.in_(list(_MANUAL_TABEL_CODE)))
        .all()
    )
    days_by: dict[tuple[int, object], list[date]] = {}
    for r in recs:
        try:
            d = date(r.year, r.month, r.day)
        except ValueError:
            continue
        days_by.setdefault((r.employee_id, _MANUAL_TABEL_CODE[r.code]), []).append(d)

    for (emp_id, status), days in days_by.items():
        days.sort()
        start = prev = days[0]
        for d in days[1:] + [None]:
            if d is not None:
                gap = prev + timedelta(days=1)
                while gap < d and gap.weekday() >= 5:   # dam olish kunlari uzilish emas
                    gap += timedelta(days=1)
                if gap == d:
                    prev = d
                    continue
            db.add(models.EmployeeStatusPeriod(
                employee_id=emp_id, status=status, date_from=start.isoformat(),
                date_to=prev.isoformat(), source="tabel",
            ))
            added += 1
            if d is not None:
                start = prev = d
    db.commit()
    return added
