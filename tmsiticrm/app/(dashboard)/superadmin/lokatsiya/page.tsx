"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { MapPin, Building2, FlaskConical, Loader2, CheckCircle2, Crosshair } from "lucide-react";

interface ApiLocation {
  location_type: "vazirlik" | "labaratoriya";
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
}

const CARDS = [
  { type: "vazirlik" as const,     label: "Vazirlik",     icon: Building2,    color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  { type: "labaratoriya" as const, label: "Labaratoriya", icon: FlaskConical, color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
];

interface FormState { latitude: string; longitude: string; radius_meters: string; }

function LocationCard({
  cfg, data, onSaved,
}: {
  cfg: typeof CARDS[number];
  data: ApiLocation | undefined;
  onSaved: (loc: ApiLocation) => void;
}) {
  const [form, setForm] = useState<FormState>({
    latitude: data?.latitude != null ? String(data.latitude) : "",
    longitude: data?.longitude != null ? String(data.longitude) : "",
    radius_meters: String(data?.radius_meters ?? 100),
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      latitude: data?.latitude != null ? String(data.latitude) : "",
      longitude: data?.longitude != null ? String(data.longitude) : "",
      radius_meters: String(data?.radius_meters ?? 100),
    });
  }, [data]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Brauzeringiz joylashuvni aniqlashni qo'llab-quvvatlamaydi");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }));
        setLocating(false);
      },
      () => { setError("Joylashuvni aniqlab bo'lmadi"); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave() {
    setError(null);
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius_meters, 10);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Kenglik va uzunlikni to'g'ri kiriting");
      return;
    }
    if (Number.isNaN(radius) || radius <= 0) {
      setError("Radius musbat son bo'lishi kerak");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<ApiLocation>(`/locations/${cfg.type}`, {
        method: "PUT",
        body: JSON.stringify({ latitude: lat, longitude: lng, radius_meters: radius }),
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, borderRadius: 14 }}>
          <cfg.icon size={22} style={{ color: cfg.color }} />
        </div>
        <div>
          <p className="font-bold text-base" style={{ color: "#0A1629" }}>{cfg.label}</p>
          <p className="text-xs" style={{ color: "#91929E" }}>Ish joyi lokatsiyasi va radiusi</p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 mb-4 text-xs font-bold" style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Kenglik (latitude)</label>
          <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
            placeholder="41.311081" className="w-full px-4 py-3 text-sm font-bold outline-none"
            style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
        </div>
        <div>
          <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Uzunlik (longitude)</label>
          <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
            placeholder="69.240562" className="w-full px-4 py-3 text-sm font-bold outline-none"
            style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
        </div>
      </div>

      <div className="mb-5">
        <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Radius (metr)</label>
        <input type="number" min="1" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
          className="w-full px-4 py-3 text-sm font-bold outline-none"
          style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={useMyLocation} disabled={locating}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          Hozirgi joylashuv
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: saved ? "#00C48C" : cfg.color, borderRadius: 12 }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
          {saved ? "Saqlandi" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

export default function LokatsiyaPage() {
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<ApiLocation[]>("/locations/")
      .then(setLocations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(updated: ApiLocation) {
    setLocations(prev => {
      const exists = prev.some(l => l.location_type === updated.location_type);
      return exists ? prev.map(l => l.location_type === updated.location_type ? updated : l) : [...prev, updated];
    });
  }

  return (
    <div>
      <Header title="Lokatsiya" subtitle="Ish joylari uchun geolokatsiya markazi va ruxsat etilgan radiusni belgilang" />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {CARDS.map(cfg => (
            <LocationCard key={cfg.type} cfg={cfg} data={locations.find(l => l.location_type === cfg.type)} onSaved={handleSaved} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 mt-5 p-5" style={{ background: "rgba(63,140,255,0.06)", borderRadius: 20 }}>
        <MapPin size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#3F8CFF" }} />
        <p className="text-xs leading-relaxed" style={{ color: "#7D8592" }}>
          Har bir xodimning ish joyi (Vazirlik yoki Labaratoriya) <strong style={{ color: "#0A1629" }}>Xodimlar</strong> sahifasidan
          belgilanadi. Bu yerda kiritilgan koordinata va radius kelajakda xodimning joriy joylashuvini
          tekshirish uchun ishlatiladi.
        </p>
      </div>
    </div>
  );
}
