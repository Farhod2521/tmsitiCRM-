"use client";

import { useState, useEffect } from "react";
import { X, Upload, FileText, Loader2, Info, Trash2, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import RichTextEditor from "@/components/ui/RichTextEditor";

const MAX_FILE_MB = 10;
const MAX_FILES = 10;

interface WeeklyFile { id: number; file_name: string; uploaded_at: string | null; }

export default function WeeklyReportUploadModal({
  year, month, week, weekLabel, initialDescription, initialReportId, onClose, onSaved,
}: {
  year: number; month: number; week: number; weekLabel: string;
  initialDescription: string | null; initialReportId: number | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [description, setDescription] = useState(initialDescription || "");
  const [reportId, setReportId] = useState<number | null>(initialReportId && initialReportId > 0 ? initialReportId : null);
  const [files, setFiles] = useState<WeeklyFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    setFilesLoading(true);
    apiFetch<WeeklyFile[]>(`/reports/weekly/${reportId}/files`)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, [reportId]);

  async function ensureReportId(): Promise<number> {
    if (reportId) return reportId;
    const rep = await apiFetch<{ id: number }>("/reports/weekly", {
      method: "POST",
      body: JSON.stringify({ year, month, week, description }),
    });
    setReportId(rep.id);
    return rep.id;
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length === 0) return;

    if (files.length + picked.length > MAX_FILES) {
      setFileError(`Ko'pi bilan ${MAX_FILES} ta fayl biriktirish mumkin`);
      return;
    }
    const tooBig = picked.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setFileError(`"${tooBig.name}" hajmi ${MAX_FILE_MB}MB dan oshmasligi kerak`);
      return;
    }
    setFileError(null);
    setUploadingFile(true);
    try {
      const id = await ensureReportId();
      for (const f of picked) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        const saved = await apiFetch<WeeklyFile>(`/reports/weekly/${id}/files`, {
          method: "POST",
          body: JSON.stringify({ file_name: f.name, file_b64: b64 }),
        });
        setFiles(prev => [...prev, saved]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fayl yuklashda xato");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteFile(fileId: number) {
    if (!reportId) return;
    setDeletingFileId(fileId);
    try {
      await apiFetch(`/reports/weekly/${reportId}/files/${fileId}`, { method: "DELETE" });
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xato");
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handleDownloadFile(fileId: number, fileName: string) {
    if (!reportId) return;
    setDownloadingFileId(fileId);
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/reports/weekly/${reportId}/files/${fileId}/download`);
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name || fileName;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    } finally {
      setDownloadingFileId(null);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await ensureReportId();
      if (reportId) {
        await apiFetch("/reports/weekly", {
          method: "POST",
          body: JSON.stringify({ year, month, week, description }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Haftalik hisobot</h2>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{weekLabel}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70" style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Ish tavsifi</label>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Shu hafta bajarilgan ishlar haqida yozing..." />
          </div>

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>
              Qilgan ish fayllari {files.length > 0 && `(${files.length}/${MAX_FILES})`}
            </label>

            {filesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={18} className="animate-spin" style={{ color: "#3F8CFF" }} />
              </div>
            ) : files.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2.5 px-3 py-2.5"
                    style={{ background: "#FAFCFF", borderRadius: 10, border: "1px solid #F0F3F8" }}>
                    <FileText size={14} style={{ color: "#6D5DD3", flexShrink: 0 }} />
                    <span className="text-xs font-bold truncate flex-1" style={{ color: "#0A1629" }}>{f.file_name}</span>
                    <button onClick={() => handleDownloadFile(f.id, f.file_name)} disabled={downloadingFileId === f.id}
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0 hover:opacity-80 disabled:opacity-50"
                      style={{ background: "#FFFFFF", borderRadius: 7 }}>
                      {downloadingFileId === f.id ? <Loader2 size={12} className="animate-spin" style={{ color: "#3F8CFF" }} /> : <Download size={12} style={{ color: "#3F8CFF" }} />}
                    </button>
                    <button onClick={() => handleDeleteFile(f.id)} disabled={deletingFileId === f.id}
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0 hover:opacity-80 disabled:opacity-50"
                      style={{ background: "#FFFFFF", borderRadius: 7 }}>
                      {deletingFileId === f.id ? <Loader2 size={12} className="animate-spin" style={{ color: "#FF5C5C" }} /> : <Trash2 size={12} style={{ color: "#FF5C5C" }} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_FILES && (
              <label className="flex flex-col items-center justify-center gap-1.5 py-6 cursor-pointer"
                style={{ background: "rgba(63,140,255,0.06)", borderRadius: 12, border: "1.5px dashed rgba(63,140,255,0.3)" }}>
                {uploadingFile ? <Loader2 size={18} className="animate-spin" style={{ color: "#3F8CFF" }} /> : <Upload size={18} style={{ color: "#3F8CFF" }} />}
                <span className="text-xs font-bold" style={{ color: "#3F8CFF" }}>
                  {uploadingFile ? "Yuklanmoqda..." : "Fayl tanlash (bir nechtasini birga tanlash mumkin)"}
                </span>
                <input type="file" multiple className="hidden" disabled={uploadingFile}
                  accept=".pdf,.doc,.docx,.xlsx,.xls" onChange={handleFilePick} />
              </label>
            )}
            <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: fileError ? "#FF5C5C" : "#91929E" }}>
              <Info size={12} /> {fileError || `Ko'pi bilan ${MAX_FILES} ta fayl, har biri ${MAX_FILE_MB}MB dan oshmasligi kerak. Formatlar: PDF, DOC, DOCX, XLS, XLSX.`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #F4F9FD" }}>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ color: "#7D8592" }}>
            Bekor qilish
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0px 6px 12px rgba(63,140,255,0.3)" }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
