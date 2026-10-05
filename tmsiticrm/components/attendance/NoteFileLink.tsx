"use client";

import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";

/** Ariza fayli — bosilganda yuklab olinadi (token bilan). */
export default function NoteFileLink({ noteId, name }: { noteId: number; name: string }) {
  const [busy, setBusy] = useState(false);

  async function download(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const res = await fetch(`${API_URL}/attendance/notes/${noteId}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Faylni yuklab bo'lmadi");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik");
    } finally { setBusy(false); }
  }

  return (
    <button onClick={download} disabled={busy} title="Yuklab olish"
      className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-xs font-bold max-w-full hover:opacity-80 disabled:opacity-60"
      style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 8 }}>
      {busy ? <Loader2 size={12} className="animate-spin flex-shrink-0" /> : <Paperclip size={12} className="flex-shrink-0" />}
      <span className="truncate">{name}</span>
    </button>
  );
}
