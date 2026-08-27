"use client";

import { useState, useEffect } from "react";
import { X, Loader2, FileText, Download, CheckCircle2, XCircle, History, ChevronDown, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { InternalDocDetail, STATUS_CFG, LOG_ACTION_LABEL, fmtDt, downloadBase64 } from "./types";
import InternalDocCreateModal from "./InternalDocCreateModal";

interface Employee { id: number; full_name: string; position: string; role: string; }

export default function InternalDocDetailModal({
  docId, onClose, onChanged, showBolimActions = false, showZamdirektorActions = false, allowResubmit = false,
}: {
  docId: number;
  onClose: () => void;
  onChanged: () => void;
  showBolimActions?: boolean;
  showZamdirektorActions?: boolean;
  allowResubmit?: boolean;
}) {
  const [doc, setDoc] = useState<InternalDocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [zamdirektorlar, setZamdirektorlar] = useState<Employee[]>([]);
  const [zamdirektorId, setZamdirektorId] = useState<number | "">("");
  const [izoh, setIzoh] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch<InternalDocDetail>(`/internal-docs/${docId}`)
      .then(setDoc)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [docId]); // eslint-disable-line

  useEffect(() => {
    if (!showBolimActions) return;
    apiFetch<Employee[]>("/employees/")
      .then(list => setZamdirektorlar(list.filter(e => e.role === "zamdirektor")))
      .catch(() => {});
  }, [showBolimActions]);

  async function handleDownload() {
    if (!doc?.fayl_name) return;
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(`/internal-docs/${docId}/file`);
      downloadBase64(d.file_name || doc.fayl_name, d.file_b64);
    } catch {
      alert("Faylni yuklab bo'lmadi");
    }
  }

  async function handleBolimApprove() {
    if (!zamdirektorId) { setError("Zamdirektorni tanlang"); return; }
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/internal-docs/${docId}/approve`, {
        method: "POST",
        body: JSON.stringify({ zamdirektor_id: zamdirektorId }),
      });
      onChanged();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(kind: "bolim" | "zamdirektor") {
    if (!izoh.trim()) { setError("Rad etish sababini yozing"); return; }
    setError(null);
    setSaving(true);
    try {
      const url = kind === "bolim" ? `/internal-docs/${docId}/reject` : `/internal-docs/${docId}/zamdirektor-reject`;
      await apiFetch(url, { method: "POST", body: JSON.stringify({ izoh: izoh.trim() }) });
      onChanged();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleZamdirektorApprove() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/internal-docs/${docId}/zamdirektor-approve`, { method: "POST" });
      onChanged();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  const canReviewNow = doc && (doc.status === "yuborildi" || doc.status === "oqilgan");
  const canZamReviewNow = doc && doc.status === "bolim_tasdiqladi";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: "#3F8CFF" }}>№ {doc?.hujjat_raqami || "..."}</p>
            <h2 className="font-bold text-lg truncate" style={{ color: "#0A1629" }}>{doc?.nomi || "Yuklanmoqda..."}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70 flex-shrink-0"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {loading || !doc ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1" style={{ background: STATUS_CFG[doc.status].bg, color: STATUS_CFG[doc.status].color, borderRadius: 8 }}>
                  {STATUS_CFG[doc.status].label}
                </span>
                {doc.department_nomi && <span className="text-xs" style={{ color: "#91929E" }}>Bo'lim: <b style={{ color: "#0A1629" }}>{doc.department_nomi}</b></span>}
                {doc.created_by_nomi && <span className="text-xs" style={{ color: "#91929E" }}>Yuklagan: <b style={{ color: "#0A1629" }}>{doc.created_by_nomi}</b></span>}
                {doc.zamdirektor_nomi && <span className="text-xs" style={{ color: "#91929E" }}>Zamdirektor: <b style={{ color: "#0A1629" }}>{doc.zamdirektor_nomi}</b></span>}
              </div>

              {doc.mazmun && (
                <div className="p-3.5" style={{ background: "#FAFCFF", borderRadius: 12, border: "1px solid #F0F4FB" }}>
                  <p className="text-sm" style={{ color: "#3D4557", whiteSpace: "pre-wrap" }}>{doc.mazmun}</p>
                </div>
              )}

              {doc.fayl_name && (
                <button onClick={handleDownload}
                  className="flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #EEF2FF" }}>
                  <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "#0A1629" }}>
                    <FileText size={15} style={{ color: "#3F8CFF" }} /> {doc.fayl_name}
                  </span>
                  <Download size={15} style={{ color: "#3F8CFF" }} />
                </button>
              )}

              {doc.status === "rad_etildi" && doc.rad_sababi && (
                <div className="p-3.5" style={{ background: "rgba(255,92,92,0.06)", border: "1px solid rgba(255,92,92,0.15)", borderRadius: 12 }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "#FF5C5C" }}>Rad etish sababi:</p>
                  <p className="text-sm" style={{ color: "#0A1629" }}>{doc.rad_sababi}</p>
                </div>
              )}

              {/* Tarix */}
              {doc.log.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2 uppercase tracking-wide flex items-center gap-1.5" style={{ color: "#91929E" }}>
                    <History size={13} /> Jarayon tarixi
                  </p>
                  <div className="flex flex-col gap-2">
                    {doc.log.slice().reverse().map(l => (
                      <div key={l.id} className="px-3 py-2" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                        <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{LOG_ACTION_LABEL[l.action] || l.action}</p>
                        {l.izoh && <p className="text-sm mt-0.5" style={{ color: "#3D4557" }}>&ldquo;{l.izoh}&rdquo;</p>}
                        <p className="text-xs mt-1" style={{ color: "#91929E" }}>
                          {l.actor_nomi}{l.created_at && ` — ${fmtDt(l.created_at)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qayta yuborish */}
              {allowResubmit && doc.status === "rad_etildi" && (
                <button onClick={() => setResubmitOpen(true)}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-white"
                  style={{ background: "#3F8CFF", borderRadius: 12 }}>
                  <RefreshCw size={14} /> Qayta yuborish
                </button>
              )}

              {/* Bo'lim boshlig'i harakatlari */}
              {showBolimActions && canReviewNow && (
                <div className="p-4 flex flex-col gap-3" style={{ background: "#F4F9FD", borderRadius: 14 }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#91929E" }}>Qaror</p>
                  <div className="relative">
                    <select value={zamdirektorId} onChange={e => setZamdirektorId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                      style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: zamdirektorId ? "#0A1629" : "#91929E" }}>
                      <option value="">Zamdirektorni tanlang (tasdiqlash uchun)...</option>
                      {zamdirektorlar.map(z => (
                        <option key={z.id} value={z.id}>{z.full_name}{z.position ? ` (${z.position})` : ""}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
                  </div>
                  <textarea value={izoh} onChange={e => setIzoh(e.target.value)}
                    placeholder="Izoh (rad etganda majburiy)..."
                    rows={2} className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                  <div className="flex gap-2">
                    <button onClick={handleBolimApprove} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "#00C48C", borderRadius: 10 }}>
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Tasdiqlash
                    </button>
                    <button onClick={() => handleReject("bolim")} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold disabled:opacity-50"
                      style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 10 }}>
                      <XCircle size={13} /> Rad etish
                    </button>
                  </div>
                </div>
              )}

              {/* Zamdirektor harakatlari */}
              {showZamdirektorActions && canZamReviewNow && (
                <div className="p-4 flex flex-col gap-3" style={{ background: "#F4F9FD", borderRadius: 14 }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#91929E" }}>Qaror</p>
                  <textarea value={izoh} onChange={e => setIzoh(e.target.value)}
                    placeholder="Izoh (rad etganda majburiy)..."
                    rows={2} className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                  <div className="flex gap-2">
                    <button onClick={handleZamdirektorApprove} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "#00C48C", borderRadius: 10 }}>
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Tasdiqlash
                    </button>
                    <button onClick={() => handleReject("zamdirektor")} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold disabled:opacity-50"
                      style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 10 }}>
                      <XCircle size={13} /> Rad etish
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-xs font-bold" style={{ color: "#FF5C5C" }}>{error}</p>}
            </>
          )}
        </div>
      </div>

      {resubmitOpen && doc && (
        <div onClick={e => e.stopPropagation()}>
          <InternalDocCreateModal
            showZamdirektor={false}
            parentDoc={doc}
            onClose={() => setResubmitOpen(false)}
            onCreated={() => { onChanged(); onClose(); }}
          />
        </div>
      )}
    </div>
  );
}
