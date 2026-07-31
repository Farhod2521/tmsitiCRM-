"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Search, FileText, Clock, CheckCircle2, XCircle, RefreshCw,
  Building2, AlertTriangle, Loader2, ChevronRight, X,
  Download, History, Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocHolati    = "jarayonda" | "bajarildi" | "muddati_yaqin" | "kechikmoqda" | "bolimga_yonaltirildi";
type BolimHolati  = "yuborildi" | "qabul_qilindi" | "rad_etildi" | "bajarilmoqda" | "bajarildi";

interface IjroDocOut {
  id: number;
  tur: string;
  manba: string;
  hujjat_raqami: string | null;
  hujjat_sanasi: string | null;
  sarlavha: string | null;
  mazmun: string | null;
  masul_orinbosar_nomi: string | null;
  masul_bolimlar_nomi: string | null;
  masul_bolimlar_info: string | null;
  masul_bolim_boshliqlari_nomi: string | null;
  ijro_muddati: string | null;
  davriyligi: string;
  kelishuvchi_tashkilotlar: string | null;
  fayl_name: string | null;
  fayl_b64: string | null;
  holati: DocHolati;
  created_at: string | null;
}

interface AssignLogEntry {
  id: number;
  xodim_nomi: string | null;
  assigned_by_nomi: string | null;
  assigned_at: string | null;
}

interface YakunlashFayl { name: string; b64: string; }

interface DocBolimRow {
  id: number;
  bolim_id: number;
  bolim_nomi: string | null;
  holati: BolimHolati;
  izoh: string | null;
  assigned_at: string | null;
  qaror_at: string | null;
  qaror_by_nomi: string | null;
  xodim_nomi: string | null;
  xodim_assigned_at: string | null;
  assign_log: AssignLogEntry[];
  yakunlash_izohi: string | null;
  yakunlash_fayllar: YakunlashFayl[];
  yakunlangan_at: string | null;
  yakunlagan_by_nomi: string | null;
}

interface Tracking {
  doc: IjroDocOut;
  bolimlar: DocBolimRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MANBA_LABELS: Record<string, string> = {
  pq_pf: "PQ/PF",
  vm: "VM",
  qv: "QV",
  direktor: "Direktor",
};

const DOC_HOLATI: Record<DocHolati, { label: string; color: string; bg: string }> = {
  jarayonda:            { label: "Jarayonda",              color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  bajarildi:            { label: "Bajarildi",              color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  muddati_yaqin:        { label: "Muddati yaqin",          color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
  kechikmoqda:          { label: "Kechikmoqda",            color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  bolimga_yonaltirildi: { label: "Bo'limga yo'naltirildi", color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
};

const BOLIM_HOLATI: Record<BolimHolati, { label: string; color: string; bg: string }> = {
  yuborildi:     { label: "Yuborildi",     color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  qabul_qilindi: { label: "Qabul qilindi", color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  rad_etildi:    { label: "Rad etildi",    color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  bajarilmoqda:  { label: "Bajarilmoqda",  color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
  bajarildi:     { label: "Bajarildi",     color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
};

function BolimlarCell({ info, fallback }: { info: string | null; fallback: string | null }) {
  type BolimInfo = { id: number; name: string; holati: BolimHolati };
  let items: BolimInfo[] | null = null;
  if (info) {
    try { items = JSON.parse(info); } catch { items = null; }
  }

  if (!items || items.length === 0) {
    if (!fallback) return <span className="text-xs" style={{ color: "#91929E" }}>—</span>;
    return (
      <div className="flex flex-col gap-1">
        {fallback.split(", ").map((b: string) => (
          <span key={b} className="text-xs font-bold px-2 py-0.5 inline-block"
            style={{ background: "rgba(63,140,255,0.08)", color: "#3F8CFF", borderRadius: 6 }}>
            {b}
          </span>
        ))}
      </div>
    );
  }

  // Rad etilgan bo'limlar shu yerda ko'rsatilmaydi — ular faqat "Ko'rish" tafsilotida chiqadi.
  const active = items.filter(b => b.holati !== "rad_etildi");
  if (active.length === 0) return <span className="text-xs" style={{ color: "#91929E" }}>—</span>;

  return (
    <div className="flex flex-col gap-1">
      {active.map(b => {
        const cfg = BOLIM_HOLATI[b.holati] || BOLIM_HOLATI.yuborildi;
        return (
          <span key={b.id} className="text-xs font-bold px-2 py-0.5 inline-block"
            style={{ background: cfg.bg, color: cfg.color, borderRadius: 6 }}>
            {b.name}
          </span>
        );
      })}
    </div>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{ background: bg, color, borderRadius: 8 }}>{label}</span>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function downloadBase64(name: string, b64: string) {
  const a = document.createElement("a");
  a.href = b64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function daysLeft(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)} kun o'tgan`, color: "#FF5C5C" };
  if (diff === 0) return { text: "Bugun",              color: "#FF5C5C" };
  if (diff <= 3)  return { text: `${diff} kun qoldi`,  color: "#FFBD21" };
  return           { text: `${diff} kun qoldi`,        color: "#00C48C" };
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function TrackingModal({ docId, onClose }: { docId: number; onClose: () => void }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch<Tracking>(`/ijro-docs/${docId}/tracking`)
      .then(setTracking)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #F4F9FD" }}>
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Hujjat kuzatuvi</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
            </div>
          ) : !tracking ? (
            <p className="text-center py-12 text-sm" style={{ color: "#91929E" }}>Ma'lumot yuklanmadi</p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Doc header */}
              <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-1 text-white"
                    style={{ background: "#3F8CFF", borderRadius: 6 }}>
                    {MANBA_LABELS[tracking.doc.manba] || tracking.doc.manba}
                  </span>
                  <Chip {...DOC_HOLATI[tracking.doc.holati]} />
                  {(() => { const dl = daysLeft(tracking.doc.ijro_muddati); return dl ? (
                    <span className="text-xs font-bold flex items-center gap-1 ml-auto" style={{ color: dl.color }}>
                      <Clock size={11} /> {dl.text}
                    </span>
                  ) : null; })()}
                </div>
                <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>
                  {tracking.doc.sarlavha || `№ ${tracking.doc.hujjat_raqami || tracking.doc.id}`}
                </h3>
                {tracking.doc.hujjat_raqami && (
                  <p className="text-xs mt-1" style={{ color: "#91929E" }}>Raqam: № {tracking.doc.hujjat_raqami} | Sana: {tracking.doc.hujjat_sanasi || "—"}</p>
                )}
                {tracking.doc.mazmun && (
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: "#7D8592" }}>{tracking.doc.mazmun}</p>
                )}
                {tracking.doc.fayl_name && (
                  <button onClick={() => tracking.doc.fayl_b64 && downloadBase64(tracking.doc.fayl_name!, tracking.doc.fayl_b64)}
                    disabled={!tracking.doc.fayl_b64}
                    className="flex items-center gap-2 mt-3 px-3 py-2 w-full hover:opacity-80 disabled:opacity-40"
                    style={{ background: "#FFFFFF", borderRadius: 9, border: "1px dashed #D0D9E8" }}>
                    <FileText size={14} style={{ color: "#3F8CFF" }} />
                    <span className="text-xs font-bold" style={{ color: "#0A1629" }}>{tracking.doc.fayl_name}</span>
                    <Download size={13} className="ml-auto" style={{ color: "#3F8CFF" }} />
                  </button>
                )}
              </div>

              {/* Bolimlar holati */}
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#0A1629" }}>
                  <Building2 size={15} style={{ color: "#3F8CFF" }} />
                  Bo'limlar bo'yicha holat ({tracking.bolimlar.length} ta)
                </h4>

                {tracking.bolimlar.length === 0 ? (
                  <div className="text-center py-8" style={{ background: "#F4F9FD", borderRadius: 12 }}>
                    <Building2 size={28} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
                    <p className="text-sm" style={{ color: "#91929E" }}>Hujjat hali hech qaysi bo'limga yuborilmagan</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {tracking.bolimlar.map(b => {
                      const cfg = BOLIM_HOLATI[b.holati];
                      return (
                        <div key={b.id} className="p-4"
                          style={{ background: cfg.bg, borderRadius: 12, border: `1px solid ${cfg.color}22` }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 flex items-center justify-center"
                                style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8 }}>
                                <Building2 size={14} style={{ color: cfg.color }} />
                              </div>
                              <span className="font-bold text-sm" style={{ color: "#0A1629" }}>
                                {b.bolim_nomi || `Bo'lim #${b.bolim_id}`}
                              </span>
                            </div>
                            <Chip label={cfg.label} color={cfg.color} bg="rgba(255,255,255,0.8)" />
                          </div>

                          {/* Progress steps */}
                          <div className="flex items-center gap-1 mt-2">
                            {(["yuborildi","qabul_qilindi","bajarilmoqda","bajarildi"] as BolimHolati[]).map((step, i) => {
                              const steps: BolimHolati[] = ["yuborildi","qabul_qilindi","bajarilmoqda","bajarildi"];
                              const curIdx  = steps.indexOf(b.holati);
                              const stepIdx = steps.indexOf(step);
                              const done    = stepIdx <= curIdx && b.holati !== "rad_etildi";
                              const labels  = ["Yuborildi","Qabul qilindi","Bajarilmoqda","Bajarildi"];
                              return (
                                <div key={step} className="flex items-center gap-1 flex-1">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: done ? cfg.color : "#E8EDF5" }}>
                                    {done && <CheckCircle2 size={12} color="#fff" />}
                                  </div>
                                  <div className="text-center" style={{ minWidth: 0 }}>
                                    <p className="text-[10px] font-bold truncate"
                                      style={{ color: done ? cfg.color : "#91929E" }}>{labels[i]}</p>
                                  </div>
                                  {i < 3 && <div className="flex-1 h-[2px]" style={{ background: done && stepIdx < curIdx ? cfg.color : "#E8EDF5" }} />}
                                </div>
                              );
                            })}
                          </div>

                          {b.holati === "rad_etildi" && (
                            <div className="mt-2 px-3 py-2" style={{ background: "rgba(255,92,92,0.08)", borderRadius: 8 }}>
                              <p className="text-xs font-bold mb-0.5" style={{ color: "#FF5C5C" }}>Rad etildi</p>
                              {b.izoh && <p className="text-xs" style={{ color: "#7D8592" }}>"{b.izoh}"</p>}
                              {b.qaror_by_nomi && <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>— {b.qaror_by_nomi}</p>}
                            </div>
                          )}

                          {b.holati === "qabul_qilindi" && b.izoh && (
                            <p className="text-xs mt-2 px-2 py-1" style={{ background: "rgba(255,255,255,0.6)", borderRadius: 6, color: "#7D8592" }}>"{b.izoh}"</p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "#91929E" }}>
                            <span>Yuborildi: {fmt(b.assigned_at)}</span>
                            {b.qaror_at && <span>Qaror: {fmt(b.qaror_at)}</span>}
                            {b.qaror_by_nomi && <span>Kim: {b.qaror_by_nomi}</span>}
                          </div>

                          {b.xodim_nomi && (
                            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${cfg.color}22` }}>
                              <p className="text-xs" style={{ color: "#7D8592" }}>
                                Ijrochi xodim: <b style={{ color: "#0A1629" }}>{b.xodim_nomi}</b>
                                {b.xodim_assigned_at && <> — {fmt(b.xodim_assigned_at)}</>}
                              </p>
                              {b.assign_log && b.assign_log.length > 1 && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {b.assign_log.slice().reverse().map(log => (
                                    <p key={log.id} className="text-[11px]" style={{ color: "#91929E" }}>
                                      <b style={{ color: "#7D8592" }}>{log.xodim_nomi}</b>ga biriktirildi
                                      {log.assigned_by_nomi && ` — ${log.assigned_by_nomi} tomonidan`}
                                      {log.assigned_at && `, ${fmt(log.assigned_at)}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {b.holati === "bajarildi" && (b.yakunlash_izohi || b.yakunlash_fayllar.length > 0) && (
                            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${cfg.color}22` }}>
                              <p className="text-xs font-bold mb-1" style={{ color: "#00A578" }}>Yakunlash hisoboti:</p>
                              {b.yakunlash_izohi && (
                                <p className="text-xs mb-1.5" style={{ color: "#0A1629" }}>{b.yakunlash_izohi}</p>
                              )}
                              {b.yakunlash_fayllar.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  {b.yakunlash_fayllar.map((f, i) => (
                                    <button key={i} onClick={() => downloadBase64(f.name, f.b64)}
                                      className="flex items-center justify-between px-2 py-1.5 hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.7)", borderRadius: 6 }}>
                                      <span className="flex items-center gap-1.5 text-[11px] font-bold truncate" style={{ color: "#0A1629" }}>
                                        <FileText size={12} style={{ color: "#00A578" }} /> {f.name}
                                      </span>
                                      <Download size={12} style={{ color: "#00A578" }} />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {(b.yakunlagan_by_nomi || b.yakunlangan_at) && (
                                <p className="text-[11px] mt-1" style={{ color: "#91929E" }}>
                                  {b.yakunlagan_by_nomi && `${b.yakunlagan_by_nomi} tomonidan`}
                                  {b.yakunlangan_at && `, ${fmt(b.yakunlangan_at)}`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hisobot Modal ─────────────────────────────────────────────────────────────

const OY_NOMLARI = [
  "YANVAR", "FEVRAL", "MART", "APREL", "MAY", "IYUN",
  "IYUL", "AVGUST", "SENTABR", "OKTABR", "NOYABR", "DEKABR",
];

const MANBA_HUJJAT_TURI: Record<string, string> = {
  pq_pf: "Farmon",
  vm:    "Qaror",
  qv:    "Buyruq",
  direktor: "Farmoyish",
};

interface HisobotOyGuruh { year: number; month: number; items: IjroDocOut[]; }

function HisobotModal({ docs, onClose }: { docs: IjroDocOut[]; onClose: () => void }) {
  const withMuddat = docs.filter(d => d.ijro_muddati);

  const groups: HisobotOyGuruh[] = [];
  withMuddat.forEach(d => {
    const dt = new Date(d.ijro_muddati as string);
    const y = dt.getFullYear(), m = dt.getMonth();
    let g = groups.find(x => x.year === y && x.month === m);
    if (!g) { g = { year: y, month: m, items: [] }; groups.push(g); }
    g.items.push(d);
  });
  groups.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  const yil = groups.length ? groups[groups.length - 1].year : new Date().getFullYear();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #F4F9FD" }}>
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Ijro topshiriqlari hisoboti</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* Rasmiy hujjat sarlavhasi */}
          <div className="text-center px-4 py-4 mb-4" style={{ border: "2px solid #0A1629" }}>
            <p className="font-bold" style={{ color: "#0A1629" }}>
              O'zbekiston Respublikasi Prezidentining{" "}
              <span style={{ color: "#B02A2A" }}>Farmon, qaror, farmoyish va yig'ilish bayonlarida</span>{" "}
              TMSITI tomonidan
            </p>
            <p className="font-bold mt-1" style={{ color: "#0A1629" }}>
              {yil} yilda <span style={{ fontStyle: "italic" }}>(asosiy)</span> ijrosi ta'minlanishi belgilangan topshiriqlar to'g'risida
            </p>
            <p className="font-bold mt-1 tracking-wide" style={{ color: "#0A1629" }}>MA'LUMOT</p>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-16" style={{ background: "#F4F9FD", borderRadius: 12 }}>
              <FileText size={28} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
              <p className="text-sm" style={{ color: "#91929E" }}>Muddati belgilangan topshiriqlar topilmadi</p>
            </div>
          ) : (
            <table className="w-full" style={{ minWidth: 960, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["№","Nomer va sanasi","Topshiriq mazmuni","Topshiriq muddati","Ijro etuvchi bo'lim(lar)","Ijrochi","Topshiriq holati"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-bold"
                      style={{ color: "#0A1629", background: "#D9E4F5", border: "1px solid #9FB2CE", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={`${g.year}-${g.month}`}>
                    <tr>
                      <td colSpan={7} className="px-3 py-1.5 text-center text-sm font-bold text-white"
                        style={{ background: "#3F8CFF", border: "1px solid #2C6FD1" }}>
                        {OY_NOMLARI[g.month]} {g.year}
                      </td>
                    </tr>
                    {g.items.map((d, i) => {
                      const cfg = DOC_HOLATI[d.holati];
                      return (
                        <tr key={d.id}>
                          <td className="px-3 py-3 text-xs text-center align-top" style={{ color: "#0A1629", border: "1px solid #D0D9E8" }}>{i + 1}</td>
                          <td className="px-3 py-3 align-top" style={{ border: "1px solid #D0D9E8" }}>
                            <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{MANBA_HUJJAT_TURI[d.manba] || MANBA_LABELS[d.manba]}</p>
                            <p className="text-xs font-bold" style={{ color: "#3F8CFF" }}>{d.hujjat_raqami || `DOC-${d.id}`}</p>
                            <p className="text-xs" style={{ color: "#91929E" }}>{d.hujjat_sanasi || "—"}</p>
                          </td>
                          <td className="px-3 py-3 align-top" style={{ maxWidth: 320, border: "1px solid #D0D9E8" }}>
                            <p className="text-sm" style={{ color: "#0A1629" }}>{d.mazmun || d.sarlavha || "—"}</p>
                          </td>
                          <td className="px-3 py-3 text-xs whitespace-nowrap align-top" style={{ color: "#B02A2A", fontStyle: "italic", border: "1px solid #D0D9E8" }}>
                            {fmt(d.ijro_muddati)}
                          </td>
                          <td className="px-3 py-3 align-top" style={{ border: "1px solid #D0D9E8" }}>
                            <BolimlarCell info={d.masul_bolimlar_info} fallback={d.masul_bolimlar_nomi} />
                          </td>
                          <td className="px-3 py-3 align-top" style={{ border: "1px solid #D0D9E8" }}>
                            <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{d.masul_orinbosar_nomi || "—"}</p>
                          </td>
                          <td className="px-3 py-3 align-top" style={{ border: "1px solid #D0D9E8" }}>
                            <Chip label={cfg.label} color={cfg.color} bg={cfg.bg} />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NazoratPage() {
  const [docs,    setDocs]    = useState<IjroDocOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filterH, setFilterH] = useState("all");
  const [trackId, setTrackId] = useState<number | null>(null);
  const [showHisobot, setShowHisobot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocs(await apiFetch<IjroDocOut[]>("/ijro-docs/")); }
    catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter(d => {
    if (filterH !== "all" && d.holati !== filterH) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.sarlavha || "").toLowerCase().includes(s)
        || (d.hujjat_raqami || "").toLowerCase().includes(s)
        || (d.mazmun || "").toLowerCase().includes(s);
    }
    return true;
  });

  const stats = [
    { label: "Jami",           value: docs.length,                                                   color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
    { label: "Jarayonda",      value: docs.filter(d => d.holati === "jarayonda").length,              color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
    { label: "Muddati yaqin",  value: docs.filter(d => d.holati === "muddati_yaqin").length,          color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
    { label: "Kechikmoqda",    value: docs.filter(d => d.holati === "kechikmoqda").length,             color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
    { label: "Bajarildi",      value: docs.filter(d => d.holati === "bajarildi").length,               color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  ];

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-xl sm:text-2xl" style={{ color: "#0A1629" }}>Ijro nazorati monitoring</h1>
          <p className="text-xs mt-1" style={{ color: "#91929E" }}>Barcha hujjatlar va bo'limlar bajarilishini kuzating</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHisobot(true)}
            className="px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 4px 16px rgba(63,140,255,0.3)" }}>
            Hisobot
          </button>
          <button onClick={load} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 4px 16px rgba(196,203,214,0.15)" }}>
            <RefreshCw size={16} style={{ color: "#3F8CFF" }} />
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="p-4 flex items-center gap-3"
            style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: "0 4px 16px rgba(196,203,214,0.12)" }}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
              style={{ background: s.bg, borderRadius: 10 }}>
              <FileText size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
              <p className="text-xs" style={{ color: "#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap px-6 py-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-2 px-3 py-2.5 min-w-[220px]"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <Search size={14} style={{ color: "#91929E" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Sarlavha, raqam bo'yicha..." className="bg-transparent text-sm outline-none flex-1"
              style={{ color: "#0A1629" }} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "all",                label: "Barchasi"         },
              { key: "jarayonda",          label: "Jarayonda"        },
              { key: "muddati_yaqin",      label: "Muddati yaqin"    },
              { key: "kechikmoqda",        label: "Kechikmoqda"      },
              { key: "bajarildi",          label: "Bajarildi"        },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterH(f.key)}
                className="px-3 py-2 text-xs font-bold transition-all"
                style={{
                  borderRadius: 8,
                  background: filterH === f.key ? "#0A1629" : "#F4F9FD",
                  color: filterH === f.key ? "#FFFFFF" : "#7D8592",
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                {["HUJJAT","MANBA","SARLAVHA","MAS'UL","MUDDATI","HOLATI","BO'LIMLAR","TAFSILOT"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold"
                    style={{ color: "#91929E", background: "#FAFCFF", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <Loader2 size={24} className="mx-auto animate-spin" style={{ color: "#3F8CFF" }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <FileText size={32} className="mx-auto mb-3" style={{ color: "#D0D9E8" }} />
                  <p className="text-sm font-bold" style={{ color: "#91929E" }}>Hujjatlar topilmadi</p>
                </td></tr>
              ) : filtered.map((d, i) => {
                const dl  = daysLeft(d.ijro_muddati);
                const cfg = DOC_HOLATI[d.holati];
                return (
                  <tr key={d.id} className="hover:bg-[#FAFCFF] transition-colors"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-sm" style={{ color: "#3F8CFF" }}>
                        № {d.hujjat_raqami || `DOC-${d.id}`}
                      </p>
                      <p className="text-xs" style={{ color: "#91929E" }}>{d.hujjat_sanasi || "—"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-bold px-2 py-1 text-white"
                        style={{ background: "#3F8CFF", borderRadius: 6 }}>
                        {MANBA_LABELS[d.manba] || d.manba}
                      </span>
                    </td>
                    <td className="px-4 py-4" style={{ maxWidth: 200 }}>
                      <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>
                        {d.sarlavha || d.mazmun?.slice(0, 50) || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold" style={{ color: "#0A1629" }}>
                        {d.masul_bolim_boshliqlari_nomi || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {dl ? (
                        <p className="text-xs font-bold" style={{ color: dl.color }}>{dl.text}</p>
                      ) : (
                        <p className="text-xs" style={{ color: "#91929E" }}>—</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Chip label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    </td>
                    <td className="px-4 py-4">
                      <BolimlarCell info={d.masul_bolimlar_info} fallback={d.masul_bolimlar_nomi} />
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => setTrackId(d.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-all hover:opacity-80"
                        style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 8 }}>
                        <History size={12} /> Ko'rish
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
          <p className="text-xs" style={{ color: "#91929E" }}>Jami {filtered.length} ta hujjat ko'rsatilmoqda</p>
        </div>
      </div>

      {trackId && (
        <TrackingModal docId={trackId} onClose={() => setTrackId(null)} />
      )}
      {showHisobot && (
        <HisobotModal docs={docs} onClose={() => setShowHisobot(false)} />
      )}
    </div>
  );
}

// ─── Bolim badge (fetches tracking lazily) ────────────────────────────────────

function BolimBadge({ docId }: { docId: number }) {
  const [bolimlar, setBolimlar] = useState<DocBolimRow[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [hovered,  setHovered]  = useState(false);

  useEffect(() => {
    if (!hovered || bolimlar !== null) return;
    setLoading(true);
    apiFetch<{ doc: IjroDocOut; bolimlar: DocBolimRow[] }>(`/ijro-docs/${docId}/tracking`)
      .then(t => setBolimlar(t.bolimlar))
      .catch(() => setBolimlar([]))
      .finally(() => setLoading(false));
  }, [hovered, docId, bolimlar]);

  const qabul = bolimlar?.filter(b => b.holati === "qabul_qilindi").length ?? 0;
  const total  = bolimlar?.length ?? 0;
  const rad    = bolimlar?.filter(b => b.holati === "rad_etildi").length ?? 0;

  return (
    <div className="relative inline-block" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center gap-1 cursor-default">
        <Building2 size={12} style={{ color: "#7D8592" }} />
        {loading ? (
          <Loader2 size={10} className="animate-spin" style={{ color: "#3F8CFF" }} />
        ) : bolimlar === null ? (
          <span className="text-xs" style={{ color: "#91929E" }}>—</span>
        ) : (
          <span className="text-xs font-bold"
            style={{ color: rad > 0 ? "#FF5C5C" : qabul === total && total > 0 ? "#00C48C" : "#3F8CFF" }}>
            {qabul}/{total}
          </span>
        )}
      </div>
      {hovered && bolimlar && bolimlar.length > 0 && (
        <div className="absolute left-0 top-6 z-30 min-w-[200px] p-3"
          style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 24px rgba(10,22,41,0.15)", border: "1px solid #F4F9FD" }}>
          {bolimlar.map(b => {
            const cfg = BOLIM_HOLATI[b.holati];
            return (
              <div key={b.id} className="flex items-center gap-2 py-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-xs font-bold truncate" style={{ color: "#0A1629" }}>
                  {b.bolim_nomi || `#${b.bolim_id}`}
                </span>
                <span className="text-xs ml-auto" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
