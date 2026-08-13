"use client";

import { useState, useEffect, useRef } from "react";
import Badge from "@/components/ui/Badge";
import { apiFetch } from "@/lib/api";
import {
  Loader2, ArrowLeft, Palmtree, Baby, UserCheck,
  Car, Plane, GraduationCap, Stethoscope, Laptop,
} from "lucide-react";

export const STATUS_LABEL: Record<string, string> = {
  faol: "Faol",
  otpuska: "Mehnat ta'tilida",
  dekret: "Dekretda",
  shafyor_farrosh: "Texnik xodimlar",
  xizmat_safarida: "Xizmat safarida",
  oquv_tatilida: "O'quv ta'tilida",
  mehnatga_layoqatsiz: "Mehnatga layoqatsiz (bolnichniy)",
  online: "Online ishlaydi",
};
// faol — yashil; qolganlari — "faol emas"ni bildirib kulrang bo'ladi
export const STATUS_BADGE: Record<string, "success" | "gray"> = {
  faol: "success", otpuska: "gray", dekret: "gray", shafyor_farrosh: "gray",
  xizmat_safarida: "gray", oquv_tatilida: "gray", mehnatga_layoqatsiz: "gray", online: "gray",
};

// needsRange: true bo'lgan statuslar tanlanganda "sanadan / sanagacha" so'raladi —
// shu sana o'tgach xodim backendda avtomatik "faol"ga qaytariladi.
const STATUS_MENU: { status: string; label: string; icon: typeof UserCheck; color: string; bg: string; needsRange: boolean }[] = [
  { status: "faol",                 label: "Faol holatga qaytarish",           icon: UserCheck,     color: "#00C48C", bg: "rgba(0,196,140,0.1)",  needsRange: false },
  { status: "otpuska",              label: "Mehnat ta'tiliga chiqarish",       icon: Palmtree,      color: "#7D8592", bg: "rgba(125,133,146,0.1)", needsRange: true  },
  { status: "dekret",               label: "Dekretga chiqarish",               icon: Baby,          color: "#7D8592", bg: "rgba(125,133,146,0.1)", needsRange: false },
  { status: "xizmat_safarida",      label: "Xizmat safariga yuborish",         icon: Plane,         color: "#3F8CFF", bg: "rgba(63,140,255,0.1)",  needsRange: true  },
  { status: "oquv_tatilida",        label: "O'quv ta'tiliga chiqarish",        icon: GraduationCap, color: "#6D5DD3", bg: "rgba(109,93,211,0.1)",  needsRange: true  },
  { status: "online",               label: "Online ishlashga o'tkazish",       icon: Laptop,        color: "#15C0E6", bg: "rgba(21,192,230,0.1)",  needsRange: true  },
  { status: "mehnatga_layoqatsiz",  label: "Mehnatga layoqatsiz (bolnichniy)", icon: Stethoscope,   color: "#FF5C5C", bg: "rgba(255,92,92,0.1)",   needsRange: true  },
  { status: "shafyor_farrosh",      label: "Texnik xodimlarga o'tkazish",      icon: Car,           color: "#7D8592", bg: "rgba(125,133,146,0.1)", needsRange: false },
];

export default function StatusMenu({ empId, status, onChanged }: {
  empId: number;
  status: string;
  onChanged: (id: number, status: string, dateFrom: string | null, dateTo: string | null) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [pending, setPending] = useState<null | { status: string; label: string }>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  function closeAll() {
    setOpen(false);
    setPending(null);
    setDateFrom("");
    setDateTo("");
  }

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) closeAll(); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function assign(newStatus: string, df: string | null, dt: string | null) {
    setSaving(true);
    try {
      await apiFetch(`/employees/${empId}/set-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, date_from: df, date_to: dt }),
      });
      onChanged(empId, newStatus, df, dt);
      closeAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  function pick(s: typeof STATUS_MENU[number]) {
    if (s.needsRange) setPending({ status: s.status, label: s.label });
    else assign(s.status, null, null);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} className="hover:opacity-80 transition-opacity">
        <Badge label={STATUS_LABEL[status] || status} variant={STATUS_BADGE[status] || "gray"} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-64 py-1.5"
          style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 12px 32px rgba(10,22,41,0.16)", border: "1px solid #F4F9FD" }}>
          {!pending ? (
            STATUS_MENU.filter(s => s.status !== status).map(s => {
              const Icon = s.icon;
              return (
                <button key={s.status} onClick={() => pick(s)} disabled={saving}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8FAFF] transition-colors disabled:opacity-50">
                  <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ background: s.bg, borderRadius: 8 }}>
                    {saving ? <Loader2 size={12} className="animate-spin" style={{ color: s.color }} /> : <Icon size={13} style={{ color: s.color }} />}
                  </div>
                  <span className="text-xs font-semibold text-left" style={{ color: "#0A1629" }}>{s.label}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3">
              <button onClick={() => setPending(null)} className="flex items-center gap-1 mb-2.5 text-[11px] font-bold" style={{ color: "#91929E" }}>
                <ArrowLeft size={12} /> Orqaga
              </button>
              <p className="text-xs font-bold mb-2.5" style={{ color: "#0A1629" }}>{pending.label}</p>
              <label className="text-[11px] font-bold block mb-1" style={{ color: "#91929E" }}>Sanadan</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full mb-2.5 px-2.5 py-2 text-xs font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 8, border: "1px solid #EEF2FF", color: "#0A1629" }} />
              <label className="text-[11px] font-bold block mb-1" style={{ color: "#91929E" }}>Sanagacha</label>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                className="w-full mb-3 px-2.5 py-2 text-xs font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 8, border: "1px solid #EEF2FF", color: "#0A1629" }} />
              <div className="flex gap-2">
                <button onClick={closeAll} className="flex-1 py-2 text-xs font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 8 }}>
                  Bekor qilish
                </button>
                <button
                  onClick={() => dateFrom && dateTo && assign(pending.status, dateFrom, dateTo)}
                  disabled={!dateFrom || !dateTo || saving}
                  className="flex-1 flex items-center justify-center py-2 text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "#3F8CFF", borderRadius: 8 }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : "Tasdiqlash"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
