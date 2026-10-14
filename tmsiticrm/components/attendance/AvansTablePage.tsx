"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2, FileDown, Search, Inbox, Building2, Crown } from "lucide-react";

interface AvansRow {
  employee_id: number;
  full_name: string;
  position: string;
  shtat: string;
  is_head: boolean;
  cells: Record<string, string>;
  locked: number[];
  ik: number;
  ikm: number;
}
interface AvansDept { id: number; name: string; head: string | null; rows: AvansRow[] }
interface AvansOut { year: number; month: number; day_from: number; day_to: number; legend: [string, string][]; departments: AvansDept[] }

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" };
export const CODE_STYLE: Record<string, { bg: string; color: string }> = {
  "8":   { bg: "#FFFFFF", color: "#17365D" },
  "4":   { bg: "#F0F9FF", color: "#0369A1" },
  "X":   { bg: "#E9EAEC", color: "#666666" },
  "Б":   { bg: "#FEFCE8", color: "#854D0E" },
  "К":   { bg: "#FEF2F2", color: "#991B1B" },
  "У/Т": { bg: "#EFF6FF", color: "#1D4ED8" },
  "М/Т": { bg: "#FAF5FF", color: "#6D28D9" },
  "Х/С": { bg: "#ECFDF5", color: "#047857" },
  "Б/С": { bg: "#FFF7ED", color: "#C2410C" },
  "Д":   { bg: "#FDF2F8", color: "#BE185D" },
};

async function downloadDocx(year: number, month: number, departmentId?: number) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = localStorage.getItem("crm_token");
  const q = `year=${year}&month=${month}&day_from=1&day_to=15${departmentId ? `&department_id=${departmentId}` : ""}`;
  const res = await fetch(`${API_URL}/tabel/avans-docx?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `Avans_tabel_${MONTHS[month - 1]}_${year}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** Kadr: avans (1–15 kun) tabeli — bo'limma-bo'lim, davomatdan avtomatik. */
export default function AvansTablePage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState<AvansOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | "all" | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<AvansOut>(`/tabel/avans?year=${ym.y}&month=${ym.m}&day_from=1&day_to=15`)
      .then(r => { if (alive) { setData(r); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ym]);

  const shift = (d: number) => {
    setLoading(true);
    setYm(p => { const t = new Date(p.y, p.m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; });
  };
  const days = data ? Array.from({ length: data.day_to - data.day_from + 1 }, (_, i) => data.day_from + i) : [];
  const depts = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!data) return [];
    if (!s) return data.departments;
    return data.departments
      .map(d => d.name.toLowerCase().includes(s) ? d : { ...d, rows: d.rows.filter(r => r.full_name.toLowerCase().includes(s)) })
      .filter(d => d.rows.length);
  }, [data, q]);

  async function dl(id?: number) {
    setBusy(id ?? "all");
    try { await downloadDocx(ym.y, ym.m, id); }
    catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <Header title="Avans table" subtitle="Yarim oylik (1–15 kun) davomat — bo'limlar kesimida, keldi-ketdi va holatlardan avtomatik" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 p-1" style={{ ...CARD, borderRadius: 14 }}>
          <button onClick={() => shift(-1)} aria-label="Oldingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronLeft size={17} /></button>
          <span className="px-3 text-sm font-bold min-w-[130px] text-center" style={{ color: "#0A1629" }}>{MONTHS[ym.m - 1]} {ym.y} · 1–15</span>
          <button onClick={() => shift(1)} aria-label="Keyingi oy" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronRight size={17} /></button>
        </div>
        <label className="flex items-center gap-2 px-3.5 py-2.5" style={{ ...CARD, borderRadius: 12 }}>
          <Search size={15} style={{ color: "#91929E" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Bo'lim yoki xodim..." className="outline-none text-sm bg-transparent w-48" />
        </label>
        <button onClick={() => dl()} disabled={busy !== null || !data?.departments.length}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
          style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 6px 12px rgba(63,140,255,0.26)" }}>
          {busy === "all" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Word yuklab olish
        </button>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.legend.map(([code, label]) => {
            const s = CODE_STYLE[code] ?? CODE_STYLE["8"];
            return (
              <span key={code} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold" style={{ background: "#FFFFFF", borderRadius: 8, color: "#3D4557", border: "1px solid #EEF1F6" }}>
                <b className="px-1.5 rounded" style={{ background: s.bg, color: s.color, border: "1px solid #E4E7EE" }}>{code}</b>{label}
              </span>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: "#E5484D" }}>{error}</p>
      ) : !depts.length ? (
        <div className="flex flex-col items-center gap-2 py-16" style={CARD}>
          <Inbox size={34} style={{ color: "#D0D9E8" }} />
          <p className="text-sm font-bold" style={{ color: "#91929E" }}>Ma&apos;lumot topilmadi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {depts.map(dep => (
            <section key={dep.id} style={CARD} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #F1F3F7" }}>
                <span className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF" }}><Building2 size={18} /></span>
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: "#0A1629" }}>{dep.name}</p>
                  <p className="text-xs" style={{ color: "#91929E" }}>{dep.rows.length} xodim{dep.head ? ` · Bo'lim boshlig'i: ${dep.head}` : ""}</p>
                </div>
                <button onClick={() => dl(dep.id)} disabled={busy !== null}
                  className="ml-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold disabled:opacity-50 hover:bg-[#F4F9FD]"
                  style={{ border: "1.5px solid #D6E4FF", color: "#3F8CFF", borderRadius: 10 }}>
                  {busy === dep.id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Word
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 920, borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="text-xs" style={{ background: "#245A8D", color: "#FFFFFF" }}>
                      <th className="px-2 py-2.5 w-10">№</th>
                      <th className="px-3 py-2.5 text-left">F.I.Sh.</th>
                      <th className="px-3 py-2.5 text-left">Lavozim</th>
                      <th className="px-2 py-2.5">Shtat</th>
                      {days.map(d => <th key={d} className="py-2.5 w-9 font-bold" style={{ background: "#EAF2F8", color: "#17365D", border: "1px solid #C7D6E5" }}>{d}</th>)}
                      <th className="px-2 py-2.5">I.K.</th>
                      <th className="px-2 py-2.5">I.Km.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dep.rows.map((r, i) => (
                      <tr key={r.employee_id} style={{ borderTop: "1px solid #EEF1F6" }}>
                        <td className="px-2 py-2 text-center font-bold" style={{ color: "#17365D" }}>{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#17365D", fontWeight: r.is_head ? 700 : 500 }}>
                          <span className="inline-flex items-center gap-1.5">{r.is_head && <Crown size={13} style={{ color: "#F5A623" }} />}{r.full_name}</span>
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#526276" }}>{r.position}</td>
                        <td className="px-2 py-2 text-center text-xs" style={{ color: "#526276" }}>{r.shtat}</td>
                        {days.map(d => {
                          const c = r.cells[String(d)] ?? "";
                          const s = CODE_STYLE[c];
                          return (
                            <td key={d} className="text-center text-xs font-semibold py-2" title={c ? undefined : "Belgilanmagan (kelmagan)"}
                              style={{ background: s?.bg ?? "#FFFFFF", color: s?.color ?? "#C5C6CF", border: "1px solid #E4EAF2" }}>{c || "·"}</td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold" style={{ color: "#17365D" }}>{r.ik || ""}</td>
                        <td className="px-2 py-2 text-center font-bold" style={{ color: "#C0392B" }}>{r.ikm || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
