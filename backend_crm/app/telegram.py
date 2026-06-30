"""Telegram bot orqali guruhga xabar yuborish — qo'shimcha kutubxonasiz (urllib)."""
import os
import json
import urllib.request
import urllib.parse


def send_telegram_message(text: str) -> bool:
    """TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID muhit o'zgaruvchilari orqali sozlanadi."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan")

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return bool(result.get("ok"))
    except Exception:
        return False
