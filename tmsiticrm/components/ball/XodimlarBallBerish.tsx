"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Save, RefreshCw, Users, CheckCircle2, Download, FileText,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
export type BallMode = "kadr" | "ijro" | "direktor";

interface EmpScoreRow {
  employee_id:      number;
  full_name:        string;
  position:         string;
  role:             string;
  department_id:    number | null;
  department_name:  string | null;
  bolim_ball:       number | null;
  kadr_ball:        number | null;
  direktor_ball:    number | null;
  ijro_ball:        number | null;
  report_file_name: string | null;
}

interface BallState {
  bolim_ball?:    number | null;
  kadr_ball?:     number | null;
  direktor_ball?: number | null;
  ijro_ball?:     number | null;
}

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];
const DEPT_COLORS = ["#3F8CFF","#00C48C","#FFBD21","#6D5DD3","#15C0E6","#FF5C5C","#FF8C42","#9B59B6"];

const FIELD_CONFIG: Record<BallMode, {key: keyof BallState; max: number; label: string; color: string}[]> = {
  kadr:     [{ key:"kadr_ball",  max:25, label:"KADR",   color:"#FF8C42" }],
  ijro:     [{ key:"ijro_ball",  max:10, label:"IJRO",   color:"#00C48C" }],
  direktor: [
    { key:"bolim_ball", max:65, label:"BO'LIM", color:"#3F8CFF" },
    { key:"kadr_ball",  max:25, label:"KADR",   color:"#FF8C42" },
    { key:"ijro_ball",  max:10, label:"IJRO",   color:"#00C48C" },
  ],
};

function calcJami(r: EmpScoreRow, b: BallState): number | null {
  const bolim = b.bolim_ball !== undefined ? b.bolim_ball : r.bolim_ball;
  const kadr  = b.kadr_ball  !== undefined ? b.kadr_ball  : r.kadr_ball;
  const ijro  = b.ijro_ball  !== undefined ? b.ijro_ball  : r.ijro_ball;
  if (bolim == null && kadr == null && ijro == null) return null;
  return (bolim ?? 0) + (kadr ?? 0) + (ijro ?? 0);
}

function getKpiLabel(total: number | null): { text: string; color: string; bg: string } {
  if (total == null) return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
  if (total >= 96)   return { text: "200%", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" };
  if (total >= 91)   return { text: "150%", color: "#3F8CFF", bg: "rgba(63,140,255,0.10)" };
  if (total >= 86)   return { text: "125%", color: "#00C48C", bg: "rgba(0,196,140,0.10)" };
  if (total >= 81)   return { text: "100%", color: "#FFBD21", bg: "rgba(255,189,33,0.12)" };
  if (total >= 76)   return { text: "75%",  color: "#FF8C42", bg: "rgba(255,140,66,0.12)" };
  if (total >= 70)   return { text: "50%",  color: "#FF5C5C", bg: "rgba(255,92,92,0.10)" };
  return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
}

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2);
}

interface Props { mode: BallMode; }

export default function XodimlarBallBerish({ mode }: Props) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows,  setRows]  = useState<EmpScoreRow[]>([]);
  const [balls, setBalls] = useState<Record<number, BallState>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const fields = FIELD_CONFIG[mode];

  /* ── Load ── */
  const loadData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSaved(false);
    try {
      const data = await apiFetch<EmpScoreRow[]>(`/ball/all-month?year=${y}&month=${m}`);
      setRows(data);

      // Initialize ball states from existing scores
      // direktor mode: faqat DB dagi qiymat, bo'sh bo'lsa null (avtomatik to'ldirmaslik)
      // kadr/ijro mode: bo'sh bo'lsa maksimum bilan to'ldirish
      const init: Record<number, BallState> = {};
      for (const r of data) {
        const def: BallState = {};
        for (const f of fields) {
          const cur = r[f.key as keyof EmpScoreRow] as number | null;
          def[f.key] = cur ?? (mode === "direktor" ? null : f.max);
        }
        init[r.employee_id] = def;
      }
      setBalls(init);

      // Auto-open all departments
      const depts = new Set(data.map(r => r.department_name ?? "Boshqa").filter(Boolean));
      setOpenDepts(new Set(depts));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadData(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); loadData(y, m);
  }

  function updateBall(empId: number, key: keyof BallState, val: number | null) {
    setBalls(prev => ({ ...prev, [empId]: { ...prev[empId], [key]: val } }));
  }

  function setAllDefault() {
    const next: Record<number, BallState> = {};
    for (const r of rows) {
      const def: BallState = {};
      for (const f of fields) def[f.key] = f.max;
      next[r.employee_id] = def;
    }
    setBalls(next);
  }

  /* ── Save ── */
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const emps = rows.map(r => ({
        employee_id:   r.employee_id,
        ...balls[r.employee_id],
      }));
      await apiFetch("/ball/bulk-save", {
        method: "POST",
        body: JSON.stringify({ year, month, employees: emps }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  /* ── Fayl yuklab olish (direktor) ── */
  async function downloadFile(empId: number) {
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(
        `/ball/report/${empId}/${year}/${month}`
      );
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    }
  }

  /* ── Group by dept ── */
  const grouped = new Map<string, EmpScoreRow[]>();
  for (const r of rows) {
    const key = r.department_name ?? "Boshqa";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const deptList = Array.from(grouped.entries());

  const totalEmps = rows.length;
  const filledCount = rows.filter(r => {
    const b = balls[r.employee_id];
    return b && fields.every(f => b[f.key] != null);
  }).length;

  const modeTitle = mode === "kadr" ? "Kadr ball berish" : mode === "ijro" ? "Ijro ball berish" : "Direktor — barcha ballar";
  const modeColor = mode === "kadr" ? "#FF8C42" : mode === "ijro" ? "#00C48C" : "#6D5DD3";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)" }}>

        {/* Month nav */}
        <div className="flex items-center gap-2 p-1" style={{ background:"#F4F9FD", borderRadius:12 }}>
          <button onClick={() => chMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
            <ChevronLeft size={15} style={{ color:"#3F8CFF" }}/>
          </button>
          <span className="px-3 font-bold text-sm" style={{ color:"#0A1629", minWidth:115, textAlign:"center" }}>
            {MON_NAMES[month-1]} {year}
          </span>
          <button onClick={() => chMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
            <ChevronRight size={15} style={{ color:"#3F8CFF" }}/>
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2"
            style={{ background:"rgba(63,140,255,0.06)", borderRadius:12 }}>
            <Users size={14} style={{ color:"#3F8CFF" }}/>
            <span className="text-sm font-bold" style={{ color:"#0A1629" }}>{totalEmps} xodim</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2"
            style={{ background:"rgba(0,196,140,0.06)", borderRadius:12 }}>
            <CheckCircle2 size={14} style={{ color:"#00C48C" }}/>
            <span className="text-sm font-bold" style={{ color:"#0A1629" }}>{filledCount}/{totalEmps} baholangan</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {mode !== "direktor" && (
            <button onClick={setAllDefault}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold"
              style={{ background:"#F4F9FD", borderRadius:12, color:"#7D8592" }}>
              <RefreshCw size={14}/> Default
            </button>
          )}
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{
              background: saved ? "#00C48C" : modeColor,
              borderRadius: 12,
              boxShadow: `0px 6px 12px ${modeColor}40`,
            }}>
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
            {saving ? "Saqlanmoqda..." : saved ? "Saqlandi ✓" : "Saqlash"}
          </button>
        </div>
      </div>

      {/* ── Main card ── */}
      <div style={{ background:"#FFFFFF", borderRadius:24, boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)" }}>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: modeColor }}/>
            <span className="ml-2 font-bold text-sm" style={{ color: modeColor }}>Yuklanmoqda…</span>
          </div>
        ) : (
          <div className="py-2">
            {deptList.map(([deptName, deptRows], di) => {
              const isOpen = openDepts.has(deptName);
              const deptColor = DEPT_COLORS[di % DEPT_COLORS.length];

              return (
                <div key={deptName} style={{ borderBottom:"1px solid #F4F9FD" }}>
                  {/* Department accordion header */}
                  <button
                    onClick={() => {
                      setOpenDepts(prev => {
                        const next = new Set(prev);
                        if (next.has(deptName)) next.delete(deptName);
                        else next.add(deptName);
                        return next;
                      });
                    }}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-[#FAFCFF] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: deptColor, borderRadius: 10 }}>
                        {deptName.slice(0,2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm" style={{ color:"#0A1629" }}>{deptName}</p>
                        <p className="text-xs" style={{ color:"#91929E" }}>{deptRows.length} xodim</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1"
                        style={{ background:`${deptColor}18`, color:deptColor, borderRadius:8 }}>
                        {deptRows.filter(r => balls[r.employee_id] && fields.every(f => balls[r.employee_id][f.key] != null)).length}/{deptRows.length}
                      </span>
                      {isOpen
                        ? <ChevronUp size={16} style={{ color:"#91929E" }}/>
                        : <ChevronDown size={16} style={{ color:"#91929E" }}/>}
                    </div>
                  </button>

                  {/* Employee rows */}
                  {isOpen && (
                    <div>
                      {/* Table header */}
                      <div className="grid px-6 py-2 text-xs font-bold uppercase tracking-wide"
                        style={{
                          gridTemplateColumns: `50px 2fr ${fields.map(()=>"100px").join(" ")} 90px 100px${mode==="direktor"?" 120px":""}`,
                          color:"#91929E", letterSpacing:"0.05em",
                          background:"#F8FAFF",
                        }}>
                        <span>#</span>
                        <span>Xodim</span>
                        {fields.map(f => (
                          <span key={f.key} className="text-center" style={{ color: f.color }}>
                            {f.label} <span className="font-normal">/{f.max}</span>
                          </span>
                        ))}
                        <span className="text-center" style={{ color:"#0A1629" }}>JAMI</span>
                        <span className="text-center" style={{ color:"#6D5DD3" }}>KPI FOIZ</span>
                        {mode === "direktor" && (
                          <span className="text-center" style={{ color:"#3F8CFF" }}>Hisobot</span>
                        )}
                      </div>

                      {deptRows.map((r, idx) => {
                        const b = balls[r.employee_id] ?? {};
                        const jami = calcJami(r, b);
                        const kpi  = getKpiLabel(jami);
                        return (
                          <div key={r.employee_id}
                            className="grid items-center px-6 py-3 hover:bg-[#FAFCFF] transition-colors"
                            style={{
                              gridTemplateColumns: `50px 2fr ${fields.map(()=>"100px").join(" ")} 90px 100px${mode==="direktor"?" 120px":""}`,
                              borderTop: "1px solid #F4F9FD",
                            }}>
                            <span className="text-xs font-bold" style={{ color:"#91929E" }}>{idx+1}</span>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: deptColor, borderRadius:10 }}>
                                {mkAvatar(r.full_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color:"#0A1629" }}>{r.full_name}</p>
                                <p className="text-xs truncate" style={{ color:"#91929E" }}>{r.position}</p>
                              </div>
                            </div>
                            {fields.map(f => {
                              const val = b[f.key];
                              const numVal = val != null ? Number(val) : null;
                              const pct = numVal != null ? Math.round(numVal / f.max * 100) : 0;
                              return (
                                <div key={f.key} className="flex flex-col items-center gap-1 px-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={f.max}
                                    value={val ?? ""}
                                    onChange={e => {
                                      const v = e.target.value === "" ? null : Number(e.target.value);
                                      updateBall(r.employee_id, f.key, v);
                                    }}
                                    className="w-full text-center font-bold text-sm outline-none px-2 py-1.5"
                                    style={{
                                      background: "#F4F9FD",
                                      borderRadius: 10,
                                      color: "#0A1629",
                                      border: numVal != null && (numVal < 0 || numVal > f.max)
                                        ? `2px solid #FF5C5C`
                                        : `1.5px solid ${f.color}30`,
                                    }}
                                  />
                                  {/* mini progress */}
                                  <div className="w-full h-1 rounded-full" style={{ background:"#EEF2FF" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width:`${pct}%`, background: f.color }}/>
                                  </div>
                                </div>
                              );
                            })}
                            {/* JAMI */}
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="font-bold text-sm" style={{ color: jami != null ? "#0A1629" : "#C4CBD6" }}>
                                {jami != null ? jami : "—"}
                              </span>
                              <span className="text-xs" style={{ color:"#C4CBD6" }}>/100</span>
                            </div>

                            {/* KPI FOIZ */}
                            <div className="flex justify-center">
                              <span className="px-2.5 py-1 text-xs font-bold"
                                style={{ background: kpi.bg, color: kpi.color, borderRadius: 8 }}>
                                {kpi.text}
                              </span>
                            </div>

                            {/* Hisobot ustuni — faqat direktor */}
                            {mode === "direktor" && (
                              <div className="flex justify-center">
                                {r.report_file_name ? (
                                  <button
                                    onClick={() => downloadFile(r.employee_id)}
                                    title={r.report_file_name}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80 transition-opacity"
                                    style={{ background:"rgba(109,93,211,0.1)", borderRadius:10, color:"#6D5DD3" }}>
                                    <Download size={12}/>
                                    Yuklab ol
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-3 py-2"
                                    style={{ background:"#F4F9FD", borderRadius:10 }}>
                                    <FileText size={12} style={{ color:"#C4CBD6" }}/>
                                    <span className="text-xs" style={{ color:"#C4CBD6" }}>Yo'q</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="py-16 text-center">
                <Users size={36} style={{ color:"#D9E3F0", margin:"0 auto" }}/>
                <p className="font-bold mt-3" style={{ color:"#0A1629" }}>Xodimlar topilmadi</p>
              </div>
            )}
          </div>
        )}
        <div className="pb-2"/>
      </div>
    </div>
  );
}
