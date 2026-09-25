"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { X, Loader2, Trash2, Plus, History } from "lucide-react";

interface StatusPeriod {
  id: number;
  status: string;
  date_from: string;
  date_to: string;
  source: "kadr" | "tabel" | "joriy";
}

// Tabelda muddat bilan belgilanadigan holatlar (kod — tabeldagi belgi)
const PERIOD_STATUS: Record<string, { label: string; code: string; color: string; bg: string }> = {
  otpuska:             { label: "Mehnat ta'tili",   code: "MT", color: "#B4780C", bg: "rgba(255,189,33,0.15)" },
  mehnatga_layoqatsiz: { label: "Bolnichniy",       code: "B",  color: "#FF5C5C", bg: "rgba(255,92,92,0.12)" },
  xizmat_safarida:     { label: "Xizmat safari",    code: "K",  color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
  oquv_tatilida:       { label: "O'quv ta'tili",    code: "O'", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
};

const SOURCE_LABEL: Record<StatusPeriod["source"], string> = {
  kadr:  "Kadr belgilagan",
  tabel: "Eski tabeldan tiklangan",
  joriy: "Holat menyusidan",
};

function fmtUz(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

export default function StatusHistoryModal({ empId, empName, onClose }: {
  empId: number;
  empName: string;
  onClose: () => void;
}) {
  const [periods, setPeriods] = useState<StatusPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("otpuska");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await apiFetch<StatusPeriod[]>(`/employees/${empId}/status-periods`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!dateFrom || !dateTo) { setError("Sanadan va sanagacha kiriting"); return; }
    if (dateTo < dateFrom) { setError("Sanagacha sanadan oldin bo'lishi mumkin emas"); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch(`/employees/${empId}/status-periods`, {
        method: "POST",
        body: JSON.stringify({ status, date_from: dateFrom, date_to: dateTo }),
      });
      setDateFrom(""); setDateTo("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: StatusPeriod) {
    const cfg = PERIOD_STATUS[p.status];
    if (!confirm(`${cfg?.label ?? p.status}: ${fmtUz(p.date_from)} — ${fmtUz(p.date_to)} davrini o'chirasizmi? Tabeldan ham olib tashlanadi.`)) return;
    try {
      await apiFetch(`/employees/${empId}/status-periods/${p.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    }
  }

  const inputStyle = { background: "#F4F9FD", borderRadius: 10, border: "1px solid #D9E3F0", color: "#0A1629" };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(255,140,66,0.12)", borderRadius: 12 }}>
              <History size={18} style={{ color: "#FF8C42" }} />
            </div>
            <div>
              <p className="font-bold" style={{ color: "#0A1629" }}>Holat tarixi</p>
              <p className="text-xs" style={{ color: "#91929E" }}>{empName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#91929E" }}>
            Bu davrlar tabelda saqlanib qoladi — ta&apos;til yoki bolnichniy tugab xodim ishga qaytgach ham
            o&apos;tgan kunlar <b>MT / B / K / O&apos;</b> bo&apos;lib turadi. O&apos;chib ketgan eski davrni shu yerdan qayta qo&apos;shing.
          </p>

          {/* Yangi davr qo'shish */}
          <div className="p-3 mb-4" style={{ background: "#FAFCFF", border: "1px solid #F0F3F8", borderRadius: 14 }}>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PERIOD_STATUS).map(([k, cfg]) => (
                <button key={k} onClick={() => setStatus(k)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-left transition-all"
                  style={{
                    borderRadius: 10,
                    background: status === k ? cfg.bg : "#FFFFFF",
                    border: `1px solid ${status === k ? cfg.color : "#EEF2FF"}`,
                    color: status === k ? cfg.color : "#7D8592",
                  }}>
                  <span className="inline-flex items-center justify-center text-[9px] font-bold" style={{ minWidth: 20, height: 16, borderRadius: 4, color: cfg.color, background: cfg.bg }}>{cfg.code}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: "#91929E" }}>Sanadan</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2.5 py-2 text-xs font-bold outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: "#91929E" }}>Sanagacha</label>
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="w-full px-2.5 py-2 text-xs font-bold outline-none" style={inputStyle} />
              </div>
            </div>
            {error && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{error}</p>}
            <button onClick={add} disabled={saving}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              style={{ background: "#FF8C42", borderRadius: 10 }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
              Tarixga qo&apos;shish
            </button>
          </div>

          {/* Ro'yxat */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
          ) : periods.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "#91929E" }}>Hali davr yo&apos;q</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {periods.map(p => {
                const cfg = PERIOD_STATUS[p.status] ?? { label: p.status, code: "?", color: "#7D8592", bg: "#F4F9FD" };
                return (
                  <li key={p.id} className="flex items-center gap-3 p-3" style={{ background: "#FFFFFF", border: "1px solid #F0F3F8", borderRadius: 12 }}>
                    <span className="inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ width: 30, height: 24, borderRadius: 6, color: cfg.color, background: cfg.bg }}>{cfg.code}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "#0A1629" }}>{cfg.label}</p>
                      <p className="text-[11px]" style={{ color: "#7D8592" }}>
                        {fmtUz(p.date_from)} — {fmtUz(p.date_to)} · <span style={{ color: "#A8B0BD" }}>{SOURCE_LABEL[p.source] ?? p.source}</span>
                      </p>
                    </div>
                    <button onClick={() => remove(p)} title="O'chirish" className="w-8 h-8 flex items-center justify-center flex-shrink-0 hover:bg-[#FFF1F1] rounded-lg transition-colors">
                      <Trash2 size={14} style={{ color: "#FF5C5C" }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
