"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  ChevronLeft, ChevronRight, ClipboardCheck, Loader2,
  Users, CheckCircle2, Clock, FileText, Send, X, CheckCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WeekRow } from "@/components/reports/WeeklyReportReviewModal";
import DeptHeadReviewModal from "@/components/reports/DeptHeadReviewModal";

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];
const AVATAR_COLORS = ["#3F8CFF","#6D5DD3","#00C48C","#FFBD21","#FF5C5C","#15C0E6","#FF8C42"];

interface ApiTeamRow {
  employee_id: number; full_name: string; position: string;
  department_name: string | null; weeks: WeekRow[]; bolim_ball: number | null;
}

function mkAvatar(n: string) { return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2); }

function getStatus(weeks: WeekRow[]): "Baholangan"|"Qisman"|"Kutilmoqda" {
  const total = weeks.length;
  const confirmed = weeks.filter(w=>w.confirmed_at).length;
  if (total>0 && confirmed===total) return "Baholangan";
  if (confirmed>0) return "Qisman";
  return "Kutilmoqda";
}
const statusVariant: Record<string,"success"|"warning"|"danger"> = {
  Baholangan:"success", Qisman:"warning", Kutilmoqda:"danger",
};

export default function HisobotlarPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [rows, setRows]   = useState<ApiTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<ApiTeamRow|null>(null);

  /* ── Telegram xabar yuborish ── */
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyText, setNotifyText] = useState("");
  const [notifyCount, setNotifyCount] = useState(0);
  const [notifySent, setNotifySent] = useState(false);

  const load = useCallback(async (y:number, m:number) => {
    setLoading(true);
    try {
      const data = await apiFetch<ApiTeamRow[]>(`/reports/weekly/team?year=${y}&month=${m}`);
      setRows(data);
      return data;
    } catch (e) { console.error(e); return []; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month+dir; let y = year;
    if (m<1) { m=12; y--; } if (m>12) { m=1; y++; }
    setYear(y); setMonth(m); load(y,m);
  }

  async function refreshAfterScore() {
    const next = await load(year, month);
    setReviewTarget(prev => prev ? next.find(r=>r.employee_id===prev.employee_id) ?? null : null);
  }

  async function openNotify() {
    setNotifyOpen(true);
    setNotifySent(false);
    setNotifyLoading(true);
    try {
      const d = await apiFetch<{ text: string; count: number }>("/reports/weekly/pending-message");
      setNotifyText(d.text);
      setNotifyCount(d.count);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xabarni tayyorlashda xato");
      setNotifyOpen(false);
    } finally {
      setNotifyLoading(false);
    }
  }

  async function sendNotify() {
    if (!notifyText.trim()) return;
    setNotifySending(true);
    try {
      await apiFetch("/reports/weekly/send-telegram", {
        method: "POST",
        body: JSON.stringify({ text: notifyText }),
      });
      setNotifySent(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Yuborishda xato");
    } finally {
      setNotifySending(false);
    }
  }

  const total      = rows.length;
  const rated      = rows.filter(r => getStatus(r.weeks)==="Baholangan").length;
  const withReport = rows.filter(r => r.weeks.some(w=>w.file_name)).length;
  const pending    = total - rated;

  const statCards = [
    { label: "Bo'lim boshliqlari", value: total,      icon: Users,        color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
    { label: "Baholangan",         value: rated,       icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
    { label: "Hisobot yuklangan",  value: withReport,  icon: FileText,     color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
    { label: "Kutilmoqda",         value: pending,     icon: Clock,        color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
  ];

  return (
    <div>
      <Header title="Hisobotlar" subtitle="Bo'lim boshliqlarining haftalik hisobotlarini tasdiqlash" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="p-5 flex items-center gap-4"
            style={{ background:"#FFFFFF", boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)", borderRadius:20 }}>
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background:s.bg, borderRadius:13 }}>
              <s.icon size={20} style={{ color:s.color }}/>
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight" style={{ color:"#0A1629" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div style={{ background:"#FFFFFF", boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)", borderRadius:24 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom:"1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color:"#0A1629" }}>Bo'lim boshliqlari</h2>
            <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>Haftalik hisobotlarni ko'rib, ball qo'ying</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={openNotify}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background:"#0088CC", borderRadius:12, boxShadow:"0px 6px 12px rgba(0,136,204,0.3)" }}>
              <Send size={15}/> Xabar yuborish
            </button>
            <div className="flex items-center gap-1 p-1" style={{ background:"#F4F9FD", borderRadius:12 }}>
              <button onClick={()=>chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronLeft size={15} style={{ color:"#3F8CFF" }}/>
              </button>
              <span className="px-3 font-bold text-sm" style={{ color:"#0A1629", minWidth:110, textAlign:"center" }}>
                {MON_NAMES[month-1]} {year}
              </span>
              <button onClick={()=>chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronRight size={15} style={{ color:"#3F8CFF" }}/>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={26} className="animate-spin" style={{ color:"#3F8CFF" }}/>
          </div>
        ) : rows.length===0 ? (
          <div className="py-16 text-center">
            <Users size={36} style={{ color:"#D9E3F0", margin:"0 auto" }}/>
            <p className="font-bold mt-3" style={{ color:"#0A1629" }}>Bo'lim boshliqlari topilmadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 700 }} className="px-6 py-4">
              <div className="grid px-4 py-2.5 mb-1 text-xs font-bold uppercase tracking-wide"
                style={{ gridTemplateColumns:"2fr 1.5fr 110px 1fr 140px", color:"#91929E", letterSpacing:"0.05em", background:"#F4F9FD", borderRadius:12 }}>
                <span>Boshliq</span><span>Bo'lim</span><span className="text-center">Jami ball</span><span>Holat</span><span className="text-right">Amallar</span>
              </div>
              <div className="flex flex-col">
                {rows.map((r,i) => {
                  const st = getStatus(r.weeks);
                  const pendingCount = r.weeks.filter(w=>w.file_name && !w.confirmed_at).length;
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <div key={r.employee_id} className="grid items-center px-4 py-3.5 hover:bg-[#FAFCFF] transition-colors"
                      style={{ gridTemplateColumns:"2fr 1.5fr 110px 1fr 140px", borderBottom: i<rows.length-1 ? "1px solid #F4F9FD" : "none" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background:color, borderRadius:11 }}>{mkAvatar(r.full_name)}</div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color:"#0A1629" }}>{r.full_name}</p>
                          <p className="text-xs truncate" style={{ color:"#91929E" }}>{r.position}</p>
                        </div>
                      </div>
                      <p className="text-sm truncate" style={{ color:"#7D8592" }}>{r.department_name || "—"}</p>
                      <div className="text-center">
                        <span className="text-base font-bold" style={{ color:"#0A1629" }}>{r.bolim_ball ?? "—"}</span>
                        <span className="text-xs" style={{ color:"#91929E" }}> /65</span>
                      </div>
                      <div><Badge label={st} variant={statusVariant[st]}/></div>
                      <div className="flex justify-end">
                        <button onClick={()=>setReviewTarget(r)}
                          className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white hover:opacity-80"
                          style={{ background:"#3F8CFF", borderRadius:10, boxShadow:"0px 4px 10px rgba(63,140,255,0.25)" }}>
                          <ClipboardCheck size={13}/> Hisobot
                          {pendingCount>0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background:"#FF5C5C", borderRadius:"50%" }}>{pendingCount}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <div className="pb-2"/>
      </div>

      {reviewTarget && (
        <DeptHeadReviewModal
          headId={reviewTarget.employee_id}
          headName={reviewTarget.full_name}
          headPosition={reviewTarget.position}
          weeks={reviewTarget.weeks}
          year={year}
          month={month}
          onClose={()=>setReviewTarget(null)}
          onScored={refreshAfterScore}
        />
      )}

      {/* ── Telegram xabar yuborish modali ── */}
      {notifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(10,22,41,0.55)", backdropFilter:"blur(4px)" }}
          onClick={()=>setNotifyOpen(false)}>
          <div className="w-full max-w-[520px] p-7 relative"
            style={{ background:"#FFFFFF", borderRadius:24, boxShadow:"0px 30px 80px rgba(0,0,0,0.2)" }}
            onClick={e=>e.stopPropagation()}>

            <button onClick={()=>setNotifyOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{ background:"#F4F9FD", borderRadius:10 }}>
              <X size={15} style={{ color:"#91929E" }}/>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center"
                style={{ background:"rgba(0,136,204,0.1)", borderRadius:14 }}>
                <Send size={20} style={{ color:"#0088CC" }}/>
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color:"#0A1629" }}>Telegram orqali eslatish</h3>
                <p className="text-xs" style={{ color:"#91929E" }}>Guruhga avtomatik xabar yuboriladi</p>
              </div>
            </div>

            {notifyLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 size={24} className="animate-spin" style={{ color:"#3F8CFF" }}/>
              </div>
            ) : notifySent ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 flex items-center justify-center mb-3" style={{ background:"rgba(0,196,140,0.1)", borderRadius:18 }}>
                  <CheckCheck size={26} style={{ color:"#00C48C" }}/>
                </div>
                <p className="font-bold text-base" style={{ color:"#0A1629" }}>Xabar yuborildi</p>
                <p className="text-sm mt-1" style={{ color:"#91929E" }}>Telegram guruhiga muvaffaqiyatli jo'natildi</p>
                <button onClick={()=>setNotifyOpen(false)}
                  className="mt-5 px-6 py-2.5 font-bold text-sm" style={{ background:"#F4F9FD", borderRadius:12, color:"#7D8592" }}>
                  Yopish
                </button>
              </div>
            ) : notifyCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 flex items-center justify-center mb-3" style={{ background:"rgba(0,196,140,0.1)", borderRadius:18 }}>
                  <CheckCheck size={26} style={{ color:"#00C48C" }}/>
                </div>
                <p className="font-bold text-base" style={{ color:"#0A1629" }}>Hammasi topshirilgan</p>
                <p className="text-sm mt-1" style={{ color:"#91929E" }}>Joriy hafta uchun hisobot topshirmaganlar yo'q</p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-bold mb-2" style={{ color:"#0A1629" }}>
                  Xabar matni
                  <span className="ml-2 text-xs font-normal" style={{ color:"#91929E" }}>({notifyCount} kishi)</span>
                </label>
                <textarea rows={9} value={notifyText} onChange={e=>setNotifyText(e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none resize-none"
                  style={{ background:"#F4F9FD", borderRadius:14, color:"#0A1629", border:"1.5px solid #EEF2FF", lineHeight:1.6 }}/>
                <div className="flex gap-3 mt-5">
                  <button onClick={()=>setNotifyOpen(false)}
                    className="flex-1 py-3 font-bold text-sm" style={{ background:"#F4F9FD", borderRadius:14, color:"#7D8592" }}>
                    Bekor qilish
                  </button>
                  <button onClick={sendNotify} disabled={notifySending}
                    className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background:"#0088CC", borderRadius:14, boxShadow:"0px 6px 12px rgba(0,136,204,0.3)" }}>
                    {notifySending ? <Loader2 size={16} className="animate-spin"/> : <Send size={15}/>}
                    {notifySending ? "Yuborilmoqda..." : "Yuborish"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
