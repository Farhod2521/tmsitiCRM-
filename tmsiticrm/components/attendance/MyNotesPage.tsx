"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import NoteFileLink from "@/components/attendance/NoteFileLink";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import {
  AlarmClock, UserX, MapPinned, DoorOpen, Loader2, CheckCircle2, XCircle, Hourglass, Circle, Inbox, Send,
} from "lucide-react";

type NoteType = "kechikish" | "kelmaslik" | "obyektda" | "ruxsat";
type ReviewStatus = "bolim_kutilmoqda" | "kutilmoqda" | "kadr_tasdiqladi" | "sababli" | "sababsiz";

interface MyNote {
  id: number;
  note_type: NoteType;
  text: string | null;
  date_from: string;
  date_to: string;
  expected_time: string | null;
  object_time_from: string | null;
  object_time_to: string | null;
  file_name?: string | null;
  created_at: string;
  review_status: ReviewStatus;
  bolim_by_nomi: string | null;
  bolim_at: string | null;
  reviewed_by_nomi: string | null;
  reviewed_at: string | null;
  zamdirektor_by_nomi: string | null;
  zamdirektor_at: string | null;
  pending_stage: string | null;
  pending_with: string | null;
}

const TYPE_CFG: Record<NoteType, { label: string; icon: typeof AlarmClock; color: string; bg: string }> = {
  obyektda:  { label: "Obyektda",       icon: MapPinned,  color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  kechikish: { label: "Kechikaman",     icon: AlarmClock, color: "#E0A400", bg: "rgba(224,164,0,0.15)" },
  kelmaslik: { label: "Kelmayman",      icon: UserX,      color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  ruxsat:    { label: "Ruxsat so'rash", icon: DoorOpen,   color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
};

const STATUS_CFG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  bolim_kutilmoqda: { label: "Bo'lim boshlig'ida", color: "#B4780C", bg: "rgba(255,189,33,0.15)" },
  kutilmoqda:       { label: "Kadrlar bo'limida",  color: "#FF8C42", bg: "rgba(255,140,66,0.13)" },
  kadr_tasdiqladi:  { label: "Zamdirektorda",      color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  sababli:          { label: "Tasdiqlandi",        color: "#00A578", bg: "rgba(0,165,120,0.12)" },
  sababsiz:         { label: "Rad etildi",         color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
};

type Filter = "barchasi" | "jarayonda" | "sababli" | "sababsiz";
const PENDING: ReviewStatus[] = ["bolim_kutilmoqda", "kutilmoqda", "kadr_tasdiqladi"];

function fmtDay(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

type StepState = "done" | "rejected" | "waiting" | "next";
interface Step { title: string; state: StepState; who?: string | null; at?: string | null }

/** Bosqichlar: bo'lim boshlig'i (bo'lsa) → kadr → zamdirektor — backend'dagi note_flow._progress bilan bir xil. */
function stepsOf(n: MyNote): Step[] {
  const hasBolim = !!n.bolim_by_nomi || n.review_status === "bolim_kutilmoqda";
  const raw: { stage: ReviewStatus; title: string; who: string | null; at: string | null }[] = [
    ...(hasBolim ? [{ stage: "bolim_kutilmoqda" as ReviewStatus, title: "Bo'lim boshlig'i", who: n.bolim_by_nomi, at: n.bolim_at }] : []),
    { stage: "kutilmoqda", title: "Kadrlar bo'limi", who: n.reviewed_by_nomi, at: n.reviewed_at },
    { stage: "kadr_tasdiqladi", title: "Zamdirektor", who: n.zamdirektor_by_nomi, at: n.zamdirektor_at },
  ];
  const rejected = n.review_status === "sababsiz";
  let stopped = false;
  return raw.map((s, i) => {
    if (stopped) return { title: s.title, state: "next" };
    if (s.who) {
      const lastDecider = i === raw.length - 1 || !raw[i + 1].who;
      if (rejected && lastDecider) { stopped = true; return { title: s.title, state: "rejected", who: s.who, at: s.at }; }
      return { title: s.title, state: "done", who: s.who, at: s.at };
    }
    if (n.review_status === s.stage) {
      stopped = true;
      return { title: s.title, state: "waiting", who: n.pending_with };
    }
    return { title: s.title, state: "next" };
  });
}

const STEP_ICON: Record<StepState, { icon: typeof Circle; color: string }> = {
  done:     { icon: CheckCircle2, color: "#00A578" },
  rejected: { icon: XCircle,      color: "#FF5C5C" },
  waiting:  { icon: Hourglass,    color: "#E0A400" },
  next:     { icon: Circle,       color: "#C9D2E0" },
};

function Steps({ n }: { n: MyNote }) {
  return (
    <div className="flex flex-col gap-1.5">
      {stepsOf(n).map((s, i) => {
        const { icon: Icon, color } = STEP_ICON[s.state];
        return (
          <div key={i} className="flex items-start gap-1.5 text-xs leading-snug">
            <Icon size={14} className="flex-shrink-0 mt-px" style={{ color }} />
            <span style={{ color: s.state === "next" ? "#A8B0BD" : "#3D4557" }}>
              <b style={{ color: s.state === "next" ? "#A8B0BD" : "#0A1629" }}>{s.title}</b>
              {s.state === "waiting" && <> — <span style={{ color: "#B4780C" }}>kutilmoqda{s.who ? ` (${s.who})` : ""}</span></>}
              {(s.state === "done" || s.state === "rejected") && (
                <> — {s.who}{s.state === "rejected" ? " rad etdi" : ""}{s.at ? <span style={{ color: "#91929E" }}> · {fmtDateTimeUz(s.at)}</span> : null}</>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NowWith({ n }: { n: MyNote }) {
  const st = STATUS_CFG[n.review_status];
  return (
    <div>
      <span className="inline-block px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color, borderRadius: 8 }}>
        {st.label}
      </span>
      {PENDING.includes(n.review_status) && n.pending_with && (
        <p className="text-xs mt-1.5 font-semibold" style={{ color: "#0A1629" }}>{n.pending_with}</p>
      )}
    </div>
  );
}

function TypeBadge({ t }: { t: NoteType }) {
  const c = TYPE_CFG[t];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ background: c.bg, color: c.color, borderRadius: 8 }}>
      <Icon size={13} /> {c.label}
    </span>
  );
}

function dates(n: MyNote) {
  const d = n.date_from === n.date_to ? fmtDay(n.date_from) : `${fmtDay(n.date_from)} — ${fmtDay(n.date_to)}`;
  const extra = n.note_type === "kechikish" && n.expected_time ? `≈ ${n.expected_time} da keladi`
    : n.object_time_from ? `${n.object_time_from}${n.object_time_to ? ` – ${n.object_time_to}` : ""}` : null;
  return { d, extra };
}

/** "Mening arizalarim" — xodim o'zi yozgan davomat arizalari va ular hozir kimda ekanligi. */
export default function MyNotesPage() {
  const [notes, setNotes] = useState<MyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("barchasi");

  useEffect(() => {
    apiFetch<MyNote[]>("/attendance/notes/my-list")
      .then(setNotes)
      .catch(e => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    barchasi: notes.length,
    jarayonda: notes.filter(n => PENDING.includes(n.review_status)).length,
    sababli: notes.filter(n => n.review_status === "sababli").length,
    sababsiz: notes.filter(n => n.review_status === "sababsiz").length,
  }), [notes]);

  const shown = notes.filter(n =>
    filter === "barchasi" ? true : filter === "jarayonda" ? PENDING.includes(n.review_status) : n.review_status === filter);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "barchasi", label: "Barchasi" },
    { key: "jarayonda", label: "Ko'rib chiqilmoqda" },
    { key: "sababli", label: "Tasdiqlangan" },
    { key: "sababsiz", label: "Rad etilgan" },
  ];

  return (
    <div>
      <Header title="Mening arizalarim" subtitle="Davomat bo'yicha yozgan izoh va arizalaringiz — hozir kimda ekani bilan" />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-4 py-2 text-sm font-bold transition-all"
            style={{
              background: filter === f.key ? "#0A1629" : "#FFFFFF",
              color: filter === f.key ? "#FFFFFF" : "#7D8592",
              borderRadius: 12, boxShadow: "0 4px 16px rgba(196,203,214,0.15)",
            }}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      <div style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
        ) : error ? (
          <p className="text-sm text-center py-12" style={{ color: "#FF5C5C" }}>{error}</p>
        ) : !shown.length ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <Inbox size={34} style={{ color: "#C9D2E0" }} />
            <p className="text-sm font-bold" style={{ color: "#7D8592" }}>Ariza yo'q</p>
            <p className="text-xs" style={{ color: "#A8B0BD" }}>Davomat sahifasidagi "Ariza yozish" tugmasi orqali yuborasiz</p>
          </div>
        ) : (
          <>
            {/* Kompyuter — jadval */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                    {["#", "Turi", "Sana", "Sabab", "Yuborilgan", "Hozir kimda", "Bosqichlar"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: "#91929E", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((n, i) => {
                    const { d, extra } = dates(n);
                    return (
                      <tr key={n.id} className="align-top" style={{ borderBottom: i < shown.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                        <td className="px-4 py-4 text-sm font-bold" style={{ color: "#91929E" }}>{i + 1}</td>
                        <td className="px-4 py-4"><TypeBadge t={n.note_type} /></td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{d}</p>
                          {extra && <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{extra}</p>}
                        </td>
                        <td className="px-4 py-4" style={{ maxWidth: 280 }}>
                          <p className="text-xs" style={{ color: "#3D4557", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text || "—"}</p>
                          {n.file_name && <NoteFileLink noteId={n.id} name={n.file_name} />}
                        </td>
                        <td className="px-4 py-4 text-xs whitespace-nowrap" style={{ color: "#7D8592" }}>{fmtDateTimeUz(n.created_at)}</td>
                        <td className="px-4 py-4" style={{ minWidth: 160 }}><NowWith n={n} /></td>
                        <td className="px-4 py-4" style={{ minWidth: 250 }}><Steps n={n} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Telefon — kartochkalar */}
            <div className="md:hidden flex flex-col">
              {shown.map((n, i) => {
                const { d, extra } = dates(n);
                return (
                  <div key={n.id} className="p-4 flex flex-col gap-3" style={{ borderBottom: i < shown.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <TypeBadge t={n.note_type} />
                        <p className="text-sm font-bold mt-2" style={{ color: "#0A1629" }}>{d}</p>
                        {extra && <p className="text-xs" style={{ color: "#91929E" }}>{extra}</p>}
                      </div>
                      <NowWith n={n} />
                    </div>
                    {(n.text || n.file_name) && (
                      <div>
                        {n.text && <p className="text-xs" style={{ color: "#3D4557", whiteSpace: "pre-wrap" }}>{n.text}</p>}
                        {n.file_name && <NoteFileLink noteId={n.id} name={n.file_name} />}
                      </div>
                    )}
                    <div className="p-3" style={{ background: "#F8FAFF", borderRadius: 12 }}><Steps n={n} /></div>
                    <p className="text-[11px] flex items-center gap-1" style={{ color: "#A8B0BD" }}><Send size={11} /> {fmtDateTimeUz(n.created_at)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
