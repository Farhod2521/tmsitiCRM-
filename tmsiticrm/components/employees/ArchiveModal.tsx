"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { X, Loader2, Archive, ArchiveRestore, ChevronDown, Search } from "lucide-react";

export interface ArchivedEmp {
  id: number;
  full_name: string;
  position: string;
  phone: string;
  department?: { id: number; name: string } | null;
  archived_at: string | null;
}

interface ArchiveMonth {
  year: number;
  month: number;
  attendance_days: number;
  bolim_ball: number | null;
  kadr_ball: number | null;
  ijro_edo_ball: number | null;
  ijro_ichki_ball: number | null;
  direktor_ball: number | null;
  kpi_total: number | null;
}

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const num = (v: number | null) => (v === null || v === undefined ? "—" : String(v));

function History({ empId }: { empId: number }) {
  const [rows, setRows] = useState<ArchiveMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ArchiveMonth[]>(`/employees/archive/${empId}/history`)
      .then(setRows)
      .catch(err => setError(err instanceof Error ? err.message : "Yuklashda xatolik"));
  }, [empId]);

  if (error) return <p className="text-sm py-3" style={{ color: "#FF5C5C" }}>{error}</p>;
  if (!rows) return <div className="py-4 flex justify-center"><Loader2 size={18} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>;
  if (rows.length === 0) return <p className="text-sm py-3" style={{ color: "#91929E" }}>Davomat va KPI ma&apos;lumotlari yo&apos;q</p>;

  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "#91929E" }}>
            {["Oy", "Kelgan kunlar", "Bo'lim", "Kadr", "Ijro (EDO)", "Ijro (ichki)", "KPI jami"].map(h => (
              <th key={h} className="text-left font-semibold py-2 pr-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.year}-${r.month}`} style={{ borderTop: "1px solid #F4F9FD", color: "#0A1629" }}>
              <td className="py-2 pr-3 whitespace-nowrap font-semibold">{MONTHS[r.month - 1]} {r.year}</td>
              <td className="py-2 pr-3">{r.attendance_days}</td>
              <td className="py-2 pr-3">{num(r.bolim_ball)}</td>
              <td className="py-2 pr-3">{num(r.kadr_ball)}</td>
              <td className="py-2 pr-3">{num(r.ijro_edo_ball)}</td>
              <td className="py-2 pr-3">{num(r.ijro_ichki_ball)}</td>
              <td className="py-2 pr-3 font-bold" style={{ color: "#3F8CFF" }}>{num(r.kpi_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ArchiveModal({ onClose, onRestored }: {
  onClose: () => void;
  onRestored: () => void;
}) {
  const [items, setItems] = useState<ArchivedEmp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<ArchivedEmp[]>("/employees/archive/list")
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : "Yuklashda xatolik"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function restore(emp: ArchivedEmp) {
    if (!confirm(`${emp.full_name} — arxivdan tiklab, qayta faol xodimga aylantirasizmi?`)) return;
    setRestoringId(emp.id);
    setError(null);
    try {
      await apiFetch(`/employees/archive/${emp.id}/restore`, { method: "POST" });
      setItems(prev => prev?.filter(e => e.id !== emp.id) ?? null);
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tiklashda xatolik");
    } finally {
      setRestoringId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = (items ?? []).filter(e => !q || e.full_name.toLowerCase().includes(q) || e.phone.includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(125,133,146,0.12)", borderRadius: 12 }}>
              <Archive size={18} style={{ color: "#7D8592" }} />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Arxiv</h2>
              <p className="text-xs" style={{ color: "#91929E" }}>Ishdan bo&apos;shagan xodimlar — davomati va KPI saqlangan</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <Search size={16} style={{ color: "#91929E" }} />
            <input type="text" placeholder="Arxivdan qidirish..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1" style={{ color: "#0A1629" }} />
          </div>
          {error && (
            <div className="mt-3 px-4 py-2.5 text-sm" style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          {items === null && !error && (
            <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
          )}
          {items !== null && visible.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: "#91929E" }}>Arxiv bo&apos;sh</p>
          )}
          {visible.map(emp => (
            <div key={emp.id} className="px-4 py-3" style={{ background: "#F9FBFD", borderRadius: 14, border: "1px solid #EEF2F7" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={() => setOpenId(openId === emp.id ? null : emp.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                  <ChevronDown size={16} className="flex-shrink-0 transition-transform"
                    style={{ color: "#7D8592", transform: openId === emp.id ? "rotate(180deg)" : "none" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{emp.full_name}</p>
                    <p className="text-xs truncate" style={{ color: "#91929E" }}>
                      {emp.position}{emp.department?.name ? ` · ${emp.department.name}` : ""} · {emp.phone}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "#91929E" }}>Arxivlangan: {fmtDate(emp.archived_at)}</span>
                  <button onClick={() => restore(emp)} disabled={restoringId === emp.id}
                    className="flex items-center gap-1.5 px-3 h-8 text-xs font-bold hover:opacity-80 transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(0,196,140,0.12)", color: "#00A877", borderRadius: 10 }}>
                    {restoringId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                    Tiklash
                  </button>
                </div>
              </div>
              {openId === emp.id && <History empId={emp.id} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
