"use client";

import { useState } from "react";
import { FileText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { InternalDocListItem, InternalDocStatus, STATUS_CFG, fmtDt } from "./types";

const PAGE_SIZE = 5;

export default function InternalDocTable({
  docs, onRowClick, showDept = false, showCreator = false, showZamdirektor = false, loading,
}: {
  docs: InternalDocListItem[];
  onRowClick: (doc: InternalDocListItem) => void;
  showDept?: boolean;
  showCreator?: boolean;
  showZamdirektor?: boolean;
  loading?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<InternalDocStatus | "all">("all");
  const [page, setPage] = useState(1);

  function setFilter(f: InternalDocStatus | "all") {
    setStatusFilter(f);
    setPage(1);
  }

  const filtered = statusFilter === "all" ? docs : docs.filter(d => d.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const statusKeys = Object.keys(STATUS_CFG) as InternalDocStatus[];
  const cols = ["#", "Hujjat raqami", "Nomi", ...(showDept ? ["Bo'lim"] : []), ...(showCreator ? ["Yuklagan"] : []),
    ...(showZamdirektor ? ["Zamdirektor"] : []), "Holati", "Sana"];

  return (
    <div>
      {/* Holati bo'yicha filtr */}
      <div className="flex items-center gap-1.5 flex-wrap px-6 pt-4 pb-2">
        <button onClick={() => setFilter("all")}
          className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
          style={{ borderRadius: 8, background: statusFilter === "all" ? "#0A1629" : "#F4F9FD", color: statusFilter === "all" ? "#FFFFFF" : "#7D8592" }}>
          Barchasi ({docs.length})
        </button>
        {statusKeys.map(s => {
          const count = docs.filter(d => d.status === s).length;
          const cfg = STATUS_CFG[s];
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
              style={{ borderRadius: 8, background: active ? cfg.color : cfg.bg, color: active ? "#FFFFFF" : cfg.color }}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center">
          <FileText size={30} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
          <p className="text-sm font-bold" style={{ color: "#91929E" }}>Hujjatlar yo'q</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                  {cols.map(c => (
                    <th key={c} className="px-4 py-3 text-left text-xs font-bold whitespace-nowrap"
                      style={{ color: "#91929E", background: "#FAFCFF", letterSpacing: "0.04em" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((d, i) => {
                  const cfg = STATUS_CFG[d.status];
                  return (
                    <tr key={d.id} onClick={() => onRowClick(d)}
                      className="cursor-pointer hover:bg-[#FAFCFF] transition-colors"
                      style={{ borderBottom: i < paged.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                      <td className="px-4 py-3.5 text-sm font-bold" style={{ color: "#91929E" }}>{(pageSafe - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3.5 text-sm font-bold" style={{ color: "#3F8CFF" }}>{d.hujjat_raqami}</td>
                      <td className="px-4 py-3.5 text-sm font-bold truncate" style={{ color: "#0A1629", maxWidth: 260 }}>{d.nomi}</td>
                      {showDept && <td className="px-4 py-3.5 text-xs" style={{ color: "#7D8592" }}>{d.department_nomi || "—"}</td>}
                      {showCreator && <td className="px-4 py-3.5 text-xs" style={{ color: "#7D8592" }}>{d.created_by_nomi || "—"}</td>}
                      {showZamdirektor && <td className="px-4 py-3.5 text-xs" style={{ color: "#7D8592" }}>{d.zamdirektor_nomi || "—"}</td>}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold px-2.5 py-1 whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color, borderRadius: 8 }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: "#91929E" }}>{fmtDt(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-xs font-bold" style={{ color: "#91929E" }}>
                {filtered.length} tadan {(pageSafe - 1) * PAGE_SIZE + 1}-{Math.min(pageSafe * PAGE_SIZE, filtered.length)}
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}
                  className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
                  style={{ background: "#F4F9FD", borderRadius: 8 }}>
                  <ChevronLeft size={14} style={{ color: "#3F8CFF" }} />
                </button>
                <span className="px-3 text-xs font-bold" style={{ color: "#0A1629" }}>{pageSafe} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                  className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
                  style={{ background: "#F4F9FD", borderRadius: 8 }}>
                  <ChevronRight size={14} style={{ color: "#3F8CFF" }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
