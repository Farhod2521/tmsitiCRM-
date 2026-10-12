"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import { fmtLate, CORR_STATUS } from "@/components/attendance/CheckInCorrectionModal";
import { ChevronLeft, ChevronRight, Loader2, ArrowRight, Search, Inbox } from "lucide-react";

interface LogRow {
  id: number;
  employee_id: number;
  full_name: string;
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
  status: "kutilmoqda" | "tasdiqlandi" | "rad_etildi";
  reviewed_by: string | null;
  reviewed_at: string | null;
}
type RoleTab = "barchasi" | "kadr" | "zamdirektor" | "superadmin";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const ROLE: Record<string, { label: string; color: string; bg: string }> = {
  kadr:        { label: "Kadr",        color: "#4B3FBF", bg: "rgba(109,93,211,0.12)" },
  zamdirektor: { label: "Zamdirektor", color: "#0B7285", bg: "rgba(21,192,230,0.14)" },
  superadmin:  { label: "Superadmin",  color: "#3D4557", bg: "#EEF1F6" },
};
const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" };
const PAGE = 20;

function ddmm(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Superadmin: barcha kelish vaqti tuzatishlari jurnali — kadr, zamdirektor va superadmin kiritganlari. */
export default function CorrectionLogPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleTab>("barchasi");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const month = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
    let alive = true;
    apiFetch<LogRow[]>(`/attendance/daily/corrections?month=${month}`)
      .then(r => { if (alive) { setRows(r); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ym]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r =>
      (role === "barchasi" || r.corrected_by_role === role) &&
      (!s || [r.full_name, r.department, r.reason, r.corrected_by].filter(Boolean).join(" ").toLowerCase().includes(s)));
  }, [rows, role, q]);
  useEffect(() => { setPage(0); }, [role, q, ym]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE);
  const shift = (d: number) => { setLoading(true); setYm(p => { const t = new Date(p.y, p.m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; }); };
  const count = (k: RoleTab) => k === "barchasi" ? rows.length : rows.filter(r => r.corrected_by_role === k).length;

  return (
    <div>
      <Header title="Davomat loglari" subtitle="Kelish vaqtini kim, qachon, nimadan nimaga va nima sababdan o'zgartirgani" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 p-1" style={{ ...CARD, borderRadius: 14 }}>
          <button onClick={() => shift(-1)} aria-label="Oldingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronLeft size={17} /></button>
          <span className="px-3 text-sm font-bold min-w-[120px] text-center" style={{ color: "#0A1629" }}>{MONTHS[ym.m]} {ym.y}</span>
          <button onClick={() => shift(1)} aria-label="Keyingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronRight size={17} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {([["barchasi", "Barchasi"], ["kadr", "Kadr"], ["zamdirektor", "Zamdirektor"], ["superadmin", "Superadmin"]] as [RoleTab, string][]).map(([k, l]) => {
            const on = role === k;
            return (
              <button key={k} onClick={() => setRole(k)} className="px-4 py-2.5 text-sm font-bold"
                style={{ background: on ? "#0A1629" : "#FFFFFF", color: on ? "#FFFFFF" : "#3D4557", borderRadius: 12, boxShadow: "0 4px 16px rgba(196,203,214,0.15)" }}>
                {l}
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md" style={{ background: on ? "rgba(255,255,255,0.2)" : "#F4F9FD" }}>{count(k)}</span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 px-3.5 py-2.5" style={{ ...CARD, borderRadius: 12 }}>
          <Search size={15} style={{ color: "#91929E" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Xodim, bo'lim, sabab, kim..." className="outline-none text-sm bg-transparent w-48" />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: "#E5484D" }}>{error}</p>
      ) : !shown.length ? (
        <div className="flex flex-col items-center gap-2 py-16" style={CARD}>
          <Inbox size={34} style={{ color: "#D0D9E8" }} />
          <p className="text-sm font-bold" style={{ color: "#91929E" }}>Bu oyda log yo&apos;q</p>
        </div>
      ) : (
        <div style={CARD} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 980 }}>
              <thead>
                <tr style={{ background: "#F4F9FD", color: "#7D8592" }} className="text-left text-xs">
                  <th className="px-4 py-3 font-semibold">Qachon</th>
                  <th className="px-4 py-3 font-semibold">Xodim</th>
                  <th className="px-4 py-3 font-semibold">Kun</th>
                  <th className="px-4 py-3 font-semibold">Vaqt</th>
                  <th className="px-4 py-3 font-semibold">Kim o&apos;zgartirdi</th>
                  <th className="px-4 py-3 font-semibold">Sabab</th>
                  <th className="px-4 py-3 font-semibold">Holat</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(r => {
                  const rl = ROLE[r.corrected_by_role ?? ""];
                  const st = CORR_STATUS[r.status];
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #F1F3F7" }} className="align-top">
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#7D8592" }}>{fmtDateTimeUz(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold" style={{ color: "#0A1629" }}>{r.full_name}</p>
                        {r.department && <p className="text-xs" style={{ color: "#91929E" }}>{r.department}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: "#3D4557" }}>{ddmm(r.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-bold">
                          <span style={{ color: r.old_check_in ? "#E5484D" : "#A8B0BD" }}>{r.old_check_in ?? "—"}</span>
                          <ArrowRight size={13} style={{ color: "#91929E" }} />
                          <span style={{ color: "#00A578" }}>{r.new_check_in}</span>
                        </span>
                        <p className="text-[11px]" style={{ color: "#91929E" }}>{fmtLate(r.late_after)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold" style={{ color: "#0A1629" }}>{r.corrected_by ?? "—"}</p>
                        {rl && <span className="inline-block mt-0.5 px-2 py-0.5 text-[11px] font-bold" style={{ background: rl.bg, color: rl.color, borderRadius: 6 }}>{rl.label}</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]" style={{ color: "#3D4557" }}>
                        {r.reason || <span style={{ color: "#A8B0BD" }}>—</span>}
                        {r.note_text && <p className="text-xs mt-1 italic" style={{ color: "#91929E" }}>Xodim: {r.note_text}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color, borderRadius: 6 }}>{st.label}</span>
                        {r.reviewed_by && r.status !== "kutilmoqda" && r.corrected_by_role === "kadr" && (
                          <p className="text-[11px] mt-1" style={{ color: "#91929E" }}>{r.reviewed_by}{r.reviewed_at ? ` · ${fmtDateTimeUz(r.reviewed_at)}` : ""}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid #F1F3F7" }}>
              <span className="text-xs" style={{ color: "#91929E" }}>{shown.length} ta yozuv</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD] disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold px-2" style={{ color: "#0A1629" }}>{page + 1} / {pages}</span>
                <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD] disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
