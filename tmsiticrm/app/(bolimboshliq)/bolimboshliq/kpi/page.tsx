"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Star, Upload, Download, Loader2, Save, X, FileText,
  Award, Users, CheckCircle2, Clock, Calendar, Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Constants ── */
const MAX_BOLIM    = 65;
const MAX_KADR     = 25;
const MAX_IJRO     = 10;
const MAX_TOTAL    = MAX_BOLIM + MAX_KADR + MAX_IJRO;

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

const MON_COLORS: Record<string,{bg:string;color:string}> = {
  Yanvar:{bg:"#E8F4FD",color:"#3F8CFF"}, Fevral:{bg:"#E8F4FD",color:"#3F8CFF"},
  Mart:{bg:"#E8FDF4",color:"#00C48C"},   Aprel:{bg:"#FDF6E8",color:"#FFBD21"},
  May:{bg:"#F0EDFD",color:"#6D5DD3"},    Iyun:{bg:"#E8FAFE",color:"#15C0E6"},
  Iyul:{bg:"#FDE8E8",color:"#FF5C5C"},   Avgust:{bg:"#FDF0E8",color:"#FF8C42"},
  Sentabr:{bg:"#E8F4FD",color:"#3F8CFF"},Oktabr:{bg:"#E8FDF4",color:"#00C48C"},
  Noyabr:{bg:"#FDF6E8",color:"#FFBD21"}, Dekabr:{bg:"#F0EDFD",color:"#6D5DD3"},
};

/* ── Types ── */
interface ApiEmp   { id:number; full_name:string; position:string; role:string; is_active:boolean; }
interface ApiScore {
  id:number; employee_id:number; year:number; month:number;
  bolim_ball:number|null; kadr_ball:number|null; direktor_ball:number|null;
  ijro_ball:number|null; comment:string|null; report_file_name:string|null;
}
interface Row {
  id:number; name:string; position:string; role:string; avatar:string; color:string;
  isSelf:boolean;
  bolimBall:number|null; kadrBall:number|null; direktorBall:number|null; ijroBall:number|null;
  reportFileName:string|null;
}

function mkAvatar(n:string){ return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2); }
function rowTotal(r:Row){ return (r.bolimBall??0)+(r.kadrBall??0)+(r.ijroBall??0); }
function getStatus(r:Row):"Baholangan"|"Qisman"|"Kutilmoqda"{
  const cnt=[r.bolimBall,r.kadrBall,r.ijroBall].filter(v=>v!=null).length;
  return cnt===3?"Baholangan":cnt>0?"Qisman":"Kutilmoqda";
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

/* ═══════════════════════════════════════════════════════════════ */
export default function BolimKpiPage() {
  const now   = new Date();
  const me    = getUser();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);

  /* ── TAB state ── */
  const [tab, setTab] = useState<"ball"|"hisobotlar">("ball");

  /* ── TAB 1: Ball berish ── */
  const [rows,     setRows]     = useState<Row[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(true); // accordion
  const [kpiModal, setKpiModal] = useState(false);

  /* ── Ball berish modal ── */
  const [ballModal,  setBallModal]  = useState<{id:number;name:string}|null>(null);
  const [ballInput,  setBallInput]  = useState("");
  const [ballSaving, setBallSaving] = useState(false);

  /* ── File upload ── */
  const [uploadingId, setUploadingId] = useState<number|null>(null);
  const uploadTargetRef = useRef<number|null>(null);

  /* ── TAB 2: Hisobotlar ── */
  const [myScores,     setMyScores]     = useState<ApiScore[]>([]);
  const [scoresLoading,setScoresLoading]= useState(false);

  /* ─── Load TAB1 data ─── */
  const loadBall = useCallback(async(y:number,m:number)=>{
    setLoading(true);
    try {
      const [emps, scores] = await Promise.all([
        apiFetch<ApiEmp[]>("/employees/"),
        apiFetch<ApiScore[]>(`/ball/month?year=${y}&month=${m}`),
      ]);
      const sm = new Map(scores.map(s=>[s.employee_id,s]));
      const activeEmps = emps.filter(e=>e.is_active||e.id===me?.id);
      setRows(activeEmps.map((e,i)=>({
        id:e.id, name:e.full_name, position:e.position, role:e.role,
        avatar:mkAvatar(e.full_name), color:AVATAR_COLORS[i%AVATAR_COLORS.length],
        isSelf:e.id===me?.id,
        bolimBall:   sm.get(e.id)?.bolim_ball    ??null,
        kadrBall:    sm.get(e.id)?.kadr_ball     ??null,
        direktorBall:sm.get(e.id)?.direktor_ball ??null,
        ijroBall:    sm.get(e.id)?.ijro_ball     ??null,
        reportFileName:sm.get(e.id)?.report_file_name??null,
      })));
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  },[me?.id]);

  /* ─── Load TAB2 data ─── */
  const loadMyScores = useCallback(async(y:number)=>{
    setScoresLoading(true);
    try {
      const data=await apiFetch<ApiScore[]>(`/ball/my-year?year=${y}`);
      setMyScores(data);
    } catch(e){console.error(e);}
    finally{setScoresLoading(false);}
  },[]);

  useEffect(()=>{ loadBall(year,month); loadMyScores(year); },[]);// eslint-disable-line

  function chMonth(dir:number){
    let m=month+dir; let y=year;
    if(m<1){m=12;y--;} if(m>12){m=1;y++;}
    setYear(y); setMonth(m);
    loadBall(y,m);
    if(tab==="hisobotlar") loadMyScores(y);
  }

  /* ─── Ball berish ─── */
  function openBallModal(r:Row){
    setBallInput(r.bolimBall!=null?String(r.bolimBall):"");
    setBallModal({id:r.id,name:r.name});
  }
  async function saveBall(){
    if(!ballModal)return;
    const val=Number(ballInput);
    if(ballInput===""||isNaN(val)||val<0||val>MAX_BOLIM)return;
    setBallSaving(true);
    try{
      await apiFetch("/ball/bolim-ball",{method:"POST",body:JSON.stringify({employee_id:ballModal.id,year,month,bolim_ball:val})});
      setRows(p=>p.map(r=>r.id===ballModal.id?{...r,bolimBall:val}:r));
      setBallModal(null);
    }catch(e){alert(e instanceof Error?e.message:"Xato");}
    finally{setBallSaving(false);}
  }

  /* ─── File upload ─── */
  function triggerUpload(empId:number){
    uploadTargetRef.current=empId;
    const inp=document.createElement("input");
    inp.type="file"; inp.accept=".pdf,.doc,.docx,.xlsx,.xls";
    inp.onchange=async(e)=>{
      const file=(e.target as HTMLInputElement).files?.[0];
      const id=uploadTargetRef.current;
      if(!file||!id)return;
      if(file.size>10*1024*1024){alert("Fayl 10MB dan katta bo'lmasin");return;}
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        const b64=ev.target?.result as string;
        setUploadingId(id);
        try{
          await apiFetch("/ball/report",{method:"POST",body:JSON.stringify({employee_id:id,year,month,file_name:file.name,file_b64:b64})});
          setRows(p=>p.map(r=>r.id===id?{...r,reportFileName:file.name}:r));
          if(id===me?.id) loadMyScores(year);
        }catch(err){alert(err instanceof Error?err.message:"Yuklashda xato");}
        finally{setUploadingId(null);}
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  async function downloadFile(empId:number,y:number,m:number){
    try{
      const d=await apiFetch<{file_name:string;file_b64:string}>(`/ball/report/${empId}/${y}/${m}`);
      const a=document.createElement("a"); a.href=d.file_b64; a.download=d.file_name; a.click();
    }catch{alert("Fayl topilmadi");}
  }

  /* ── Derived ── */
  const selfRow        = rows.find(r=>r.isSelf);
  const empRows        = rows.filter(r=>!r.isSelf);
  const empRowsRated   = empRows.filter(r=>getStatus(r)==="Baholangan").length;
  const withReport     = rows.filter(r=>r.reportFileName).length;

  /* ════════════════════════════════════════════════ RENDER ══ */
  return (
    <div className="relative">
      <Header title="KPI" subtitle="Ball berish va oylik hisobotlar" />

      {/* ── TABS ── */}
      <div className="flex gap-1 p-1 mb-5 w-fit"
        style={{background:"#F4F9FD",borderRadius:16}}>
        {([
          {key:"ball",       label:"Ball berish"},
          {key:"hisobotlar", label:"Topshirilgan hisobotlar"},
        ] as const).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-5 py-2.5 text-sm font-bold transition-all"
            style={{
              background: tab===t.key?"#FFFFFF":"transparent",
              color:      tab===t.key?"#0A1629":"#91929E",
              borderRadius:12,
              boxShadow:  tab===t.key?"0px 2px 8px rgba(0,0,0,0.08)":"none",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB 1: BALL BERISH ══════════════ */}
      {tab==="ball" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {[
              {label:"Jami xodimlar",    value:empRows.length,    icon:Users,        color:"#3F8CFF",bg:"rgba(63,140,255,0.1)"},
              {label:"Baholangan",        value:empRowsRated,      icon:CheckCircle2, color:"#00C48C",bg:"rgba(0,196,140,0.1)"},
              {label:"Hisobot yuklangan", value:withReport,        icon:FileText,     color:"#6D5DD3",bg:"rgba(109,93,211,0.1)"},
              {label:"Kutilmoqda",        value:empRows.length-empRowsRated,icon:Clock,color:"#FF5C5C",bg:"rgba(255,92,92,0.1)"},
            ].map(s=>(
              <div key={s.label} className="p-5 flex items-center gap-4"
                style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:20}}>
                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                  style={{background:s.bg,borderRadius:13}}>
                  <s.icon size={20} style={{color:s.color}}/>
                </div>
                <div>
                  <p className="text-2xl font-bold leading-tight" style={{color:"#0A1629"}}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{color:"#91929E"}}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Accordion card ── */}
          <div style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24}}>

            {/* Accordion header — click to open/close */}
            <button
              onClick={()=>setExpanded(v=>!v)}
              className="w-full flex items-center justify-between px-6 py-5 hover:bg-[#FAFCFF] transition-colors"
              style={{borderRadius:expanded?"24px 24px 0 0":"24px",borderBottom:expanded?"1px solid #F4F9FD":"none"}}>
              <div className="flex items-center gap-3">
                {/* Month badge */}
                <div className="w-10 h-10 flex items-center justify-center"
                  style={{background:"rgba(63,140,255,0.1)",borderRadius:12}}>
                  <Calendar size={18} style={{color:"#3F8CFF"}}/>
                </div>
                <div className="text-left">
                  <p className="font-bold text-base" style={{color:"#0A1629"}}>
                    {MON_NAMES[month-1]} {year}
                  </p>
                  <p className="text-xs mt-0.5" style={{color:"#91929E"}}>
                    Ball berish va hisobot yuklash
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Month navigation */}
                <div className="flex items-center gap-1 p-1"
                  style={{background:"#F4F9FD",borderRadius:10}}
                  onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>chMonth(-1)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-white transition-colors">
                    <ChevronLeft size={14} style={{color:"#3F8CFF"}}/>
                  </button>
                  <span className="px-2 font-bold text-sm" style={{color:"#0A1629",minWidth:100,textAlign:"center"}}>
                    {MON_NAMES[month-1]} {year}
                  </span>
                  <button onClick={()=>chMonth(1)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-white transition-colors">
                    <ChevronRight size={14} style={{color:"#3F8CFF"}}/>
                  </button>
                </div>

                {/* Expand/collapse icon */}
                <div className="w-8 h-8 flex items-center justify-center"
                  style={{background:"#F4F9FD",borderRadius:10}}>
                  {expanded
                    ? <ChevronUp   size={16} style={{color:"#3F8CFF"}}/>
                    : <ChevronDown size={16} style={{color:"#91929E"}}/>}
                </div>
              </div>
            </button>

            {/* ── Accordion body ── */}
            {expanded && (
              loading ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 size={26} className="animate-spin" style={{color:"#3F8CFF"}}/>
                  <span className="ml-2 text-sm font-bold" style={{color:"#3F8CFF"}}>Yuklanmoqda…</span>
                </div>
              ) : (
                <div className="px-6 py-5 overflow-x-auto">
                <div style={{ minWidth: 900 }}>

                  {/* Column headers */}
                  <div className="grid px-5 py-2.5 mb-1 text-xs font-bold uppercase tracking-wide items-center"
                    style={{
                      gridTemplateColumns:"2fr 90px 90px 90px 80px 110px 1fr 130px",
                      color:"#91929E",letterSpacing:"0.05em",
                      background:"#F4F9FD",borderRadius:12,
                    }}>
                    <span>Xodim</span>
                    <span className="text-center">Bo'lim</span>
                    <span className="text-center">Kadr</span>
                    <span className="text-center">Ijro</span>
                    <span className="text-center">Jami</span>
                    <span className="flex items-center justify-center gap-1">
                      KPI Foiz
                      <button onClick={()=>setKpiModal(true)} className="hover:opacity-70 transition-opacity" title="KPI foiz jadvalini ko'rish">
                        <Info size={13} style={{color:"#6D5DD3"}}/>
                      </button>
                    </span>
                    <span>Holat</span>
                    <span className="text-right">Amallar</span>
                  </div>

                  {/* ── O'ZINGIZ row ── */}
                  {selfRow && (
                    <div className="grid items-center px-5 py-4 mb-3"
                      style={{
                        gridTemplateColumns:"2fr 90px 90px 90px 80px 110px 1fr 130px",
                        background:"rgba(63,140,255,0.04)",borderRadius:14,
                        border:"1.5px solid rgba(63,140,255,0.12)",
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{background:selfRow.color,borderRadius:11}}>
                          {selfRow.avatar}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{color:"#0A1629"}}>{selfRow.name}</p>
                          <p className="text-[10px]" style={{color:"#3F8CFF",fontWeight:700}}>O'ZINGIZ</p>
                        </div>
                      </div>
                      <ScoreCircle val={selfRow.bolimBall} max={MAX_BOLIM} color="#3F8CFF"/>
                      <ScoreCircle val={selfRow.kadrBall}  max={MAX_KADR}  color="#FF8C42"/>
                      <ScoreCircle val={selfRow.ijroBall}  max={MAX_IJRO}  color="#00C48C"/>
                      <div className="text-center">
                        {rowTotal(selfRow)>0
                          ?<><span className="text-lg font-bold" style={{color:"#0A1629"}}>{rowTotal(selfRow)}</span><span className="text-xs block" style={{color:"#91929E"}}>/{MAX_TOTAL}</span></>
                          :<span className="text-sm" style={{color:"#C4CBD6"}}>—</span>}
                      </div>
                      <div className="flex justify-center">
                        {(()=>{const k=getKpiLabel(rowTotal(selfRow)>0?rowTotal(selfRow):null);return(
                          <span className="px-2.5 py-1 text-xs font-bold" style={{background:k.bg,color:k.color,borderRadius:8}}>{k.text}</span>
                        );})()}
                      </div>
                      <div><Badge label={getStatus(selfRow)} variant={statusVariant[getStatus(selfRow)]}/></div>
                      <div className="flex gap-1.5 justify-end">
                        {selfRow.reportFileName?(
                          <>
                            <button onClick={()=>downloadFile(selfRow.id,year,month)}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                              style={{background:"rgba(0,196,140,0.1)",borderRadius:10,color:"#00A578"}}>
                              <Download size={12}/> Yuklab olish
                            </button>
                            <button onClick={()=>triggerUpload(selfRow.id)}
                              disabled={uploadingId===selfRow.id}
                              className="w-8 h-8 flex items-center justify-center"
                              style={{background:"rgba(63,140,255,0.1)",borderRadius:10,color:"#3F8CFF"}}>
                              {uploadingId===selfRow.id?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
                            </button>
                          </>
                        ):(
                          <button onClick={()=>triggerUpload(selfRow.id)}
                            disabled={uploadingId===selfRow.id}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                            style={{background:"rgba(63,140,255,0.1)",borderRadius:10,color:"#3F8CFF"}}>
                            {uploadingId===selfRow.id?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
                            Hisobot yuklash
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  {empRows.length>0 && (
                    <p className="text-xs font-bold uppercase tracking-widest mb-3 mt-1 px-1"
                      style={{color:"#B0B8C8",letterSpacing:"0.08em"}}>
                      Xodimlarim ({empRows.length} ta)
                    </p>
                  )}

                  {/* ── Employee rows ── */}
                  <div className="flex flex-col">
                    {empRows.map((r,idx,arr)=>{
                      const tot=rowTotal(r);
                      const pct=Math.round((tot/MAX_TOTAL)*100);
                      const st=getStatus(r);
                      const kpi=getKpiLabel(tot>0?tot:null);
                      return (
                        <div key={r.id}
                          className="grid items-center px-5 py-3.5 hover:bg-[#FAFCFF] transition-colors"
                          style={{
                            gridTemplateColumns:"2fr 90px 90px 90px 80px 110px 1fr 130px",
                            borderBottom:idx<arr.length-1?"1px solid #F4F9FD":"none",
                          }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{background:r.color,borderRadius:11}}>
                              {r.avatar}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate" style={{color:"#0A1629"}}>{r.name}</p>
                              <p className="text-xs truncate" style={{color:"#91929E"}}>{r.position}</p>
                            </div>
                          </div>
                          <ScoreCircle val={r.bolimBall} max={MAX_BOLIM} color="#3F8CFF"/>
                          <ScoreCircle val={r.kadrBall}  max={MAX_KADR}  color="#FF8C42"/>
                          <ScoreCircle val={r.ijroBall}  max={MAX_IJRO}  color="#00C48C"/>
                          <div className="text-center">
                            <span className="text-lg font-bold"
                              style={{color:pct>=70?"#00C48C":pct>=50?"#FFBD21":"#FF5C5C"}}>
                              {tot>0?tot:"—"}
                            </span>
                            {tot>0&&<span className="text-xs block" style={{color:"#91929E"}}>/{MAX_TOTAL}</span>}
                          </div>
                          <div className="flex justify-center">
                            <span className="px-2.5 py-1 text-xs font-bold" style={{background:kpi.bg,color:kpi.color,borderRadius:8}}>{kpi.text}</span>
                          </div>
                          <div><Badge label={st} variant={statusVariant[st]}/></div>
                          <div className="flex items-center gap-1.5 justify-end">
                            {r.reportFileName?(
                              <>
                                <button onClick={()=>downloadFile(r.id,year,month)}
                                  className="w-8 h-8 flex items-center justify-center"
                                  style={{background:"rgba(0,196,140,0.1)",borderRadius:10,color:"#00A578"}}
                                  title={r.reportFileName}>
                                  <Download size={13}/>
                                </button>
                                <button onClick={()=>triggerUpload(r.id)}
                                  disabled={uploadingId===r.id}
                                  className="w-8 h-8 flex items-center justify-center"
                                  style={{background:"rgba(109,93,211,0.1)",borderRadius:10,color:"#6D5DD3"}}>
                                  {uploadingId===r.id?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
                                </button>
                              </>
                            ):(
                              <button onClick={()=>triggerUpload(r.id)}
                                disabled={uploadingId===r.id}
                                className="w-8 h-8 flex items-center justify-center"
                                style={{background:"rgba(63,140,255,0.1)",borderRadius:10,color:"#3F8CFF"}}>
                                {uploadingId===r.id?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
                              </button>
                            )}
                            <button onClick={()=>openBallModal(r)}
                              className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-white hover:opacity-80"
                              style={{background:"#3F8CFF",borderRadius:10,boxShadow:"0px 4px 10px rgba(63,140,255,0.25)"}}>
                              <Star size={12}/> Ball
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {empRows.length===0 && (
                      <div className="py-10 text-center">
                        <p className="font-bold text-sm" style={{color:"#0A1629"}}>Bo'limda xodimlar topilmadi</p>
                        <p className="text-xs mt-1" style={{color:"#91929E"}}>Superadmin xodimlarni biriktirishi kerak</p>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              )
            )}
            <div className="pb-2"/>
          </div>

          {/* ── Info cards ── */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {label:"Bo'lim boshlig'i",max:MAX_BOLIM,color:"#3F8CFF",desc:"Bevosita rahbar qo'yadi"},
              {label:"Kadrlar bo'limi", max:MAX_KADR, color:"#FF8C42",desc:"Kadrlar bo'limi belgilaydi"},
              {label:"Ijro nazorati",   max:MAX_IJRO, color:"#00C48C",desc:"Topshiriqlar asosida"},
            ].map(item=>(
              <div key={item.label} className="flex items-center gap-4 px-5 py-4"
                style={{background:"#FFFFFF",borderRadius:18,boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)"}}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{background:`${item.color}18`,borderRadius:12}}>
                  <Award size={18} style={{color:item.color}}/>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{color:"#0A1629"}}>
                    {item.label} <span style={{color:item.color}}>/{item.max}</span>
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{color:"#91929E"}}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════ TAB 2: HISOBOTLAR ══════════════ */}
      {tab==="hisobotlar" && (
        <div style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24}}>

          <div className="flex items-center justify-between px-6 py-5" style={{borderBottom:"1px solid #F4F9FD"}}>
            <div>
              <h2 className="font-bold text-base" style={{color:"#0A1629"}}>Topshirilgan hisobotlar</h2>
              <p className="text-xs mt-0.5" style={{color:"#91929E"}}>
                {year} yil uchun o'z ball va hisobotlaringiz
              </p>
            </div>
            {/* Year nav */}
            <div className="flex items-center gap-1 p-1" style={{background:"#F4F9FD",borderRadius:12}}>
              <button onClick={()=>{ setYear(v=>v-1); loadMyScores(year-1); }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronLeft size={14} style={{color:"#3F8CFF"}}/>
              </button>
              <span className="px-3 font-bold text-sm" style={{color:"#0A1629"}}>{year} yil</span>
              <button onClick={()=>{ setYear(v=>v+1); loadMyScores(year+1); }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronRight size={14} style={{color:"#3F8CFF"}}/>
              </button>
            </div>
          </div>

          {scoresLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 size={26} className="animate-spin" style={{color:"#3F8CFF"}}/>
            </div>
          ) : myScores.length===0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
                style={{background:"rgba(63,140,255,0.08)",borderRadius:20}}>
                <FileText size={30} style={{color:"#3F8CFF"}}/>
              </div>
              <p className="font-bold text-base" style={{color:"#0A1629"}}>Hisobotlar mavjud emas</p>
              <p className="text-sm mt-1" style={{color:"#91929E"}}>{year} yil uchun hali ball berilmagan</p>
            </div>
          ) : (
            <div className="px-6 py-4 flex flex-col gap-3">
              {myScores.map(sc=>{
                const monName = MON_NAMES[sc.month-1];
                const mc = MON_COLORS[monName]??{bg:"rgba(63,140,255,0.1)",color:"#3F8CFF"};
                const tot=(sc.bolim_ball??0)+(sc.kadr_ball??0)+(sc.ijro_ball??0);
                const pct=Math.round((tot/MAX_TOTAL)*100);
                const kpi=getKpiLabel(tot>0?tot:null);
                const hasFile=!!sc.report_file_name;
                return (
                  <div key={sc.id}
                    className="flex items-center flex-wrap gap-3 sm:gap-5 px-4 sm:px-5 py-4 hover:shadow-md transition-shadow"
                    style={{background:"#FAFCFF",borderRadius:18,border:"1.5px solid #EEF2FF"}}>

                    {/* Month badge */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 flex-shrink-0"
                      style={{background:mc.bg,borderRadius:16}}>
                      <Calendar size={17} style={{color:mc.color}}/>
                      <p className="text-xs font-bold mt-1" style={{color:mc.color}}>{monName.slice(0,3)}</p>
                    </div>

                    {/* Month name */}
                    <div className="w-28 flex-shrink-0">
                      <p className="font-bold text-sm" style={{color:"#0A1629"}}>{monName}</p>
                      <p className="text-xs mt-0.5" style={{color:"#91929E"}}>{year} yil</p>
                    </div>

                    {/* Balls */}
                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                      {[
                        {label:"Bo'lim", val:sc.bolim_ball, max:MAX_BOLIM, color:"#3F8CFF"},
                        {label:"Kadr",   val:sc.kadr_ball,  max:MAX_KADR,  color:"#FF8C42"},
                        {label:"Ijro",   val:sc.ijro_ball,  max:MAX_IJRO,  color:"#00C48C"},
                      ].map(b=>(
                        <div key={b.label} className="text-center px-2">
                          <p className="text-xs mb-0.5" style={{color:"#91929E"}}>{b.label}</p>
                          <p className="font-bold text-sm" style={{color:b.val!=null?b.color:"#C4CBD6"}}>
                            {b.val!=null?b.val:"—"}
                            <span className="text-xs font-normal" style={{color:"#D0D5DD"}}>/{b.max}</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="text-center w-20 flex-shrink-0">
                      <p className="text-xs mb-0.5" style={{color:"#91929E"}}>Jami</p>
                      <p className="font-bold text-xl"
                        style={{color:pct>=70?"#00C48C":pct>=50?"#FFBD21":"#91929E"}}>
                        {tot>0?tot:"—"}
                      </p>
                      {tot>0&&<p className="text-xs" style={{color:"#91929E"}}>/{MAX_TOTAL}</p>}
                    </div>

                    {/* KPI Foiz */}
                    <div className="text-center w-20 flex-shrink-0">
                      <p className="text-xs mb-0.5" style={{color:"#91929E"}}>KPI Foiz</p>
                      <span className="px-2.5 py-1 text-xs font-bold inline-block" style={{background:kpi.bg,color:kpi.color,borderRadius:8}}>{kpi.text}</span>
                    </div>

                    {/* File */}
                    <div className="flex-shrink-0">
                      {hasFile?(
                        <button
                          onClick={()=>me && downloadFile(me.id,sc.year,sc.month)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                          style={{background:"rgba(0,196,140,0.1)",borderRadius:10,color:"#00A578"}}>
                          <Download size={12}/> {sc.report_file_name!.slice(0,14)}{sc.report_file_name!.length>14?"…":""}
                        </button>
                      ):(
                        <span className="text-xs px-3 py-2 font-bold"
                          style={{background:"rgba(145,146,158,0.1)",borderRadius:10,color:"#91929E"}}>
                          Fayl yo'q
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pb-2"/>
        </div>
      )}

      {/* ══ Ball berish modal ══ */}
      {ballModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{background:"rgba(10,22,41,0.5)",backdropFilter:"blur(6px)"}}>
          <div className="w-full max-w-[400px] p-8 relative"
            style={{background:"#FFFFFF",borderRadius:28,boxShadow:"0px 30px 80px rgba(0,0,0,0.2)"}}>
            <button onClick={()=>setBallModal(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{background:"#F4F9FD",borderRadius:10}}>
              <X size={15} style={{color:"#91929E"}}/>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center"
                style={{background:"rgba(63,140,255,0.1)",borderRadius:14}}>
                <Star size={22} style={{color:"#3F8CFF"}}/>
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{color:"#0A1629"}}>Ball berish</h3>
                <p className="text-xs" style={{color:"#91929E"}}>
                  {ballModal.name} · {MON_NAMES[month-1]} {year}
                </p>
              </div>
            </div>
            <label className="block text-sm font-bold mb-2" style={{color:"#0A1629"}}>
              Bo'lim boshlig'i bali
              <span className="ml-2 text-xs font-normal" style={{color:"#91929E"}}>(0 — {MAX_BOLIM})</span>
            </label>
            <input type="number" min={0} max={MAX_BOLIM}
              placeholder={`0 — ${MAX_BOLIM}`} value={ballInput}
              onChange={e=>setBallInput(e.target.value)} autoFocus
              className="w-full px-4 py-3 text-xl font-bold outline-none text-center mb-2"
              style={{
                background:"#F4F9FD",borderRadius:14,color:"#0A1629",
                border:ballInput&&(Number(ballInput)>MAX_BOLIM||Number(ballInput)<0)
                  ?"2px solid #FF5C5C":"2px solid #3F8CFF",
              }}/>
            {ballInput&&!isNaN(Number(ballInput))&&Number(ballInput)>=0&&Number(ballInput)<=MAX_BOLIM&&(
              <div className="h-1.5 rounded-full mb-5" style={{background:"#EEF2FF"}}>
                <div className="h-full rounded-full"
                  style={{width:`${Math.round(Number(ballInput)/MAX_BOLIM*100)}%`,background:"#3F8CFF",transition:"width 0.3s"}}/>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setBallModal(null)}
                className="flex-1 py-3 font-bold text-sm"
                style={{background:"#F4F9FD",borderRadius:14,color:"#7D8592"}}>
                Bekor qilish
              </button>
              <button onClick={saveBall} disabled={ballSaving}
                className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{background:"#3F8CFF",borderRadius:14,boxShadow:"0px 6px 12px rgba(63,140,255,0.263686)"}}>
                {ballSaving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}
                {ballSaving?"Saqlanmoqda...":"Saqlash"}
              </button>
            </div>
          </div>
        </div>
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
