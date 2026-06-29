"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import LottiePlayer from "@/components/ui/LottiePlayer";
import {
  Plus, Target, TrendingUp, TrendingDown,
  CheckCircle2, FileText, Calendar,
  Eye, Download, Trash2, X, Clock,
} from "lucide-react";

type Report = {
  id: number;
  month: string;
  period: string;
  kpi: number;
  tasks_done: number;
  tasks_total: number;
  hours: number;
  status: "Tasdiqlangan" | "Ko'rib chiqilmoqda" | "Qaytarilgan";
  submitted: string;
  comment: string;
};

const initialReports: Report[] = [
  { id: 1, month: "Mart", period: "Mart 2026", kpi: 91, tasks_done: 24, tasks_total: 26, hours: 168, status: "Tasdiqlangan", submitted: "01 Apr 2026", comment: "Ajoyib ish, davom eting!" },
  { id: 2, month: "Aprel", period: "Aprel 2026", kpi: 87, tasks_done: 21, tasks_total: 25, hours: 160, status: "Ko'rib chiqilmoqda", submitted: "01 May 2026", comment: "" },
];

const months = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  Tasdiqlangan: "success",
  "Ko'rib chiqilmoqda": "warning",
  Qaytarilgan: "danger",
};

const monthColors: Record<string, { bg: string; color: string }> = {
  Yanvar:  { bg: "#E8F4FD", color: "#3F8CFF" },
  Fevral:  { bg: "#E8F4FD", color: "#3F8CFF" },
  Mart:    { bg: "#E8FDF4", color: "#00C48C" },
  Aprel:   { bg: "#FDF6E8", color: "#FFBD21" },
  May:     { bg: "#F0EDFD", color: "#6D5DD3" },
  Iyun:    { bg: "#E8FAFE", color: "#15C0E6" },
  Iyul:    { bg: "#FDE8E8", color: "#FF5C5C" },
  Avgust:  { bg: "#FDF0E8", color: "#FF8C42" },
  Sentabr: { bg: "#E8F4FD", color: "#3F8CFF" },
  Oktabr:  { bg: "#E8FDF4", color: "#00C48C" },
  Noyabr:  { bg: "#FDF6E8", color: "#FFBD21" },
  Dekabr:  { bg: "#F0EDFD", color: "#6D5DD3" },
};

export default function XodimKpiPage() {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ month: "May", kpi: "", tasks_done: "", tasks_total: "", hours: "", comment: "" });

  const isEmpty = reports.length === 0;
  const avgKpi = reports.length ? Math.round(reports.reduce((s, r) => s + r.kpi, 0) / reports.length) : 0;
  const confirmed = reports.filter((r) => r.status === "Tasdiqlangan").length;
  const totalHours = reports.reduce((s, r) => s + r.hours, 0);

  function handleAdd() {
    if (!form.month || !form.kpi) return;
    setReports([...reports, {
      id: Date.now(), month: form.month, period: `${form.month} 2026`,
      kpi: Number(form.kpi), tasks_done: Number(form.tasks_done) || 0,
      tasks_total: Number(form.tasks_total) || 0, hours: Number(form.hours) || 0,
      status: "Ko'rib chiqilmoqda", submitted: new Date().toLocaleDateString("uz-UZ"),
      comment: form.comment,
    }]);
    setShowModal(false);
    setForm({ month: "May", kpi: "", tasks_done: "", tasks_total: "", hours: "", comment: "" });
  }

  return (
    <div className="relative">
      <Header title="Mening KPI" subtitle="Oylik hisobotlar va ko'rsatkichlar" />

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "O'rtacha KPI", value: reports.length ? `${avgKpi}%` : "—", icon: Target, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)", trend: avgKpi >= 85 },
          { label: "Yuborilgan", value: reports.length, icon: FileText, color: "#6D5DD3", bg: "rgba(109,93,211,0.1)", trend: true },
          { label: "Tasdiqlangan", value: confirmed, icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)", trend: true },
          { label: "Jami soat", value: totalHours ? `${totalHours}h` : "—", icon: Clock, color: "#FFBD21", bg: "rgba(255,189,33,0.1)", trend: true },
        ].map((s) => (
          <div key={s.label} className="p-5 flex items-center gap-4"
            style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 20 }}>
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg, borderRadius: 13 }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight" style={{ color: "#0A1629" }}>{s.value}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>

        {/* Card toolbar */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "#0A1629" }}>Oylik hisobotlar</h2>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
              {reports.length ? `${reports.length} ta hisobot mavjud` : "Hali hisobot yuborilmagan"}
            </p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white"
            style={{ background: "#3F8CFF", borderRadius: 13, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
            <Plus size={17} />
            Hisobot qo'shish
          </button>
        </div>

        {/* ── EMPTY STATE ── */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-10">
            <LottiePlayer
              src="https://lottie.host/3a956e1e-c9e9-495b-94aa-d927a24d7db2/DdA43jJDGa.lottie"
              width={260}
              height={260}
            />
            <p className="font-bold text-lg mt-1" style={{ color: "#0A1629" }}>
              Hisobotlar mavjud emas
            </p>
            <p className="text-sm mt-1 mb-5" style={{ color: "#91929E" }}>
              Birinchi oylik hisobotingizni yuboring
            </p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-3 font-bold text-sm text-white"
              style={{ background: "#3F8CFF", borderRadius: 13, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
              <Plus size={17} />
              Hisobot qo'shish
            </button>
          </div>
        ) : (
          /* ── REPORT ROWS ── */
          <div className="px-6 py-4 flex flex-col gap-3">
            {reports.map((r) => {
              const mc = monthColors[r.month] ?? { bg: "rgba(63,140,255,0.1)", color: "#3F8CFF" };
              const kpiGood = r.kpi >= 85;
              return (
                <div key={r.id}
                  className="flex items-center gap-5 px-5 py-4 hover:shadow-md transition-shadow cursor-pointer"
                  style={{ background: "#FAFCFF", borderRadius: 18, border: "1.5px solid #EEF2FF" }}>

                  {/* Month badge */}
                  <div className="flex flex-col items-center justify-center w-14 h-14 flex-shrink-0"
                    style={{ background: mc.bg, borderRadius: 16 }}>
                    <Calendar size={18} style={{ color: mc.color }} />
                    <p className="text-xs font-bold mt-1" style={{ color: mc.color }}>
                      {r.month.slice(0, 3)}
                    </p>
                  </div>

                  {/* Month & period */}
                  <div className="w-32 flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{r.month}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{r.period}</p>
                  </div>

                  {/* KPI progress */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold" style={{ color: "#91929E" }}>KPI</span>
                      <span className="text-sm font-bold" style={{ color: kpiGood ? "#00C48C" : "#FFBD21" }}>
                        {r.kpi}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "#EEF2FF" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${r.kpi}%`, background: kpiGood ? "#00C48C" : r.kpi >= 75 ? "#FFBD21" : "#FF5C5C" }} />
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="flex-shrink-0 text-center w-20">
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                      {r.tasks_done}/{r.tasks_total}
                    </p>
                    <p className="text-xs" style={{ color: "#91929E" }}>Topshiriq</p>
                  </div>

                  {/* Hours */}
                  <div className="flex-shrink-0 text-center w-20">
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{r.hours}h</p>
                    <p className="text-xs" style={{ color: "#91929E" }}>Soat</p>
                  </div>

                  {/* Trend */}
                  <div className="flex-shrink-0 flex items-center gap-1 w-16">
                    {kpiGood
                      ? <TrendingUp size={15} style={{ color: "#00C48C" }} />
                      : <TrendingDown size={15} style={{ color: "#FF5C5C" }} />}
                    <span className="text-xs font-bold" style={{ color: kpiGood ? "#00C48C" : "#FF5C5C" }}>
                      {kpiGood ? "Yaxshi" : "Past"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0 w-36">
                    <Badge label={r.status} variant={statusVariant[r.status]} />
                    <p className="text-xs mt-1" style={{ color: "#91929E" }}>{r.submitted}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <button className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(63,140,255,0.1)", borderRadius: 9 }}>
                      <Eye size={14} style={{ color: "#3F8CFF" }} />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(0,196,140,0.1)", borderRadius: 9 }}>
                      <Download size={14} style={{ color: "#00C48C" }} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(255,92,92,0.1)", borderRadius: 9 }}>
                      <Trash2 size={14} style={{ color: "#FF5C5C" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom padding */}
        {!isEmpty && <div className="pb-2" />}
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(10,22,41,0.45)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-[460px] p-8 relative"
            style={{ background: "#FFFFFF", borderRadius: 28, boxShadow: "0px 30px 80px rgba(0,0,0,0.18)" }}>

            <button onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <X size={15} style={{ color: "#91929E" }} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center"
                style={{ background: "rgba(63,140,255,0.1)", borderRadius: 14 }}>
                <FileText size={22} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>Hisobot qo'shish</h3>
                <p className="text-xs" style={{ color: "#91929E" }}>Oylik KPI hisobotini to'ldiring</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>Oy</label>
                <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
                  className="w-full px-4 py-3 text-sm font-bold outline-none appearance-none"
                  style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629", border: "2px solid transparent" }}>
                  {months.map((m) => <option key={m} value={m}>{m} 2026</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>KPI foizi (%)</label>
                <input type="number" min={0} max={100} placeholder="85" value={form.kpi}
                  onChange={(e) => setForm({ ...form, kpi: e.target.value })}
                  className="w-full px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>Bajarilgan topshiriq</label>
                  <input type="number" placeholder="24" value={form.tasks_done}
                    onChange={(e) => setForm({ ...form, tasks_done: e.target.value })}
                    className="w-full px-4 py-3 text-sm font-bold outline-none"
                    style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>Jami topshiriq</label>
                  <input type="number" placeholder="26" value={form.tasks_total}
                    onChange={(e) => setForm({ ...form, tasks_total: e.target.value })}
                    className="w-full px-4 py-3 text-sm font-bold outline-none"
                    style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>Ishlagan soat</label>
                <input type="number" placeholder="168" value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  className="w-full px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }} />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>Izoh (ixtiyoriy)</label>
                <textarea rows={3} placeholder="Bu oy nima qildingiz..." value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="w-full px-4 py-3 text-sm outline-none resize-none"
                  style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 font-bold text-sm"
                style={{ background: "#F4F9FD", borderRadius: 14, color: "#7D8592" }}>
                Bekor qilish
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-3 font-bold text-sm text-white"
                style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
                Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleDelete(id: number) {
    setReports(reports.filter((r) => r.id !== id));
  }
}
