"use client";

import { useState, useCallback, useEffect } from "react";
import { Download, Save, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Types ── */
type Code = "8" | "4" | "X" | "Б" | "К" | "У/Т" | "М/Т" | "Х/С" | "Б/С" | "Д" | "";
const WORK_CYCLE: Code[] = ["8", "X", "Б", "К", "У/Т", "М/Т", ""];
const HALF_CYCLE: Code[] = ["4", "X", "Б", "К", "У/Т", "М/Т", ""];

const CS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  "8":   { bg: "#ffffff", color: "#041638", border: "#c5c6cf", label: "Ish kuni (8 soat)" },
  "4":   { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd", label: "Yarim stavka (4 soat)" },
  "X":   { bg: "#efedf1", color: "#75777f", border: "#c5c6cf", label: "Dam olish" },
  "Б":   { bg: "#fefce8", color: "#854d0e", border: "#fde047", label: "Bayram" },
  "К":   { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", label: "Kasallik varakasi" },
  "У/Т": { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd", label: "O'quv ta'tili" },
  "М/Т": { bg: "#faf5ff", color: "#6d28d9", border: "#c4b5fd", label: "Mehnat ta'tili" },
  "Х/С": { bg: "#ecfdf5", color: "#047857", border: "#6ee7b7", label: "Xizmat safari" },
  "Б/С": { bg: "#fff7ed", color: "#c2410c", border: "#fdba74", label: "Ish haqisiz ta'til" },
  "Д":   { bg: "#fdf2f8", color: "#be185d", border: "#f9a8d4", label: "Dekret" },
  "":    { bg: "#fafafa", color: "#c5c6cf", border: "#e4e2e5", label: "Belgilanmagan" },
};

const MON_NAMES = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function isWknd(year: number, month: number, day: number) {
  const w = new Date(year, month - 1, day).getDay();
  return w === 0 || w === 6;
}

interface ApiEmployee {
  employee_id: number;
  full_name: string;
  position: string;
  work_rate: number;
  days: Record<string, string>;
  locked?: number[];   // dam olish, bayram, ta'til... — davomatdan avtomatik, o'zgartirilmaydi
}

interface Emp {
  id: number;
  name: string;
  pos: string;
  unit: string;
  days: Record<number, Code>;
  locked: number[];
}

function apiToLocal(api: ApiEmployee[]): Emp[] {
  return api.map(a => ({
    id: a.employee_id,
    name: a.full_name,
    pos: a.position,
    unit: `${a.work_rate} st.`,
    locked: a.locked ?? [],
    days: Object.fromEntries(
      Object.entries(a.days).map(([d, c]) => [Number(d), c as Code])
    ),
  }));
}

function fillWeekends(emps: Emp[], year: number, month: number, total: number): Emp[] {
  return emps.map(e => {
    const days = { ...e.days };
    for (let d = 1; d <= total; d++) {
      // Qolgan kunlar backenddan (davomat, bayram, ta'til) — bo'sh kun "kelmagan" bo'lib qoladi
      if (isWknd(year, month, d) && !days[d]) days[d] = "X";
    }
    return { ...e, days };
  });
}

const DEPT    = "Axborot texnologiyalarini joriy etish bo'limi";

export default function TabelPage() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [tab,   setTab]   = useState<"half"|"full">("full");
  const [emps,  setEmps]  = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [_deptId, setDeptId]  = useState<number | null>(null);
  const [deptName,setDeptName]= useState(DEPT);

  const total    = daysInMonth(year, month);
  const activeDays = tab === "half"
    ? Array.from({ length: Math.min(15, total) }, (_, i) => i + 1)
    : Array.from({ length: total }, (_, i) => i + 1);

  /* ── Load employees + tabel from API ── */
  const loadTabel = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const user = getUser();
      const dId  = user?.department_id ?? null;
      setDeptId(dId);

      const query = dId ? `?year=${y}&month=${m}&department_id=${dId}` : `?year=${y}&month=${m}`;
      const data  = await apiFetch<ApiEmployee[]>(`/tabel/month${query}`);

      const tot = daysInMonth(y, m);
      setEmps(fillWeekends(apiToLocal(data), y, m, tot));
    } catch (err) {
      console.error("Tabel yuklashda xato:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (user?.department_id) {
      // Try to get dept name
      apiFetch<{ name: string }>(`/departments/${user.department_id}`)
        .then(d => setDeptName(d.name))
        .catch(() => {});
    }
    loadTabel(year, month);
  }, []);  // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setYear(y); setMonth(m);
    loadTabel(y, m);
  }

  /* ── Toggle code ── */
  const toggle = useCallback((empId: number, day: number) => {
    if (isWknd(year, month, day)) return;
    setEmps(prev => prev.map(e => {
      if (e.id !== empId || e.locked.includes(day)) return e;
      const cur = e.days[day] ?? "";
      const cycle = e.unit.startsWith("0.5") || e.unit.startsWith("0,5") ? HALF_CYCLE : WORK_CYCLE;
      const idx = cycle.indexOf(cur as Code);
      return { ...e, days: { ...e.days, [day]: cycle[(idx + 1) % cycle.length] } };
    }));
    setSaved(false);
  }, [year, month]);

  /* ── Save to API ── */
  async function handleSave() {
    setSaving(true);
    try {
      const records: { employee_id: number; year: number; month: number; day: number; code: string }[] = [];
      for (const e of emps) {
        for (let d = 1; d <= total; d++) {
          records.push({ employee_id: e.id, year, month, day: d, code: e.days[d] ?? "" });
        }
      }
      await apiFetch("/tabel/save", { method: "POST", body: JSON.stringify({ records }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Saqlashda xato: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  /* ── Count ── */
  function cntP(e: Emp) { return activeDays.filter(d => e.days[d] === "8" || e.days[d] === "4").length || ""; }
  function cntA(e: Emp) { return activeDays.filter(d => e.days[d] && e.days[d] !== "8" && e.days[d] !== "4" && e.days[d] !== "X").length || ""; }

  /* ── Word export: backendda (oq-qora, printer uchun) — kadrning "Avans table" bilan bir xil ── */
  async function downloadWord() {
    await handleSave();   // saqlanmagan o'zgarishlar ham faylga tushsin
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const dayTo = tab === "half" ? 15 : total;
      const res = await fetch(`${API_URL}/tabel/avans-docx?year=${year}&month=${month}&day_from=1&day_to=${dayTo}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tabel_${tab === "half" ? "Yarim" : "Toliq"}_${MON_NAMES[month - 1]}_${year}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  /* ── Cell ── */
  function DayCell({ e, d }: { e: Emp; d: number }) {
    const wk   = isWknd(year, month, d);
    const code: Code = wk ? "X" : (e.days[d] ?? "");
    const s    = CS[code] ?? CS[""];
    const lock = wk || e.locked.includes(d);
    return (
      <td onClick={() => toggle(e.id, d)} title={wk ? "Dam olish kuni" : lock ? `${s.label} — avtomatik (davomat/kadr)` : s.label}
        style={{
          border: "1px solid #e4e2e5",
          background: wk ? "#efedf1" : s.bg,
          color: wk ? "#75777f" : s.color,
          textAlign: "center", fontSize: 11, fontWeight: 600,
          cursor: lock ? "default" : "pointer",
          userSelect: "none", padding: "10px 1px",
          transition: "background 0.12s",
        }}>
        {code}
      </td>
    );
  }

  const tdFix = (ei: number): React.CSSProperties => ({
    border: "1px solid #e4e2e5", verticalAlign: "middle",
    background: ei % 2 === 0 ? "#ffffff" : "#fbf8fc",
  });

  return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="font-bold text-2xl" style={{ color: "#041638" }}>Davomat jadvali</h1>
          <p className="text-sm mt-0.5" style={{ color: "#75777f" }}>{deptName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month switcher */}
          <div className="flex items-center p-1 gap-1"
            style={{ background: "#fff", border: "1px solid #c5c6cf", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <button onClick={() => chMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100">
              <ChevronLeft size={15} style={{ color: "#041638" }} />
            </button>
            <span className="px-3 font-bold text-sm" style={{ color: "#041638", minWidth: 100, textAlign: "center" }}>
              {MON_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => chMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100">
              <ChevronRight size={15} style={{ color: "#041638" }} />
            </button>
          </div>
          <button onClick={() => loadTabel(year, month)}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm border hover:bg-gray-50 transition-colors"
            style={{ border: "1px solid #c5c6cf", color: "#041638", borderRadius: 8 }}>
            <RefreshCw size={14} /> Tiklash
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm transition-colors"
            style={{ background: saved ? "#d1fae5" : "#d9e2ff", color: saved ? "#065f46" : "#041638", borderRadius: 8 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saqlanmoqda..." : saved ? "Saqlandi ✓" : "Saqlash"}
          </button>
          <button onClick={downloadWord}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ background: "#041638", borderRadius: 8 }}>
            <Download size={14} />
            {tab === "half" ? "Yarim oylik yuklab olish" : "To'liq oylik yuklab olish"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 w-fit"
        style={{ background: "#efedf1", borderRadius: 10 }}>
        {(["half", "full"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 font-bold text-sm transition-all"
            style={{
              borderRadius: 8,
              background: tab === t ? "#041638" : "transparent",
              color: tab === t ? "#ffffff" : "#45464e",
              boxShadow: tab === t ? "0 2px 8px rgba(4,22,56,0.2)" : "none",
            }}>
            {t === "half" ? "Yarim oylik (1–15)" : `To'liq oylik (1–${total})`}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 p-3"
        style={{ background: "#fff", border: "1px solid #e4e2e5", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {Object.entries(CS).filter(([k]) => k !== "").map(([code, s]) => (
          <div key={code} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold"
            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6 }}>
            <span>{code}</span>
            <span style={{ fontWeight: 400, opacity: 0.8 }}>— {s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "#041638" }} />
          <span className="ml-3 font-bold" style={{ color: "#041638" }}>Yuklanmoqda...</span>
        </div>
      ) : emps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="font-bold text-lg" style={{ color: "#041638" }}>Xodimlar topilmadi</p>
          <p className="text-sm mt-1" style={{ color: "#75777f" }}>Bu bo'limda xodimlar yo'q yoki API bilan bog'lanib bo'lmadi</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e4e2e5", boxShadow: "0 4px 24px rgba(4,22,56,0.09)", background: "#fff" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 56 }} />
              {activeDays.map(d => <col key={d} />)}
              <col style={{ width: 36 }} />
              <col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr>
                {["№", "F.I.Sh.", "LAVOZIM", "SHTAT"].map((h, i) => (
                  <th key={i} style={{ border: "1px solid #c5c6cf", background: "#1e3a5f", color: "#e2e8f0", fontWeight: 700, fontSize: 10, padding: "8px 4px", textAlign: "center", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
                {activeDays.map(d => {
                  const wk = isWknd(year, month, d);
                  return (
                    <th key={d} style={{ border: "1px solid #c5c6cf", background: wk ? "#475569" : "#2563EB", color: wk ? "#CBD5E1" : "#EFF6FF", fontWeight: 700, fontSize: 11, padding: "7px 1px", textAlign: "center" }}>
                      {d}
                    </th>
                  );
                })}
                {["I.K.", "I.Km."].map(h => (
                  <th key={h} style={{ border: "1px solid #c5c6cf", background: "#1e3a5f", color: "#e2e8f0", fontWeight: 700, fontSize: 9, padding: "7px 2px", textAlign: "center" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map((e, ei) => (
                <tr key={e.id} style={{ background: ei % 2 === 0 ? "#ffffff" : "#fbf8fc" }} className="hover:bg-blue-50/20 transition-colors">
                  <td style={{ ...tdFix(ei), textAlign: "center", fontWeight: 700, color: "#041638", fontSize: 12 }}>
                    {ei + 1}
                  </td>
                  <td style={{ ...tdFix(ei), padding: "10px 8px", fontWeight: 500, color: "#041638", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.name}
                  </td>
                  <td style={{ ...tdFix(ei), padding: "10px 6px", color: "#45464e", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.pos}
                  </td>
                  <td style={{ ...tdFix(ei), textAlign: "center", color: "#75777f", fontSize: 11 }}>
                    {e.unit}
                  </td>
                  {activeDays.map(d => <DayCell key={d} e={e} d={d} />)}
                  <td style={{ ...tdFix(ei), textAlign: "center", fontWeight: 700, fontSize: 14, color: "#041638" }}>
                    {cntP(e)}
                  </td>
                  <td style={{ ...tdFix(ei), textAlign: "center", fontWeight: 700, fontSize: 14, color: cntA(e) ? "#ba1a1a" : "#c5c6cf" }}>
                    {cntA(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-center italic" style={{ color: "#75777f" }}>
        Kunni bosing — kod o'zgaradi: 8 → X → Б → К → У/Т → М/Т → bo'sh
      </p>

      {/* Signatures */}
      <div className="mt-10 flex justify-between items-end pb-6">
        <div className="w-60">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#041638" }}>Mutaxassis</p>
          <div className="h-8 flex items-end border-b-2" style={{ borderColor: "rgba(4,22,56,0.2)" }}>
            <span className="text-xs italic" style={{ color: "#75777f" }}>Imzo: ___________________</span>
          </div>
        </div>
        <div className="w-60">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#041638" }}>Bo'lim boshlig'i</p>
          <div className="h-8 flex items-end border-b-2" style={{ borderColor: "rgba(4,22,56,0.2)" }}>
            <span className="text-xs italic" style={{ color: "#75777f" }}>Imzo: ___________________</span>
          </div>
        </div>
      </div>
    </div>
  );
}
