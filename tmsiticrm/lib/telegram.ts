import { apiFetch } from "@/lib/api";

export const TELEGRAM_BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");

export function openTelegramStatic(startPayload: string) {
  if (!TELEGRAM_BOT_USERNAME) {
    alert("Telegram bot sozlanmagan. Administratorga murojaat qiling.");
    return;
  }
  window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${startPayload}`, "_blank", "noopener,noreferrer");
}

/** CRM profilida (autentifikatsiyadan o'tgan holda) bir martalik token yaratib,
 * botga "link_<token>" bilan yo'naltiradi — hisobni Telegramga bog'lash uchun. */
export async function openTelegramLink() {
  if (!TELEGRAM_BOT_USERNAME) {
    alert("Telegram bot sozlanmagan. Administratorga murojaat qiling.");
    return;
  }
  // Oyna darhol (sinxron) ochiladi — aks holda brauzer popup-blocker
  // await'dan keyingi window.open'ni bloklashi mumkin.
  const win = window.open("", "_blank");
  try {
    const { token } = await apiFetch<{ token: string; expires_in: number }>("/employees/me/telegram-link-token", { method: "POST" });
    if (win) win.location.href = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=link_${token}`;
  } catch {
    win?.close();
    alert("Havola olishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
}
