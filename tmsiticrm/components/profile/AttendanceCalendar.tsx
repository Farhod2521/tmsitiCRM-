"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, CheckCircle2, Clock, Calendar as CalIcon, Loader2, Footprints, Map as MapIcon, X, Crosshair, ScanFace } from "lucide-react";
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

  return (
    <div className="p-6"
      style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 flex items-center justify-center"
            style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
            <CalIcon size={20} style={{ color: "#3F8CFF" }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Davomat kalendari</h3>
            <p className="text-xs" style={{ color: "#91929E" }}>
              {MONTHS_UZ[month - 1]} {year} · {presentCount} kun kelgan · ish {office?.work_start ?? "09:00"} da
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center font-bold hover:opacity-80"
            style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>‹</button>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center font-bold hover:opacity-80"
            style={{ background: "#F4F9FD", borderRadius: 10, color: "#7D8592" }}>›</button>
        </div>
      </div>

      {/* "Keldim" tugmasi */}
      {isCurrentMonth && (
        <div className="mb-5">
          {todayRec ? (
            <div className="flex items-center gap-3 px-4 py-3.5"
              style={{ background: "rgba(0,196,140,0.08)", borderRadius: 14 }}>
              <CheckCircle2 size={22} style={{ color: "#00C48C" }} />
              <div className="flex-1">
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
                  {todayRec.distance_m != null && (
                    <span>· binodan {Math.round(todayRec.distance_m)} m</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {/* Ishga keldim: avval yuz tekshiruvi, keyin GPS */}
              <button
                onClick={() => setShowFace(true)}
                disabled={checking}
                className="flex-1 py-3.5 flex items-center justify-center gap-2 font-bold text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}
              >
                {checking
                  ? <><Loader2 size={17} className="animate-spin" /> Joylashuv aniqlanmoqda...</>
                  : <><ScanFace size={17} /> Ishga keldim</>}
              </button>
              <button onClick={() => setShowMap(true)}
                className="px-5 py-3.5 flex items-center justify-center gap-2 font-bold text-sm hover:opacity-90 transition-opacity"
                style={{ background: "rgba(63,140,255,0.1)", borderRadius: 14, color: "#3F8CFF" }}>
                <MapIcon size={17} /> Xarita
              </button>
            </div>
          )}

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

              const lc = rec ? lateColor(rec.late_minutes) : "#00A578";
              return (
                <div key={d}
                  title={rec ? `Soat ${rec.check_in_local ?? ""} — ${lateText(rec.late_minutes)}` : undefined}
                  className="flex flex-col items-center justify-center relative"
                  style={{
                    minHeight: 66,
                    background: present ? "rgba(0,196,140,0.10)" : "#F4F9FD",
                    borderRadius: 12,
                    border: isToday ? "2px solid #3F8CFF" : "2px solid transparent",
                  }}>
                  <span className="text-base font-bold leading-none"
                    style={{ color: present ? "#0A1629" : isWeekend ? "#FF8C8C" : "#0A1629" }}>
                    {d}
                  </span>
                  {present && rec && (
                    <>
                      <span className="text-[12px] font-bold leading-none mt-1.5" style={{ color: "#0A1629" }}>
                        {rec.check_in_local ?? fmtTime(rec.check_in)}
                      </span>
                      <span className="text-[10px] font-bold leading-none mt-1" style={{ color: lc }}>
                        {rec.late_minutes > 0 ? `+${rec.late_minutes} daq` : "✓"}
                      </span>
                    </>
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
              <span className="w-3 h-3" style={{ border: "2px solid #3F8CFF", borderRadius: 4 }} />
              <span className="text-xs" style={{ color: "#91929E" }}>Bugun</span>
            </div>
          </div>
        </>
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
        <div className="grid grid-cols-3 gap-2.5 px-6 pt-4">
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
