"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Paperclip, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { IjroDoc } from "@/components/ijro/IjroNazorat";
import {
  TUR_LABEL, MANBA_LABEL, fmtShort, fmtLongDT, daysFromToday, downloadB64, shortName, taskStatus,
} from "@/components/ijro/ijroShared";

export interface TrackBolim {
  id: number; bolim_id: number; bolim_nomi: string | null; holati: string;
  izoh: string | null; qaror_at: string | null; qaror_by_nomi: string | null;
  xodim_nomi: string | null; yakunlash_izohi: string | null;
  yakunlash_fayllar: { name: string; b64: string }[]; yakunlangan_at: string | null; yakunlagan_by_nomi: string | null;
}
export interface Tracking { doc: IjroDoc; bolimlar: TrackBolim[] }

export const BOLIM_HOLAT: Record<string, { label: string; color: string; bg: string }> = {
  yuborildi:         { label: "Ko'rilmagan",   color: "#6D5DD3", bg: "#EEEAFE" },
  qabul_qilindi:     { label: "Qabul qilindi", color: "#2D5BD7", bg: "#E4ECFF" },
  bajarilmoqda:      { label: "Bajarilmoqda",  color: "#2D5BD7", bg: "#E4ECFF" },
  tasdiq_kutilmoqda: { label: "Tasdiqlashda",  color: "#B54708", bg: "#FEF0C7" },
  bajarildi:         { label: "Bajarildi",     color: "#027A48", bg: "#D9F7E6" },
  rad_etildi:        { label: "Rad etildi",    color: "#C4320A", bg: "#FDE7E4" },
};

export function useTracking(docId: number | null) {
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (docId === null) return;
    let alive = true;
    setData(null); setError(null);
    apiFetch<Tracking>(`/ijro-docs/${docId}/tracking`)
      .then(r => { if (alive) setData(r); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); });
    return () => { alive = false; };
  }, [docId]);
  return { data, error };
}

function Row({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5" style={{ borderBottom: "1px solid #EEF1F6" }}>
      <span className="text-sm flex-shrink-0" style={{ color: "#667085" }}>{label}</span>
      <span className="text-sm text-right font-medium" style={{ color: accent ?? "#101828" }}>{children}</span>
    </div>
  );
}

/** Taqvimdagi hujjat bosilganda — qisqa ko'rinish; "Ochish" to'liq sahifaga o'tkazadi. */
export default function IjroDocModal({ docId, onClose }: { docId: number; onClose: () => void }) {
  const router = useRouter();
  const { data, error } = useTracking(docId);
  const doc = data?.doc;
  const overdue = doc ? taskStatus(doc) === "otgan" : false;
  const du = doc ? daysFromToday(doc.ijro_muddati) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const files = doc?.fayl_name && doc.fayl_b64 ? [{ name: doc.fayl_name, b64: doc.fayl_b64 }] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(16,24,40,0.45)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div className="w-full max-w-[960px] max-h-[92vh] flex flex-col overflow-hidden"
        style={{ background: "#FFFFFF", borderRadius: 22, boxShadow: "0 24px 64px rgba(16,24,40,0.25)" }}
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ background: "#F7F9FC", borderBottom: "1px solid #EEF1F6" }}>
          <h3 className="text-base" style={{ color: "#101828" }}>
            Hujjat raqami: <b>{doc?.hujjat_raqami || (doc ? `DOC-${doc.id}` : "…")}</b>
          </h3>
          <button onClick={onClose} aria-label="Yopish" className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-80"
            style={{ background: "#E4E7EC" }}>
            <X size={18} style={{ color: "#475467" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {!data && !error ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
          ) : error ? (
            <p className="text-sm text-center py-12" style={{ color: "#C4320A" }}>{error}</p>
          ) : doc && (
            <>
              <div className="pt-1">
                <Row label="Hujjat raqami va sanasi" accent="#3F5BD8">
                  {doc.hujjat_raqami || `DOC-${doc.id}`}{doc.hujjat_sanasi ? ` - ${fmtShort(doc.hujjat_sanasi)}` : ""}
                </Row>
                <Row label="Hujjat turi">{TUR_LABEL[doc.tur] ?? doc.tur}</Row>
                <Row label="Bajarish muddati" accent={overdue ? "#D92D20" : undefined}>
                  {doc.ijro_muddati ? fmtShort(doc.ijro_muddati) : "—"}
                  {overdue && du !== null && <span className="ml-2 text-xs">({-du} kun kechikdi)</span>}
                </Row>
                <Row label="Yuboruvchi">{MANBA_LABEL[doc.manba] ?? "—"}</Row>
                {doc.masul_orinbosar_nomi && <Row label="Mas'ul o'rinbosar">{doc.masul_orinbosar_nomi}</Row>}
                <Row label="Kiritgan">{doc.created_by_nomi || "—"}</Row>
                <Row label="Topshiriq yaratilgan vaqt">{fmtLongDT(doc.created_at)}</Row>
              </div>

              {doc.sarlavha && (
                <section className="mt-6">
                  <h4 className="text-[15px] font-semibold mb-2" style={{ color: "#101828" }}>Topshiriq nomi</h4>
                  <p className="text-[15px] leading-relaxed" style={{ color: "#344054" }}>{doc.sarlavha}</p>
                </section>
              )}
              <section className="mt-6">
                <h4 className="text-[15px] font-semibold mb-2" style={{ color: "#101828" }}>Qisqacha mazmuni</h4>
                <p className="text-[15px] leading-relaxed italic" style={{ color: "#667085", whiteSpace: "pre-wrap" }}>{doc.mazmun || "—"}</p>
              </section>
              {doc.qoshimcha_malumot && (
                <section className="mt-6">
                  <h4 className="text-[15px] font-semibold mb-2" style={{ color: "#101828" }}>Qo&apos;shimcha ma&apos;lumot</h4>
                  <p className="text-[15px] leading-relaxed italic" style={{ color: "#667085", whiteSpace: "pre-wrap" }}>{doc.qoshimcha_malumot}</p>
                </section>
              )}

              <section className="mt-6">
                <h4 className="text-[15px] font-semibold mb-3" style={{ color: "#101828" }}>Biriktirilgan fayllar</h4>
                {files.length ? (
                  <div className="flex flex-wrap gap-3">
                    {files.map(f => (
                      <button key={f.name} onClick={() => downloadB64(f.name, f.b64)} title={f.name}
                        className="flex items-center gap-2.5 px-4 py-3.5 text-sm hover:bg-[#F7F9FC]"
                        style={{ border: "1px solid #E4E7EC", borderRadius: 12, color: "#344054" }}>
                        <Paperclip size={16} style={{ color: "#667085" }} />{shortName(f.name)}
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm" style={{ color: "#98A2B3" }}>Fayl biriktirilmagan</p>}
              </section>

              <section className="mt-6">
                <h4 className="text-[15px] font-semibold mb-3" style={{ color: "#101828" }}>Ijrochilar</h4>
                {data!.bolimlar.length ? (
                  <div style={{ border: "1px solid #E4E7EC", borderRadius: 12 }}>
                    {data!.bolimlar.map((b, i) => {
                      const h = BOLIM_HOLAT[b.holati] ?? BOLIM_HOLAT.yuborildi;
                      return (
                        <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid #EEF1F6" : "none" }}>
                          <span className="w-6 text-sm font-semibold" style={{ color: "#98A2B3" }}>{i + 1}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold truncate" style={{ color: "#101828" }}>{b.bolim_nomi || "—"}</span>
                            {b.xodim_nomi && <span className="block text-xs" style={{ color: "#667085" }}>Ijrochi: {b.xodim_nomi}</span>}
                          </span>
                          <span className="px-2.5 py-1 text-xs font-semibold whitespace-nowrap" style={{ background: h.bg, color: h.color, borderRadius: 999 }}>{h.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm" style={{ color: "#98A2B3" }}>Hali bo&apos;limga yuborilmagan</p>}
              </section>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #EEF1F6" }}>
          <button onClick={() => router.push(`/ijro/topshiriqlar/${docId}`)}
            className="px-7 py-3 text-sm font-semibold text-white hover:opacity-90"
            style={{ background: "#3F8CFF", borderRadius: 999, boxShadow: "0 6px 16px rgba(63,140,255,0.35)" }}>
            Ochish
          </button>
        </div>
      </div>
    </div>
  );
}
