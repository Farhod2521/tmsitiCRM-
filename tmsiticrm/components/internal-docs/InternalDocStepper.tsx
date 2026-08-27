"use client";

import { Check, X } from "lucide-react";
import { InternalDocDetail, STATUS_STEPS } from "./types";

export default function InternalDocStepper({ doc }: { doc: InternalDocDetail }) {
  const isRejected = doc.status === "rad_etildi";

  // Rad etilgan bo'lsa, qaysi bosqichda rad etilganini oxirgi rad etish
  // log yozuvidan aniqlaymiz — shu bosqichgacha "bajarildi" ko'rsatiladi.
  let doneCount: number;
  if (isRejected) {
    const rejectLog = doc.log.slice().reverse().find(l => l.action === "bolim_rad_etdi" || l.action === "zamdirektor_rad_etdi");
    doneCount = rejectLog?.action === "zamdirektor_rad_etdi" ? 4 : rejectLog?.action === "bolim_rad_etdi" ? 2 : 1;
  } else {
    const idx = STATUS_STEPS.findIndex(s => s.key === doc.status);
    doneCount = idx >= 0 ? idx + 1 : 1;
  }

  const items: { key: string; label: string; rejected?: boolean }[] = isRejected
    ? [...STATUS_STEPS.slice(0, doneCount), { key: "rad_etildi", label: "Rad etildi", rejected: true }]
    : STATUS_STEPS;

  return (
    <div className="flex items-start overflow-x-auto py-1">
      {items.map((s, i) => {
        const isLast = i === items.length - 1;
        const isCurrent = !isRejected && i === doneCount - 1;
        const done = s.rejected || i < doneCount;
        const circleColor = s.rejected ? "#FF5C5C" : done ? "#00C48C" : "#E0E6F0";
        return (
          <div key={s.key} className="flex items-center" style={{ flex: isLast ? "0 0 auto" : "1 1 0%" }}>
            <div className="flex flex-col items-center flex-shrink-0" style={{ width: 96 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: circleColor, boxShadow: isCurrent ? "0 0 0 4px rgba(63,140,255,0.15)" : "none" }}>
                {s.rejected ? <X size={15} color="#fff" /> : done ? <Check size={15} color="#fff" /> : null}
              </div>
              <p className="text-[11px] font-bold mt-1.5 text-center leading-tight"
                style={{ color: s.rejected ? "#FF5C5C" : done ? "#0A1629" : "#B0B8C4" }}>
                {s.label}
              </p>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 min-w-[16px]" style={{ background: i < doneCount - 1 ? "#00C48C" : "#E0E6F0", marginTop: -20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
