"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Workflow, Plus, PenLine, Search, ChevronLeft, ChevronRight, Eye, Download, Loader2, CheckCheck, X, Paperclip,
} from "lucide-react";
import type { IjroDoc, Department } from "@/components/ijro/IjroNazorat";
import { useTracking, BOLIM_HOLAT, type Tracking } from "@/components/ijro/IjroDocModal";
import {
  TASK_STATUS, MANBA_LABEL, TUR_LABEL, DAVRIYLIK_LABEL, taskStatus, fmtShort, fmtLongDT, daysFromToday, infoOf,
  StatusIcon, viewB64, downloadB64, b64Size, shortName, type TaskStatus,
} from "@/components/ijro/ijroShared";

type Tab = "all" | TaskStatus;
const TABS: { key: Tab; label: string; color: string }[] = [
  { key: "all",          label: "Barchasi",       color: "#F97316" },
  { key: "bajarilgan",   label: "Bajarilgan",     color: "#12B76A" },
  { key: "otgan",        label: "Muddati o'tgan", color: "#F04438" },
  { key: "bajarilmoqda", label: "Bajarilmoqda",   color: "#2E90FA" },
  { key: "tasdiqlashda", label: "Tasdiqlashda",   color: "#F79009" },
  { key: "korilmagan",   label: "Ko'rilmagan",    color: "#7A5AF8" },
];
const PAGE = 50;

export interface DetailKit {
  IjroTrackingModal: (p: { docId: number; depts: Department[]; onClose: () => void }) => React.ReactNode;
  YangiHujjatModal: (p: { depts: Department[]; onClose: () => void; onSaved: () => void; editDoc?: IjroDoc }) => React.ReactNode;
}

function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-sm" style={{ color: "#667085" }}>{label}</p>
      <div className="text-[15px] mt-1" style={{ color: "#101828" }}>{children}</div>
    </div>
  );
}

function FileCard({ name, b64 }: { name: string; b64: string }) {
  const ext = (name.split(".").pop() || "fayl").toUpperCase().slice(0, 4);
  const color = ext === "PDF" ? "#D92D20" : ext.startsWith("DOC") ? "#2E6BE6" : ext.startsWith("XLS") ? "#12B76A" : "#667085";
  return (
    <div className="flex items-center gap-3 p-2 pr-4 max-w-[540px]" style={{ border: "1px solid #E4E7EC", borderRadius: 12 }}>
      <span className="w-16 h-16 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold" style={{ background: color, borderRadius: 8 }}>{ext}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] truncate" style={{ color: "#3F5BD8" }} title={name}>{shortName(name, 28)}</span>
        <span className="block text-xs mt-0.5" style={{ color: "#667085" }}>{b64Size(b64)}</span>
      </span>
      <button onClick={() => viewB64(name, b64)} aria-label="Ko'rish" title="Ko'rish" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEF4FF]">
        <Eye size={18} style={{ color: "#3F5BD8" }} />
      </button>
      <button onClick={() => downloadB64(name, b64)} aria-label="Yuklab olish" title="Yuklab olish" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEF4FF]">
        <Download size={18} style={{ color: "#3F5BD8" }} />
      </button>
    </div>
  );
}

/** Hujjatning o'ng qismi: topshiriq sarlavhasi, hujjat ma'lumotlari, ijrochilar.
 *  Hujjat sahifasi va Nazorat bo'limida birga ishlatiladi. */
export function DocCards({ data, docs, children }: { data: Tracking; docs: IjroDoc[]; children?: React.ReactNode }) {
  const doc = data.doc;
  const st = taskStatus({ ...doc, masul_bolimlar_info: docs.find(x => x.id === doc.id)?.masul_bolimlar_info ?? doc.masul_bolimlar_info });
  const du = daysFromToday(doc.ijro_muddati);
  return (
    <>
    {/* Topshiriq sarlavhasi */}
    <div className="p-4 sm:p-5 bg-white" style={{ border: "1px solid #EEF1F6", borderRadius: 12 }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-lg" style={{ color: "#101828" }}>Topshiriq</span>
        <span className="text-[15px]" style={{ color: "#3F5BD8" }}>#{doc.hujjat_raqami || `DOC-${doc.id}`}</span>
        {doc.created_by_nomi && (
          <span className="ml-auto flex items-center gap-2 text-sm font-semibold uppercase" style={{ color: "#344054" }} title="Kiritgan">
            <PenLine size={16} /> {doc.created_by_nomi}
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-semibold" style={{ background: "#F2F4F7", color: "#475467" }}>
            {(doc.masul_orinbosar_nomi || "?").charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] truncate" style={{ color: "#3F5BD8" }}>{doc.masul_orinbosar_nomi || "Mas'ul o'rinbosar belgilanmagan"}</span>
            <span className="block text-sm" style={{ color: "#667085" }}>Direktor o&apos;rinbosari</span>
          </span>
        </div>
        <div>
          <p className="text-sm" style={{ color: "#101828" }}>Kiritilgan sana {fmtLongDT(doc.created_at)}</p>
          <p className="flex items-center gap-2 text-sm mt-1" style={{ color: TASK_STATUS[st].color }}>
            <StatusIcon s={st} size={18} /> {TASK_STATUS[st].label}
            {st === "otgan" && du !== null && ` — ${-du} kun kechikdi`}
            {st !== "otgan" && st !== "bajarilgan" && du !== null && du >= 0 && <span style={{ color: "#667085" }}>— {du} kun qoldi</span>}
          </p>
        </div>
      </div>
    </div>

    {/* Hujjat ma'lumotlari */}
    <div className="bg-white" style={{ border: "1px solid #EEF1F6", borderRadius: 12 }}>
      <div className="px-4 sm:px-5 py-4 text-lg" style={{ borderBottom: "1px solid #EEF1F6", color: "#101828" }}>
        {TUR_LABEL[doc.tur] ?? "Hujjat"} - <span style={{ color: "#3F5BD8" }}>{doc.hujjat_raqami || `DOC-${doc.id}`}</span>
        {doc.hujjat_sanasi && <> - <span style={{ color: "#3F5BD8" }}>{fmtShort(doc.hujjat_sanasi)}</span></>}
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        <Info label="Hujjat raqami va sanasi">{doc.hujjat_raqami || "—"}{doc.hujjat_sanasi ? <> - <span style={{ color: "#3F5BD8" }}>{fmtShort(doc.hujjat_sanasi)}</span></> : ""}</Info>
        <Info label="Yuboruvchi">{MANBA_LABEL[doc.manba] ?? "—"}</Info>
        <Info label="Bajarish muddati">
          <span style={{ color: st === "otgan" ? "#D92D20" : undefined }}>{doc.ijro_muddati ? fmtShort(doc.ijro_muddati) : "—"}</span>
        </Info>
        <Info label="Davriyligi">{DAVRIYLIK_LABEL[doc.davriyligi] ?? doc.davriyligi}</Info>
        {doc.kelishuvchi_tashkilotlar && <Info label="Kelishuvchi tashkilotlar" wide>{doc.kelishuvchi_tashkilotlar}</Info>}
        {doc.sarlavha && <Info label="Topshiriq nomi" wide><span className="text-xl font-semibold">{doc.sarlavha}</span></Info>}
        <Info label="Qisqacha mazmuni" wide><p className="leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{doc.mazmun || "—"}</p></Info>
        {doc.qoshimcha_malumot && <Info label="Qo'shimcha ma'lumot" wide><p className="leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{doc.qoshimcha_malumot}</p></Info>}
        <Info label="Asosiy fayl" wide>
          {doc.fayl_name && doc.fayl_b64 ? <div className="mt-1"><FileCard name={doc.fayl_name} b64={doc.fayl_b64} /></div>
            : <span style={{ color: "#98A2B3" }}>Fayl biriktirilmagan</span>}
        </Info>
      </div>
    </div>

    {/* Ijrochilar */}
    <div className="bg-white" style={{ border: "1px solid #EEF1F6", borderRadius: 12 }}>
      <div className="px-4 sm:px-5 py-4 text-lg" style={{ borderBottom: "1px solid #EEF1F6", color: "#101828" }}>Ijrochilar</div>
      {data.bolimlar.length ? data.bolimlar.map((b, i) => {
        const h = BOLIM_HOLAT[b.holati] ?? BOLIM_HOLAT.yuborildi;
        return (
          <div key={b.id} className="px-4 sm:px-5 py-4 flex flex-col gap-2" style={{ borderTop: i ? "1px solid #EEF1F6" : "none" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[15px] font-semibold" style={{ color: "#101828" }}>{b.bolim_nomi || "—"}</span>
              <span className="px-2.5 py-1 text-xs font-semibold" style={{ background: h.bg, color: h.color, borderRadius: 999 }}>{h.label}</span>
              {b.xodim_nomi && <span className="ml-auto text-sm" style={{ color: "#475467" }}>Ijrochi: <b style={{ color: "#101828" }}>{b.xodim_nomi}</b></span>}
            </div>
            {b.izoh && <p className="text-sm" style={{ color: "#667085" }}>Izoh: {b.izoh}</p>}
            {b.yakunlangan_at && (
              <p className="text-sm" style={{ color: "#027A48" }}>
                Yakunlandi: {fmtLongDT(b.yakunlangan_at)}{b.yakunlagan_by_nomi ? ` — ${b.yakunlagan_by_nomi}` : ""}
              </p>
            )}
            {b.yakunlash_izohi && <p className="text-sm" style={{ color: "#344054", whiteSpace: "pre-wrap" }}>{b.yakunlash_izohi}</p>}
            {b.yakunlash_fayllar.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {b.yakunlash_fayllar.map(f => (
                  <button key={f.name} onClick={() => downloadB64(f.name, f.b64)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F9FC]"
                    style={{ border: "1px solid #E4E7EC", borderRadius: 10, color: "#344054" }}>
                    <Paperclip size={14} /> {shortName(f.name, 24)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }) : <p className="px-5 py-6 text-sm" style={{ color: "#98A2B3" }}>Hali bo&apos;limga yuborilmagan</p>}
    </div>
      {children}
    </>
  );
}

/** "Ochish" — hujjat sahifasi: holat tablari, chapda ro'yxat, o'ngda tanlangan hujjat. */
export default function IjroDocDetail({ docs, depts, docId, onRefresh, kit }: {
  docs: IjroDoc[]; depts: Department[]; docId: number; onRefresh: () => void; kit: DetailKit;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const { data, error } = useTracking(docId);

  const sorted = useMemo(() => [...docs].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")), [docs]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    for (const d of docs) { const s = taskStatus(d); c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [docs]);
  const list = sorted.filter(d => {
    if (tab !== "all" && taskStatus(d) !== tab) return false;
    if (!q.trim()) return true;
    return [d.hujjat_raqami, d.sarlavha, d.mazmun, d.masul_bolimlar_nomi, d.masul_bolim_boshliqlari_nomi].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase());
  });
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  const doc = data?.doc;
  const st = doc ? taskStatus({ ...doc, masul_bolimlar_info: docs.find(x => x.id === doc.id)?.masul_bolimlar_info ?? doc.masul_bolimlar_info }) : null;
  const masulText = (d: IjroDoc) => (d.masul_bolim_boshliqlari_nomi || "").split(", ")[0] || infoOf(d)[0]?.name || "—";

  return (
    <div className="-mt-2 overflow-hidden" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 6px 30px rgba(196,203,214,0.18)" }}>
      {/* Holat tablari */}
      <div className="flex items-center overflow-x-auto" style={{ borderBottom: "1px solid #EEF1F6" }}>
        {TABS.map(t => {
          const n = counts[t.key] ?? 0, active = tab === t.key;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(0); }}
              className="flex items-center gap-2.5 px-4 py-4 text-[15px] whitespace-nowrap"
              style={{ color: "#101828", borderBottom: `2px solid ${active ? "#3F5BD8" : "transparent"}`, fontWeight: active ? 600 : 400 }}>
              {t.label}
              <span className="min-w-7 px-2 py-0.5 text-[13px] font-semibold text-white text-center" style={{ background: n ? t.color : "#D0D5DD", borderRadius: 999 }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Ro'yxat */}
        <aside className="lg:w-[420px] flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid #EEF1F6" }}>
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid #EEF1F6" }}>
            {searchOpen ? (
              <>
                <Search size={18} style={{ color: "#667085" }} />
                <input autoFocus value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Raqam, nom, bo'lim..."
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: "#101828" }} />
                <button onClick={() => { setQ(""); setPage(0); setSearchOpen(false); }} aria-label="Yopish"><X size={16} style={{ color: "#667085" }} /></button>
              </>
            ) : (
              <>
                <button onClick={() => setSearchOpen(true)} aria-label="Qidirish"><Search size={20} style={{ color: "#344054" }} /></button>
                <span className="text-sm font-semibold tracking-wide" style={{ color: "#101828" }}>TOPSHIRIQLAR RO&apos;YXATI</span>
                <span className="ml-auto text-xs" style={{ color: "#667085" }}>
                  {list.length ? `${page * PAGE + 1} - ${Math.min(list.length, (page + 1) * PAGE)} / ${list.length}` : "0"}
                </span>
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Oldingi" className="disabled:opacity-30"><ChevronLeft size={18} style={{ color: "#344054" }} /></button>
                <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} aria-label="Keyingi" className="disabled:opacity-30"><ChevronRight size={18} style={{ color: "#344054" }} /></button>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[340px] lg:max-h-[calc(100vh-260px)]">
            {shown.map(d => {
              const s = taskStatus(d), active = d.id === docId;
              return (
                <button key={d.id} onClick={() => router.replace(`/ijro/topshiriqlar/${d.id}`)}
                  className="w-full text-left px-4 py-3.5 flex flex-col gap-1 hover:bg-[#F9FAFB]"
                  style={{ background: active ? "#EEF4FF" : undefined, borderBottom: "1px solid #EEF1F6" }}>
                  <span className="flex items-center gap-2">
                    <b className="text-[15px]" style={{ color: "#101828" }}>{d.hujjat_raqami || `DOC-${d.id}`}</b>
                    <span className="ml-auto text-xs" style={{ color: "#98A2B3" }}>{fmtShort(d.hujjat_sanasi || d.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "#344054" }}>{MANBA_LABEL[d.manba] ?? ""}</span>
                    {s === "bajarilgan" ? <CheckCheck size={18} style={{ color: "#12B76A" }} /> : <StatusIcon s={s} size={16} />}
                  </span>
                  <span className="text-sm truncate" style={{ color: "#667085" }}>{d.sarlavha || d.mazmun || "—"}</span>
                  <span className="text-sm" style={{ color: "#101828" }}>
                    Bajarish muddati : <span style={{ color: s === "otgan" ? "#D92D20" : undefined }}>{d.ijro_muddati ? fmtShort(d.ijro_muddati) : "—"}</span>
                  </span>
                  <span className="mt-1 self-start px-2.5 py-1.5 text-[13px]" style={{ border: "1px solid #E4E7EC", borderRadius: 8, color: "#101828", background: "#FFFFFF" }}>{masulText(d)}</span>
                </button>
              );
            })}
            {!shown.length && <p className="text-sm text-center py-10" style={{ color: "#98A2B3" }}>Topshiriq yo&apos;q</p>}
          </div>
        </aside>

        {/* Hujjat */}
        <section className="flex-1 min-w-0" style={{ background: "#F7F9FC" }}>
          <div className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-white" style={{ borderBottom: "1px solid #EEF1F6" }}>
            <button onClick={() => router.push("/ijro/taqvim")} className="flex items-center gap-2 px-3 py-2 text-[15px] rounded-lg hover:bg-[#F2F4F7]" style={{ color: "#344054" }}>
              <ArrowLeft size={18} /> Ortga
            </button>
            <button onClick={() => setStepsOpen(true)} disabled={!doc} className="flex items-center gap-2 px-3 py-2 text-[15px] rounded-lg hover:bg-[#EEF4FF] disabled:opacity-50" style={{ color: "#3F5BD8" }}>
              <Workflow size={18} /> Ijro qadamlari
            </button>
            <button onClick={() => setNewOpen(true)} className="ml-auto flex items-center gap-2 px-3 py-2 text-[15px] rounded-lg hover:bg-[#F2F4F7]" style={{ color: "#101828" }}>
              <Plus size={18} /> Topshiriq yaratish
            </button>
          </div>

          <div className="p-3 sm:p-4 flex flex-col gap-4">
            {!data && !error ? (
              <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
            ) : error ? (
              <p className="text-sm text-center py-16" style={{ color: "#C4320A" }}>{error}</p>
            ) : doc && st && (
              <>
                <DocCards data={data!} docs={docs} />
              </>
            )}
          </div>
        </section>
      </div>

      {stepsOpen && <kit.IjroTrackingModal docId={docId} depts={depts} onClose={() => setStepsOpen(false)} />}
      {newOpen && <kit.YangiHujjatModal depts={depts} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); onRefresh(); }} />}
    </div>
  );
}
