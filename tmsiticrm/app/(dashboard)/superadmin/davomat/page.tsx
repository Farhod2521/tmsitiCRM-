"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import DavomatTabs from "@/components/attendance/DavomatTabs";
import { getUser } from "@/lib/auth";

// Superadmin / direktor / zamdirektor — kadrdagi bilan bir xil davomat oynasi.
// Turniket xlsx yuklash faqat superadminda (backendda ham kadr/superadmin).
export default function DavomatPage() {
  const [canImport, setCanImport] = useState(false);

  useEffect(() => { setCanImport(getUser()?.role === "superadmin"); }, []);

  return (
    <div>
      <Header title="Davomat" subtitle="Xodimlar davomatini kuzating va o'zingizning davomatingizni belgilang" />
      <DavomatTabs canImport={canImport} />
    </div>
  );
}
