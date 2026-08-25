"""Telegram bot orqali guruhga xabar yuborish — qo'shimcha kutubxonasiz (urllib)."""
import os
import json
import urllib.request
import urllib.parse


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
