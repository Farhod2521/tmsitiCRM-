"use client";

/** Ijro taqvimi, hujjat modali va hujjat sahifasi uchun umumiy holat/format yordamchilari. */
import { Hourglass, ArrowRight, Check, EyeOff } from "lucide-react";
import type { IjroDoc, BolimInfo } from "@/components/ijro/IjroNazorat";

export type TaskStatus = "otgan" | "tasdiqlashda" | "bajarilmoqda" | "bajarilgan" | "korilmagan";

type GlyphIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Rangli doira ichidagi "!" belgisi (lucide'da doirasiz undov yo'q). */
function Exclaim({ size = 12, color = "currentColor", strokeWidth = 2.6 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth + 0.6} strokeLinecap="round" aria-hidden>
      <line x1="12" y1="4.5" x2="12" y2="13.5" /><line x1="12" y1="19.5" x2="12" y2="19.6" />
    </svg>
  );
}

export const TASK_STATUS: Record<TaskStatus, { label: string; color: string; bg: string; border: string; icon: GlyphIcon }> = {
  otgan:        { label: "Muddati o'tgan", color: "#C4320A", bg: "#FDE7E4", border: "#F9C6BE", icon: Exclaim },
  tasdiqlashda: { label: "Tasdiqlashda",   color: "#B54708", bg: "#FEF0C7", border: "#FDDC8A", icon: Hourglass },
  bajarilmoqda: { label: "Bajarilmoqda",   color: "#2D5BD7", bg: "#E4ECFF", border: "#C7D7FE", icon: ArrowRight },
  korilmagan:   { label: "Ko'rilmagan",    color: "#6D5DD3", bg: "#EEEAFE", border: "#D9D1FB", icon: EyeOff },
  bajarilgan:   { label: "Bajarilgan",     color: "#027A48", bg: "#D9F7E6", border: "#A6EBC5", icon: Check },
};

export const MANBA_LABEL: Record<string, string> = {
  pq_pf: "Prezident hujjatlari (PQ/PF)", vm: "Vazirlar Mahkamasi", qv: "Vazirlik (QV)", direktor: "Institut direktori",
};
export const TUR_LABEL: Record<string, string> = { kiruvchi: "Kiruvchi hujjat", chiquvchi: "Chiquvchi hujjat", ichki: "Ichki hujjat" };
export const DAVRIYLIK_LABEL: Record<string, string> = { bir_martalik: "Bir martalik", har_chorakda: "Har chorakda", har_yili: "Har yili" };

export const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
export const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function infoOf(d: IjroDoc): BolimInfo[] {
  try { return JSON.parse(d.masul_bolimlar_info || "[]"); } catch { return []; }
}

/** Bugundan necha kun (manfiy — o'tib ketgan). */
export function daysFromToday(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/** Bo'limlar holatidan hujjatning umumiy holati (IjroNazorat.docAggHolati bilan bir xil mantiq). */
function aggHolati(d: IjroDoc): string {
  if (d.holati === "bajarildi") return "bajarildi";
  const items = infoOf(d);
  if (!items.length) return "none";
  if (items.some(i => i.holati === "bajarilmoqda")) return "bajarilmoqda";
  if (items.some(i => i.holati === "tasdiq_kutilmoqda")) return "tasdiq_kutilmoqda";
  if (items.some(i => i.holati === "qabul_qilindi")) return "qabul_qilindi";
  const nonRejected = items.filter(i => i.holati !== "rad_etildi");
  if (nonRejected.length && nonRejected.every(i => i.holati === "bajarildi")) return "bajarildi";
  return "yuborildi";
}

export function taskStatus(d: IjroDoc): TaskStatus {
  const a = aggHolati(d);
  if (a === "bajarildi") return "bajarilgan";
  const du = daysFromToday(d.ijro_muddati);
  if (du !== null && du < 0) return "otgan";
  if (a === "tasdiq_kutilmoqda") return "tasdiqlashda";
  if (a === "yuborildi" || a === "none") return "korilmagan";
  return "bajarilmoqda";
}

/** Taqvimda "ko'rilmagan" alohida ko'rsatilmaydi — "Bajarilmoqda"ga qo'shiladi. */
export function calendarStatus(d: IjroDoc): TaskStatus {
  const s = taskStatus(d);
  return s === "korilmagan" ? "bajarilmoqda" : s;
}

/** "5 okt 2026" */
export function fmtShort(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${Number(m[3])} ${MONTHS_SHORT[Number(m[2]) - 1]} ${m[1]}`;
}

/** "5 oktabr 2026 12:24" (UTC vaqtni Toshkent vaqtiga o'tkazib) */
export function fmtLongDT(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
  const t = new Date(d.getTime() + 5 * 3600 * 1000);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()].toLowerCase()} ${t.getUTCFullYear()} ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

export function relDays(n: number): string {
  if (n === 0) return "Bugun";
  if (n === 1) return "Ertaga";
  if (n === -1) return "Kecha";
  return n > 0 ? `${n} kun keyin` : `${-n} kun oldin`;
}

export function docTitle(d: Pick<IjroDoc, "hujjat_raqami" | "id">) {
  return d.hujjat_raqami ? `№ ${d.hujjat_raqami}` : `DOC-${d.id}`;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
function blobOf(name: string, b64: string): Blob {
  const raw = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(raw);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: MIME[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream" });
}
export function downloadB64(name: string, b64: string) {
  const url = URL.createObjectURL(blobOf(name, b64));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** PDF/rasm — yangi oynada ko'rish; boshqalari yuklab olinadi. */
export function viewB64(name: string, b64: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) return downloadB64(name, b64);
  window.open(URL.createObjectURL(blobOf(name, b64)), "_blank", "noopener");
}
export function b64Size(b64: string): string {
  const raw = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bytes = Math.floor(raw.length * 3 / 4);
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} mb` : `${Math.max(1, Math.round(bytes / 1024))} kb`;
}
export function shortName(name: string, max = 16): string {
  if (name.length <= max) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, name.length - ext.length);
  const keep = Math.max(4, max - ext.length - 3);
  return `${base.slice(0, Math.ceil(keep / 2))}...${base.slice(-Math.floor(keep / 2))}${ext}`;
}

export function StatusPill({ s, count, compact }: { s: TaskStatus; count?: number; compact?: boolean }) {
  const c = TASK_STATUS[s];
  const Icon = c.icon;
  return (
    <span className="flex items-center gap-1.5 px-1.5 py-1 text-[12.5px] font-semibold w-full min-w-0"
      style={{ background: c.bg, color: c.color, borderRadius: 999 }} title={c.label}>
      <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center rounded-full" style={{ background: c.color }}>
        <Icon size={12} color="#FFFFFF" strokeWidth={2.6} />
      </span>
      {!compact && <span className="truncate">{c.label}</span>}
      {count !== undefined && <span className="ml-auto pr-1.5 font-bold">{count}</span>}
    </span>
  );
}

export function StatusIcon({ s, size = 22 }: { s: TaskStatus; size?: number }) {
  const c = TASK_STATUS[s];
  const Icon = c.icon;
  return (
    <span className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: size, height: size, background: c.color }}>
      <Icon size={Math.round(size * 0.62)} color="#FFFFFF" strokeWidth={2.6} />
    </span>
  );
}
