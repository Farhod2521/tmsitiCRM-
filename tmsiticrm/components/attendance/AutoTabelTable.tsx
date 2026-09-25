"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Users, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  check_in: string;
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
}
interface AutoTabelData {
  days_in_month: number;
  working_days: number;
  rows: AutoTabelRow[];
}

function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

const CODE_CFG: Record<string, { color: string; bg: string }> = {
  "8":  { color: "#00A578", bg: "rgba(0,196,140,0.1)" },
  "X":  { color: "#B8C2D6", bg: "#F4F9FD" },
  "MT": { color: "#B4780C", bg: "rgba(255,189,33,0.15)" },
  "O'": { color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
  "K":  { color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  "B":  { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  "Д":  { color: "#91929E", bg: "rgba(145,146,158,0.12)" },
};

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
                    <div className="text-[10px] font-bold" style={{ color: "#0A1629" }}>{d}</div>
                    <div className="text-[8px]" style={{ color: "#B8C2D6" }}>{WEEK_DAYS[weekdayOf(year, month, d)]}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 110, background: "#FAFCFF", color: "#91929E" }}>
                  Jami ish soati
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-bold" style={{ minWidth: 90, background: "#FAFCFF", color: "#91929E" }}>
                  Kechikkan vaqti
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
                    {r.full_name}
                  </td>
                  {days.map(d => {
                    const code = r.cells[String(d)] || "";
                    const info = r.day_info?.[String(d)];
                    const cfg = info ? presentCfg(info) : CODE_CFG[code];
                    const isOpen = openCell?.row.employee_id === r.employee_id && openCell.day === d;
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
                    {!!r.excused_min && (
                      <div className="text-[9px] font-semibold" style={{ color: "#3F8CFF" }}>+{fmtHM(r.excused_min)} sababli</div>
                    )}
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
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#3F8CFF" }} />
          Ariza tasdiqlangan — vaqt qo'shildi
        </span>
        <span className="text-[11px]" style={{ color: "#B8C2D6" }}>
          Kelgan kun ustiga bosing — kelgan vaqti va izohi ko'rinadi
        </span>
      </div>

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
            <span className="font-bold" style={{ color: presentCfg(openCell.info).color }}>{openCell.info.check_in}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span style={{ color: "#91929E" }}>Kechikish</span>
            <span className="font-bold" style={{ color: presentCfg(openCell.info).color }}>
              {openCell.info.late_min > 0 ? fmtHM(openCell.info.late_min) : "Vaqtida"}
              {openCell.info.excused && " (vaqt qo'shildi)"}
            </span>
          </div>
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
