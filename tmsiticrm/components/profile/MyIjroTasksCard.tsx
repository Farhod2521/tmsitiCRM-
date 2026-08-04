"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Clock, Loader2, ChevronDown, ChevronUp, History, Paperclip, X, CheckCircle2, FileText, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

type BolimHolati = "yuborildi" | "qabul_qilindi" | "rad_etildi" | "bajarilmoqda" | "tasdiq_kutilmoqda" | "bajarildi";

interface AssignLogEntry {
  id: number;
  xodim_nomi: string | null;
  assigned_by_nomi: string | null;
  assigned_at: string | null;
}

export interface YakunlashFayl { name: string; b64: string; }

export interface MyTask {
  id: number;
  doc_id: number | null;
  holati: BolimHolati;
  xodim_assigned_at: string | null;
  assign_log: AssignLogEntry[];
  yakunlash_izohi: string | null;
  yakunlash_fayllar: YakunlashFayl[];
  yakunlangan_at: string | null;
  yakunlagan_by_nomi: string | null;
  doc_sarlavha: string | null;
  doc_mazmun: string | null;
  doc_qoshimcha_malumot: string | null;
  doc_manba: string | null;
  doc_hujjat_raqami: string | null;
  doc_ijro_muddati: string | null;
}

function downloadBase64(name: string, b64: string) {
  const a = document.createElement("a");
  a.href = b64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const HOLATI_LABEL: Record<BolimHolati, { label: string; color: string; bg: string }> = {
  yuborildi:         { label: "Yuborildi",               color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  qabul_qilindi:     { label: "Qabul qilindi",            color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  rad_etildi:        { label: "Rad etildi",               color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  bajarilmoqda:      { label: "Bajarilmoqda",              color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
  tasdiq_kutilmoqda: { label: "Tasdiqlanishi kutilmoqda",  color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
  bajarildi:         { label: "Bajarildi",                 color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
};

const MANBA_LABELS: Record<string, string> = {
  pq_pf: "Prezident Hujjatlari", vm: "Vazirlar Mahkamasi", qv: "Vazirlik (QV)", direktor: "Institut direktori",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function daysLeft(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)} kun o'tgan`, color: "#FF5C5C" };
  if (diff === 0) return { text: "Bugun",              color: "#FF5C5C" };
  if (diff <= 3)  return { text: `${diff} kun qoldi`,  color: "#FFBD21" };
  return           { text: `${diff} kun qoldi`,        color: "#00C48C" };
}

export function TaskRow({ task, onChanged }: { task: MyTask; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [izoh, setIzoh] = useState("");
  const [fayllar, setFayllar] = useState<YakunlashFayl[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = HOLATI_LABEL[task.holati];
  const dl  = daysLeft(task.doc_ijro_muddati);
  const canFinish = task.holati === "qabul_qilindi" || task.holati === "bajarilmoqda";

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const encoded = await Promise.all(files.map(async f => ({ name: f.name, b64: await fileToBase64(f) })));
    setFayllar(p => [...p, ...encoded]);
    e.target.value = "";
  }

  async function handleFinish() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/ijro-docs/bolim-inbox/${task.id}/yakunlash`, {
        method: "POST",
        body: JSON.stringify({ izoh: izoh || null, fayllar }),
      });
      setIzoh("");
      setFayllar([]);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: "#3F8CFF" }}>
            № {task.doc_hujjat_raqami || `DOC-${task.doc_id}`}
          </p>
          <p className="text-sm font-bold mt-0.5" style={{ color: "#0A1629" }}>
            {task.doc_sarlavha || "—"}
          </p>
          {task.doc_manba && (
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{MANBA_LABELS[task.doc_manba] || task.doc_manba}</p>
          )}
        </div>
        <span className="text-xs font-bold px-2.5 py-1 whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color, borderRadius: 8 }}>
          {cfg.label}
        </span>
      </div>

      {task.doc_mazmun && (
        <p className="text-sm mt-2.5" style={{ color: "#3D4557" }}>{task.doc_mazmun}</p>
      )}
      {task.doc_qoshimcha_malumot && (
        <p className="text-xs mt-1.5" style={{ color: "#91929E" }}>{task.doc_qoshimcha_malumot}</p>
      )}

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {dl && (
          <span className="text-xs font-bold flex items-center gap-1" style={{ color: dl.color }}>
            <Clock size={11} /> {dl.text}
          </span>
        )}
        <span className="text-xs" style={{ color: "#91929E" }}>
          Sizga biriktirilgan: {fmt(task.xodim_assigned_at)}
        </span>
        {task.assign_log.length > 0 && (
          <button onClick={() => setOpen(v => !v)}
            className="text-xs font-bold flex items-center gap-1 ml-auto" style={{ color: "#7D8592" }}>
            <History size={11} /> Tarix {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {open && task.assign_log.length > 0 && (
        <div className="mt-2.5 pt-2.5 flex flex-col gap-1" style={{ borderTop: "1px solid #E8EDF5" }}>
          {task.assign_log.slice().reverse().map(log => (
            <p key={log.id} className="text-xs" style={{ color: "#7D8592" }}>
              <b style={{ color: "#0A1629" }}>{log.xodim_nomi}</b>ga biriktirildi
              {log.assigned_by_nomi && ` — ${log.assigned_by_nomi} tomonidan`}
              {log.assigned_at && `, ${fmt(log.assigned_at)}`}
            </p>
          ))}
        </div>
      )}

      {/* Topshiriqni yakunlash */}
      {canFinish && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E8EDF5" }}>
          <textarea
            value={izoh} onChange={e => setIzoh(e.target.value)}
            placeholder="Bajarilgan ish haqida izoh yozing..."
            rows={2} className="w-full px-3 py-2 text-sm outline-none resize-none"
            style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }}
          />
          <label className="mt-2 flex items-center justify-center gap-2 py-2 text-xs font-bold cursor-pointer"
            style={{ background: "#FFFFFF", border: "1.5px dashed #D0D9E8", borderRadius: 10, color: "#3F8CFF" }}>
            <Paperclip size={13} /> Fayl biriktirish
            <input type="file" multiple className="hidden" onChange={handleFilesPicked} />
          </label>
          {fayllar.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              {fayllar.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5"
                  style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #EEF2FF" }}>
                  <span className="text-xs font-bold truncate" style={{ color: "#0A1629" }}>{f.name}</span>
                  <button onClick={() => setFayllar(p => p.filter((_, idx) => idx !== i))}
                    className="w-5 h-5 flex items-center justify-center flex-shrink-0 hover:opacity-70">
                    <X size={11} style={{ color: "#FF5C5C" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleFinish} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#00C48C", borderRadius: 10 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Bajarildi deb belgilash
          </button>
          {error && <p className="text-xs font-bold mt-1.5" style={{ color: "#FF5C5C" }}>{error}</p>}
        </div>
      )}

      {/* Yakunlangan/tasdiq kutilayotgan — izoh va fayllar */}
      {(task.holati === "tasdiq_kutilmoqda" || task.holati === "bajarildi") && (task.yakunlash_izohi || task.yakunlash_fayllar.length > 0) && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E8EDF5" }}>
          <p className="text-xs font-bold mb-1.5" style={{ color: task.holati === "bajarildi" ? "#00A578" : "#6D5DD3" }}>
            {task.holati === "bajarildi" ? "Yakunlash hisoboti:" : "Yuborildi — IJRO tasdig'ini kutmoqda:"}
          </p>
          {task.yakunlash_izohi && (
            <p className="text-sm mb-1.5" style={{ color: "#0A1629" }}>{task.yakunlash_izohi}</p>
          )}
          {task.yakunlash_fayllar.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {task.yakunlash_fayllar.map((f, i) => (
                <button key={i} onClick={() => downloadBase64(f.name, f.b64)}
                  className="flex items-center justify-between px-3 py-2 hover:opacity-80"
                  style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #D6F0E8" }}>
                  <span className="flex items-center gap-2 text-xs font-bold truncate" style={{ color: "#0A1629" }}>
                    <FileText size={13} style={{ color: "#00A578" }} /> {f.name}
                  </span>
                  <Download size={13} style={{ color: "#00A578" }} />
                </button>
              ))}
            </div>
          )}
          {(task.yakunlagan_by_nomi || task.yakunlangan_at) && (
            <p className="text-xs mt-1.5" style={{ color: "#91929E" }}>
              {task.yakunlagan_by_nomi && `${task.yakunlagan_by_nomi} tomonidan`}
              {task.yakunlangan_at && `, ${fmt(task.yakunlangan_at)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyIjroTasksCard() {
  const [tasks,   setTasks]   = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch<MyTask[]>("/ijro-docs/my-tasks")
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loading && tasks.length === 0) return null;

  return (
    <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
          <ClipboardCheck size={20} style={{ color: "#3F8CFF" }} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Ijro nazorati</h3>
          <p className="text-xs" style={{ color: "#91929E" }}>Sizga biriktirilgan topshiriqlar</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map(t => <TaskRow key={t.id} task={t} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}
