"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  FileText, CheckCircle2, Clock, AlertCircle, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronRight as Arrow, LayoutGrid, List, Plus, MoreHorizontal, Loader2, ArrowRight, CalendarClock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import IjroHero, { HeroStat } from "@/components/ijro/IjroHero";
import { getUser } from "@/lib/auth";
import type { IjroDoc, Department, BolimInfo } from "@/components/ijro/IjroNazorat";

/** IjroNazorat modulidagi tayyor modal va yordamchilar (aylanma importsiz uzatiladi). */
export interface IjroKit {
  deptIcon: (name: string, deptType: string) => LucideIcon;
  docAggHolati: (d: IjroDoc) => string;
  DeptTasksModal: (p: { dept: Department; docs: IjroDoc[]; depts: Department[]; onClose: () => void }) => React.ReactNode;
  YangiHujjatModal: (p: { depts: Department[]; onClose: () => void; onSaved: () => void; editDoc?: IjroDoc }) => React.ReactNode;
  IjroTrackingModal: (p: { docId: number; depts: Department[]; onClose: () => void }) => React.ReactNode;
}

const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 20, boxShadow: "0 6px 30px rgba(196,203,214,0.18)" };
const C = { blue: "#3F8CFF", green: "#00C48C", amber: "#FFBD21", red: "#FF5C5C", ink: "#0A1629", muted: "#91929E", soft: "#7D8592" };
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const WD = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

// Bo'lim kartochkasi ikonkasi uchun barqaror (id bo'yicha) rang
const DEPT_TINTS = ["#3F8CFF", "#15C0E6", "#6D5DD3", "#00A578", "#FF8C42", "#E0457B", "#2D6BE0", "#B4780C"];

/* ── sana yordamchilari ── */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
}
function fmtDay(s: string) { const [y, m, d] = s.slice(0, 10).split("-"); return `${d}.${m}.${y}`; }
function infoOf(d: IjroDoc): BolimInfo[] {
  try { return JSON.parse(d.masul_bolimlar_info || "[]"); } catch { return []; }
}

type Status = "done" | "overdue" | "soon" | "progress";
const STATUS_CFG: Record<Status, { label: string; color: string; bg: string }> = {
  done:     { label: "Bajarildi",      color: "#00A578", bg: "rgba(0,196,140,0.12)" },
  overdue:  { label: "Muddati o'tgan", color: "#E5484D", bg: "rgba(255,92,92,0.12)" },
  soon:     { label: "Muddati yaqin",  color: "#B4780C", bg: "rgba(255,189,33,0.16)" },
  progress: { label: "Bajarilmoqda",   color: "#2D6BE0", bg: "rgba(63,140,255,0.12)" },
};

function StatusChip({ s }: { s: Status }) {
  const c = STATUS_CFG[s];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap" style={{ background: c.bg, color: c.color, borderRadius: 8 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />{c.label}
    </span>
  );
}

/* ── O'tgan oyga nisbatan o'zgarish (banner statistikasi uchun) ── */
function Delta({ series, upIsBad }: { series: number[]; upIsBad?: boolean }) {
  const cur = series[series.length - 1] ?? 0, prev = series[series.length - 2] ?? 0;
  const pct = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return null;
  const good = (pct > 0) !== !!upIsBad;
  const DIcon = pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10.5px] font-bold" title="O'tgan oyga nisbatan"
      style={{ background: good ? "rgba(18,183,106,0.25)" : "rgba(240,68,56,0.28)", color: good ? "#A6F4C5" : "#FECDCA", borderRadius: 6 }}>
      <DIcon size={10} strokeWidth={3} />{pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

/* ── Kichik kalendar ── */
function MiniCalendar({ marks, selected, onSelect }: {
  marks: Map<string, "overdue" | "due">; selected: string; onSelect: (d: string) => void;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = ymd(new Date());
  const first = (cursor.getDay() + 6) % 7;                    // dushanbadan boshlanadi
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - first + 1)),
    ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(new Date(cursor.getFullYear(), cursor.getMonth() + 1, cells.length - first - days + 1));

  return (
    <div className="p-5" style={CARD}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Oldingi oy"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronLeft size={16} style={{ color: C.ink }} /></button>
        <p className="font-bold text-[15px]" style={{ color: C.ink }}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Keyingi oy"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F9FD]"><ChevronRight size={16} style={{ color: C.ink }} /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WD.map((w, i) => <span key={w} className="text-[11px] font-bold py-1" style={{ color: i >= 5 ? "#FF8C8C" : C.muted }}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = ymd(d), inMonth = d.getMonth() === cursor.getMonth();
          const isToday = k === today, isSel = k === selected && !isToday, mark = marks.get(k);
          return (
            <button key={i} onClick={() => onSelect(k)}
              className="relative mx-auto w-9 h-9 flex items-center justify-center text-[13px] font-semibold transition-colors hover:bg-[#F4F9FD]"
              style={{
                borderRadius: 10,
                background: isToday ? C.blue : undefined,
                color: isToday ? "#FFFFFF" : inMonth ? C.ink : "#C9D2E0",
                boxShadow: isSel ? `inset 0 0 0 2px ${C.blue}` : isToday ? "0 6px 14px rgba(63,140,255,0.35)" : undefined,
              }}
              title={mark ? (mark === "overdue" ? "Muddati o'tgan topshiriq bor" : "Shu kuni muddat") : undefined}>
              {d.getDate()}
              {mark && <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: isToday ? "#FFFFFF" : mark === "overdue" ? C.red : C.blue }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Hujjatlar dinamikasi: oylar bo'yicha guruhlangan ustunlar (Jami / Bajarilgan / Muddati o'tgan) ── */
function DynamicsChart({ docs, isDone }: { docs: IjroDoc[]; isDone: (d: IjroDoc) => boolean }) {
  const [n, setN] = useState(6);
  const [hover, setHover] = useState<number | null>(null);
  const keys = lastMonths(n);
  const rows = keys.map(k => {
    const inM = docs.filter(d => (d.created_at || "").slice(0, 7) === k);
    return {
      k, jami: inM.length,
      bajarilgan: inM.filter(isDone).length,
      otgan: inM.filter(d => !isDone(d) && (daysUntil(d.ijro_muddati) ?? 0) < 0).length,
    };
  });
  const rawMax = Math.max(1, ...rows.map(r => r.jami));
  const step = rawMax <= 4 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 50 ? 10 : Math.ceil(rawMax / 5 / 10) * 10;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => max - i * step);
  const SERIES = [
    { key: "jami" as const, label: "Jami", color: C.blue },
    { key: "bajarilgan" as const, label: "Bajarilgan", color: C.green },
    { key: "otgan" as const, label: "Muddati o'tgan", color: C.red },
  ];
  const H = 150;

  return (
    <div className="p-5" style={CARD}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-bold text-[15px]" style={{ color: C.ink }}>Hujjatlar dinamikasi</p>
        <select value={n} onChange={e => setN(Number(e.target.value))} aria-label="Davr"
          className="text-xs font-semibold px-2.5 py-1.5 outline-none cursor-pointer" style={{ border: "1px solid #E3ECFB", borderRadius: 10, color: C.soft, background: "#FFFFFF" }}>
          <option value={6}>Oxirgi 6 oy</option>
          <option value={12}>Oxirgi 12 oy</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {SERIES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.soft }}>
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {/* Y o'qi */}
        <div className="flex flex-col justify-between text-[10px] text-right" style={{ height: H, color: C.muted, minWidth: 16 }}>
          {ticks.map(t => <span key={t} className="leading-none">{t}</span>)}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t, i) => (
            <div key={t} className="absolute left-0 right-0" style={{ top: `${(i / (ticks.length - 1)) * 100}%`, borderTop: `1px ${t === 0 ? "solid" : "dashed"} ${t === 0 ? "#E3ECFB" : "#F0F3F8"}` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {rows.map((r, i) => (
              <div key={r.k} className="relative h-full flex items-end justify-center gap-[2px] flex-1 cursor-default"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{ background: hover === i ? "rgba(63,140,255,0.05)" : undefined, borderRadius: 6 }}>
                {SERIES.map(s => (
                  <span key={s.key} style={{
                    width: n > 6 ? 4 : 7, height: `${(r[s.key] / max) * 100}%`, minHeight: r[s.key] ? 3 : 0,
                    background: s.color, borderRadius: "3px 3px 0 0",
                  }} />
                ))}
                {hover === i && (
                  <div className="absolute z-10 bottom-full mb-1 px-3 py-2 text-[11px] whitespace-nowrap pointer-events-none"
                    style={{ background: "#FFFFFF", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,22,41,0.16)", left: "50%", transform: "translateX(-50%)" }}>
                    <p className="font-bold mb-1" style={{ color: C.ink }}>{MONTHS[Number(r.k.slice(5)) - 1]} {r.k.slice(0, 4)}</p>
                    {SERIES.map(s => (
                      <p key={s.key} className="flex items-center gap-1.5" style={{ color: C.soft }}>
                        <span className="w-2 h-2 rounded-[2px]" style={{ background: s.color }} />{s.label}: <b style={{ color: C.ink }}>{r[s.key]}</b>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-around mt-1.5" style={{ marginLeft: 24 }}>
        {rows.map(r => <span key={r.k} className="flex-1 text-center text-[10px] font-semibold" style={{ color: C.muted }}>{MONTHS_SHORT[Number(r.k.slice(5)) - 1]}</span>)}
      </div>
    </div>
  );
}

type DeptFilter = "barcha" | "faol" | "yaqin" | "otgan";

/** Ijro roli bosh sahifasi. */
export default function IjroHome({ docs, depts, loading, onRefresh, kit }: {
  docs: IjroDoc[]; depts: Department[]; loading: boolean; onRefresh: () => void; kit: IjroKit;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("barcha");
  const [deptView, setDeptView] = useState<"grid" | "list">("grid");
  const [showAllDepts, setShowAllDepts] = useState(false);
  const [openDept, setOpenDept] = useState<Department | null>(null);
  const [trackId, setTrackId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [selDay, setSelDay] = useState(() => ymd(new Date()));

  useEffect(() => { setName(getUser()?.full_name ?? ""); }, []);

  const isDone = (d: IjroDoc) => kit.docAggHolati(d) === "bajarildi";
  const statusOf = (d: IjroDoc): Status => {
    if (isDone(d)) return "done";
    const du = daysUntil(d.ijro_muddati);
    if (du !== null && du < 0) return "overdue";
    if (du !== null && du <= 5) return "soon";
    return "progress";
  };

  const stats = useMemo(() => {
    const months = lastMonths(7);
    const byCreated = (pred: (d: IjroDoc) => boolean) => months.map(k => docs.filter(d => (d.created_at || "").slice(0, 7) === k && pred(d)).length);
    const byDeadline = (pred: (d: IjroDoc) => boolean) => months.map(k => docs.filter(d => (d.ijro_muddati || "").slice(0, 7) === k && pred(d)).length);
    const st = (d: IjroDoc) => statusOf(d);
    return [
      { label: "Jami hujjatlar", value: docs.length, icon: FileText, color: C.blue, series: byCreated(() => true) },
      { label: "Bajarilgan", value: docs.filter(isDone).length, icon: CheckCircle2, color: C.green, series: byCreated(isDone) },
      { label: "Muddati yaqinlashgan", value: docs.filter(d => st(d) === "soon").length, icon: Clock, color: C.amber, series: byDeadline(d => st(d) === "soon"), upIsBad: true },
      { label: "Muddati o'tgan", value: docs.filter(d => st(d) === "overdue").length, icon: AlertCircle, color: C.red, series: byDeadline(d => st(d) === "overdue"), upIsBad: true },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  // Bo'limlar bo'yicha: jami / bajarilgan / jarayonda / muddati o'tgan (bo'limning o'z holati bo'yicha)
  const deptRows = useMemo(() => depts.map(dept => {
    let total = 0, done = 0, overdue = 0, soon = 0;
    for (const d of docs) {
      const b = infoOf(d).find(x => x.id === dept.id && x.holati !== "rad_etildi");
      if (!b) continue;
      total++;
      if (b.holati === "bajarildi" || d.holati === "bajarildi") { done++; continue; }
      const du = daysUntil(d.ijro_muddati);
      if (du !== null && du < 0) overdue++;
      else if (du !== null && du <= 5) soon++;
    }
    return { dept, total, done, overdue, soon, progress: total - done - overdue };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total), [docs, depts]);

  const deptShown = deptRows.filter(r =>
    deptFilter === "barcha" ? true : deptFilter === "faol" ? r.progress > 0 : deptFilter === "yaqin" ? r.soon > 0 : r.overdue > 0);
  const deptVisible = showAllDepts ? deptShown : deptShown.slice(0, 8);

  const recent = useMemo(() => [...docs].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 6), [docs]);

  // Kalendar belgilari va tanlangan kun rejasi
  const marks = useMemo(() => {
    const m = new Map<string, "overdue" | "due">();
    for (const d of docs) {
      if (!d.ijro_muddati || isDone(d)) continue;
      const k = d.ijro_muddati.slice(0, 10);
      if (statusOf(d) === "overdue") m.set(k, "overdue"); else if (!m.has(k)) m.set(k, "due");
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);
  const dayTasks = docs.filter(d => d.ijro_muddati && d.ijro_muddati.slice(0, 10) === selDay)
    .sort((a, b) => (a.ijro_muddati || "").localeCompare(b.ijro_muddati || ""));
  const upcoming = docs
    .filter(d => !isDone(d) && (daysUntil(d.ijro_muddati) ?? -1) >= 0)
    .sort((a, b) => (a.ijro_muddati || "").localeCompare(b.ijro_muddati || "")).slice(0, 4);
  const isTodaySel = selDay === ymd(new Date());
  const planTitle = isTodaySel ? "Bugungi reja" : `${Number(selDay.slice(8))}-${MONTHS[Number(selDay.slice(5, 7)) - 1].toLowerCase()} rejasi`;

  const firstBolim = (d: IjroDoc) => {
    const names = (d.masul_bolimlar_nomi || "").split(", ").filter(Boolean);
    return names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "") : "—";
  };
  const masul = (d: IjroDoc) => (d.masul_bolim_boshliqlari_nomi || "").split(", ")[0] || d.masul_orinbosar_nomi || "—";
  const timeOf = (s: string) => { const t = s.slice(11, 16); return t && t !== "00:00" ? t : null; };

  const FILTERS: { key: DeptFilter; label: string }[] = [
    { key: "barcha", label: "Barcha bo'limlar" }, { key: "faol", label: "Faol" },
    { key: "yaqin", label: "Muddati yaqin" }, { key: "otgan", label: "Muddati o'tgan" },
  ];

  return (
    <div>
      <Header title="" searchPlaceholder="Hujjat, topshiriq, bo'lim yoki xodimni qidiring..."
        onSearch={q => router.push(`/ijro/topshiriqlar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5">
        {/* ═══ Chap ustun ═══ */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Banner: salomlashish + kichik statistika */}
          <IjroHero title={`Assalomu alaykum${name ? `, ${name}` : ""}!`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 max-w-[760px]">
              {stats.map(s => <HeroStat key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} note={<Delta series={s.series} upIsBad={s.upIsBad} />} />)}
            </div>
          </IjroHero>

          {/* Bo'limlar bo'yicha topshiriqlar */}
          <div className="p-5 sm:p-6" style={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="font-bold text-lg" style={{ color: C.ink }}>Bo&apos;limlar bo&apos;yicha topshiriqlar</h3>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Bo&apos;limni tanlang va topshiriqlar holatini ko&apos;ring</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setDeptFilter(f.key)}
                    className="px-3.5 py-2 text-xs font-bold transition-all"
                    style={{ borderRadius: 10, background: deptFilter === f.key ? C.blue : "#F4F9FD", color: deptFilter === f.key ? "#FFFFFF" : C.soft }}>
                    {f.label}
                  </button>
                ))}
                <div className="flex p-1 gap-1" style={{ background: "#F4F9FD", borderRadius: 10 }}>
                  {([["grid", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
                    <button key={v} onClick={() => setDeptView(v)} aria-label={v === "grid" ? "Kartochkalar" : "Ro'yxat"}
                      className="w-7 h-7 flex items-center justify-center" style={{ borderRadius: 7, background: deptView === v ? C.blue : "transparent" }}>
                      <Icon size={14} style={{ color: deptView === v ? "#FFFFFF" : C.soft }} />
                    </button>
                  ))}
                </div>
                <button onClick={() => setNewOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                  style={{ background: C.blue, borderRadius: 10, boxShadow: "0 6px 14px rgba(63,140,255,0.3)" }}>
                  <Plus size={14} /> Yangi topshiriq
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin" style={{ color: C.blue }} /></div>
            ) : !deptShown.length ? (
              <p className="text-sm text-center py-10" style={{ color: C.muted }}>Bu filtr bo&apos;yicha bo&apos;lim yo&apos;q</p>
            ) : deptView === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4 gap-4">
                {deptVisible.map(r => {
                  const Icon = kit.deptIcon(r.dept.name, r.dept.dept_type);
                  const tint = DEPT_TINTS[r.dept.id % DEPT_TINTS.length];
                  const pct = Math.round((r.done / r.total) * 100);
                  return (
                    <button key={r.dept.id} onClick={() => setOpenDept(r.dept)}
                      className="p-4 text-left flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ border: "1px solid #EEF2F8", borderRadius: 16, background: "#FFFFFF" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center" style={{ background: `${tint}17`, borderRadius: 12 }}>
                          <Icon size={20} style={{ color: tint }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-snug line-clamp-2" style={{ color: C.ink }}>{r.dept.name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{r.total} ta topshiriq</p>
                        </div>
                        <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
                          <Arrow size={14} style={{ color: C.blue }} />
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: C.ink }}>
                        <span className="flex items-center gap-1" title="Bajarilgan"><span className="w-2 h-2 rounded-full" style={{ background: C.green }} />{r.done}</span>
                        <span className="flex items-center gap-1" title="Jarayonda"><span className="w-2 h-2 rounded-full" style={{ background: C.amber }} />{r.progress}</span>
                        <span className="flex items-center gap-1" title="Muddati o'tgan"><span className="w-2 h-2 rounded-full" style={{ background: C.red }} />{r.overdue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2F8" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.blue }} />
                        </div>
                        <span className="text-[11px] font-bold w-9 text-right" style={{ color: C.soft }}>{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#F8FAFF" }}>
                      {["Bo'lim", "Jami", "Bajarilgan", "Jarayonda", "Muddati o'tgan", "Bajarilish"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: C.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptVisible.map(r => {
                      const pct = Math.round((r.done / r.total) * 100);
                      return (
                        <tr key={r.dept.id} onClick={() => setOpenDept(r.dept)} className="cursor-pointer hover:bg-[#F8FAFF]" style={{ borderBottom: "1px solid #F4F9FD" }}>
                          <td className="px-3 py-3 font-bold" style={{ color: C.ink }}>{r.dept.name}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: C.ink }}>{r.total}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: "#00A578" }}>{r.done}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: "#B4780C" }}>{r.progress}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: "#E5484D" }}>{r.overdue}</td>
                          <td className="px-3 py-3" style={{ minWidth: 140 }}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2F8" }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.blue }} />
                              </div>
                              <span className="text-[11px] font-bold" style={{ color: C.soft }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {deptShown.length > 8 && (
              <button onClick={() => setShowAllDepts(v => !v)}
                className="w-full mt-4 py-2.5 text-xs font-bold" style={{ background: "#F4F9FD", color: C.blue, borderRadius: 12 }}>
                {showAllDepts ? "Kamroq ko'rsatish" : `Barcha bo'limlar (${deptShown.length})`}
              </button>
            )}
          </div>

          {/* So'nggi topshiriqlar */}
          <div className="p-5 sm:p-6" style={CARD}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-lg" style={{ color: C.ink }}>So&apos;nggi topshiriqlar</h3>
              <Link href="/ijro/topshiriqlar" className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold hover:opacity-80"
                style={{ background: "rgba(63,140,255,0.1)", color: C.blue, borderRadius: 10 }}>
                Barchasini ko&apos;rish <ArrowRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin" style={{ color: C.blue }} /></div>
            ) : !recent.length ? (
              <p className="text-sm text-center py-8" style={{ color: C.muted }}>Hozircha topshiriq yo&apos;q</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#F8FAFF" }}>
                      {["#", "Topshiriq nomi", "Bo'lim", "Mas'ul", "Muddat", "Holat", ""].map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: C.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((d, i) => {
                      const st = statusOf(d);
                      return (
                        <tr key={d.id} className="hover:bg-[#F8FAFF]" style={{ borderBottom: i < recent.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                          <td className="px-3 py-3 font-bold" style={{ color: C.muted }}>{i + 1}</td>
                          <td className="px-3 py-3 font-semibold" style={{ color: C.ink, maxWidth: 280 }}>
                            <span className="line-clamp-1">{d.sarlavha || d.mazmun || `№ ${d.hujjat_raqami || d.id}`}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#3D4557", maxWidth: 200 }}><span className="block truncate">{firstBolim(d)}</span></td>
                          <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#3D4557" }}>{masul(d)}</td>
                          <td className="px-3 py-3 whitespace-nowrap font-semibold" style={{ color: st === "overdue" ? "#E5484D" : "#3D4557" }}>
                            {d.ijro_muddati ? fmtDay(d.ijro_muddati) : "—"}
                          </td>
                          <td className="px-3 py-3"><StatusChip s={st} /></td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => setTrackId(d.id)} aria-label="Batafsil" title="Batafsil kuzatuv"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[#EEF2F8]">
                              <MoreHorizontal size={16} style={{ color: C.soft }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ═══ O'ng ustun ═══ */}
        <div className="flex flex-col gap-5 min-w-0">
          <MiniCalendar marks={marks} selected={selDay} onSelect={setSelDay} />

          {/* Tanlangan kun rejasi (muddati shu kuni bo'lgan topshiriqlar) */}
          <div className="p-5" style={CARD}>
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="font-bold text-[15px]" style={{ color: C.ink }}>{planTitle}</p>
              <Link href="/ijro/taqvim" className="px-3 py-1.5 text-[11px] font-bold hover:opacity-80"
                style={{ background: "rgba(63,140,255,0.1)", color: C.blue, borderRadius: 999 }}>
                Barchasi ({dayTasks.length})
              </Link>
            </div>
            {dayTasks.length ? (
              <PlanList items={dayTasks} statusOf={statusOf} timeOf={timeOf} firstBolim={firstBolim} onOpen={setTrackId} />
            ) : (
              <>
                <p className="text-xs flex items-center gap-1.5 mb-3" style={{ color: C.muted }}>
                  <CalendarClock size={14} /> Bu kunga muddatli topshiriq yo&apos;q
                </p>
                {upcoming.length > 0 && (
                  <>
                    <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "#B0B8C8", letterSpacing: "0.05em" }}>Yaqin muddatlar</p>
                    <PlanList items={upcoming} statusOf={statusOf} timeOf={d => fmtDay(d).slice(0, 5)} firstBolim={firstBolim} onOpen={setTrackId} />
                  </>
                )}
              </>
            )}
          </div>

          <DynamicsChart docs={docs} isDone={isDone} />
        </div>
      </div>

      {openDept && <kit.DeptTasksModal dept={openDept} docs={docs} depts={depts} onClose={() => setOpenDept(null)} />}
      {trackId !== null && <kit.IjroTrackingModal docId={trackId} depts={depts} onClose={() => setTrackId(null)} />}
      {newOpen && <kit.YangiHujjatModal depts={depts} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); onRefresh(); }} />}
    </div>
  );
}

/* Reja ro'yxati: vaqt — nuqta — topshiriq va bo'lim (vertikal chiziq bilan) */
function PlanList({ items, statusOf, timeOf, firstBolim, onOpen }: {
  items: IjroDoc[]; statusOf: (d: IjroDoc) => Status; timeOf: (s: string) => string | null;
  firstBolim: (d: IjroDoc) => string; onOpen: (id: number) => void;
}) {
  return (
    <div className="flex flex-col">
      {items.map((d, i) => {
        const st = statusOf(d);
        const dot = st === "done" ? C.green : st === "overdue" ? C.red : st === "soon" ? C.amber : C.blue;
        return (
          <button key={d.id} onClick={() => onOpen(d.id)} className="flex gap-3 text-left group">
            <span className="w-11 flex-shrink-0 text-xs font-bold pt-0.5" style={{ color: C.soft }}>{timeOf(d.ijro_muddati || "") ?? "—"}</span>
            <span className="relative flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: dot, boxShadow: `0 0 0 3px ${dot}26` }} />
              {i < items.length - 1 && <span className="flex-1 w-px my-1" style={{ background: "#E3ECFB" }} />}
            </span>
            <span className="min-w-0 flex-1 pb-4">
              <span className="block text-[13px] font-bold leading-snug line-clamp-2 group-hover:underline" style={{ color: C.ink }}>
                {d.sarlavha || d.mazmun || `№ ${d.hujjat_raqami || d.id}`}
              </span>
              <span className="block text-[11px] mt-0.5 truncate" style={{ color: C.muted }}>{firstBolim(d)} · {STATUS_CFG[st].label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
