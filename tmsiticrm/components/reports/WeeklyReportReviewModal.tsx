"use client";

import { useState } from "react";
import {
  X, FileText, Download, CheckCircle2, Clock, Save, Loader2, Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export interface WeekRow {
  id: number;
  week: number;
  week_label: string | null;
  max_ball: number | null;
  is_current: boolean;
  file_name: string | null;
  uploaded_at: string | null;
  ball: number | null;
  confirmed_at: string | null;
}

interface Props {
  employeeName: string;
  position?: string;
  weeks: WeekRow[];
  readOnly?: boolean;        // true — o'zining qatori, ball qo'ya olmaydi
  onClose: () => void;
  onScored: () => void;      // ball qo'yilgandan keyin ota komponentni yangilash
}

export default function WeeklyReportReviewModal({ employeeName, position, weeks, readOnly, onClose, onScored }: Props) {
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  async function confirmWeek(w: WeekRow) {
    const raw = inputs[w.id];
    const val = Number(raw);
    if (raw === undefined || raw === "" || isNaN(val) || val < 0 || val > (w.max_ball ?? 0)) return;
    setSavingId(w.id);
    try {
      await apiFetch(`/reports/weekly/${w.id}/score`, {
        method: "POST",
        body: JSON.stringify({ ball: val }),
      });
      onScored();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xato");
    } finally {
      setSavingId(null);
    }
  }

  async function downloadFile(reportId: number, fileName: string) {
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/reports/weekly/file/${reportId}`);
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name || fileName;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    }
  }

  const totalConfirmed = weeks.filter(w => w.confirmed_at).reduce((s, w) => s + (w.ball ?? 0), 0);
  const totalMax = weeks.reduce((s, w) => s + (w.max_ball ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[85vh] overflow-y-auto"
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 sticky top-0" style={{ background: "#FFFFFF", borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>{employeeName}</h3>
            {position && <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{position}</p>}
            <p className="text-xs mt-1 font-bold" style={{ color: "#3F8CFF" }}>
              Jami: {totalConfirmed} / {totalMax} ball
            </p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center flex-shrink-0"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#91929E" }}/>
          </button>
        </div>

        {/* Weeks */}
        <div className="p-6 flex flex-col gap-3">
          {weeks.map(w => {
            const hasFile = !!w.file_name;
            const isConfirmed = !!w.confirmed_at;
            return (
              <div key={w.week} className="p-4" style={{ background: "#FAFCFF", borderRadius: 16, border: "1.5px solid #EEF2FF" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#91929E" }}>
                    <Calendar size={13}/> {w.week_label || `${w.week}-hafta`}
                  </span>
                  {isConfirmed && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1"
                      style={{ background: "rgba(0,196,140,0.1)", color: "#00C48C", borderRadius: 8 }}>
                      <CheckCircle2 size={11}/> {w.ball} ball
                    </span>
                  )}
                </div>

                {!hasFile ? (
                  <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                    <FileText size={14} style={{ color: "#C4CBD6" }}/>
                    <span className="text-xs" style={{ color: "#C4CBD6" }}>Hali fayl yuklanmagan</span>
                  </div>
                ) : (
                  <>
                    <button onClick={() => downloadFile(w.id, w.file_name!)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 hover:opacity-80 transition-opacity"
                      style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #EEF2FF" }}>
                      <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }}/>
                      <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>{w.file_name}</span>
                      <Download size={13} style={{ color: "#91929E", flexShrink: 0 }}/>
                    </button>

                    {!isConfirmed && !readOnly && (
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={w.max_ball ?? 0} step={0.25}
                          placeholder={`0 — ${w.max_ball}`}
                          value={inputs[w.id] ?? ""}
                          onChange={e => setInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                          className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                          style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #3F8CFF30", color: "#0A1629" }}/>
                        <button onClick={() => confirmWeek(w)} disabled={savingId === w.id}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                          style={{ background: "#3F8CFF", borderRadius: 10 }}>
                          {savingId === w.id ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                          Tasdiqlash
                        </button>
                      </div>
                    )}
                    {!isConfirmed && readOnly && (
                      <span className="flex items-center gap-1 text-xs font-bold px-1" style={{ color: "#FFBD21" }}>
                        <Clock size={12}/> Tasdiqlanishi kutilmoqda
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
