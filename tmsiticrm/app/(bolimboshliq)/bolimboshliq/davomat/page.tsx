"use client";

import Header from "@/components/layout/Header";
import AttendanceCalendar from "@/components/profile/AttendanceCalendar";
import AttendanceNotesInbox from "@/components/profile/AttendanceNotesInbox";

export default function BolimBoshliqDavomatPage() {
  return (
    <div>
      <Header title="Davomat" subtitle="Ishga kelganingizni belgilang va oylik davomat kalendaringizni kuzating" />
      <AttendanceCalendar />
      <AttendanceNotesInbox />
    </div>
  );
}
