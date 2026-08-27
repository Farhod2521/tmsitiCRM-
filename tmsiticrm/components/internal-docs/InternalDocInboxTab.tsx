"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import InternalDocTable from "./InternalDocTable";
import InternalDocDetailModal from "./InternalDocDetailModal";
import { InternalDocListItem } from "./types";

export default function InternalDocInboxTab() {
  const [docs, setDocs] = useState<InternalDocListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<InternalDocListItem[]>("/internal-docs/bolim-inbox")
      .then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
      <div className="px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Xodimlardan kelgan</h2>
        <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Ko'rib chiqilishi va tasdiqlanishi kerak bo'lgan hujjatlar</p>
      </div>
      <InternalDocTable docs={docs} loading={loading} showCreator onRowClick={d => setSelectedId(d.id)} />

      {selectedId && (
        <InternalDocDetailModal docId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} showBolimActions />
      )}
    </div>
  );
}
