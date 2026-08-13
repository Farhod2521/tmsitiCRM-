"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, FileText, Download, CheckCircle2, Clock, Save, Loader2, Calendar, Users, Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WeekRow } from "./WeeklyReportReviewModal";

interface WeeklyFile { id: number; file_name: string; uploaded_at: string | null; }

interface SubteamRow {
  employee_id: number;
  full_name: string;
  position: string;
  department_name: string | null;
  weeks: WeekRow[];
  bolim_ball: number | null;
}

interface Props {
  headId: number;
  headName: string;
  headPosition?: string;
  weeks: WeekRow[];      // bo'lim boshlig'ining o'zining haftalik hisobotlari
  year: number;
  month: number;
  onClose: () => void;
  onScored: () => void;  // ball qo'yilgandan keyin ota komponentni yangilash
}

export default function DeptHeadReviewModal({ headId, headName, headPosition, weeks, year, month, onClose, onScored }: Props) {
  const [inputs, setInputs]   = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [subteam, setSubteam] = useState<SubteamRow[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [filesByReport, setFilesByReport] = useState<Record<number, WeeklyFile[]>>({});
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [cellModal, setCellModal] = useState<{ week: WeekRow; employeeName: string } | null>(null);

  const loadSubteam = useCallback(async () => {
    setLoadingSub(true);
    try {
      const data = await apiFetch<SubteamRow[]>(`/reports/weekly/subteam?head_id=${headId}&year=${year}&month=${month}`);
      setSubteam(data);
    } catch (e) { console.error(e); }
    finally { setLoadingSub(false); }
  }, [headId, year, month]);

  useEffect(() => { loadSubteam(); }, [loadSubteam]);

  useEffect(() => {
    weeks.filter(w => w.id > 0 && w.files_count > 0).forEach(w => {
      apiFetch<WeeklyFile[]>(`/reports/weekly/${w.id}/files`)
        .then(files => setFilesByReport(prev => ({ ...prev, [w.id]: files })))
        .catch(() => {});
    });
  }, [weeks]);

  async function confirmWeek(w: WeekRow) {
    const raw = inputs[w.id];
    const val = Number(raw);
    if (raw === undefined || raw === "" || isNaN(val) || val < 0 || val > (w.max_ball ?? 0)) return;
    setSavingId(w.id);
    try {
      await apiFetch(`/reports/weekly/${w.id}/score`, { method: "POST", body: JSON.stringify({ ball: val }) });
      onScored();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xato");
    } finally {
      setSavingId(null);
    }
  }

  async function downloadFile(reportId: number, fileId: number, fileName: string) {
    setDownloadingId(fileId);
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/reports/weekly/${reportId}/files/${fileId}/download`);
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name || fileName;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    } finally {
      setDownloadingId(null);
    }
  }

  const totalConfirmed = weeks.filter(w => w.confirmed_at).reduce((s, w) => s + (w.ball ?? 0), 0);
  const totalMax = weeks.reduce((s, w) => s + (w.max_ball ?? 0), 0);
  const maxWeeks = Math.max(weeks.length, ...subteam.map(s => s.weeks.length), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[1040px] max-h-[88vh] overflow-y-auto"
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5 sticky top-0 z-10"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>{headName}</h3>
            {headPosition && <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{headPosition}</p>}
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

        {/* Bo'lim boshlig'ining o'z hisoboti — gorizontal */}
        <div className="px-6 pt-5 pb-2">
          <p className="font-bold text-sm mb-3" style={{ color: "#0A1629" }}>Bo'lim boshlig'ining hisoboti</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {weeks.map(w => {
              const hasContent = w.id > 0;
              const isConfirmed = !!w.confirmed_at;
              const files = filesByReport[w.id] || [];
              return (
                <div key={w.week} className="p-3.5" style={{ background: "#FAFCFF", borderRadius: 16, border: "1.5px solid #EEF2FF" }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#91929E" }}>
                      <Calendar size={12}/> {w.week_label || `${w.week}-hafta`}
                    </span>
                    {isConfirmed && (
                      <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5"
                        style={{ background: "rgba(0,196,140,0.1)", color: "#00C48C", borderRadius: 6 }}>
                        <CheckCircle2 size={10}/> {w.ball}
                      </span>
                    )}
                  </div>

                  {!hasContent ? (
                    <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                      <Lock size={12} style={{ color: "#C4CBD6" }}/>
                      <span className="text-xs" style={{ color: "#C4CBD6" }}>Hisobot yo'q</span>
                    </div>
                  ) : (
                    <>
                      {w.description && (
                        <div className="text-[11px] rte-content mb-2 px-2.5 py-2" style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #EEF2FF", color: "#3D4557", maxHeight: 60, overflow: "hidden" }}
                          dangerouslySetInnerHTML={{ __html: w.description }} />
                      )}
                      {files.length > 0 ? (
                        <div className="flex flex-col gap-1.5 mb-2" style={{ maxHeight: 96, overflowY: "auto" }}>
                          {files.map(f => (
                            <button key={f.id} onClick={() => downloadFile(w.id, f.id, f.file_name)} disabled={downloadingId === f.id}
                              className="w-full flex items-center gap-2 px-2.5 py-2 hover:opacity-80 transition-opacity disabled:opacity-60"
                              style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #EEF2FF" }}>
                              <FileText size={13} style={{ color: "#6D5DD3", flexShrink: 0 }}/>
                              <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>{f.file_name}</span>
                              {downloadingId === f.id ? <Loader2 size={11} className="animate-spin" style={{ color: "#91929E" }}/> : <Download size={12} style={{ color: "#91929E", flexShrink: 0 }}/>}
                            </button>
                          ))}
                        </div>
                      ) : !w.description && (
                        <div className="flex items-center gap-2 px-2.5 py-2 mb-2" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                          <Lock size={12} style={{ color: "#C4CBD6" }}/>
                          <span className="text-xs" style={{ color: "#C4CBD6" }}>Fayl yo'q</span>
                        </div>
                      )}

                      {!isConfirmed ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={w.max_ball ?? 0} step={0.25}
                            placeholder={`0-${w.max_ball}`}
                            value={inputs[w.id] ?? ""}
                            onChange={e => setInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                            className="flex-1 min-w-0 px-2.5 py-2 text-xs font-bold outline-none"
                            style={{ background: "#FFFFFF", borderRadius: 9, border: "1.5px solid #3F8CFF30", color: "#0A1629" }}/>
                          <button onClick={() => confirmWeek(w)} disabled={savingId === w.id}
                            className="flex items-center justify-center w-8 h-8 flex-shrink-0 text-white disabled:opacity-40"
                            style={{ background: "#3F8CFF", borderRadius: 9 }}>
                            {savingId === w.id ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold px-1" style={{ color: "#00C48C" }}>
                          <CheckCircle2 size={11}/> Tasdiqlandi
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Xodimlar jadvali */}
        <div className="px-6 pb-6 pt-4">
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: "#0A1629" }}>
            <Users size={15} style={{ color: "#6D5DD3" }}/> Xodimlari ({subteam.length} ta)
          </p>

          {loadingSub ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin" style={{ color: "#3F8CFF" }}/>
            </div>
          ) : subteam.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-bold" style={{ color: "#91929E" }}>Bo'limda xodimlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 420 + maxWeeks * 90 }}>
                <div className="grid px-3 py-2 text-xs font-bold uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: `2fr ${Array.from({length:maxWeeks}).map(()=>"90px").join(" ")} 90px`,
                    color: "#91929E", letterSpacing: "0.05em", background: "#F8FAFF", borderRadius: 10,
                  }}>
                  <span>Xodim</span>
                  {Array.from({ length: maxWeeks }).map((_, i) => (
                    <span key={i} className="text-center">{i+1}-hafta</span>
                  ))}
                  <span className="text-center">Jami</span>
                </div>

                {subteam.map((emp, idx) => (
                  <div key={emp.employee_id} className="grid items-center px-3 py-3"
                    style={{
                      gridTemplateColumns: `2fr ${Array.from({length:maxWeeks}).map(()=>"90px").join(" ")} 90px`,
                      borderBottom: idx < subteam.length-1 ? "1px solid #F4F9FD" : "none",
                    }}>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>{emp.full_name}</p>
                      <p className="text-xs truncate" style={{ color: "#91929E" }}>{emp.position}</p>
                    </div>
                    {Array.from({ length: maxWeeks }).map((_, i) => {
                      const w = emp.weeks[i];
                      if (!w || w.id <= 0) {
                        return <div key={i} className="flex justify-center"><span className="text-xs" style={{ color:"#D9E3F0" }}>—</span></div>;
                      }
                      const isConfirmed = !!w.confirmed_at;
                      return (
                        <div key={i} className="flex justify-center">
                          <button onClick={() => setCellModal({ week: w, employeeName: emp.full_name })}
                            title={w.week_label || `${w.week}-hafta`}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
                            style={{
                              background: isConfirmed ? "rgba(0,196,140,0.1)" : "rgba(255,189,33,0.12)",
                              color: isConfirmed ? "#00C48C" : "#E0A400",
                              borderRadius: 8,
                            }}>
                            <FileText size={11}/>
                            {isConfirmed ? w.ball : <Clock size={11}/>}
                          </button>
                        </div>
                      );
                    })}
                    <div className="text-center">
                      <span className="font-bold text-sm" style={{ color: "#0A1629" }}>{emp.bolim_ball ?? "—"}</span>
                      <span className="text-xs" style={{ color: "#91929E" }}>/65</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {cellModal && (
        <WeekCellFilesModal
          week={cellModal.week}
          employeeName={cellModal.employeeName}
          onClose={() => setCellModal(null)}
          onScored={() => { onScored(); loadSubteam(); }}
        />
      )}
    </div>
  );
}

function WeekCellFilesModal({ week, employeeName, onClose, onScored }: {
  week: WeekRow; employeeName: string; onClose: () => void; onScored: () => void;
}) {
  const [files, setFiles] = useState<WeeklyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [ballInput, setBallInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(week.confirmed_at);
  const [ball, setBall] = useState(week.ball);

  useEffect(() => {
    apiFetch<WeeklyFile[]>(`/reports/weekly/${week.id}/files`)
      .then(setFiles).catch(() => {}).finally(() => setLoading(false));
  }, [week.id]);

  async function handleDownload(fileId: number, fileName: string) {
    setDownloadingId(fileId);
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/reports/weekly/${week.id}/files/${fileId}/download`);
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name || fileName;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleConfirm() {
    const val = Number(ballInput);
    if (ballInput === "" || isNaN(val) || val < 0 || val > (week.max_ball ?? 0)) return;
    setSaving(true);
    try {
      await apiFetch(`/reports/weekly/${week.id}/score`, { method: "POST", body: JSON.stringify({ ball: val }) });
      setConfirmedAt(new Date().toISOString());
      setBall(val);
      onScored();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[420px] max-h-[80vh] overflow-y-auto"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 30px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: "#0A1629" }}>{employeeName}</h3>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{week.week_label || `${week.week}-hafta`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "#F4F9FD", borderRadius: 9 }}>
            <X size={14} style={{ color: "#91929E" }}/>
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {week.description && (
            <div className="text-xs rte-content px-3 py-2.5" style={{ background: "#FAFCFF", borderRadius: 10, border: "1px solid #EEF2FF", color: "#3D4557" }}
              dangerouslySetInnerHTML={{ __html: week.description }} />
          )}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: "#3F8CFF" }}/></div>
          ) : files.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {files.map(f => (
                <button key={f.id} onClick={() => handleDownload(f.id, f.file_name)} disabled={downloadingId === f.id}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-60"
                  style={{ background: "#FAFCFF", borderRadius: 10, border: "1px solid #EEF2FF" }}>
                  <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }}/>
                  <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>{f.file_name}</span>
                  {downloadingId === f.id ? <Loader2 size={13} className="animate-spin" style={{ color: "#91929E" }}/> : <Download size={13} style={{ color: "#91929E", flexShrink: 0 }}/>}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <FileText size={14} style={{ color: "#C4CBD6" }}/>
              <span className="text-xs" style={{ color: "#C4CBD6" }}>Fayl yuklanmagan</span>
            </div>
          )}

          {confirmedAt ? (
            <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#00C48C" }}>
              <CheckCircle2 size={12}/> Tasdiqlandi — {ball} / {week.max_ball} ball
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={week.max_ball ?? 0} step={0.25}
                placeholder={`0 — ${week.max_ball}`}
                value={ballInput}
                onChange={e => setBallInput(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #3F8CFF30", color: "#0A1629" }}/>
              <button onClick={handleConfirm} disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ background: "#3F8CFF", borderRadius: 10 }}>
                {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                Tasdiqlash
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
