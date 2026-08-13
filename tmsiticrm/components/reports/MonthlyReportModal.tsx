"use client";

import { useState, useEffect } from "react";
import {
  X, Loader2, Clock, CheckCircle2, XCircle, FileText, Download,
  Building2, Phone, IdCard, MessageSquareWarning, Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

type DayStatus = "kelgan" | "kechikkan" | "kelmagan" | "dam_olish" | "kelajak";
type ReviewStatus = "kutilmoqda" | "kadr_tasdiqladi" | "sababli" | "sababsiz";
type NoteType = "kechikish" | "kelmaslik" | "obyektda" | "ruxsat";

interface CalendarDay { day: number; weekday: number; status: DayStatus; time: string | null; }
interface NoteDetail {
  id: number;
  note_type: NoteType;
  text: string | null;
  date_from: string;
  date_to: string;
  expected_time: string | null;
  created_at: string;
  review_status: ReviewStatus;
  reviewed_by_nomi: string | null;
  reviewed_at: string | null;
  zamdirektor_by_nomi: string | null;
  zamdirektor_at: string | null;
}
interface WeekRow {
  week: number; label: string;
  description: string | null;
  file_name: string | null; uploaded_at: string | null;
  ball: number | null; report_id: number | null;
}
interface TimeAnalysis {
  samarali_min: number; kechikish_min: number; total_min: number;
  samarali_pct: number; kechikish_pct: number;
}
interface ScoreItem { label: string; ball: number | null; max_ball: number; }
interface Scores { ijro: ScoreItem; kadr: ScoreItem; bolim: ScoreItem; umumiy: ScoreItem; comment: string | null; }
interface Summary {
  kelgan_kunlar: number; kechikkan_kunlar: number; kelmagan_kunlar: number;
  ish_kunlari_jami: number; jami_ish_soati_min: number;
}
interface MonthlyReport {
  report_id: string; report_date: string; period_label: string;
  employee_id: number; full_name: string; position: string;
  department_name: string | null; phone: string; has_photo: boolean;
  summary: Summary;
  calendar: CalendarDay[];
  notes: NoteDetail[];
  weekly_reports: WeekRow[];
  time_analysis: TimeAnalysis;
  scores: Scores;
  prepared_by_name: string | null;
  approved_by_name: string | null;
}

function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDt(d: string) {
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  kechikish: "Kechikish", kelmaslik: "Kelmaslik", obyektda: "Obyektda", ruxsat: "Ruxsat so'ragan",
};

const REVIEW_CFG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  kutilmoqda:      { label: "Kadr ko'rib chiqmoqda",              color: "#91929E", bg: "rgba(145,146,158,0.12)" },
  kadr_tasdiqladi: { label: "Zamdirektor tasdiqlashi kutilmoqda", color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  sababli:         { label: "Sababli",                            color: "#00A578", bg: "rgba(0,165,120,0.12)" },
  sababsiz:        { label: "Sababsiz",                           color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
};

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const DAY_CFG: Record<DayStatus, { icon: typeof CheckCircle2 | null; color: string; bg: string }> = {
  kelgan:     { icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
  kechikkan:  { icon: Clock,        color: "#FFBD21", bg: "rgba(255,189,33,0.12)" },
  kelmagan:   { icon: XCircle,      color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
  dam_olish:  { icon: null,         color: "#C4CBD6", bg: "#F4F9FD" },
  kelajak:    { icon: null,         color: "#D9E3F0", bg: "#FFFFFF" },
};

/* ── Ishlash vaqti donuti — oyning talab qilingan soatidan qancha bajarilgani ── */
function TimeDonut({ ta }: { ta: TimeAnalysis }) {
  const size = 160, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const segs = [
    { pct: ta.samarali_pct, color: "#00C48C" },
    { pct: ta.kechikish_pct, color: "#FF8C42" },
  ];
  let offsetAcc = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F3F8" strokeWidth={stroke} />
        {segs.map((s, i) => {
          const dash = (s.pct / 100) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offsetAcc} strokeLinecap="butt" />
          );
          offsetAcc += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold text-lg" style={{ color: "#0A1629" }}>{fmtHM(ta.total_min)}</span>
        <span className="text-[10px] mt-1" style={{ color: "#91929E" }}>soat</span>
      </div>
    </div>
  );
}

/* ── Baholash gauge (dumaloq) ── */
function ScoreGauge({ item, size = 110, compact = false }: { item: ScoreItem; size?: number; compact?: boolean }) {
  const stroke = compact ? 6 : 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const val = item.ball ?? 0;
  const pct = item.max_ball ? Math.min(val / item.max_ball, 1) : 0;
  const color = pct >= 0.8 ? "#00C48C" : pct >= 0.5 ? "#FFBD21" : "#FF5C5C";
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1" style={{ minWidth: size + 20 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F3F8" strokeWidth={stroke} />
          {item.ball != null && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={compact ? "font-bold text-sm" : "font-bold text-xl"} style={{ color: item.ball != null ? "#0A1629" : "#C4CBD6" }}>
            {item.ball != null ? item.ball : "—"}
          </span>
          <span className="text-[9px] mt-0.5" style={{ color: "#A8B0BD" }}>/{item.max_ball}</span>
        </div>
      </div>
      <p className={compact ? "text-[10px] font-bold text-center leading-tight" : "text-xs font-bold text-center"} style={{ color: "#0A1629" }}>{item.label}</p>
      {!compact && <p className="text-[10px]" style={{ color: "#91929E" }}>Maksimal ball: {item.max_ball}</p>}
    </div>
  );
}

/* ── Kunlik izoh + tasdiqlash zanjiri modali ── */
function NoteDetailModal({ note, onClose }: { note: NoteDetail; onClose: () => void }) {
  const rc = REVIEW_CFG[note.review_status];
  const steps: { label: string; done: boolean; by: string | null; at: string | null; state: "done" | "waiting" | "rejected" | "pending" }[] = [
    {
      label: "Kadr tasdiqladi",
      done: note.review_status !== "kutilmoqda",
      by: note.reviewed_by_nomi, at: note.reviewed_at,
      state: note.review_status === "kutilmoqda" ? "pending" : note.review_status === "sababsiz" && !note.zamdirektor_by_nomi ? "rejected" : "done",
    },
    {
      label: "Zamdirektor tasdiqladi",
      done: note.review_status === "sababli" || (note.review_status === "sababsiz" && !!note.zamdirektor_by_nomi),
      by: note.zamdirektor_by_nomi, at: note.zamdirektor_at,
      state: note.review_status === "sababli" ? "done"
        : note.review_status === "sababsiz" && note.zamdirektor_by_nomi ? "rejected"
        : note.review_status === "kadr_tasdiqladi" ? "waiting" : "pending",
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md p-6" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: "rgba(224,164,0,0.12)" }}>
              <MessageSquareWarning size={16} style={{ color: "#E0A400" }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{NOTE_TYPE_LABEL[note.note_type]}</p>
              <p className="text-xs" style={{ color: "#91929E" }}>
                {note.date_from === note.date_to ? note.date_from : `${note.date_from} — ${note.date_to}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 9 }}>
            <X size={14} style={{ color: "#7D8592" }} />
          </button>
        </div>

        {note.text && (
          <p className="text-sm mb-1" style={{ color: "#3D4557", whiteSpace: "pre-wrap" }}>{note.text}</p>
        )}
        {note.expected_time && (
          <p className="text-xs mb-2" style={{ color: "#91929E" }}>~{note.expected_time} da keladi</p>
        )}
        <p className="text-[11px] mb-4" style={{ color: "#B8C2D6" }}>Yozilgan: {fmtDt(note.created_at)}</p>

        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg mb-4" style={{ background: rc.bg, color: rc.color }}>
          {rc.label}
        </span>

        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
                style={{
                  background: s.state === "done" ? "rgba(0,165,120,0.12)" : s.state === "rejected" ? "rgba(255,92,92,0.12)" : s.state === "waiting" ? "rgba(63,140,255,0.12)" : "#F4F9FD",
                }}>
                {s.state === "done" ? <Check size={12} style={{ color: "#00A578" }} /> :
                 s.state === "rejected" ? <X size={12} style={{ color: "#FF5C5C" }} /> :
                 <Clock size={12} style={{ color: s.state === "waiting" ? "#3F8CFF" : "#C4CBD6" }} />}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: s.state === "pending" ? "#C4CBD6" : "#0A1629" }}>
                  {s.state === "rejected" ? `${s.label.split(" ")[0]} rad etdi` : s.label}
                </p>
                {s.by ? (
                  <p className="text-[11px]" style={{ color: "#91929E" }}>{s.by}{s.at ? `, ${fmtDt(s.at)}` : ""}</p>
                ) : (
                  <p className="text-[11px]" style={{ color: "#C4CBD6" }}>
                    {s.state === "waiting" ? "Hozircha kutilmoqda" : s.state === "pending" ? "Hali navbat kelmagan" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Haftalik hisobot: ish tavsifi + fayl modali ── */
function WeekReportModal({ week, onClose }: { week: WeekRow; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!week.report_id) return;
    setDownloading(true);
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/reports/weekly/file/${week.report_id}`);
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name || week.file_name || "fayl";
      a.click();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fayl topilmadi");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>{week.label}</h3>
            {week.uploaded_at && (
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Yuklangan: {new Date(week.uploaded_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 9 }}>
            <X size={14} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs font-bold mb-2" style={{ color: "#91929E", letterSpacing: "0.04em" }}>ISH TAVSIFI</p>
          {week.description ? (
            <div className="text-sm rte-content" style={{ color: "#3D4557", lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: week.description }} />
          ) : (
            <p className="text-sm" style={{ color: "#C4CBD6" }}>Ish tavsifi yozilmagan</p>
          )}

          <p className="text-xs font-bold mb-2 mt-5" style={{ color: "#91929E", letterSpacing: "0.04em" }}>FAYL</p>
          {week.file_name && week.report_id ? (
            <button onClick={handleDownload} disabled={downloading}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-60"
              style={{ background: "#FAFCFF", borderRadius: 10, border: "1px solid #F0F3F8" }}>
              <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }} />
              <span className="text-xs font-bold truncate flex-1 text-left" style={{ color: "#0A1629" }}>{week.file_name}</span>
              {downloading ? <Loader2 size={13} className="animate-spin" style={{ color: "#91929E" }} /> : <Download size={13} style={{ color: "#91929E", flexShrink: 0 }} />}
            </button>
          ) : (
            <p className="text-sm" style={{ color: "#C4CBD6" }}>Fayl yuklanmagan</p>
          )}

          {week.ball != null && (
            <p className="text-xs font-bold mt-4" style={{ color: "#00A578" }}>Ball: {week.ball}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MonthlyReportModal({
  employeeId, year, month, onClose,
}: { employeeId: number; year: number; month: number; onClose: () => void }) {
  const [data, setData] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekRow | null>(null);

  function noteForDay(day: number): NoteDetail | undefined {
    if (!data) return undefined;
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return data.notes.find(n => n.date_from <= ds && n.date_to >= ds);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<MonthlyReport>(`/reports/monthly/${employeeId}?year=${year}&month=${month}`)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, [employeeId, year, month]);

  useEffect(() => {
    if (!data?.has_photo) return;
    apiFetch<{ photo_base64: string | null }>(`/employees/${employeeId}/photo`)
      .then(r => setPhoto(r.photo_base64))
      .catch(() => {});
  }, [data?.has_photo, employeeId]);

  // Kalendar grid: Dushanba-boshlanuvchi to'ldirish
  const calWeeks: (CalendarDay | null)[][] = [];
  if (data) {
    const padLeft = data.calendar[0]?.weekday ?? 0;
    const cells: (CalendarDay | null)[] = [...Array(padLeft).fill(null), ...data.calendar];
    while (cells.length % 7 !== 0) cells.push(null);
    for (let i = 0; i < cells.length; i += 7) calWeeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-4xl my-6" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0 20px 60px rgba(10,22,41,0.3)" }}
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
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-8 py-6" style={{ borderBottom: "2px solid #F4F9FD" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: "#0A1629", borderRadius: 12 }}>
                  <Building2 size={22} style={{ color: "#FFFFFF" }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold" style={{ color: "#91929E", letterSpacing: "0.05em" }}>TMSITI CRM</p>
                  <h2 className="font-bold text-xl leading-tight" style={{ color: "#0A1629" }}>XODIM OYLIK HISOBOTI</h2>
                  <span className="inline-block mt-1.5 px-3 py-1 text-xs font-bold text-white" style={{ background: "#3F8CFF", borderRadius: 8 }}>
                    {data.period_label}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-4 flex-shrink-0">
                <div className="text-right text-xs" style={{ color: "#91929E" }}>
                  <p>Hisobot sanasi: <span className="font-bold" style={{ color: "#0A1629" }}>{data.report_date}</span></p>
                  <p className="mt-1">Hisobot ID: <span className="font-bold" style={{ color: "#0A1629" }}>{data.report_id}</span></p>
                </div>
                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                  <X size={16} style={{ color: "#7D8592" }} />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 flex flex-col gap-5">
              {/* Xodim kartasi + umumiy ma'lumot */}
              <div className="flex flex-col md:flex-row gap-5">
                <div className="flex items-center gap-4 p-4 flex-1" style={{ background: "#FAFCFF", borderRadius: 16, border: "1px solid #F0F3F8" }}>
                  {photo ? (
                    <img src={photo} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#3F8CFF" }}>
                      {mkAvatar(data.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-base truncate" style={{ color: "#0A1629" }}>{data.full_name}</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: "#3F8CFF" }}>{data.position}</p>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs" style={{ color: "#7D8592" }}>
                      <span className="flex items-center gap-1.5"><IdCard size={12} /> Xodim ID: {data.employee_id}</span>
                      {data.department_name && <span className="flex items-center gap-1.5"><Building2 size={12} /> Bo'lim: {data.department_name}</span>}
                      <span className="flex items-center gap-1.5"><Phone size={12} /> Telefon: {data.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4" style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #F0F3F8" }}>
                  <p className="text-[11px] font-bold mb-2" style={{ color: "#91929E", letterSpacing: "0.04em" }}>BAHOLASH NATIJALARI</p>
                  <div className="flex items-start justify-around gap-2">
                    <ScoreGauge item={data.scores.ijro} size={64} compact />
                    <ScoreGauge item={data.scores.kadr} size={64} compact />
                    <ScoreGauge item={data.scores.bolim} size={64} compact />
                    <ScoreGauge item={data.scores.umumiy} size={64} compact />
                  </div>
                </div>
              </div>

              {/* Kalendar + Ishlash vaqti tahlili */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="p-4" style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #F0F3F8" }}>
                  <p className="text-xs font-bold mb-3" style={{ color: "#91929E", letterSpacing: "0.04em" }}>OYLIK ISH JADVALI</p>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEK_DAYS.map(d => (
                      <span key={d} className="text-center text-[10px] font-bold" style={{ color: "#91929E" }}>{d}</span>
                    ))}
                  </div>
                  {calWeeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                      {week.map((cd, di) => {
                        if (!cd) return <div key={di} />;
                        const cfg = DAY_CFG[cd.status];
                        const Icon = cfg.icon;
                        const note = cd.status === "kechikkan" ? noteForDay(cd.day) : undefined;
                        const Tag = note ? "button" : "div";
                        return (
                          <Tag key={di} onClick={note ? () => setSelectedNote(note) : undefined}
                            className="relative min-h-[52px] w-full flex flex-col items-center justify-center gap-0.5 py-1"
                            style={{ background: cfg.bg, borderRadius: 8, cursor: note ? "pointer" : "default" }}>
                            {note && (
                              <span className="absolute top-0 right-0" style={{
                                width: 0, height: 0,
                                borderTop: "10px solid #FF8C42", borderLeft: "10px solid transparent",
                                borderTopRightRadius: 8,
                              }} title="Izoh yozilgan" />
                            )}
                            <span className="text-[10px] font-bold" style={{ color: cd.status === "kelajak" ? "#C4CBD6" : "#0A1629" }}>{cd.day}</span>
                            {Icon && <Icon size={10} style={{ color: cfg.color }} />}
                            {cd.time && <span className="text-[8px] font-bold leading-none" style={{ color: cfg.color }}>{cd.time}</span>}
                          </Tag>
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 flex-wrap mt-3 pt-3" style={{ borderTop: "1px solid #F4F9FD" }}>
                    {([["kelgan", "Kelgan"], ["kechikkan", "Kechikkan"], ["kelmagan", "Kelmagan"], ["dam_olish", "Dam olish kuni"]] as [DayStatus, string][]).map(([k, l]) => (
                      <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#91929E" }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: DAY_CFG[k].icon ? DAY_CFG[k].color : "#D9E3F0" }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4" style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #F0F3F8" }}>
                  <p className="text-xs font-bold mb-3" style={{ color: "#91929E", letterSpacing: "0.04em" }}>ISHLASH VAQTI TAHLILI</p>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: "Jami ish soati", value: fmtHM(data.summary.jami_ish_soati_min), suffix: "soat", icon: Clock, color: "#3F8CFF" },
                      { label: "Kelgan kunlar", value: data.summary.kelgan_kunlar, suffix: "kun", icon: CheckCircle2, color: "#00C48C" },
                      { label: "Kechikishlar", value: data.summary.kechikkan_kunlar, suffix: "kun", icon: Clock, color: "#FFBD21" },
                      { label: "Kelmagan kunlar", value: data.summary.kelmagan_kunlar, suffix: "kun", icon: XCircle, color: "#FF5C5C" },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col items-center justify-center text-center p-2" style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                        <s.icon size={16} style={{ color: s.color }} />
                        <span className="font-bold text-sm mt-1" style={{ color: "#0A1629" }}>{s.value}</span>
                        <span className="text-[9px]" style={{ color: "#91929E" }}>{s.suffix}</span>
                        <span className="text-[9px] mt-0.5 leading-tight" style={{ color: "#A8B0BD" }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 pt-4" style={{ borderTop: "1px solid #F4F9FD" }}>
                    <TimeDonut ta={data.time_analysis} />
                    <div className="flex flex-col gap-2.5 text-xs flex-1">
                      <p style={{ color: "#91929E" }}>Bu oyda <b style={{ color: "#0A1629" }}>{data.summary.ish_kunlari_jami}</b> ish kuni bo'lgan (<b style={{ color: "#0A1629" }}>{fmtHM(data.time_analysis.total_min)}</b> soat ishlashi kerak)</p>
                      {[
                        { l: "Samarali ish vaqti", v: data.time_analysis.samarali_min, p: data.time_analysis.samarali_pct, c: "#00C48C" },
                        { l: "Kechikishlar", v: data.time_analysis.kechikish_min, p: data.time_analysis.kechikish_pct, c: "#FF8C42" },
                      ].map(r => (
                        <div key={r.l} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.c }} />
                          <span style={{ color: "#3D4557" }}>{r.l}</span>
                          <span className="ml-auto font-bold" style={{ color: "#0A1629" }}>{fmtHM(r.v)} <span className="font-normal" style={{ color: "#91929E" }}>({r.p}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ishlar ro'yxati (haftalik) — to'liq kenglik */}
              <div className="p-4" style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #F0F3F8" }}>
                <p className="text-xs font-bold mb-3" style={{ color: "#91929E", letterSpacing: "0.04em" }}>ISHLAR RO'YXATI (HAFTALIK)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {data.weekly_reports.map(w => (
                    <button key={w.week} onClick={() => setSelectedWeek(w)}
                      className="flex items-center gap-3 p-3 text-left hover:opacity-85 transition-opacity"
                      style={{ background: "#FAFCFF", borderRadius: 12, border: "1px solid #F0F3F8" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{w.label}</p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: "#91929E" }}>
                          {w.file_name ? w.file_name : "Fayl yuklanmagan"}
                          {w.uploaded_at && <> · {new Date(w.uploaded_at).toLocaleDateString("uz-UZ")}</>}
                          {w.description && <> · Ish tavsifi bor</>}
                        </p>
                      </div>
                      {w.ball != null && (
                        <span className="text-xs font-bold px-2 py-1 flex-shrink-0" style={{ background: "rgba(0,196,140,0.1)", color: "#00C48C", borderRadius: 8 }}>
                          {w.ball} ball
                        </span>
                      )}
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: w.file_name || w.description ? "rgba(63,140,255,0.1)" : "#F4F9FD", borderRadius: 8 }}>
                        <FileText size={13} style={{ color: w.file_name || w.description ? "#3F8CFF" : "#D9E3F0" }} />
                      </div>
                    </button>
                  ))}
                  {data.weekly_reports.length === 0 && (
                    <p className="text-xs text-center py-6 md:col-span-2" style={{ color: "#91929E" }}>Bu oy uchun haftalik hisobot yo'q</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4" style={{ borderTop: "2px solid #F4F9FD" }}>
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Izohlar:</p>
                  <p className="text-xs" style={{ color: "#3D4557" }}>{data.scores.comment || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Tayyorladi:</p>
                  <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{data.prepared_by_name || "—"}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#91929E" }}>Sana: {data.report_date}</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Tasdiqladi:</p>
                  <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{data.approved_by_name || "—"}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#91929E" }}>Sana: {data.report_date}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedNote && <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />}
      {selectedWeek && <WeekReportModal week={selectedWeek} onClose={() => setSelectedWeek(null)} />}
    </div>
  );
}
