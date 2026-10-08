"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, MessageSquareText, CheckCircle2, AlertCircle, RotateCcw, Eye, Check, Loader2, Paperclip, X, ChevronDown, Inbox,
  Users, AlarmClockOff, Timer,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import IjroHero from "@/components/ijro/IjroHero";
import IjroDocModal from "@/components/ijro/IjroDocModal";
import type { IjroDoc } from "@/components/ijro/IjroNazorat";
import { MANBA_LABEL, fmtShort, fmtLongDT, daysFromToday } from "@/components/ijro/ijroShared";

interface NRow {
  id: number; doc_id: number; bolim_id: number; bolim_nomi: string | null; boshliq_nomi: string | null;
  holati: string; xodim_nomi: string | null; yakunlash_izohi: string | null; yakunlangan_at: string | null;
  yakunlagan_by_nomi: string | null; fayllar_soni: number; qayta_soni: number; qaror_at: string | null;
  review_log: { qaror: string; izoh: string | null; at: string | null; by: string | null }[];
  doc: { hujjat_raqami: string | null; hujjat_sanasi: string | null; sarlavha: string | null; mazmun: string | null;
         manba: string | null; tur: string | null; ijro_muddati: string | null; created_at: string | null; holati: string | null };
}

type Kind = "javob" | "qabul" | "qayta" | "otgan" | "jarayonda" | "korilmagan" | "rad";
/** Bo'lim topshirig'ining nazorat holati. */
function kindOf(r: NRow): Kind {
  if (r.holati === "bajarildi") return "qabul";
  if (r.holati === "rad_etildi") return r.yakunlangan_at ? "qayta" : "rad";
  if (r.holati === "tasdiq_kutilmoqda") return "javob";
  const du = daysFromToday(r.doc.ijro_muddati);
  if (du !== null && du < 0) return "otgan";
  return r.holati === "yuborildi" ? "korilmagan" : "jarayonda";
}
const KIND: Record<Kind, { label: string; color: string; bg: string }> = {
  javob:      { label: "Javob berilgan",  color: "#B54708", bg: "#FEF0C7" },
  qabul:      { label: "Qabul qilindi",   color: "#027A48", bg: "#D9F7E6" },
  qayta:      { label: "Qayta nazoratda", color: "#C4320A", bg: "#FDE7E4" },
  otgan:      { label: "Muddati o'tgan",  color: "#D92D20", bg: "#FEE4E2" },
  jarayonda:  { label: "Bajarilmoqda",    color: "#2D5BD7", bg: "#E4ECFF" },
  korilmagan: { label: "Ko'rilmagan",     color: "#6D5DD3", bg: "#EEEAFE" },
  rad:        { label: "Bo'lim rad etgan", color: "#667085", bg: "#F2F4F7" },
};

type Tab = "malumot" | "javob" | "qabul" | "otgan" | "qayta";
type Period = "oy" | "otgan_oy" | "yil" | "hammasi";
const PERIODS: { key: Period; label: string }[] = [
  { key: "oy", label: "Shu oy" }, { key: "otgan_oy", label: "O'tgan oy" }, { key: "yil", label: "Shu yil" }, { key: "hammasi", label: "Barcha davr" },
];
function inPeriod(iso: string | null, p: Period): boolean {
  if (p === "hammasi") return true;
  if (!iso) return false;
  const now = new Date(), d = new Date(iso);
  if (p === "yil") return d.getFullYear() === now.getFullYear();
  const ref = p === "oy" ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 18, boxShadow: "0 6px 30px rgba(196,203,214,0.18)" };
const TH = "px-3 py-3 text-left text-[11.5px] font-semibold whitespace-nowrap";

function Dot({ c }: { c: string }) { return <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: c }} />; }

/* ── Javob qarori: qayta nazoratga yuborish sababi ── */
function QaytaModal({ row, onClose, onDone }: { row: NRow; onClose: () => void; onDone: () => void }) {
  const [izoh, setIzoh] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send() {
    if (!izoh.trim()) { setErr("Qaytarish sababini yozing"); return; }
    setBusy(true); setErr(null);
    try {
      await apiFetch(`/ijro-docs/bolim-inbox/${row.id}/ijro-qaror`, { method: "POST", body: JSON.stringify({ qaror: "rad_etish", izoh: izoh.trim() }) });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Xatolik"); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,40,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-md p-6" style={{ background: "#FFFFFF", borderRadius: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#101828" }}>Qayta nazoratga yuborish</h3>
            <p className="text-sm mt-1" style={{ color: "#667085" }}>{row.bolim_nomi} · {row.doc.hujjat_raqami || `DOC-${row.doc_id}`}</p>
          </div>
          <button onClick={onClose} aria-label="Yopish"><X size={18} style={{ color: "#667085" }} /></button>
        </div>
        <textarea value={izoh} onChange={e => setIzoh(e.target.value)} rows={4} autoFocus
          placeholder="Javob nima uchun qaytarilmoqda? Bo'lim shu izohni ko'radi."
          className="w-full mt-4 px-3.5 py-3 text-sm outline-none resize-none" style={{ border: "1px solid #D0D5DD", borderRadius: 12, color: "#101828" }} />
        {err && <p className="text-xs font-semibold mt-2" style={{ color: "#D92D20" }}>{err}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold" style={{ background: "#F2F4F7", color: "#344054", borderRadius: 12 }}>Bekor qilish</button>
          <button onClick={send} disabled={busy} className="flex-1 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#F04438", borderRadius: 12 }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Qaytarish
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Topshiriqlar ro'yxati jadvali (javoblar / muddati o'tganlar va h.k.) ── */
function RowsTable({ rows, tab, onOpen, onAccept, onReturn, busyId }: {
  rows: NRow[]; tab: Tab | "buzilgan" | "yaqin"; onOpen: (docId: number) => void;
  onAccept: (r: NRow) => void; onReturn: (r: NRow) => void; busyId: number | null;
}) {
  if (!rows.length) return (
    <div className="flex flex-col items-center gap-2 py-14">
      <Inbox size={32} style={{ color: "#D0D5DD" }} />
      <p className="text-sm" style={{ color: "#98A2B3" }}>Bu bo&apos;limda topshiriq yo&apos;q</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#F7F9FC", color: "#475467" }}>
            <th className={TH}>#</th><th className={TH}>Hujjat</th><th className={TH}>Bo&apos;lim / ijrochi</th>
            <th className={TH}>Muddat</th><th className={TH}>{tab === "qayta" ? "Qaytarish sababi" : "Javob"}</th>
            <th className={TH}>Holat</th><th className={`${TH} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = kindOf(r), kc = KIND[k];
            const du = daysFromToday(r.doc.ijro_muddati);
            const late = k !== "qabul" && du !== null && du < 0;
            const lastRad = [...r.review_log].reverse().find(x => x.qaror === "rad_etish");
            return (
              <tr key={r.id} className="align-top hover:bg-[#FAFBFD]" style={{ borderTop: "1px solid #EEF1F6" }}>
                <td className="px-3 py-3.5 font-semibold" style={{ color: "#98A2B3" }}>{i + 1}</td>
                <td className="px-3 py-3.5" style={{ maxWidth: 300 }}>
                  <button onClick={() => onOpen(r.doc_id)} className="font-semibold hover:underline text-left" style={{ color: "#3F5BD8" }}>
                    {r.doc.hujjat_raqami || `DOC-${r.doc_id}`}
                  </button>
                  <span className="ml-2 text-xs" style={{ color: "#98A2B3" }}>{fmtShort(r.doc.hujjat_sanasi || r.doc.created_at)}</span>
                  <p className="text-[13px] mt-0.5 line-clamp-2" style={{ color: "#344054" }}>{r.doc.sarlavha || r.doc.mazmun || "—"}</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "#98A2B3" }}>{MANBA_LABEL[r.doc.manba || ""] ?? ""}</p>
                </td>
                <td className="px-3 py-3.5" style={{ maxWidth: 220 }}>
                  <p className="font-medium text-[13px]" style={{ color: "#101828" }}>{r.bolim_nomi || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#667085" }}>{r.xodim_nomi || r.boshliq_nomi || "—"}</p>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <p className="font-medium" style={{ color: late ? "#D92D20" : "#101828" }}>{r.doc.ijro_muddati ? fmtShort(r.doc.ijro_muddati) : "—"}</p>
                  {du !== null && k !== "qabul" && (
                    <p className="text-xs mt-0.5" style={{ color: late ? "#D92D20" : du <= 3 ? "#B54708" : "#667085" }}>
                      {late ? `${-du} kun kechikdi` : du === 0 ? "Bugun" : `${du} kun qoldi`}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3.5" style={{ minWidth: 200, maxWidth: 300 }}>
                  {tab === "qayta" ? (
                    <>
                      <p className="text-[13px]" style={{ color: "#B42318" }}>{lastRad?.izoh || "—"}</p>
                      <p className="text-[11.5px] mt-1" style={{ color: "#98A2B3" }}>
                        {r.qayta_soni}-marta qaytarildi{lastRad?.by ? ` · ${lastRad.by}` : ""}{lastRad?.at ? ` · ${fmtLongDT(lastRad.at)}` : ""}
                      </p>
                    </>
                  ) : r.yakunlangan_at ? (
                    <>
                      <p className="text-[13px] line-clamp-2" style={{ color: "#344054" }}>{r.yakunlash_izohi || "Izohsiz"}</p>
                      <p className="text-[11.5px] mt-1 flex items-center gap-2" style={{ color: "#98A2B3" }}>
                        {r.fayllar_soni > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{r.fayllar_soni}</span>}
                        {fmtLongDT(r.yakunlangan_at)}{r.yakunlagan_by_nomi ? ` · ${r.yakunlagan_by_nomi}` : ""}
                      </p>
                    </>
                  ) : <span className="text-xs" style={{ color: "#98A2B3" }}>Javob hali yo&apos;q</span>}
                </td>
                <td className="px-3 py-3.5">
                  <span className="inline-block px-2.5 py-1 text-xs font-semibold whitespace-nowrap" style={{ background: kc.bg, color: kc.color, borderRadius: 999 }}>{kc.label}</span>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {k === "javob" && (
                      <>
                        <button onClick={() => onAccept(r)} disabled={busyId === r.id} title="Javobni qabul qilish"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#12B76A", borderRadius: 8 }}>
                          {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Qabul
                        </button>
                        <button onClick={() => onReturn(r)} title="Qayta nazoratga yuborish"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold" style={{ background: "#FEE4E2", color: "#B42318", borderRadius: 8 }}>
                          <RotateCcw size={13} /> Qaytarish
                        </button>
                      </>
                    )}
                    <button onClick={() => onOpen(r.doc_id)} aria-label="Ko'rish" title="Hujjatni ko'rish"
                      className="w-8 h-8 flex items-center justify-center" style={{ border: "1px solid #E4E7EC", borderRadius: 8 }}>
                      <Eye size={15} style={{ color: "#3F5BD8" }} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 130 }}>
      <span className="text-xs font-bold w-9" style={{ color: "#101828" }}>{pct}%</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#EEF1F6" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#3F8CFF" }} />
      </div>
    </div>
  );
}

/** Ijro roli — "Nazorat": topshiriqlar ijro holati. */
export default function IjroHolat() {
  const router = useRouter();
  const [rows, setRows] = useState<NRow[]>([]);
  const [docs, setDocs] = useState<IjroDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("malumot");
  const [sub, setSub] = useState<"rahbarlar" | "buzilgan" | "yaqin">("rahbarlar");
  const [period, setPeriod] = useState<Period>("oy");
  const [openDoc, setOpenDoc] = useState<number | null>(null);
  const [qayta, setQayta] = useState<NRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, d] = await Promise.all([apiFetch<NRow[]>("/ijro-docs/nazorat"), apiFetch<IjroDoc[]>("/ijro-docs/")]);
      setRows(r); setDocs(d); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function accept(r: NRow) {
    if (!confirm(`${r.bolim_nomi} javobini qabul qilasizmi? Topshiriq shu bo'lim uchun bajarildi deb belgilanadi.`)) return;
    setBusyId(r.id);
    try {
      await apiFetch(`/ijro-docs/bolim-inbox/${r.id}/ijro-qaror`, { method: "POST", body: JSON.stringify({ qaror: "yechish" }) });
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); }
    finally { setBusyId(null); }
  }

  const active = rows.filter(r => kindOf(r) !== "rad");
  const lists = useMemo(() => ({
    javob: active.filter(r => kindOf(r) === "javob").sort((a, b) => (a.yakunlangan_at || "").localeCompare(b.yakunlangan_at || "")),
    qabul: active.filter(r => kindOf(r) === "qabul").sort((a, b) => (b.qaror_at || "").localeCompare(a.qaror_at || "")),
    otgan: active.filter(r => kindOf(r) === "otgan").sort((a, b) => (a.doc.ijro_muddati || "").localeCompare(b.doc.ijro_muddati || "")),
    qayta: active.filter(r => r.qayta_soni > 0).sort((a, b) => (b.review_log.at(-1)?.at || "").localeCompare(a.review_log.at(-1)?.at || "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows]);

  // Ma'lumot: tanlangan davrda kiritilgan hujjatlar kesimida
  const pDocs = docs.filter(d => inPeriod(d.created_at, period));
  const pDocIds = new Set(pDocs.map(d => d.id));
  const pRows = active.filter(r => pDocIds.has(r.doc_id));
  const stat = (rs: NRow[]) => ({
    topshiriq: rs.length,
    jarayonda: rs.filter(r => ["javob", "jarayonda", "korilmagan", "qayta"].includes(kindOf(r))).length,
    otgan: rs.filter(r => kindOf(r) === "otgan").length,
    bajarilgan: rs.filter(r => kindOf(r) === "qabul").length,
    qayta: rs.filter(r => r.qayta_soni > 0).length,
  });
  const byManba = Object.keys(MANBA_LABEL).map(m => ({
    m, hujjat: pDocs.filter(d => d.manba === m).length, ...stat(pRows.filter(r => r.doc.manba === m)),
  })).filter(x => x.hujjat > 0);
  const jami = { hujjat: pDocs.length, ...stat(pRows) };

  const rahbarlar = useMemo(() => {
    const g = new Map<number, NRow[]>();
    for (const r of pRows) (g.get(r.bolim_id) ?? g.set(r.bolim_id, []).get(r.bolim_id)!).push(r);
    return [...g.values()].map(rs => ({ r0: rs[0], ...stat(rs) })).sort((a, b) => b.topshiriq - a.topshiriq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, docs, period]);
  const buzilgan = lists.otgan.filter(r => (daysFromToday(r.doc.ijro_muddati) ?? 0) <= -5);
  const yaqin = active.filter(r => { const k = kindOf(r); const du = daysFromToday(r.doc.ijro_muddati); return k !== "qabul" && k !== "otgan" && du !== null && du >= 0 && du < 3; });

  const TABS: { key: Tab; label: string; icon: typeof BarChart3; color: string; bg: string; n?: number }[] = [
    { key: "malumot", label: "Ma'lumot", icon: BarChart3, color: "#3F5BD8", bg: "#EEF4FF" },
    { key: "javob", label: "Bajarilgan javoblar", icon: MessageSquareText, color: "#B54708", bg: "#FFF6E5", n: lists.javob.length },
    { key: "qabul", label: "Qabul qilinganlar", icon: CheckCircle2, color: "#027A48", bg: "#ECFDF3", n: lists.qabul.length },
    { key: "otgan", label: "Muddati o'tganlar", icon: AlertCircle, color: "#D92D20", bg: "#FEF3F2", n: lists.otgan.length },
    { key: "qayta", label: "Qayta nazoratga yuborilganlar", icon: RotateCcw, color: "#C4320A", bg: "#FFF4ED", n: lists.qayta.length },
  ];

  const COLS = ["Bajarilmoqda", "Muddati o'tgan", "Bajarilgan", "Qayta nazoratga olingan"];
  const COL_C = ["#2E90FA", "#F04438", "#12B76A", "#F79009"];

  return (
    <div className="flex flex-col gap-4">
      <IjroHero title="Topshiriqlar ijro holati" subtitle="Topshiriqlarning ijro holati va bo'limlar javoblari bo'yicha umumiy ma'lumot"
        right={
          <label className="relative flex items-center gap-2 pl-4 pr-9 py-2.5 text-sm font-semibold text-white cursor-pointer"
            style={{ background: "rgba(11,42,91,0.72)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 12, backdropFilter: "blur(6px)" }}>
            <select value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Davr"
              className="appearance-none bg-transparent outline-none cursor-pointer text-white">
              {PERIODS.map(p => <option key={p.key} value={p.key} style={{ color: "#101828" }}>{p.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 pointer-events-none" />
          </label>
        } />

      {/* Tablar */}
      <div className="flex gap-2 p-2 overflow-x-auto" style={CARD}>
        {TABS.map(t => {
          const on = tab === t.key, Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-all"
              style={{ background: on ? "#FFFFFF" : t.bg, color: t.color, borderRadius: 12, border: `1.5px solid ${on ? t.color : "transparent"}`, boxShadow: on ? "0 4px 14px rgba(16,24,40,0.08)" : undefined }}>
              <Icon size={17} /> {t.label}
              {t.n !== undefined && <span className="min-w-6 px-1.5 py-0.5 text-xs font-bold text-white text-center" style={{ background: t.color, borderRadius: 8 }}>{t.n}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: "#D92D20" }}>{error}</p>
      ) : tab === "malumot" ? (
        <>
          <div className="p-4 sm:p-6" style={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-xl" style={{ color: "#101828" }}>Hujjatlar kesimida</h2>
              <span className="text-sm px-3 py-2" style={{ border: "1px solid #E4E7EC", borderRadius: 10, color: "#344054" }}>
                {PERIODS.find(p => p.key === period)?.label} · kiritilgan hujjatlar
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F7F9FC", color: "#475467" }}>
                    <th className={TH}>#</th><th className={TH}>Hujjat manbai</th><th className={TH}>Hujjatlar soni</th><th className={TH}>Topshiriqlar soni</th>
                    {COLS.map((c, i) => <th key={c} className={TH}><Dot c={COL_C[i]} />{c}</th>)}
                    <th className={`${TH} text-right`}>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byManba.map((x, i) => ({ ...x, n: i + 1, label: MANBA_LABEL[x.m] })), { ...jami, n: 0, m: "", label: "Jami" }].map(x => (
                    <tr key={x.label} style={{ borderTop: "1px solid #EEF1F6", background: x.n === 0 ? "#F7F9FC" : undefined }}>
                      <td className="px-3 py-3.5" style={{ color: "#98A2B3" }}>{x.n || ""}</td>
                      <td className="px-3 py-3.5 font-semibold" style={{ color: "#101828" }}>{x.label}</td>
                      <td className="px-3 py-3.5 font-bold" style={{ color: "#101828" }}>{x.hujjat}</td>
                      <td className="px-3 py-3.5 font-bold" style={{ color: "#101828" }}>{x.topshiriq}</td>
                      {[x.jarayonda, x.otgan, x.bajarilgan, x.qayta].map((v, i) => (
                        <td key={i} className="px-3 py-3.5 font-semibold" style={{ color: COL_C[i] }}>{v}</td>
                      ))}
                      <td className="px-3 py-3.5 text-right">
                        <button onClick={() => router.push("/ijro/topshiriqlar")} aria-label="Topshiriqlarni ko'rish" title="Topshiriqlarni ko'rish"
                          className="w-8 h-8 inline-flex items-center justify-center" style={{ border: "1px solid #E4E7EC", borderRadius: 8 }}>
                          <Eye size={15} style={{ color: "#3F5BD8" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={CARD}>
            <div className="flex gap-1 px-3 pt-2 overflow-x-auto" style={{ borderBottom: "1px solid #EEF1F6" }}>
              {([["rahbarlar", "Rahbarlar kesimida", Users, "#027A48"], ["buzilgan", "Bajarish muddati qo'pol buzilgan", AlarmClockOff, "#D92D20"], ["yaqin", "Ijro muddati 3 kundan kam", Timer, "#B54708"]] as const).map(([k, l, Icon, c]) => (
                <button key={k} onClick={() => setSub(k)} className="flex items-center gap-2 px-3.5 py-3 text-[13.5px] font-semibold whitespace-nowrap"
                  style={{ color: c, borderBottom: `2px solid ${sub === k ? c : "transparent"}`, opacity: sub === k ? 1 : 0.75 }}>
                  <Icon size={17} /> {l}
                  {k !== "rahbarlar" && <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-md" style={{ background: `${c}1A` }}>{k === "buzilgan" ? buzilgan.length : yaqin.length}</span>}
                </button>
              ))}
            </div>
            <div className="p-3 sm:p-4">
              {sub === "rahbarlar" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#F7F9FC", color: "#475467" }}>
                        <th className={TH}>#</th><th className={TH}>Rahbar F.I.Sh.</th><th className={TH}>Bo&apos;lim</th><th className={TH}>Topshiriqlar soni</th>
                        {COLS.map((c, i) => <th key={c} className={TH}><Dot c={COL_C[i]} />{c}</th>)}
                        <th className={TH}>Foiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rahbarlar.map((x, i) => (
                        <tr key={x.r0.bolim_id} style={{ borderTop: "1px solid #EEF1F6" }}>
                          <td className="px-3 py-3" style={{ color: "#98A2B3" }}>{i + 1}</td>
                          <td className="px-3 py-3 font-bold uppercase text-[13px]" style={{ color: "#101828" }}>{x.r0.boshliq_nomi || "—"}</td>
                          <td className="px-3 py-3" style={{ color: "#475467", maxWidth: 260 }}>{x.r0.bolim_nomi}</td>
                          <td className="px-3 py-3 font-semibold" style={{ color: "#101828" }}>{x.topshiriq}</td>
                          {[x.jarayonda, x.otgan, x.bajarilgan, x.qayta].map((v, j) => (
                            <td key={j} className="px-3 py-3 font-semibold" style={{ color: COL_C[j] }}>{v}</td>
                          ))}
                          <td className="px-3 py-3"><Bar pct={x.topshiriq ? Math.round((x.bajarilgan / x.topshiriq) * 100) : 0} /></td>
                        </tr>
                      ))}
                      {!rahbarlar.length && <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: "#98A2B3" }}>Bu davrda topshiriq yo&apos;q</td></tr>}
                    </tbody>
                  </table>
                </div>
              ) : (
                <RowsTable rows={sub === "buzilgan" ? buzilgan : yaqin} tab={sub} onOpen={setOpenDoc} onAccept={accept} onReturn={setQayta} busyId={busyId} />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="p-3 sm:p-4" style={CARD}>
          <RowsTable rows={lists[tab]} tab={tab} onOpen={setOpenDoc} onAccept={accept} onReturn={setQayta} busyId={busyId} />
        </div>
      )}

      {openDoc !== null && <IjroDocModal docId={openDoc} onClose={() => setOpenDoc(null)} />}
      {qayta && <QaytaModal row={qayta} onClose={() => setQayta(null)} onDone={() => { setQayta(null); load(); }} />}
    </div>
  );
}
