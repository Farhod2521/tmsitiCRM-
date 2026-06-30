"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  ChevronRight, List, LayoutGrid, Table2, Search,
  Phone, MoreHorizontal, Loader2, Building2, Users,
  ClipboardList, Activity, Crown, RotateCcw, X,
  Palmtree, Baby, UserCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface ApiDept { id:number; name:string; dept_type:string; order_num:number; }
interface ApiEmp  {
  id:number; full_name:string; position:string;
  department_id:number|null; work_rate:number; phone:string;
  role:string; status:string; is_active:boolean;
}

/* ── Helpers ── */
const DEPT_COLORS = ["#3F8CFF","#00C48C","#FFBD21","#6D5DD3","#15C0E6","#FF5C5C","#FF8C42","#9B59B6"];
function deptColor(id:number){ return DEPT_COLORS[id%DEPT_COLORS.length]; }
function mkAvatar(n:string){ return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2); }

const TYPE_LABEL: Record<string,string> = {
  rahbariyat:"Rahbariyat", bolim:"Bo'lim", boshqarma:"Boshqarma", xizmat:"Xizmat",
};
const ROLE_LABEL: Record<string,string> = {
  superadmin:"Superadmin", direktor:"Direktor", zamdirektor:"Zamdirektor",
  bolim_boshligi:"Bo'lim boshlig'i", boshqarma_boshligi:"Boshqarma boshlig'i",
  xodim:"Xodim", kadr:"Kadr vakili", ijro:"Ijro vakili",
};
const ROLE_BADGE: Record<string,"primary"|"warning"|"success"|"gray"> = {
  superadmin:"primary", direktor:"primary", zamdirektor:"primary",
  bolim_boshligi:"primary", boshqarma_boshligi:"primary",
  kadr:"warning", ijro:"success", xodim:"gray",
};

function isHead(role:string){ return ["bolim_boshligi","boshqarma_boshligi","direktor","zamdirektor"].includes(role); }
type ViewMode = "list"|"table"|"card";

/* ── Role menu config ── */
const ROLE_MENU = [
  { role:"kadr",     icon:ClipboardList, label:"KADR sifatida belgilash",     color:"#FF8C42", bg:"rgba(255,140,66,0.1)"  },
  { role:"ijro",     icon:Activity,      label:"IJRO sifatida belgilash",      color:"#00C48C", bg:"rgba(0,196,140,0.1)"   },
  { role:"direktor", icon:Crown,         label:"DIREKTOR sifatida belgilash",  color:"#6D5DD3", bg:"rgba(109,93,211,0.1)"  },
  { role:"xodim",    icon:RotateCcw,     label:"Rolni tiklash (Xodim)",        color:"#91929E", bg:"rgba(145,146,158,0.1)" },
];

/* ── Xodim holati (status) config ── */
const STATUS_LABEL: Record<string,string> = {
  faol:"Faol", otpuska:"Otpuskada", dekret:"Dekretda",
};
const STATUS_BADGE: Record<string,"success"|"warning"|"purple"> = {
  faol:"success", otpuska:"warning", dekret:"purple",
};
const STATUS_MENU = [
  { status:"otpuska", icon:Palmtree,  label:"Otpuskaga chiqarish", color:"#FFBD21", bg:"rgba(255,189,33,0.1)"  },
  { status:"dekret",  icon:Baby,      label:"Dekretga chiqarish",  color:"#6D5DD3", bg:"rgba(109,93,211,0.1)"  },
  { status:"faol",    icon:UserCheck, label:"Faol holatga qaytarish", color:"#00C48C", bg:"rgba(0,196,140,0.1)" },
];

/* ── Dropdown Menu ── */
function EmpMenu({ emp, color, onRoleChange, onStatusChange }: {
  emp:ApiEmp; color:string; onRoleChange:(id:number,role:string)=>void;
  onStatusChange:(id:number,status:string)=>void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string|null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function click(e:MouseEvent){ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown",click);
    return ()=>document.removeEventListener("mousedown",click);
  },[]);

  async function assign(role:string){
    setSaving("role:"+role);
    try{
      await apiFetch(`/employees/${emp.id}/set-role`,{method:"PATCH",body:JSON.stringify({role})});
      onRoleChange(emp.id,role);
      setOpen(false);
    }catch(e){ alert(e instanceof Error?e.message:"Xato"); }
    finally{setSaving(null);}
  }

  async function assignStatus(status:string){
    setSaving("status:"+status);
    try{
      await apiFetch(`/employees/${emp.id}/set-status`,{method:"PATCH",body:JSON.stringify({status})});
      onStatusChange(emp.id,status);
      setOpen(false);
    }catch(e){ alert(e instanceof Error?e.message:"Xato"); }
    finally{setSaving(null);}
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={()=>setOpen(v=>!v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        style={{color:"#91929E"}}>
        <MoreHorizontal size={16}/>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[270px] overflow-hidden"
          style={{background:"#FFFFFF",borderRadius:18,boxShadow:"0px 12px 40px rgba(10,22,41,0.16)",border:"1px solid #F4F9FD"}}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5" style={{background:"#FAFCFF",borderBottom:"1px solid #F4F9FD"}}>
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
              style={{background:color,borderRadius:9}}>{mkAvatar(emp.full_name)}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{color:"#0A1629"}}>{emp.full_name}</p>
              <p className="text-xs truncate" style={{color:"#91929E"}}>{emp.position}</p>
            </div>
          </div>

          {/* Rol belgilash */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase" style={{color:"#B0B8C8",letterSpacing:"0.06em"}}>Rol belgilash</p>
          </div>
          <div className="px-2 pb-1.5 flex flex-col gap-0.5">
            {ROLE_MENU.map(item=>{
              const Icon = item.icon;
              const isCurrent = emp.role === item.role;
              return (
                <button key={item.role}
                  onClick={()=>!isCurrent && assign(item.role)}
                  disabled={isCurrent || saving==="role:"+item.role}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#F8FAFF] transition-colors disabled:cursor-default"
                  style={{background:isCurrent?"#F8FAFF":"transparent"}}>
                  <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center"
                    style={{background:item.bg,borderRadius:9}}>
                    {saving==="role:"+item.role
                      ? <Loader2 size={12} className="animate-spin" style={{color:item.color}}/>
                      : <Icon size={13} style={{color:item.color}}/>}
                  </div>
                  <span className="text-[13px] font-semibold flex-1 text-left truncate" style={{color:"#0A1629"}}>{item.label}</span>
                  {isCurrent && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5"
                      style={{background:`${item.color}18`,color:item.color,borderRadius:6}}>Joriy</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Xodim holati */}
          <div className="px-4 pt-2.5 pb-1" style={{borderTop:"1px solid #F4F9FD"}}>
            <p className="text-[10px] font-bold uppercase" style={{color:"#B0B8C8",letterSpacing:"0.06em"}}>Xodim holati</p>
          </div>
          <div className="px-2 pb-1.5 flex flex-col gap-0.5">
            {STATUS_MENU.filter(item=>item.status!==emp.status).map(item=>{
              const Icon = item.icon;
              return (
                <button key={item.status}
                  onClick={()=>assignStatus(item.status)}
                  disabled={saving==="status:"+item.status}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#F8FAFF] transition-colors">
                  <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center"
                    style={{background:item.bg,borderRadius:9}}>
                    {saving==="status:"+item.status
                      ? <Loader2 size={12} className="animate-spin" style={{color:item.color}}/>
                      : <Icon size={13} style={{color:item.color}}/>}
                  </div>
                  <span className="text-[13px] font-semibold flex-1 text-left truncate" style={{color:"#0A1629"}}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Yopish */}
          <div className="px-2 py-1.5" style={{borderTop:"1px solid #F4F9FD"}}>
            <button onClick={()=>setOpen(false)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#F8FAFF] transition-colors">
              <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{background:"#F4F9FD",borderRadius:9}}>
                <X size={13} style={{color:"#91929E"}}/>
              </div>
              <span className="text-[13px] font-semibold" style={{color:"#91929E"}}>Yopish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════ MAIN PAGE ═══ */
export default function BolimlarPage() {
  const [depts,      setDepts]      = useState<ApiDept[]>([]);
  const [allEmps,    setAllEmps]    = useState<ApiEmp[]>([]);
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>("list");
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");

  const loadData = useCallback(async()=>{
    setLoading(true);
    try{
      const [d,e] = await Promise.all([
        apiFetch<ApiDept[]>("/departments/"),
        apiFetch<ApiEmp[]>("/employees/"),
      ]);
      const sorted=[...d].sort((a,b)=>(a.order_num||a.id)-(b.order_num||b.id));
      setDepts(sorted); setAllEmps(e);
      if(sorted.length && selectedId==null) setSelectedId(sorted[0].id);
    }catch(err){console.error(err);}
    finally{setLoading(false);}
  },[selectedId]);

  useEffect(()=>{loadData();},[]);// eslint-disable-line

  function handleRoleChange(empId:number, role:string){
    setAllEmps(prev=>prev.map(e=>e.id===empId?{...e,role}:e));
  }

  function handleStatusChange(empId:number, status:string){
    setAllEmps(prev=>prev.map(e=>e.id===empId?{...e,status,is_active:status==="faol"}:e));
  }

  const selected   = depts.find(d=>d.id===selectedId);
  const deptEmps   = allEmps.filter(e=>e.department_id===selectedId);
  const filtered   = deptEmps.filter(e=>
    e.full_name.toLowerCase().includes(search.toLowerCase())||
    e.position.toLowerCase().includes(search.toLowerCase())
  );
  const active   = filtered.filter(e=>e.is_active);
  const inactive = filtered.filter(e=>!e.is_active);

  function empCount(id:number){ return allEmps.filter(e=>e.department_id===id).length; }
  function deptHead(id:number){ return allEmps.find(e=>e.department_id===id&&isHead(e.role))?.full_name||"—"; }

  if(loading) return (
    <div>
      <Header title="Bo'limlar" subtitle="Bo'lim va xodimlarni boshqarish"/>
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin" style={{color:"#3F8CFF"}}/>
        <span className="ml-3 font-bold" style={{color:"#0A1629"}}>Yuklanmoqda...</span>
      </div>
    </div>
  );

  const color=selected?deptColor(selected.id):"#3F8CFF";

  return (
    <div>
      <Header title="Bo'limlar" subtitle="Bo'lim va xodimlarni boshqarish"/>
      <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-160px)]">

        {/* ── Left: dept list ── */}
        <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col max-h-72 lg:max-h-none"
          style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24,overflow:"hidden"}}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:"#F4F9FD"}}>
            <span className="font-bold text-sm" style={{color:"#0A1629"}}>Barcha bo'limlar</span>
            <span className="text-xs font-bold px-2 py-1" style={{background:"rgba(63,140,255,0.1)",color:"#3F8CFF",borderRadius:8}}>
              {depts.length}
            </span>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {depts.map(dept=>{
              const isActive=dept.id===selectedId;
              const c=deptColor(dept.id);
              return (
                <li key={dept.id}>
                  <button onClick={()=>{setSelectedId(dept.id);setSearch("");}}
                    className="w-full text-left px-5 py-3 transition-all"
                    style={{background:isActive?"rgba(63,140,255,0.05)":"transparent",borderLeft:isActive?`3px solid ${c}`:"3px solid transparent"}}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center"
                        style={{background:`${c}18`,borderRadius:9}}>
                        <Building2 size={15} style={{color:c}}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate" style={{color:isActive?"#0A1629":"#7D8592"}}>{dept.name}</p>
                        <p className="text-xs" style={{color:"#91929E"}}>{TYPE_LABEL[dept.dept_type]||dept.dept_type} · {empCount(dept.id)} xodim</p>
                      </div>
                      {isActive&&<ChevronRight size={14} style={{color:c}}/>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Right: employees ── */}
        <div className="flex-1 flex flex-col overflow-hidden"
          style={{background:"#FFFFFF",boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)",borderRadius:24}}>

          {/* Panel header */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-6 py-4 border-b flex-shrink-0" style={{borderColor:"#F4F9FD"}}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                style={{background:color,borderRadius:11}}>{selected?mkAvatar(selected.name):"?"}</div>
              <div className="min-w-0">
                <h2 className="font-bold text-base truncate" style={{color:"#0A1629"}}>{selected?.name||"Bo'lim tanlang"}</h2>
                <p className="text-xs truncate" style={{color:"#91929E"}}>Rahbar: {selected?deptHead(selected.id):"—"} · {deptEmps.length} xodim</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-1" style={{background:"#F4F9FD",borderRadius:12}}>
                {([["list",List],["table",Table2],["card",LayoutGrid]] as const).map(([mode,Icon])=>(
                  <button key={mode} onClick={()=>setViewMode(mode)}
                    className="w-9 h-9 flex items-center justify-center transition-all"
                    style={{background:viewMode===mode?"#FFFFFF":"transparent",borderRadius:10,
                      boxShadow:viewMode===mode?"0px 2px 8px rgba(0,0,0,0.08)":"none",
                      color:viewMode===mode?"#3F8CFF":"#91929E"}}>
                    <Icon size={18}/>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 w-full sm:w-[200px]" style={{background:"#F4F9FD",borderRadius:10}}>
                <Search size={15} style={{color:"#91929E"}}/>
                <input className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{color:"#0A1629"}}
                  placeholder="Xodim qidirish..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {deptEmps.length===0?(
              <div className="flex flex-col items-center justify-center py-16">
                <Users size={40} style={{color:"#D9E3F0"}}/>
                <p className="font-bold mt-3" style={{color:"#0A1629"}}>Bu bo'limda xodim yo'q</p>
              </div>
            ):(
              <>
                {/* LIST view */}
                {viewMode==="list" && (
                  <div className="flex flex-col gap-4">
                    <SectionLabel text="Faol xodimlar"/>
                    <div className="grid text-xs font-bold uppercase pb-2 px-4"
                      style={{gridTemplateColumns:"2.2fr 1.3fr 1fr 1fr 40px",color:"#91929E",letterSpacing:"0.05em"}}>
                      <span>Xodim ismi</span><span>Lavozim</span><span>Aloqa</span><span>Rol</span><span/>
                    </div>
                    {active.map(emp=>(
                      <div key={emp.id} className="grid items-center px-4 py-3"
                        style={{gridTemplateColumns:"2.2fr 1.3fr 1fr 1fr 40px",background:"#FAFCFF",borderRadius:14,border:"1px solid #F0F4FF"}}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                            style={{background:color,borderRadius:10}}>{mkAvatar(emp.full_name)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate" style={{color:"#0A1629"}}>{emp.full_name}</p>
                            <p className="text-xs truncate" style={{color:"#91929E"}}>{emp.phone}</p>
                          </div>
                        </div>
                        <p className="text-sm truncate" style={{color:"#7D8592"}}>{emp.position}</p>
                        <p className="text-xs" style={{color:"#7D8592"}}>{emp.work_rate} st.</p>
                        <Badge label={ROLE_LABEL[emp.role]||emp.role} variant={ROLE_BADGE[emp.role]||"gray"}/>
                        <EmpMenu emp={emp} color={color} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange}/>
                      </div>
                    ))}
                    {inactive.length>0&&(
                      <>
                        <SectionLabel text="Nofaol"/>
                        {inactive.map(emp=>(
                          <div key={emp.id} className="grid items-center px-4 py-3 opacity-60"
                            style={{gridTemplateColumns:"2.2fr 1.3fr 1fr 1fr 40px",background:"#F8F8F8",borderRadius:14,border:"1px dashed #E0E0E0"}}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                                style={{background:"#91929E",borderRadius:10}}>{mkAvatar(emp.full_name)}</div>
                              <p className="font-bold text-sm" style={{color:"#0A1629"}}>{emp.full_name}</p>
                            </div>
                            <p className="text-sm" style={{color:"#7D8592"}}>{emp.position}</p>
                            <p className="text-xs" style={{color:"#7D8592"}}>{emp.phone}</p>
                            <Badge label={STATUS_LABEL[emp.status]||"Nofaol"} variant={STATUS_BADGE[emp.status]||"danger"}/>
                            <EmpMenu emp={emp} color={color} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange}/>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* TABLE view */}
                {viewMode==="table"&&(
                  <div>
                    <SectionLabel text="Xodimlar ro'yxati"/>
                    <div className="overflow-x-auto">
                    <table className="w-full mt-3" style={{minWidth:600}}>
                      <thead>
                        <tr style={{borderBottom:"2px solid #F4F9FD"}}>
                          {["#","Xodim","Lavozim","Telefon","Stavka","Rol","Holat",""].map(h=>(
                            <th key={h} className="text-left pb-3 text-xs font-bold uppercase"
                              style={{color:"#91929E",letterSpacing:"0.05em",paddingRight:12}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((emp,i)=>(
                          <tr key={emp.id} className="hover:bg-[#F4F9FD] transition-colors"
                            style={{borderBottom:"1px solid #F4F9FD"}}>
                            <td className="py-3 text-xs font-bold" style={{color:"#91929E",paddingRight:12}}>{i+1}</td>
                            <td className="py-3" style={{paddingRight:12}}>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
                                  style={{background:color,borderRadius:9}}>{mkAvatar(emp.full_name)}</div>
                                <p className="font-bold text-sm" style={{color:"#0A1629"}}>{emp.full_name}</p>
                              </div>
                            </td>
                            <td className="py-3 text-sm" style={{color:"#7D8592",paddingRight:12}}>{emp.position}</td>
                            <td className="py-3 text-xs" style={{color:"#7D8592",paddingRight:12}}>
                              <span className="flex items-center gap-1"><Phone size={11}/>{emp.phone}</span>
                            </td>
                            <td className="py-3 text-sm font-bold" style={{color:"#0A1629",paddingRight:12}}>{emp.work_rate} st.</td>
                            <td className="py-3" style={{paddingRight:12}}>
                              <Badge label={ROLE_LABEL[emp.role]||emp.role} variant={ROLE_BADGE[emp.role]||"gray"}/>
                            </td>
                            <td className="py-3" style={{paddingRight:12}}>
                              {emp.status!=="faol"
                                ? <Badge label={STATUS_LABEL[emp.status]||emp.status} variant={STATUS_BADGE[emp.status]||"gray"}/>
                                : <span className="text-xs" style={{color:"#D9E3F0"}}>—</span>}
                            </td>
                            <td className="py-3">
                              <EmpMenu emp={emp} color={color} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange}/>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {/* CARD view */}
                {viewMode==="card"&&(
                  <div>
                    <SectionLabel text="Xodimlar"/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                      {filtered.map(emp=>(
                        <div key={emp.id} className="p-4"
                          style={{background:"#FAFCFF",borderRadius:16,border:"2px solid #E8F0FF"}}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-11 h-11 flex items-center justify-center font-bold text-white"
                              style={{background:color,borderRadius:12}}>{mkAvatar(emp.full_name)}</div>
                            <EmpMenu emp={emp} color={color} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange}/>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm" style={{color:"#0A1629"}}>{emp.full_name}</p>
                            {emp.status!=="faol" && (
                              <Badge label={STATUS_LABEL[emp.status]||emp.status} variant={STATUS_BADGE[emp.status]||"gray"}/>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 mb-3" style={{color:"#7D8592"}}>{emp.position}</p>
                          <div className="flex items-center gap-1 text-xs mb-1" style={{color:"#91929E"}}>
                            <Phone size={11}/> {emp.phone}
                          </div>
                          <div className="flex items-center justify-between pt-3 mt-2" style={{borderTop:"1px solid #F0F4FF"}}>
                            <span className="text-xs" style={{color:"#91929E"}}>{emp.work_rate} st.</span>
                            <Badge label={ROLE_LABEL[emp.role]||emp.role} variant={ROLE_BADGE[emp.role]||"gray"}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({text}:{text:string}){
  return (
    <div className="px-4 py-2 text-sm font-bold text-center"
      style={{background:"#F4F9FD",borderRadius:10,color:"#0A1629"}}>{text}</div>
  );
}
