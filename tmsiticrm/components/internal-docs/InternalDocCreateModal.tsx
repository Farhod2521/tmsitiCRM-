"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send, CloudUpload, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fileToBase64, InternalDocDetail } from "./types";

interface ZamdirektorOpt { id: number; full_name: string; position: string; }

export default function InternalDocCreateModal({
  showZamdirektor, parentDoc, onClose, onCreated,
}: {
  showZamdirektor: boolean;
  parentDoc?: InternalDocDetail | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nomi, setNomi] = useState(parentDoc?.nomi || "");
  const [mazmun, setMazmun] = useState(parentDoc?.mazmun || "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [zamdirektorlar, setZamdirektorlar] = useState<ZamdirektorOpt[]>([]);
  const [zamdirektorId, setZamdirektorId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showZamdirektor) return;
    apiFetch<ZamdirektorOpt[]>("/internal-docs/zamdirektorlar")
      .then(setZamdirektorlar)
      .catch(() => {});
  }, [showZamdirektor]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileB64(await fileToBase64(file));
  }

  async function handleSubmit() {
    setError(null);
    if (!nomi.trim()) { setError("Hujjat nomini kiriting"); return; }
    if (showZamdirektor && !zamdirektorId) { setError("Zamdirektorni tanlang"); return; }
    setSaving(true);
    try {
      await apiFetch("/internal-docs/", {
        method: "POST",
        body: JSON.stringify({
          nomi: nomi.trim(),
          mazmun: mazmun.trim() || null,
          fayl_name: fileName,
          fayl_b64: fileB64,
          zamdirektor_id: showZamdirektor ? zamdirektorId : null,
          parent_doc_id: parentDoc?.id ?? null,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
              {parentDoc ? "Hujjatni qayta yuborish" : "Yangi hujjat yaratish"}
            </h2>
            {parentDoc && (
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                Avvalgi: № {parentDoc.hujjat_raqami} — rad etilgan
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat nomi *</label>
            <input value={nomi} onChange={e => setNomi(e.target.value)}
              placeholder="Hujjat nomini kiriting"
              className="w-full px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat mazmuni</label>
            <textarea value={mazmun} onChange={e => setMazmun(e.target.value)}
              placeholder="Hujjat mazmuni haqida yozing..."
              rows={4} className="w-full px-4 py-3 text-sm outline-none resize-y"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
          </div>

          {showZamdirektor && (
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Zamdirektor *</label>
              <div className="relative">
                <select value={zamdirektorId} onChange={e => setZamdirektorId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: zamdirektorId ? "#0A1629" : "#91929E" }}>
                  <option value="">Zamdirektorni tanlang...</option>
                  {zamdirektorlar.map(z => (
                    <option key={z.id} value={z.id}>{z.full_name}{z.position ? ` (${z.position})` : ""}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Fayl biriktirish</label>
            <label className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px dashed #D0D9E8", borderRadius: 14, background: "#FAFCFF" }}>
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10 }}>
                <CloudUpload size={18} style={{ color: "#3F8CFF" }} />
              </div>
              {fileName
                ? <p className="text-sm font-bold" style={{ color: "#00C48C" }}>{fileName}</p>
                : <p className="text-xs font-bold" style={{ color: "#91929E" }}>Faylni tanlang</p>}
              <input type="file" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {error && <p className="text-xs font-bold" style={{ color: "#FF5C5C" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #F4F9FD" }}>
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: "#F4F9FD", borderRadius: 12, color: "#7D8592" }}>
            Bekor qilish
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(63,140,255,0.3)" }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {parentDoc ? "Qayta yuborish" : "Yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}
