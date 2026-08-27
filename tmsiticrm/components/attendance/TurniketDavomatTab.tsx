"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2, Users, Upload, X, CheckCircle2, AlertTriangle, HelpCircle, BookmarkCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import TurniketEmployeeMonthModal from "./TurniketEmployeeMonthModal";

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

interface TabelRow {
  employee_id: number;
  full_name: string;
  department_id: number | null;
  department_name: string | null;
  cells: Record<string, string>;
  worked_min: number;
  late_min: number;
}
interface TabelData {
  days_in_month: number;
  working_days: number;
  rows: TabelRow[];
}

interface PreviewRow {
  row_index: number;
  xlsx_name: string;
  days_with_data: number;
  matched_employee_id: number | null;
  matched_employee_name: string | null;
  confidence: "exact" | "saved" | "surname_only" | "none";
}
interface PreviewOut {
  batch_id: string;
  days_in_month: number;
  rows: PreviewRow[];
}

interface EmployeeOpt { id: number; full_name: string; position: string; }

const CONFIDENCE_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  saved:        { label: "Saqlangan moslik", color: "#3F8CFF", bg: "rgba(63,140,255,0.1)", icon: BookmarkCheck },
  exact:        { label: "Aniq mos keldi", color: "#00A578", bg: "rgba(0,196,140,0.1)", icon: CheckCircle2 },
  surname_only: { label: "Familiya bo'yicha", color: "#E0A400", bg: "rgba(224,164,0,0.12)", icon: AlertTriangle },
  none:         { label: "Topilmadi", color: "#FF5C5C", bg: "rgba(255,92,92,0.1)", icon: HelpCircle },
};

const CODE_CFG: Record<string, { color: string; bg: string }> = {
  "8":  { color: "#00A578", bg: "rgba(0,196,140,0.1)" },
  "X":  { color: "#B8C2D6", bg: "#F4F9FD" },
  "MT": { color: "#B4780C", bg: "rgba(255,189,33,0.15)" },
  "O'": { color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
  "K":  { color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  "B":  { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  "Д":  { color: "#91929E", bg: "rgba(145,146,158,0.12)" },
};

function weekdayOf(year: number, month: number, day: number): number {
  const js = new Date(year, month - 1, day).getDay();
  return js === 0 ? 6 : js - 1;
}
function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function TurniketDavomatTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<TabelData | null>(null);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewOut | null>(null);
  const [selections, setSelections] = useState<Record<number, number | "">>({});
  const [committing, setCommitting] = useState(false);
  const [banner, setBanner] = useState<{ employees: number; days: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const d = await apiFetch<TabelData>(`/turniket/tabel?year=${y}&month=${m}`);
      setData(d);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, []); // eslint-disable-line
  useEffect(() => {
    apiFetch<EmployeeOpt[]>("/employees/").then(setEmployees).catch(() => {});
  }, []);

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); load(y, m);
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setUploadError(null);
    setBanner(null);
    setUploading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("crm_token") : null;
      const form = new FormData();
      form.append("file", file);
      form.append("year", String(year));
      form.append("month", String(month));
      const res = await fetch(`${API_URL}/turniket/preview`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Faylni yuklab bo'lmadi");
      }
      const out: PreviewOut = await res.json();
      setPreview(out);
      const init: Record<number, number | ""> = {};
      out.rows.forEach(r => { init[r.row_index] = r.matched_employee_id ?? ""; });
      setSelections(init);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    try {
      const corrections: Record<number, number | null> = {};
      preview.rows.forEach(r => {
        const v = selections[r.row_index];
        corrections[r.row_index] = v === "" ? null : Number(v);
      });
      const out = await apiFetch<{ imported_employees: number; imported_days: number; skipped_rows: number }>(
        "/turniket/commit",
        { method: "POST", body: JSON.stringify({ batch_id: preview.batch_id, corrections }) }
      );
      setPreview(null);
      setBanner({ employees: out.imported_employees, days: out.imported_days, skipped: out.skipped_rows });
      load(year, month);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setCommitting(false);
    }
  }

  const days = data ? Array.from({ length: data.days_in_month }, (_, i) => i + 1) : [];
  const matchedCount = preview ? preview.rows.filter(r => selections[r.row_index] !== "").length : 0;

  return (
    <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div>
          <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Turniket davomati</h3>
          <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Turniket (badge-reader) xlsx eksportidan yuklangan haqiqiy kirish/chiqish vaqtlari</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFilePicked} className="hidden" id="turniket-file-input" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0px 6px 12px rgba(63,140,255,0.3)" }}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Xlsx yuklash
          </button>
          <div className="flex items-center gap-1 p-1" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
              <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
            </button>
            <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 110, textAlign: "center" }}>
              {MON_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
              <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="mx-6 mt-4 px-4 py-2.5 text-sm font-bold" style={{ background: "rgba(255,92,92,0.08)", color: "#FF5C5C", borderRadius: 12 }}>
          {uploadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="py-16 text-center">
          <Users size={32} style={{ color: "#D9E3F0", margin: "0 auto" }} />
          <p className="font-bold mt-3" style={{ color: "#0A1629" }}>Ma'lumot yo'q</p>
        </div>
      ) : (
        <div className="overflow-x-auto p-4">
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="text-center px-2 py-2 text-xs font-bold sticky left-0" style={{ color: "#91929E", background: "#FAFCFF", minWidth: 32, zIndex: 1 }}>#</th>
                <th className="text-left px-3 py-2 text-xs font-bold sticky left-0" style={{ color: "#91929E", background: "#FAFCFF", minWidth: 190, left: 32, zIndex: 1 }}>Ism familiyasi</th>
                {days.map(d => (
                  <th key={d} className="px-1 py-2 text-center" style={{ minWidth: 40, background: "#FAFCFF" }}>
                    <div className="text-[10px] font-bold" style={{ color: "#0A1629" }}>{d}</div>
                    <div className="text-[8px]" style={{ color: "#B8C2D6" }}>{WEEK_DAYS[weekdayOf(year, month, d)]}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 110, background: "#FAFCFF", color: "#91929E" }}>Jami ish soati</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 90, background: "#FAFCFF", color: "#91929E" }}>Kechikkan vaqti</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, ri) => (
                <tr key={r.employee_id} onClick={() => setSelectedEmployee(r.employee_id)}
                  className="cursor-pointer hover:opacity-80 transition-opacity" style={{ borderTop: "1px solid #F4F9FD" }}>
                  <td className="px-2 py-2 text-xs font-bold text-center sticky left-0" style={{ color: "#91929E", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>{ri + 1}</td>
                  <td className="px-3 py-2 text-xs font-bold sticky whitespace-nowrap" style={{ color: "#0A1629", background: ri % 2 ? "#FFFFFF" : "#FAFCFF", left: 32 }}>{r.full_name}</td>
                  {days.map(d => {
                    const code = r.cells[String(d)] || "";
                    const cfg = CODE_CFG[code];
                    return (
                      <td key={d} className="text-center py-2" style={{ background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                        {code ? (
                          <span className="inline-flex items-center justify-center text-[10px] font-bold whitespace-nowrap"
                            style={{ minWidth: 22, height: 20, borderRadius: 5, color: cfg?.color || "#0A1629", background: cfg?.bg || "transparent" }}>
                            {code}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 text-xs font-bold whitespace-nowrap" style={{ color: "#0A1629", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                    {fmtHM(r.worked_min)}/{fmtHM(data.working_days * 480)}
                  </td>
                  <td className="text-center py-2 text-xs font-bold whitespace-nowrap" style={{ color: r.late_min > 0 ? "#FF8C42" : "#D9E3F0", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                    {fmtHM(r.late_min)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
        {[["8", "Kelgan"], ["X", "Dam olish kuni"], ["MT", "Mehnat ta'tili"], ["O'", "O'quv ta'tili"], ["K", "Xizmat safari"], ["B", "Bolnichniy"]].map(([code, label]) => (
          <span key={code} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
            <span className="inline-flex items-center justify-center text-[9px] font-bold px-1" style={{ minWidth: 20, height: 16, borderRadius: 4, color: CODE_CFG[code]?.color, background: CODE_CFG[code]?.bg }}>
              {code}
            </span>
            {label}
          </span>
        ))}
      </div>

      {banner && (
        <div className="mx-6 mb-5 flex items-center gap-2.5 px-4 py-3" style={{ background: "rgba(0,196,140,0.08)", borderRadius: 14 }}>
          <CheckCircle2 size={18} style={{ color: "#00A578" }} />
          <p className="text-sm font-bold" style={{ color: "#0A1629" }}>
            ✅ Xlsx yuklandi — {banner.employees} ta xodim, {banner.days} kunlik ma'lumot yozildi
            {banner.skipped > 0 && ` (${banner.skipped} qator o'tkazib yuborildi)`}
          </p>
        </div>
      )}

      {/* ── Oldindan ko'rish / tasdiqlash modali ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}>
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
              <div>
                <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Yuklashdan oldin tekshiring</h3>
                <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                  {preview.rows.length} ta qator, {matchedCount} tasi xodimga moslashtirilgan — mos kelmaganlarini qo'lda tanlang
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="w-9 h-9 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                <X size={16} style={{ color: "#7D8592" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-2">
                {preview.rows.map(r => {
                  const cfg = CONFIDENCE_CFG[r.confidence];
                  const Icon = cfg.icon;
                  const mySelection = selections[r.row_index] ?? "";
                  const takenElsewhere = new Set(
                    Object.entries(selections)
                      .filter(([idx, v]) => Number(idx) !== r.row_index && v !== "")
                      .map(([, v]) => v)
                  );
                  const options = employees.filter(e => e.id === mySelection || !takenElsewhere.has(e.id));
                  return (
                    <div key={r.row_index} className="flex items-center gap-3 px-3 py-2.5 flex-wrap" style={{ background: "#FAFCFF", borderRadius: 12 }}>
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color, borderRadius: 6 }}>
                        <Icon size={11} /> {cfg.label}
                      </span>
                      <div className="min-w-0 flex-1" style={{ minWidth: 160 }}>
                        <p className="text-xs font-bold truncate" style={{ color: "#0A1629" }}>{r.xlsx_name}</p>
                        <p className="text-[10px]" style={{ color: "#91929E" }}>{r.days_with_data} kunlik ma'lumot</p>
                      </div>
                      <select value={mySelection} onChange={e => setSelections(s => ({ ...s, [r.row_index]: e.target.value ? Number(e.target.value) : "" }))}
                        className="px-3 py-2 text-xs font-bold outline-none flex-shrink-0"
                        style={{ background: "#FFFFFF", borderRadius: 8, border: "1.5px solid #EEF2FF", color: "#0A1629", minWidth: 200 }}>
                        <option value="">— O'tkazib yuborish —</option>
                        {options.map(e => (
                          <option key={e.id} value={e.id}>{e.full_name} — {e.position}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: "1px solid #F4F9FD" }}>
              <button onClick={() => setPreview(null)} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>
                Bekor qilish
              </button>
              <button onClick={handleCommit} disabled={committing}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#00C48C", borderRadius: 10 }}>
                {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Tasdiqlash va yuklash
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <TurniketEmployeeMonthModal employeeId={selectedEmployee} year={year} month={month} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
