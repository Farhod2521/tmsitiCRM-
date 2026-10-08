import { apiFetch } from "@/lib/api";

export interface AuditLayer { nomi: string; qalinlik: number | string; lambda: number | string; }
export type AuditData = Record<string, unknown> & {
  devor_qatlamlar: AuditLayer[];
  tom_qatlamlar: AuditLayer[];
  pol_qatlamlar: AuditLayer[];
};

export interface AuditListItem {
  id: number;
  title: string;
  bino_nomi: string | null;
  manzil?: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string | null;
  photos: number;
  can_edit: boolean;
}

export interface CalcLoss { key: string; nomi: string; A: number; R: number; n?: number; Q: number; kw: number; ulush: number; }
export interface CalcLayer { nomi: string; qalinlik: number; lambda: number; R: number; }
export interface AuditCalc {
  dt: number; hajm: number;
  devor: { qatlamlar: CalcLayer[]; Rk: number; R0: number };
  tom: { qatlamlar: CalcLayer[]; Rk: number; R0: number };
  pol: { qatlamlar: CalcLayer[]; Rk: number; R0: number | null };
  deraza_soni: number; deraza_maydon: number; deraza_maydon_asosiy: number; yolak_deraza_maydon: number;
  eshik_soni: number; eshik_maydon: number;
  devor_maydon: number; devor_maydon_auto: number; tom_maydon: number; pol_maydon: number; pol_maydon_auto: number;
  yoqotishlar: CalcLoss[]; jami_kw: number;
  taqqoslash: { devor: boolean; tom: boolean; pol: boolean | null; deraza: boolean; eshik: boolean };
  koef: { deraza: number; eshik: number; yolak: number };
}

export interface AuditFull extends AuditListItem {
  data: AuditData;
  photo_data: Record<string, string>;
  calc: AuditCalc;
}

/** Hisobotni Word (docx) sifatida yuklab olish. */
export async function downloadAuditDocx(id: number, title: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = localStorage.getItem("crm_token");
  const res = await fetch(`${API_URL}/energoaudit/${id}/docx`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, "_") || "energoaudit"}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function checkAuditAccess(): Promise<boolean> {
  return apiFetch<{ allowed: boolean }>("/energoaudit/access").then(r => r.allowed).catch(() => false);
}

/** Uzbekcha son ko'rinishi (vergul bilan). */
export function nf(v: number | null | undefined, nd = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v.toFixed(nd)).toString().replace(".", ",");
}
