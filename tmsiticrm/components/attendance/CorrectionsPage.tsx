"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import { fmtLate, CORR_STATUS } from "@/components/attendance/CheckInCorrectionModal";
import {
  ChevronLeft, ChevronRight, Loader2, ArrowRight, MessageSquareText, PenLine, Search, Clock3, DoorOpen, UserCheck, Inbox,
  CheckCircle2, XCircle,
} from "lucide-react";

interface CorrectionRow {
  id: number;
  employee_id: number;
  full_name: string;
  position: string | null;
  department: string | null;
  date: string;
  old_check_in: string | null;
  new_check_in: string;
  late_before: number | null;
  late_after: number | null;
  reason: string | null;
  note_text: string | null;
  source: "turniket" | "qolda";
  corrected_by: string | null;
  corrected_by_role: string | null;
  created_at: string;
  new: boolean;
  status: "kutilmoqda" | "tasdiqlandi" | "rad_etildi";
  reviewed_by: string | null;
  reviewed_at: string | null;
}
type Tab = "kutilmoqda" | "tasdiqlandi" | "rad_etildi" | "barchasi";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const ROLE = { kadr: "Kadrlar bo'limi", superadmin: "Administrator" } as Record<string, string>;
const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" };

function initials(n: string) { return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2); }
function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} · ${WD[d.getDay()]}`;
}

function TimeBox({ time, late, label, accent }: { time: string | null; late: number | null; label: string; accent: string }) {
  const lateTxt = time ? fmtLate(late) : "belgilanmagan";
  const bad = (late ?? 0) > 0;
  return (
    <div className="px-4 py-2.5 min-w-[130px]" style={{ background: `${accent}0F`, border: `1px solid ${accent}33`, borderRadius: 14 }}>
      <p className="text-[11px] font-semibold" style={{ color: "#7D8592" }}>{label}</p>
      <p className="text-2xl font-bold leading-tight" style={{ color: time ? "#0A1629" : "#C4CBD6" }}>{time ?? "—"}</p>
      <p className="text-[11.5px] font-bold" style={{ color: !time ? "#A8B0BD" : bad ? "#E5484D" : "#00A578" }}>{lateTxt}</p>
    </div>
  );
}

/** Zamdirektor/direktor: kadr (yoki superadmin) to'g'rilagan kelish vaqtlari jurnali. */
export default function CorrectionsPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [tab, setTab] = useState<Tab>("kutilmoqda");
  const [busy, setBusy] = useState<number | null>(null);

  async function decide(r: CorrectionRow, approve: boolean) {
    if (!approve && !confirm(`${r.full_name} — ${r.old_check_in ?? "—"} → ${r.new_check_in} tuzatishini bekor qilasizmi? Vaqt o'zgarmaydi.`)) return;
    setBusy(r.id);
    try {
      const upd = await apiFetch<CorrectionRow>(`/attendance/daily/corrections/${r.id}/review`, { method: "POST", body: JSON.stringify({ approve }) });
      setRows(rs => rs.map(x => x.id === r.id ? { ...upd, new: false } : x));
    } catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    const month = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
    let alive = true;
    apiFetch<CorrectionRow[]>(`/attendance/daily/corrections?month=${month}`)
      .then(r => {
        if (!alive) return;
        setRows(r); setError(null);
        // Ko'rildi — qo'ng'iroqchadagi son nolga tushadi ("Yangi" belgisi shu sahifada qoladi)
        apiFetch("/attendance/daily/corrections/seen", { method: "POST" }).catch(() => {});
      })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ym]);

  const shown = useMemo(() => rows.filter(r =>
    (tab === "barchasi" || r.status === tab) &&
    (!onlyNew || r.new) && (!q.trim() || [r.full_name, r.department, r.reason, r.corrected_by].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase()))),
  [rows, onlyNew, q, tab]);
  const stats = {
    jami: rows.length,
    yangi: rows.filter(r => r.new).length,
    olib: rows.filter(r => (r.late_before ?? 0) > 0 && (r.late_after ?? 0) === 0).length,
    xodim: new Set(rows.map(r => r.employee_id)).size,
  };
  const shift = (d: number) => { setLoading(true); setYm(p => { const t = new Date(p.y, p.m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; }); };

  return (
    <div>
      <Header title="Davomat tuzatishlari" subtitle="Kadr to'g'rilagan kelish vaqtlari — tasdiqlaganingizdan keyingina kuchga kiradi" />

      {/* Yuqori panel */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 p-1" style={{ ...CARD, borderRadius: 14 }}>
          <button onClick={() => shift(-1)} aria-label="Oldingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronLeft size={17} /></button>
          <span className="px-3 text-sm font-bold min-w-[120px] text-center" style={{ color: "#0A1629" }}>{MONTHS[ym.m]} {ym.y}</span>
          <button onClick={() => shift(1)} aria-label="Keyingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronRight size={17} /></button>
        </div>
        {[
          { label: "Jami tuzatish", v: stats.jami, c: "#3F8CFF" },
          { label: "Tasdiq kutilmoqda", v: rows.filter(r => r.status === "kutilmoqda").length, c: "#B4780C" },
          { label: "Kechikish olib tashlangan", v: stats.olib, c: "#E5484D" },
          { label: "Xodimlar", v: stats.xodim, c: "#00A578" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-4 py-2.5" style={{ ...CARD, borderRadius: 14 }}>
            <span className="text-lg font-bold" style={{ color: s.c }}>{s.v}</span>
            <span className="text-xs font-semibold" style={{ color: "#7D8592" }}>{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setOnlyNew(v => !v)} className="px-3.5 py-2.5 text-sm font-bold"
            style={{ ...CARD, borderRadius: 12, background: onlyNew ? "#6D5DD3" : "#FFFFFF", color: onlyNew ? "#FFFFFF" : "#3D4557" }}>
            Faqat yangilar
          </button>
          <label className="flex items-center gap-2 px-3.5 py-2.5" style={{ ...CARD, borderRadius: 12 }}>
            <Search size={15} style={{ color: "#91929E" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Xodim, bo'lim, sabab..." className="outline-none text-sm bg-transparent w-44" />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {([["kutilmoqda", "Tasdiq kutilmoqda"], ["tasdiqlandi", "Tasdiqlangan"], ["rad_etildi", "Bekor qilingan"], ["barchasi", "Barchasi"]] as [Tab, string][]).map(([k, l]) => {
          const n = k === "barchasi" ? rows.length : rows.filter(r => r.status === k).length;
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-sm font-bold"
              style={{ background: on ? "#0A1629" : "#FFFFFF", color: on ? "#FFFFFF" : "#3D4557", borderRadius: 12, boxShadow: "0 4px 16px rgba(196,203,214,0.15)" }}>
              {l}
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md" style={{ background: on ? "rgba(255,255,255,0.2)" : "#F4F9FD" }}>{n}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: "#E5484D" }}>{error}</p>
      ) : !shown.length ? (
        <div className="flex flex-col items-center gap-2 py-16" style={CARD}>
          <Inbox size={34} style={{ color: "#D0D9E8" }} />
          <p className="text-sm font-bold" style={{ color: "#91929E" }}>{tab === "kutilmoqda" ? "Tasdig'ingizni kutayotgan tuzatish yo'q" : "Bu oyda tuzatish yo'q"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map(r => (
            <div key={r.id} className="p-4 sm:p-5" style={{ ...CARD, border: r.status === "kutilmoqda" ? "1.5px solid #FCE3A8" : r.new ? "1.5px solid #CFC8F5" : "1.5px solid transparent" }}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Xodim */}
                <div className="flex items-center gap-3 lg:w-[260px] flex-shrink-0 min-w-0">
                  <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: "rgba(109,93,211,0.12)", color: "#4B3FBF" }}>{initials(r.full_name)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <b className="text-[15px] truncate" style={{ color: "#0A1629" }}>{r.full_name}</b>
                      {r.new && <span className="px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "#6D5DD3", borderRadius: 6 }}>YANGI</span>}
                    </span>
                    <span className="block text-xs truncate" style={{ color: "#91929E" }}>{[r.position, r.department].filter(Boolean).join(" · ")}</span>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: "#F4F9FD", color: "#3D4557", borderRadius: 6 }}>{dayLabel(r.date)}</span>
                  </span>
                </div>

                {/* Vaqt o'zgarishi */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TimeBox time={r.old_check_in} late={r.late_before} label="Tizimda edi" accent="#E5484D" />
                  <ArrowRight size={20} style={{ color: "#91929E" }} />
                  <TimeBox time={r.new_check_in} late={r.late_after} label="To'g'rilandi" accent="#00A578" />
                </div>

                {/* Izoh va sabab */}
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-3" style={{ background: r.note_text ? "#FFF8E8" : "#FAFCFF", borderRadius: 12 }}>
                    <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: r.note_text ? "#B4780C" : "#A8B0BD" }}><MessageSquareText size={12} /> Xodim izohi</p>
                    <p className="text-[13px] mt-0.5 line-clamp-3" style={{ color: r.note_text ? "#3D4557" : "#A8B0BD" }} title={r.note_text ?? ""}>{r.note_text ?? "Izoh yozmagan"}</p>
                  </div>
                  <div className="p-3" style={{ background: "#F3F1FD", borderRadius: 12 }}>
                    <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#6D5DD3" }}><PenLine size={12} /> To&apos;g&apos;rilash sababi</p>
                    <p className="text-[13px] mt-0.5 line-clamp-3" style={{ color: "#3D4557" }} title={r.reason ?? ""}>{r.reason ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 text-xs" style={{ borderTop: "1px solid #F4F9FD", color: "#7D8592" }}>
                <span className="flex items-center gap-1.5"><UserCheck size={13} /> To&apos;g&apos;riladi: <b style={{ color: "#0A1629" }}>{r.corrected_by ?? "—"}</b>{r.corrected_by_role && ROLE[r.corrected_by_role] ? ` (${ROLE[r.corrected_by_role]})` : ""}</span>
                <span className="flex items-center gap-1.5"><Clock3 size={13} /> {fmtDateTimeUz(r.created_at)}</span>
                {r.source === "turniket" && <span className="flex items-center gap-1.5"><DoorOpen size={13} /> Turniket ma&apos;lumoti bo&apos;yicha</span>}
                <span className="px-2 py-0.5 text-[11px] font-bold" style={{ background: CORR_STATUS[r.status].bg, color: CORR_STATUS[r.status].color, borderRadius: 6 }}>
                  {CORR_STATUS[r.status].label}{r.reviewed_by && r.status !== "kutilmoqda" ? ` · ${r.reviewed_by}${r.reviewed_at ? `, ${fmtDateTimeUz(r.reviewed_at)}` : ""}` : ""}
                </span>
                {r.status === "kutilmoqda" && (
                  <span className="ml-auto flex items-center gap-2">
                    <button onClick={() => decide(r, true)} disabled={busy === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50 hover:opacity-90"
                      style={{ background: "#00C48C", borderRadius: 10 }}>
                      {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Tasdiqlash
                    </button>
                    <button onClick={() => decide(r, false)} disabled={busy === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold disabled:opacity-50 hover:bg-[#FFF5F5]"
                      style={{ border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 10, background: "#FFFFFF" }}>
                      <XCircle size={14} /> Bekor qilish
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
