"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquareWarning, AlarmClock, UserX, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AttendanceNote {
  id: number;
  employee_id: number;
  employee_nomi: string | null;
  position: string | null;
  department_nomi: string | null;
  note_type: "kechikish" | "kelmaslik";
  text: string | null;
  note_date: string;
  created_at: string;
}

function fmtDt(d: string) {
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceNotesInbox() {
  const [notes,   setNotes]   = useState<AttendanceNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch<AttendanceNote[]>("/attendance/notes")
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
          {notes.map(n => (
            <div key={n.id} className="flex items-start gap-3 p-3.5"
              style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ background: n.note_type === "kelmaslik" ? "rgba(255,92,92,0.12)" : "rgba(224,164,0,0.15)" }}>
                {n.note_type === "kelmaslik"
                  ? <UserX size={16} style={{ color: "#FF5C5C" }} />
                  : <AlarmClock size={16} style={{ color: "#E0A400" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{n.employee_nomi || "—"}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: n.note_type === "kelmaslik" ? "rgba(255,92,92,0.1)" : "rgba(224,164,0,0.15)",
                      color: n.note_type === "kelmaslik" ? "#FF5C5C" : "#B8860B",
                    }}>
                    {n.note_type === "kelmaslik" ? "Kelmaydi" : "Kechikadi"}
                  </span>
                </div>
                {(n.position || n.department_nomi) && (
                  <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                    {n.position}{n.position && n.department_nomi ? " · " : ""}{n.department_nomi}
                  </p>
                )}
                {n.text && <p className="text-sm mt-1.5" style={{ color: "#3D4557" }}>{n.text}</p>}
                <p className="text-xs mt-1.5" style={{ color: "#91929E" }}>{n.note_date} · {fmtDt(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
