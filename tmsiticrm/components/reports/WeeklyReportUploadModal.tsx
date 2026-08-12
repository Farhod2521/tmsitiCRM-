"use client";

import { useState } from "react";
import { X, Upload, FileText, Loader2, Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import RichTextEditor from "@/components/ui/RichTextEditor";

const MAX_FILE_MB = 10;

export default function WeeklyReportUploadModal({
  year, month, week, weekLabel, initialDescription, initialFileName, onClose, onSaved,
}: {
  year: number; month: number; week: number; weekLabel: string;
  initialDescription: string | null; initialFileName: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [description, setDescription] = useState(initialDescription || "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`Fayl hajmi ${MAX_FILE_MB}MB dan oshmasligi kerak`);
      return;
    }
    setFileError(null);
    setFile(f);
  }

  async function handleSubmit() {
    if (!file && !initialFileName) {
      setFileError("Iltimos, fayl yuklang");
      return;
    }
    setSaving(true);
    try {
      let file_name: string | undefined;
      let file_b64: string | undefined;
      if (file) {
        file_name = file.name;
        file_b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await apiFetch("/reports/weekly", {
        method: "POST",
        body: JSON.stringify({ year, month, week, description, file_name, file_b64 }),
      });
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
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hisobot fayli</label>
            <label className="flex flex-col items-center justify-center gap-1.5 py-6 cursor-pointer"
              style={{ background: "rgba(63,140,255,0.06)", borderRadius: 12, border: "1.5px dashed rgba(63,140,255,0.3)" }}>
              <Upload size={18} style={{ color: "#3F8CFF" }} />
              <span className="text-xs font-bold" style={{ color: "#3F8CFF" }}>
                {file ? file.name : initialFileName || "Fayl tanlash"}
              </span>
              {(file || initialFileName) && !fileError && (
                <span className="text-[11px]" style={{ color: "#91929E" }}>{file ? "Yangi fayl tanlandi" : "Mavjud fayl — o'zgartirish uchun qayta tanlang"}</span>
              )}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xlsx,.xls" onChange={handleFilePick} />
            </label>
            <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: fileError ? "#FF5C5C" : "#91929E" }}>
              <Info size={12} /> {fileError || `Ruxsat etilgan formatlar: PDF, DOC, DOCX, XLS, XLSX. Maksimal hajm: ${MAX_FILE_MB}MB.`}
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
