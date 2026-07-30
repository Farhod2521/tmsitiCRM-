"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck, Clock, Loader2, ChevronDown, ChevronUp, History } from "lucide-react";
import { apiFetch } from "@/lib/api";

type BolimHolati = "yuborildi" | "qabul_qilindi" | "rad_etildi" | "bajarilmoqda" | "bajarildi";

interface AssignLogEntry {
  id: number;
  xodim_nomi: string | null;
  assigned_by_nomi: string | null;
  assigned_at: string | null;
}

interface MyTask {
  id: number;
  doc_id: number | null;
  holati: BolimHolati;
  xodim_assigned_at: string | null;
  assign_log: AssignLogEntry[];
  doc_sarlavha: string | null;
  doc_manba: string | null;
  doc_hujjat_raqami: string | null;
  doc_ijro_muddati: string | null;
}

const HOLATI_LABEL: Record<BolimHolati, { label: string; color: string; bg: string }> = {
  yuborildi:     { label: "Yuborildi",     color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  qabul_qilindi: { label: "Qabul qilindi", color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  rad_etildi:    { label: "Rad etildi",    color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  bajarilmoqda:  { label: "Bajarilmoqda",  color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
  bajarildi:     { label: "Bajarildi",     color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
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

function TaskRow({ task }: { task: MyTask }) {
  const [open, setOpen] = useState(false);
  const cfg = HOLATI_LABEL[task.holati];
  const dl  = daysLeft(task.doc_ijro_muddati);

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
    </div>
  );
}

export default function MyIjroTasksCard() {
  const [tasks,   setTasks]   = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<MyTask[]>("/ijro-docs/my-tasks")
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  );
}
