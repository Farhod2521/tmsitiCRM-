"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, Upload, FileText,
  CheckCircle2, Clock, Download, Loader2, Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import LottiePlayer from "@/components/ui/LottiePlayer";

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];

const EMPTY_LOTTIE = "https://lottie.host/000f7205-e9fb-495f-ab01-4af7a16eed2b/drWBf3Mcju.lottie";

interface WeeklyReportRow {
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

export default function WeeklyReportCard() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows,  setRows]  = useState<WeeklyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingWeek, setUploadingWeek] = useState<number | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<WeeklyReportRow[]>(`/reports/weekly/mine?year=${y}&month=${m}`);
      setRows(data);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); load(y, m);
  }

  function triggerUpload(week: number) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.doc,.docx,.xlsx,.xls";
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { alert("Fayl 10MB dan katta bo'lmasin"); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const b64 = ev.target?.result as string;
        setUploadingWeek(week);
        try {
          await apiFetch("/reports/weekly", {
            method: "POST",
            body: JSON.stringify({ year, month, week, file_name: file.name, file_b64: b64 }),
          });
          load(year, month);
        } catch (err) {
          alert(err instanceof Error ? err.message : "Yuklashda xato");
        } finally {
          setUploadingWeek(null);
        }
      };
      reader.readAsDataURL(file);
    };
    inp.click();
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

  const hasAnyData = rows.some(r => r.id !== 0);

  const isPastMonth   = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth()+1);
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth()+1);
  const currentWeekIdx = rows.findIndex(r => r.is_current);

  function lockedState(row: WeeklyReportRow, idx: number): "past" | "future" | null {
    if (row.is_current) return null;
    if (isPastMonth) return "past";
    if (isFutureMonth) return "future";
    if (currentWeekIdx === -1) return "past";
    return idx < currentWeekIdx ? "past" : "future";
  }

  return (
    <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
            <FileText size={18} style={{ color: "#3F8CFF" }}/>
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Mening hisobotlarim</h3>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Haftalik hisobot fayllarini yuklang</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1" style={{ background: "#F4F9FD", borderRadius: 12 }}>
          <button onClick={() => chMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
            <ChevronLeft size={15} style={{ color: "#3F8CFF" }}/>
          </button>
          <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 110, textAlign: "center" }}>
            {MON_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => chMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
            <ChevronRight size={15} style={{ color: "#3F8CFF" }}/>
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }}/>
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <LottiePlayer src={EMPTY_LOTTIE} width={220} height={220}/>
          <p className="font-bold text-base" style={{ color: "#0A1629" }}>Bu oy uchun hisobot yo'q</p>
          <p className="text-sm mt-1" style={{ color: "#91929E" }}>Quyidagi haftalardan birini tanlab fayl yuklang</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-6 mt-6 w-full">
            {rows.map((r,idx) => (
              <WeekCell key={r.week} row={r} uploading={uploadingWeek === r.week} locked={lockedState(r,idx)}
                onUpload={() => triggerUpload(r.week)} onDownload={() => downloadFile(r.id, r.file_name || "fayl")}/>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-6">
          {rows.map((r,idx) => (
            <WeekCell key={r.week} row={r} uploading={uploadingWeek === r.week} locked={lockedState(r,idx)}
              onUpload={() => triggerUpload(r.week)} onDownload={() => downloadFile(r.id, r.file_name || "fayl")}/>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekCell({ row, uploading, locked, onUpload, onDownload }: {
  row: WeeklyReportRow; uploading: boolean; locked: "past" | "future" | null;
  onUpload: () => void; onDownload: () => void;
}) {
  const hasFile = !!row.file_name;
  const isConfirmed = !!row.confirmed_at;

  return (
    <div className="p-4" style={{ background: "#FAFCFF", borderRadius: 16, border: "1.5px solid #EEF2FF" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "#91929E" }}>
          <Calendar size={14}/> {row.week_label || `${row.week}-hafta`}
        </span>
        {row.is_current && !hasFile && (
          <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ background:"rgba(63,140,255,0.1)", color:"#3F8CFF", borderRadius:6 }}>
            Joriy
          </span>
        )}
      </div>

      {!hasFile && locked ? (
        <div className="w-full flex flex-col items-center justify-center gap-1.5 py-5"
          style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px dashed #E0E6F0" }}>
          <Lock size={16} style={{ color: "#C4CBD6" }}/>
          <span className="text-xs font-bold" style={{ color: "#C4CBD6" }}>
            {locked === "past" ? "Muddati o'tgan" : "Hali boshlanmagan"}
          </span>
        </div>
      ) : !hasFile ? (
        <button onClick={onUpload} disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-5 disabled:opacity-50"
          style={{ background: "rgba(63,140,255,0.06)", borderRadius: 12, border: "1.5px dashed rgba(63,140,255,0.3)" }}>
          {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: "#3F8CFF" }}/> : <Upload size={18} style={{ color: "#3F8CFF" }}/>}
          <span className="text-xs font-bold" style={{ color: "#3F8CFF" }}>{uploading ? "Yuklanmoqda..." : "Fayl yuklash"}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button onClick={onDownload}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:opacity-80 transition-opacity"
            style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #EEF2FF" }}>
            <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }}/>
            <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>{row.file_name}</span>
            <Download size={13} style={{ color: "#91929E", flexShrink: 0 }}/>
          </button>

          {isConfirmed ? (
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#00C48C" }}>
                <CheckCircle2 size={12}/> Tasdiqlandi
              </span>
              <span className="text-xs font-bold" style={{ color: "#0A1629" }}>{row.ball} / {row.max_ball}</span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold px-1" style={{ color: "#FFBD21" }}>
              <Clock size={12}/> Kutilmoqda
            </span>
          )}
        </div>
      )}
    </div>
  );
}
