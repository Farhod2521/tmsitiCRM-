"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, Upload, FileText,
  CheckCircle2, Clock, Download, Loader2, Lock, Pencil, Trash2, Info, CloudUpload, HelpCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import LottiePlayer from "@/components/ui/LottiePlayer";
import WeeklyReportUploadModal from "@/components/reports/WeeklyReportUploadModal";

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
  upload_open: boolean;
  open_until: string | null;
  description: string | null;
  files_count: number;
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
  const [uploadTarget, setUploadTarget] = useState<WeeklyReportRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  async function deleteReport(reportId: number) {
    if (!confirm("Hisobotni o'chirishni tasdiqlaysizmi? Fayl serverdan butunlay o'chiriladi.")) return;
    setDeletingId(reportId);
    try {
      await apiFetch(`/reports/weekly/${reportId}`, { method: "DELETE" });
      load(year, month);
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xato");
    } finally {
      setDeletingId(null);
    }
  }

  const hasAnyData = rows.some(r => r.id !== 0);

  const isPastMonth   = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth()+1);
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth()+1);
  const currentWeekIdx = rows.findIndex(r => r.is_current);

  function lockedState(row: WeeklyReportRow, idx: number): "past" | "future" | null {
    if (row.is_current || row.upload_open) return null;
    if (isPastMonth) return "past";
    if (isFutureMonth) return "future";
    if (currentWeekIdx === -1) return "past";
    return idx < currentWeekIdx ? "past" : "future";
  }

  // Oktabr 2026 dan boshlab hisobot oyiga bitta — backend bitta davr qaytaradi
  if (!loading && rows.length === 1) {
    return (
      <>
        <MonthlyReport row={rows[0]} year={year} month={month} locked={lockedState(rows[0], 0)}
          deleting={deletingId === rows[0].id} onMonth={chMonth}
          onEdit={() => setUploadTarget(rows[0])} onDelete={() => deleteReport(rows[0].id)} />
        {uploadTarget && (
          <WeeklyReportUploadModal
            year={year} month={month} week={uploadTarget.week}
            weekLabel={`${MON_NAMES[month - 1]} ${year} oylik hisoboti`}
            initialDescription={uploadTarget.description}
            initialReportId={uploadTarget.id > 0 ? uploadTarget.id : null}
            onClose={() => setUploadTarget(null)}
            onSaved={() => load(year, month)}
          />
        )}
      </>
    );
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
              <WeekCell key={r.week} row={r} deleting={deletingId === r.id} locked={lockedState(r,idx)}
                onEdit={() => setUploadTarget(r)} onDelete={() => deleteReport(r.id)}/>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-6">
          {rows.map((r,idx) => (
            <WeekCell key={r.week} row={r} deleting={deletingId === r.id} locked={lockedState(r,idx)}
              onEdit={() => setUploadTarget(r)} onDelete={() => deleteReport(r.id)}/>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] px-6 pb-5" style={{ color: "#91929E" }}>
        <Info size={12}/> Fayl hajmi maksimal 10MB bo'lishi kerak (PDF, DOC, DOCX, XLS, XLSX).
      </p>

      {uploadTarget && (
        <WeeklyReportUploadModal
          year={year} month={month} week={uploadTarget.week}
          weekLabel={uploadTarget.week_label || `${uploadTarget.week}-hafta`}
          initialDescription={uploadTarget.description}
          initialReportId={uploadTarget.id > 0 ? uploadTarget.id : null}
          onClose={() => setUploadTarget(null)}
          onSaved={() => load(year, month)}
        />
      )}
    </div>
  );
}

function WeekCell({ row, deleting, locked, onEdit, onDelete }: {
  row: WeeklyReportRow; deleting: boolean; locked: "past" | "future" | null;
  onEdit: () => void; onDelete: () => void;
}) {
  const started = row.id > 0;
  const isConfirmed = !!row.confirmed_at;

  return (
    <div className="p-4" style={{ background: "#FAFCFF", borderRadius: 16, border: "1.5px solid #EEF2FF" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "#91929E" }}>
          <Calendar size={14}/> {row.week_label || `${row.week}-hafta`}
        </span>
        {row.is_current && !started && (
          <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ background:"rgba(63,140,255,0.1)", color:"#3F8CFF", borderRadius:6 }}>
            Joriy
          </span>
        )}
        {!row.is_current && row.open_until && (
          <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ background:"rgba(0,196,140,0.1)", color:"#00C48C", borderRadius:6 }}>
            {new Date(row.open_until).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}{" "}
            {new Date(row.open_until).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })} gacha
          </span>
        )}
      </div>

      {!started && locked ? (
        <div className="w-full flex flex-col items-center justify-center gap-1.5 py-5"
          style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px dashed #E0E6F0" }}>
          <Lock size={16} style={{ color: "#C4CBD6" }}/>
          <span className="text-xs font-bold" style={{ color: "#C4CBD6" }}>
            {locked === "past" ? "Muddati o'tgan" : "Hali boshlanmagan"}
          </span>
        </div>
      ) : !started ? (
        <button onClick={onEdit}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-5"
          style={{ background: "rgba(63,140,255,0.06)", borderRadius: 12, border: "1.5px dashed rgba(63,140,255,0.3)" }}>
          <Upload size={18} style={{ color: "#3F8CFF" }}/>
          <span className="text-xs font-bold" style={{ color: "#3F8CFF" }}>Hisobot yozish</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button onClick={onEdit}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:opacity-80 transition-opacity"
            style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #EEF2FF" }}>
            <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }}/>
            <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>
              {row.files_count > 0 ? `${row.files_count} ta fayl` : "Fayl yo'q"}{row.description ? " · Tavsif bor" : ""}
            </span>
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
            <div className="flex items-center justify-between px-1 gap-2">
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#FFBD21" }}>
                <Clock size={12}/> Kutilmoqda
              </span>
              <div className="flex items-center gap-1">
                <button onClick={onEdit} title="Tahrirlash"
                  className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: "rgba(63,140,255,0.1)", borderRadius: 7 }}>
                  <Pencil size={11} style={{ color: "#3F8CFF" }}/>
                </button>
                <button onClick={onDelete} disabled={deleting} title="O'chirish"
                  className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ background: "rgba(255,92,92,0.1)", borderRadius: 7 }}>
                  {deleting ? <Loader2 size={11} className="animate-spin" style={{ color: "#FF5C5C" }}/> : <Trash2 size={11} style={{ color: "#FF5C5C" }}/>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthlyReport({ row, year, month, locked, deleting, onMonth, onEdit, onDelete }: {
  row: WeeklyReportRow; year: number; month: number; locked: "past" | "future" | null; deleting: boolean;
  onMonth: (dir: number) => void; onEdit: () => void; onDelete: () => void;
}) {
  const started = row.id > 0;
  const confirmed = !!row.confirmed_at;
  const label = row.week_label?.replace(/ (\S+)$/, ` ${MON_NAMES[month - 1]}`) ?? MON_NAMES[month - 1];
  const badge = locked === "past"
    ? { text: "Muddati o'tgan", color: "#91929E", bg: "#F4F9FD", icon: Lock }
    : locked === "future"
      ? { text: "Hali boshlanmagan", color: "#91929E", bg: "#F4F9FD", icon: Lock }
      : { text: row.open_until && !row.is_current
            ? `${new Date(row.open_until).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} gacha ochiq`
            : `${label} uchun ochiq`, color: "#00A578", bg: "rgba(0,196,140,0.1)", icon: CheckCircle2 };
  const BadgeIcon = badge.icon;

  return (
    <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
            <FileText size={20} style={{ color: "#3F8CFF" }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Mening hisobotim</h3>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{MON_NAMES[month - 1]} {year} — oylik hisobot faylini yuklang</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center" style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <button onClick={() => onMonth(-1)} className="w-8 h-8 flex items-center justify-center" title="Oldingi oy"><ChevronLeft size={15} style={{ color: "#3F8CFF" }} /></button>
            <button onClick={() => onMonth(1)} className="w-8 h-8 flex items-center justify-center" title="Keyingi oy"><ChevronRight size={15} style={{ color: "#3F8CFF" }} /></button>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{ background: badge.bg, color: badge.color, borderRadius: 10 }}>
            <BadgeIcon size={14} /> {badge.text}
          </span>
          <span title="Hisobot oyiga bir marta topshiriladi. Bo'lim boshlig'i ko'rib chiqib, 23 ballgacha baho qo'yadi."
            className="w-8 h-8 flex items-center justify-center cursor-help">
            <HelpCircle size={18} style={{ color: "#3F8CFF" }} />
          </span>
        </div>
      </div>

      <div className="px-6 pb-6">
        {!started ? (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-9"
            style={{ border: "1.5px dashed #D3DEEC", borderRadius: 18, background: "#FCFDFF" }}>
            {locked ? <Lock size={34} style={{ color: "#C4CBD6" }} /> : <CloudUpload size={40} style={{ color: "#3F8CFF" }} strokeWidth={1.6} />}
            <p className="font-bold" style={{ color: locked ? "#A8B0BD" : "#3F8CFF" }}>
              {locked === "past" ? "Bu oy uchun hisobot topshirilmagan" : locked === "future" ? "Bu oy hali boshlanmagan" : "Hisobot faylini yuklang"}
            </p>
            <p className="text-xs" style={{ color: "#91929E" }}>PDF, DOC, DOCX, XLS, XLSX (maksimal 10MB)</p>
            {!locked && (
              <button onClick={onEdit} className="mt-2 flex items-center gap-2 px-7 py-3 text-sm font-bold text-white"
                style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 6px 14px rgba(63,140,255,0.3)" }}>
                <Upload size={16} /> Fayl tanlash
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap p-5" style={{ border: "1.5px solid #EEF2FF", borderRadius: 18, background: "#FAFCFF" }}>
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(109,93,211,0.1)", borderRadius: 14 }}>
              <FileText size={22} style={{ color: "#6D5DD3" }} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                {row.files_count > 0 ? `${row.files_count} ta fayl yuklangan` : "Fayl yo'q"}{row.description ? " · Tavsif bor" : ""}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                {row.uploaded_at ? `Yuklangan: ${new Date(row.uploaded_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
            </div>
            {confirmed ? (
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold" style={{ background: "rgba(0,196,140,0.1)", color: "#00A578", borderRadius: 10 }}>
                <CheckCircle2 size={15} /> Tasdiqlandi · {row.ball} / {row.max_ball}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold" style={{ background: "rgba(255,189,33,0.14)", color: "#D99A00", borderRadius: 10 }}>
                <Clock size={15} /> Bo&apos;lim boshlig&apos;i ko&apos;rib chiqmoqda
              </span>
            )}
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 10 }}>
                {confirmed ? <><Download size={14} /> Ko&apos;rish</> : <><Pencil size={14} /> Tahrirlash</>}
              </button>
              {!confirmed && (
                <button onClick={onDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold disabled:opacity-50"
                  style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 10 }}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} O&apos;chirish
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
