"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";
import DavomatTabs from "@/components/attendance/DavomatTabs";
import { getUser } from "@/lib/auth";

export default function XodimDavomatPage() {
  const [isKadr, setIsKadr] = useState(false);

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
      <DavomatTabs />
    </div>
  );
}
