"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  Target, FileText, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Calendar, Info, X, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import WeeklyReportCard from "@/components/reports/WeeklyReportCard";

/* ── Constants ── */
const MAX_BOLIM = 65;
const MAX_KADR  = 25;
const MAX_IJRO  = 10;
const MAX_TOTAL = MAX_BOLIM + MAX_KADR + MAX_IJRO;

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
  bolim_ball: number | null; kadr_ball: number | null; ijro_ball: number | null;
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

  function total(s: ApiScore) { return (s.bolim_ball ?? 0) + (s.kadr_ball ?? 0) + (s.ijro_ball ?? 0); }

  const ratedMonths = scores.filter(s => s.bolim_ball != null || s.kadr_ball != null || s.ijro_ball != null);
  const avgKpiPct = (() => {
    const vals = ratedMonths.map(s => total(s)).filter(t => t > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  })();
  const currentMonthScore = scores.find(s => s.year === now.getFullYear() && s.month === now.getMonth()+1);
  const currentTotal = currentMonthScore ? total(currentMonthScore) : 0;

  const statCards = [
    { label: "O'rtacha jami ball", value: avgKpiPct != null ? `${avgKpiPct}` : "—", icon: Target,        color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
    { label: "Baholangan oylar",   value: ratedMonths.length,                       icon: FileText,      color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
    { label: "Joriy oy jami",      value: currentTotal>0 ? `${currentTotal}/${MAX_TOTAL}` : "—", icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
    { label: "Joriy oy KPI foiz",  value: getKpiLabel(currentTotal>0?currentTotal:null).text, icon: Clock, color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
  ];

  return (
    <div className="relative">
      <Header title="Mening KPI" subtitle="Sizga qo'yilgan ballar va haftalik hisobotlar" />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {statCards.map(s => (
          <div key={s.label} className="p-5 flex items-center gap-4"
            style={{ background:"#FFFFFF", boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)", borderRadius:20 }}>
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background:s.bg, borderRadius:13 }}>
              <s.icon size={20} style={{ color:s.color }}/>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight" style={{ color:"#0A1629" }}>{s.value}</p>
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
        ) : ratedMonths.length === 0 ? (
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
            {[...ratedMonths].sort((a,b)=>b.month-a.month).map(s => {
              const monName = MON_NAMES[s.month-1];
              const mc = MON_COLORS[monName] ?? { bg:"rgba(63,140,255,0.1)", color:"#3F8CFF" };
              const tot = total(s);
              const kpi = getKpiLabel(tot>0?tot:null);
              return (
                <div key={s.id}
                  className="flex items-center flex-wrap gap-3 sm:gap-5 px-4 sm:px-5 py-4"
                  style={{ background:"#FAFCFF", borderRadius:18, border:"1.5px solid #EEF2FF" }}>

                  <div className="flex flex-col items-center justify-center w-14 h-14 flex-shrink-0"
                    style={{ background:mc.bg, borderRadius:16 }}>
                    <Calendar size={17} style={{ color:mc.color }}/>
                    <p className="text-xs font-bold mt-1" style={{ color:mc.color }}>{monName.slice(0,3)}</p>
                  </div>

                  <div className="w-28 flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color:"#0A1629" }}>{monName}</p>
                    <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>{year} yil</p>
                  </div>

                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {[
                      { label:"Bo'lim", val:s.bolim_ball, max:MAX_BOLIM, color:"#3F8CFF" },
                      { label:"Kadr",   val:s.kadr_ball,  max:MAX_KADR,  color:"#FF8C42" },
                      { label:"Ijro",   val:s.ijro_ball,  max:MAX_IJRO,  color:"#00C48C" },
                    ].map(b => (
                      <div key={b.label} className="text-center px-2">
                        <p className="text-xs mb-0.5" style={{ color:"#91929E" }}>{b.label}</p>
                        <p className="font-bold text-sm" style={{ color: b.val!=null?b.color:"#C4CBD6" }}>
                          {b.val!=null?b.val:"—"}
                          <span className="text-xs font-normal" style={{ color:"#D0D5DD" }}>/{b.max}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="text-center w-20 flex-shrink-0">
                    <p className="text-xs mb-0.5" style={{ color:"#91929E" }}>Jami</p>
                    <p className="font-bold text-xl" style={{ color: tot>=70?"#00C48C":tot>=50?"#FFBD21":"#91929E" }}>
                      {tot>0?tot:"—"}
                    </p>
                    {tot>0 && <p className="text-xs" style={{ color:"#91929E" }}>/{MAX_TOTAL}</p>}
                  </div>

                  <div className="text-center w-20 flex-shrink-0">
                    <p className="text-xs mb-0.5" style={{ color:"#91929E" }}>KPI Foiz</p>
                    <span className="px-2.5 py-1 text-xs font-bold inline-block" style={{ background:kpi.bg, color:kpi.color, borderRadius:8 }}>{kpi.text}</span>
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
