"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  X, Loader2, FileText, Download, Trash2, CloudUpload, Paperclip, Eye,
} from "lucide-react";

interface EmployeeFile {
  id: number;
  employee_id: number;
  file_name: string;
  file_b64: string;
  note: string | null;
  uploaded_by_nomi: string | null;
  created_at: string | null;
}

function fmtDt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Faylni yuklab olmasdan, brauzerning yangi tabida saytdagi sessiya ichida ko'rsatadi
// (rasm/PDF to'g'ridan-to'g'ri ko'rinadi; boshqa turlar brauzer imkoniga qarab ochiladi).
function viewBase64(b64: string) {
  const url = URL.createObjectURL(dataUrlToBlob(b64));
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadBase64(name: string, b64: string) {
  const a = document.createElement("a");
  a.href = b64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function EmployeeFilesModal({ employeeId, employeeName, onClose }: {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
}) {
  const [files,   setFiles]   = useState<EmployeeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileB64,  setFileB64]  = useState<string | null>(null);
  const [note,     setNote]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<EmployeeFile[]>(`/employees/${employeeId}/files`)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setFileB64(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!fileName || !fileB64) return;
    setUploading(true);
    try {
      await apiFetch(`/employees/${employeeId}/files`, {
        method: "POST",
        body: JSON.stringify({ file_name: fileName, file_b64: fileB64, note: note || null }),
      });
      setFileName(null);
      setFileB64(null);
      setNote("");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Yuklashda xatolik");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId: number) {
    if (!confirm("Faylni o'chirishni tasdiqlaysizmi?")) return;
    setDeletingId(fileId);
    try {
      await apiFetch(`/employees/${employeeId}/files/${fileId}`, { method: "DELETE" });
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xatolik");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Tabel-buyruq hujjatlari</h2>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{employeeName}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Mavjud fayllar */}
          <div>
            <p className="text-xs font-bold mb-2.5 uppercase tracking-wide" style={{ color: "#91929E" }}>
              Biriktirilgan hujjatlar {!loading && `(${files.length})`}
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin" style={{ color: "#3F8CFF" }} />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8" style={{ background: "#F4F9FD", borderRadius: 12 }}>
                <FileText size={26} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
                <p className="text-sm" style={{ color: "#91929E" }}>Hali fayl biriktirilmagan</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {files.map(f => (
                  <div key={f.id} className="flex items-start justify-between gap-3 p-3"
                    style={{ background: "#F4F9FD", borderRadius: 12 }}>
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 9 }}>
                        <FileText size={15} style={{ color: "#3F8CFF" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{f.file_name}</p>
                        {f.note && <p className="text-xs mt-0.5" style={{ color: "#7D8592" }}>{f.note}</p>}
                        <p className="text-[11px] mt-1" style={{ color: "#91929E" }}>
                          {f.uploaded_by_nomi || "—"} · {fmtDt(f.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => viewBase64(f.file_b64)} title="Ko'rish"
                        className="w-8 h-8 flex items-center justify-center hover:opacity-80"
                        style={{ background: "#FFFFFF", borderRadius: 8 }}>
                        <Eye size={14} style={{ color: "#3F8CFF" }} />
                      </button>
                      <button onClick={() => downloadBase64(f.file_name, f.file_b64)} title="Yuklab olish"
                        className="w-8 h-8 flex items-center justify-center hover:opacity-80"
                        style={{ background: "#FFFFFF", borderRadius: 8 }}>
                        <Download size={14} style={{ color: "#3F8CFF" }} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id} title="O'chirish"
                        className="w-8 h-8 flex items-center justify-center hover:opacity-80 disabled:opacity-40"
                        style={{ background: "#FFFFFF", borderRadius: 8 }}>
                        {deletingId === f.id
                          ? <Loader2 size={14} className="animate-spin" style={{ color: "#FF5C5C" }} />
                          : <Trash2 size={14} style={{ color: "#FF5C5C" }} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yangi fayl biriktirish */}
          <div>
            <p className="text-xs font-bold mb-2.5 uppercase tracking-wide" style={{ color: "#91929E" }}>
              Fayl biriktirish
            </p>
            <label className="flex flex-col items-center justify-center gap-2.5 py-6 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px dashed #D0D9E8", borderRadius: 14, background: "#FAFCFF" }}>
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10 }}>
                <CloudUpload size={20} style={{ color: "#3F8CFF" }} />
              </div>
              {fileName
                ? <p className="text-sm font-bold" style={{ color: "#00C48C" }}>{fileName}</p>
                : <>
                  <p className="text-sm font-bold" style={{ color: "#0A1629" }}>Faylni tanlang</p>
                  <p className="text-xs" style={{ color: "#91929E" }}>PDF, DOCX, JPG (Maks. 20MB)</p>
                </>
              }
              <input type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.zip" className="hidden" onChange={handleFile} />
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Izoh (masalan: buyruq raqami, sababi...)"
              rows={2} className="w-full mt-2.5 px-4 py-3 text-sm font-bold outline-none resize-y"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            <button onClick={handleUpload} disabled={!fileName || uploading}
              className="w-full flex items-center justify-center gap-2 mt-2.5 py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(63,140,255,0.3)" }}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              Biriktirish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
