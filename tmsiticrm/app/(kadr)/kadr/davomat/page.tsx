"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";
import TurniketDavomatTab from "@/components/attendance/TurniketDavomatTab";

export default function KadrDavomatPage() {
  const [tab, setTab] = useState<"tizim" | "turniket">("tizim");

  return (
    <div>
      <Header title="Davomat" subtitle="Ishga kelganingizni belgilang va oylik davomat kalendaringizni kuzating" />

      <div className="flex gap-1 p-1 mb-5 w-fit" style={{ background: "#F4F9FD", borderRadius: 16 }}>
        {([["tizim", "Tizim davomat"], ["turniket", "Turniket davomat"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-5 py-2.5 text-sm font-bold transition-colors"
            style={{
              borderRadius: 12,
              background: tab === key ? "#3F8CFF" : "transparent",
              color: tab === key ? "#FFFFFF" : "#7D8592",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tizim" ? <AttendanceCalendar /> : <TurniketDavomatTab />}
    </div>
  );
}
