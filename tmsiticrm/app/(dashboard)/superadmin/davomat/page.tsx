"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { Users, Clock, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

interface DavomatRow {
  employee_id: number;
  full_name: string;
  position: string;
  department: string | null;
  check_in_local: string | null;
  late_minutes: number | null;
  distance_m: number | null;
  arrived: boolean;
}

type FilterKey = "barchasi" | "vaqtida" | "sariq" | "qizil" | "kelmagan";

const FILTERS: { key: FilterKey; label: string; color: string; bg: string }[] = [
  { key: "barchasi",  label: "Barchasi",       color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
  { key: "vaqtida",   label: "Vaqtida (≤10)",  color: "#00A578", bg: "rgba(0,165,120,0.1)" },
  { key: "sariq",     label: "10–30 daqiqa",   color: "#E0A400", bg: "rgba(224,164,0,0.1)" },
  { key: "qizil",     label: "30+ daqiqa",     color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
  { key: "kelmagan",  label: "Kelmagan",        color: "#91929E", bg: "rgba(145,146,158,0.1)" },
];

function lateColor(min: number | null): string {
  if (min === null) return "#91929E";
  if (min <= 10) return "#00A578";
  if (min <= 30) return "#E0A400";
  return "#FF5C5C";
}

function lateBadge(row: DavomatRow) {
  if (!row.arrived) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg"
        style={{ background: "rgba(145,146,158,0.12)", color: "#91929E" }}
      >
        Kelmagan
      </span>
    );
  }
  const min = row.late_minutes ?? 0;
  const color = lateColor(min);
  const label = min === 0 ? "Vaqtida" : `${min} daq kech`;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchFilter(row: DavomatRow, key: FilterKey): boolean {
  if (key === "barchasi") return true;
  if (key === "kelmagan") return !row.arrived;
  if (!row.arrived) return false;
  const m = row.late_minutes ?? 0;
  if (key === "vaqtida") return m <= 10;
  if (key === "sariq")   return m > 10 && m <= 30;
  if (key === "qizil")   return m > 30;
  return true;
}

export default function DavomatPage() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<DavomatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("barchasi");

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<DavomatRow[]>(`/attendance/admin/day?date=${date}`)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const counts = {
    barchasi: rows.length,
    vaqtida:  rows.filter((r) => r.arrived && (r.late_minutes ?? 0) <= 10).length,
    sariq:    rows.filter((r) => r.arrived && (r.late_minutes ?? 0) > 10 && (r.late_minutes ?? 0) <= 30).length,
    qizil:    rows.filter((r) => r.arrived && (r.late_minutes ?? 0) > 30).length,
    kelmagan: rows.filter((r) => !r.arrived).length,
  };

  const visible = rows.filter((r) => matchFilter(r, filter));

  const statCards = [
    { label: "Jami xodim",    value: counts.barchasi, icon: Users,          color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
    { label: "Vaqtida keldi", value: counts.vaqtida,  icon: CheckCircle2,   color: "#00A578", bg: "rgba(0,165,120,0.1)" },
    { label: "10–30 daq kech",value: counts.sariq,    icon: Clock,          color: "#E0A400", bg: "rgba(224,164,0,0.1)" },
    { label: "30+ daq kech",  value: counts.qizil,    icon: AlertTriangle,  color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
    { label: "Kelmagan",      value: counts.kelmagan, icon: XCircle,        color: "#91929E", bg: "rgba(145,146,158,0.1)" },
  ];

  return (
    <div>
      <Header title="Davomat" subtitle="Xodimlarning bugungi kelish holati" />

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="p-4 flex items-center gap-3"
              style={{
                background: "#FFFFFF",
                boxShadow: "0px 6px 58px rgba(196,203,214,0.1)",
                borderRadius: 20,
              }}
            >
              <div
                className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg, borderRadius: 12 }}
              >
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
                <p className="text-xs leading-tight" style={{ color: "#91929E" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div
        className="p-6"
        style={{
          background: "#FFFFFF",
          boxShadow: "0px 6px 58px rgba(196,203,214,0.1)",
          borderRadius: 24,
        }}
      >
        {/* Toolbar: date picker + filter tabs */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-4 py-2 text-sm font-bold transition-all"
                  style={{
                    background: active ? f.bg : "#F4F9FD",
                    color: active ? f.color : "#7D8592",
                    borderRadius: 12,
                    border: active ? `1.5px solid ${f.color}40` : "1.5px solid transparent",
                  }}
                >
                  {f.label}
                  <span
                    className="ml-1.5 px-1.5 py-0.5 text-xs rounded-md"
                    style={{
                      background: active ? `${f.color}25` : "rgba(145,146,158,0.12)",
                      color: active ? f.color : "#91929E",
                    }}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 text-sm font-bold outline-none"
            style={{
              background: "#F4F9FD",
              borderRadius: 12,
              color: "#0A1629",
              border: "none",
              cursor: "pointer",
            }}
          />
        </div>

        {/* Loading / Error */}
        {loading && (
          <p className="text-center py-10 text-sm" style={{ color: "#91929E" }}>
            Yuklanmoqda...
          </p>
        )}
        {error && (
          <p className="text-center py-10 text-sm" style={{ color: "#FF5C5C" }}>
            {error}
          </p>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                  {["#", "Xodim", "Bo'lim", "Lavozim", "Keldi", "Kechikish", "Masofa"].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-4 text-xs font-bold uppercase"
                      style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 16 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm" style={{ color: "#91929E" }}>
                      Ma'lumot topilmadi
                    </td>
                  </tr>
                )}
                {visible.map((row, i) => {
                  const initColor = row.arrived ? lateColor(row.late_minutes) : "#91929E";
                  return (
                    <tr
                      key={row.employee_id}
                      style={{ borderBottom: "1px solid #F4F9FD" }}
                      className="hover:bg-[#F4F9FD] transition-colors"
                    >
                      {/* # */}
                      <td className="py-4 text-sm font-bold" style={{ color: "#91929E", paddingRight: 16 }}>
                        {i + 1}
                      </td>

                      {/* Xodim */}
                      <td className="py-4" style={{ paddingRight: 16 }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                            style={{ background: initColor, borderRadius: 10 }}
                          >
                            {row.full_name.charAt(0)}
                          </div>
                          <p className="font-bold text-sm" style={{ color: "#0A1629", whiteSpace: "nowrap" }}>
                            {row.full_name}
                          </p>
                        </div>
                      </td>

                      {/* Bo'lim */}
                      <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 16, whiteSpace: "nowrap" }}>
                        {row.department || "—"}
                      </td>

                      {/* Lavozim */}
                      <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 16, maxWidth: 180 }}>
                        <span className="line-clamp-1">{row.position}</span>
                      </td>

                      {/* Keldi (vaqt) */}
                      <td className="py-4" style={{ paddingRight: 16 }}>
                        {row.check_in_local ? (
                          <span className="text-sm font-bold" style={{ color: "#0A1629" }}>
                            {row.check_in_local}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "#D9E3F0" }}>—</span>
                        )}
                      </td>

                      {/* Kechikish badge */}
                      <td className="py-4" style={{ paddingRight: 16 }}>
                        {lateBadge(row)}
                      </td>

                      {/* Masofa */}
                      <td className="py-4 text-sm" style={{ color: "#7D8592" }}>
                        {row.distance_m !== null && row.distance_m !== undefined
                          ? `${Math.round(row.distance_m)} m`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <p className="text-sm mt-4" style={{ color: "#91929E" }}>
            {visible.length} ta xodim ko'rsatilmoqda (jami {rows.length} ta)
          </p>
        )}
      </div>
    </div>
  );
}
