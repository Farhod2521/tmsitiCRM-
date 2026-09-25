"use client";

import { useState } from "react";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";
import AutoTabelTable from "@/components/attendance/AutoTabelTable";
import TurniketDavomatTab from "@/components/attendance/TurniketDavomatTab";
import { Users, User, DoorOpen } from "lucide-react";

type Tab = "xodimlar" | "turniket" | "ozim";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "xodimlar", label: "Xodimlar davomati", icon: Users },
  { key: "turniket", label: "Turniket davomat",  icon: DoorOpen },
  { key: "ozim",     label: "O'zim",             icon: User },
];

/** Kadr, superadmin, direktor va zamdirektor uchun umumiy davomat oynasi:
 *  xodimlar oylik jadvali, turniket davomati va o'z davomat kalendari.
 *  canImport — turniket xlsx yuklash (backendda faqat kadr/superadmin). */
export default function DavomatTabs({ canImport = true }: { canImport?: boolean }) {
  const [tab, setTab] = useState<Tab>("xodimlar");

  return (
    <>
      <div className="flex items-center gap-1 mb-5 p-1 max-w-full overflow-x-auto"
        style={{ background: "#FFFFFF", borderRadius: 14, display: "inline-flex", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all whitespace-nowrap"
            style={{ borderRadius: 10, background: tab === key ? "#3F8CFF" : "transparent", color: tab === key ? "#FFFFFF" : "#7D8592" }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "xodimlar" ? <AutoTabelTable /> : tab === "turniket" ? <TurniketDavomatTab canImport={canImport} /> : <AttendanceCalendar />}
    </>
  );
}
