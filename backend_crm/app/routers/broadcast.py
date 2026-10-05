"""Superadmin: Telegram bot orqali barcha xodimlarga (Telegram'i CRM'ga bog'langan)
shaxsiy xabar yuborish — CKEditor matni + ixtiyoriy video/rasm/hujjat.
Yuborish fonda bajariladi; fayl Telegram'ga bir marta yuklanadi, qolganlarga
file_id orqali yuboriladi. Har bir yuborish tarixda (yuborildi/yetmadi) saqlanadi."""
import html
import json
import logging
import os
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from html.parser import HTMLParser
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import SessionLocal, get_db
from ..deps import get_current_employee

router = APIRouter(prefix="/telegram-broadcast", tags=["Telegram xabar"])
_log = logging.getLogger("broadcast")

MAX_FILE_MB = 50          # Bot API orqali yuklash chegarasi
CAPTION_LIMIT = 1024
TEXT_LIMIT = 4096
SEND_PAUSE = 0.06         # Telegram cheklovi (~30 xabar/soniya) dan past


def _require(current: models.Employee) -> None:
    if current.role != models.RoleEnum.superadmin:
        raise HTTPException(status_code=403, detail="Faqat superadmin uchun")


# ── CKEditor HTML → Telegram HTML ────────────────────────────────────────────

class _TgHtml(HTMLParser):
    """Telegram faqat b/i/u/s/a/code/pre/blockquote teglarini qo'llaydi —
    qolganlari (p, h1, li, br ...) matn tuzilishiga aylantiriladi."""
    INLINE = {"b": "b", "strong": "b", "i": "i", "em": "i", "u": "u", "s": "s", "del": "s",
              "strike": "s", "code": "code", "pre": "pre", "blockquote": "blockquote"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.lists: list[list] = []   # [turi, raqam]

    def handle_starttag(self, tag, attrs):
        if tag in self.INLINE:
            self.out.append(f"<{self.INLINE[tag]}>")
        elif tag == "a":
            href = dict(attrs).get("href") or ""
            if href.startswith(("http://", "https://", "tg://")):
                self.out.append(f'<a href="{html.escape(href, quote=True)}">')
            else:
                self.out.append("<a>")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.out.append("<b>")
        elif tag == "br":
            self.out.append("\n")
        elif tag in ("ul", "ol"):
            self.lists.append([tag, 0])
        elif tag == "li":
            indent = "   " * max(0, len(self.lists) - 1)
            if self.lists and self.lists[-1][0] == "ol":
                self.lists[-1][1] += 1
                self.out.append(f"{indent}{self.lists[-1][1]}. ")
            else:
                self.out.append(f"{indent}• ")

    def handle_endtag(self, tag):
        if tag in self.INLINE:
            self.out.append(f"</{self.INLINE[tag]}>")
            if tag in ("pre", "blockquote"):
                self.out.append("\n")
        elif tag == "a":
            self.out.append("</a>")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.out.append("</b>\n\n")
        elif tag == "p":
            self.out.append("\n\n")
        elif tag == "li":
            self.out.append("\n")
        elif tag in ("ul", "ol"):
            if self.lists:
                self.lists.pop()
            if not self.lists:
                self.out.append("\n")

    def handle_data(self, data):
        self.out.append(html.escape(data, quote=False))


def to_telegram_html(src: str) -> str:
    p = _TgHtml()
    p.feed(src or "")
    p.close()
    text = "".join(p.out)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.replace("<a></a>", "").strip()


def _visible_len(tg_html: str) -> int:
    import re
    return len(html.unescape(re.sub(r"<[^>]+>", "", tg_html)))


# ── Bot API (multipart yuklash ham) ──────────────────────────────────────────

class TgError(Exception):
    pass


def _tg_call(method: str, fields: dict, file: Optional[tuple] = None) -> dict:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise TgError("TELEGRAM_BOT_TOKEN sozlanmagan")
    url = f"https://api.telegram.org/bot{token}/{method}"
    if file is None:
        body = json.dumps(fields).encode("utf-8")
        headers = {"Content-Type": "application/json"}
    else:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in fields.items():
            if v is None:
                continue
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8"))
        field, fname, data, ctype = file
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{fname}"\r\n'
                     f"Content-Type: {ctype}\r\n\r\n".encode("utf-8") + data + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(parts)
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120 if file else 20) as resp:
            res = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            desc = json.loads(e.read().decode("utf-8")).get("description")
        except Exception:
            desc = str(e)
        raise TgError(desc or "Telegram xatosi")
    except Exception as e:  # tarmoq
        raise TgError(str(e))
    if not res.get("ok"):
        raise TgError(res.get("description") or "Telegram xatosi")
    return res["result"]


KIND_METHOD = {"video": ("sendVideo", "video"), "photo": ("sendPhoto", "photo"),
               "animation": ("sendAnimation", "animation"), "document": ("sendDocument", "document")}


def _file_kind(filename: str, ctype: str) -> str:
    name, ct = (filename or "").lower(), (ctype or "").lower()
    if name.endswith(".gif"):
        return "animation"
    if ct.startswith("video/") or name.endswith((".mp4", ".mov", ".m4v", ".webm")):
        return "video"
    if ct.startswith("image/") and name.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return "photo"
    return "document"


def _file_id(result: dict, kind: str) -> Optional[str]:
    if kind == "photo":
        sizes = result.get("photo") or []
        return sizes[-1]["file_id"] if sizes else None
    for key in (kind, "video", "animation", "document"):
        if result.get(key):
            return result[key]["file_id"]
    return None


def _send_one(chat_id: int, tg_text: str, file: Optional[dict], state: dict) -> None:
    """Bitta xodimga yuborish. Fayl birinchi marta yuklanadi, keyin file_id ishlatiladi."""
    use_caption = bool(tg_text) and _visible_len(tg_text) <= CAPTION_LIMIT
    if file:
        method, field = KIND_METHOD[file["kind"]]
        fields = {"chat_id": chat_id}
        if use_caption:
            fields.update(caption=tg_text, parse_mode="HTML")
        if file["kind"] == "video":
            fields["supports_streaming"] = True
        if state.get("file_id"):
            fields[field] = state["file_id"]
            _tg_call(method, fields)
        else:
            res = _tg_call(method, {k: (str(v).lower() if isinstance(v, bool) else str(v)) for k, v in fields.items()},
                           (field, file["name"], file["data"], file["ctype"]))
            state["file_id"] = _file_id(res, file["kind"])
    if tg_text and (not file or not use_caption):
        # Uzun matn — 4096 belgidan bo'laklab
        chunk, chunks = "", []
        for para in tg_text.split("\n\n"):
            if chunk and len(chunk) + len(para) + 2 > TEXT_LIMIT - 50:
                chunks.append(chunk); chunk = ""
            chunk = f"{chunk}\n\n{para}" if chunk else para
        if chunk:
            chunks.append(chunk)
        for c in chunks:
            _tg_call("sendMessage", {"chat_id": chat_id, "text": c, "parse_mode": "HTML",
                                     "disable_web_page_preview": True})


def _run_broadcast(bid: int, file: Optional[dict], to_group: bool = False) -> None:
    db = SessionLocal()
    try:
        b = db.get(models.TelegramBroadcast, bid)
        recipients = (db.query(models.Employee).filter(models.Employee.telegram_id.isnot(None))
                      .order_by(models.Employee.full_name).all())
        b.total = len(recipients) + (1 if to_group else 0); db.commit()
        state: dict = {}
        failed = []
        group_id = os.getenv("TELEGRAM_CHAT_ID")
        if to_group:
            try:
                if not group_id:
                    raise TgError("TELEGRAM_CHAT_ID sozlanmagan")
                _send_one(int(group_id), b.tg_text or "", file, state)
                b.sent = (b.sent or 0) + 1
            except (TgError, ValueError) as e:
                failed.append({"name": "📢 Telegram guruh", "reason": str(e)[:200]})
                b.failed = len(failed); b.failed_list = list(failed)
            db.commit()
        for emp in recipients:
            try:
                _send_one(emp.telegram_id, b.tg_text or "", file, state)
                b.sent = (b.sent or 0) + 1
            except TgError as e:
                failed.append({"name": emp.full_name, "reason": str(e)[:200]})
                b.failed = len(failed)
                b.failed_list = list(failed)
                # Fayl umuman yuklanmasa — qolganlarga ham yetmaydi, to'xtatamiz
                if file and state.get("file_id") is None and len(failed) >= 3 and not b.sent:
                    b.error = f"Fayl yuborilmadi: {e}"
                    break
            db.commit()
            time.sleep(SEND_PAUSE)
        b.status = "done"
        b.finished_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        _log.exception("broadcast %s xatosi", bid)
        try:
            b = db.get(models.TelegramBroadcast, bid)
            b.status, b.error, b.finished_at = "done", str(e)[:300], datetime.utcnow()
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── API ─────────────────────────────────────────────────────────────────────

class BroadcastOut(BaseModel):
    id: int
    text_html: Optional[str]
    file_name: Optional[str]
    file_kind: Optional[str]
    status: str
    total: int
    sent: int
    failed: int
    failed_list: list
    error: Optional[str]
    created_by_name: Optional[str]
    created_at: datetime
    finished_at: Optional[datetime]


def _out(b: models.TelegramBroadcast) -> BroadcastOut:
    return BroadcastOut(id=b.id, text_html=b.text_html, file_name=b.file_name, file_kind=b.file_kind,
                        status=b.status, total=b.total or 0, sent=b.sent or 0, failed=b.failed or 0,
                        failed_list=b.failed_list or [], error=b.error,
                        created_by_name=b.creator.full_name if b.creator else None,
                        created_at=b.created_at, finished_at=b.finished_at)


@router.get("/recipients")
def recipients(db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require(current)
    total = db.query(models.Employee).count()
    linked = db.query(models.Employee).filter(models.Employee.telegram_id.isnot(None)).count()
    return {"linked": linked, "total": total, "group": bool(os.getenv("TELEGRAM_CHAT_ID"))}


@router.get("", response_model=List[BroadcastOut])
def history(db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require(current)
    rows = db.query(models.TelegramBroadcast).order_by(models.TelegramBroadcast.id.desc()).limit(30).all()
    return [_out(b) for b in rows]


@router.post("", response_model=BroadcastOut)
async def create(
    background: BackgroundTasks,
    text_html: str = Form(""),
    to_group: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    _require(current)
    tg_text = to_telegram_html(text_html)
    fdata = None
    if file is not None and file.filename:
        data = await file.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Fayl {MAX_FILE_MB} MB dan oshmasligi kerak")
        if not data:
            raise HTTPException(status_code=400, detail="Fayl bo'sh")
        fdata = {"name": file.filename, "data": data, "ctype": file.content_type or "application/octet-stream",
                 "kind": _file_kind(file.filename, file.content_type or "")}
    if not tg_text and not fdata:
        raise HTTPException(status_code=400, detail="Matn yoki fayl kiriting")
    from datetime import timedelta
    stale = datetime.utcnow() - timedelta(minutes=30)   # server qayta ishga tushib qolib ketganlari
    for old in db.query(models.TelegramBroadcast).filter(models.TelegramBroadcast.status == "sending",
                                                         models.TelegramBroadcast.created_at < stale).all():
        old.status, old.error = "done", old.error or "Yuborish to'xtab qolgan (server qayta ishga tushgan)"
    db.commit()
    if db.query(models.TelegramBroadcast).filter(models.TelegramBroadcast.status == "sending").first():
        raise HTTPException(status_code=409, detail="Oldingi xabar hali yuborilmoqda — tugashini kuting")
    b = models.TelegramBroadcast(text_html=text_html, tg_text=tg_text, file_name=fdata["name"] if fdata else None,
                                 file_kind=fdata["kind"] if fdata else None, status="sending",
                                 total=0, sent=0, failed=0, failed_list=[], created_by=current.id)
    db.add(b); db.commit(); db.refresh(b)
    background.add_task(_run_broadcast, b.id, fdata, to_group)
    return _out(b)
