"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Download, FileSpreadsheet } from "lucide-react";
import { apiFetch } from "@/lib/api";

type CellStatus = "kelgan" | "kechikkan" | "kelmagan" | "kelajak";
interface Cell { day: number; status: CellStatus; time: string | null; late_min: number | null; }
interface DayLabel { day: number; label: string; }
interface Row {
  employee_id: number; full_name: string; department_name: string | null;
  cells: (Cell | null)[]; kelgan: number; kechikkan: number; kelmagan: number;
}
interface TableData { period_label: string; days: DayLabel[]; rows: Row[]; }

const CELL_CFG: Record<CellStatus, { bg: string; color: string }> = {
  kelgan:    { bg: "rgba(0,196,140,0.12)", color: "#00A578" },
  kechikkan: { bg: "rgba(255,189,33,0.16)", color: "#B4780C" },
  kelmagan:  { bg: "rgba(255,92,92,0.12)", color: "#FF5C5C" },
  kelajak:   { bg: "transparent", color: "#D9E3F0" },
};

function cellText(c: Cell | null): string {
  if (!c || c.status === "kelajak") return "";
  if (c.status === "kelmagan") return "Kelmadi";
  if (c.status === "kechikkan") return `${c.time} (+${c.late_min}d)`;
  return c.time || "";
}

export default function MonthlyTableModal({
  year, month, onClose,
}: { year: number; month: number; onClose: () => void }) {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<TableData>(`/reports/monthly-table?year=${year}&month=${month}`)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, [year, month]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("crm_token") : null;
      const res = await fetch(`${API_URL}/reports/monthly-xlsx?year=${year}&month=${month}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oylik_hisobot_${year}_${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[1400px] my-6" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0 20px 60px rgba(10,22,41,0.3)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between gap-4 px-6 py-5 flex-wrap" style={{ borderBottom: "2px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Oylik davomat jadvali (XLSX)</h2>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{data?.period_label || ""} — barcha faol xodimlar</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} disabled={downloading || loading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: "#00C48C", borderRadius: 12, boxShadow: "0px 6px 12px rgba(0,196,140,0.3)" }}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Yuklab olish (.xlsx)
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <X size={16} style={{ color: "#7D8592" }} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
            </div>
          ) : error || !data ? (
            <p className="text-center py-20 font-bold" style={{ color: "#FF5C5C" }}>{error || "Xatolik yuz berdi"}</p>
          ) : data.rows.length === 0 ? (
            <div className="py-20 text-center">
              <FileSpreadsheet size={32} style={{ color: "#D9E3F0", margin: "0 auto" }} />
              <p className="font-bold mt-3" style={{ color: "#0A1629" }}>Xodimlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ border: "1px solid #F0F3F8", borderRadius: 14 }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#FAFCFF" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold sticky left-0" style={{ color: "#91929E", background: "#FAFCFF", minWidth: 200, borderBottom: "1px solid #F0F3F8" }}>Bo'lim / F.I.Sh.</th>
                    {data.days.map(d => (
                      <th key={d.day} className="px-2 py-3 text-xs font-bold text-center" style={{ color: "#91929E", minWidth: 76, borderBottom: "1px solid #F0F3F8" }}>{d.label}</th>
                    ))}
                    <th className="px-2 py-3 text-xs font-bold text-center" style={{ color: "#00A578", minWidth: 60, borderBottom: "1px solid #F0F3F8" }}>Kelgan</th>
                    <th className="px-2 py-3 text-xs font-bold text-center" style={{ color: "#B4780C", minWidth: 60, borderBottom: "1px solid #F0F3F8" }}>Kech.</th>
                    <th className="px-2 py-3 text-xs font-bold text-center" style={{ color: "#FF5C5C", minWidth: 60, borderBottom: "1px solid #F0F3F8" }}>Kelmagan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, ri) => (
                    <tr key={r.employee_id} className="hover:bg-[#FAFCFF] transition-colors" style={{ borderBottom: ri < data.rows.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                      <td className="px-4 py-2.5 sticky left-0" style={{ background: "#FFFFFF" }}>
                        <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{r.full_name}</p>
                        <p className="text-[11px]" style={{ color: "#91929E" }}>{r.department_name || "—"}</p>
                      </td>
                      {r.cells.map((c, ci) => {
                        const status = c?.status || "kelajak";
                        const cfg = CELL_CFG[status];
                        return (
                          <td key={ci} className="px-1 py-2.5 text-center">
                            <span className="inline-block px-1.5 py-1 text-[10px] font-bold whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color, borderRadius: 6 }}>
                              {cellText(c)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2.5 text-center text-sm font-bold" style={{ color: "#00A578" }}>{r.kelgan}</td>
                      <td className="px-2 py-2.5 text-center text-sm font-bold" style={{ color: "#B4780C" }}>{r.kechikkan}</td>
                      <td className="px-2 py-2.5 text-center text-sm font-bold" style={{ color: "#FF5C5C" }}>{r.kelmagan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
