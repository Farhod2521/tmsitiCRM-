"use client";

import { use } from "react";
import AuditEditor from "@/components/energoaudit/AuditEditor";

export default function EnergoauditEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AuditEditor id={Number(id)} basePath="/bolimboshliq/energoaudit" />;
}
