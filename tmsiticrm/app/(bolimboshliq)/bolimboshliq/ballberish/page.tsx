"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  Star, Users, CheckCircle2, Clock, TrendingUp,
  ChevronDown, ChevronLeft, ChevronRight, X, Save, Award, Search, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

/* ── Constants ── */
const MAX_BOLIM    = 65;
const MAX_KADR     = 25;
const MAX_DIREKTOR = 100;
const MAX_IJRO     = 10;
const MAX_TOTAL    = MAX_BOLIM + MAX_KADR + MAX_DIREKTOR + MAX_IJRO;

const MON_NAMES = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const AVATAR_COLORS = ["#3F8CFF","#6D5DD3","#00C48C","#FFBD21","#FF5C5C","#15C0E6","#FF8C42"];

/* ── Types ── */
interface ApiEmp  { id:number; full_name:string; position:string; work_rate:number; role:string; }
interface ApiScore{
  id:number; employee_id:number; year:number; month:number;
  bolim_ball:number|null; kadr_ball:number|null; direktor_ball:number|null; ijro_ball:number|null; comment:string|null;
}

interface Row {
  id:       number;
  name:     string;
  position: string;
  avatar:   string;
  color:    string;
  bolimBall:    number|null;
  kadrBall:     number|null;
  direktorBall: number|null;
  ijroBall:     number|null;
}

function mkAvatar(name:string){ return name.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2); }
function rowTotal(r:Row){ return (r.bolimBall??0)+(r.kadrBall??0)+(r.direktorBall??0)+(r.ijroBall??0); }
function getStatus(r:Row): "Baholangan"|"Qisman"|"Kutilmoqda" {
  const set = [r.bolimBall,r.kadrBall,r.direktorBall,r.ijroBall].filter(v=>v!=null).length;
  return set===4?"Baholangan":set>0?"Qisman":"Kutilmoqda";
}

/* ── Doira ko'rinishidagi ball ── */
function ScoreCircle({val,max,color}:{val:number|null;max:number;color:string}){
  const size = 48, stroke = 4, r = (size-stroke)/2, circ = 2*Math.PI*r;
  const pct = val!=null ? Math.min(val/max,1) : 0;
  const dash = circ * pct;
  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{width:size,height:size}}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2FF" strokeWidth={stroke}/>
          {val!=null && (
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{transition:"stroke-dasharray 0.4s ease"}}/>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-bold text-sm" style={{color: val!=null ? "#0A1629" : "#C4CBD6"}}>
            {val!=null ? val : "—"}
          </span>
          <span className="text-[9px]" style={{color:"#A8B0BD"}}>/{max}</span>
        </div>
      </div>
    </div>
  );
}

const statusVariant: Record<string,"success"|"warning"|"danger"> = {
  Baholangan:"success", Qisman:"warning", Kutilmoqda:"danger",
};

/* ── Component ── */
export default function BallBerishPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1); // 1-12
  const [rows,  setRows]  = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState("");
  const [modalId, setModalId] = useState<number|null>(null);
  const [inputBolim,    setInputBolim]    = useState("");

  /* ── Load employees + scores ── */
  const loadData = useCallback(async (y:number, m:number) => {
    setLoading(true);
    try {
      const me = getUser();

      // Employees — GET /employees/ returns own dept for bolim_boshligi
      const emps = await apiFetch<ApiEmp[]>("/employees/");
      // Bo'lim boshlig'i o'zi baholanmaydi
      const others = emps.filter(e => e.id !== me?.id && e.role !== "bolim_boshligi" && e.role !== "boshqarma_boshligi");

      // Scores for this month
      const deptId = me?.department_id;
      const q = deptId ? `?year=${y}&month=${m}&department_id=${deptId}` : `?year=${y}&month=${m}`;
      const scores = await apiFetch<ApiScore[]>(`/ball/month${q}`);
      const scoreMap = new Map(scores.map(s=>[s.employee_id, s]));

      setRows(others.map((e,i) => {
        const sc = scoreMap.get(e.id);
        return {
          id:       e.id,
          name:     e.full_name,
          position: e.position,
          avatar:   mkAvatar(e.full_name),
          color:    AVATAR_COLORS[i % AVATAR_COLORS.length],
          bolimBall:    sc?.bolim_ball    ?? null,
          kadrBall:     sc?.kadr_ball     ?? null,
          direktorBall: sc?.direktor_ball ?? null,
          ijroBall:     sc?.ijro_ball     ?? null,
        };
      }));
    } catch(err){
      console.error("Ball ma'lumotlari yuklanmadi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(year, month); }, []); // eslint-disable-line

  function chMonth(dir:number){
    let m = month+dir; let y = year;
    if(m<1){m=12;y--;} if(m>12){m=1;y++;}
    setYear(y); setMonth(m); loadData(y,m);
  }

  /* ── Modal open ── */
  function openModal(id:number){
    const r = rows.find(x=>x.id===id);
    setInputBolim(r?.bolimBall!=null ? String(r.bolimBall) : "");
    setModalId(id);
  }

  /* ── Save to API — bo'lim boshlig'i FAQAT bolim_ball beradi ── */
  async function handleSave(){
    if(modalId==null) return;
    const val = Number(inputBolim);
    if(inputBolim==="" || isNaN(val) || val<0 || val>MAX_BOLIM) return;
    setSaving(true);
    try {
      await apiFetch("/ball/save", {
        method:"POST",
        body:JSON.stringify({ employee_id: modalId, year, month, bolim_ball: val }),
      });

      // Update local state — faqat bolimBall
      setRows(prev => prev.map(r =>
        r.id === modalId ? { ...r, bolimBall: val } : r
      ));
      setModalId(null);
    } catch(err){
      alert("Saqlashda xato: "+(err instanceof Error?err.message:String(err)));
    } finally {
      setSaving(false);
    }
  }

  /* ── Stats ── */
  const filtered    = rows.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));
  const baholangan  = rows.filter(r=>getStatus(r)==="Baholangan").length;
  const qisman      = rows.filter(r=>getStatus(r)==="Qisman").length;
  const kutilmoqda  = rows.filter(r=>getStatus(r)==="Kutilmoqda").length;
  const avgTotal    = rows.length ? Math.round(rows.reduce((a,r)=>a+rowTotal(r),0)/rows.length) : 0;
  const activeRow   = rows.find(r=>r.id===modalId);

  return (
    <div className="relative">
      <Header title="Ball berish" subtitle="Xodimlarga oylik ball qo'yish va baholash" />

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          {label:"Jami xodimlar", value:rows.length,  icon:Users,        color:"#3F8CFF", bg:"rgba(63,140,255,0.1)"},
          {label:"Baholangan",    value:baholangan,   icon:CheckCircle2, color:"#00C48C", bg:"rgba(0,196,140,0.1)"},
          {label:"Qisman",        value:qisman,       icon:Clock,        color:"#FFBD21", bg:"rgba(255,189,33,0.1)"},
          {label:"Kutilmoqda",    value:kutilmoqda,   icon:Clock,        color:"#FF5C5C", bg:"rgba(255,92,92,0.1)"},
        ].map((s)=>(
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

      {/* ── Table card ── */}
      <div style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24}}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{borderBottom:"1px solid #F4F9FD"}}>
          <div>
            <h2 className="font-bold text-base" style={{color:"#0A1629"}}>
              {MON_NAMES[month-1]} {year} — Ball jadvali
            </h2>
            <p className="text-xs mt-0.5" style={{color:"#91929E"}}>
              O'rtacha umumiy ball:{" "}
              <strong style={{color:"#3F8CFF"}}>{avgTotal}</strong> / {MAX_TOTAL}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{background:"#F4F9FD",borderRadius:13,width:220}}>
              <Search size={15} style={{color:"#91929E"}}/>
              <input className="bg-transparent outline-none text-sm flex-1" style={{color:"#0A1629"}}
                placeholder="Xodim qidirish..." value={search}
                onChange={e=>setSearch(e.target.value)}/>
            </div>
            {/* Month nav */}
            <div className="flex items-center p-1 gap-1"
              style={{background:"#F4F9FD",borderRadius:13}}>
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
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-6 py-3 text-xs font-bold uppercase tracking-wide items-center"
          style={{gridTemplateColumns:"2fr 90px 90px 90px 90px 80px 1fr 100px",color:"#91929E",borderBottom:"1px solid #F4F9FD"}}>
          <span>Xodim</span>
          <span className="text-center">Bo'lim</span>
          <span className="text-center">Kadr</span>
          <span className="text-center">Direktor</span>
          <span className="text-center">Ijro</span>
          <span className="text-center">Jami</span>
          <span>Holat</span>
          <span className="text-right">Amal</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{color:"#3F8CFF"}}/>
            <span className="ml-2 text-sm font-bold" style={{color:"#3F8CFF"}}>Yuklanmoqda...</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((r, idx) => {
              const tot = rowTotal(r);
              const pct = Math.round((tot/MAX_TOTAL)*100);
              const st  = getStatus(r);
              return (
                <div key={r.id}
                  className="grid items-center px-6 py-4 hover:bg-[#FAFCFF] transition-colors"
                  style={{
                    gridTemplateColumns:"2fr 90px 90px 90px 90px 80px 1fr 100px",
                    borderBottom: idx<filtered.length-1 ? "1px solid #F4F9FD" : "none",
                  }}>
                  {/* Xodim */}
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
                  <ScoreCircle val={r.bolimBall}    max={MAX_BOLIM}    color="#3F8CFF"/>
                  <ScoreCircle val={r.kadrBall}     max={MAX_KADR}     color="#FF8C42"/>
                  <ScoreCircle val={r.direktorBall} max={MAX_DIREKTOR} color="#6D5DD3"/>
                  <ScoreCircle val={r.ijroBall}     max={MAX_IJRO}     color="#00C48C"/>
                  <div className="text-center">
                    <span className="text-lg font-bold"
                      style={{color: pct>=70?"#00C48C":pct>=50?"#FFBD21":"#FF5C5C"}}>
                      {tot>0 ? tot : "—"}
                    </span>
                    {tot>0 && <span className="text-xs block" style={{color:"#91929E"}}>/{MAX_TOTAL}</span>}
                  </div>
                  <div><Badge label={st} variant={statusVariant[st]}/></div>
                  <div className="flex justify-end">
                    <button onClick={()=>openModal(r.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white hover:opacity-80 transition-opacity"
                      style={{background:"#3F8CFF",borderRadius:10,boxShadow:"0px 4px 10px rgba(63,140,255,0.25)"}}>
                      <Star size={13}/> Ball ber
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length===0 && (
              <div className="py-12 text-center">
                <p className="font-bold" style={{color:"#0A1629"}}>
                  {rows.length===0 ? "Xodimlar topilmadi" : "Qidiruvda topilmadi"}
                </p>
                <p className="text-sm mt-1" style={{color:"#91929E"}}>
                  {rows.length===0 ? "Bo'limda baholanadigan xodimlar yo'q" : "Qidiruvni o'zgartiring"}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="pb-2"/>
      </div>

      {/* ── Info cards ── */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        {[
          {label:"Bo'lim boshlig'i", max:MAX_BOLIM,    color:"#3F8CFF", desc:"Bevosita rahbar qo'yadi"},
          {label:"Kadrlar bo'limi",  max:MAX_KADR,     color:"#FF8C42", desc:"Kadrlar bo'limi belgilaydi"},
          {label:"Direktordan",       max:MAX_DIREKTOR, color:"#6D5DD3", desc:"Direktor belgilaydi"},
          {label:"Ijro nazorati",     max:MAX_IJRO,     color:"#00C48C", desc:"Topshiriqlar asosida"},
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

      {/* ── Modal ── */}
      {modalId!=null && activeRow && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{background:"rgba(10,22,41,0.45)",backdropFilter:"blur(6px)"}}>
          <div className="w-full max-w-[440px] p-8 relative"
            style={{background:"#FFFFFF",borderRadius:28,boxShadow:"0px 30px 80px rgba(0,0,0,0.18)"}}>

            <button onClick={()=>setModalId(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{background:"#F4F9FD",borderRadius:10}}>
              <X size={15} style={{color:"#91929E"}}/>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center text-white font-bold"
                style={{background:activeRow.color,borderRadius:14}}>
                {activeRow.avatar}
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{color:"#0A1629"}}>{activeRow.name}</h3>
                <p className="text-xs" style={{color:"#91929E"}}>
                  {activeRow.position} · {MON_NAMES[month-1]} {year}
                </p>
              </div>
            </div>

            {/* ── Bo'lim boshlig'i bali — FAQAT shuni tahrirlash mumkin ── */}
            <div className="mb-5">
              <label className="block text-sm font-bold mb-1.5" style={{color:"#0A1629"}}>
                Bo'lim boshlig'i bali
                <span className="ml-2 text-xs font-normal" style={{color:"#91929E"}}>(0 — {MAX_BOLIM})</span>
              </label>
              <input type="number" min={0} max={MAX_BOLIM}
                placeholder={`0 — ${MAX_BOLIM}`}
                value={inputBolim}
                onChange={e=>setInputBolim(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 text-lg font-bold outline-none text-center"
                style={{
                  background:"#F4F9FD", borderRadius:14, color:"#0A1629",
                  border: inputBolim && (Number(inputBolim)>MAX_BOLIM||Number(inputBolim)<0)
                    ? "2px solid #FF5C5C" : "2px solid #3F8CFF",
                }}/>
              {inputBolim && !isNaN(Number(inputBolim)) && Number(inputBolim)>=0 && Number(inputBolim)<=MAX_BOLIM && (
                <div className="mt-1.5 h-1.5 rounded-full" style={{background:"#EEF2FF"}}>
                  <div className="h-full rounded-full transition-all"
                    style={{width:`${Math.round(Number(inputBolim)/MAX_BOLIM*100)}%`,background:"#3F8CFF"}}/>
                </div>
              )}
            </div>

            {/* ── Boshqa ballar — FAQAT KO'RSATISH (read-only) ── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                {label:"Kadrlar",  val:activeRow.kadrBall,     max:MAX_KADR,     color:"#FF8C42"},
                {label:"Direktor", val:activeRow.direktorBall, max:MAX_DIREKTOR, color:"#6D5DD3"},
                {label:"Ijro",     val:activeRow.ijroBall,     max:MAX_IJRO,     color:"#00C48C"},
              ].map(b=>(
                <div key={b.label} className="px-3 py-3 text-center" style={{background:"#F4F9FD",borderRadius:14}}>
                  <p className="text-xs mb-1" style={{color:"#91929E"}}>{b.label}</p>
                  <p className="font-bold text-lg" style={{color:b.color}}>
                    {b.val != null ? b.val : "—"}
                    <span className="text-xs font-normal ml-0.5" style={{color:"#91929E"}}>/{b.max}</span>
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs mb-4 px-1" style={{color:"#91929E"}}>
              ℹ️ Siz faqat <b style={{color:"#3F8CFF"}}>bo'lim boshlig'i balini</b> bera olasiz.
              Kadrlar, direktor va ijro nazorati ballari boshqa rahbarlar tomonidan qo'yiladi.
            </p>

            {/* Jami preview */}
            <div className="flex items-center justify-between px-4 py-3 mb-5 rounded-2xl"
              style={{background:"rgba(63,140,255,0.08)"}}>
              <span className="text-sm font-bold" style={{color:"#3F8CFF"}}>
                <TrendingUp size={14} className="inline mr-1"/>Umumiy jami
              </span>
              <span className="font-bold text-lg" style={{color:"#0A1629"}}>
                {(Number(inputBolim)||0)+(activeRow.kadrBall||0)+(activeRow.direktorBall||0)+(activeRow.ijroBall||0)}
                <span className="text-sm font-normal ml-1" style={{color:"#91929E"}}>/{MAX_TOTAL}</span>
              </span>
            </div>

            <div className="flex gap-3">
              <button onClick={()=>setModalId(null)}
                className="flex-1 py-3 font-bold text-sm"
                style={{background:"#F4F9FD",borderRadius:14,color:"#7D8592"}}>
                Bekor qilish
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{background:"#3F8CFF",borderRadius:14,boxShadow:"0px 6px 12px rgba(63,140,255,0.263686)"}}>
                {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
