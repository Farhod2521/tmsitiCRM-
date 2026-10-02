"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  ChevronLeft, ChevronRight, Info, X, CalendarDays, CheckCircle2, Clock, XCircle, BarChart3,
  ShieldCheck, Users, UserCog, FileCheck2, ClipboardList,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import WeeklyReportCard from "@/components/reports/WeeklyReportCard";

/* ── Constants ── */
const MAX_BOLIM      = 23;
const MAX_KADR       = 25;
const MAX_IJRO_EDO   = 32;
const MAX_IJRO_ICHKI = 20;
const MAX_TOTAL = MAX_BOLIM + MAX_KADR + MAX_IJRO_EDO + MAX_IJRO_ICHKI;

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];
const MON_COLORS: Record<string,{bg:string;color:string}> = {
  Yanvar:{bg:"#E8F4FD",color:"#3F8CFF"}, Fevral:{bg:"#E8F4FD",color:"#3F8CFF"},
  Mart:{bg:"#E8FDF4",color:"#00C48C"},   Aprel:{bg:"#FDF6E8",color:"#FFBD21"},
  May:{bg:"#F0EDFD",color:"#6D5DD3"},    Iyun:{bg:"#E8FAFE",color:"#15C0E6"},
  Iyul:{bg:"#FDE8E8",color:"#FF5C5C"},   Avgust:{bg:"#FDF0E8",color:"#FF8C42"},
  Sentabr:{bg:"#E8F4FD",color:"#3F8CFF"},Oktabr:{bg:"#E8FDF4",color:"#00C48C"},
  Noyabr:{bg:"#FDF6E8",color:"#FFBD21"}, Dekabr:{bg:"#F0EDFD",color:"#6D5DD3"},
};

const KPI_RANGES = [
  { from: 70, to: 75,  foiz: "50%",  color: "#FF5C5C", bg: "rgba(255,92,92,0.10)"  },
  { from: 76, to: 80,  foiz: "75%",  color: "#FF8C42", bg: "rgba(255,140,66,0.12)" },
  { from: 81, to: 85,  foiz: "100%", color: "#FFBD21", bg: "rgba(255,189,33,0.12)" },
  { from: 86, to: 90,  foiz: "125%", color: "#00C48C", bg: "rgba(0,196,140,0.10)"  },
  { from: 91, to: 95,  foiz: "150%", color: "#3F8CFF", bg: "rgba(63,140,255,0.10)" },
  { from: 96, to: 100, foiz: "200%", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
];

/* ── Aylana diagramma (donut) — bitta ball turi uchun ── */
function ScoreRing({ label, val, max, color }: { label: string; val: number | null; max: number; color: string }) {
  const size = 56, stroke = 5, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = val != null ? Math.min(val / max, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5 px-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2FF" strokeWidth={stroke}/>
          {val != null && (
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"
              style={{ transition:"stroke-dasharray 0.5s ease" }}/>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-bold text-sm" style={{ color: val!=null?"#0A1629":"#C4CBD6" }}>{val!=null?val:"—"}</span>
          <span className="text-[9px] mt-0.5" style={{ color:"#A8B0BD" }}>/{max}</span>
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color:"#91929E" }}>{label}</p>
    </div>
  );
}

function getKpiLabel(total: number | null): { text: string; color: string; bg: string } {
  if (total == null) return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
  if (total >= 96)   return { text: "200%", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" };
  if (total >= 91)   return { text: "150%", color: "#3F8CFF", bg: "rgba(63,140,255,0.10)" };
  if (total >= 86)   return { text: "125%", color: "#00C48C", bg: "rgba(0,196,140,0.10)" };
  if (total >= 81)   return { text: "100%", color: "#FFBD21", bg: "rgba(255,189,33,0.12)" };
  if (total >= 76)   return { text: "75%",  color: "#FF8C42", bg: "rgba(255,140,66,0.12)" };
  if (total >= 70)   return { text: "50%",  color: "#FF5C5C", bg: "rgba(255,92,92,0.10)"  };
  return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
}

interface ApiScore {
  id: number; employee_id: number; year: number; month: number;
  bolim_ball: number | null; kadr_ball: number | null;
  ijro_edo_ball: number | null; ijro_ichki_ball: number | null;
}


interface YearStats { year: number; ish_kunlari: number; kelgan: number; kechikkan: number; kelmagan: number; }

/* ── Katta aylana — oy jami bali ── */
function BigRing({ value, max }: { value: number; max: number }) {
  const size = 136, stroke = 12, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF4FF" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3F8CFF" strokeWidth={stroke}
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-3xl font-bold" style={{ color: "#0A1629" }}>{value}</span>
        <span className="text-xs mt-1" style={{ color: "#91929E" }}>/{max}</span>
      </div>
    </div>
  );
}

/* ── Oylar bo'yicha jami ball ustunlari ── */
function MonthBars({ bars, selected, onSelect }: { bars: { m: number; v: number }[]; selected: number; onSelect: (m: number) => void }) {
  const H = 150, ticks = [100, 80, 60, 40, 20, 0];
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[10px] text-right pb-5" style={{ color: "#A8B0BD", height: H + 20 }}>
        {ticks.map(t => <span key={t}>{t}</span>)}
      </div>
      <div className="flex-1 relative" style={{ height: H + 20 }}>
        <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: H }}>
          {ticks.map(t => <div key={t} style={{ borderTop: "1px dashed #EEF2F7" }} />)}
        </div>
        <div className="absolute inset-0 flex items-end justify-between gap-1">
          {bars.map(b => {
            const h = Math.max(b.v > 0 ? 4 : 0, (b.v / 100) * H);
            const active = b.m === selected;
            return (
              <button key={b.m} onClick={() => onSelect(b.m)} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${MON_NAMES[b.m - 1]}: ${b.v}`}>
                {b.v > 0 && <span className="text-[10px] font-bold mb-0.5" style={{ color: active ? "#3F8CFF" : "#7D8592" }}>{b.v}</span>}
                <div className="w-full max-w-[26px] group-hover:opacity-80 transition-all"
                  style={{ height: h, background: active ? "#3F8CFF" : "rgba(63,140,255,0.35)", borderRadius: "6px 6px 0 0" }} />
                <span className="text-[10px] mt-1 h-4" style={{ color: active ? "#0A1629" : "#91929E", fontWeight: active ? 700 : 400 }}>
                  {MON_NAMES[b.m - 1].slice(0, 3)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function XodimKpiPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);   // "Oy natijalari" oyi (standart — joriy oy)
  const [scores, setScores] = useState<ApiScore[]>([]);
  const [stats, setStats]   = useState<YearStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpiModal, setKpiModal] = useState(false);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const [sc, st] = await Promise.all([
        apiFetch<ApiScore[]>(`/ball/my-year?year=${y}`),
        apiFetch<YearStats>(`/attendance/my-year-stats?year=${y}`).catch(() => null),
      ]);
      setScores(sc); setStats(st);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(year); }, []); // eslint-disable-line

  function chYear(y: number) {
    setYear(y);
    setMonth(y === now.getFullYear() ? now.getMonth() + 1 : 12);
    load(y);
  }

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setMonth(m);
    if (y !== year) { setYear(y); load(y); }
  }

  function total(s: ApiScore) { return (s.bolim_ball ?? 0) + (s.kadr_ball ?? 0) + (s.ijro_edo_ball ?? 0) + (s.ijro_ichki_ball ?? 0); }

  const ratedMonths = scores.filter(s => s.bolim_ball != null || s.kadr_ball != null || s.ijro_edo_ball != null || s.ijro_ichki_ball != null);
  const avgTotal = (() => {
    const vals = ratedMonths.map(total).filter(t => t > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();
  const currentMonthScore = scores.find(s => s.year === now.getFullYear() && s.month === now.getMonth() + 1);
  const currentTotal = currentMonthScore ? total(currentMonthScore) : 0;
  const currentKpi = getKpiLabel(currentTotal > 0 ? currentTotal : null);
  const kpiPct = currentKpi.text === "—" ? 0 : Math.min(100, parseInt(currentKpi.text) / 2);   // 200% = to'la chiziq
  const monthsInYear = year === now.getFullYear() ? now.getMonth() + 1 : 12;

  const sel = scores.find(s => s.month === month);
  const selTotal = sel ? total(sel) : 0;

  const statCards = [
    { label: "O'rtacha jami ball", value: avgTotal != null ? `${avgTotal}` : "—", sub: `/${MAX_TOTAL} ball`, img: "/ball.png", bg: "#E4EFFF", bar: "#3F8CFF", pct: avgTotal ?? 0 },
    { label: "Baholangan oylar", value: `${ratedMonths.length}`, sub: "oy", img: "/baholanganoy.png", bg: "#FFEEDC", bar: "#FF8C42", pct: Math.round(ratedMonths.length / monthsInYear * 100) },
    { label: "Joriy oy jami", value: currentTotal > 0 ? `${currentTotal}/${MAX_TOTAL}` : "—", sub: "ball", img: "/joriyoy.png", bg: "#DCF7EC", bar: "#00C48C", pct: currentTotal },
    { label: "Joriy oy KPI foiz", value: currentKpi.text, sub: "", img: "/kpi.png", bg: "#EAE6FB", bar: "#6D5DD3", pct: kpiPct, pctLabel: currentKpi.text === "—" ? "0%" : currentKpi.text },
  ];

  const parts = [
    { key: "bolim", label: "Bo'lim", val: sel?.bolim_ball ?? null, max: MAX_BOLIM, color: "#3F8CFF", icon: Users },
    { key: "kadr", label: "Kadr", val: sel?.kadr_ball ?? null, max: MAX_KADR, color: "#FF8C42", icon: UserCog },
    { key: "edo", label: "EDO", val: sel?.ijro_edo_ball ?? null, max: MAX_IJRO_EDO, color: "#00C48C", icon: FileCheck2 },
    { key: "ichki", label: "Ichki", val: sel?.ijro_ichki_ball ?? null, max: MAX_IJRO_ICHKI, color: "#15C0E6", icon: ClipboardList },
  ];

  const statTiles = [
    { label: "Ish kunlari", value: stats?.ish_kunlari, icon: CalendarDays, color: "#00C48C", bg: "rgba(0,196,140,0.12)" },
    { label: "Ishga kelgan", value: stats?.kelgan, icon: CheckCircle2, color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
    { label: "Kechikishlar", value: stats?.kechikkan, icon: Clock, color: "#FF8C42", bg: "rgba(255,140,66,0.14)" },
    { label: "Kelmagan", value: stats?.kelmagan, icon: XCircle, color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  ];

  const bars = Array.from({ length: 12 }, (_, i) => {
    const s = scores.find(x => x.month === i + 1);
    return { m: i + 1, v: s ? total(s) : 0 };
  });

  const card = { background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 } as const;
  const yearOptions = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="relative">
      <Header title="Mening KPI" subtitle="Sizga qo'yilgan ballar va oylik hisobot" />

      {/* ── 1. Stat kartalar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {statCards.map(s => (
          <div key={s.label} className="px-5 pt-5 pb-4" style={{ background: s.bg, borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
            <div className="flex items-center gap-4">
              <img src={s.img} alt="" className="w-16 h-16 object-contain flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight" style={{ color: "#0A1629" }}>
                  {s.value}
                  {s.value !== "—" && s.sub && <span className="text-xs font-normal ml-1" style={{ color: "#5B6472" }}>{s.sub}</span>}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "#5B6472" }}>{s.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.75)", borderRadius: 6 }}>
                <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, background: s.bar, borderRadius: 6, transition: "width .5s" }} />
              </div>
              <span className="text-xs font-bold" style={{ color: "#0A1629", minWidth: 34, textAlign: "right" }}>{s.pctLabel ?? `${Math.round(s.pct)}%`}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. Statistika / Oy natijalari / KPI jadvali ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.15fr] gap-4 mb-5">
        {/* Umumiy statistika */}
        <div className="p-5" style={card}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                <CalendarDays size={18} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <p className="font-bold" style={{ color: "#0A1629" }}>Umumiy statistika</p>
                <p className="text-xs" style={{ color: "#91929E" }}>Davomat — {year} yil bo&apos;yicha</p>
              </div>
            </div>
            <select value={year} onChange={e => chYear(Number(e.target.value))}
              className="px-3 py-2 text-sm font-bold outline-none" style={{ background: "#F4F9FD", borderRadius: 10, color: "#0A1629" }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statTiles.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="flex items-center gap-3 p-3" style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: t.bg, borderRadius: 12 }}>
                    <Icon size={18} style={{ color: t.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#0A1629" }}>{loading ? "…" : (t.value ?? "—")}</p>
                    <p className="text-[11px] truncate" style={{ color: "#7D8592" }}>{t.label}</p>
                  </div>
                  <BarChart3 size={18} style={{ color: t.color, opacity: 0.55 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Oy natijalari */}
        <div className="p-5" style={card}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                <ShieldCheck size={18} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <p className="font-bold" style={{ color: "#0A1629" }}>Oy natijalari</p>
                <p className="text-xs" style={{ color: "#91929E" }}>{MON_NAMES[month - 1]} {year}</p>
              </div>
            </div>
            <div className="flex items-center" style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center"><ChevronLeft size={15} style={{ color: "#3F8CFF" }} /></button>
              <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center"><ChevronRight size={15} style={{ color: "#3F8CFF" }} /></button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <BigRing value={selTotal} max={MAX_TOTAL} />
            <div className="flex-1 flex flex-col gap-1.5 pl-3" style={{ borderLeft: "1px solid #F0F3F8" }}>
              {parts.map(p => {
                const Icon = p.icon;
                const full = p.val != null && p.val >= p.max;
                return (
                  <div key={p.key} className="flex items-center justify-between gap-2 px-2.5 py-2"
                    style={{ background: full ? "rgba(255,140,66,0.08)" : "#FAFCFF", borderRadius: 10 }}>
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#0A1629" }}>
                      <Icon size={15} style={{ color: p.color }} /> {p.label}
                    </span>
                    <span className="text-sm font-bold" style={{ color: full ? p.color : "#0A1629" }}>
                      {p.val ?? 0}<span style={{ color: full ? p.color : "#91929E" }}>/{p.max}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* KPI foiz jadvali */}
        <div className="p-5 lg:col-span-2 2xl:col-span-1" style={card}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                <BarChart3 size={18} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <p className="font-bold flex items-center gap-1.5" style={{ color: "#0A1629" }}>
                  KPI foiz jadvali
                  <button onClick={() => setKpiModal(true)} title="Ball oralig'iga qarab KPI ulushi"><Info size={14} style={{ color: "#6D5DD3" }} /></button>
                </p>
                <p className="text-xs" style={{ color: "#91929E" }}>Oylar bo&apos;yicha jami ball · ustunni bosing</p>
              </div>
            </div>
            <select value={year} onChange={e => chYear(Number(e.target.value))}
              className="px-3 py-2 text-sm font-bold outline-none" style={{ background: "#F4F9FD", borderRadius: 10, color: "#0A1629" }}>
              {yearOptions.map(y => <option key={y} value={y}>{y} yil</option>)}
            </select>
          </div>
          <MonthBars bars={bars} selected={month} onSelect={setMonth} />
        </div>
      </div>

      {/* ── 3. Hisobot ── */}
      <WeeklyReportCard />

      {/* ── KPI Foiz modal ── */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background:"rgba(10,22,41,0.45)" }} onClick={()=>setKpiModal(false)}>
          <div className="relative flex flex-col gap-0 overflow-hidden"
            style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0px 20px 60px rgba(10,22,41,0.25)", minWidth:320 }}
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:"1px solid #F4F9FD" }}>
              <div>
                <p className="font-bold text-sm" style={{ color:"#0A1629" }}>KPI Foiz Jadval</p>
                <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>Ball oralig'iga qarab KPI ulushi</p>
              </div>
              <button onClick={()=>setKpiModal(false)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors">
                <X size={15} style={{ color:"#91929E" }}/>
              </button>
            </div>
            <div className="flex flex-col gap-0">
              {KPI_RANGES.map((r,i)=>(
                <div key={i} className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: i<KPI_RANGES.length-1?"1px solid #F4F9FD":"none" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background:r.color }}/>
                    <span className="text-sm font-medium" style={{ color:"#0A1629" }}>{r.from} – {r.to} ball</span>
                  </div>
                  <span className="px-3 py-1 text-sm font-bold" style={{ background:r.bg, color:r.color, borderRadius:8 }}>{r.foiz}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3" style={{ background:"#F8FAFF", borderTop:"1px solid #F4F9FD" }}>
              <p className="text-xs" style={{ color:"#91929E" }}>70 balldan past — KPI hisoblanmaydi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
