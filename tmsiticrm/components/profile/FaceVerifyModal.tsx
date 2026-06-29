"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, CheckCircle2, Loader2, AlertTriangle, UserX } from "lucide-react";
import { apiFetch } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { faceapi: any; }
}

const FACE_API_CDN =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const MODELS_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

// Moslik chegarasi: 0 = bir xil odam, 1 = butunlay boshqa.
// 0.55 — yaxshi muvozanat (qattiqroq bo'lsa 0.45 ga tushiring)
const THRESHOLD = 0.55;

let _faceApiPromise: Promise<any> | null = null;

async function loadFaceApi(): Promise<any> {
  if (typeof window === "undefined") throw new Error("Browser kerak");
  if (window.faceapi) return window.faceapi;
  if (_faceApiPromise) return _faceApiPromise;

  _faceApiPromise = new Promise<any>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = FACE_API_CDN;
    s.async = true;
    s.onload = async () => {
      const fa = window.faceapi;
      if (!fa) { _faceApiPromise = null; return reject(new Error("face-api.js yuklanmadi")); }
      try {
        await Promise.all([
          fa.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
          fa.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          fa.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        resolve(fa);
      } catch (e) { _faceApiPromise = null; reject(e); }
    };
    s.onerror = () => { _faceApiPromise = null; reject(new Error("CDN xatosi — internet borligini tekshiring")); };
    document.head.appendChild(s);
  });
  return _faceApiPromise;
}

type Phase = "loading" | "scanning" | "match" | "nophoto" | "error";

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export default function FaceVerifyModal({ onSuccess, onClose }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchedRef = useRef(false);

  const [phase, setPhase]     = useState<Phase>("loading");
  const [status, setStatus]   = useState("Yuklanmoqda…");
  const [attempts, setAttempts] = useState(0);

  const stopAll = useCallback(() => {
    if (intervalId.current) { clearInterval(intervalId.current); intervalId.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    matchedRef.current = false;

    (async () => {
      try {
        // 1 ── Profildan rasm olish
        setStatus("Profil rasmi yuklanmoqda…");
        const { photo_base64 } = await apiFetch<{ photo_base64: string | null }>("/employees/me/photo");

        if (!photo_base64) {
          setPhase("nophoto");
          setStatus("Profilingizda rasm yo'q — avval rasm qo'shing.");
          return;
        }
        if (cancelled) return;

        // 2 ── face-api.js + modellari
        setStatus("AI modellari yuklanmoqda (birinchi marta ~15 sek)…");
        const fa = await loadFaceApi();
        if (cancelled) return;

        // 3 ── Saqlangan rasmdan descriptor
        setStatus("Profil rasmi tahlil qilinmoqda…");
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("Rasm yuklanmadi"));
          img.src = photo_base64;
        });
        const storedDet = await fa
          .detectSingleFace(img, new fa.SsdMobilenetv1Options({ minConfidenceScore: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!storedDet) {
          setPhase("error");
          setStatus("Profil rasmdagi yuz aniqlanmadi. Yangi, yaxshiroq rasm yuklang.");
          return;
        }
        if (cancelled) return;

        // 4 ── Kamera ochish
        setStatus("Kamera ochilmoqda…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setPhase("scanning");
        setStatus("Yuzingizni kameraga to'g'ri ko'rsating…");

        // 5 ── Har soniyada solishtirish
        intervalId.current = setInterval(async () => {
          if (!videoRef.current || matchedRef.current) return;
          try {
            const det = await fa
              .detectSingleFace(videoRef.current, new fa.SsdMobilenetv1Options({ minConfidenceScore: 0.5 }))
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!det) {
              setAttempts(n => n + 1);
              setStatus("Yuz topilmadi… Kameraga yaqinroq keling.");
              return;
            }

            const dist = fa.euclideanDistance(storedDet.descriptor, det.descriptor);

            if (dist <= THRESHOLD) {
              matchedRef.current = true;
              clearInterval(intervalId.current!);
              setPhase("match");
              setStatus("Tasdiqlandi! Davom etilmoqda…");
              setTimeout(() => { stopAll(); onSuccess(); }, 1200);
            } else {
              setAttempts(n => n + 1);
              setStatus(`Mos kelmadi (${dist.toFixed(2)}). To'g'riroq qarang…`);
            }
          } catch { /* silent retry */ }
        }, 1000);

      } catch (e: any) {
        if (cancelled) return;
        setPhase("error");
        setStatus(e?.message || "Xatolik yuz berdi");
      }
    })();

    return () => { cancelled = true; stopAll(); };
  }, [stopAll, onSuccess]);

  function handleClose() { stopAll(); onClose(); }

  const COLOR: Record<Phase, string> = {
    loading: "#3F8CFF", scanning: "#3F8CFF",
    match: "#00A578", nophoto: "#E0A400", error: "#FF5C5C",
  };
  const c = COLOR[phase];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.65)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-[440px]"
        style={{ background: "#fff", borderRadius: 24, boxShadow: "0 30px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0F3F8" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: `${c}18`, borderRadius: 12 }}>
              <Camera size={20} style={{ color: c }} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Yuzni tasdiqlash</h3>
              <p className="text-xs" style={{ color: "#91929E" }}>AI orqali kimligingizni aniqlash</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center"
            style={{ background: "#F4F9FD", borderRadius: 10 }}
          >
            <X size={16} style={{ color: "#91929E" }} />
          </button>
        </div>

        {/* Camera / icon area */}
        <div className="px-6 pt-5 pb-0">
          <div
            className="relative mx-auto flex items-center justify-center"
            style={{ width: "100%", aspectRatio: "4/3", background: "#0D1B2E", borderRadius: 16, overflow: "hidden" }}
          >
            {/* Live video */}
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ display: phase === "scanning" || phase === "match" ? "block" : "none" }}
            />

            {/* Placeholder icon for non-video phases */}
            {phase !== "scanning" && phase !== "match" && (
              <div className="flex flex-col items-center gap-3">
                {(phase === "loading") && <Loader2 size={48} className="animate-spin" style={{ color: "#3F8CFF" }} />}
                {phase === "nophoto" && <UserX size={56} style={{ color: "#E0A400" }} />}
                {phase === "error"   && <AlertTriangle size={52} style={{ color: "#FF5C5C" }} />}
              </div>
            )}

            {/* Face guide circle while scanning */}
            {phase === "scanning" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="rounded-full animate-pulse"
                  style={{ width: 180, height: 180, border: "2.5px solid rgba(255,255,255,0.55)" }}
                />
              </div>
            )}

            {/* Match overlay */}
            {phase === "match" && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,165,120,0.35)" }}
              >
                <CheckCircle2 size={80} style={{ color: "#fff" }} />
              </div>
            )}
          </div>
        </div>

        {/* Status card */}
        <div className="px-6 pt-4 pb-2">
          <div className="px-4 py-3 text-center" style={{ background: `${c}12`, borderRadius: 14 }}>
            <p className="text-sm font-bold" style={{ color: c }}>{status}</p>
            {phase === "scanning" && attempts > 3 && (
              <p className="text-xs mt-1" style={{ color: "#91929E" }}>
                Yaxshi yoritilgan joyda, kameraga to'g'ri qarang
              </p>
            )}
            {phase === "loading" && (
              <p className="text-xs mt-1" style={{ color: "#91929E" }}>
                Modellar brauzer keshiga saqlanadi — keyingi safar tezroq bo'ladi
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 pt-2">
          {(phase === "nophoto" || phase === "error") && (
            <button
              onClick={handleClose}
              className="w-full py-3 font-bold text-sm"
              style={{ background: "#F4F9FD", borderRadius: 14, color: "#7D8592" }}
            >
              Yopish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
