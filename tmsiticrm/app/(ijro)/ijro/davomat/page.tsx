"use client";

import Header from "@/components/layout/Header";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";

export default function IjroDavomatPage() {
  return (
    <div>
      <Header title="Davomat" subtitle="Ishga kelganingizni belgilang va oylik davomat kalendaringizni kuzating" />
      <AttendanceCalendar />
    </div>
  );
}
