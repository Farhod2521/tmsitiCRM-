"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  FileText,
  ChevronLeft, ChevronRight, Calendar, Info, X, Loader2,
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

export default function XodimKpiPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [scores, setScores] = useState<ApiScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiModal, setKpiModal] = useState(false);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<ApiScore[]>(`/ball/my-year?year=${y}`);
      setScores(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(year); }, []); // eslint-disable-line

  function chYear(dir: number) {
    const y = year + dir;
    setYear(y); load(y);
  }

  function total(s: ApiScore) { return (s.bolim_ball ?? 0) + (s.kadr_ball ?? 0) + (s.ijro_edo_ball ?? 0) + (s.ijro_ichki_ball ?? 0); }

  const ratedMonths = scores.filter(s => s.bolim_ball != null || s.kadr_ball != null || s.ijro_edo_ball != null || s.ijro_ichki_ball != null);
  const avgKpiPct = (() => {
    const vals = ratedMonths.map(s => total(s)).filter(t => t > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  })();
  const currentMonthScore = scores.find(s => s.year === now.getFullYear() && s.month === now.getMonth()+1);
  const currentTotal = currentMonthScore ? total(currentMonthScore) : 0;

  // Joriy oy hali baholanmagan bo'lsa ham ro'yxatdan tushib qolmasin —
  // bo'sh (0) halqalar bilan ko'rsatiladi.
  const currentMonthNum = now.getMonth() + 1;
  const isCurrentYearSelected = year === now.getFullYear();
  const hasCurrentMonthInRated = ratedMonths.some(s => s.month === currentMonthNum);
  const displayMonths: ApiScore[] = isCurrentYearSelected && !hasCurrentMonthInRated
    ? [...ratedMonths, { id: -1, employee_id: 0, year, month: currentMonthNum, bolim_ball: null, kadr_ball: null, ijro_edo_ball: null, ijro_ichki_ball: null }]
    : ratedMonths;

  const statCards = [
    { label: "O'rtacha jami ball", value: avgKpiPct != null ? `${avgKpiPct}` : "—", sub: `/${MAX_TOTAL} ball`, img: "/ball.png",          bg: "#E4EFFF" },
    { label: "Baholangan oylar",   value: ratedMonths.length,                       sub: "oy",                 img: "/baholanganoy.png",     bg: "#FFEEDC" },
    { label: "Joriy oy jami",      value: currentTotal>0 ? `${currentTotal}/${MAX_TOTAL}` : "—", sub: "ball",  img: "/joriyoy.png",          bg: "#DCF7EC" },
    { label: "Joriy oy KPI foiz",  value: getKpiLabel(currentTotal>0?currentTotal:null).text, sub: "foiz",     img: "/kpi.png",              bg: "#EAE6FB" },
  ];

  return (
    <div className="relative">
      <Header title="Mening KPI" subtitle="Sizga qo'yilgan ballar va haftalik hisobotlar" />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {statCards.map(s => (
          <div key={s.label} className="flex items-stretch overflow-hidden"
            style={{ background:"#FFFFFF", boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)", borderRadius:20 }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 96, background:s.bg }}>
              <img src={s.img} alt="" className="w-16 h-16 object-contain" />
            </div>
            <div className="min-w-0 flex flex-col justify-center px-4 py-4">
              <p className="text-2xl font-bold leading-tight" style={{ color:"#0A1629" }}>
                {s.value}
                {s.value !== "—" && <span className="text-xs font-normal ml-1" style={{ color:"#A8B0BD" }}>{s.sub}</span>}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color:"#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Oylik ballar ro'yxati ── */}
      <div style={{ background:"#FFFFFF", boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)", borderRadius:24 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom:"1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color:"#0A1629" }}>Oylik ballar</h2>
            <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>Bo'lim, kadr va ijro tomonidan qo'yilgan ballar</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={()=>setKpiModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold hover:opacity-70 transition-opacity" style={{ color:"#6D5DD3" }}>
              <Info size={13}/> KPI foiz jadvali
            </button>
            <div className="flex items-center gap-1 p-1" style={{ background:"#F4F9FD", borderRadius:12 }}>
              <button onClick={()=>chYear(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronLeft size={15} style={{ color:"#3F8CFF" }}/>
              </button>
              <span className="px-3 font-bold text-sm" style={{ color:"#0A1629" }}>{year} yil</span>
              <button onClick={()=>chYear(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronRight size={15} style={{ color:"#3F8CFF" }}/>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={26} className="animate-spin" style={{ color:"#3F8CFF" }}/>
          </div>
        ) : displayMonths.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
              style={{ background:"rgba(63,140,255,0.08)", borderRadius:20 }}>
              <FileText size={30} style={{ color:"#3F8CFF" }}/>
            </div>
            <p className="font-bold text-base" style={{ color:"#0A1629" }}>Hali ball qo'yilmagan</p>
            <p className="text-sm mt-1" style={{ color:"#91929E" }}>{year} yil uchun ma'lumot yo'q</p>
          </div>
        ) : (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...displayMonths].sort((a,b)=>b.month-a.month).map(s => {
              const monName = MON_NAMES[s.month-1];
              const mc = MON_COLORS[monName] ?? { bg:"rgba(63,140,255,0.1)", color:"#3F8CFF" };
              const tot = total(s);
              const kpi = getKpiLabel(tot>0?tot:null);
              return (
                <div key={s.id}
                  className="flex items-center flex-wrap gap-4 sm:gap-6 px-4 sm:px-6 py-5"
                  style={{ background:"#FAFCFF", borderRadius:20, border:"1.5px solid #EEF2FF" }}>

                  <div className="flex flex-col items-center justify-center w-14 h-14 flex-shrink-0"
                    style={{ background:mc.bg, borderRadius:16 }}>
                    <Calendar size={17} style={{ color:mc.color }}/>
                    <p className="text-xs font-bold mt-1" style={{ color:mc.color }}>{monName.slice(0,3)}</p>
                  </div>

                  <div className="w-28 flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color:"#0A1629" }}>{monName}</p>
                    <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>{year} yil</p>
                  </div>

                  <div style={{ width:1, alignSelf:"stretch", background:"#EEF2FF" }} className="hidden sm:block"/>

                  <div className="flex items-start gap-4 sm:gap-6 flex-1 flex-wrap justify-center sm:justify-start">
                    <ScoreRing label="Bo'lim" val={s.bolim_ball ?? 0}      max={MAX_BOLIM}      color="#3F8CFF"/>
                    <ScoreRing label="Kadr"   val={s.kadr_ball ?? 0}       max={MAX_KADR}       color="#FF8C42"/>
                    <ScoreRing label="EDO"    val={s.ijro_edo_ball ?? 0}   max={MAX_IJRO_EDO}   color="#00C48C"/>
                    <ScoreRing label="Ichki"  val={s.ijro_ichki_ball ?? 0} max={MAX_IJRO_ICHKI} color="#15C0E6"/>
                  </div>

                  <div style={{ width:1, alignSelf:"stretch", background:"#EEF2FF" }} className="hidden sm:block"/>

                  <div className="text-center w-24 flex-shrink-0">
                    <p className="text-xs mb-1 font-bold" style={{ color:"#91929E" }}>Jami</p>
                    <p className="font-bold text-2xl leading-none" style={{ color: tot>=70?"#00C48C":tot>=50?"#FFBD21":"#91929E" }}>
                      {tot>0?tot:"—"}
                    </p>
                    {tot>0 && <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>/{MAX_TOTAL}</p>}
                  </div>

                  <div className="text-center w-24 flex-shrink-0">
                    <p className="text-xs mb-1 font-bold" style={{ color:"#91929E" }}>KPI Foiz</p>
                    <span className="px-3 py-1.5 text-sm font-bold inline-block" style={{ background:kpi.bg, color:kpi.color, borderRadius:10 }}>{kpi.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="pb-2"/>
      </div>

      {/* ── Haftalik hisobot yuklash ── */}
      <div className="mt-5">
        <WeeklyReportCard/>
      </div>

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
