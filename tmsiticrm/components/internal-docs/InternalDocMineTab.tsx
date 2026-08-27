"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import InternalDocTable from "./InternalDocTable";
import InternalDocCreateModal from "./InternalDocCreateModal";
import InternalDocDetailModal from "./InternalDocDetailModal";
import { InternalDocListItem } from "./types";

export default function InternalDocMineTab({ showZamdirektor }: { showZamdirektor: boolean }) {
  const [docs, setDocs] = useState<InternalDocListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<InternalDocListItem[]>("/internal-docs/mine")
      .then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div>
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Mening hujjatlarim</h2>
          <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Siz kiritgan hujjatlar va ularning holati</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white"
          style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(63,140,255,0.3)" }}>
          <Plus size={16} /> Yangi hujjat yaratish
        </button>
      </div>
      <InternalDocTable docs={docs} loading={loading} showZamdirektor onRowClick={d => setSelectedId(d.id)} />

      {createOpen && (
        <InternalDocCreateModal showZamdirektor={showZamdirektor} onClose={() => setCreateOpen(false)} onSaved={load} />
      )}
      {selectedId && (
        <InternalDocDetailModal docId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      )}
    </div>
  );
}
