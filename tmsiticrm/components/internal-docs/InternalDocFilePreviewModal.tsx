"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, FileText, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { downloadBase64 } from "./types";

export default function InternalDocFilePreviewModal({
  docId, fileName, onClose,
}: {
  docId: number;
  fileName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"docx" | "pdf" | "other" | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await apiFetch<{ file_name: string; file_b64: string }>(`/internal-docs/${docId}/file`);
        if (cancelled) return;
        setFileB64(d.file_b64);
        const ext = (d.file_name || fileName).split(".").pop()?.toLowerCase() || "";
        const commaIdx = d.file_b64.indexOf(",");
        const base64 = commaIdx >= 0 ? d.file_b64.slice(commaIdx + 1) : d.file_b64;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        if (ext === "docx") {
          setKind("docx");
          const { renderAsync } = await import("docx-preview");
          if (containerRef.current && !cancelled) {
            containerRef.current.innerHTML = "";
            await renderAsync(new Blob([bytes]), containerRef.current, undefined, {
              className: "docx-render", inWrapper: true,
            });
          }
        } else if (ext === "pdf") {
          setKind("pdf");
          setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
        } else {
          setKind("other");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Faylni ko'rib bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  function handleDownload() {
    if (fileB64) downloadBase64(fileName, fileB64);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.6)" }}
      onClick={onClose}>
      <div className="relative flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, width: "100%", maxWidth: 880, height: "85vh", boxShadow: "0px 20px 60px rgba(10,22,41,0.3)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(109,93,211,0.1)", borderRadius: 10 }}>
              <FileText size={16} style={{ color: "#6D5DD3" }} />
            </div>
            <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>{fileName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleDownload} disabled={!fileB64}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ background: "rgba(0,196,140,0.1)", borderRadius: 10, color: "#00A578" }}>
              <Download size={12} /> Yuklab olish
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors" style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <X size={15} style={{ color: "#91929E" }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto" style={{ background: "#F8FAFF" }}>
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={26} className="animate-spin" style={{ color: "#6D5DD3" }} />
              <span className="ml-2 text-sm font-bold" style={{ color: "#6D5DD3" }}>Hujjat yuklanmoqda…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <FileText size={36} style={{ color: "#D9E3F0" }} />
              <p className="font-bold mt-3 text-sm" style={{ color: "#0A1629" }}>Faylni ko'rib bo'lmadi</p>
              <p className="text-xs mt-1" style={{ color: "#91929E" }}>{error}</p>
            </div>
          )}

          {!loading && !error && kind === "other" && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <FileText size={36} style={{ color: "#D9E3F0" }} />
              <p className="font-bold mt-3 text-sm" style={{ color: "#0A1629" }}>Bu format brauzerda ko'rsatilmaydi</p>
              <p className="text-xs mt-1" style={{ color: "#91929E" }}>Faylni ko'rish uchun yuklab oling</p>
              <button onClick={handleDownload}
                className="mt-4 flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold"
                style={{ background: "#6D5DD3", color: "#FFFFFF", borderRadius: 12 }}>
                <Download size={14} /> Yuklab olish
              </button>
            </div>
          )}

          {!loading && !error && kind === "pdf" && pdfUrl && (
            <iframe src={pdfUrl} className="w-full h-full" style={{ border: "none" }} />
          )}

          <div ref={containerRef} style={{ display: kind === "docx" && !loading && !error ? "block" : "none", padding: 24 }} />
        </div>
      </div>
    </div>
  );
}
