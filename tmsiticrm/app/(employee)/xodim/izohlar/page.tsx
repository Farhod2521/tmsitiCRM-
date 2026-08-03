"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { MessageSquareWarning, AlarmClock, UserX, Loader2, Check, X as XIcon } from "lucide-react";

type ReviewStatus = "kutilmoqda" | "sababli" | "sababsiz";
type NoteType = "kechikish" | "kelmaslik";

interface AttendanceNote {
  id: number;
  employee_id: number;
  employee_nomi: string | null;
  position: string | null;
  department_nomi: string | null;
  note_type: NoteType;
  text: string | null;
  note_date: string;
  created_at: string;
  review_status: ReviewStatus;
  reviewed_by_nomi: string | null;
  reviewed_at: string | null;
}

type FilterKey = "barchasi" | "kutilmoqda" | "sababli" | "sababsiz";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "barchasi",  label: "Barchasi" },
  { key: "kutilmoqda", label: "Kutilmoqda" },
  { key: "sababli",   label: "Sababli" },
  { key: "sababsiz",  label: "Sababsiz" },
];

const REVIEW_CFG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  kutilmoqda: { label: "Kutilmoqda", color: "#91929E", bg: "rgba(145,146,158,0.12)" },
  sababli:    { label: "Sababli",    color: "#00A578", bg: "rgba(0,165,120,0.12)" },
  sababsiz:   { label: "Sababsiz",   color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDt(d: string) {
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function XodimIzohlarPage() {
  const [notes,   setNotes]   = useState<AttendanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterKey>("barchasi");
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
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

  const counts = {
    barchasi:   notes.length,
    kutilmoqda: notes.filter(n => n.review_status === "kutilmoqda").length,
    sababli:    notes.filter(n => n.review_status === "sababli").length,
    sababsiz:   notes.filter(n => n.review_status === "sababsiz").length,
  };
  const visible = notes.filter(n => filter === "barchasi" || n.review_status === filter);

  return (
    <div>
      <Header title="Izohlar" subtitle="Xodimlarning kechikish/kelmaslik haqidagi izohlarini ko'rib chiqing" />

      <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-4 py-2 text-sm font-bold transition-all"
                style={{
                  background: active ? "#0A1629" : "#F4F9FD",
                  color: active ? "#FFFFFF" : "#7D8592",
                  borderRadius: 12,
                }}>
                {f.label}
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-md"
                  style={{ background: active ? "rgba(255,255,255,0.2)" : "rgba(145,146,158,0.12)", color: active ? "#FFFFFF" : "#91929E" }}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14">
            <MessageSquareWarning size={32} className="mx-auto mb-3" style={{ color: "#D0D9E8" }} />
            <p className="text-sm font-bold" style={{ color: "#91929E" }}>Izoh topilmadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                  {["#", "Ism familiyasi", "Bo'lim", "Turi", "Izohi", "Sana", "Holat", "Amallar"].map(h => (
                    <th key={h} className="text-left pb-4 text-xs font-bold uppercase"
                      style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 16, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((n, i) => (
                  <tr key={n.id} className="hover:bg-[#FAFCFF] transition-colors" style={{ borderBottom: "1px solid #F4F9FD" }}>
                    <td className="py-4 text-sm font-bold" style={{ color: "#91929E", paddingRight: 16 }}>{i + 1}</td>

                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full"
                          style={{ background: n.note_type === "kelmaslik" ? "rgba(255,92,92,0.12)" : "rgba(224,164,0,0.15)" }}>
                          {n.note_type === "kelmaslik"
                            ? <UserX size={15} style={{ color: "#FF5C5C" }} />
                            : <AlarmClock size={15} style={{ color: "#E0A400" }} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>{n.employee_nomi || "—"}</p>
                          <p className="text-xs truncate" style={{ color: "#91929E" }}>{n.position || "—"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 16, whiteSpace: "nowrap" }}>
                      {n.department_nomi || "—"}
                    </td>

                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
                        style={{
                          background: n.note_type === "kelmaslik" ? "rgba(255,92,92,0.1)" : "rgba(224,164,0,0.15)",
                          color: n.note_type === "kelmaslik" ? "#FF5C5C" : "#B8860B",
                        }}>
                        {n.note_type === "kelmaslik" ? "Kelmaydi" : "Kechikadi"}
                      </span>
                    </td>

                    <td className="py-4 text-sm" style={{ color: "#3D4557", paddingRight: 16, maxWidth: 260 }}>
                      <span className="line-clamp-2">{n.text || "—"}</span>
                    </td>

                    <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 16, whiteSpace: "nowrap" }}>
                      {fmt(n.note_date)}
                    </td>

                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
                        style={{ background: REVIEW_CFG[n.review_status].bg, color: REVIEW_CFG[n.review_status].color }}>
                        {REVIEW_CFG[n.review_status].label}
                      </span>
                      {n.review_status !== "kutilmoqda" && n.reviewed_by_nomi && (
                        <p className="text-[11px] mt-1" style={{ color: "#91929E" }}>
                          {n.reviewed_by_nomi}{n.reviewed_at ? `, ${fmtDt(n.reviewed_at)}` : ""}
                        </p>
                      )}
                    </td>

                    <td className="py-4">
                      {n.review_status === "kutilmoqda" ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleReview(n.id, "sababli")} disabled={reviewingId === n.id}
                            title="Tasdiqlash"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 hover:opacity-90"
                            style={{ background: "#00C48C", borderRadius: 8 }}>
                            {reviewingId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Tasdiqlash
                          </button>
                          <button onClick={() => handleReview(n.id, "sababsiz")} disabled={reviewingId === n.id}
                            title="Rad etish"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold disabled:opacity-50 hover:opacity-90"
                            style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 8 }}>
                            <XIcon size={12} />
                            Rad etish
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "#D0D9E8" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <p className="text-sm mt-4" style={{ color: "#91929E" }}>
            {visible.length} ta izoh ko'rsatilmoqda (jami {notes.length} ta)
          </p>
        )}
      </div>
    </div>
  );
}
