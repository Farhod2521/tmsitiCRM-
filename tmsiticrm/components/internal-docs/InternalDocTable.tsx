"use client";

import { FileText, Loader2 } from "lucide-react";
import { InternalDocListItem, STATUS_CFG, fmtDt } from "./types";

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
  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="py-14 text-center">
        <FileText size={30} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
        <p className="text-sm font-bold" style={{ color: "#91929E" }}>Hujjatlar yo'q</p>
      </div>
    );
  }

  const cols = ["#", "Hujjat raqami", "Nomi", ...(showDept ? ["Bo'lim"] : []), ...(showCreator ? ["Yuklagan"] : []),
    ...(showZamdirektor ? ["Zamdirektor"] : []), "Holati", "Sana"];

  return (
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
          {docs.map((d, i) => {
            const cfg = STATUS_CFG[d.status];
            return (
              <tr key={d.id} onClick={() => onRowClick(d)}
                className="cursor-pointer hover:bg-[#FAFCFF] transition-colors"
                style={{ borderBottom: i < docs.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                <td className="px-4 py-3.5 text-sm font-bold" style={{ color: "#91929E" }}>{i + 1}</td>
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
  );
}
