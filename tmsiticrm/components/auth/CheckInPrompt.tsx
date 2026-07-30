"use client";

import { useState } from "react";
import { ScanFace, X, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import FaceVerifyModal from "@/components/profile/FaceVerifyModal";

interface AttendanceOut {
  id: number;
  check_in: string;
  check_in_local: string | null;
}

export default function CheckInPrompt({ onClose }: { onClose: () => void }) {
  const [showFace, setShowFace] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [done,     setDone]     = useState<AttendanceOut | null>(null);

  function handleCheckIn() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi.");
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const rec = await apiFetch<AttendanceOut>("/attendance/check-in", {
            method: "POST",
            body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          });
          setDone(rec);
          setTimeout(onClose, 1800);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Belgilashda xato yuz berdi.");
        } finally {
          setChecking(false);
        }
      },
      (err) => {
        setChecking(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering."
            : "Joylashuvni aniqlab bo'lmadi. GPS yoqilganini tekshiring."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[420px] p-7 relative text-center"
        style={{ background: "#FFFFFF", borderRadius: 28, boxShadow: "0px 30px 80px rgba(0,0,0,0.25)" }}>

        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
          style={{ background: "#F4F9FD", borderRadius: 10 }}>
          <X size={15} style={{ color: "#91929E" }} />
        </button>

        {done ? (
          <>
            <div className="w-16 h-16 mx-auto flex items-center justify-center mb-4"
              style={{ background: "rgba(0,196,140,0.1)", borderRadius: 20 }}>
              <CheckCircle2 size={30} style={{ color: "#00C48C" }} />
            </div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Belgilandi!</h2>
            <p className="text-sm mt-2" style={{ color: "#7D8592" }}>
              Ishga kelganingiz soat {done.check_in_local ?? ""} da qayd etildi.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto flex items-center justify-center mb-4"
              style={{ background: "rgba(63,140,255,0.1)", borderRadius: 20 }}>
              <ScanFace size={28} style={{ color: "#3F8CFF" }} />
            </div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
              Bugun ishga kelganingizni belgilang
            </h2>
            <p className="text-sm mt-2" style={{ color: "#7D8592" }}>
              Kamera orqali shaxsingiz tasdiqlanadi, so'ng joylashuvingiz aniqlanadi.
            </p>

            {error && (
              <div className="mt-3 px-4 py-2.5 text-xs font-bold text-left"
                style={{ background: "rgba(255,92,92,0.08)", color: "#FF5C5C", borderRadius: 12 }}>
                {error}
              </div>
            )}

            <button onClick={() => setShowFace(true)} disabled={checking}
              className="w-full mt-6 py-3.5 flex items-center justify-center gap-2 font-bold text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
              {checking
                ? <><Loader2 size={16} className="animate-spin" /> Joylashuv aniqlanmoqda...</>
                : <><ScanFace size={16} /> Ishga keldim</>}
            </button>

            <button onClick={onClose} className="w-full mt-2.5 py-2.5 font-bold text-xs" style={{ color: "#91929E" }}>
              Keyinroq
            </button>
          </>
        )}
      </div>

      {showFace && (
        <FaceVerifyModal
          onSuccess={() => { setShowFace(false); handleCheckIn(); }}
          onClose={() => setShowFace(false)}
        />
      )}
    </div>
  );
}
