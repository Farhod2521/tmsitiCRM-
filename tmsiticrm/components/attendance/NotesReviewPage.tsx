"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import NoteFileLink from "@/components/attendance/NoteFileLink";
import { fmtDateTimeUz } from "@/lib/datetime";
import { waitingFor } from "@/components/attendance/noteStages";
import {
  MessageSquareWarning, AlarmClock, UserX, MapPinned, DoorOpen, Loader2, Check, X as XIcon, Clock,
  CalendarDays, MoreVertical, ChevronLeft, ChevronRight, Info, CheckCircle2, XCircle, Hourglass, MapPin,
} from "lucide-react";

type ReviewStatus = "bolim_kutilmoqda" | "kutilmoqda" | "kadr_tasdiqladi" | "sababli" | "sababsiz";
type NoteType = "kechikish" | "kelmaslik" | "obyektda" | "ruxsat";

interface AttendanceNote {
  id: number;
  employee_id: number;
  employee_nomi: string | null;
  position: string | null;
  department_nomi: string | null;
  note_type: NoteType;
  text: string | null;
  date_from: string;
  date_to: string;
  expected_time: string | null;
  file_name?: string | null;
  object_time_from: string | null;
  object_time_to: string | null;
  object_latitude: number | null;
  object_longitude: number | null;
  created_at: string;
  review_status: ReviewStatus;
  bolim_by_nomi?: string | null;
  bolim_at?: string | null;
  reviewed_by_nomi: string | null;
  reviewed_at: string | null;
  zamdirektor_by_nomi: string | null;
  zamdirektor_at: string | null;
}

const NOTE_TYPE_CFG: Record<NoteType, { label: string; icon: typeof AlarmClock; color: string; bg: string }> = {
  obyektda:  { label: "Obyektda",        icon: MapPinned,  color: "#3F8CFF", bg: "rgba(63,140,255,0.12)"  },
  kechikish: { label: "Kechikadi",       icon: AlarmClock, color: "#C98A00", bg: "rgba(224,164,0,0.15)"   },
  kelmaslik: { label: "Kelmaydi",        icon: UserX,      color: "#FF5C5C", bg: "rgba(255,92,92,0.12)"   },
  ruxsat:    { label: "Ruxsat so'ragan", icon: DoorOpen,   color: "#6D5DD3", bg: "rgba(109,93,211,0.12)"  },
};

type FilterKey = "barchasi" | "bolim_kutilmoqda" | "kutilmoqda" | "kadr_tasdiqladi" | "sababli" | "sababsiz";

// Kim ko'rib chiqadi: kadr — "kutilmoqda", bo'lim boshlig'i — "bolim_kutilmoqda"
type ActionStatus = "kutilmoqda" | "bolim_kutilmoqda";

const filtersFor = (action: ActionStatus): { key: FilterKey; label: string }[] => [
  { key: "barchasi",  label: "Barchasi" },
  { key: "bolim_kutilmoqda", label: action === "bolim_kutilmoqda" ? "Sizda kutilmoqda" : "Bo'lim boshlig'ida" },
  { key: "kutilmoqda", label: action === "kutilmoqda" ? "Sizda kutilmoqda" : "Kadrda" },
  { key: "kadr_tasdiqladi", label: "Zamdirektorda" },
  { key: "sababli",   label: "Sababli" },
  { key: "sababsiz",  label: "Sababsiz" },
];

const REVIEW_CFG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  bolim_kutilmoqda: { label: "Bo'lim boshlig'ida",          color: "#B4780C", bg: "rgba(255,189,33,0.16)" },
  kutilmoqda:       { label: "Kutilmoqda",                  color: "#7D8592", bg: "rgba(145,146,158,0.14)" },
  kadr_tasdiqladi:  { label: "Zamdirektor tasdiqlashi kutilmoqda", color: "#2D6BE0", bg: "rgba(63,140,255,0.12)" },
  sababli:          { label: "Sababli",                     color: "#00A578", bg: "rgba(0,165,120,0.12)" },
  sababsiz:         { label: "Sababsiz",                    color: "#E5484D", bg: "rgba(255,92,92,0.12)" },
};

type Period = "barchasi" | "bugun" | "hafta" | "oy" | "otgan_oy";
const PERIODS: { key: Period; label: string }[] = [
  { key: "barchasi", label: "Barchasi" }, { key: "bugun", label: "Bugun" }, { key: "hafta", label: "Shu hafta" },
  { key: "oy", label: "Shu oy" }, { key: "otgan_oy", label: "O'tgan oy" },
];

const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const PAGE_SIZE = 10;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function initials(name: string | null) {
  return (name || "?").split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function shortDt(iso: string) {
  // "10-09 15:50" (Toshkent vaqti)
  const s = fmtDateTimeUz(iso);
  const m = /(\d{2})\.(\d{2})(?:\.\d{4})?\s+(\d{2}:\d{2})/.exec(s);
  return m ? `${m[2]}-${m[1]} ${m[3]}` : s;
}
/** Ariza sanasi tanlangan davrga tushadimi (date_from–date_to oralig'i kesishsa). */
function inPeriod(n: AttendanceNote, p: Period): boolean {
  if (p === "barchasi") return true;
  const now = new Date();
  let from: Date, to: Date;
  if (p === "bugun") { from = to = now; }
  else if (p === "hafta") {
    from = new Date(now); from.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    to = new Date(from); to.setDate(from.getDate() + 6);
  } else if (p === "oy") { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
  else { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
  return n.date_to >= ymd(from) && n.date_from <= ymd(to);
}

/** Tasdiqlash tarixi (⋮ bosilganda ochiladi). */
function History({ n }: { n: AttendanceNote }) {
  const rejected = n.review_status === "sababsiz";
  const steps: { who: string; name?: string | null; at?: string | null; state: "ok" | "no" | "wait" }[] = [];
  if (n.bolim_by_nomi || n.review_status === "bolim_kutilmoqda") {
    steps.push({ who: "Bo'lim boshlig'i", name: n.bolim_by_nomi, at: n.bolim_at,
      state: n.bolim_by_nomi ? (rejected && !n.reviewed_by_nomi ? "no" : "ok") : "wait" });
  }
  steps.push({ who: "Kadrlar bo'limi", name: n.reviewed_by_nomi, at: n.reviewed_at,
    state: n.reviewed_by_nomi ? (rejected && !n.zamdirektor_by_nomi ? "no" : "ok") : "wait" });
  steps.push({ who: "Zamdirektor", name: n.zamdirektor_by_nomi, at: n.zamdirektor_at,
    state: n.zamdirektor_by_nomi ? (rejected ? "no" : "ok") : "wait" });
  const stop = steps.findIndex(s => s.state !== "ok");
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      {steps.map((s, i) => {
        const pending = s.state === "wait" && (stop === -1 || i > stop || rejected);
        const Icon = s.state === "ok" ? CheckCircle2 : s.state === "no" ? XCircle : Hourglass;
        const color = s.state === "ok" ? "#00A578" : s.state === "no" ? "#E5484D" : pending ? "#C4CBD6" : "#C98A00";
        return (
          <div key={s.who} className="flex items-start gap-2 text-xs">
            <Icon size={15} style={{ color, marginTop: 1 }} />
            <span>
              <b style={{ color: pending ? "#A8B0BD" : "#0A1629" }}>{s.who}</b>
              <span className="block" style={{ color: "#7D8592" }}>
                {s.name ? `${s.name}${s.at ? ` · ${fmtDateTimeUz(s.at)}` : ""}` : pending ? "navbatda" : "kutilmoqda"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Davomat arizalarini ko'rib chiqish jadvali — kadr (/xodim/izohlar) va
 *  bo'lim boshlig'i (/bolimboshliq/izohlar) uchun umumiy. Tugmalar faqat
 *  shu rolning navbatidagi (actionStatus) arizalarida chiqadi. */
export default function NotesReviewPage({ actionStatus }: { actionStatus: ActionStatus }) {
  const FILTERS = filtersFor(actionStatus);
  const [notes,   setNotes]   = useState<AttendanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterKey>("barchasi");
  const [period,  setPeriod]  = useState<Period>("barchasi");
  const [page,    setPage]    = useState(1);
  const [open,    setOpen]    = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = useCallback(() => {
    apiFetch<AttendanceNote[]>("/attendance/notes")
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReview(id: number, status: "sababli" | "sababsiz") {
    setReviewingId(id);
    try {
      await apiFetch(`/attendance/notes/${id}/review`, { method: "POST", body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setReviewingId(null);
    }
  }

  const inP = useMemo(() => notes.filter(n => inPeriod(n, period)), [notes, period]);
  const counts: Record<FilterKey, number> = {
    barchasi: inP.length,
    bolim_kutilmoqda: inP.filter(n => n.review_status === "bolim_kutilmoqda").length,
    kutilmoqda: inP.filter(n => n.review_status === "kutilmoqda").length,
    kadr_tasdiqladi: inP.filter(n => n.review_status === "kadr_tasdiqladi").length,
    sababli: inP.filter(n => n.review_status === "sababli").length,
    sababsiz: inP.filter(n => n.review_status === "sababsiz").length,
  };
  const visible = inP.filter(n => filter === "barchasi" || n.review_status === filter);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const dateCell = (n: AttendanceNote) => {
    const d = new Date(n.date_from + "T00:00:00");
    return (
      <div className="flex items-start gap-2">
        <CalendarDays size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#91929E" }} />
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "#3D4557" }}>{n.date_from}</p>
          <p className="text-xs" style={{ color: "#91929E" }}>{n.date_from === n.date_to ? WD[d.getDay()] : `— ${n.date_to}`}</p>
        </div>
      </div>
    );
  };
  const izoh = (n: AttendanceNote) => (
    <div className="min-w-0">
      <p className="text-[13.5px] leading-snug line-clamp-3" style={{ color: "#0A1629" }} title={n.text || ""}>{n.text || "—"}</p>
      {n.note_type === "kechikish" && n.expected_time && <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>~{n.expected_time} da keladi</p>}
      {(n.note_type === "obyektda" || n.note_type === "ruxsat") && (n.object_time_from || n.object_time_to) && (
        <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{n.object_time_from || "—"}—{n.object_time_to || "—"}</p>
      )}
      {n.file_name && <NoteFileLink noteId={n.id} name={n.file_name} />}
    </div>
  );
  const holat = (n: AttendanceNote) => {
    const rc = REVIEW_CFG[n.review_status];
    const wait = waitingFor(n.review_status, actionStatus);
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-bold leading-tight"
        style={{ background: rc.bg, color: rc.color, borderRadius: 8 }} title={wait ?? rc.label}>
        {rc.label}{n.review_status === "kadr_tasdiqladi" && <Info size={12} className="flex-shrink-0" />}
      </span>
    );
  };
  const actions = (n: AttendanceNote) => {
    if (n.review_status === actionStatus) {
      const busy = reviewingId === n.id;
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => handleReview(n.id, "sababli")} disabled={busy}
            className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-white whitespace-nowrap disabled:opacity-50 hover:opacity-90"
            style={{ background: "#00C48C", borderRadius: 9 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Tasdiqlash
          </button>
          <button onClick={() => handleReview(n.id, "sababsiz")} disabled={busy}
            className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50 hover:bg-[#FFF5F5]"
            style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 9 }}>
            <XIcon size={13} /> Rad etish
          </button>
        </div>
      );
    }
    const wait = waitingFor(n.review_status, actionStatus);
    return wait
      ? <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "#91929E" }}><Clock size={13} /> {wait}</span>
      : <span style={{ color: "#C4CBD6" }}>—</span>;
  };
  const kebab = (n: AttendanceNote) => (
    <button onClick={() => setOpen(o => o === n.id ? null : n.id)} aria-label="Batafsil" title="Tasdiqlash tarixi"
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"
      style={{ background: open === n.id ? "#EEF5FF" : undefined }}>
      <MoreVertical size={16} style={{ color: "#7D8592" }} />
    </button>
  );
  const details = (n: AttendanceNote) => (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3" style={{ background: "#F8FAFF", borderRadius: 12 }}>
      <History n={n} />
      <div className="flex flex-col gap-1 text-xs">
        {n.text && n.text.length > 120 && <p className="max-w-[520px]" style={{ color: "#3D4557", whiteSpace: "pre-wrap" }}>{n.text}</p>}
        {n.note_type === "obyektda" && n.object_latitude != null && n.object_longitude != null && (
          <a href={`https://www.google.com/maps?q=${n.object_latitude},${n.object_longitude}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold" style={{ color: "#3F8CFF" }}>
            <MapPin size={13} /> Xaritada ko&apos;rish
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Izohlar" subtitle={actionStatus === "bolim_kutilmoqda"
        ? "Bo'limingiz xodimlarining arizalarini tasdiqlang — keyin kadrga o'tadi"
        : "Xodimlarning kechikish/kelmaslik haqidagi izohlarini ko'rib chiqing"} />

      <div className="p-4 sm:p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
        {/* Filtrlar */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
                  className="px-4 py-2.5 text-sm font-bold transition-all"
                  style={{ background: active ? "#0A1629" : "#F4F9FD", color: active ? "#FFFFFF" : "#3D4557", borderRadius: 12 }}>
                  {f.label}
                  <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md"
                    style={{ background: active ? "rgba(255,255,255,0.2)" : "rgba(145,146,158,0.14)", color: active ? "#FFFFFF" : "#7D8592" }}>
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2.5 px-3.5 py-2" style={{ border: "1px solid #E4EAF2", borderRadius: 12 }}>
            <CalendarDays size={17} style={{ color: "#7D8592" }} />
            <span className="flex flex-col">
              <span className="text-[11px]" style={{ color: "#91929E" }}>Sana oralig&apos;i</span>
              <select value={period} onChange={e => { setPeriod(e.target.value as Period); setPage(1); }}
                className="text-[13px] font-semibold outline-none bg-transparent cursor-pointer -ml-0.5" style={{ color: "#0A1629" }}>
                {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </span>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-14"><Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14">
            <MessageSquareWarning size={32} className="mx-auto mb-3" style={{ color: "#D0D9E8" }} />
            <p className="text-sm font-bold" style={{ color: "#91929E" }}>Izoh topilmadi</p>
          </div>
        ) : (
          <>
            {/* Kompyuter — qat'iy ustunli jadval (gorizontal scroll yo'q) */}
            <table className="hidden xl:table w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "3%" }} /><col style={{ width: "14%" }} /><col style={{ width: "9%" }} /><col style={{ width: "8%" }} />
                <col style={{ width: "18%" }} /><col style={{ width: "9%" }} /><col style={{ width: "7%" }} /><col style={{ width: "9%" }} />
                <col style={{ width: "20%" }} /><col style={{ width: "3%" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#F8FAFF" }}>
                  {["#", "Xodim", "Bo'lim", "Turi", "Izoh", "Sana", "Yozilgan", "Holat", "Amallar", ""].map((h, i) => (
                    <th key={i} className="text-left px-2.5 py-3 text-[11px] font-bold uppercase"
                      style={{ color: "#7D8592", letterSpacing: "0.05em", borderRadius: i === 0 ? "10px 0 0 10px" : i === 9 ? "0 10px 10px 0" : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((n, i) => {
                  const tc = NOTE_TYPE_CFG[n.note_type];
                  const dim = !!waitingFor(n.review_status, actionStatus);
                  return (
                    <Fragment key={n.id}>
                      <tr className="align-middle hover:bg-[#FAFCFF] transition-colors"
                        style={{ borderBottom: open === n.id ? "none" : "1px solid #EEF2F8", opacity: dim ? 0.6 : 1 }}>
                        <td className="px-2.5 py-3.5 text-sm font-bold" style={{ color: "#91929E" }}>{(cur - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-2.5 py-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-[13px] font-bold"
                              style={{ background: "rgba(109,93,211,0.12)", color: "#4B3FBF" }}>{initials(n.employee_nomi)}</span>
                            <span className="min-w-0">
                              <span className="block font-bold text-sm truncate" style={{ color: "#0A1629" }} title={n.employee_nomi || ""}>{n.employee_nomi || "—"}</span>
                              <span className="block text-xs truncate" style={{ color: "#91929E" }} title={n.position || ""}>{n.position || "—"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-3.5 text-[13px] leading-snug" style={{ color: "#7D8592" }}>
                          <span className="line-clamp-2" title={n.department_nomi || ""}>{n.department_nomi || "—"}</span>
                        </td>
                        <td className="px-2.5 py-3.5">
                          <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-lg leading-tight" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
                        </td>
                        <td className="px-2.5 py-3.5">{izoh(n)}</td>
                        <td className="px-2.5 py-3.5 whitespace-nowrap">
                          <p className="text-[12.5px]" style={{ color: "#3D4557" }}>{n.date_from}</p>
                          <p className="text-[11.5px]" style={{ color: "#91929E" }}>
                            {n.date_from === n.date_to ? WD[new Date(n.date_from + "T00:00:00").getDay()] : `— ${n.date_to}`}
                          </p>
                        </td>
                        <td className="px-2.5 py-3.5">
                          <p className="text-[12px] whitespace-nowrap" style={{ color: "#7D8592" }}>{shortDt(n.created_at).split(" ")[0]}</p>
                          <p className="text-[12px] whitespace-nowrap flex items-center gap-1" style={{ color: "#91929E" }}><Clock size={11} />{shortDt(n.created_at).split(" ")[1]}</p>
                        </td>
                        <td className="px-2.5 py-3.5">{holat(n)}</td>
                        <td className="px-1.5 py-3.5">{actions(n)}</td>
                        <td className="px-1 py-3.5 text-right">{kebab(n)}</td>
                      </tr>
                      {open === n.id && (
                        <tr style={{ borderBottom: "1px solid #EEF2F8" }}>
                          <td />
                          <td colSpan={9} className="px-2.5 pb-3.5">{details(n)}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Planshet/telefon — kartochkalar */}
            <div className="xl:hidden flex flex-col gap-3">
              {shown.map(n => {
                const tc = NOTE_TYPE_CFG[n.note_type];
                return (
                  <div key={n.id} className="p-4 flex flex-col gap-3" style={{ border: "1px solid #EEF2F8", borderRadius: 16, opacity: waitingFor(n.review_status, actionStatus) ? 0.65 : 1 }}>
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: "rgba(109,93,211,0.12)", color: "#4B3FBF" }}>{initials(n.employee_nomi)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{n.employee_nomi || "—"}</p>
                        <p className="text-xs" style={{ color: "#91929E" }}>{n.position || "—"} · {n.department_nomi || "—"}</p>
                      </div>
                      {kebab(n)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
                      {holat(n)}
                    </div>
                    {izoh(n)}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {dateCell(n)}
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: "#7D8592" }}><Clock size={14} /> {shortDt(n.created_at)}</span>
                    </div>
                    {open === n.id && details(n)}
                    {actions(n)}
                  </div>
                );
              })}
            </div>

            {/* Sahifalash */}
            <div className="flex items-center justify-between gap-3 flex-wrap mt-5">
              <p className="text-sm" style={{ color: "#91929E" }}>
                {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, visible.length)} / {visible.length} ta izoh
              </p>
              {pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button disabled={cur === 1} onClick={() => setPage(cur - 1)} aria-label="Oldingi"
                    className="w-9 h-9 flex items-center justify-center disabled:opacity-35" style={{ border: "1px solid #E4EAF2", borderRadius: 10 }}>
                    <ChevronLeft size={16} style={{ color: "#3D4557" }} />
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pages || Math.abs(p - cur) <= 1)
                    .map((p, idx, arr) => (
                      <Fragment key={p}>
                        {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-sm" style={{ color: "#91929E" }}>…</span>}
                        <button onClick={() => setPage(p)}
                          className="min-w-9 h-9 px-2 text-sm font-bold"
                          style={{ background: p === cur ? "#3F8CFF" : "#FFFFFF", color: p === cur ? "#FFFFFF" : "#3D4557", border: `1px solid ${p === cur ? "#3F8CFF" : "#E4EAF2"}`, borderRadius: 10 }}>
                          {p}
                        </button>
                      </Fragment>
                    ))}
                  <button disabled={cur === pages} onClick={() => setPage(cur + 1)} aria-label="Keyingi"
                    className="w-9 h-9 flex items-center justify-center disabled:opacity-35" style={{ border: "1px solid #E4EAF2", borderRadius: 10 }}>
                    <ChevronRight size={16} style={{ color: "#3D4557" }} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
