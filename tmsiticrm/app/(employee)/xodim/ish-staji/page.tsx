"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2, FileSpreadsheet, FileText, BriefcaseBusiness } from "lucide-react";

interface Row {
  id: number;
  order_num: number | null;
  employee_id: number | null;
  full_name: string;
  position: string | null;
  years: number;
  months: number;
  percent: number;
  base_percent: number;
  full_month_mt: boolean;
}
interface Data {
  year: number;
  month: number;
  base_year: number | null;
  base_month: number | null;
  rows: Row[];
}

const MON = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MON_CAP = MON.map(m => m[0].toUpperCase() + m.slice(1));

// Hujjat ko'rinishi (Word/Excel'dagi kabi)
const PAPER_FONT = '"Times New Roman", Times, serif';
const CELL = "border border-black px-1.5 py-1";

export default function IshStajiPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"xlsx" | "docx" | null>(null);

  // Stajni tuzatish: yil/oy katagiga ikki marta bosiladi
  const [editId, setEditId] = useState<number | null>(null);
  const [editYears, setEditYears] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      setData(await apiFetch<Data>(`/ish-staji?year=${y}&month=${m}`));
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, [year, month, load]);

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y); setEditId(null);
  }

  async function download(kind: "xlsx" | "docx") {
    setDownloading(kind);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const res = await fetch(`${API_URL}/ish-staji/${kind}?year=${year}&month=${month}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `ish_staji_${year}_${String(month).padStart(2, "0")}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setDownloading(null);
    }
  }

  function startEdit(r: Row) {
    setEditId(r.id); setEditYears(String(r.years)); setEditMonths(String(r.months));
  }

  async function saveEdit(r: Row) {
    const y = Number(editYears), m = Number(editMonths);
    if (y === r.years && m === r.months) { setEditId(null); return; }
    if (!Number.isInteger(y) || y < 0 || !Number.isInteger(m) || m < 0 || m > 11) {
      alert("Yil 0 dan katta, oy 0–11 oralig'ida bo'lishi kerak");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await apiFetch<Row>(`/ish-staji/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ year, month, years: y, months: m }),
      });
      setData(d => d ? { ...d, rows: d.rows.map(x => x.id === r.id ? updated : x) } : d);
      setEditId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSavingEdit(false);
    }
  }

  function editKeys(e: React.KeyboardEvent, r: Row) {
    if (e.key === "Enter") saveEdit(r);
    if (e.key === "Escape") setEditId(null);
  }

  const rows = data?.rows ?? [];
  const inputCls = "w-10 text-center outline-none bg-[#EEF4FF] rounded-sm";

  return (
    <div>
      <Header title="Ish staji" subtitle="Xodimlarning ish staji va ustama foizlari — har oy avtomatik yangilanadi" />

      {/* Asboblar paneli */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-1 p-1" style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
          </button>
          <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 120, textAlign: "center" }}>
            {MON_CAP[month - 1]} {year}
          </span>
          <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => download("xlsx")} disabled={!rows.length || !!downloading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
            style={{ background: "#00C48C", borderRadius: 12 }}>
            {downloading === "xlsx" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
          </button>
          <button onClick={() => download("docx")} disabled={!rows.length || !!downloading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
            style={{ background: "#3F8CFF", borderRadius: 12 }}>
            {downloading === "docx" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Word
          </button>
        </div>
      </div>

      {/* Hujjat (qog'oz) */}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto bg-white" style={{
          maxWidth: 820, minWidth: 640, padding: "40px 48px 48px", fontFamily: PAPER_FONT, color: "#000",
          boxShadow: "0 8px 40px rgba(10,22,41,0.10)", borderRadius: 4,
        }}>
          {loading ? (
            <div className="flex justify-center py-24"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
          ) : rows.length === 0 ? (
            <div className="py-24 text-center" style={{ fontFamily: "inherit" }}>
              <BriefcaseBusiness size={34} className="mx-auto" style={{ color: "#D9E3F0" }} />
              <p className="mt-3" style={{ color: "#91929E" }}>Ish staji ma&apos;lumotlari yo&apos;q</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <div className="text-center leading-snug" style={{ width: 280, fontSize: 15 }}>
                  <p className="font-bold">Buxgalteriya va moliya bo&apos;limiga</p>
                  <p>Inson resurslarini rivojlantirish bo&apos;limidan</p>
                </div>
              </div>

              <p className="text-center font-bold mt-8 leading-snug" style={{ fontSize: 16 }}>
                Texnik me’yorlash va standartlashtirish ilmiy-tadqiqot instituti<br />
                {`xodimlarining ${MON[month - 1]} oy uchun ish stajlari to'grisida`}
              </p>
              <p className="text-center font-bold mt-2 mb-4" style={{ fontSize: 16 }}>MA&apos;LUMOT</p>

              <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr className="font-bold">
                    <th rowSpan={2} className={CELL} style={{ width: 40 }}>Tr</th>
                    <th rowSpan={2} className={CELL}>FISh</th>
                    <th rowSpan={2} className={CELL}>Lavozimi</th>
                    <th colSpan={2} className={CELL}>Ish staji</th>
                    <th rowSpan={2} className={CELL} style={{ width: 70 }}>Foiz</th>
                  </tr>
                  <tr className="font-bold">
                    <th className={CELL} style={{ width: 58 }}>yil</th>
                    <th className={CELL} style={{ width: 58 }}>oy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const editing = editId === r.id;
                    return (
                      <tr key={r.id} className="hover:bg-[#F8FAFF]">
                        <td className={`${CELL} text-center`}>{r.order_num ?? i + 1}</td>
                        <td className={CELL}>{r.full_name}</td>
                        <td className={`${CELL} text-center`}>{r.position || ""}</td>
                        {editing ? (
                          <>
                            <td className={`${CELL} text-center`}>
                              <input value={editYears} onChange={e => setEditYears(e.target.value)} onKeyDown={e => editKeys(e, r)}
                                inputMode="numeric" autoFocus className={inputCls} disabled={savingEdit} />
                            </td>
                            <td className={`${CELL} text-center`}>
                              <input value={editMonths} onChange={e => setEditMonths(e.target.value)} onKeyDown={e => editKeys(e, r)}
                                onBlur={() => saveEdit(r)} inputMode="numeric" className={inputCls} disabled={savingEdit} />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={`${CELL} text-center cursor-text`} onDoubleClick={() => startEdit(r)} title="Tuzatish uchun ikki marta bosing">{r.years}</td>
                            <td className={`${CELL} text-center cursor-text`} onDoubleClick={() => startEdit(r)} title="Tuzatish uchun ikki marta bosing">{r.months}</td>
                          </>
                        )}
                        <td className={`${CELL} text-center`}
                          title={r.full_month_mt ? `Butun oy mehnat ta'tilida (stajga ko'ra ${r.base_percent}%)` : undefined}>
                          {r.percent}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
