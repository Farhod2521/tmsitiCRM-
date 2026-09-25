"""Davomat arizalari (AttendanceNote) tasdiqlash oqimi va Telegram xabarlari.

Bosqichlar:
  oddiy xodim yozsa:       bolim_kutilmoqda -> (bo'lim boshlig'i) -> kutilmoqda -> (kadr)
                           -> kadr_tasdiqladi -> (zamdirektor) -> sababli
  bo'lim boshlig'i yozsa:  kutilmoqda dan boshlanadi (kadr -> zamdirektor)
  Rad etish istalgan bosqichda darhol "sababsiz" (yakuniy).

Har bosqichda ko'rib chiquvchilarga Telegram'da inline tugmali (Tasdiqlash /
Rad etish) xabar yuboriladi. Bosqich saytda yoki botda yakunlansa — o'sha
bosqichning barcha xabarlari tahrirlanadi: tugmalar olib tashlanib, kim va
qanday qaror qilgani yoziladi, keyingi bosqich ko'rib chiquvchilariga yangi
xabar yuboriladi. Yakuniy natija ariza muallifiga ham yuboriladi.
"""
import logging
from datetime import datetime, timedelta, timezone
from html import escape as _escape
from sqlalchemy.orm import Session
from . import models
from .database import SessionLocal
from .telegram import telegram_api

log = logging.getLogger("note_flow")

R = models.RoleEnum
HEAD_ROLES = {R.bolim_boshligi, R.boshqarma_boshligi}
ADMIN_REVIEW_ROLES = {R.superadmin, R.direktor, R.zamdirektor}
PENDING = ("bolim_kutilmoqda", "kutilmoqda", "kadr_tasdiqladi")

_TZ_UZ = timezone(timedelta(hours=5))

NOTE_TYPE = {
    "kechikish": ("⏰", "Kechikaman"),
    "kelmaslik": ("🚫", "Kelmayman"),
    "obyektda":  ("📍", "Obyektga chiqdim"),
    "ruxsat":    ("🚪", "Ruxsat so'rayman"),
}
STAGE_TITLE = {
    "bolim_kutilmoqda": "Bo'lim boshlig'i",
    "kutilmoqda":       "Kadrlar bo'limi",
    "kadr_tasdiqladi":  "Direktor o'rinbosari",
}


def escape(s: str) -> str:
    """Telegram HTML uchun: faqat & < > (apostrof "bo'lim" o'zgarmasin)."""
    return _escape(s, quote=False)


class ReviewError(Exception):
    pass


# ── Kim ko'rib chiqadi ────────────────────────────────────────────────────────

def dept_heads(db: Session, emp: models.Employee) -> list[models.Employee]:
    """Xodim bo'limining boshlig'i(lari). is_active BU YERDA TEKSHIRILMAYDI —
    u "ball/statistikada hisoblanadi" belgisi (ta'til, bolnichniyda false),
    hisob faolligi emas; boshliq tizimga kiradi va arizani tasdiqlay oladi."""
    if not emp.department_id:
        return []
    return (
        db.query(models.Employee)
        .filter(
            models.Employee.department_id == emp.department_id,
            models.Employee.role.in_(list(HEAD_ROLES)),
            models.Employee.id != emp.id,
        )
        .all()
    )


def initial_status(db: Session, author: models.Employee) -> str:
    """Bo'lim boshlig'idan boshqa har kim yozsa — avval o'z bo'limi boshlig'iga;
    bo'lim boshlig'i yozsa (yoki bo'limida faol boshliq bo'lmasa) — to'g'ridan-to'g'ri kadrga."""
    if author.role in HEAD_ROLES:
        return "kutilmoqda"
    if dept_heads(db, author):
        return "bolim_kutilmoqda"
    log.warning("Ariza kadrga yo'naltirildi: %s (id=%s, department_id=%s) bo'limida faol bo'lim boshlig'i topilmadi",
                author.full_name, author.id, author.department_id)
    return "kutilmoqda"


def can_review(actor: models.Employee, note: models.AttendanceNote) -> bool:
    st = note.review_status
    if actor.id == note.employee_id:
        return False
    if st == "bolim_kutilmoqda":
        return actor.role == R.superadmin or (
            actor.role in HEAD_ROLES and note.employee is not None
            and actor.department_id == note.employee.department_id
        )
    if st == "kutilmoqda":
        return actor.role == R.kadr
    if st == "kadr_tasdiqladi":
        return actor.role in ADMIN_REVIEW_ROLES
    return False


def stage_reviewers(db: Session, note: models.AttendanceNote) -> list[models.Employee]:
    st = note.review_status
    if st == "bolim_kutilmoqda":
        return dept_heads(db, note.employee) if note.employee else []
    q = db.query(models.Employee).filter(models.Employee.id != note.employee_id)
    if st == "kutilmoqda":
        return q.filter(models.Employee.role == R.kadr).all()
    if st == "kadr_tasdiqladi":
        return q.filter(models.Employee.role == R.zamdirektor).all()
    return []


def reroute_to_heads(db: Session) -> list[int]:
    """Oddiy xodimning arizasi bo'lim boshlig'isiz kadrga tushib qolgan bo'lsa
    (eski kod bilan yozilgan yoki o'sha paytda boshliq faol bo'lmagan) va hozir
    bo'limida faol boshliq bor — ariza bo'lim boshlig'iga qaytariladi.
    Qaytarilgan arizalar id'larini beradi (Telegram fonda: after_reroute)."""
    notes = (
        db.query(models.AttendanceNote)
        .filter(models.AttendanceNote.review_status == "kutilmoqda",
                models.AttendanceNote.bolim_by.is_(None),
                models.AttendanceNote.reviewed_by.is_(None))
        .all()
    )
    moved = []
    for n in notes:
        author = n.employee
        if author and author.role not in HEAD_ROLES and dept_heads(db, author):
            n.review_status = "bolim_kutilmoqda"
            moved.append(n.id)
    if moved:
        db.commit()
        log.info("Bo'lim boshlig'iga qaytarilgan arizalar: %s", moved)
    return moved


# ── Qaror ─────────────────────────────────────────────────────────────────────

def apply_review(db: Session, note: models.AttendanceNote, actor: models.Employee, approve: bool) -> str:
    """Joriy bosqich bo'yicha qaror; commit qiladi. Avvalgi bosqichni qaytaradi."""
    if note.review_status not in PENDING:
        raise ReviewError("Bu ariza allaqachon ko'rib chiqilgan")
    if not can_review(actor, note):
        raise ReviewError("Bu bosqichda sizda ruxsat yo'q")
    prev = note.review_status
    now = datetime.utcnow()
    if prev == "bolim_kutilmoqda":
        note.bolim_by, note.bolim_at = actor.id, now
        note.review_status = "kutilmoqda" if approve else "sababsiz"
    elif prev == "kutilmoqda":
        note.reviewed_by, note.reviewed_at = actor.id, now
        note.review_status = "kadr_tasdiqladi" if approve else "sababsiz"
    else:
        note.zamdirektor_by, note.zamdirektor_at = actor.id, now
        note.review_status = "sababli" if approve else "sababsiz"
    db.commit()
    db.refresh(note)
    return prev


# ── Telegram xabari ───────────────────────────────────────────────────────────

def _d(s: str) -> str:
    y, m, d = s.split("-")
    return f"{d}.{m}.{y}"


def _hm(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.replace(tzinfo=timezone.utc).astimezone(_TZ_UZ).strftime("%d.%m %H:%M")


def _progress(note: models.AttendanceNote) -> list[str]:
    """Bosqichlar holati: ✅ tasdiqlagan, ❌ rad etgan, ⏳ hozir kutilmoqda, ▫️ navbatda."""
    has_bolim = note.bolim_by is not None or note.review_status == "bolim_kutilmoqda"
    steps = [("bolim_kutilmoqda", note.bolim_reviewer, note.bolim_at)] if has_bolim else []
    steps += [
        ("kutilmoqda", note.reviewer, note.reviewed_at),
        ("kadr_tasdiqladi", note.zamdirektor_reviewer, note.zamdirektor_at),
    ]
    rejected = note.review_status == "sababsiz"
    lines, stopped = [], False
    for i, (stage, who, at) in enumerate(steps):
        title = STAGE_TITLE[stage]
        if stopped:
            lines.append(f"▫️ {title}")
        elif who is not None:
            last_decider = i == len(steps) - 1 or steps[i + 1][1] is None
            if rejected and last_decider:
                lines.append(f"❌ {title}: <b>{escape(who.full_name)}</b> rad etdi · {_hm(at)}")
                stopped = True
            else:
                lines.append(f"✅ {title}: <b>{escape(who.full_name)}</b> · {_hm(at)}")
        elif note.review_status == stage:
            lines.append(f"⏳ {title}: <i>kutilmoqda</i>")
            stopped = True
        else:
            lines.append(f"▫️ {title}")
    return lines


def note_text(note: models.AttendanceNote, footer: str = "") -> str:
    emp = note.employee
    icon, label = NOTE_TYPE.get(note.note_type, ("📝", note.note_type))
    dept = emp.department.name if emp and emp.department else None
    lines = [
        "📝 <b>DAVOMAT ARIZASI</b>",
        "",
        f"👤 <b>{escape(emp.full_name if emp else '—')}</b>",
    ]
    sub = " · ".join(x for x in [dept, emp.position if emp else None] if x)
    if sub:
        lines.append(f"🏢 {escape(sub)}")
    lines += ["", f"{icon} <b>{label}</b>"]
    lines.append(f"📅 {_d(note.date_from)}" + (f" — {_d(note.date_to)}" if note.date_to != note.date_from else ""))
    if note.note_type == "kechikish" and note.expected_time:
        lines.append(f"🕘 Taxminan <b>{escape(note.expected_time)}</b> da keladi")
    if note.note_type in ("obyektda", "ruxsat") and (note.object_time_from or note.object_time_to):
        lines.append(f"🕘 {escape(note.object_time_from or '—')} — {escape(note.object_time_to or '—')}")
    if note.text:
        lines.append(f"💬 <i>{escape(note.text)}</i>")
    if note.note_type == "obyektda" and note.object_latitude is not None and note.object_longitude is not None:
        lines.append(f'🗺 <a href="https://www.google.com/maps?q={note.object_latitude},{note.object_longitude}">Xaritada ko\'rish</a>')
    lines += ["", "━━━━━━━━━━━━━━━", *_progress(note)]
    if footer:
        lines += ["", footer]
    return "\n".join(lines)


def _keyboard(note: models.AttendanceNote) -> dict:
    st = note.review_status
    return {"inline_keyboard": [[
        {"text": "✅ Tasdiqlash", "callback_data": f"an:{note.id}:{st}:a"},
        {"text": "❌ Rad etish",  "callback_data": f"an:{note.id}:{st}:r"},
    ]]}


def _notify_stage(db: Session, note: models.AttendanceNote) -> None:
    reviewers = stage_reviewers(db, note)
    if not reviewers:
        log.warning("Ariza #%s (%s): ko'rib chiquvchi topilmadi", note.id, note.review_status)
    for emp in reviewers:
        if not emp.telegram_id:
            log.warning("Ariza #%s (%s): %s Telegram'ga bog'lanmagan — xabar yuborilmadi",
                        note.id, note.review_status, emp.full_name)
            continue
        res = telegram_api("sendMessage", {
            "chat_id": emp.telegram_id,
            "text": note_text(note, "👇 <b>Qaroringizni tanlang:</b>"),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": _keyboard(note),
        })
        if not res or not res.get("message_id"):
            log.warning("Ariza #%s: %s ga Telegram xabari yuborilmadi", note.id, emp.full_name)
        else:
            log.info("Ariza #%s (%s): %s ga Telegram xabari yuborildi", note.id, note.review_status, emp.full_name)
            db.add(models.AttendanceNoteTgMessage(
                note_id=note.id, stage=note.review_status, employee_id=emp.id,
                chat_id=emp.telegram_id, message_id=res["message_id"],
            ))
    db.commit()


def _close_stage(db: Session, note: models.AttendanceNote, stage: str, actor: models.Employee,
                 approved: bool, source: str) -> None:
    msgs = (
        db.query(models.AttendanceNoteTgMessage)
        .filter(models.AttendanceNoteTgMessage.note_id == note.id,
                models.AttendanceNoteTgMessage.stage == stage,
                models.AttendanceNoteTgMessage.closed.is_(False))
        .all()
    )
    via = "Telegram orqali" if source == "bot" else "saytda"
    for m in msgs:
        if m.employee_id == actor.id:
            footer = "✅ <b>Siz tasdiqladingiz</b>" if approved else "❌ <b>Siz rad etdingiz</b>"
        else:
            footer = (f"✅ <b>Tasdiqlandi</b> — {escape(actor.full_name)} ({via})" if approved
                      else f"❌ <b>Rad etildi</b> — {escape(actor.full_name)} ({via})")
        telegram_api("editMessageText", {
            "chat_id": m.chat_id, "message_id": m.message_id,
            "text": note_text(note, footer), "parse_mode": "HTML",
            "disable_web_page_preview": True,
        })
        m.closed = True
    db.commit()


def _notify_author(note: models.AttendanceNote) -> None:
    emp = note.employee
    if not emp or not emp.telegram_id:
        return
    head = ("✅ <b>Arizangiz tasdiqlandi</b>" if note.review_status == "sababli"
            else "❌ <b>Arizangiz rad etildi</b>")
    telegram_api("sendMessage", {
        "chat_id": emp.telegram_id, "text": note_text(note, head),
        "parse_mode": "HTML", "disable_web_page_preview": True,
    })


# ── Fon vazifalari (BackgroundTasks) — o'z sessiyasi bilan ────────────────────

def after_create(note_id: int) -> None:
    with SessionLocal() as db:
        note = db.get(models.AttendanceNote, note_id)
        if note and note.review_status in PENDING:
            _notify_stage(db, note)


def after_reroute(note_ids: list[int]) -> None:
    """Kadrlarga yuborilgan (endi eskirgan) xabarlarni yopib, bo'lim boshlig'iga yuboradi."""
    with SessionLocal() as db:
        for nid in note_ids:
            note = db.get(models.AttendanceNote, nid)
            if not note or note.review_status != "bolim_kutilmoqda":
                continue
            for m in (db.query(models.AttendanceNoteTgMessage)
                      .filter(models.AttendanceNoteTgMessage.note_id == nid,
                              models.AttendanceNoteTgMessage.stage == "kutilmoqda",
                              models.AttendanceNoteTgMessage.closed.is_(False)).all()):
                telegram_api("editMessageText", {
                    "chat_id": m.chat_id, "message_id": m.message_id,
                    "text": note_text(note, "↩️ <b>Avval bo'lim boshlig'i tasdiqlashi kerak</b> — ariza unga qaytarildi"),
                    "parse_mode": "HTML", "disable_web_page_preview": True,
                })
                m.closed = True
            db.commit()
            _notify_stage(db, note)


def after_review(note_id: int, prev_stage: str, actor_id: int, approved: bool, source: str) -> None:
    with SessionLocal() as db:
        note = db.get(models.AttendanceNote, note_id)
        actor = db.get(models.Employee, actor_id)
        if not note or not actor:
            return
        _close_stage(db, note, prev_stage, actor, approved, source)
        if note.review_status in PENDING:
            _notify_stage(db, note)
        else:
            _notify_author(note)
