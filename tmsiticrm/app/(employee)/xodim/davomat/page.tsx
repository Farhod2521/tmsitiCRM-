"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";
import AutoTabelTable from "@/components/attendance/AutoTabelTable";
import { getUser } from "@/lib/auth";
import { Users, User } from "lucide-react";

export default function XodimDavomatPage() {
  const [isKadr, setIsKadr] = useState(false);
  const [tab, setTab] = useState<"xodimlar" | "ozim">("xodimlar");

  useEffect(() => { setIsKadr(getUser()?.role === "kadr"); }, []);

  if (!isKadr) {
    return (
      <div>
        <Header title="Davomat" subtitle="Ishga kelganingizni belgilang va oylik davomat kalendaringizni kuzating" />
        <AttendanceCalendar />
      </div>
    );
  }

  return (
    <div>
      <Header title="Davomat" subtitle="Xodimlar davomatini kuzating va o'zingizning davomatingizni belgilang" />

      <div className="flex items-center gap-1 mb-5 p-1"
        style={{ background: "#FFFFFF", borderRadius: 14, display: "inline-flex", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
        <button onClick={() => setTab("xodimlar")}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{ borderRadius: 10, background: tab === "xodimlar" ? "#3F8CFF" : "transparent", color: tab === "xodimlar" ? "#FFFFFF" : "#7D8592" }}>
          <Users size={16} /> Xodimlar davomati
        </button>
        <button onClick={() => setTab("ozim")}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{ borderRadius: 10, background: tab === "ozim" ? "#3F8CFF" : "transparent", color: tab === "ozim" ? "#FFFFFF" : "#7D8592" }}>
          <User size={16} /> O'zim
        </button>
      </div>

      {tab === "xodimlar" ? <AutoTabelTable /> : <AttendanceCalendar />}
    </div>
  );
}
