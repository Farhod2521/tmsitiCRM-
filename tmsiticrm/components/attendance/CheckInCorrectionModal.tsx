"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import { X, Loader2, Clock3, DoorOpen, History, Save } from "lucide-react";

interface CorrectionLog {
  old_check_in: string | null;
  new_check_in: string;
  source: "turniket" | "qolda";
  reason: string | null;
  corrected_by: string | null;
  created_at: string;
}
interface CorrectionInfo {
  employee_id: number;
  full_name: string;
  date: string;
  current: string | null;
  turniket: string | null;
  history: CorrectionLog[];
}

function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Superadmin: xodimning kelish vaqtini tuzatish (masalan, turniket bo'yicha —
 *  ishga kelgan, lekin "Ishga keldim"ni bosishni unutgan). Har bir o'zgarish jurnalga yoziladi. */
export default function CheckInCorrectionModal({ employeeId, date, onClose, onSaved }: {
  employeeId: number;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [info, setInfo] = useState<CorrectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState("");
  const [source, setSource] = useState<"turniket" | "qolda">("qolda");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CorrectionInfo>(`/attendance/daily/correction?employee_id=${employeeId}&date=${date}`)
      .then(d => {
        setInfo(d);
        // Turniket vaqti bo'lsa — shuni taklif qilamiz
        if (d.turniket) { setTime(d.turniket); setSource("turniket"); setReason("Turniket ma'lumoti bo'yicha"); }
        else setTime(d.current ?? "");
      })
      .catch(e => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [employeeId, date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function useTurniket() {
    if (!info?.turniket) return;
    setTime(info.turniket); setSource("turniket");
    if (!reason.trim()) setReason("Turniket ma'lumoti bo'yicha");
  }

  async function save() {
    if (!/^\d{2}:\d{2}$/.test(time)) { setError("Vaqtni kiriting (SS:DD)"); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch<CorrectionInfo>("/attendance/daily/correction", {
        method: "PUT",
        body: JSON.stringify({ employee_id: employeeId, date, time, source, reason: reason.trim() || null }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  const changed = info != null && time !== (info.current ?? "");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(109,93,211,0.12)", borderRadius: 12 }}>
              <Clock3 size={19} style={{ color: "#6D5DD3" }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate" style={{ color: "#0A1629" }}>Kelish vaqtini tuzatish</p>
              <p className="text-xs truncate" style={{ color: "#91929E" }}>{info?.full_name ?? "…"} · {fmtDay(date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
        ) : info && (
          <div className="overflow-y-auto px-6 py-4 flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3" style={{ background: "#FAFCFF", border: "1px solid #F0F3F8", borderRadius: 12 }}>
                <p className="text-[11px] font-bold" style={{ color: "#91929E" }}>Tizimda</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: info.current ? "#0A1629" : "#C4CBD6" }}>{info.current ?? "belgilanmagan"}</p>
              </div>
              <div className="p-3" style={{ background: "#FAFCFF", border: "1px solid #F0F3F8", borderRadius: 12 }}>
                <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#91929E" }}><DoorOpen size={12} /> Turniket</p>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-lg font-bold" style={{ color: info.turniket ? "#0A1629" : "#C4CBD6" }}>{info.turniket ?? "yo'q"}</p>
                  {info.turniket && info.turniket !== time && (
                    <button onClick={useTurniket} className="text-[11px] font-bold px-2 py-1" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 6 }}>
                      Qo&apos;llash
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label className="block text-xs font-bold mt-4 mb-1.5" style={{ color: "#7D8592" }}>Yangi kelish vaqti</label>
            <input type="time" value={time} onChange={e => { setTime(e.target.value); setSource(e.target.value === info.turniket ? "turniket" : "qolda"); }}
              className="w-full px-4 py-3 text-base font-bold outline-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0", color: "#0A1629" }} />

            <label className="block text-xs font-bold mt-3 mb-1.5" style={{ color: "#7D8592" }}>Sabab</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Masalan: turniket bo'yicha keldi, &quot;Ishga keldim&quot;ni bosishni unutgan"
              className="w-full px-4 py-3 text-sm outline-none resize-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0", color: "#0A1629" }} />

            {error && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{error}</p>}

            {info.history.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid #F4F9FD" }}>
                <p className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: "#7D8592" }}><History size={13} /> Tuzatishlar tarixi</p>
                <ul className="flex flex-col gap-1.5">
                  {info.history.map((h, i) => (
                    <li key={i} className="text-xs p-2.5" style={{ background: "#FAFCFF", borderRadius: 10, color: "#3D4557" }}>
                      <b>{h.old_check_in ?? "—"}</b> → <b style={{ color: "#6D5DD3" }}>{h.new_check_in}</b>
                      <span style={{ color: "#91929E" }}> · {h.source === "turniket" ? "turniket" : "qo'lda"} · {h.corrected_by ?? "—"} · {fmtDateTimeUz(h.created_at)}</span>
                      {h.reason && <p className="mt-0.5" style={{ color: "#7D8592" }}>{h.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>Bekor qilish</button>
          <button onClick={save} disabled={saving || !changed}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#6D5DD3", borderRadius: 12 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Saqlash
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
