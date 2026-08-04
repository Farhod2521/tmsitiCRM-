"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, CheckCircle2, XCircle, Clock, FileText,
  Download, RefreshCw, Building2, Loader2, Paperclip, X,
  ClipboardCheck, History, Hourglass,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type BolimHolati = "yuborildi" | "qabul_qilindi" | "rad_etildi" | "bajarilmoqda" | "tasdiq_kutilmoqda" | "bajarildi";

interface AssignLogEntry {
  id: number;
  xodim_nomi: string | null;
  assigned_by_nomi: string | null;
  assigned_at: string | null;
}

interface YakunlashFayl { name: string; b64: string; }

interface DocBolimRow {
  id: number;
  doc_id: number | null;
  bolim_id: number;
  bolim_nomi: string | null;
  holati: BolimHolati;
  izoh: string | null;
  assigned_at: string | null;
  qaror_at: string | null;
  qaror_by_nomi: string | null;
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

interface IjroDocOut {
  id: number;
  tur: string;
  manba: string;
  hujjat_raqami: string | null;
  hujjat_sanasi: string | null;
  sarlavha: string | null;
  mazmun: string | null;
  qoshimcha_malumot: string | null;
  masul_orinbosar_nomi: string | null;
  ijro_muddati: string | null;
  davriyligi: string;
  kelishuvchi_tashkilotlar: string | null;
  fayl_name: string | null;
  fayl_b64: string | null;
  holati: string;
  created_at: string | null;
}

interface Tracking {
  doc: IjroDocOut;
  bolimlar: DocBolimRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOLATI_CFG: Record<BolimHolati, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number; style?: object }> }> = {
  yuborildi:         { label: "Yuborildi",                color: "#3F8CFF", bg: "rgba(63,140,255,0.1)",  icon: Clock },
  qabul_qilindi:     { label: "Qabul qilindi",             color: "#00C48C", bg: "rgba(0,196,140,0.1)",   icon: CheckCircle2 },
  rad_etildi:        { label: "Rad etildi",                color: "#FF5C5C", bg: "rgba(255,92,92,0.1)",   icon: XCircle },
  bajarilmoqda:      { label: "Bajarilmoqda",               color: "#FFBD21", bg: "rgba(255,189,33,0.1)",  icon: RefreshCw },
  tasdiq_kutilmoqda: { label: "Tasdiqlanishi kutilmoqda",   color: "#6D5DD3", bg: "rgba(109,93,211,0.1)",  icon: Hourglass },
  bajarildi:         { label: "Bajarildi",                  color: "#00C48C", bg: "rgba(0,196,140,0.1)",   icon: CheckCircle2 },
};

const MANBA_LABELS: Record<string, string> = {
  pq_pf: "Prezident Hujjatlari (PQ/PF)",
  vm: "Vazirlar Mahkamasi (VM)",
  qv: "Vazirlik (QV)",
  direktor: "Institut direktori",
};

function HolatiChip({ h }: { h: BolimHolati }) {
  const c = HOLATI_CFG[h];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.color, borderRadius: 8 }}>
      <Icon size={11} /> {c.label}
    </span>
  );
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

// ─── O'ng panel: tafsilotlar ────────────────────────────────────────────────

function DetailPanel({ row }: { row: DocBolimRow }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [yakunlashIzoh, setYakunlashIzoh] = useState("");
  const [yakunlashFayllar, setYakunlashFayllar] = useState<YakunlashFayl[]>([]);
  const [yakunlashing, setYakunlashing] = useState(false);
  const [yakunlashError, setYakunlashError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    setLoading(true);
    return apiFetch<Tracking>(`/ijro-docs/bolim-inbox/${row.id}/detail`)
      .then(setTracking)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [row.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
    </div>
  );
  if (!tracking) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm" style={{ color: "#91929E" }}>Ma'lumot yuklanmadi</p>
    </div>
  );

  const doc = tracking.doc;
  const dl  = daysLeft(doc.ijro_muddati);
  const myRow = tracking.bolimlar.find(b => b.id === row.id) || row;

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const encoded = await Promise.all(files.map(async f => ({ name: f.name, b64: await fileToBase64(f) })));
    setYakunlashFayllar(p => [...p, ...encoded]);
    e.target.value = "";
  }

  function removeYakunlashFayl(idx: number) {
    setYakunlashFayllar(p => p.filter((_, i) => i !== idx));
  }

  async function handleYakunlash() {
    setYakunlashError(null);
    setYakunlashing(true);
    try {
      await apiFetch(`/ijro-docs/bolim-inbox/${row.id}/yakunlash`, {
        method: "POST",
        body: JSON.stringify({ izoh: yakunlashIzoh || null, fayllar: yakunlashFayllar }),
      });
      setYakunlashIzoh("");
      setYakunlashFayllar([]);
      await loadDetail();
    } catch (e) {
      setYakunlashError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setYakunlashing(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 text-white"
            style={{ background: "#3F8CFF", borderRadius: 6 }}>
            {MANBA_LABELS[doc.manba] || doc.manba}
          </span>
          {dl && (
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: dl.color }}>
              <Clock size={12} /> {dl.text}
            </span>
          )}
          <div className="ml-auto">
            <HolatiChip h={row.holati} />
          </div>
        </div>
        <h2 className="font-bold text-lg leading-snug" style={{ color: "#0A1629" }}>
          {doc.sarlavha || `№ ${doc.hujjat_raqami || doc.id}`}
        </h2>
        <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: "#91929E" }}>
          {doc.hujjat_raqami && <span>Hujjat raqami: <b style={{ color: "#0A1629" }}>№ {doc.hujjat_raqami}</b></span>}
          <span>Sana: <b style={{ color: "#0A1629" }}>{doc.hujjat_sanasi || "—"}</b></span>
          <span>Tur: <b style={{ color: "#0A1629" }}>{doc.tur}</b></span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* Topshiriq mazmuni */}
        {doc.mazmun && (
          <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#91929E" }}>Topshiriq mazmuni</p>
            <p className="text-sm leading-relaxed" style={{ color: "#0A1629" }}>{doc.mazmun}</p>
          </div>
        )}

        {doc.qoshimcha_malumot && (
          <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#91929E" }}>Qo'shimcha ma'lumot</p>
            <p className="text-sm leading-relaxed" style={{ color: "#0A1629" }}>{doc.qoshimcha_malumot}</p>
          </div>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Mas'ul o'rinbosar</p>
            <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{doc.masul_orinbosar_nomi || "—"}</p>
          </div>
          <div className="p-3" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Ijro muddati</p>
            <p className="text-sm font-bold" style={{ color: dl?.color || "#0A1629" }}>
              {fmt(doc.ijro_muddati)}
            </p>
          </div>
          <div className="p-3" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Davriyligi</p>
            <p className="text-sm font-bold" style={{ color: "#0A1629" }}>
              {doc.davriyligi === "bir_martalik" ? "Bir martalik" : doc.davriyligi === "har_chorakda" ? "Har chorakda" : "Har yili"}
            </p>
          </div>
          <div className="p-3" style={{ background: "#F4F9FD", borderRadius: 12 }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#91929E" }}>Sizga biriktirilgan</p>
            <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{fmt(row.xodim_assigned_at)}</p>
          </div>
        </div>

        {/* Fayl */}
        {doc.fayl_name && (
          <div className="flex items-center justify-between p-3"
            style={{ background: "#F4F9FD", borderRadius: 12, border: "1px dashed #D0D9E8" }}>
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: "#3F8CFF" }} />
              <span className="text-sm font-bold" style={{ color: "#0A1629" }}>{doc.fayl_name}</span>
            </div>
            <button onClick={() => doc.fayl_b64 && downloadBase64(doc.fayl_name!, doc.fayl_b64)}
              disabled={!doc.fayl_b64}
              className="w-8 h-8 flex items-center justify-center hover:opacity-70 disabled:opacity-40"
              style={{ background: "#FFFFFF", borderRadius: 8 }}>
              <Download size={14} style={{ color: "#3F8CFF" }} />
            </button>
          </div>
        )}

        {/* Bo'limlar holati */}
        {tracking.bolimlar.length > 1 && (
          <div>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#91929E" }}>
              <Building2 size={12} className="inline mr-1" />Mas'ul bo'limlar holati
            </p>
            <div className="flex flex-col gap-2">
              {tracking.bolimlar.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3"
                  style={{ background: "#FAFCFF", borderRadius: 10, border: "1px solid #F4F9FD" }}>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} style={{ color: "#7D8592" }} />
                    <span className="text-sm font-bold" style={{ color: "#0A1629" }}>{b.bolim_nomi || `Bo'lim #${b.bolim_id}`}</span>
                  </div>
                  <HolatiChip h={b.holati} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Biriktirish tarixi */}
        {myRow.assign_log.length > 0 && (
          <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
            <p className="text-[11px] font-bold mb-1.5 flex items-center gap-1 uppercase tracking-wide" style={{ color: "#91929E" }}>
              <History size={11} /> Biriktirish tarixi
            </p>
            <div className="flex flex-col gap-1.5">
              {myRow.assign_log.slice().reverse().map(log => (
                <p key={log.id} className="text-xs" style={{ color: "#7D8592" }}>
                  <b style={{ color: "#0A1629" }}>{log.xodim_nomi}</b>ga biriktirildi
                  {log.assigned_by_nomi && ` — ${log.assigned_by_nomi} tomonidan`}
                  {log.assigned_at && `, ${fmt(log.assigned_at)}`}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Topshiriqni yakunlash — qabul qilingandan keyin, hali yakunlanmagan bo'lsa */}
        {(myRow.holati === "qabul_qilindi" || myRow.holati === "bajarilmoqda") && (
          <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide flex items-center gap-1.5" style={{ color: "#91929E" }}>
              <CheckCircle2 size={13} /> Topshiriqni yakunlash
            </p>
            <textarea
              value={yakunlashIzoh} onChange={e => setYakunlashIzoh(e.target.value)}
              placeholder="Bajarilgan ish haqida izoh yozing..."
              rows={3} className="w-full px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }}
            />

            <label className="mt-3 flex items-center justify-center gap-2 py-2.5 text-sm font-bold cursor-pointer"
              style={{ background: "#FFFFFF", border: "1.5px dashed #D0D9E8", borderRadius: 10, color: "#3F8CFF" }}>
              <Paperclip size={14} /> Fayl biriktirish
              <input type="file" multiple className="hidden" onChange={handleFilesPicked} />
            </label>

            {yakunlashFayllar.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {yakunlashFayllar.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2"
                    style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #EEF2FF" }}>
                    <span className="text-xs font-bold truncate" style={{ color: "#0A1629" }}>{f.name}</span>
                    <button onClick={() => removeYakunlashFayl(i)}
                      className="w-6 h-6 flex items-center justify-center flex-shrink-0 hover:opacity-70">
                      <X size={12} style={{ color: "#FF5C5C" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleYakunlash} disabled={yakunlashing}
              className="w-full flex items-center justify-center gap-2 py-3 mt-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#00C48C", borderRadius: 12 }}>
              {yakunlashing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Bajarildi deb belgilash
            </button>
            {yakunlashError && (
              <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{yakunlashError}</p>
            )}
          </div>
        )}

        {/* Yakunlangan/tasdiq kutilayotgan topshiriq — izoh va fayllar */}
        {(myRow.holati === "tasdiq_kutilmoqda" || myRow.holati === "bajarildi") && (
          <div className="p-4" style={{
            background: myRow.holati === "bajarildi" ? "rgba(0,196,140,0.06)" : "rgba(109,93,211,0.06)",
            border: `1px solid ${myRow.holati === "bajarildi" ? "rgba(0,196,140,0.15)" : "rgba(109,93,211,0.15)"}`,
            borderRadius: 14,
          }}>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide flex items-center gap-1.5"
              style={{ color: myRow.holati === "bajarildi" ? "#00A578" : "#6D5DD3" }}>
              {myRow.holati === "bajarildi"
                ? <><CheckCircle2 size={13} /> Topshiriq yakunlandi</>
                : <><Hourglass size={13} /> Yuborildi — IJRO tasdig'ini kutmoqda</>}
            </p>
            {myRow.yakunlash_izohi && (
              <p className="text-sm mb-2" style={{ color: "#0A1629" }}>{myRow.yakunlash_izohi}</p>
            )}
            {myRow.yakunlash_fayllar.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {myRow.yakunlash_fayllar.map((f, i) => (
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
            <p className="text-xs" style={{ color: "#7D8592" }}>
              {myRow.yakunlagan_by_nomi && `${myRow.yakunlagan_by_nomi} tomonidan`}
              {myRow.yakunlangan_at && `, ${fmt(myRow.yakunlangan_at)}`}
            </p>
          </div>
        )}

        {/* Rad etilgan izoh */}
        {myRow.holati === "rad_etildi" && myRow.izoh && (
          <div className="p-3" style={{ background: "rgba(255,92,92,0.06)", border: "1px solid rgba(255,92,92,0.15)", borderRadius: 12 }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#FF5C5C" }}>Izoh:</p>
            <p className="text-sm" style={{ color: "#0A1629" }}>{myRow.izoh}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Asosiy sahifa ────────────────────────────────────────────────────────────

export default function XodimIjroNazoratiPage() {
  const [rows,     setRows]     = useState<DocBolimRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<DocBolimRow | null>(null);
  const [filterH,  setFilterH]  = useState("all");
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DocBolimRow[]>("/ijro-docs/my-tasks");
      setRows(data);
      setSelected(prev => {
        if (!data.length) return null;
        const stillThere = prev && data.find(r => r.id === prev.id);
        return stillThere || data[0];
      });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (filterH !== "all" && r.holati !== filterH) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.doc_sarlavha || "").toLowerCase().includes(s) || (r.doc_hujjat_raqami || "").toLowerCase().includes(s);
    }
    return true;
  });

  const counts = {
    all:               rows.length,
    qabul_qilindi:     rows.filter(r => r.holati === "qabul_qilindi" || r.holati === "bajarilmoqda").length,
    tasdiq_kutilmoqda: rows.filter(r => r.holati === "tasdiq_kutilmoqda").length,
    bajarildi:         rows.filter(r => r.holati === "bajarildi").length,
    rad_etildi:        rows.filter(r => r.holati === "rad_etildi").length,
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="font-bold text-xl" style={{ color: "#0A1629" }}>Ijro nazorati</h1>
        <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Sizga shaxsan biriktirilgan topshiriqlar</p>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[340px] flex-shrink-0 flex flex-col"
          style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)", overflow: "hidden" }}>

          {/* Search + filter */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
            <div className="flex items-center gap-2 px-3 py-2.5 mb-3"
              style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <Search size={14} style={{ color: "#91929E" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Hujjat nomi yoki raqami..." className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#0A1629" }} />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {[
                { key: "all",               label: `Barchasi (${counts.all})` },
                { key: "qabul_qilindi",     label: `Jarayonda (${counts.qabul_qilindi})` },
                { key: "tasdiq_kutilmoqda", label: `Tasdiq kutmoqda (${counts.tasdiq_kutilmoqda})` },
                { key: "bajarildi",         label: `Bajarildi (${counts.bajarildi})` },
                { key: "rad_etildi",        label: `Rad (${counts.rad_etildi})` },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterH(f.key)}
                  className="px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
                  style={{
                    borderRadius: 8,
                    background: filterH === f.key ? "#0A1629" : "#F4F9FD",
                    color: filterH === f.key ? "#FFFFFF" : "#7D8592",
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <ClipboardCheck size={32} className="mb-3" style={{ color: "#D0D9E8" }} />
                <p className="text-sm font-bold" style={{ color: "#91929E" }}>Topshiriq yo'q</p>
                <p className="text-xs mt-1" style={{ color: "#91929E" }}>Sizga hali hech qanday topshiriq biriktirilmagan</p>
              </div>
            ) : filtered.map(r => {
              const cfg = HOLATI_CFG[r.holati];
              return (
                <div key={r.id}
                  onClick={() => setSelected(r)}
                  className="px-4 py-4 cursor-pointer transition-colors"
                  style={{
                    borderBottom: "1px solid #F4F9FD",
                    background: selected?.id === r.id ? "rgba(63,140,255,0.06)" : undefined,
                    borderLeft: selected?.id === r.id ? "3px solid #3F8CFF" : "3px solid transparent",
                  }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <HolatiChip h={r.holati} />
                    <span className="text-xs ml-auto" style={{ color: "#91929E" }}>
                      {fmt(r.xodim_assigned_at)}
                    </span>
                  </div>
                  <p className="text-sm font-bold leading-snug" style={{ color: "#0A1629" }}>
                    {r.doc_sarlavha || (r.doc_hujjat_raqami ? `№ ${r.doc_hujjat_raqami}` : `Hujjat #${r.doc_id || r.id}`)}
                  </p>
                  {r.doc_manba && (
                    <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                      {MANBA_LABELS[r.doc_manba] || r.doc_manba}
                    </p>
                  )}
                  {r.doc_ijro_muddati && (() => {
                    const dl = daysLeft(r.doc_ijro_muddati);
                    return dl ? (
                      <p className="text-xs mt-0.5 font-bold" style={{ color: dl.color }}>{dl.text}</p>
                    ) : null;
                  })()}
                  {r.izoh && (
                    <p className="text-xs mt-1 truncate" style={{ color: "#91929E" }}>{r.izoh}</p>
                  )}
                  {r.qaror_by_nomi && (
                    <p className="text-xs mt-0.5" style={{ color: cfg.color }}>
                      {r.qaror_by_nomi} tomonidan {r.holati === "qabul_qilindi" ? "qabul qilindi" : "rad etildi"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden"
          style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
          {selected ? (
            <DetailPanel key={selected.id} row={selected} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: "#91929E" }}>
              <ClipboardCheck size={48} className="mb-4" style={{ color: "#D0D9E8" }} />
              <p className="text-sm font-bold">Topshiriqni tanlang</p>
              <p className="text-xs mt-1">Chap paneldan hujjatni bosing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
