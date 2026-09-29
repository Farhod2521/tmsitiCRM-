// Backend vaqtlarni (created_at, reviewed_at ...) UTC'da, lekin zona belgisisiz
// yuboradi: "2026-09-29T03:41:00". Brauzer buni mahalliy vaqt deb o'qimasligi
// uchun UTC deb belgilaymiz va har doim O'zbekiston vaqtida (UTC+5) ko'rsatamiz.
export const TZ_UZ = "Asia/Tashkent";

/** Zona ko'rsatilmagan ISO vaqtni UTC sifatida o'qiydi. */
export function parseUtc(iso: string): Date {
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone || !iso.includes("T") ? iso : `${iso}Z`);
}

/** "29.09, 08:41" — O'zbekiston vaqtida. */
export function fmtDateTimeUz(iso: string, withYear = false): string {
  return parseUtc(iso).toLocaleString("uz-UZ", {
    timeZone: TZ_UZ,
    day: "2-digit", month: "2-digit", ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit", minute: "2-digit",
  });
}
