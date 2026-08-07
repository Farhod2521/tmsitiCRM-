"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, CheckCircle2, Clock, Calendar as CalIcon, Loader2, Footprints, Map as MapIcon, X, Crosshair, XCircle, Fingerprint, ArrowRight, Check, MessageSquareWarning } from "lucide-react";
import { apiFetch } from "@/lib/api";
import FaceVerifyModal from "@/components/profile/FaceVerifyModal";

interface Attendance {
  id: number;
  employee_id: number;
  date: string;          // "2026-06-09"
  check_in: string;      // ISO datetime
  latitude: number;
  longitude: number;
  distance_m: number | null;
  late_minutes: number;          // ish boshlanishidan kechikish (daqiqa)
  check_in_local: string | null; // "HH:MM" — UTC+5 mahalliy vaqt
}

type NoteType = "kechikish" | "kelmaslik" | "obyektda";
interface AttendanceNote {
  id: number;
  note_type: NoteType;
  text: string | null;
  date_from: string;
  date_to: string;
  expected_time: string | null;
  object_time_from: string | null;
  object_time_to: string | null;
  object_latitude: number | null;
  object_longitude: number | null;
  created_at: string;
}

const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  obyektda:  "Obyektda",
  kechikish: "Kechikaman",
  kelmaslik: "Kelmayman",
};
const NOTE_TYPE_COLOR: Record<NoteType, string> = {
  obyektda:  "#3F8CFF",
  kechikish: "#E0A400",
  kelmaslik: "#FF5C5C",
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateUz(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

interface Office {
  latitude: number;
  longitude: number;
  radius_m: number;
  work_start?: string;   // "09:00"
}

// Kechikish rangi: ≤10 daq yashil, 10–30 sariq, >30 qizil
function lateColor(min: number): string {
  if (min <= 10) return "#00A578";   // yashil
  if (min <= 30) return "#E0A400";   // sariq
  return "#FF5C5C";                  // qizil
}

// Kechikishni matn ko'rinishida: "12 daq kech" yoki "Vaqtida"
function lateText(min: number): string {
  if (min <= 0) return "Vaqtida";
  return `${min} daq kech`;
}

// Haversine — ikki nuqta orasidagi masofa (metr)
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Piyoda taxminiy vaqt (o'rtacha 80 m/min ≈ 4.8 km/soat)
function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
const WEEKDAYS_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function AttendanceCalendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  const [records, setRecords] = useState<Attendance[]>([]);
  const [todayRec, setTodayRec] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [office, setOffice] = useState<Office | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showFace, setShowFace] = useState(false);

  const [myNote, setMyNote] = useState<AttendanceNote | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>("kechikish");
  const [noteText, setNoteText] = useState("");
  const [noteDateFrom, setNoteDateFrom] = useState(todayStr());
  const [noteDateTo, setNoteDateTo] = useState(todayStr());
  const [noteExpectedTime, setNoteExpectedTime] = useState("");
  const [noteObjTimeFrom, setNoteObjTimeFrom] = useState("");
  const [noteObjTimeTo, setNoteObjTimeTo] = useState("");
  const [noteObjLat, setNoteObjLat] = useState<number | null>(null);
  const [noteObjLng, setNoteObjLng] = useState<number | null>(null);
  const [noteLocating, setNoteLocating] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  function handleGetNoteLocation() {
    if (!navigator.geolocation) {
      setNoteError("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi.");
      return;
    }
    setNoteLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNoteObjLat(pos.coords.latitude);
        setNoteObjLng(pos.coords.longitude);
        setNoteLocating(false);
      },
      () => {
        setNoteError("Joylashuvni aniqlab bo'lmadi. Brauzer sozlamalaridan ruxsat bering.");
        setNoteLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  const loadNote = useCallback(() => {
    apiFetch<AttendanceNote | null>("/attendance/notes/mine").then(setMyNote).catch(() => {});
  }, []);

  useEffect(() => { loadNote(); }, [loadNote]);

  async function handleSendNote() {
    setNoteError(null);
    if (noteDateTo < noteDateFrom) {
      setNoteError("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
      return;
    }
    if (noteType === "obyektda" && noteObjTimeFrom && noteObjTimeTo && noteObjTimeTo < noteObjTimeFrom) {
      setNoteError("Tugash vaqti boshlanish vaqtidan oldin bo'lishi mumkin emas");
      return;
    }
    setNoteSaving(true);
    try {
      const res = await apiFetch<AttendanceNote>("/attendance/notes", {
        method: "POST",
        body: JSON.stringify({
          note_type: noteType,
          date_from: noteDateFrom,
          date_to: noteDateTo,
          expected_time: noteType === "kechikish" ? (noteExpectedTime || null) : null,
          object_time_from: noteType === "obyektda" ? (noteObjTimeFrom || null) : null,
          object_time_to: noteType === "obyektda" ? (noteObjTimeTo || null) : null,
          object_latitude: noteType === "obyektda" ? noteObjLat : null,
          object_longitude: noteType === "obyektda" ? noteObjLng : null,
          text: noteText || null,
        }),
      });
      setMyNote(res);
      setShowNoteModal(false);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setNoteSaving(false);
    }
  }

  function openNoteEdit() {
    setNoteType("kechikish");
    setNoteText("");
    setNoteDateFrom(todayStr());
    setNoteDateTo(todayStr());
    setNoteExpectedTime("");
    setNoteObjTimeFrom("");
    setNoteObjTimeTo("");
    setNoteObjLat(null);
    setNoteObjLng(null);
    setNoteError(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, t] = await Promise.all([
        apiFetch<Attendance[]>(`/attendance/my-month?year=${year}&month=${month}`),
        apiFetch<Attendance | null>(`/attendance/today`),
      ]);
      setRecords(recs);
      setTodayRec(t);
    } catch (e) {
      console.error("Davomat yuklanmadi:", e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Ofis koordinatasini bir marta yuklash
  useEffect(() => {
    apiFetch<Office>("/attendance/office").then(setOffice).catch(() => {});
  }, []);

  async function handleCheckIn() {
    setMsg(null);
    if (!navigator.geolocation) {
      setMsg({ type: "err", text: "Brauzeringiz joylashuvni qo'llab-quvvatlamaydi." });
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const rec = await apiFetch<Attendance>("/attendance/check-in", {
            method: "POST",
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          setTodayRec(rec);
          setMsg({ type: "ok", text: `Ishga kelganingiz belgilandi! Soat ${fmtTime(rec.check_in)}` });
          await load();
        } catch (e: unknown) {
          setMsg({ type: "err", text: e instanceof Error ? e.message : "Belgilashda xato yuz berdi." });
        } finally {
          setChecking(false);
        }
      },
      (err) => {
        setChecking(false);
        const text =
          err.code === err.PERMISSION_DENIED
            ? "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering."
            : "Joylashuvni aniqlab bo'lmadi. GPS yoqilganini tekshiring.";
        setMsg({ type: "err", text });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ── Calendar grid hisoblash ─────────────────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate();
  // Dushanba = 0 boshlanishi uchun: JS getDay() 0=Yakshanba
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const presentDays = new Set(records.map((r) => parseInt(r.date.slice(8, 10), 10)));
  const recByDay = new Map(records.map((r) => [parseInt(r.date.slice(8, 10), 10), r]));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayDay = today.getDate();
  const presentCount = records.length;

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  const onTimeCount  = records.filter(r => r.late_minutes <= 10).length;
  const lateCount    = records.filter(r => r.late_minutes > 10 && r.late_minutes <= 30).length;
  const veryLateCount = records.filter(r => r.late_minutes > 30).length;
  function pct(n: number) { return presentCount > 0 ? Math.round((n / presentCount) * 100) : 0; }

  const STATS = [
    { icon: CheckCircle2, label: "Vaqtida kelgan kunlar",   value: onTimeCount,   percent: pct(onTimeCount),   color: "#00A578", bg: "rgba(0,165,120,0.1)" },
    { icon: Clock,        label: "Kechikkan kunlar",        value: lateCount,     percent: pct(lateCount),     color: "#E0A400", bg: "rgba(224,164,0,0.1)" },
    { icon: XCircle,      label: "Katta kechikkan kunlar",  value: veryLateCount, percent: pct(veryLateCount), color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
    { icon: CalIcon,      label: "Umumiy kunlar",           value: presentCount,  percent: null as number | null, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
  ];

  return (
    <div className="p-6"
      style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* ── Chap ustun: kalendar ── */}
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 flex items-center justify-center"
                style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                <CalIcon size={20} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Davomat kalendari</h3>
                <p className="text-xs" style={{ color: "#91929E" }}>
                  {MONTHS_UZ[month - 1]} {year} · {presentCount} kun kelgan · {office?.work_start ?? "09:00"} da ish boshlaysiz
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center font-bold hover:opacity-80"
                style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>‹</button>
              <button onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center font-bold hover:opacity-80"
                style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>›</button>
              {!isCurrentMonth && (
                <button onClick={goToday}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80"
                  style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>
                  <CalIcon size={13} /> Bugun
                </button>
              )}
              {office && (
                <button onClick={() => setShowMap(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:opacity-90"
                  style={{ background: "#3F8CFF", borderRadius: 10 }}>
                  <MapIcon size={13} /> Xarita
                </button>
              )}
            </div>
          </div>

          {/* "Keldim" tugmasi */}
          {isCurrentMonth && (
            <div className="mb-5">
              <div className="grid grid-cols-2 gap-3">
                {todayRec ? (
                  <div className="flex items-center gap-3 px-4 py-3.5"
                    style={{ background: "rgba(0,196,140,0.08)", borderRadius: 14 }}>
                    <CheckCircle2 size={22} style={{ color: "#00C48C" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                        Bugun ishga kelgansiz
                      </p>
                      <p className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: "#91929E" }}>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> Soat {todayRec.check_in_local ?? fmtTime(todayRec.check_in)}
                        </span>
                        <span className="font-bold" style={{ color: lateColor(todayRec.late_minutes) }}>
                          · {lateText(todayRec.late_minutes)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowFace(true)}
                    disabled={checking}
                    className="py-4 px-5 flex items-center gap-3.5 text-left hover:opacity-90 transition-opacity disabled:opacity-60"
                    style={{
                      background: "#3F8CFF",
                      borderRadius: 16,
                      boxShadow: "0px 10px 24px rgba(63,140,255,0.35)",
                    }}
                  >
                    <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.2)", borderRadius: 12 }}>
                      {checking
                        ? <Loader2 size={20} className="animate-spin" style={{ color: "#FFFFFF" }} />
                        : <Fingerprint size={22} style={{ color: "#FFFFFF" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#FFFFFF" }}>
                        {checking ? "Joylashuv aniqlanmoqda..." : "Ishga keldim"}
                      </p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
                        Bosish orqali davomatni belgilang
                      </p>
                    </div>
                    <ArrowRight size={18} style={{ color: "#FFFFFF" }} className="flex-shrink-0" />
                  </button>
                )}

                {/* Hisobot: kechikish/kelmaslik haqida xabar — modal orqali */}
                <button
                  onClick={() => { openNoteEdit(); setShowNoteModal(true); }}
                  className="py-4 px-5 flex items-center gap-3.5 text-left hover:opacity-90 transition-opacity"
                  style={{
                    background: myNote ? NOTE_TYPE_COLOR[myNote.note_type] : "#FFFFFF",
                    borderRadius: 16,
                    border: myNote ? "none" : "1.5px solid #EEF2FF",
                    boxShadow: myNote ? `0px 10px 24px ${NOTE_TYPE_COLOR[myNote.note_type]}4D` : "none",
                  }}
                >
                  <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center"
                    style={{ background: myNote ? "rgba(255,255,255,0.2)" : "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                    <MessageSquareWarning size={22} style={{ color: myNote ? "#FFFFFF" : "#3F8CFF" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: myNote ? "#FFFFFF" : "#0A1629" }}>
                      {myNote ? NOTE_TYPE_LABEL[myNote.note_type] : "Ariza yozish"}
                    </p>
                    <p className="text-xs truncate" style={{ color: myNote ? "rgba(255,255,255,0.85)" : "#91929E" }}>
                      {myNote
                        ? (myNote.date_from === myNote.date_to
                            ? fmtDateUz(myNote.date_from)
                            : `${fmtDateUz(myNote.date_from)} — ${fmtDateUz(myNote.date_to)}`)
                        : "Kechikish yoki kelmaslik haqida"}
                    </p>
                  </div>
                </button>
              </div>

              {msg && (
                <div className="mt-2.5 px-4 py-2.5 text-sm font-bold"
                  style={{
                    background: msg.type === "ok" ? "rgba(0,196,140,0.1)" : "rgba(255,92,92,0.08)",
                    color: msg.type === "ok" ? "#00A578" : "#FF5C5C",
                    borderRadius: 12,
                  }}>
                  {msg.text}
                </div>
              )}
            </div>
          )}

          {/* Kalendar */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {WEEKDAYS_UZ.map((w, i) => (
                  <div key={w} className="text-center text-xs font-bold py-1"
                    style={{ color: i >= 5 ? "#FF5C5C" : "#91929E" }}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((d, idx) => {
                  if (d === null) return <div key={`e${idx}`} />;
                  const dow = (firstDow + d - 1) % 7;
                  const isWeekend = dow >= 5;
                  const present = presentDays.has(d);
                  const rec = recByDay.get(d);
                  const isToday = isCurrentMonth && d === todayDay;

                  const dotColor = isToday ? "#3F8CFF" : rec ? lateColor(rec.late_minutes) : "#00A578";
                  return (
                    <div key={d}
                      title={rec ? `Soat ${rec.check_in_local ?? ""} — ${lateText(rec.late_minutes)}` : undefined}
                      className="flex flex-col items-center justify-center relative"
                      style={{
                        minHeight: 66,
                        background: "#FFFFFF",
                        borderRadius: 12,
                        border: isToday ? "2px solid #3F8CFF" : "1px solid #F0F3F8",
                      }}>
                      {isToday && todayRec && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full"
                          style={{ background: "#3F8CFF", border: "2px solid #FFFFFF" }}>
                          <Check size={9} style={{ color: "#FFFFFF" }} strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-base font-bold leading-none"
                        style={{ color: isWeekend ? "#FF8C8C" : "#0A1629" }}>
                        {d}
                      </span>
                      {present && (
                        <span className="w-1.5 h-1.5 rounded-full mt-2" style={{ background: dotColor }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend — kechikish ranglari */}
              <div className="flex items-center gap-4 flex-wrap mt-4 pt-4" style={{ borderTop: "1px solid #F0F3F8" }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#00A578" }} />
                  <span className="text-xs" style={{ color: "#91929E" }}>≤10 daq (vaqtida)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#E0A400" }} />
                  <span className="text-xs" style={{ color: "#91929E" }}>10–30 daq</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#FF5C5C" }} />
                  <span className="text-xs" style={{ color: "#91929E" }}>30 daq dan ko'p</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#3F8CFF" }} />
                  <span className="text-xs" style={{ color: "#91929E" }}>Bugun</span>
                </div>
              </div>
            </>
          )}

          {/* Statistika — mobil/tablet uchun (o'ng ustun yashirilganda) */}
          <div className="grid grid-cols-2 gap-3 mt-4 lg:hidden">
            {STATS.map(s => (
              <div key={s.label} className="flex items-center gap-2.5 p-3"
                style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full" style={{ background: s.bg }}>
                  <s.icon size={15} style={{ color: s.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] leading-tight truncate" style={{ color: "#91929E" }}>{s.label}</p>
                  <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{s.value} kun</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── O'ng ustun: rasm + statistika ── */}
        <div className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 220 }}>
          <img src="/calendar.png" alt="" draggable={false}
            className="w-full h-auto mb-5 select-none pointer-events-none" />
          <h4 className="font-bold text-sm mb-3" style={{ color: "#0A1629" }}>Davomat statistikasi</h4>
          <div className="flex flex-col gap-3">
            {STATS.map(s => (
              <div key={s.label} className="flex items-center gap-3 p-3"
                style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full" style={{ background: s.bg }}>
                  <s.icon size={16} style={{ color: s.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-tight" style={{ color: "#91929E" }}>{s.label}</p>
                  <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{s.value} kun</p>
                </div>
                {s.percent !== null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>
                    {s.percent}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Yuz tekshiruv modali ── */}
      {showFace && (
        <FaceVerifyModal
          onSuccess={() => { setShowFace(false); handleCheckIn(); }}
          onClose={() => setShowFace(false)}
        />
      )}

      {/* ── Xarita modali ── */}
      {showMap && office && (
        <MapModal office={office} onClose={() => setShowMap(false)} />
      )}

      {/* ── Kechikish/kelmaslik xabari modali ── */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
          onClick={() => setShowNoteModal(false)}>
          <div className="w-full max-w-md" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(224,164,0,0.12)", borderRadius: 12 }}>
                  <MessageSquareWarning size={18} style={{ color: "#E0A400" }} />
                </div>
                <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Davomat arizasi</h3>
              </div>
              <button onClick={() => setShowNoteModal(false)}
                className="w-9 h-9 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                <X size={16} style={{ color: "#7D8592" }} />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm font-bold mb-2.5" style={{ color: "#0A1629" }}>Holatingizni tanlang</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button onClick={() => setNoteType("obyektda")}
                  className="py-2.5 text-xs font-bold"
                  style={{
                    borderRadius: 10, border: "1.5px solid #EEF2FF",
                    background: noteType === "obyektda" ? NOTE_TYPE_COLOR.obyektda : "#F4F9FD",
                    color: noteType === "obyektda" ? "#FFFFFF" : "#7D8592",
                  }}>
                  Obyektda chiqdim
                </button>
                <button onClick={() => setNoteType("kechikish")}
                  className="py-2.5 text-xs font-bold"
                  style={{
                    borderRadius: 10, border: "1.5px solid #EEF2FF",
                    background: noteType === "kechikish" ? NOTE_TYPE_COLOR.kechikish : "#F4F9FD",
                    color: noteType === "kechikish" ? "#FFFFFF" : "#7D8592",
                  }}>
                  Kechikaman
                </button>
                <button onClick={() => setNoteType("kelmaslik")}
                  className="py-2.5 text-xs font-bold"
                  style={{
                    borderRadius: 10, border: "1.5px solid #EEF2FF",
                    background: noteType === "kelmaslik" ? NOTE_TYPE_COLOR.kelmaslik : "#F4F9FD",
                    color: noteType === "kelmaslik" ? "#FFFFFF" : "#7D8592",
                  }}>
                  Kelmayman
                </button>
              </div>

              <p className="text-xs font-bold mb-2" style={{ color: "#91929E" }}>
                Qaysi sana(lar) uchun? — bir necha kun oldindan ham yozishingiz mumkin
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input type="date" value={noteDateFrom}
                  onChange={e => {
                    setNoteDateFrom(e.target.value);
                    if (noteDateTo < e.target.value) setNoteDateTo(e.target.value);
                  }}
                  className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                <span className="text-xs font-bold" style={{ color: "#91929E" }}>—</span>
                <input type="date" value={noteDateTo} min={noteDateFrom}
                  onChange={e => setNoteDateTo(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
              </div>

              {noteType === "kechikish" && (
                <div className="mb-4">
                  <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>
                    Taxminan soat nechida yetib kelasiz? (ixtiyoriy)
                  </label>
                  <input type="time" value={noteExpectedTime} onChange={e => setNoteExpectedTime(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-bold outline-none"
                    style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                </div>
              )}

              {noteType === "obyektda" && (
                <div className="mb-4">
                  <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>
                    Soat nechidan nechigacha obyektda bo'lasiz? (ixtiyoriy)
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={noteObjTimeFrom} onChange={e => setNoteObjTimeFrom(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                      style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                    <span className="text-xs font-bold" style={{ color: "#91929E" }}>—</span>
                    <input type="time" value={noteObjTimeTo} onChange={e => setNoteObjTimeTo(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm font-bold outline-none"
                      style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                  </div>

                  <button type="button" onClick={handleGetNoteLocation} disabled={noteLocating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-3 text-xs font-bold disabled:opacity-60"
                    style={{
                      background: noteObjLat != null ? "rgba(0,196,140,0.1)" : "#F4F9FD",
                      color: noteObjLat != null ? "#00A578" : "#3F8CFF",
                      borderRadius: 10, border: `1.5px solid ${noteObjLat != null ? "rgba(0,196,140,0.3)" : "#EEF2FF"}`,
                    }}>
                    {noteLocating
                      ? <Loader2 size={13} className="animate-spin" />
                      : noteObjLat != null
                        ? <CheckCircle2 size={13} />
                        : <Crosshair size={13} />}
                    {noteLocating ? "Joylashuv aniqlanmoqda..." : noteObjLat != null ? "Joylashuv olindi" : "Turgan joyimni yuborish (ixtiyoriy)"}
                  </button>
                </div>
              )}

              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Sababini yozing (ixtiyoriy)..."
                rows={3} className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                style={{ background: "#F4F9FD", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />

              {noteError && (
                <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{noteError}</p>
              )}

              <button onClick={handleSendNote} disabled={noteSaving}
                className="w-full flex items-center justify-center gap-2 py-3 mt-4 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NOTE_TYPE_COLOR[noteType], borderRadius: 12 }}>
                {noteSaving ? <Loader2 size={14} className="animate-spin" /> : "Yuborish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Xarita modali: haqiqiy interaktiv OSM xarita (Leaflet CDN) ──────────────
// Ofis 100m radius, foydalanuvchi jonli joylashuvi (watchPosition), masofa va piyoda vaqt.

// Leaflet'ni CDN'dan faqat bir marta yuklash (npm paketsiz)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leafletPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(w.L);
    script.onerror = () => reject(new Error("Xarita kutubxonasi yuklanmadi (internet?)"));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

function MapModal({ office, onClose }: { office: Office; onClose: () => void }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errText, setErrText] = useState("");
  const [dist, setDist] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const watchId = useRef<number | null>(null);

  const inside = dist != null ? dist <= office.radius_m : false;

  // Foydalanuvchi nuqtasini xaritaga qo'yish / yangilash (faqat GPS'dan)
  const placeUser = useCallback((lat: number, lng: number, acc: number | null) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const d = haversineM(lat, lng, office.latitude, office.longitude);
    setDist(d);
    setAccuracy(acc);
    const color = d <= office.radius_m ? "#00C48C" : "#FF5C5C";

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker([lat, lng], {
        radius: 8, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1,
      }).addTo(map).bindPopup("📍 Siz turgan joy");
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
      userMarkerRef.current.setStyle({ fillColor: color });
    }

    const pts = [[lat, lng], [office.latitude, office.longitude]];
    if (!lineRef.current) {
      lineRef.current = L.polyline(pts, { color, weight: 3, dashArray: "6 6" }).addTo(map);
    } else {
      lineRef.current.setLatLngs(pts);
      lineRef.current.setStyle({ color });
    }

    map.fitBounds(pts, { padding: [60, 60], maxZoom: 17 });
  }, [office]);

  // GPS'ni qayta so'rash (aniqroq o'qish uchun)
  const relocate = useCallback(() => {
    if (!navigator.geolocation) {
      setErrText("Brauzer joylashuvni qo'llab-quvvatlamaydi.");
      return;
    }
    setErrText("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        placeUser(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        setLocating(false);
        setErrText(err.code === err.PERMISSION_DENIED
          ? "Joylashuvga ruxsat berilmadi."
          : "Joylashuvni aniqlab bo'lmadi (GPS / internet).");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [placeUser]);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current) return;
        LRef.current = L;

        const map = L.map(mapEl.current, { zoomControl: true }).setView(
          [office.latitude, office.longitude], 16
        );
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        L.circleMarker([office.latitude, office.longitude], {
          radius: 8, color: "#fff", weight: 3, fillColor: "#3F8CFF", fillOpacity: 1,
        }).addTo(map).bindPopup("🏢 Ofis (TMSITI)");

        L.circle([office.latitude, office.longitude], {
          radius: office.radius_m,
          color: "#3F8CFF", weight: 2, dashArray: "6 6",
          fillColor: "#3F8CFF", fillOpacity: 0.1,
        }).addTo(map);

        setStatus("ready");
        setTimeout(() => map.invalidateSize(), 100);

        // ── Jonli joylashuv kuzatuvi (faqat GPS — qo'lda o'zgartirib bo'lmaydi) ──
        if (!navigator.geolocation) {
          setErrText("Brauzer joylashuvni qo'llab-quvvatlamaydi.");
          return;
        }
        watchId.current = navigator.geolocation.watchPosition(
          (pos) => {
            placeUser(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          },
          (err) => {
            setErrText(err.code === err.PERMISSION_DENIED
              ? "Joylashuvga ruxsat berilmadi."
              : "Joylashuvni aniqlab bo'lmadi (GPS / internet).");
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("error");
        setErrText(e instanceof Error ? e.message : "Xarita yuklanmadi.");
      });

    return () => {
      cancelled = true;
      if (watchId.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [office, placeUser]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[760px] overflow-hidden"
        style={{ background: "#fff", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0F3F8" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 flex items-center justify-center"
              style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
              <MapIcon size={20} style={{ color: "#3F8CFF" }} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Ofis xaritasi</h3>
              <p className="text-xs" style={{ color: "#91929E" }}>
                Sizning joylashuvingiz va ofis ({Math.round(office.radius_m)} m radius)
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:opacity-80"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#91929E" }} />
          </button>
        </div>

        {/* Masofa / vaqt / holat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 px-4 sm:px-6 pt-4">
          <div className="px-3 py-2.5" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs mb-0.5" style={{ color: "#91929E" }}>Masofa</p>
            <p className="font-bold text-sm" style={{ color: dist == null ? "#91929E" : inside ? "#00A578" : "#FF5C5C" }}>
              {dist == null ? "—" : `${Math.round(dist)} m`}
            </p>
          </div>
          <div className="px-3 py-2.5" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "#91929E" }}>
              <Footprints size={11} /> Piyoda
            </p>
            <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
              {dist == null ? "—" : `~${walkMinutes(dist)} daqiqa`}
            </p>
          </div>
          <div className="px-3 py-2.5" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs mb-0.5" style={{ color: "#91929E" }}>Holat</p>
            <p className="font-bold text-sm" style={{ color: dist == null ? "#91929E" : inside ? "#00A578" : "#FF5C5C" }}>
              {dist == null ? "Aniqlanmoqda…" : inside ? "Hududda" : "Tashqarida"}
            </p>
          </div>
        </div>

        {/* Joyni qayta aniqlash tugmasi */}
        <div className="px-6 pt-3">
          <button onClick={relocate} disabled={locating}
            className="w-full py-2.5 flex items-center justify-center gap-2 font-bold text-sm text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: "#3F8CFF", borderRadius: 12 }}>
            {locating
              ? <><Loader2 size={15} className="animate-spin" /> Aniqlanmoqda…</>
              : <><Crosshair size={15} /> Joyni qayta aniqlash</>}
          </button>
        </div>

        {/* Xarita */}
        <div className="px-6 py-4">
          <div className="relative" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E6ECF2" }}>
            <div ref={mapEl} style={{ width: "100%", height: 360 }} />
            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#F7FAFE" }}>
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
                  <span className="text-xs" style={{ color: "#91929E" }}>Xarita yuklanmoqda…</span>
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#F7FAFE" }}>
                <span className="text-sm font-bold px-4 text-center" style={{ color: "#FF5C5C" }}>{errText}</span>
              </div>
            )}
          </div>

          {/* Legend + GPS aniqligi + ogohlantirish */}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#91929E" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#3F8CFF" }} /> Ofis
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#91929E" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: inside ? "#00C48C" : "#FF5C5C" }} /> Siz
              </span>
            </div>
            {accuracy != null && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "#91929E" }}>
                <Crosshair size={11} /> GPS aniqligi: ±{Math.round(accuracy)} m
              </span>
            )}
          </div>

          {errText && status === "ready" && (
            <div className="mt-2.5 px-4 py-2.5 text-xs font-bold"
              style={{ background: "rgba(255,189,33,0.12)", color: "#B8860B", borderRadius: 12 }}>
              ⚠️ {errText} Joylashuv eski bo'lishi mumkin — GPS va internetni tekshiring.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
