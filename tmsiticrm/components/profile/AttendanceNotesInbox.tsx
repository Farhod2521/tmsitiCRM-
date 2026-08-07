"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquareWarning, AlarmClock, UserX, MapPinned, Loader2, Check, X as XIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

type ReviewStatus = "kutilmoqda" | "sababli" | "sababsiz";
type NoteType = "kechikish" | "kelmaslik" | "obyektda";

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
  object_time_from: string | null;
  object_time_to: string | null;
  created_at: string;
  review_status: ReviewStatus;
  reviewed_by_nomi: string | null;
  reviewed_at: string | null;
}

const REVIEW_CFG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  kutilmoqda: { label: "Kutilmoqda", color: "#91929E", bg: "rgba(145,146,158,0.12)" },
  sababli:    { label: "Sababli",    color: "#00A578", bg: "rgba(0,165,120,0.12)" },
  sababsiz:   { label: "Sababsiz",   color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
};

const NOTE_TYPE_CFG: Record<NoteType, { label: string; icon: typeof AlarmClock; color: string; bg: string }> = {
  obyektda:  { label: "Obyektda",  icon: MapPinned,  color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  kechikish: { label: "Kechikadi", icon: AlarmClock, color: "#E0A400", bg: "rgba(224,164,0,0.15)"  },
  kelmaslik: { label: "Kelmaydi",  icon: UserX,      color: "#FF5C5C", bg: "rgba(255,92,92,0.12)"  },
};

function fmtDt(d: string) {
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceNotesInbox() {
  const [notes,   setNotes]   = useState<AttendanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const isKadr = getUser()?.role === "kadr";

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
      await apiFetch(`/attendance/notes/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch {
      // sokin
    } finally {
      setReviewingId(null);
    }
  }

  if (!loading && notes.length === 0) return null;

  return (
    <div className="p-6 mt-5" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(224,164,0,0.12)", borderRadius: 12 }}>
          <MessageSquareWarning size={20} style={{ color: "#E0A400" }} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Kechikish / kelmaslik xabarlari</h3>
          <p className="text-xs" style={{ color: "#91929E" }}>Xodimlardan kelgan so'nggi xabarlar</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notes.map(n => {
            const rc = REVIEW_CFG[n.review_status];
            const tc = NOTE_TYPE_CFG[n.note_type];
            const TypeIcon = tc.icon;
            return (
              <div key={n.id} className="flex items-start gap-3 p-3.5"
                style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{ background: tc.bg }}>
                  <TypeIcon size={16} style={{ color: tc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{n.employee_nomi || "—"}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: tc.bg, color: tc.color }}>
                      {tc.label}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: rc.bg, color: rc.color }}>
                      {rc.label}
                    </span>
                  </div>
                  {(n.position || n.department_nomi) && (
                    <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                      {n.position}{n.position && n.department_nomi ? " · " : ""}{n.department_nomi}
                    </p>
                  )}
                  {n.text && <p className="text-sm mt-1.5" style={{ color: "#3D4557" }}>{n.text}</p>}
                  <p className="text-xs mt-1.5" style={{ color: "#91929E" }}>
                    {n.date_from === n.date_to ? n.date_from : `${n.date_from} — ${n.date_to}`}
                    {n.note_type === "kechikish" && n.expected_time && <> · ~{n.expected_time} da keladi</>}
                    {n.note_type === "obyektda" && (n.object_time_from || n.object_time_to) && (
                      <> · {n.object_time_from || "—"}—{n.object_time_to || "—"}</>
                    )}
                    {" "}· {fmtDt(n.created_at)}
                    {n.review_status !== "kutilmoqda" && n.reviewed_by_nomi && (
                      <> · {n.reviewed_by_nomi} tomonidan{n.reviewed_at ? `, ${fmtDt(n.reviewed_at)}` : ""}</>
                    )}
                  </p>

                  {isKadr && n.review_status === "kutilmoqda" && (
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => handleReview(n.id, "sababli")} disabled={reviewingId === n.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: "#00C48C", borderRadius: 8 }}>
                        {reviewingId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Tasdiqlash
                      </button>
                      <button onClick={() => handleReview(n.id, "sababsiz")} disabled={reviewingId === n.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                        style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 8 }}>
                        <XIcon size={12} />
                        Rad etish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
