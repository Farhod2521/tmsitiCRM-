"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import InternalDocTable from "./InternalDocTable";
import InternalDocDetailModal from "./InternalDocDetailModal";
import { InternalDocListItem } from "./types";

export default function InternalDocZamdirektorInboxTab() {
  const [docs, setDocs] = useState<InternalDocListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const me = getUser();
  const canAct = me?.role === "zamdirektor";

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<InternalDocListItem[]>("/internal-docs/zamdirektor-inbox")
      .then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
      <div className="px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Xodim hujjatlari</h2>
        <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
          {canAct ? "Sizga yo'naltirilgan, tasdiqlash kerak bo'lgan hujjatlar" : "Barcha zamdirektorlarga yo'naltirilgan hujjatlar (faqat ko'rish)"}
        </p>
      </div>
      <InternalDocTable docs={docs} loading={loading} showDept showCreator onRowClick={d => setSelectedId(d.id)} />

      {selectedId && (
        <InternalDocDetailModal docId={selectedId} onClose={() => setSelectedId(null)} onChanged={load}
          showZamdirektorActions={canAct} />
      )}
    </div>
  );
}
