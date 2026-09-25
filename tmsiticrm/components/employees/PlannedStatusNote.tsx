"use client";

import { STATUS_LABEL } from "@/components/employees/StatusMenu";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Kelajakdagi (rejalashtirilgan) holat — masalan: "📅 05.10.2026 dan: Mehnat ta'tili (25.10.2026 gacha)".
 *  Sanasi kelganda backend xodimni shu holatga avtomatik o'tkazadi. */
export default function PlannedStatusNote({ emp }: {
  emp: { planned_status?: string | null; planned_from?: string | null; planned_to?: string | null };
}) {
  if (!emp.planned_status || !emp.planned_from) return null;
  const label = (STATUS_LABEL[emp.planned_status] || emp.planned_status).replace(/ida$/, "i");
  return (
    <div className="mt-1 inline-flex flex-col px-2 py-1" style={{ background: "rgba(255,189,33,0.12)", borderRadius: 8 }}
      title="Rejalashtirilgan — sanasi kelganda avtomatik o'tadi">
      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "#B4780C" }}>
        📅 {fmt(emp.planned_from)} dan: {label}
      </span>
      {emp.planned_to && (
        <span className="text-[10px] whitespace-nowrap" style={{ color: "#C9A24A" }}>{fmt(emp.planned_to)} gacha · rejalashtirilgan</span>
      )}
    </div>
  );
}
