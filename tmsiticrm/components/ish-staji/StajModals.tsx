"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { X, Loader2, Save, CircleAlert, PencilLine, Search, Link2Off, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export interface StajRow {
  id: number;
  order_num: number | null;
  employee_id: number | null;
  employee_name?: string | null;
  full_name: string;
  position: string | null;
  years: number;
  months: number;
  percent: number;
  base_percent: number;
  full_month_mt: boolean;
}
export interface StajData {
  year: number;
  month: number;
  base_year: number | null;
  base_month: number | null;
  rows: StajRow[];
}

const MON = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Shell({ title, sub, icon, onClose, children, footer, wide }: {
  title: string; sub?: string; icon: React.ReactNode; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  useEscape(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} max-h-[92vh] flex flex-col`} onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <p className="font-bold" style={{ color: "#0A1629" }}>{title}</p>
              {sub && <p className="text-xs" style={{ color: "#91929E" }}>{sub}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  );
}

// ── ⬆ Excel (илова .xlsx) yuklash ─────────────────────────────────────────────
interface ImportResult { imported: number; matched: number; unmatched: string[]; base_year: number; base_month: number; }
const MON_CAP = MON.map(m => m[0].toUpperCase() + m.slice(1));

export function StajImportModal({ year, month, onClose, onImported }: {
  year: number; month: number; onClose: () => void; onImported: (year: number, month: number) => void;
}) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload() {
    if (!file) { setError("Faylni tanlang"); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("year", String(y)); fd.append("month", String(m));
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const res = await fetch(`${API_URL}/ish-staji/import`, {
        method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Yuklab bo'lmadi");
      setResult(body as ImportResult);
      onImported(body.base_year, body.base_month);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally { setBusy(false); }
  }

  const sel = "w-full px-3 py-2.5 text-sm outline-none bg-[#F4F9FD]";
  const selStyle = { border: "1px solid #E4EAF2", borderRadius: 10, color: "#0A1629" };
  return (
    <Shell title="Ish staji jadvalini yuklash" sub="илова .xlsx — kadrlar jadvali" onClose={onClose}
      icon={<div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(0,196,140,0.12)", borderRadius: 12 }}><FileSpreadsheet size={19} style={{ color: "#00A578" }} /></div>}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>
            {result ? "Yopish" : "Bekor qilish"}
          </button>
          {!result && (
            <button onClick={upload} disabled={busy || !file} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#00A578", borderRadius: 12 }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Yuklash
            </button>
          )}
        </div>
      }>
      <div className="px-6 py-4">
        {result ? (
          <div>
            <div className="flex items-center gap-2 p-3" style={{ background: "#E7F8EE", borderRadius: 12, color: "#16A34A" }}>
              <CheckCircle2 size={18} />
              <p className="text-sm font-bold">{MON_CAP[result.base_month - 1]} {result.base_year} uchun {result.imported} ta xodim yuklandi</p>
            </div>
            <p className="text-xs mt-3" style={{ color: "#7D8592" }}>CRM xodimlariga bog&apos;landi: <b>{result.matched}</b> ta</p>
            {result.unmatched.length > 0 && (
              <div className="mt-2 p-3 text-xs" style={{ background: "#FDECEC", borderRadius: 12, color: "#B91C1C" }}>
                <p className="font-bold mb-1">CRM&apos;da topilmadi ({result.unmatched.length}) — ✏️ tahrirlash oynasida bog&apos;lang:</p>
                <p>{result.unmatched.join(", ")}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs font-bold mb-1.5" style={{ color: "#7D8592" }}>Jadval qaysi oy holatida?</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={m} onChange={e => setM(Number(e.target.value))} className={sel} style={selStyle}>
                {MON_CAP.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
              <select value={y} onChange={e => setY(Number(e.target.value))} className={sel} style={selStyle}>
                {[year - 1, year, year + 1].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="mt-3 px-3 py-2.5 text-sm font-bold text-center" style={{ background: "rgba(63,140,255,0.08)", color: "#3F8CFF", borderRadius: 10 }}>
              {MON_CAP[m - 1]} {y} oy uchun yuklanmoqda
            </div>

            <label className="mt-3 flex flex-col items-center justify-center gap-1.5 py-6 cursor-pointer"
              style={{ border: `1.5px dashed ${file ? "#00A578" : "#C9D6E8"}`, borderRadius: 14, background: file ? "#F2FBF6" : "#FAFCFF" }}>
              <input type="file" accept=".xlsx" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); }} />
              <FileSpreadsheet size={26} style={{ color: file ? "#00A578" : "#A8B0BD" }} />
              <span className="text-sm font-bold" style={{ color: file ? "#0A1629" : "#7D8592" }}>{file ? file.name : ".xlsx faylni tanlang"}</span>
              <span className="text-[11px]" style={{ color: "#91929E" }}>Ustunlar: Tr, FISh, Lavozimi, yil, oy</span>
            </label>

            <p className="text-[11px] mt-3 flex gap-1.5" style={{ color: "#E07A1F" }}>
              <CircleAlert size={13} className="flex-shrink-0 mt-px" />
              Yuklangan jadval avvalgi barcha ma&apos;lumotlarni almashtiradi. Keyingi oylar stajiga har oy +1 oy qo&apos;shiladi.
            </p>
            {error && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{error}</p>}
          </>
        )}
      </div>
    </Shell>
  );
}

// ── ❗ Ustama foizlari ─────────────────────────────────────────────────────────
const BRACKETS: { range: string; pct: number }[] = [
  { range: "1 yilgacha", pct: 0 },
  { range: "1 yildan 3 yilgacha", pct: 25 },
  { range: "3 yildan 5 yilgacha", pct: 50 },
  { range: "5 yildan 10 yilgacha", pct: 75 },
  { range: "10 yildan 15 yilgacha", pct: 100 },
  { range: "15 yildan 20 yilgacha", pct: 125 },
  { range: "20 yildan ortiq", pct: 150 },
];

export function StajInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="Ustamalar miqdorlari" sub="Lavozim maoshiga nisbatan foiz hisobida" onClose={onClose}
      icon={<div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(255,140,66,0.12)", borderRadius: 12 }}><CircleAlert size={19} style={{ color: "#FF8C42" }} /></div>}
      footer={<div className="px-6 pb-5"><button onClick={onClose} className="w-full py-2.5 text-sm font-bold text-white" style={{ background: "#3F8CFF", borderRadius: 12 }}>Tushunarli</button></div>}>
      <div className="px-6 py-4">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFCFF" }}>
              <th className="text-left px-3 py-2 text-xs font-bold" style={{ color: "#91929E" }}>Ish staji</th>
              <th className="text-center px-3 py-2 text-xs font-bold" style={{ color: "#91929E" }}>Ustama</th>
            </tr>
          </thead>
          <tbody>
            {BRACKETS.map(b => (
              <tr key={b.range} style={{ borderTop: "1px solid #F4F9FD" }}>
                <td className="px-3 py-2" style={{ color: "#0A1629" }}>{b.range}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-block px-2.5 py-0.5 text-xs font-bold" style={{ borderRadius: 6,
                    color: b.pct === 0 ? "#91929E" : b.pct <= 50 ? "#3F8CFF" : b.pct <= 100 ? "#00A578" : "#6D5DD3",
                    background: b.pct === 0 ? "#F4F9FD" : b.pct <= 50 ? "rgba(63,140,255,0.1)" : b.pct <= 100 ? "rgba(0,196,140,0.1)" : "rgba(109,93,211,0.12)" }}>
                    {b.pct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

// ── ✏️ Jadvalni tahrirlash ─────────────────────────────────────────────────────
interface Emp { id: number; full_name: string; position: string; }
interface Draft { id: number; order_num: number | null; employee_id: number | null; full_name: string; position: string; years: string; months: string; }

export function StajEditModal({ data, onClose, onSaved }: {
  data: StajData;
  onClose: () => void;
  onSaved: (d: StajData) => void;
}) {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>(() => data.rows.map(r => ({
    id: r.id, order_num: r.order_num, employee_id: r.employee_id, full_name: r.full_name,
    position: r.position ?? "", years: String(r.years), months: String(r.months),
  })));
  const [search, setSearch] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Emp[]>("/employees/")
      .then(list => setEmps([...list].sort((a, b) => a.full_name.localeCompare(b.full_name))))
      .catch(() => {});
  }, []);

  const original = useMemo(() => new Map(data.rows.map(r => [r.id, r])), [data.rows]);
  const changedCount = drafts.filter(d => {
    const o = original.get(d.id)!;
    return d.full_name !== o.full_name || d.position !== (o.position ?? "") || d.employee_id !== o.employee_id
      || d.years !== String(o.years) || d.months !== String(o.months);
  }).length;
  const unlinked = drafts.filter(d => !d.employee_id).length;

  function upd(id: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  async function save() {
    for (const d of drafts) {
      const y = Number(d.years), m = Number(d.months);
      if (!d.full_name.trim()) { setError("FISh bo'sh bo'lishi mumkin emas"); return; }
      if (!Number.isInteger(y) || y < 0 || !Number.isInteger(m) || m < 0 || m > 11) {
        setError(`${d.full_name}: yil 0 dan katta, oy 0–11 oralig'ida bo'lishi kerak`); return;
      }
    }
    setSaving(true); setError(null);
    try {
      const res = await apiFetch<StajData>("/ish-staji/bulk", {
        method: "PUT",
        body: JSON.stringify({
          year: data.year, month: data.month,
          rows: drafts.map(d => ({ id: d.id, employee_id: d.employee_id, full_name: d.full_name.trim(),
            position: d.position.trim() || null, years: Number(d.years), months: Number(d.months) })),
        }),
      });
      onSaved(res);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  const visible = drafts.filter(d =>
    (!onlyUnlinked || !d.employee_id) &&
    (!search || d.full_name.toLowerCase().includes(search.toLowerCase())),
  );
  const input = "w-full px-2 py-1.5 text-sm outline-none bg-[#F4F9FD] focus:bg-white";
  const inputStyle = { border: "1px solid #E4EAF2", borderRadius: 8, color: "#0A1629" };

  return (
    <Shell wide title="Ish stajini tahrirlash" sub={`${MON[data.month - 1]} ${data.year} holatida · staj keyingi oylarga shundan davom etadi`} onClose={onClose}
      icon={<div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.12)", borderRadius: 12 }}><PencilLine size={18} style={{ color: "#3F8CFF" }} /></div>}
      footer={
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
          <span className="text-xs font-bold" style={{ color: error ? "#FF5C5C" : changedCount ? "#3F8CFF" : "#A8B0BD" }}>
            {error ?? (changedCount ? `${changedCount} ta qator o'zgartirildi` : "O'zgarish yo'q")}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>Bekor qilish</button>
            <button onClick={save} disabled={saving || !changedCount}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#3F8CFF", borderRadius: 12 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Saqlash
            </button>
          </div>
        </div>
      }>
      <div className="px-6 py-3 flex items-center gap-2 flex-wrap sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-[200px]" style={{ border: "1px solid #D9E3F0", borderRadius: 10 }}>
          <Search size={14} style={{ color: "#91929E" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Xodimni qidirish..." className="flex-1 outline-none text-sm bg-transparent" />
        </div>
        <button onClick={() => setOnlyUnlinked(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
          style={{ borderRadius: 10, border: `1px solid ${onlyUnlinked ? "#FF5C5C" : "#D9E3F0"}`, color: unlinked ? "#FF5C5C" : "#91929E", background: onlyUnlinked ? "rgba(255,92,92,0.08)" : "#FFFFFF" }}>
          <Link2Off size={13} /> CRM&apos;ga bog&apos;lanmagan: {unlinked}
        </button>
      </div>
      <div className="px-6 py-3">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 6px" }}>
          <thead>
            <tr>
              {["Tr", "FISh", "CRM xodimi (mehnat ta'tili tekshiruvi uchun)", "Lavozimi", "Yil", "Oy"].map(h => (
                <th key={h} className="text-left px-1.5 text-[11px] font-bold" style={{ color: "#91929E" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((d, i) => {
              const miss = !d.employee_id;
              return (
                <tr key={d.id}>
                  <td className="px-1.5 text-xs font-bold" style={{ color: "#91929E", width: 36 }}>{d.order_num ?? i + 1}</td>
                  <td className="px-1.5" style={{ minWidth: 150 }}>
                    <input value={d.full_name} onChange={e => upd(d.id, { full_name: e.target.value })} className={input} style={inputStyle} />
                  </td>
                  <td className="px-1.5" style={{ minWidth: 220 }}>
                    <select value={d.employee_id ?? ""} onChange={e => upd(d.id, { employee_id: e.target.value ? Number(e.target.value) : null })}
                      className={input} style={{ ...inputStyle, borderColor: miss ? "#FF9B9B" : "#E4EAF2", color: miss ? "#FF5C5C" : "#0A1629" }}>
                      <option value="">— CRM&apos;da topilmadi —</option>
                      {emps.map(e => <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` · ${e.position}` : ""}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5" style={{ minWidth: 170 }}>
                    <input value={d.position} onChange={e => upd(d.id, { position: e.target.value })} className={input} style={inputStyle} />
                  </td>
                  <td className="px-1.5" style={{ width: 70 }}>
                    <input value={d.years} onChange={e => upd(d.id, { years: e.target.value })} inputMode="numeric" className={`${input} text-center`} style={inputStyle} />
                  </td>
                  <td className="px-1.5" style={{ width: 70 }}>
                    <input value={d.months} onChange={e => upd(d.id, { months: e.target.value })} inputMode="numeric" className={`${input} text-center`} style={inputStyle} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="text-center text-sm py-8" style={{ color: "#91929E" }}>Xodim topilmadi</p>}
      </div>
    </Shell>
  );
}
