"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Users, Download, PencilLine, CircleAlert, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { CODE_CFG, OVERRIDE_COLOR } from "@/components/attendance/tabelCodes";
import TabelEditModal from "@/components/attendance/TabelEditModal";
import CheckInCorrectionModal from "@/components/attendance/CheckInCorrectionModal";

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

interface DayNote {
  type: string;
  text: string | null;
  status: string;
}
interface DayInfo {
  check_in: string | null;
  override?: boolean;   // kadr qo'lda "8" qo'ygan
  late_min: number;
  excused: boolean;
  note: DayNote | null;
}
interface AutoTabelRow {
  employee_id: number;
  full_name: string;
  department_id: number | null;
  department_name: string | null;
  cells: Record<string, string>;
  day_info?: Record<string, DayInfo>;
  worked_min: number;
  late_min: number;
  excused_min?: number;
  ball?: number | null;   // davomat mezoni bali (25 dan)
  auto_cells?: Record<string, string>;
  overridden?: number[];   // kadr qo'lda tuzatgan kunlar
}
interface AutoTabelData {
  days_in_month: number;
  working_days: number;
  rows: AutoTabelRow[];
  holidays?: Record<string, string>;  // {kun: bayram nomi}
}

function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}


// Kelgan kun ("8") rangi: vaqtida — yashil, 10 daqiqagacha — sariq, undan ko'p — qizil.
// Kadr arizani tasdiqlagan bo'lsa — yashil (ko'k nuqta bilan).
const LATE_WARN_MIN = 10;
const LATE_CFG = { color: "#B4780C", bg: "rgba(255,189,33,0.18)" };
const VERY_LATE_CFG = { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" };

function presentCfg(info: DayInfo) {
  if (info.excused || info.late_min <= 0) return CODE_CFG["8"];
  return info.late_min <= LATE_WARN_MIN ? LATE_CFG : VERY_LATE_CFG;
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  kechikish: "Kechikaman",
  kelmaslik: "Kelmayman",
  obyektda:  "Obyektda",
  ruxsat:    "Ruxsat so'ralgan",
};
const NOTE_STATUS: Record<string, { label: string; color: string }> = {
  bolim_kutilmoqda: { label: "Bo'lim boshlig'ida", color: "#B4780C" },
  kutilmoqda:      { label: "Kutilmoqda",      color: "#91929E" },
  kadr_tasdiqladi: { label: "Kadr tasdiqladi", color: "#3F8CFF" },
  sababli:         { label: "Sababli",         color: "#00A578" },
  sababsiz:        { label: "Sababsiz",        color: "#FF5C5C" },
};

interface OpenCell {
  row: AutoTabelRow;
  day: number;
  info: DayInfo;
  x: number;
  y: number;
}

// Davomat mezoni bali: oy davomida ishda bo'lmagan (sababsiz kechikkan) vaqtga qarab
const MAX_BALL = 25;
function ballRule(min: number): string {
  if (min <= 60) return "60 daq gacha — 100%";
  if (min <= 90) return "61–90 daq — 80%";
  if (min <= 120) return "91–120 daq — 60%";
  if (min <= 150) return "121–150 daq — 40%";
  if (min <= 180) return "151–180 daq — 20%";
  return "181 daq va undan ko'p — 0%";
}
function ballColor(b: number): { color: string; bg: string } {
  if (b >= MAX_BALL) return { color: "#00A578", bg: "rgba(0,196,140,0.1)" };
  if (b >= 15) return { color: "#B4780C", bg: "rgba(255,189,33,0.18)" };
  return { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" };
}

// Davomat mezoni qoidasi (hujjatdagi matn)
const BALL_STEPS: { range: string; pct: number }[] = [
  { range: "60 daqiqagacha",         pct: 100 },
  { range: "≥ 61 va ≤ 90 daqiqa",    pct: 80 },
  { range: "≥ 91 va ≤ 120 daqiqa",   pct: 60 },
  { range: "≥ 121 va ≤ 150 daqiqa",  pct: 40 },
  { range: "≥ 151 va ≤ 180 daqiqa",  pct: 20 },
  { range: "181 daqiqa va undan ko'p", pct: 0 },
];

function BallInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}
        role="dialog" aria-modal="true" aria-labelledby="ball-info-title">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,140,66,0.12)", borderRadius: 12 }}>
              <CircleAlert size={19} style={{ color: "#FF8C42" }} />
            </div>
            <div>
              <p id="ball-info-title" className="font-bold" style={{ color: "#0A1629" }}>Davomat mezoni — ball</p>
              <p className="text-xs" style={{ color: "#91929E" }}>Maksimal: {MAX_BALL} ball</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="px-6 py-4">

          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFCFF" }}>
                <th className="text-left px-3 py-2 text-xs font-bold" style={{ color: "#91929E" }}>Ishda bo&apos;lmagan vaqt</th>
                <th className="text-center px-3 py-2 text-xs font-bold" style={{ color: "#91929E" }}>Foiz</th>
                <th className="text-center px-3 py-2 text-xs font-bold" style={{ color: "#91929E" }}>Ball</th>
              </tr>
            </thead>
            <tbody>
              {BALL_STEPS.map(st => {
                const b = MAX_BALL * st.pct / 100;
                const c = ballColor(b);
                return (
                  <tr key={st.range} style={{ borderTop: "1px solid #F4F9FD" }}>
                    <td className="px-3 py-2" style={{ color: "#0A1629" }}>{st.range}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: "#7D8592" }}>{st.pct}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold" style={{ color: c.color, background: c.bg, borderRadius: 6 }}>
                        {b}/{MAX_BALL}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full py-2.5 text-sm font-bold text-white" style={{ background: "#3F8CFF", borderRadius: 12 }}>
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
}

function weekdayOf(year: number, month: number, day: number): number {
  // 0 = Dushanba ... 6 = Yakshanba
  const js = new Date(year, month - 1, day).getDay(); // 0=Yak
  return js === 0 ? 6 : js - 1;
}

export default function AutoTabelTable() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<AutoTabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);
  const [editRow, setEditRow] = useState<AutoTabelRow | null>(null);
  const [ballInfoOpen, setBallInfoOpen] = useState(false);
  // Qo'lda tuzatish — faqat kadr va superadmin (backendda ham shunday)
  const [canEdit, setCanEdit] = useState(false);
  // Kelish vaqtini tuzatish (o'tgan kunlar ham) — faqat superadmin
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [correcting, setCorrecting] = useState<{ employeeId: number; date: string } | null>(null);
  useEffect(() => {
    const role = getUser()?.role ?? "";
    setCanEdit(["kadr", "superadmin"].includes(role));
    setIsSuperadmin(role === "superadmin");
  }, []);

  const todayIso = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  const dayIso = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Tashqariga bosilganda yoki sahifa aylantirilganda oyna yopiladi
  useEffect(() => {
    if (!openCell) return;
    const close = () => setOpenCell(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openCell]);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const d = await apiFetch<AutoTabelData>(`/tabel/auto?year=${y}&month=${m}`);
      setData(d);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); load(y, m);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("crm_token") : null;
      const res = await fetch(`${API_URL}/tabel/auto-xlsx?year=${year}&month=${month}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xodimlar_davomati_${year}_${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setDownloading(false);
    }
  }

  const days = data ? Array.from({ length: data.days_in_month }, (_, i) => i + 1) : [];

  return (
    <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div>
          <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Xodimlar davomati</h3>
          <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Attendance asosida avtomatik hisoblangan oylik jadval</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleDownload} disabled={downloading || loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "#00C48C", borderRadius: 12, boxShadow: "0px 6px 12px rgba(0,196,140,0.3)" }}>
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Yuklab olish (.xlsx)
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="py-16 text-center">
          <Users size={32} style={{ color: "#D9E3F0", margin: "0 auto" }} />
          <p className="font-bold mt-3" style={{ color: "#0A1629" }}>Xodimlar topilmadi</p>
        </div>
      ) : (
        <div className="overflow-x-auto p-4">
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="text-center px-2 py-2 text-xs font-bold sticky left-0" style={{ color: "#91929E", background: "#FAFCFF", minWidth: 32, zIndex: 1 }}>
                  #
                </th>
                <th className="text-left px-3 py-2 text-xs font-bold sticky left-0" style={{ color: "#91929E", background: "#FAFCFF", minWidth: 190, left: 32, zIndex: 1 }}>
                  Ism familiyasi
                </th>
                {days.map(d => (
                  <th key={d} className="px-1 py-2 text-center" style={{ minWidth: 34, background: "#FAFCFF" }}>
                    <div className="text-[10px] font-bold" style={{ color: data.holidays?.[String(d)] ? "#E0457B" : "#0A1629" }}
                      title={data.holidays?.[String(d)]}>{d}</div>
                    <div className="text-[8px]" style={{ color: "#B8C2D6" }}>{WEEK_DAYS[weekdayOf(year, month, d)]}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 110, background: "#FAFCFF", color: "#91929E" }}>
                  Jami ish soati
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 90, background: "#FAFCFF", color: "#91929E" }}>
                  Kechikkan vaqti
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 80, background: "#FAFCFF", color: "#91929E" }}>
                  <button onClick={() => setBallInfoOpen(true)} title="Ball qanday hisoblanadi?"
                    className="inline-flex items-center gap-1 font-bold hover:text-[#3F8CFF] transition-colors">
                    <CircleAlert size={13} style={{ color: "#FF8C42" }} />
                    Ball
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, ri) => (
                <tr key={r.employee_id} style={{ borderTop: "1px solid #F4F9FD" }}>
                  <td className="px-2 py-2 text-xs font-bold text-center sticky left-0" style={{ color: "#91929E", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                    {ri + 1}
                  </td>
                  <td className="px-3 py-2 text-xs font-bold sticky whitespace-nowrap" style={{ color: "#0A1629", background: ri % 2 ? "#FFFFFF" : "#FAFCFF", left: 32 }}>
                    {canEdit ? (
                      <button onClick={() => setEditRow(r)} title="Davomatni tuzatish"
                        className="group flex items-center gap-1.5 font-bold hover:text-[#3F8CFF] transition-colors">
                        {r.full_name}
                        <PencilLine size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#3F8CFF" }} />
                      </button>
                    ) : r.full_name}
                  </td>
                  {days.map(d => {
                    const code = r.cells[String(d)] || "";
                    const info = r.day_info?.[String(d)];
                    const cfg = info ? presentCfg(info) : CODE_CFG[code];
                    const isOpen = openCell?.row.employee_id === r.employee_id && openCell.day === d;
                    const isOverride = r.overridden?.includes(d);
                    return (
                      <td key={d} className="text-center py-2" style={{ background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                        {code ? (
                          <span
                            className={`relative inline-flex items-center justify-center text-[10px] font-bold${info ? " cursor-pointer hover:opacity-80" : ""}`}
                            onClick={info ? (e) => {
                              e.stopPropagation();
                              if (isOpen) { setOpenCell(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOpenCell({ row: r, day: d, info, x: rect.left + rect.width / 2, y: rect.bottom });
                            } : undefined}
                            style={{
                              width: 22, height: 20, borderRadius: 5,
                              color: cfg?.color || "#0A1629", background: cfg?.bg || "transparent",
                              outline: isOpen ? `2px solid ${cfg?.color}` : "none",
                            }}>
                            {code}
                            {(info?.excused || info?.note) && (
                              <span className="absolute" style={{ top: -2, right: -2, width: 6, height: 6, borderRadius: 3, background: info.excused ? "#3F8CFF" : "#FFBD21", border: "1px solid #FFFFFF" }} />
                            )}
                            {isOverride && (
                              <span className="absolute" title="Kadr tuzatgan" style={{ bottom: -2, left: -2, width: 6, height: 6, borderRadius: 3, background: OVERRIDE_COLOR, border: "1px solid #FFFFFF" }} />
                            )}
                          </span>
                        ) : isOverride ? (
                          <span className="inline-block" title="Kadr tuzatgan: bo'sh"
                            style={{ width: 22, height: 20, borderRadius: 5, border: `1px dashed ${OVERRIDE_COLOR}` }} />
                        ) : isSuperadmin && dayIso(d) <= todayIso ? (
                          // Bo'sh (kelmagan) o'tgan kun — superadmin kelish vaqtini qo'sha oladi
                          <button onClick={e => { e.stopPropagation(); setCorrecting({ employeeId: r.employee_id, date: dayIso(d) }); }}
                            title="Kelish vaqtini qo'shish (turniket bo'yicha)"
                            className="inline-flex items-center justify-center text-[11px] font-bold opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                            style={{ width: 22, height: 20, borderRadius: 5, border: "1px dashed #6D5DD3", color: "#6D5DD3" }}>
                            +
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 text-xs font-bold whitespace-nowrap" style={{ color: "#0A1629", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                    {fmtHM(r.worked_min)}/{fmtHM(data.working_days * 480)}
                  </td>
                  <td className="text-center py-2 text-xs font-bold whitespace-nowrap" style={{ color: r.late_min > 0 ? "#FF8C42" : "#D9E3F0", background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}>
                    {fmtHM(r.late_min)}
                    {!!r.excused_min && (
                      <div className="text-[9px] font-semibold" style={{ color: "#3F8CFF" }}>+{fmtHM(r.excused_min)} sababli</div>
                    )}
                  </td>
                  <td className="text-center py-2 px-2 whitespace-nowrap" style={{ background: ri % 2 ? "#FFFFFF" : "#FAFCFF" }}
                    title={`Ishda bo'lmagan vaqt: ${fmtHM(r.late_min)} — ${ballRule(r.late_min)}`}>
                    {r.ball != null && (
                      <span className="inline-flex items-baseline gap-0.5 px-2 py-0.5 text-xs font-bold"
                        style={{ color: ballColor(r.ball).color, background: ballColor(r.ball).bg, borderRadius: 6 }}>
                        {r.ball}<span className="text-[9px] font-semibold opacity-70">/{MAX_BALL}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
        {[["8", "Kelgan"], ["X", "Dam olish kuni"], ["MT", "Mehnat ta'tili"], ["O'", "O'quv ta'tili"], ["K", "Xizmat safari"], ["B", "Bolnichniy"], ["BY", "Bayram"]].map(([code, label]) => (
          <span key={code} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
            <span className="inline-flex items-center justify-center text-[9px] font-bold" style={{ width: 18, height: 16, borderRadius: 4, color: CODE_CFG[code]?.color, background: CODE_CFG[code]?.bg }}>
              {code}
            </span>
            {label}
          </span>
        ))}
        {([[LATE_CFG, `${LATE_WARN_MIN} daq gacha kechikkan`], [VERY_LATE_CFG, `${LATE_WARN_MIN} daq dan ko'p kechikkan`]] as const).map(([c, label]) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
            <span className="inline-flex items-center justify-center text-[9px] font-bold" style={{ width: 18, height: 16, borderRadius: 4, color: c.color, background: c.bg }}>
              8
            </span>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#FFBD21" }} />
          Izoh bor
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: OVERRIDE_COLOR }} />
          Kadr tuzatgan
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#91929E" }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#3F8CFF" }} />
          Ariza tasdiqlangan — vaqt qo'shildi
        </span>
        <span className="text-[11px]" style={{ color: "#B8C2D6" }}>
          Kelgan kun ustiga bosing — kelgan vaqti va izohi ko'rinadi{canEdit ? "; xodim ismini bosing — kunlarni tuzatish" : ""}{isSuperadmin ? "; bo'sh kun ustiga kelib «+» — kelish vaqtini qo'shish" : ""}
        </span>
      </div>

      {ballInfoOpen && <BallInfoModal onClose={() => setBallInfoOpen(false)} />}

      {correcting && (
        <CheckInCorrectionModal employeeId={correcting.employeeId} date={correcting.date}
          onClose={() => setCorrecting(null)} onSaved={() => load(year, month)} />
      )}

      {editRow && data && (
        <TabelEditModal
          row={editRow}
          year={year}
          month={month}
          daysInMonth={data.days_in_month}
          holidays={data.holidays}
          onClose={() => setEditRow(null)}
          onSaved={() => load(year, month)}
        />
      )}

      {openCell && (
        <div
          onClick={e => e.stopPropagation()}
          className="fixed z-50 text-left"
          style={{
            left: Math.min(Math.max(openCell.x - 130, 8), window.innerWidth - 268),
            top: openCell.y + 6,
            width: 260,
            background: "#FFFFFF",
            borderRadius: 14,
            boxShadow: "0px 10px 30px rgba(10,22,41,0.15)",
            padding: 14,
          }}>
          <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{openCell.row.full_name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#91929E" }}>
            {String(openCell.day).padStart(2, "0")}.{String(month).padStart(2, "0")}.{year}
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span style={{ color: "#91929E" }}>Kelgan vaqti</span>
            <span className="font-bold" style={{ color: presentCfg(openCell.info).color }}>{openCell.info.check_in ?? "—"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span style={{ color: "#91929E" }}>Kechikish</span>
            <span className="font-bold" style={{ color: presentCfg(openCell.info).color }}>
              {openCell.info.late_min > 0 ? fmtHM(openCell.info.late_min) : "Vaqtida"}
              {openCell.info.excused && " (vaqt qo'shildi)"}
            </span>
          </div>
          {isSuperadmin && (
            <button onClick={() => { setCorrecting({ employeeId: openCell.row.employee_id, date: dayIso(openCell.day) }); setOpenCell(null); }}
              className="w-full mt-3 py-2 text-xs font-bold text-white" style={{ background: "#6D5DD3", borderRadius: 10 }}>
              Kelish vaqtini tuzatish
            </button>
          )}
          {openCell.info.override && (
            <p className="mt-2 text-[11px] font-bold" style={{ color: OVERRIDE_COLOR }}>Kadr qo&apos;lda tuzatgan — 8 soat hisoblangan</p>
          )}
          {openCell.info.note && (
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid #F4F9FD" }}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold" style={{ color: "#0A1629" }}>
                  {NOTE_TYPE_LABEL[openCell.info.note.type] ?? openCell.info.note.type}
                </span>
                <span className="font-bold" style={{ color: NOTE_STATUS[openCell.info.note.status]?.color ?? "#91929E" }}>
                  {NOTE_STATUS[openCell.info.note.status]?.label ?? openCell.info.note.status}
                </span>
              </div>
              <p className="text-xs mt-1 whitespace-pre-wrap break-words" style={{ color: "#7D8592" }}>
                {openCell.info.note.text || "Izoh yozilmagan"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
