"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import {
  ListChecks, Search, Download, Loader2, CheckCircle2, Clock, XCircle, MinusCircle, Palmtree,
  MoreVertical, CalendarDays, X,
} from "lucide-react";

interface DailyNote { type: string; label: string; status: string; text: string | null; }
interface DailyRow {
  employee_id: number;
  full_name: string;
  position: string | null;
  department: string | null;
  avatar: string | null;
  check_in: string | null;
  late_min: number;
  holat: "kelgan" | "kechikkan" | "kelmagan" | "sababli" | "tatilda";
  holat_label: string;
  status: string;
  status_label: string;
  note: DailyNote | null;
  distance_m: number | null;
}
interface DailyOut { date: string; day_off: string | null; rows: DailyRow[]; }

const HOLAT_CFG: Record<DailyRow["holat"], { icon: typeof CheckCircle2; color: string; bg: string }> = {
  kelgan:    { icon: CheckCircle2, color: "#00A578", bg: "rgba(0,196,140,0.12)" },
  kechikkan: { icon: Clock,        color: "#E07A1F", bg: "rgba(255,140,66,0.14)" },
  kelmagan:  { icon: XCircle,      color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  sababli:   { icon: MinusCircle,  color: "#7D8592", bg: "rgba(125,133,146,0.14)" },
  tatilda:   { icon: Palmtree,     color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
};
const HOLAT_FILTERS: { key: "" | DailyRow["holat"]; label: string }[] = [
  { key: "", label: "Barcha holatlar" },
  { key: "kelgan", label: "Kelgan" },
  { key: "kechikkan", label: "Kechikkan" },
  { key: "kelmagan", label: "Kelmagan" },
  { key: "sababli", label: "Sababli" },
  { key: "tatilda", label: "Ta'til / safar" },
];
const REVIEW_LABEL: Record<string, string> = {
  bolim_kutilmoqda: "Bo'lim boshlig'ida", kutilmoqda: "Kadrda", kadr_tasdiqladi: "Kadr tasdiqlagan",
  sababli: "Tasdiqlangan", sababsiz: "Rad etilgan",
};

function statusCfg(status: string): { color: string; bg: string } {
  if (status === "faol" || status === "online") return { color: "#00A578", bg: "rgba(0,196,140,0.12)" };
  if (status === "faol_emas") return { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" };
  if (status.startsWith("ariza_")) return { color: "#E07A1F", bg: "rgba(255,189,33,0.16)" };
  return { color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const SELECT = "px-3 py-2.5 text-sm outline-none bg-white";
const SELECT_STYLE = { border: "1px solid #D9E3F0", borderRadius: 10, color: "#0A1629" };

export default function BugunTab() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<DailyOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [holat, setHolat] = useState<"" | DailyRow["holat"]>("");
  const [downloading, setDownloading] = useState(false);
  const [menu, setMenu] = useState<{ row: DailyRow; x: number; y: number } | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      setData(await apiFetch<DailyOut>(`/attendance/daily?date=${d}`));
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, [menu]);

  const rows = data?.rows ?? [];
  const departments = useMemo(
    () => Array.from(new Set(rows.map(r => r.department).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const visible = rows.filter(r =>
    (!search || r.full_name.toLowerCase().includes(search.toLowerCase())) &&
    (!dept || r.department === dept) &&
    (!holat || r.holat === holat),
  );
  const counts = {
    kelgan: rows.filter(r => r.holat === "kelgan").length,
    kechikkan: rows.filter(r => r.holat === "kechikkan").length,
    kelmagan: rows.filter(r => r.holat === "kelmagan").length,
  };

  async function downloadXlsx() {
    setDownloading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const res = await fetch(`${API_URL}/attendance/daily/xlsx?date=${date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `davomat_${date}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setDownloading(false);
    }
  }

  const isToday = date === todayIso();

  return (
    <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      {/* Sarlavha + filtrlar */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center" style={{ background: "#00C48C", borderRadius: 10 }}>
            <ListChecks size={18} color="#FFFFFF" />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>
              {isToday ? "Bugungi xodimlar davomat ro'yxati" : "Xodimlar davomat ro'yxati"}
            </h3>
            {!loading && data && (
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                {data.day_off ? <span style={{ color: "#E0457B" }}>{data.day_off} · </span> : null}
                Kelgan: <b style={{ color: "#00A578" }}>{counts.kelgan}</b> · Kechikkan: <b style={{ color: "#E07A1F" }}>{counts.kechikkan}</b> · Kelmagan: <b style={{ color: "#FF5C5C" }}>{counts.kelmagan}</b>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ border: "1px solid #D9E3F0", borderRadius: 10, minWidth: 200 }}>
            <Search size={15} style={{ color: "#91929E" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Xodimni qidirish..."
              className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "#0A1629" }} />
          </div>
          <select value={dept} onChange={e => setDept(e.target.value)} className={SELECT} style={SELECT_STYLE} aria-label="Bo'lim">
            <option value="">Barcha bo&apos;limlar</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={holat} onChange={e => setHolat(e.target.value as typeof holat)} className={SELECT} style={SELECT_STYLE} aria-label="Holat">
            {HOLAT_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2" style={{ border: "1px solid #D9E3F0", borderRadius: 10 }}>
            <CalendarDays size={15} style={{ color: "#91929E" }} />
            <input type="date" value={date} max={todayIso()} onChange={e => e.target.value && setDate(e.target.value)}
              className="bg-transparent outline-none text-sm" style={{ color: "#0A1629" }} />
          </label>
          <button onClick={downloadXlsx} disabled={downloading || !rows.length}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-50 hover:bg-[#F4F9FD] transition-colors"
            style={{ border: "1px solid #D9E3F0", borderRadius: 10, color: "#0A1629" }}>
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
          </button>
        </div>
      </div>

      {/* Jadval */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : visible.length === 0 ? (
        <p className="text-center text-sm py-16" style={{ color: "#91929E" }}>Xodim topilmadi</p>
      ) : (
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F4F9FD" }}>
                {["№", "Xodim", "Bo'lim", "Kelish vaqti", "Holat", "Kechikish", "Status", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2.5 text-xs font-bold whitespace-nowrap"
                    style={{ color: "#3D4557", borderRight: i < 7 ? "1px solid #EEF2F7" : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const hc = HOLAT_CFG[r.holat];
                const HIcon = hc.icon;
                const sc = statusCfg(r.status);
                return (
                  <tr key={r.employee_id} className="hover:bg-[#FAFCFF] transition-colors" style={{ borderBottom: "1px solid #F4F9FD" }}>
                    <td className="px-3 py-2 text-xs" style={{ color: "#91929E" }}>{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                            style={{ background: "#E4EFFF", color: "#3F8CFF" }}>{initials(r.full_name)}</span>
                        )}
                        <span className="font-semibold whitespace-nowrap" style={{ color: "#0A1629" }}>{r.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#3D4557" }}>{r.department || "—"}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: "#0A1629" }}>{r.check_in || "–"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                        style={{ color: hc.color, background: hc.bg, borderRadius: 8 }}>
                        <HIcon size={13} /> {r.holat_label}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: r.late_min ? "#0A1629" : "#91929E" }}>
                      {r.late_min ? `${r.late_min} daq` : "–"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                        style={{ color: sc.color, background: sc.bg, borderRadius: 8 }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} /> {r.status_label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={e => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenu(menu?.row.employee_id === r.employee_id ? null : { row: r, x: rect.right, y: rect.bottom });
                      }} title="Batafsil" className="w-7 h-7 inline-flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]">
                        <MoreVertical size={15} style={{ color: "#3D4557" }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Batafsil (⋮) */}
      {menu && (
        <div onClick={e => e.stopPropagation()} className="fixed z-50 p-4"
          style={{
            left: Math.max(8, menu.x - 280), top: Math.min(menu.y + 6, window.innerHeight - 240), width: 280,
            background: "#FFFFFF", borderRadius: 14, boxShadow: "0 12px 36px rgba(10,22,41,0.16)", border: "1px solid #F4F9FD",
          }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{menu.row.full_name}</p>
              <p className="text-xs truncate" style={{ color: "#91929E" }}>{menu.row.position || "—"}</p>
            </div>
            <button onClick={() => setMenu(null)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F4F9FD]">
              <X size={13} style={{ color: "#91929E" }} />
            </button>
          </div>
          <dl className="mt-3 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between"><dt style={{ color: "#91929E" }}>Kelish vaqti</dt><dd className="font-bold">{menu.row.check_in || "—"}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "#91929E" }}>Holat</dt><dd className="font-bold" style={{ color: HOLAT_CFG[menu.row.holat].color }}>{menu.row.holat_label}</dd></div>
            {menu.row.distance_m != null && (
              <div className="flex justify-between"><dt style={{ color: "#91929E" }}>Ofisgacha masofa</dt><dd className="font-bold">{Math.round(menu.row.distance_m)} m</dd></div>
            )}
          </dl>
          {menu.row.note && (
            <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid #F4F9FD" }}>
              <div className="flex justify-between font-bold">
                <span style={{ color: "#E07A1F" }}>Ariza: {menu.row.note.label}</span>
                <span style={{ color: "#7D8592" }}>{REVIEW_LABEL[menu.row.note.status] ?? menu.row.note.status}</span>
              </div>
              <p className="mt-1" style={{ color: "#3D4557" }}>{menu.row.note.text || "Izoh yozilmagan"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
