"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  ChevronLeft, ChevronRight, ClipboardCheck, Loader2, X, Info, Users, UserCog, FileCheck2, ClipboardList,
  FileText, BarChart3, Clock, ArrowRight, ShieldCheck, CalendarDays, CheckCircle2, XCircle, Search, Activity,
  Upload, Trophy,
} from "lucide-react";
import { fmtDateTimeUz } from "@/lib/datetime";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import WeeklyReportReviewModal, { WeekRow } from "@/components/reports/WeeklyReportReviewModal";
import WeeklyReportCard from "@/components/reports/WeeklyReportCard";

/* ── Constants ── */
const MAX_BOLIM      = 23;
const MAX_KADR       = 25;
const MAX_IJRO_EDO   = 32;
const MAX_IJRO_ICHKI = 20;
const MAX_TOTAL      = MAX_BOLIM + MAX_KADR + MAX_IJRO_EDO + MAX_IJRO_ICHKI;

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

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];

const AVATAR_COLORS = ["#3F8CFF","#6D5DD3","#00C48C","#FFBD21","#FF5C5C","#15C0E6","#FF8C42"];

/* ── Types ── */
interface ApiEmp   { id:number; full_name:string; position:string; role:string; is_active:boolean; }
interface ApiScore {
  id:number; employee_id:number; year:number; month:number;
  bolim_ball:number|null; kadr_ball:number|null; direktor_ball:number|null;
  ijro_edo_ball:number|null; ijro_ichki_ball:number|null;
}
interface ApiTeamRow {
  employee_id: number; full_name: string; position: string;
  department_name: string | null; weeks: WeekRow[]; bolim_ball: number | null;
}
interface Row {
  id:number; name:string; position:string; role:string; avatar:string; color:string;
  isSelf:boolean;
  bolimBall:number|null; kadrBall:number|null; direktorBall:number|null;
  ijroEdoBall:number|null; ijroIchkiBall:number|null;
  weeks: WeekRow[];
}

function mkAvatar(n:string){ return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2); }
function rowTotal(r:Row){ return (r.bolimBall??0)+(r.kadrBall??0)+(r.ijroEdoBall??0)+(r.ijroIchkiBall??0); }
function getStatus(r:Row):"Baholangan"|"Qisman"|"Kutilmoqda"{
  const cnt=[r.bolimBall,r.kadrBall,r.ijroEdoBall,r.ijroIchkiBall].filter(v=>v!=null).length;
  return cnt===4?"Baholangan":cnt>0?"Qisman":"Kutilmoqda";
}
const statusVariant: Record<string,"success"|"warning"|"danger"> = {
  Baholangan:"success", Qisman:"warning", Kutilmoqda:"danger",
};

/* ── ScoreCircle ── */
function ScoreCircle({ val, max, color }:{val:number|null;max:number;color:string}){
  const size=48, stroke=4, r=(size-stroke)/2, circ=2*Math.PI*r;
  const pct=val!=null?Math.min(val/max,1):0;
  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{width:size,height:size}}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2FF" strokeWidth={stroke}/>
          {val!=null&&(
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"
              style={{transition:"stroke-dasharray 0.4s ease"}}/>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-bold text-sm" style={{color:val!=null?"#0A1629":"#C4CBD6"}}>{val!=null?val:"—"}</span>
          <span className="text-[9px]" style={{color:"#A8B0BD"}}>/{max}</span>
        </div>
      </div>
    </div>
  );
}


const PAGE = 10;
interface YearStats { year: number; ish_kunlari: number; kelgan: number; kechikkan: number; kelmagan: number; }

function CardTitle({ icon: Icon, title, sub, extra }: { icon: typeof Users; title: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
        <Icon size={18} style={{ color: "#3F8CFF" }} />
      </div>
      <div className="min-w-0">
        <p className="font-bold flex items-center gap-1.5" style={{ color: "#0A1629" }}>{title}{extra}</p>
        {sub && <p className="text-xs truncate" style={{ color: "#91929E" }}>{sub}</p>}
      </div>
    </div>
  );
}

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

/* Xodimlar jami bali — ustunli grafik */
function EmpBars({ bars }: { bars: { id: number; label: string; v: number; color: string }[] }) {
  const H = 150, ticks = [100, 80, 60, 40, 20, 0];
  if (!bars.length) return <p className="text-sm text-center py-14" style={{ color: "#91929E" }}>Bo&apos;limda xodim yo&apos;q</p>;
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[10px] text-right pb-5" style={{ color: "#A8B0BD", height: H + 20 }}>
        {ticks.map(t => <span key={t}>{t}</span>)}
      </div>
      <div className="flex-1 relative overflow-x-auto" style={{ height: H + 20 }}>
        <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: H }}>
          {ticks.map(t => <div key={t} style={{ borderTop: "1px dashed #EEF2F7" }} />)}
        </div>
        <div className="absolute inset-0 flex items-end justify-around gap-2" style={{ minWidth: bars.length * 34 }}>
          {bars.map(b => (
            <div key={b.id} className="flex-1 flex flex-col items-center justify-end h-full" style={{ maxWidth: 70 }} title={`${b.label}: ${b.v}`}>
              <span className="text-[11px] font-bold mb-0.5" style={{ color: b.v ? "#3F8CFF" : "#A8B0BD" }}>{b.v}</span>
              <div className="w-full max-w-[42px]" style={{ height: Math.max(b.v ? 4 : 2, (b.v / 100) * H), background: b.v ? "#5B9DFF" : "#E4EAF2", borderRadius: "6px 6px 0 0" }} />
              <span className="text-[10px] mt-1 h-4 truncate w-full text-center" style={{ color: "#7D8592" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function BolimKpiPage() {
  const now   = new Date();
  const me    = getUser();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);


  /* ── TAB 1: Ball berish ── */
  const [rows,     setRows]     = useState<Row[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<YearStats | null>(null);
  useEffect(() => {
    apiFetch<YearStats>(`/attendance/my-year-stats?year=${statsYear}`).then(setStats).catch(() => setStats(null));
  }, [statsYear]);
  const [kpiModal, setKpiModal] = useState(false);

  /* ── Hisobot review modal (xodimlar) / self upload modal ── */
  const [reviewTarget, setReviewTarget] = useState<Row|null>(null);

  /* ─── Load TAB1 data ─── */
  const loadBall = useCallback(async(y:number,m:number)=>{
    setLoading(true);
    try {
      const [emps, scores, team, mine] = await Promise.all([
        apiFetch<ApiEmp[]>("/employees/"),
        apiFetch<ApiScore[]>(`/ball/month?year=${y}&month=${m}`),
        apiFetch<ApiTeamRow[]>(`/reports/weekly/team?year=${y}&month=${m}`),
        apiFetch<WeekRow[]>(`/reports/weekly/mine?year=${y}&month=${m}`),
      ]);
      const sm = new Map(scores.map(s=>[s.employee_id,s]));
      const wm = new Map(team.map(t=>[t.employee_id,t.weeks]));
      const activeEmps = emps.filter(e=>e.is_active||e.id===me?.id);
      const next:Row[] = activeEmps.map((e,i)=>({
        id:e.id, name:e.full_name, position:e.position, role:e.role,
        avatar:mkAvatar(e.full_name), color:AVATAR_COLORS[i%AVATAR_COLORS.length],
        isSelf:e.id===me?.id,
        bolimBall:    sm.get(e.id)?.bolim_ball      ??null,
        kadrBall:     sm.get(e.id)?.kadr_ball       ??null,
        direktorBall: sm.get(e.id)?.direktor_ball   ??null,
        ijroEdoBall:  sm.get(e.id)?.ijro_edo_ball   ??null,
        ijroIchkiBall:sm.get(e.id)?.ijro_ichki_ball ??null,
        weeks: e.id===me?.id ? mine : (wm.get(e.id) ?? []),
      }));
      setRows(next);
      return next;
    } catch(e){console.error(e); return [];}
    finally{setLoading(false);}
  },[me?.id]);

  useEffect(()=>{ loadBall(year,month); },[]);// eslint-disable-line

  async function refreshAfterScore(){
    const next = await loadBall(year,month);
    setReviewTarget(prev => prev ? next.find(r=>r.id===prev.id) ?? null : null);
  }

  /* ── Derived ── */
  const selfRow        = rows.find(r=>r.isSelf);
  const empRows        = rows.filter(r=>!r.isSelf);
  const empRowsRated   = empRows.filter(r=>getStatus(r)==="Baholangan").length;
  const withReport     = empRows.filter(r=>r.weeks.some(w=>w.id>0)).length;
  const pendingReports = empRows.reduce((n,r)=>n+r.weeks.filter(w=>w.id>0&&!w.confirmed_at).length,0);

  const q = search.trim().toLowerCase();
  const filtered = [...(selfRow?[selfRow]:[]), ...empRows].filter(r =>
    (!q || r.name.toLowerCase().includes(q)) &&
    (!statusFilter || (statusFilter==="pending" ? r.weeks.some(w=>w.id>0&&!w.confirmed_at) : getStatus(r)===statusFilter)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page-1)*PAGE, page*PAGE);

  // Oxirgi faoliyatlar — xodimlar hisobotlaridan (yuklandi / baholandi)
  const activity = rows.flatMap(r => r.weeks.flatMap(w => {
    const ev: { at: string; kind: "upload"|"score"; title: string; who: string }[] = [];
    if (w.id>0 && w.uploaded_at) ev.push({ at: w.uploaded_at, kind: "upload", title: "Hisobot yuklandi", who: r.isSelf ? `${r.name} (o'zingiz)` : r.name });
    if (w.confirmed_at) ev.push({ at: w.confirmed_at, kind: "score", title: `Hisobot baholandi — ${w.ball ?? 0}/${w.max_ball ?? MAX_BOLIM}`, who: r.name });
    return ev;
  })).sort((a,b)=>b.at.localeCompare(a.at)).slice(0, showAllActivity ? 30 : 5);

  const bars = empRows.map(r=>({ id:r.id, label:r.name.split(" ")[0], v:rowTotal(r), color:r.color }));
  const card = {background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24} as const;
  const monthOptions = Array.from({length:12},(_,i)=>{ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); return {y:d.getFullYear(), m:d.getMonth()+1}; });

  function goTable(status: string = "") {
    setStatusFilter(status); setPage(1);
    document.getElementById("bb-xodimlar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const selfParts = [
    { label:"Bo'lim", val:selfRow?.bolimBall??null, max:MAX_BOLIM, color:"#3F8CFF", icon:Users },
    { label:"Kadr", val:selfRow?.kadrBall??null, max:MAX_KADR, color:"#FF8C42", icon:UserCog },
    { label:"EDO", val:selfRow?.ijroEdoBall??null, max:MAX_IJRO_EDO, color:"#00C48C", icon:FileCheck2 },
    { label:"Ichki", val:selfRow?.ijroIchkiBall??null, max:MAX_IJRO_ICHKI, color:"#15C0E6", icon:ClipboardList },
  ];
  const statTiles = [
    { label:"Ish kunlari", value:stats?.ish_kunlari, icon:CalendarDays, color:"#00C48C", bg:"rgba(0,196,140,0.12)" },
    { label:"Ishga kelgan", value:stats?.kelgan, icon:CheckCircle2, color:"#3F8CFF", bg:"rgba(63,140,255,0.12)" },
    { label:"Kechikishlar", value:stats?.kechikkan, icon:Clock, color:"#FF8C42", bg:"rgba(255,140,66,0.14)" },
    { label:"Kelmagan", value:stats?.kelmagan, icon:XCircle, color:"#FF5C5C", bg:"rgba(255,92,92,0.12)" },
  ];

  /* ════════════════════════════════════════════════ RENDER ══ */
  return (
    <div className="relative">
      <Header title="Mening KPI" subtitle="Bo'lim faoliyati bo'yicha umumiy ko'rsatkichlar va hisobotlar" />

      {/* ── 1. Stat kartalar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          {label:"Jami xodimlar",    value:empRows.length, img:"/ball.png",         bg:"#E4EFFF", color:"#3F8CFF", icon:Users,      link:"Xodimlarni ko'rish",    on:()=>goTable("")},
          {label:"Hisobot yuklangan",value:withReport,     img:"/joriyoy.png",      bg:"#DCF7EC", color:"#00A578", icon:FileText,   link:"Hisobotlarni ko'rish",  on:()=>goTable("")},
          {label:"Baholangan",       value:empRowsRated,   img:"/baholanganoy.png", bg:"#FFEEDC", color:"#E07A1F", icon:BarChart3,  link:"Baholash",              on:()=>goTable("Baholangan")},
          {label:"Kutilmoqda",       value:pendingReports, img:"/kpi.png",          bg:"#EAE6FB", color:"#6D5DD3", icon:Clock,      link:"Kutilayotganlar",       on:()=>goTable("pending")},
        ].map(s=>{ const Icon=s.icon; return (
          <div key={s.label} className="relative flex items-center gap-4 px-5 py-5" style={{background:s.bg,borderRadius:20,boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)"}}>
            <img src={s.img} alt="" className="w-16 h-16 object-contain flex-shrink-0"/>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight" style={{color:"#0A1629"}}>{loading?"…":s.value}</p>
              <p className="text-xs mt-0.5" style={{color:"#5B6472"}}>{s.label}</p>
              <button onClick={s.on} className="flex items-center gap-1 text-xs font-bold mt-2 hover:underline" style={{color:s.color}}>
                {s.link} <ArrowRight size={13}/>
              </button>
            </div>
            <div className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center" style={{background:"rgba(255,255,255,0.65)",borderRadius:10}}>
              <Icon size={17} style={{color:s.color}}/>
            </div>
          </div>
        );})}
      </div>

      {/* ── 2. KPI jadvali / O'z natijam / Statistika ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-[1.25fr_1fr_1fr] gap-4 mb-5">
        <div className="p-5 lg:col-span-2 2xl:col-span-1" style={card}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <CardTitle icon={BarChart3} title="KPI foiz jadvali" sub="Xodimlar jami bali · tanlangan oy"
              extra={<button onClick={()=>setKpiModal(true)} title="Ball oralig'iga qarab KPI ulushi"><Info size={14} style={{color:"#6D5DD3"}}/></button>}/>
            <select value={`${year}-${month}`} onChange={e=>{ const [y,m]=e.target.value.split("-").map(Number); setYear(y); setMonth(m); setPage(1); loadBall(y,m); }}
              className="px-3 py-2 text-sm font-bold outline-none" style={{background:"#F4F9FD",borderRadius:10,color:"#0A1629"}}>
              {monthOptions.map(o=><option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{MON_NAMES[o.m-1]} {o.y}</option>)}
            </select>
          </div>
          <EmpBars bars={bars}/>
        </div>

        <div className="p-5" style={card}>
          <CardTitle icon={ShieldCheck} title="Mening oy natijam" sub={`${MON_NAMES[month-1]} ${year}`}/>
          <div className="flex items-center gap-4 mt-4">
            <BigRing value={selfRow?rowTotal(selfRow):0} max={MAX_TOTAL}/>
            <div className="flex-1 flex flex-col gap-1.5 pl-3" style={{borderLeft:"1px solid #F0F3F8"}}>
              {selfParts.map(p=>{ const Icon=p.icon; const full=p.val!=null&&p.val>=p.max; return (
                <div key={p.label} className="flex items-center justify-between gap-2 px-2.5 py-2" style={{background:full?"rgba(255,140,66,0.08)":"#FAFCFF",borderRadius:10}}>
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{color:"#0A1629"}}><Icon size={15} style={{color:p.color}}/> {p.label}</span>
                  <span className="text-sm font-bold" style={{color:full?p.color:"#0A1629"}}>{p.val??0}<span style={{color:full?p.color:"#91929E"}}>/{p.max}</span></span>
                </div>
              );})}
            </div>
          </div>
        </div>

        <div className="p-5" style={card}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <CardTitle icon={CalendarDays} title="Umumiy statistika" sub={`Mening davomatim — ${statsYear}`}/>
            <select value={statsYear} onChange={e=>setStatsYear(Number(e.target.value))}
              className="px-3 py-2 text-sm font-bold outline-none" style={{background:"#F4F9FD",borderRadius:10,color:"#0A1629"}}>
              {[now.getFullYear()-1, now.getFullYear()].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statTiles.map(t=>{ const Icon=t.icon; return (
              <div key={t.label} className="flex items-center gap-3 p-3" style={{background:"#FAFCFF",borderRadius:14,border:"1px solid #F0F3F8"}}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{background:t.bg,borderRadius:12}}><Icon size={18} style={{color:t.color}}/></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold leading-tight" style={{color:"#0A1629"}}>{t.value ?? "—"}</p>
                  <p className="text-[11px] truncate" style={{color:"#7D8592"}}>{t.label}</p>
                </div>
              </div>
            );})}
          </div>
        </div>
      </div>

      {/* ── 3. Xodimlar jadvali / Oxirgi faoliyatlar ── */}
      <div id="bb-xodimlar" className="grid grid-cols-1 2xl:grid-cols-[1fr_360px] gap-4 mb-5 scroll-mt-4">
        <div className="min-w-0" style={card}>
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4" style={{borderBottom:"1px solid #F4F9FD"}}>
            <CardTitle icon={FileText} title="Xodimlar bo'yicha ma'lumot" sub={`${MON_NAMES[month-1]} ${year} · ball berish va hisobot tasdiqlash`}/>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2" style={{border:"1px solid #D9E3F0",borderRadius:10,minWidth:190}}>
                <Search size={14} style={{color:"#91929E"}}/>
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Xodimni qidirish..." className="bg-transparent outline-none text-sm flex-1 min-w-0"/>
              </div>
              <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}
                className="px-3 py-2 text-sm outline-none bg-white" style={{border:"1px solid #D9E3F0",borderRadius:10,color:"#0A1629"}}>
                <option value="">Barcha holatlar</option>
                <option value="Baholangan">Baholangan</option>
                <option value="Qisman">Qisman</option>
                <option value="Kutilmoqda">Kutilmoqda</option>
                <option value="pending">Hisoboti tekshirilmagan</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={26} className="animate-spin" style={{color:"#3F8CFF"}}/></div>
          ) : (
            <div className="overflow-x-auto px-3 py-2">
              <table className="w-full text-sm" style={{minWidth:900}}>
                <thead>
                  <tr className="text-[11px] font-bold uppercase" style={{color:"#91929E"}}>
                    <th className="text-left px-2 py-2.5">#</th>
                    <th className="text-left px-2 py-2.5">Xodim</th>
                    <th className="px-1 py-2.5">Bo&apos;lim</th>
                    <th className="px-1 py-2.5">Kadr</th>
                    <th className="px-1 py-2.5">EDO</th>
                    <th className="px-1 py-2.5">Ichki</th>
                    <th className="px-1 py-2.5">Jami</th>
                    <th className="px-1 py-2.5"><span className="inline-flex items-center gap-1">KPI foiz <button onClick={()=>setKpiModal(true)}><Info size={12} style={{color:"#6D5DD3"}}/></button></span></th>
                    <th className="px-1 py-2.5">Holat</th>
                    <th className="text-right px-2 py-2.5">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r,i)=>{
                    const tot=rowTotal(r); const kpi=getKpiLabel(tot>0?tot:null); const st=getStatus(r);
                    const pending=r.weeks.filter(w=>w.id>0&&!w.confirmed_at).length;
                    return (
                      <tr key={r.id} className="hover:bg-[#FAFCFF]" style={{borderTop:"1px solid #F4F9FD",background:r.isSelf?"rgba(63,140,255,0.03)":undefined}}>
                        <td className="px-2 py-2.5 text-xs" style={{color:"#91929E"}}>{(page-1)*PAGE+i+1}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:r.color,borderRadius:10}}>{r.avatar}</div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate" style={{color:"#0A1629"}}>{r.name}</p>
                              <p className="text-[11px] truncate" style={{color:r.isSelf?"#3F8CFF":"#91929E",fontWeight:r.isSelf?700:400}}>{r.isSelf?"O'zingiz":r.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2"><ScoreCircle val={r.bolimBall} max={MAX_BOLIM} color="#3F8CFF"/></td>
                        <td className="py-2"><ScoreCircle val={r.kadrBall} max={MAX_KADR} color="#FF8C42"/></td>
                        <td className="py-2"><ScoreCircle val={r.ijroEdoBall} max={MAX_IJRO_EDO} color="#00C48C"/></td>
                        <td className="py-2"><ScoreCircle val={r.ijroIchkiBall} max={MAX_IJRO_ICHKI} color="#15C0E6"/></td>
                        <td className="text-center font-bold" style={{color:tot>=70?"#00A578":tot>0?"#0A1629":"#C4CBD6"}}>{tot>0?tot:"—"}</td>
                        <td className="text-center"><span className="px-2 py-1 text-xs font-bold" style={{background:kpi.bg,color:kpi.color,borderRadius:8}}>{kpi.text}</span></td>
                        <td className="text-center"><Badge label={st} variant={statusVariant[st]}/></td>
                        <td className="px-2 text-right">
                          {r.isSelf ? (
                            <button onClick={()=>document.getElementById("bb-hisobotim")?.scrollIntoView({behavior:"smooth"})}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{background:"rgba(63,140,255,0.1)",borderRadius:10,color:"#3F8CFF"}}>
                              <ClipboardCheck size={13}/> Hisobotim
                            </button>
                          ) : (
                            <button onClick={()=>setReviewTarget(r)}
                              className="relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{background:"rgba(63,140,255,0.1)",borderRadius:10,color:"#3F8CFF"}}>
                              <ClipboardCheck size={13}/> Hisobot
                              {pending>0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white" style={{background:"#FF5C5C",borderRadius:"50%"}}>{pending}</span>}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length===0 && (
                    <tr><td colSpan={10} className="text-center py-10 text-sm" style={{color:"#91929E"}}>Xodim topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3" style={{borderTop:"1px solid #F4F9FD"}}>
            <span className="text-xs" style={{color:"#7D8592"}}>Jami: {filtered.length} ta xodim</span>
            <div className="flex items-center gap-1">
              <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="w-8 h-8 flex items-center justify-center disabled:opacity-40" style={{background:"#F4F9FD",borderRadius:8}}><ChevronLeft size={14} style={{color:"#3F8CFF"}}/></button>
              {Array.from({length:pages},(_,i)=>i+1).map(n=>(
                <button key={n} onClick={()=>setPage(n)} className="w-8 h-8 text-xs font-bold" style={{background:n===page?"#3F8CFF":"#F4F9FD",color:n===page?"#FFFFFF":"#3D4557",borderRadius:8}}>{n}</button>
              ))}
              <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="w-8 h-8 flex items-center justify-center disabled:opacity-40" style={{background:"#F4F9FD",borderRadius:8}}><ChevronRight size={14} style={{color:"#3F8CFF"}}/></button>
            </div>
          </div>
        </div>

        <div className="p-5" style={card}>
          <div className="flex items-start justify-between gap-2 mb-4">
            <CardTitle icon={Activity} title="Oxirgi faoliyatlar" sub={`${MON_NAMES[month-1]} ${year} · hisobotlar`}/>
            <button onClick={()=>setShowAllActivity(v=>!v)} className="flex items-center gap-1 text-xs font-bold whitespace-nowrap" style={{color:"#3F8CFF"}}>
              {showAllActivity?"Qisqartirish":"Barchasini ko'rish"} <ArrowRight size={13}/>
            </button>
          </div>
          {activity.length===0 ? (
            <p className="text-sm text-center py-8" style={{color:"#91929E"}}>Bu oyda hali faoliyat yo&apos;q</p>
          ) : (
            <ol className="relative flex flex-col gap-4 pl-5" style={{borderLeft:"2px solid #EEF2F7",marginLeft:6}}>
              {activity.map((a,i)=>(
                <li key={i} className="relative flex items-center gap-3">
                  <span className="absolute -left-[27px] w-3 h-3 rounded-full" style={{background:"#FFFFFF",border:`3px solid ${a.kind==="upload"?"#00C48C":"#FF8C42"}`}}/>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{background:a.kind==="upload"?"rgba(0,196,140,0.12)":"rgba(255,140,66,0.14)",borderRadius:12}}>
                    {a.kind==="upload"?<Upload size={17} style={{color:"#00A578"}}/>:<Trophy size={17} style={{color:"#E07A1F"}}/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{color:"#0A1629"}}>{a.title}</p>
                    <p className="text-xs truncate" style={{color:"#91929E"}}>{a.who} · {fmtDateTimeUz(a.at, true)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── 4. Mening hisobotim ── */}
      <div id="bb-hisobotim" className="scroll-mt-4"><WeeklyReportCard/></div>

      {/* ── Xodim hisobotini ko'rib chiqish / ball qo'yish ── */}
      {reviewTarget && (
        <WeeklyReportReviewModal
          employeeName={reviewTarget.name}
          position={reviewTarget.position}
          weeks={reviewTarget.weeks}
          onClose={()=>setReviewTarget(null)}
          onScored={refreshAfterScore}
        />
      )}

      {/* ── KPI Foiz modal ── */}
      {kpiModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{background:"rgba(10,22,41,0.45)"}}
          onClick={()=>setKpiModal(false)}>
          <div
            className="relative flex flex-col gap-0 overflow-hidden"
            style={{background:"#FFFFFF",borderRadius:20,boxShadow:"0px 20px 60px rgba(10,22,41,0.25)",minWidth:320}}
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:"1px solid #F4F9FD"}}>
              <div>
                <p className="font-bold text-sm" style={{color:"#0A1629"}}>KPI Foiz Jadval</p>
                <p className="text-xs mt-0.5" style={{color:"#91929E"}}>Ball oralig'iga qarab KPI ulushi</p>
              </div>
              <button onClick={()=>setKpiModal(false)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors">
                <X size={15} style={{color:"#91929E"}}/>
              </button>
            </div>
            <div className="flex flex-col gap-0">
              {KPI_RANGES.map((r,i)=>(
                <div key={i} className="flex items-center justify-between px-5 py-3"
                  style={{borderBottom:i<KPI_RANGES.length-1?"1px solid #F4F9FD":"none"}}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:r.color}}/>
                    <span className="text-sm font-medium" style={{color:"#0A1629"}}>{r.from} – {r.to} ball</span>
                  </div>
                  <span className="px-3 py-1 text-sm font-bold" style={{background:r.bg,color:r.color,borderRadius:8}}>{r.foiz}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3" style={{background:"#F8FAFF",borderTop:"1px solid #F4F9FD"}}>
              <p className="text-xs" style={{color:"#91929E"}}>70 balldan past — KPI hisoblanmaydi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
