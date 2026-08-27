"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Clock, CheckCircle2, XCircle, LogIn, LogOut, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const STATUS_LABEL: Record<string, string> = {
  "status_MT": "MT", "status_O'": "O'", "status_K": "K", "status_B": "B", "status_Д": "Д",
};
const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  kelgan:    { color: "#00A578", bg: "rgba(0,196,140,0.1)" },
  kelmagan:  { color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
  dam_olish: { color: "#B8C2D6", bg: "#F4F9FD" },
  kelajak:   { color: "#D9E3F0", bg: "#FFFFFF" },
  "status_MT": { color: "#B4780C", bg: "rgba(255,189,33,0.15)" },
  "status_O'": { color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
  "status_K":  { color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  "status_B":  { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  "status_Д":  { color: "#91929E", bg: "rgba(145,146,158,0.12)" },
};

interface DayDetail {
  day: number;
  weekday: number;
  status: string;
  check_in: string | null;
  check_out: string | null;
  worked_minutes: number | null;
}
interface EmployeeMonth {
  employee_id: number;
  full_name: string;
  position: string;
  department_name: string | null;
  days: DayDetail[];
  kelgan_kunlar: number;
  kelmagan_kunlar: number;
  jami_ish_soati_min: number;
}

function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function TurniketEmployeeMonthModal({
  employeeId, year, month, onClose,
}: { employeeId: number; year: number; month: number; onClose: () => void }) {
  const [data, setData] = useState<EmployeeMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<EmployeeMonth>(`/turniket/employee/${employeeId}?year=${year}&month=${month}`)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, [employeeId, year, month]);

  const calWeeks: (DayDetail | null)[][] = [];
  if (data) {
    const padLeft = data.days[0]?.weekday ?? 0;
    const cells: (DayDetail | null)[] = [...Array(padLeft).fill(null), ...data.days];
    while (cells.length % 7 !== 0) cells.push(null);
    for (let i = 0; i < cells.length; i += 7) calWeeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl my-6" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0 20px 60px rgba(10,22,41,0.3)" }}
        onClick={e => e.stopPropagation()}>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
          </div>
        ) : error || !data ? (
          <div className="py-24 text-center">
            <p className="font-bold" style={{ color: "#FF5C5C" }}>{error || "Xatolik yuz berdi"}</p>
            <button onClick={onClose} className="mt-4 px-5 py-2.5 text-sm font-bold text-white" style={{ background: "#3F8CFF", borderRadius: 10 }}>Yopish</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 px-6 py-5" style={{ borderBottom: "2px solid #F4F9FD" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#3F8CFF" }}>
                  {mkAvatar(data.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: "#0A1629" }}>{data.full_name}</p>
                  <p className="text-xs font-bold" style={{ color: "#3F8CFF" }}>{data.position}</p>
                  {data.department_name && (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "#91929E" }}>
                      <Building2 size={11} /> {data.department_name}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70 flex-shrink-0" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                <X size={16} style={{ color: "#7D8592" }} />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-xs font-bold mb-3" style={{ color: "#91929E", letterSpacing: "0.04em" }}>
                {MON_NAMES[month - 1]} {year} — TURNIKET KALENDARI
              </p>

              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {WEEK_DAYS.map(d => (
                  <span key={d} className="text-center text-[10px] font-bold" style={{ color: "#91929E" }}>{d}</span>
                ))}
              </div>
              {calWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {week.map((cd, di) => {
                    if (!cd) return <div key={di} />;
                    const cfg = STATUS_CFG[cd.status] || STATUS_CFG.kelajak;
                    const leaveLabel = STATUS_LABEL[cd.status];
                    return (
                      <div key={di} className="min-h-[58px] flex flex-col items-center justify-center gap-0.5 py-1"
                        style={{ background: cfg.bg, borderRadius: 10 }}>
                        <span className="text-[10px] font-bold" style={{ color: cd.status === "kelajak" ? "#C4CBD6" : "#0A1629" }}>{cd.day}</span>
                        {leaveLabel ? (
                          <span className="text-[9px] font-bold" style={{ color: cfg.color }}>{leaveLabel}</span>
                        ) : cd.status === "kelgan" ? (
                          <>
                            {cd.check_in && (
                              <span className="flex items-center gap-0.5 text-[8px] font-bold leading-none" style={{ color: "#00A578" }}>
                                <LogIn size={8} /> {cd.check_in}
                              </span>
                            )}
                            {cd.check_out && (
                              <span className="flex items-center gap-0.5 text-[8px] font-bold leading-none" style={{ color: "#FF8C42" }}>
                                <LogOut size={8} /> {cd.check_out}
                              </span>
                            )}
                          </>
                        ) : cd.status === "kelmagan" ? (
                          <XCircle size={10} style={{ color: cfg.color }} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex items-center gap-4 flex-wrap mt-3 pt-3" style={{ borderTop: "1px solid #F4F9FD" }}>
                {[["kelgan", "Kelgan"], ["kelmagan", "Kelmagan"], ["dam_olish", "Dam olish kuni"]].map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#91929E" }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CFG[k].color }} />
                    {l}
                  </span>
                ))}
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#91929E" }}>
                  <LogIn size={10} style={{ color: "#00A578" }} /> Kirish
                </span>
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#91929E" }}>
                  <LogOut size={10} style={{ color: "#FF8C42" }} /> Chiqish
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { label: "Jami ish soati", value: fmtHM(data.jami_ish_soati_min), suffix: "soat", icon: Clock, color: "#3F8CFF" },
                  { label: "Kelgan kunlar", value: data.kelgan_kunlar, suffix: "kun", icon: CheckCircle2, color: "#00C48C" },
                  { label: "Kelmagan kunlar", value: data.kelmagan_kunlar, suffix: "kun", icon: XCircle, color: "#FF5C5C" },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center justify-center text-center p-3" style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                    <s.icon size={18} style={{ color: s.color }} />
                    <span className="font-bold text-base mt-1" style={{ color: "#0A1629" }}>{s.value}</span>
                    <span className="text-[10px]" style={{ color: "#91929E" }}>{s.suffix}</span>
                    <span className="text-[10px] mt-0.5 leading-tight" style={{ color: "#A8B0BD" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
