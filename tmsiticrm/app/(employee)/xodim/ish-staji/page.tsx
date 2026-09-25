"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Loader2, Upload, FileSpreadsheet, FileText, Pencil, Check, X,
  BriefcaseBusiness, AlertTriangle, Palmtree,
} from "lucide-react";

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
interface ImportResult {
  imported: number;
  matched: number;
  unmatched: string[];
  base_year: number;
  base_month: number;
}

const MON = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MON_CAP = MON.map(m => m[0].toUpperCase() + m.slice(1));

// Staj bo'yicha ustama foizlari (lavozim maoshiga nisbatan)
const BRACKETS: { label: string; pct: number }[] = [
  { label: "1 yilgacha", pct: 0 },
  { label: "1–3 yil", pct: 25 },
  { label: "3–5 yil", pct: 50 },
  { label: "5–10 yil", pct: 75 },
  { label: "10–15 yil", pct: 100 },
  { label: "15–20 yil", pct: 125 },
  { label: "20 yildan ortiq", pct: 150 },
];

function pctColor(p: number): { color: string; bg: string } {
  if (p === 0) return { color: "#91929E", bg: "#F4F9FD" };
  if (p <= 50) return { color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" };
  if (p <= 100) return { color: "#00A578", bg: "rgba(0,196,140,0.1)" };
  return { color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" };
}

const CARD = { background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 };

export default function IshStajiPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const [importMonth, setImportMonth] = useState<number | "">("");   // "" — sarlavhadan avtomatik
  const [importYear, setImportYear] = useState(now.getFullYear());
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editYears, setEditYears] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloading, setDownloading] = useState<"xlsx" | "docx" | null>(null);

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
    setMonth(m); setYear(y);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true); setImportError(null); setImportResult(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("year", String(importYear));
      if (importMonth) fd.append("month", String(importMonth));
      const res = await fetch(`${API_URL}/ish-staji/import`, {
        method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Yuklab bo'lmadi");
      setImportResult(body as ImportResult);
      await load(year, month);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setUploading(false);
    }
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

  const rows = data?.rows ?? [];
  const beforeBase = data?.base_year != null && data.base_month != null
    && year * 12 + month < data.base_year * 12 + data.base_month;
  const mtCount = rows.filter(r => r.full_month_mt).length;

  return (
    <div>
      <Header title="Ish staji" subtitle="Xodimlarning ish staji va ustama foizlari — har oy avtomatik yangilanadi" />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        <div style={CARD}>
          {/* Asboblar paneli */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
            <div>
              <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>{MON_CAP[month - 1]} {year} oyi uchun ish stajlari</h3>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                {data?.base_month
                  ? `Asos: ${MON[data.base_month - 1]} ${data.base_year} holatidagi jadval · staj har oyga +1 oy`
                  : "Hali jadval yuklanmagan"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => download("xlsx")} disabled={!rows.length || !!downloading}
                className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
                style={{ background: "#00C48C", borderRadius: 12 }}>
                {downloading === "xlsx" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
              </button>
              <button onClick={() => download("docx")} disabled={!rows.length || !!downloading}
                className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
                style={{ background: "#3F8CFF", borderRadius: 12 }}>
                {downloading === "docx" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Word
              </button>
              <div className="flex items-center gap-1 p-1" style={{ background: "#F4F9FD", borderRadius: 12 }}>
                <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                  <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
                </button>
                <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 110, textAlign: "center" }}>
                  {MON_CAP[month - 1]} {year}
                </span>
                <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                  <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
                </button>
              </div>
            </div>
          </div>

          {beforeBase && (
            <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,189,33,0.12)", color: "#B4780C", borderRadius: 10 }}>
              <AlertTriangle size={14} /> Bu oy asos oydan oldin — staj asos oydan orqaga hisoblab ko&apos;rsatilmoqda.
            </div>
          )}
          {mtCount > 0 && (
            <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,189,33,0.12)", color: "#B4780C", borderRadius: 10 }}>
              <Palmtree size={14} /> {mtCount} ta xodim butun oy mehnat ta&apos;tilida — ularning bu oydagi foizi 0.
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center px-6">
              <BriefcaseBusiness size={34} className="mx-auto" style={{ color: "#D9E3F0" }} />
              <p className="font-bold mt-3" style={{ color: "#0A1629" }}>Ish staji jadvali yo&apos;q</p>
              <p className="text-sm mt-1" style={{ color: "#91929E" }}>O&apos;ngdagi &quot;Jadvalni yuklash&quot; orqali xlsx faylni yuklang</p>
            </div>
          ) : (
            <div className="overflow-x-auto p-4 sm:p-6">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                    {["Tr", "FISh", "Lavozimi", "Yil", "Oy", "Foiz", ""].map((h, i) => (
                      <th key={i} className={`pb-3 text-xs font-bold uppercase ${i >= 3 ? "text-center" : "text-left"}`}
                        style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const c = pctColor(r.percent);
                    const editing = editId === r.id;
                    return (
                      <tr key={r.id} className="hover:bg-[#FAFCFF] transition-colors" style={{ borderBottom: "1px solid #F4F9FD" }}>
                        <td className="py-3 text-sm font-bold" style={{ color: "#91929E", paddingRight: 12 }}>{r.order_num ?? i + 1}</td>
                        <td className="py-3" style={{ paddingRight: 12 }}>
                          <p className="text-sm font-bold whitespace-nowrap" style={{ color: "#0A1629" }}>{r.full_name}</p>
                          {!r.employee_id && (
                            <p className="text-[10px] font-semibold" style={{ color: "#E0A400" }} title="Mehnat ta'tili tekshiruvi bu xodim uchun ishlamaydi">
                              CRM&apos;da topilmadi
                            </p>
                          )}
                        </td>
                        <td className="py-3 text-sm" style={{ color: "#7D8592", paddingRight: 12 }}>{r.position || "—"}</td>
                        {editing ? (
                          <>
                            <td className="py-3 text-center" style={{ paddingRight: 12 }}>
                              <input value={editYears} onChange={e => setEditYears(e.target.value)} inputMode="numeric" autoFocus
                                className="w-14 px-2 py-1.5 text-sm font-bold text-center outline-none" style={{ background: "#F4F9FD", border: "1px solid #3F8CFF", borderRadius: 8 }} />
                            </td>
                            <td className="py-3 text-center" style={{ paddingRight: 12 }}>
                              <input value={editMonths} onChange={e => setEditMonths(e.target.value)} inputMode="numeric"
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(r); if (e.key === "Escape") setEditId(null); }}
                                className="w-14 px-2 py-1.5 text-sm font-bold text-center outline-none" style={{ background: "#F4F9FD", border: "1px solid #3F8CFF", borderRadius: 8 }} />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 text-sm font-bold text-center" style={{ color: "#0A1629", paddingRight: 12 }}>{r.years}</td>
                            <td className="py-3 text-sm font-bold text-center" style={{ color: "#0A1629", paddingRight: 12 }}>{r.months}</td>
                          </>
                        )}
                        <td className="py-3 text-center" style={{ paddingRight: 12 }}>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                            title={r.full_month_mt ? `Butun oy mehnat ta'tilida (stajga ko'ra ${r.base_percent}%)` : undefined}
                            style={{ color: c.color, background: c.bg, borderRadius: 8 }}>
                            {r.full_month_mt && <Palmtree size={11} />}{r.percent}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {editing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => saveEdit(r)} disabled={savingEdit} title="Saqlash"
                                className="w-8 h-8 flex items-center justify-center text-white" style={{ background: "#00C48C", borderRadius: 8 }}>
                                {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={() => setEditId(null)} title="Bekor qilish"
                                className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
                                <X size={14} style={{ color: "#7D8592" }} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(r)} title={`${MON[month - 1]} holatida stajni tuzatish`}
                              className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors">
                              <Pencil size={13} style={{ color: "#7D8592" }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs mt-4" style={{ color: "#91929E" }}>Jami {rows.length} ta xodim</p>
            </div>
          )}
        </div>

        {/* O'ng panel */}
        <div className="flex flex-col gap-6">
          <div className="p-5" style={CARD}>
            <p className="font-bold text-sm" style={{ color: "#0A1629" }}>Jadvalni yuklash (.xlsx)</p>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#91929E" }}>
              &quot;Tr, FISh, Lavozimi, Ish staji (yil, oy), Foiz&quot; ustunli jadval. Yangi fayl oldingi ma&apos;lumotni to&apos;liq almashtiradi.
            </p>
            <label className="block text-[11px] font-bold mt-3 mb-1" style={{ color: "#7D8592" }}>Jadval qaysi oy holatida?</label>
            <div className="flex gap-2">
              <select value={importMonth} onChange={e => setImportMonth(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 px-2.5 py-2 text-xs font-bold outline-none" style={{ background: "#F4F9FD", border: "1px solid #D9E3F0", borderRadius: 10, color: "#0A1629" }}>
                <option value="">Sarlavhadan (avto)</option>
                {MON_CAP.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={importYear} onChange={e => setImportYear(Number(e.target.value))}
                className="w-20 px-2.5 py-2 text-xs font-bold outline-none" style={{ background: "#F4F9FD", border: "1px solid #D9E3F0", borderRadius: 10, color: "#0A1629" }} />
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#FF8C42", borderRadius: 12, boxShadow: "0px 6px 12px rgba(255,140,66,0.3)" }}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Faylni tanlash
            </button>
            {importError && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{importError}</p>}
            {importResult && (
              <div className="mt-3 p-3 text-xs" style={{ background: "rgba(0,196,140,0.08)", borderRadius: 10, color: "#0A1629" }}>
                <p className="font-bold" style={{ color: "#00A578" }}>
                  ✓ {importResult.imported} ta xodim yuklandi ({MON[importResult.base_month - 1]} {importResult.base_year} holatida)
                </p>
                <p className="mt-1" style={{ color: "#7D8592" }}>CRM xodimlariga bog&apos;landi: {importResult.matched} ta</p>
                {importResult.unmatched.length > 0 && (
                  <p className="mt-1" style={{ color: "#B4780C" }}>
                    Topilmadi ({importResult.unmatched.length}): {importResult.unmatched.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-5" style={CARD}>
            <p className="font-bold text-sm mb-3" style={{ color: "#0A1629" }}>Ustama miqdorlari</p>
            <ul className="flex flex-col gap-1.5">
              {BRACKETS.map(b => {
                const c = pctColor(b.pct);
                return (
                  <li key={b.label} className="flex items-center justify-between text-xs">
                    <span style={{ color: "#7D8592" }}>{b.label}</span>
                    <span className="px-2 py-0.5 font-bold" style={{ color: c.color, background: c.bg, borderRadius: 6 }}>{b.pct}%</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "#A8B0BD" }}>
              Oyning barcha ish kunlari mehnat ta&apos;tili (MT) bo&apos;lsa — o&apos;sha oy uchun foiz 0. Kamida bir kun ishlagan bo&apos;lsa, foiz saqlanadi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
