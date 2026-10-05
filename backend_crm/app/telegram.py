"""Telegram bot orqali guruhga xabar yuborish — qo'shimcha kutubxonasiz (urllib)."""
import os
import json
import logging
import urllib.error
import urllib.request
import urllib.parse

_log = logging.getLogger("telegram")


def send_telegram_message(text: str) -> bool:
    """TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID muhit o'zgaruvchilari orqali sozlanadi
    (guruhga xabar yuborish uchun)."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan")
    return send_telegram_message_to(chat_id, text)


def send_telegram_message_to(chat_id, text: str) -> bool:
    """Berilgan chat_id (shaxsiy yoki guruh) ga xabar yuboradi."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN sozlanmagan")

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return bool(result.get("ok"))
    except Exception:
        return False


def send_telegram_photo(image_bytes: bytes, caption: str = "") -> bool:
    """TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID orqali guruhga rasm (PNG) yuboradi."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan")
    return send_telegram_photo_to(chat_id, image_bytes, caption)


def send_telegram_photo_to(chat_id, image_bytes: bytes, caption: str = "") -> bool:
    """Berilgan chat_id (shaxsiy yoki guruh) ga rasm (PNG) yuboradi — masalan,
    guruhga yuborishdan oldin shaxsiy chatda sinab ko'rish uchun."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN sozlanmagan")

    boundary = "----CRMBoundary" + os.urandom(16).hex()
    nl = "\r\n"
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(
            (f"--{boundary}{nl}Content-Disposition: form-data; name=\"{name}\"{nl}{nl}{value}{nl}")
            .encode("utf-8")
        )

    add_field("chat_id", str(chat_id))
    if caption:
        add_field("caption", caption)
    parts.append(
        (f"--{boundary}{nl}Content-Disposition: form-data; name=\"photo\"; filename=\"reminder.png\"{nl}"
         f"Content-Type: image/png{nl}{nl}").encode("utf-8")
    )
    parts.append(image_bytes)
    parts.append(f"{nl}--{boundary}--{nl}".encode("utf-8"))
    body = b"".join(parts)

    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return bool(result.get("ok"))
    except Exception:
        return False


def telegram_send_file(chat_id, filename: str, data: bytes, ctype: str = "application/octet-stream",
                       caption: str = "", reply_to: int | None = None, file_id: str | None = None) -> dict | None:
    """Faylni (rasm — sendPhoto, qolgani — sendDocument) yuboradi. file_id berilsa —
    qayta yuklamasdan o'sha nusxa. Natija: Telegram javobi (result) yoki None."""
    import uuid
    is_photo = (ctype or "").startswith("image/") and filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    method, field = ("sendPhoto", "photo") if is_photo else ("sendDocument", "document")
    fields = {"chat_id": str(chat_id)}
    if caption:
        fields.update(caption=caption[:1000], parse_mode="HTML")
    if reply_to:
        fields["reply_to_message_id"] = str(reply_to)
    if file_id:
        return telegram_api(method, {**fields, field: file_id})
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        _log.warning("TELEGRAM_BOT_TOKEN sozlanmagan — fayl yuborilmadi")
        return None
    boundary = uuid.uuid4().hex
    body = b"".join(
        [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8") for k, v in fields.items()]
        + [f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
           f"Content-Type: {ctype}\r\n\r\n".encode("utf-8") + data + b"\r\n",
           f"--{boundary}--\r\n".encode("utf-8")]
    )
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("result") if result.get("ok") else None
    except Exception as e:
        _log.warning("Telegram fayl yuborilmadi (%s): %s", method, e)
        return None


def file_id_of(result: dict | None) -> str | None:
    if not result:
        return None
    if result.get("photo"):
        return result["photo"][-1]["file_id"]
    if result.get("document"):
        return result["document"]["file_id"]
    return None


def telegram_api(method: str, payload: dict, timeout: int = 10) -> dict | None:
    """Bot API'ga JSON so'rov (inline tugmalar, xabarni tahrirlash uchun).
    Xato bo'lsa None qaytaradi — asosiy jarayon to'xtamasligi kerak."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        _log.warning("TELEGRAM_BOT_TOKEN sozlanmagan — %s yuborilmadi", method)
        return None
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("result") if result.get("ok") else None
    except urllib.error.HTTPError as e:
        # Telegram sababni tanada qaytaradi (masalan: "bot was blocked by the user",
        # "chat not found" — xodim botga /start bosmagan)
        try:
            detail = json.loads(e.read().decode("utf-8")).get("description")
        except Exception:
            detail = str(e)
        _log.warning("Telegram %s xatosi (chat_id=%s): %s", method, payload.get("chat_id"), detail)
        return None
    except Exception as e:
        _log.warning("Telegram %s xatosi (chat_id=%s): %s", method, payload.get("chat_id"), e)
        return None
