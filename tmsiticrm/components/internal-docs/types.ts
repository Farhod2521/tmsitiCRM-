export type InternalDocStatus = "yuborildi" | "oqilgan" | "bolim_tasdiqladi" | "zamdirektor_tasdiqladi" | "rad_etildi";

export interface InternalDocLogEntry {
  id: number;
  action: string;
  izoh: string | null;
  actor_nomi: string | null;
  created_at: string | null;
}

export interface InternalDocListItem {
  id: number;
  hujjat_raqami: string;
  nomi: string;
  department_id: number;
  department_nomi: string | null;
  zamdirektor_id: number | null;
  zamdirektor_nomi: string | null;
  status: InternalDocStatus;
  rad_sababi: string | null;
  parent_doc_id: number | null;
  created_by: number;
  created_by_nomi: string | null;
  created_at: string | null;
}

export interface InternalDocDetail extends InternalDocListItem {
  mazmun: string | null;
  fayl_name: string | null;
  log: InternalDocLogEntry[];
}

export const STATUS_CFG: Record<InternalDocStatus, { label: string; color: string; bg: string }> = {
  yuborildi:              { label: "Yuborildi",                color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
  oqilgan:                { label: "O'qilgan",                 color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
  bolim_tasdiqladi:       { label: "Bo'lim tasdiqladi",        color: "#15C0E6", bg: "rgba(21,192,230,0.1)" },
  zamdirektor_tasdiqladi: { label: "Zamdirektor tasdiqladi",    color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
  rad_etildi:             { label: "Rad etildi",                color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
};

export const LOG_ACTION_LABEL: Record<string, string> = {
  yaratildi:              "Yaratildi",
  oqildi:                 "Bo'lim boshlig'i ochib ko'rdi",
  bolim_tasdiqladi:       "Bo'lim boshlig'i tasdiqladi",
  bolim_rad_etdi:         "Bo'lim boshlig'i rad etdi",
  zamdirektor_tasdiqladi: "Zamdirektor tasdiqladi",
  zamdirektor_rad_etdi:   "Zamdirektor rad etdi",
};

export function fmtDt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadBase64(name: string, b64: string) {
  const a = document.createElement("a");
  a.href = b64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
