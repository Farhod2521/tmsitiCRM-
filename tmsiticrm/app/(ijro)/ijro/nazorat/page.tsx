"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Bell, Settings, Eye, ArrowRight,
  ChevronDown, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  FileText, Calendar, Upload, LayoutDashboard, List,
  X, Loader2, Plus, CloudUpload, RefreshCw,
  Send, ChevronLeft, ChevronRight, Pencil, Trash2,
  Crown, Scale, Wallet, Settings2, BookOpen, Globe, Award,
  ShieldCheck, Zap, FlaskConical, GraduationCap, Megaphone,
  ClipboardCheck, Calculator, Monitor, MapPinned, ShieldAlert,
  PenTool, Wrench, Layers, Briefcase, Building2, Users, Download, XCircle,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocHolati = "jarayonda" | "bajarildi" | "muddati_yaqin" | "kechikmoqda" | "bolimga_yonaltirildi";
type DocManba  = "pq_pf" | "vm" | "qv" | "direktor";
type DocTur    = "kiruvchi" | "chiquvchi" | "ichki";

interface BolimInfo { id: number; name: string; holati: string; }

interface IjroDoc {
  id: number;
  tur: DocTur;
  manba: DocManba;
  hujjat_raqami: string | null;
  hujjat_sanasi: string | null;
  sarlavha: string | null;
  mazmun: string | null;
  qoshimcha_malumot: string | null;
  masul_orinbosar_id: number | null;
  masul_orinbosar_nomi: string | null;
  masul_bolimlar: string | null;
  masul_bolimlar_nomi: string | null;
  masul_bolimlar_info: string | null;
  ijro_muddati: string | null;
  davriyligi: string;
  kelishuvchi_tashkilotlar: string | null;
  fayl_name: string | null;
  fayl_b64: string | null;
  holati: DocHolati;
  qayta_sabab: string | null;
  created_at: string | null;
}

interface Department { id: number; name: string; dept_type: string; }
interface Employee   { id: number; full_name: string; role: string; position: string; department_id: number | null; }

type BolimHolati = "yuborildi" | "qabul_qilindi" | "rad_etildi" | "bajarilmoqda" | "tasdiq_kutilmoqda" | "bajarildi";

interface AssignLogEntry {
  id: number;
  xodim_nomi: string | null;
  assigned_by_nomi: string | null;
  assigned_at: string | null;
}

interface DocBolimRow {
  id: number;
  bolim_id: number;
  bolim_nomi: string | null;
  holati: BolimHolati;
  izoh: string | null;
  assigned_at: string | null;
  qaror_at: string | null;
  qaror_by_nomi: string | null;
  xodim_nomi: string | null;
  xodim_assigned_at: string | null;
  assign_log: AssignLogEntry[];
  yakunlash_izohi: string | null;
  yakunlash_fayllar: YakunlashFayl[];
  yakunlangan_at: string | null;
  yakunlagan_by_nomi: string | null;
}

interface YakunlashFayl { name: string; b64: string; }

interface IjroTracking {
  doc: IjroDoc;
  bolimlar: DocBolimRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MANBA_LABELS: Record<DocManba, string> = {
  pq_pf: "Prezident Hujjatlari",
  vm:    "Vazirlar Mahkamasi",
  qv:    "Vazirlik (QV)",
  direktor: "Institut direktori",
};

const HOLATI_CFG: Record<DocHolati, { label: string; color: string; bg: string }> = {
  jarayonda:            { label: "Jarayonda",         color: "#3F8CFF", bg: "rgba(63,140,255,0.12)"  },
  bajarildi:            { label: "Bajarildi",         color: "#00C48C", bg: "rgba(0,196,140,0.12)"   },
  muddati_yaqin:        { label: "Muddati yaqin",     color: "#FFBD21", bg: "rgba(255,189,33,0.12)"  },
  kechikmoqda:          { label: "Kechikmoqda",       color: "#FF5C5C", bg: "rgba(255,92,92,0.12)"   },
  bolimga_yonaltirildi: { label: "Bo'limga yo'naltirildi", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
};

const TASHKILOTLAR = [
  "Iqtisodiyot va moliya vazirligi",
  "Adliya vazirligi",
  "Raqamli texnologiyalar vazirligi",
  "Qurilish va uy-joy kommunal xo'jaligi vazirligi",
];

// Bo'lim nomidagi kalit so'zga qarab eng mos ikonani tanlaydi — barchasi bitta
// (ko'k) rangda chiziladi, faqat shakli bo'lim mavzusiga mos bo'ladi.
function deptIcon(name: string, deptType: string) {
  const n = name.toLowerCase();
  if (n.includes("rahbariyat"))                                    return Crown;
  if (n.includes("yuridik"))                                        return Scale;
  if (n.includes("buxgalteriya") || n.includes("moliya"))           return Wallet;
  if (n.includes("inson resurs"))                                   return Users;
  if (n.includes("me'yorlash") || n.includes("meyorlash"))          return Settings2;
  if (n.includes("tizimlashtirish") || n.includes("atamalar"))      return BookOpen;
  if (n.includes("xalqaro norma"))                                  return Globe;
  if (n.includes("standart"))                                       return Award;
  if (n.includes("muvofiqlik"))                                     return ShieldCheck;
  if (n.includes("energo"))                                         return Zap;
  if (n.includes("ilmiy") || n.includes("innovatsi"))                return FlaskConical;
  if (n.includes("ta'lim") || n.includes("talim"))                   return GraduationCap;
  if (n.includes("marketing") || n.includes("xalqaro aloqa"))        return Megaphone;
  if (n.includes("ijro nazorati"))                                  return ClipboardCheck;
  if (n.includes("narxlarni shakllantirish"))                       return Calculator;
  if (n.includes("axborot texnologiya"))                            return Monitor;
  if (n.includes("raqamli texnologiya") || n.includes("shaharsozlik")) return MapPinned;
  if (n.includes("komplaens"))                                      return ShieldAlert;
  if (n.includes("loyihalashtirish"))                                return PenTool;
  if (n.includes("texnik va xizmat"))                                return Wrench;
  if (deptType === "rahbariyat") return Crown;
  if (deptType === "boshqarma")  return Layers;
  if (deptType === "xizmat")     return Briefcase;
  return Building2;
}

interface DeptTaskStat { dept: Department; total: number; kamQoldi: number; vaqtiBor: number; bajarildi: number; urgent1: number; within5: number; }

// Shu bo'limga hozir biriktirilgan (rad etilmagan) hujjatlar ro'yxati.
function assignedDocs(dept: Department, docs: IjroDoc[]): IjroDoc[] {
  return docs.filter(d => {
    if (!d.masul_bolimlar_info) return false;
    try {
      const info: BolimInfo[] = JSON.parse(d.masul_bolimlar_info);
      return info.some(b => b.id === dept.id && b.holati !== "rad_etildi");
    } catch { return false; }
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// Har bir bo'limga biriktirilgan hujjatlar bo'yicha statistika.
function computeDeptStats(depts: Department[], docs: IjroDoc[]): DeptTaskStat[] {
  return depts.map(dept => {
    const assigned = assignedDocs(dept, docs);
    const active   = assigned.filter(d => d.holati !== "bajarildi");
    return {
      dept,
      total:     assigned.length,
      kamQoldi:  assigned.filter(d => d.holati === "muddati_yaqin" || d.holati === "kechikmoqda").length,
      vaqtiBor:  assigned.filter(d => d.holati === "jarayonda" || d.holati === "bolimga_yonaltirildi").length,
      bajarildi: assigned.filter(d => d.holati === "bajarildi").length,
      // Muddatiga 1 kun yoki kamroq qolgan (yoki o'tib ketgan) topshiriqlar soni
      urgent1:   active.filter(d => { const dd = daysUntil(d.ijro_muddati); return dd !== null && dd <= 1; }).length,
      // Muddatiga 5 kundan kam qolgan topshiriqlar soni
      within5:   active.filter(d => { const dd = daysUntil(d.ijro_muddati); return dd !== null && dd < 5; }).length,
    };
  });
}

// ─── Bo'limlar Metro grid ──────────────────────────────────────────────────────

// Har bir bo'limga barqaror (id asosida) rang mavzusi — davlat-idora uslubidagi
// palitra, doim bir xil bo'lim bir xil rangda chiqadi.
const TILE_THEMES: { bg: string; text: string; iconBg: string; border?: string }[] = [
  { bg: "#003366", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.12)" },
  { bg: "#006666", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" },
  { bg: "#455A64", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" },
  { bg: "#FFFFFF", text: "#0A1629", iconBg: "rgba(63,140,255,0.1)", border: "#E2E8F0" },
  { bg: "#005FAD", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" },
  { bg: "#CFF7F5", text: "#00504F", iconBg: "rgba(0,80,79,0.08)" },
  { bg: "#B02C0E", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" },
  { bg: "#E4F5F4", text: "#006666", iconBg: "rgba(0,102,102,0.1)", border: "#B7E4E2" },
  { bg: "#1B1B1B", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.1)" },
  { bg: "#D4E3FF", text: "#001C39", iconBg: "rgba(0,28,57,0.08)" },
  { bg: "#717784", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" },
  { bg: "#FFDAD6", text: "#93000A", iconBg: "rgba(147,0,10,0.08)" },
  { bg: "#77F6F3", text: "#00201F", iconBg: "rgba(0,32,31,0.08)" },
];
function tileTheme(deptId: number) {
  return TILE_THEMES[deptId % TILE_THEMES.length];
}

type TileSize = "s" | "w" | "l";
function tileSize(dept: Department, isHero: boolean): TileSize {
  if (dept.dept_type === "rahbariyat") return "w";
  if (isHero) return "l";
  return dept.id % 3 === 0 ? "w" : "s";
}
const TILE_SPAN: Record<TileSize, string> = { s: "", w: "col-span-2", l: "col-span-2 row-span-2" };

// Topshirig'i yo'q bo'limlar uchun — shaffof, kulrang, "noactive" ko'rinish,
// rangli mavzudan aniq ajralib turishi uchun.
const EMPTY_TILE_THEME = { bg: "#FAFCFF", text: "#B0B8C4", iconBg: "rgba(176,184,196,0.12)", border: "#EDF1F7" };

function MetroTile({ dept, total, kamQoldi, size, onClick }: {
  dept: Department; total: number; kamQoldi: number; size: TileSize; onClick: () => void;
}) {
  const Icon = deptIcon(dept.name, dept.dept_type);
  const isEmpty = total === 0;
  const theme = isEmpty ? EMPTY_TILE_THEME : tileTheme(dept.id);
  const isPriority = dept.dept_type === "rahbariyat";

  return (
    <button onClick={onClick}
      className={`group relative flex flex-col justify-between p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${TILE_SPAN[size]}`}
      style={{
        background: theme.bg,
        borderRadius: 12,
        border: `1px ${isEmpty ? "dashed" : "solid"} ${theme.border || "transparent"}`,
        opacity: isEmpty ? 0.7 : 1,
      }}>

      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-lg flex items-center justify-center transition-colors" style={{ background: theme.iconBg }}>
          <Icon size={size === "l" ? 26 : 20} style={{ color: theme.text }} />
        </div>
        {isPriority && !isEmpty && (
          <span className="text-[9px] font-bold border px-2 py-1 tracking-widest uppercase rounded flex-shrink-0"
            style={{ borderColor: `${theme.text}4D`, color: theme.text }}>
            Priority
          </span>
        )}
      </div>

      <div>
        <h3 className={`font-bold leading-tight ${size === "l" ? "text-xl" : size === "w" ? "text-base" : "text-sm"}`}
          style={{
            color: theme.text,
            display: "-webkit-box",
            WebkitLineClamp: size === "s" ? 2 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
          {dept.name}
        </h3>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {kamQoldi > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full text-white flex-shrink-0" style={{ background: "#FF5C5C" }}>
              <AlertTriangle size={11} /> {kamQoldi}
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: isEmpty ? "rgba(176,184,196,0.15)" : `${theme.text}22`, color: theme.text }}>
            {total} jami
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Bo'limga biriktirilgan topshiriqlar modali ───────────────────────────────

function DeptTasksModal({ dept, docs, depts, onClose }: { dept: Department; docs: IjroDoc[]; depts: Department[]; onClose: () => void }) {
  // Muddati kam qolgan (yoki o'tib ketgan) topshiriqlar birinchi bo'lib chiqadi
  const tasks = [...assignedDocs(dept, docs)].sort((a, b) => {
    const da = daysUntil(a.ijro_muddati);
    const db = daysUntil(b.ijro_muddati);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  const [trackingDocId, setTrackingDocId] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>{dept.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{tasks.length} ta biriktirilgan topshiriq</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tasks.length === 0 ? (
            <div className="text-center py-12" style={{ background: "#F4F9FD", borderRadius: 12 }}>
              <FileText size={28} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
              <p className="text-sm" style={{ color: "#91929E" }}>Bu bo'limga hech qanday topshiriq biriktirilmagan</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasks.map(d => {
                const dl  = daysLeft(d.ijro_muddati);
                const agg = docAggHolati(d);
                const cfg = agg === "none" ? HOLATI_CFG[d.holati] : BOLIM_H_CFG[agg];
                return (
                  <button key={d.id} onClick={() => setTrackingDocId(d.id)}
                    className="text-left p-4 hover:opacity-80 transition-opacity"
                    style={{ background: "#F4F9FD", borderRadius: 12 }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: "#3F8CFF" }}>№ {d.hujjat_raqami || `DOC-${d.id}`}</span>
                      <span className="text-xs font-bold px-2 py-1" style={{ background: cfg.bg, color: cfg.color, borderRadius: 8 }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: "#0A1629" }}>{d.mazmun || d.sarlavha || "—"}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs font-bold" style={{ color: dl.color }}>
                      <Clock size={11} /> {dl.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {trackingDocId && (
        <div onClick={e => e.stopPropagation()}>
          <IjroTrackingModal
            docId={trackingDocId}
            depts={depts}
            onClose={() => setTrackingDocId(null)}
          />
        </div>
      )}
    </div>
  );
}

function BolimlarMetroGrid({ depts, docs }: { depts: Department[]; docs: IjroDoc[] }) {
  // Topshiriqlar soni ko'p bo'lgan bo'lim birinchi bo'lib chiqadi
  const stats = computeDeptStats(depts, docs).sort((a, b) => b.total - a.total);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  if (depts.length === 0) return null;

  // Eng ko'p topshiriqli (rahbariyatdan boshqa) bo'lim — katta "hero" katak bo'ladi
  const heroId = stats
    .filter(s => s.dept.dept_type !== "rahbariyat" && s.total > 0)
    .sort((a, b) => b.total - a.total)[0]?.dept.id;

  const totalUrgent1 = stats.reduce((sum, s) => sum + s.urgent1, 0);
  const totalWithin5 = stats.reduce((sum, s) => sum + s.within5, 0);
  const totalAll     = stats.reduce((sum, s) => sum + s.total, 0);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(196,203,214,0.15)" }}>
      <div className="px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>Bo'limlar bo'yicha topshiriqlar</h2>
          <span className="text-xs font-bold px-2.5 py-1" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 8 }}>
            {depts.length} ta bo'lim
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C" }}>
            <AlertTriangle size={12} /> {totalUrgent1} Shoshilinch
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,189,33,0.14)", color: "#B8860B" }}>
            <Clock size={12} /> {totalWithin5} Muddati yaqin
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(0,196,140,0.1)", color: "#00A578" }}>
            <CheckCircle2 size={12} /> {totalAll} Nazoratda
          </span>
        </div>
      </div>
      <div className="p-5" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gridAutoRows: 170,
        gridAutoFlow: "dense",
        gap: 12,
      }}>
        {stats.map(s => (
          <MetroTile key={s.dept.id} dept={s.dept} total={s.total} kamQoldi={s.kamQoldi}
            size={tileSize(s.dept, s.dept.id === heroId)} onClick={() => setSelectedDept(s.dept)} />
        ))}
      </div>

      {selectedDept && (
        <DeptTasksModal dept={selectedDept} docs={docs} depts={depts} onClose={() => setSelectedDept(null)} />
      )}
    </div>
  );
}

function daysLeft(dateStr: string | null): { text: string; color: string } {
  if (!dateStr) return { text: "—", color: "#91929E" };
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { text: `${Math.abs(diff)} kun o'tgan`, color: "#FF5C5C" };
  if (diff === 0) return { text: "Bugun",            color: "#FF5C5C" };
  if (diff <= 3)  return { text: `${diff} kun qoldi`, color: "#FFBD21" };
  return           { text: `${diff} kun qoldi`,      color: "#00C48C" };
}

// ─── Small components ─────────────────────────────────────────────────────────

function HolatiChip({ h }: { h: DocHolati }) {
  const c = HOLATI_CFG[h];
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.color, borderRadius: 8 }}>
      {c.label}
    </span>
  );
}

// ─── Modal: Yangi hujjat ─────────────────────────────────────────────────────

function YangiHujjatModal({ depts, onClose, onSaved, editDoc }:
  { depts: Department[]; onClose: () => void; onSaved: () => void; editDoc?: IjroDoc }) {

  const isEdit = !!editDoc;

  const [saving, setSaving] = useState(false);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(editDoc?.fayl_name ?? null);
  const [orinbosarlar, setOrinbosarlar] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [masulBolimlar, setMasulBolimlar] = useState<number[]>(() => {
    if (!editDoc?.masul_bolimlar) return [];
    try { return JSON.parse(editDoc.masul_bolimlar); } catch { return []; }
  });
  const [bolimXodimlar, setBolimXodimlar] = useState<Record<number, number>>({});
  const [kelishuvchi, setKelishuvchi] = useState<string[]>(() =>
    editDoc?.kelishuvchi_tashkilotlar ? editDoc.kelishuvchi_tashkilotlar.split(", ").filter(Boolean) : []
  );

  const [form, setForm] = useState({
    tur:             (editDoc?.tur ?? "kiruvchi") as DocTur,
    manba:           (editDoc?.manba ?? "") as DocManba | "",
    hujjat_raqami:   editDoc?.hujjat_raqami   ?? "",
    hujjat_sanasi:   editDoc?.hujjat_sanasi   ?? "",
    sarlavha:        editDoc?.sarlavha         ?? "",
    mazmun:          editDoc?.mazmun           ?? "",
    qoshimcha_malumot: editDoc?.qoshimcha_malumot ?? "",
    masul_orinbosar_id: editDoc?.masul_orinbosar_id ?? null as number | null,
    ijro_muddati:    editDoc?.ijro_muddati ? editDoc.ijro_muddati.replace("Z","").slice(0,16) : "",
    davriyligi:      editDoc?.davriyligi   ?? "bir_martalik",
  });

  useEffect(() => {
    apiFetch<Employee[]>("/employees/")
      .then(list => {
        setOrinbosarlar(list.filter(e => e.role === "zamdirektor"));
        setAllEmployees(list);
      })
      .catch(() => {});
  }, []);

  function setF(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  function bolimBoshligi(bolimId: number): Employee | undefined {
    return allEmployees.find(e =>
      e.department_id === bolimId && (e.role === "bolim_boshligi" || e.role === "boshqarma_boshligi"));
  }

  function toggleBolim(id: number) {
    setMasulBolimlar(p => {
      const next = p.includes(id) ? p.filter(x => x !== id) : [...p, id];
      return next;
    });
    setBolimXodimlar(p => {
      if (masulBolimlar.includes(id)) {
        // o'chirilyapti — tanlovni ham olib tashlaymiz
        const { [id]: _drop, ...rest } = p;
        return rest;
      }
      // yangi bo'lim tanlandi — avtomatik bo'lim boshlig'ini belgilaymiz
      const head = bolimBoshligi(id);
      return head ? { ...p, [id]: head.id } : p;
    });
  }

  function setBolimXodim(bolimId: number, xodimId: number) {
    setBolimXodimlar(p => ({ ...p, [bolimId]: xodimId }));
  }
  function toggleTashkilot(t: string) {
    setKelishuvchi(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setFileB64(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.manba) return;
    setSaving(true);
    const payload = {
      ...form,
      manba:                    form.manba,
      ijro_muddati:             form.ijro_muddati || null,
      hujjat_sanasi:            form.hujjat_sanasi || null,
      masul_bolimlar:           masulBolimlar.length ? JSON.stringify(masulBolimlar) : null,
      masul_bolimlar_xodimlar:  masulBolimlar.length ? JSON.stringify(bolimXodimlar) : null,
      kelishuvchi_tashkilotlar: kelishuvchi.length ? kelishuvchi.join(", ") : null,
      fayl_name:                fileName,
      fayl_b64:                 fileB64,
    };
    try {
      if (isEdit) {
        await apiFetch(`/ijro-docs/${editDoc!.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/ijro-docs/", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #F4F9FD" }}>
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>{isEdit ? "Hujjatni tahrirlash" : "Yangi hujjatni ro'yxatga olish"}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="doc-form" onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Hujjat manbasi */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat manbasi *</label>
              <div className="relative">
                <select required value={form.manba} onChange={e => setF("manba", e.target.value)}
                  className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: form.manba ? "#0A1629" : "#91929E" }}>
                  <option value="">Manbani tanlang...</option>
                  <option value="pq_pf">Prezident Hujjatlari (PQ/PF)</option>
                  <option value="vm">Vazirlar Mahkamasi (VM)</option>
                  <option value="qv">Vazirlik (QV)</option>
                  <option value="direktor">Institut direktori</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
              </div>
            </div>

            {/* Hujjat raqami + sanasi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat raqami</label>
                <input value={form.hujjat_raqami} onChange={e => setF("hujjat_raqami", e.target.value)}
                  placeholder="Masalan: 01-12/345" className="w-full px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
              </div>
              <div>
                <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat sanasi</label>
                <input type="date" value={form.hujjat_sanasi} onChange={e => setF("hujjat_sanasi", e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
              </div>
            </div>

            {/* Sarlavha */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Hujjat bandi</label>
              <input value={form.sarlavha} onChange={e => setF("sarlavha", e.target.value)}
                placeholder="Hujjatning qisqacha mazmuni yoki sarlavhasi"
                className="w-full px-4 py-3 text-sm font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            </div>

            {/* Topshiriq mazmuni */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Topshiriq mazmuni</label>
              <textarea value={form.mazmun} onChange={e => setF("mazmun", e.target.value)}
                placeholder="Bajarilishi kerak bo'lgan vazifalar va ko'rsatmalarni batafsil yozing..."
                rows={4} className="w-full px-4 py-3 text-sm font-bold outline-none resize-y"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            </div>

            {/* Qo'shimcha ma'lumot */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Qo'shimcha ma'lumot</label>
              <textarea value={form.qoshimcha_malumot} onChange={e => setF("qoshimcha_malumot", e.target.value)}
                placeholder="Qo'shimcha izoh yoki ma'lumot..."
                rows={3} className="w-full px-4 py-3 text-sm font-bold outline-none resize-y"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            </div>

            {/* Ijrochi (mas'ul direktor o'rinbosari) */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Ijrochi</label>
              <div className="relative">
                <select
                  value={form.masul_orinbosar_id ?? ""}
                  onChange={e => setF("masul_orinbosar_id", e.target.value ? Number(e.target.value) : null)}
                  className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: form.masul_orinbosar_id ? "#0A1629" : "#91929E" }}>
                  <option value="">Tanlanmagan</option>
                  {orinbosarlar.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` (${e.position})` : ""}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
              </div>
            </div>

            {/* Mas'ul bo'lim (multi-select checkboxes) */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Mas'ul bo'lim</label>
              <div className="p-3 max-h-64 overflow-y-auto flex flex-col gap-2"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF" }}>
                {depts.map(d => {
                  const checked = masulBolimlar.includes(d.id);
                  const deptEmployees = allEmployees.filter(e => e.department_id === d.id);
                  return (
                    <div key={d.id} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={checked}
                          onChange={() => toggleBolim(d.id)} className="accent-[#3F8CFF] w-4 h-4" />
                        <span className="text-sm" style={{ color: "#0A1629" }}>{d.name}</span>
                      </label>
                      {checked && (
                        <div className="ml-6 relative">
                          <select
                            value={bolimXodimlar[d.id] ?? ""}
                            onChange={e => setBolimXodim(d.id, Number(e.target.value))}
                            className="w-full appearance-none px-3 py-2 text-xs font-bold outline-none"
                            style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #EEF2FF", color: "#0A1629" }}>
                            <option value="">Ijrochi xodim tanlanmagan</option>
                            {deptEmployees.map(e => (
                              <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` (${e.position})` : ""}</option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-2.5 pointer-events-none" style={{ color: "#91929E" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {depts.length === 0 && <p className="text-xs" style={{ color: "#91929E" }}>Bo'limlar yuklanmoqda...</p>}
              </div>
            </div>

            {/* Ijro muddati */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Yakuniy ijro muddati</label>
                <input type="datetime-local" value={form.ijro_muddati} onChange={e => setF("ijro_muddati", e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
              </div>
              <div>
                <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Topshiriq davriyligi</label>
                <div className="flex flex-col gap-2 pt-1">
                  {([["bir_martalik","Bir martalik"],["har_chorakda","Har chorakda"],["har_yili","Har yili"]] as const).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="davriyligi" value={v} checked={form.davriyligi === v}
                        onChange={() => setF("davriyligi", v)} className="accent-[#3F8CFF]" />
                      <span className="text-sm" style={{ color: "#0A1629" }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Kelishuvchi tashkilotlar */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Kelishuvchi tashkilotlar</label>
              <div className="p-3 flex flex-col gap-2"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF" }}>
                {TASHKILOTLAR.map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={kelishuvchi.includes(t)}
                      onChange={() => toggleTashkilot(t)} className="accent-[#3F8CFF] w-4 h-4" />
                    <span className="text-sm" style={{ color: "#0A1629" }}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fayl yuklash */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Fayllarni biriktirish</label>
              <label className="flex flex-col items-center justify-center gap-3 py-8 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ border: "2px dashed #D0D9E8", borderRadius: 14, background: "#FAFCFF" }}>
                <div className="w-12 h-12 flex items-center justify-center"
                  style={{ background: "rgba(0,196,140,0.1)", borderRadius: 12 }}>
                  <CloudUpload size={22} style={{ color: "#3F8CFF" }} />
                </div>
                {fileName
                  ? <p className="text-sm font-bold" style={{ color: "#00C48C" }}>{fileName}</p>
                  : <>
                    <p className="text-sm font-bold" style={{ color: "#0A1629" }}>Faylni tanlang yoki shu yerga tashlang</p>
                    <p className="text-xs" style={{ color: "#91929E" }}>PDF, DOCX, ZIP (Maks. 20MB)</p>
                  </>
                }
                <input type="file" accept=".pdf,.docx,.zip" className="hidden" onChange={handleFile} />
              </label>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid #F4F9FD" }}>
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold"
            style={{ background: "#F4F9FD", borderRadius: 12, color: "#7D8592" }}>
            Bekor qilish
          </button>
          <button type="submit" form="doc-form" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(63,140,255,0.3)" }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : isEdit ? <Pencil size={15}/> : <Send size={15} />}
            {isEdit ? "Saqlash" : "Topshiriqni yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kuzatuv modal (Ijro uchun) ──────────────────────────────────────────────

const BOLIM_H_CFG: Record<BolimHolati, { label: string; color: string; bg: string }> = {
  yuborildi:         { label: "Yuborildi",               color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  qabul_qilindi:     { label: "Qabul qilindi",            color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  rad_etildi:        { label: "Rad etildi",               color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  bajarilmoqda:      { label: "Bajarilmoqda",              color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
  tasdiq_kutilmoqda: { label: "Tasdiqlanishi kutilmoqda",  color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
  bajarildi:         { label: "Bajarildi",                 color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
};

// Bo'limlar holatidan hujjatning umumiy (agregat) holatini chiqaradi — hujjatning
// o'zidagi "holati" maydoni faqat to'liq yopilganda o'zgaradi, jadvalda esa
// bo'limlar real holatini ko'rsatish kerak.
function aggregateBolimHolati(items: BolimInfo[]): BolimHolati {
  if (items.some(i => i.holati === "bajarilmoqda")) return "bajarilmoqda";
  if (items.some(i => i.holati === "tasdiq_kutilmoqda")) return "tasdiq_kutilmoqda";
  if (items.some(i => i.holati === "qabul_qilindi")) return "qabul_qilindi";
  const nonRejected = items.filter(i => i.holati !== "rad_etildi");
  if (nonRejected.length > 0 && nonRejected.every(i => i.holati === "bajarildi")) return "bajarildi";
  if (items.length > 0 && items.every(i => i.holati === "rad_etildi")) return "rad_etildi";
  return "yuborildi";
}

// Hujjatning ko'rsatiladigan/filtrlanadigan holati — bo'limlar bo'yicha agregat,
// hali birorta bo'limga yuborilmagan bo'lsa "none" (hujjatning o'z "holati"
// maydoni fallback sifatida ishlatiladi).
function docAggHolati(d: IjroDoc): BolimHolati | "none" {
  if (d.holati === "bajarildi") return "bajarildi";
  let items: BolimInfo[] = [];
  try { items = JSON.parse(d.masul_bolimlar_info || "[]"); } catch { /* noop */ }
  if (items.length === 0) return "none";
  return aggregateBolimHolati(items);
}

function fmtDt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function downloadBase64(name: string, b64: string) {
  const a = document.createElement("a");
  a.href = b64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function IjroTrackingModal({ docId, depts, onClose }: {
  docId: number;
  depts: Department[];
  onClose: () => void;
}) {
  const [tracking, setTracking] = useState<IjroTracking | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [selBolim, setSelBolim] = useState<number | "">("");
  const [adding,   setAdding]   = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<IjroTracking>(`/ijro-docs/${docId}/tracking`)
      .then(setTracking)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function handleIjroQaror(bolimId: number, qaror: "yechish" | "rad_etish") {
    if (qaror === "rad_etish" && !confirm("Bo'lim hisobotini rad etishni tasdiqlaysizmi?")) return;
    setReviewingId(bolimId);
    try {
      await apiFetch(`/ijro-docs/bolim-inbox/${bolimId}/ijro-qaror`, {
        method: "POST",
        body: JSON.stringify({ qaror }),
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleAddBolim() {
    if (!selBolim) return;
    setAdding(true);
    try {
      const res = await apiFetch<IjroTracking>(`/ijro-docs/${docId}/add-bolim`, {
        method: "POST",
        body: JSON.stringify({ bolim_id: selBolim }),
      });
      setTracking(res);
      setSelBolim("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setAdding(false);
    }
  }

  const assignedIds = tracking?.bolimlar.map(b => b.bolim_id) ?? [];
  const availableDepts = depts.filter(d => !assignedIds.includes(d.id));
  const rejectedDepts  = tracking?.bolimlar.filter(b => b.holati === "rad_etildi") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "#0A1629" }}>Hujjat kuzatuvi</h2>
            {tracking && (
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>
                {tracking.doc.sarlavha || `№ ${tracking.doc.hujjat_raqami || docId}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
            </div>
          ) : !tracking ? (
            <p className="text-sm text-center py-8" style={{ color: "#91929E" }}>Ma'lumot yuklanmadi</p>
          ) : (
            <>
              {/* Hujjatga biriktirilgan fayl */}
              {tracking.doc.fayl_name && (
                <div className="flex items-center justify-between p-3"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1px dashed #D0D9E8" }}>
                  <div className="flex items-center gap-2">
                    <FileText size={16} style={{ color: "#3F8CFF" }} />
                    <span className="text-sm font-bold" style={{ color: "#0A1629" }}>{tracking.doc.fayl_name}</span>
                  </div>
                  <button onClick={() => tracking.doc.fayl_b64 && downloadBase64(tracking.doc.fayl_name!, tracking.doc.fayl_b64)}
                    disabled={!tracking.doc.fayl_b64}
                    className="w-8 h-8 flex items-center justify-center hover:opacity-70 disabled:opacity-40"
                    style={{ background: "#FFFFFF", borderRadius: 8 }}>
                    <Download size={14} style={{ color: "#3F8CFF" }} />
                  </button>
                </div>
              )}

              {/* Bo'limlar holati */}
              <div>
                <p className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: "#91929E" }}>
                  Bo'limlar bo'yicha holat ({tracking.bolimlar.length} ta)
                </p>
                {tracking.bolimlar.length === 0 ? (
                  <p className="text-sm" style={{ color: "#91929E" }}>Hali hech qaysi bo'limga biriktirilmagan</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {tracking.bolimlar.map(b => {
                      const cfg = BOLIM_H_CFG[b.holati];
                      const steps: BolimHolati[] = ["yuborildi", "qabul_qilindi", "bajarilmoqda", "tasdiq_kutilmoqda", "bajarildi"];
                      const stepIdx = b.holati === "rad_etildi" ? 0 : steps.indexOf(b.holati);
                      return (
                        <div key={b.id} className="p-4"
                          style={{
                            background: b.holati === "rad_etildi" ? "rgba(255,92,92,0.04)" : "#FAFCFF",
                            borderRadius: 14,
                            border: `1px solid ${b.holati === "rad_etildi" ? "rgba(255,92,92,0.15)" : "#F0F4FB"}`,
                          }}>
                          {/* Bolim name + holat badge */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold" style={{ color: "#0A1629" }}>
                              {b.bolim_nomi || `Bo'lim #${b.bolim_id}`}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1"
                              style={{ background: cfg.bg, color: cfg.color, borderRadius: 8 }}>
                              {cfg.label}
                            </span>
                          </div>

                          {/* Progress steps (only for non-rejected) */}
                          {b.holati !== "rad_etildi" && (
                            <div className="flex items-center gap-0 mb-3">
                              {steps.map((s, i) => {
                                const done = i <= stepIdx;
                                return (
                                  <div key={s} className="flex items-center flex-1">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ background: done ? "#3F8CFF" : "#E0E7F0" }} />
                                    {i < steps.length - 1 && (
                                      <div className="flex-1 h-0.5"
                                        style={{ background: i < stepIdx ? "#3F8CFF" : "#E0E7F0" }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Rad izoh */}
                          {b.holati === "rad_etildi" && b.izoh && (
                            <div className="mb-2 px-3 py-2"
                              style={{ background: "rgba(255,92,92,0.07)", borderRadius: 8 }}>
                              <p className="text-xs font-bold mb-0.5" style={{ color: "#FF5C5C" }}>Rad etish sababi:</p>
                              <p className="text-sm" style={{ color: "#0A1629" }}>&ldquo;{b.izoh}&rdquo;</p>
                              {b.qaror_by_nomi && (
                                <p className="text-xs mt-1" style={{ color: "#91929E" }}>— {b.qaror_by_nomi}</p>
                              )}
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex gap-4 text-xs flex-wrap" style={{ color: "#91929E" }}>
                            <span>Yuborildi: <b style={{ color: "#0A1629" }}>{fmtDt(b.assigned_at)}</b></span>
                            {b.qaror_at && <span>Qaror: <b style={{ color: "#0A1629" }}>{fmtDt(b.qaror_at)}</b></span>}
                            {b.qaror_by_nomi && <span>Kim: <b style={{ color: "#0A1629" }}>{b.qaror_by_nomi}</b></span>}
                          </div>

                          {/* Ijrochi xodim + biriktirish tarixi */}
                          {b.xodim_nomi && (
                            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid #F0F4FB" }}>
                              <p className="text-xs" style={{ color: "#91929E" }}>
                                Ijrochi xodim: <b style={{ color: "#0A1629" }}>{b.xodim_nomi}</b>
                                {b.xodim_assigned_at && <> — {fmtDt(b.xodim_assigned_at)}</>}
                              </p>
                              {b.assign_log && b.assign_log.length > 1 && (
                                <div className="mt-1.5 flex flex-col gap-1">
                                  {b.assign_log.slice().reverse().map(log => (
                                    <p key={log.id} className="text-[11px]" style={{ color: "#91929E" }}>
                                      <b style={{ color: "#7D8592" }}>{log.xodim_nomi}</b>ga biriktirildi
                                      {log.assigned_by_nomi && ` — ${log.assigned_by_nomi} tomonidan`}
                                      {log.assigned_at && `, ${fmtDt(log.assigned_at)}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Yakunlash izohi va fayllari */}
                          {(b.holati === "tasdiq_kutilmoqda" || b.holati === "bajarildi") && (b.yakunlash_izohi || b.yakunlash_fayllar.length > 0) && (
                            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid #F0F4FB" }}>
                              <p className="text-xs font-bold mb-1.5" style={{ color: "#00A578" }}>Yakunlash hisoboti:</p>
                              {b.yakunlash_izohi && (
                                <p className="text-sm mb-1.5" style={{ color: "#0A1629" }}>{b.yakunlash_izohi}</p>
                              )}
                              {b.yakunlash_fayllar.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  {b.yakunlash_fayllar.map((f, i) => (
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
                              {(b.yakunlagan_by_nomi || b.yakunlangan_at) && (
                                <p className="text-xs mt-1.5" style={{ color: "#91929E" }}>
                                  {b.yakunlagan_by_nomi && `${b.yakunlagan_by_nomi} tomonidan`}
                                  {b.yakunlangan_at && `, ${fmtDt(b.yakunlangan_at)}`}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Ijro nazorati ko'rib chiqishi — yakunlangan hisobotni tasdiqlash yoki rad etish */}
                          {b.holati === "tasdiq_kutilmoqda" && (
                            <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid #F0F4FB" }}>
                              <button onClick={() => handleIjroQaror(b.id, "yechish")} disabled={reviewingId === b.id}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                                style={{ background: "#00C48C", borderRadius: 10 }}>
                                {reviewingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Ijro nazoratdan yechish
                              </button>
                              <button onClick={() => handleIjroQaror(b.id, "rad_etish")} disabled={reviewingId === b.id}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold disabled:opacity-50"
                                style={{ background: "#FFFFFF", border: "1.5px solid #FF5C5C", color: "#FF5C5C", borderRadius: 10 }}>
                                <XCircle size={12} />
                                Rad etish
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Qayta biriktirish — rejected yoki yangi bo'lim */}
              <div className="p-4" style={{ background: "#F4F9FD", borderRadius: 14 }}>
                <p className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: "#91929E" }}>
                  {rejectedDepts.length > 0 ? "Qayta biriktirish yoki yangi bo'lim qo'shish" : "Yangi bo'limga biriktirish"}
                </p>

                {/* Rejected — quick re-send buttons */}
                {rejectedDepts.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {rejectedDepts.map(b => (
                      <button key={b.id}
                        onClick={async () => {
                          setAdding(true);
                          try {
                            const res = await apiFetch<IjroTracking>(`/ijro-docs/${docId}/add-bolim`, {
                              method: "POST",
                              body: JSON.stringify({ bolim_id: b.bolim_id }),
                            });
                            setTracking(res);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Xatolik");
                          } finally { setAdding(false); }
                        }}
                        disabled={adding}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                        style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 8, border: "1px solid rgba(255,92,92,0.2)" }}>
                        <RefreshCw size={11} />
                        {b.bolim_nomi || `Bo'lim #${b.bolim_id}`} — qayta yuborish
                      </button>
                    ))}
                  </div>
                )}

                {/* New bolim select */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={selBolim}
                      onChange={e => setSelBolim(e.target.value ? Number(e.target.value) : "")}
                      className="w-full appearance-none px-3 py-2.5 text-sm font-bold outline-none"
                      style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #E0E7F0", color: selBolim ? "#0A1629" : "#91929E" }}>
                      <option value="">Bo'limni tanlang...</option>
                      {availableDepts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none" style={{ color: "#91929E" }} />
                  </div>
                  <button onClick={handleAddBolim} disabled={!selBolim || adding}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: "#3F8CFF", borderRadius: 10, whiteSpace: "nowrap" }}>
                    {adding ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Biriktirish
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Boshqaruv paneli ─────────────────────────────────────────────────

function BoshqaruvPaneli({ docs, depts }: { docs: IjroDoc[]; depts: Department[]; onRefresh: () => void }) {
  // Hujjatning haqiqiy bajarilish holati bo'limlar holatidan chiqariladi —
  // hujjatning o'z "holati" maydoni faqat butunlay yopilganda o'zgaradi.
  function isDocDone(d: IjroDoc): boolean {
    return docAggHolati(d) === "bajarildi";
  }

  const stats = [
    { label: "Jami hujjatlar",       value: docs.length, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)",  icon: FileText },
    { label: "Bajarilgan",           value: docs.filter(isDocDone).length, color: "#00C48C", bg: "rgba(0,196,140,0.1)",   icon: CheckCircle2 },
    { label: "Muddati yaqinlashgan", value: docs.filter(d => {
        if (isDocDone(d)) return false;
        const dd = daysUntil(d.ijro_muddati);
        return dd !== null && dd >= 0 && dd <= 5;
      }).length, color: "#FFBD21", bg: "rgba(255,189,33,0.1)",  icon: AlertTriangle },
    { label: "Muddati o'tgan",       value: docs.filter(d => {
        if (isDocDone(d)) return false;
        const dd = daysUntil(d.ijro_muddati);
        return dd !== null && dd < 0;
      }).length, color: "#FF5C5C", bg: "rgba(255,92,92,0.1)",   icon: AlertCircle },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="p-5 flex items-center gap-4"
            style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0 4px 24px rgba(196,203,214,0.15)" }}>
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center" style={{ background:s.bg, borderRadius:14 }}>
              <s.icon size={22} style={{ color:s.color }}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color:"#91929E" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color:"#0A1629" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bo'limlar Metro grid */}
      <BolimlarMetroGrid depts={depts} docs={docs} />
    </div>
  );
}

// ─── Tab 2: Topshiriqlar ─────────────────────────────────────────────────────

function Topshiriqlar({ docs, depts, onRefresh }:
  { docs: IjroDoc[]; depts: Department[]; onRefresh: () => void }) {
  const [activeManba, setActiveManba] = useState("all");
  const [showModal, setShowModal]     = useState(false);
  const [editDoc,    setEditDoc]      = useState<IjroDoc | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [trackingDocId, setTrackingDocId] = useState<number | null>(null);

  const [filterBolimIds, setFilterBolimIds] = useState<number[]>([]);
  const [bolimDropdownOpen, setBolimDropdownOpen] = useState(false);
  const [filterSanaFrom, setFilterSanaFrom] = useState("");
  const [filterSanaTo,   setFilterSanaTo]   = useState("");
  const [filterHolat,    setFilterHolat]    = useState("all");
  const bolimDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (bolimDropdownRef.current && !bolimDropdownRef.current.contains(e.target as Node)) {
        setBolimDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggleFilterBolim(id: number) {
    setFilterBolimIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  useEffect(() => {
    setPage(1);
  }, [activeManba, filterBolimIds, filterSanaFrom, filterSanaTo, filterHolat]);

  async function handleDelete(id: number) {
    if (!confirm("Hujjatni o'chirishni tasdiqlaysizmi?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/ijro-docs/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = docs.filter(d => {
    if (activeManba !== "all" && d.manba !== activeManba) return false;

    if (filterBolimIds.length) {
      let ids: number[] = [];
      try { ids = JSON.parse(d.masul_bolimlar || "[]"); } catch { /* noop */ }
      if (!ids.some(id => filterBolimIds.includes(id))) return false;
    }

    if (filterHolat !== "all" && docAggHolati(d) !== filterHolat) return false;

    if (filterSanaFrom || filterSanaTo) {
      if (!d.ijro_muddati) return false;
      const dd = d.ijro_muddati.slice(0, 10);
      if (filterSanaFrom && dd < filterSanaFrom) return false;
      if (filterSanaTo   && dd > filterSanaTo)   return false;
    }

    return true;
  }).sort((a, b) => {
    // Muddati eng yaqinlari birinchi — muddati yo'qlar oxirida.
    if (!a.ijro_muddati && !b.ijro_muddati) return 0;
    if (!a.ijro_muddati) return 1;
    if (!b.ijro_muddati) return -1;
    return new Date(a.ijro_muddati).getTime() - new Date(b.ijro_muddati).getTime();
  });

  const counts = {
    pq_pf:    docs.filter(d => d.manba === "pq_pf").length,
    vm:       docs.filter(d => d.manba === "vm").length,
    direktor: docs.filter(d => d.manba === "direktor").length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, idx) => idx + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - pageSafe) <= 1)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <>
      <div style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0 4px 24px rgba(196,203,214,0.15)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom:"1px solid #F4F9FD" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color:"#0A1629" }}>Barcha topshiriqlar</h2>
            <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>Tizimdagi barcha turdagi hujjatlar va topshiriqlar monitoringi</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white"
            style={{ background:"#3F8CFF", borderRadius:12, boxShadow:"0 4px 12px rgba(63,140,255,0.3)" }}>
            <Plus size={16}/> Yangi hujjat ro'yxatga olish
          </button>
        </div>

        {/* Manba tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 overflow-x-auto">
          {[
            { key:"all",      label:"Barchasi" },
            { key:"pq_pf",    label:`PQ/PF (${counts.pq_pf})` },
            { key:"vm",       label:`VM (${counts.vm})` },
            { key:"qv",       label:"QV" },
            { key:"direktor", label:`Direktor (${counts.direktor})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveManba(t.key)}
              className="px-4 py-2 text-sm font-bold whitespace-nowrap transition-all"
              style={{
                borderRadius:"10px 10px 0 0",
                background: activeManba === t.key ? "#3F8CFF" : "transparent",
                color: activeManba === t.key ? "#FFFFFF" : "#7D8592",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ borderTop:"2px solid #F4F9FD" }} />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap px-6 py-4 mx-6 my-4"
          style={{ background:"#F7FAFF", borderRadius:16, border:"1.5px solid #E9F0FD" }}>
          {/* Bo'lim bo'yicha — checkbox popover */}
          <div className="relative" ref={bolimDropdownRef}>
            <button onClick={() => setBolimDropdownOpen(v => !v)}
              className="flex items-center gap-2.5 px-4 py-3 min-w-[190px]"
              style={{ background:"#FFFFFF", borderRadius:12, border: filterBolimIds.length ? "1.5px solid #3F8CFF" : "1.5px solid #E3ECFB", boxShadow:"0 2px 8px rgba(63,140,255,0.06)" }}>
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background:"rgba(63,140,255,0.12)", borderRadius:7 }}>
                <FileText size={12} style={{ color:"#3F8CFF" }}/>
              </div>
              <span className="text-sm font-bold" style={{ color: filterBolimIds.length ? "#0A1629" : "#7D8592" }}>
                {filterBolimIds.length ? `Bo'lim (${filterBolimIds.length})` : "Bo'lim bo'yicha"}
              </span>
              <ChevronDown size={15} style={{ color:"#3F8CFF", marginLeft:"auto" }}/>
            </button>
            {bolimDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 p-2 max-h-64 overflow-y-auto"
                style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 8px 24px rgba(10,22,41,0.15)", minWidth:260, border:"1px solid #F0F4FB" }}>
                {depts.map(d => (
                  <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#F4F9FD] rounded-lg">
                    <input type="checkbox" checked={filterBolimIds.includes(d.id)}
                      onChange={() => toggleFilterBolim(d.id)} className="accent-[#3F8CFF] w-4 h-4" />
                    <span className="text-sm" style={{ color:"#0A1629" }}>{d.name}</span>
                  </label>
                ))}
                {filterBolimIds.length > 0 && (
                  <button onClick={() => setFilterBolimIds([])}
                    className="w-full text-center mt-1 pt-2 text-xs font-bold" style={{ color:"#FF5C5C", borderTop:"1px solid #F4F9FD" }}>
                    Tozalash
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sana oralig'i */}
          <div className="flex items-center gap-2.5 px-4 py-3"
            style={{ background:"#FFFFFF", borderRadius:12, border: (filterSanaFrom || filterSanaTo) ? "1.5px solid #3F8CFF" : "1.5px solid #E3ECFB", boxShadow:"0 2px 8px rgba(63,140,255,0.06)" }}>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background:"rgba(0,165,120,0.12)", borderRadius:7 }}>
              <Calendar size={12} style={{ color:"#00A578" }}/>
            </div>
            <input type="date" value={filterSanaFrom} onChange={e => setFilterSanaFrom(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none" style={{ color: filterSanaFrom ? "#0A1629" : "#91929E", width:128 }} />
            <span className="text-xs font-bold" style={{ color:"#91929E" }}>—</span>
            <input type="date" value={filterSanaTo} onChange={e => setFilterSanaTo(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none" style={{ color: filterSanaTo ? "#0A1629" : "#91929E", width:128 }} />
          </div>

          {/* Holat */}
          <div className="relative flex items-center gap-2.5 px-4 py-3 min-w-[190px]"
            style={{ background:"#FFFFFF", borderRadius:12, border: filterHolat !== "all" ? "1.5px solid #3F8CFF" : "1.5px solid #E3ECFB", boxShadow:"0 2px 8px rgba(63,140,255,0.06)" }}>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background:"rgba(224,164,0,0.14)", borderRadius:7 }}>
              <ChevronDown size={12} style={{ color:"#E0A400" }}/>
            </div>
            <select value={filterHolat} onChange={e => setFilterHolat(e.target.value)}
              className="appearance-none bg-transparent text-sm font-bold outline-none w-full pr-5"
              style={{ color: filterHolat === "all" ? "#7D8592" : "#0A1629" }}>
              <option value="all">Holat: barchasi</option>
              {(Object.keys(BOLIM_H_CFG) as BolimHolati[]).map(h => (
                <option key={h} value={h}>{BOLIM_H_CFG[h].label}</option>
              ))}
            </select>
            <ChevronDown size={15} style={{ color:"#91929E", position:"absolute", right:12, pointerEvents:"none" }}/>
          </div>

          {(filterBolimIds.length > 0 || filterSanaFrom || filterSanaTo || filterHolat !== "all") && (
            <button onClick={() => { setFilterBolimIds([]); setFilterSanaFrom(""); setFilterSanaTo(""); setFilterHolat("all"); }}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold"
              style={{ background:"#FFFFFF", border:"1.5px solid #FFD5D5", color:"#FF5C5C", borderRadius:12 }}>
              <X size={14}/> Tozalash
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth:980 }}>
            <thead>
              <tr style={{ borderTop:"1px solid #F4F9FD", borderBottom:"1px solid #F4F9FD" }}>
                {["#","HUJJAT № SANA VA MANBA","TOPSHIRIQ NOMI","TOPSHIRIQ MAZMUNI","MUDDATI","MAS'UL BO'LIM","HOLATI","AMALLAR"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold"
                    style={{ color:"#91929E", background:"#FAFCFF", letterSpacing:"0.04em", whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <FileText size={32} className="mx-auto mb-3" style={{ color:"#D0D9E8" }}/>
                    <p className="text-sm font-bold" style={{ color:"#91929E" }}>Hali hujjat yo'q</p>
                    <p className="text-xs mt-1" style={{ color:"#91929E" }}>"Yangi hujjat ro'yxatga olish" tugmasini bosing</p>
                  </td>
                </tr>
              ) : paged.map((d, i) => {
                const dl = daysLeft(d.ijro_muddati);
                return (
                  <tr key={d.id} className="hover:bg-[#FAFCFF] transition-colors"
                    style={{ borderBottom: i < paged.length-1 ? "1px solid #F4F9FD" : "none" }}>
                    <td className="px-4 py-4 text-sm font-bold" style={{ color:"#91929E" }}>
                      {(pageSafe - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-sm" style={{ color:"#3F8CFF" }}>№ {d.hujjat_raqami || `DOC-${d.id}`}</p>
                      <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>{d.hujjat_sanasi || "—"}</p>
                      <p className="text-xs mt-0.5 font-bold" style={{ color:"#0A1629" }}>{MANBA_LABELS[d.manba]}</p>
                    </td>
                    <td className="px-4 py-4" style={{ maxWidth:200 }}>
                      <p className="text-sm font-bold truncate" style={{ color:"#0A1629" }}>
                        {d.sarlavha || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4" style={{ minWidth:260, maxWidth:360 }}>
                      <p className="text-xs" style={{ color:"#7D8592", whiteSpace:"normal", wordBreak:"break-word" }}>
                        {d.mazmun || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-sm font-bold" style={{ color: dl.color }}>{dl.text}</p>
                    </td>
                    <td className="px-4 py-4">
                      {d.masul_bolimlar_info || d.masul_bolimlar_nomi ? (
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let items: BolimInfo[] = [];
                            try { items = JSON.parse(d.masul_bolimlar_info || "[]"); } catch { /* noop */ }
                            if (!items.length && d.masul_bolimlar_nomi)
                              items = d.masul_bolimlar_nomi.split(", ").map((n, i) => ({ id: i, name: n, holati: "yuborildi" }));
                            return items.map(b => {
                              const isRad = b.holati === "rad_etildi";
                              return (
                                <span key={b.id} className="text-xs font-bold px-2 py-0.5 inline-flex items-center gap-1"
                                  style={{
                                    background: isRad ? "rgba(255,92,92,0.08)" : "rgba(63,140,255,0.08)",
                                    color: isRad ? "#FF5C5C" : "#3F8CFF",
                                    borderRadius: 6,
                                    textDecoration: isRad ? "line-through" : "none",
                                    opacity: isRad ? 0.7 : 1,
                                  }}>
                                  {b.name}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "#91929E" }}>—</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const agg = docAggHolati(d);
                        if (agg === "none") return <HolatiChip h={d.holati} />;
                        const cfg = BOLIM_H_CFG[agg];
                        return (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                            style={{ background: cfg.bg, color: cfg.color, borderRadius: 8 }}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setTrackingDocId(d.id)} title="Kuzatuv"
                          className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ background: "rgba(109,93,211,0.1)", borderRadius: 8 }}>
                          <Eye size={14} style={{ color: "#6D5DD3" }}/>
                        </button>
                        <button onClick={() => setEditDoc(d)} title="Tahrirlash"
                          className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ background:"rgba(63,140,255,0.1)", borderRadius:8 }}>
                          <Pencil size={14} style={{ color:"#3F8CFF" }}/>
                        </button>
                        <button onClick={() => handleDelete(d.id)} title="O'chirish"
                          disabled={deletingId === d.id}
                          className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
                          style={{ background:"rgba(255,92,92,0.1)", borderRadius:8 }}>
                          {deletingId === d.id
                            ? <Loader2 size={14} className="animate-spin" style={{ color:"#FF5C5C" }}/>
                            : <Trash2 size={14} style={{ color:"#FF5C5C" }}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop:"1px solid #F4F9FD" }}>
          <p className="text-xs" style={{ color:"#91929E" }}>
            {filtered.length === 0
              ? "0 ta topshiriq"
              : <>{(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} / {filtered.length} ta ko'rsatilmoqda</>}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe <= 1}
              className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
              style={{ background:"#F4F9FD", borderRadius:8 }}>
              <ChevronLeft size={13} style={{ color:"#7D8592" }}/>
            </button>
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs font-bold" style={{ color:"#91929E" }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className="w-8 h-8 flex items-center justify-center text-xs font-bold"
                  style={{ background: p === pageSafe ? "#3F8CFF" : "#F4F9FD", color: p === pageSafe ? "#FFFFFF" : "#7D8592", borderRadius:8 }}>
                  {p}
                </button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}
              className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
              style={{ background:"#F4F9FD", borderRadius:8 }}>
              <ChevronRight size={13} style={{ color:"#7D8592" }}/>
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <YangiHujjatModal
          depts={depts}
          onClose={() => setShowModal(false)}
          onSaved={onRefresh}
        />
      )}
      {editDoc && (
        <YangiHujjatModal
          depts={depts}
          editDoc={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={() => { setEditDoc(null); onRefresh(); }}
        />
      )}
      {trackingDocId && (
        <IjroTrackingModal
          docId={trackingDocId}
          depts={depts}
          onClose={() => setTrackingDocId(null)}
        />
      )}
    </>
  );
}

// ─── Tab 3: Kalandar ─────────────────────────────────────────────────────────

const MONTH_NAMES = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const WEEK_DAYS   = ["DUSHANBA","SESHANBA","CHORSHANBA","PAYSHANBA","JUMA","SHANBA","YAKSHANBA"];

function KalendarTab({ docs }: { docs: IjroDoc[] }) {
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const { y, m } = cur;

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

  // Build doc map: day-of-month → docs
  const docsByDay = new Map<number, IjroDoc[]>();
  docs.forEach(doc => {
    if (!doc.ijro_muddati) return;
    const d = new Date(doc.ijro_muddati);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const day = d.getDate();
      if (!docsByDay.has(day)) docsByDay.set(day, []);
      docsByDay.get(day)!.push(doc);
    }
  });

  // Build calendar grid (Mon-first)
  const firstDow = new Date(y, m, 1).getDay(); // 0=Sun
  const padLeft  = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(padLeft).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prev = () => setCur(p => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 });
  const next = () => setCur(p => p.m === 11 ? { y: p.y + 1, m: 0  } : { y: p.y, m: p.m + 1 });

  return (
    <div style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0 4px 24px rgba(196,203,214,0.15)", overflow:"hidden" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom:"1px solid #F4F9FD" }}>
        <h2 className="font-bold text-lg" style={{ color:"#0A1629" }}>{MONTH_NAMES[m]} {y}</h2>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="w-8 h-8 flex items-center justify-center"
            style={{ background:"#F4F9FD", borderRadius:8 }}>
            <ChevronLeft size={14} style={{ color:"#7D8592" }}/>
          </button>
          <button onClick={() => { const n = new Date(); setCur({ y: n.getFullYear(), m: n.getMonth() }); }}
            className="px-3 py-1.5 text-xs font-bold text-white" style={{ background:"#3F8CFF", borderRadius:8 }}>
            Bugun
          </button>
          <button onClick={next} className="w-8 h-8 flex items-center justify-center"
            style={{ background:"#F4F9FD", borderRadius:8 }}>
            <ChevronRight size={14} style={{ color:"#7D8592" }}/>
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7" style={{ borderBottom:"1px solid #F4F9FD" }}>
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-3 text-center text-xs font-bold" style={{ color:"#91929E", letterSpacing:"0.03em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7"
          style={{ borderBottom: wi < weeks.length - 1 ? "1px solid #F4F9FD" : "none" }}>
          {week.map((day, di) => {
            if (!day) {
              return (
                <div key={di} className="min-h-[100px]"
                  style={{ borderLeft: di > 0 ? "1px solid #F4F9FD" : "none", background:"#FAFCFF" }}/>
              );
            }
            const dayDocs = docsByDay.get(day) || [];
            const cur_day = isToday(new Date(y, m, day));
            return (
              <div key={di} className="min-h-[100px] p-2 flex flex-col"
                style={{
                  borderLeft:  di > 0 ? "1px solid #F4F9FD" : "none",
                  border:      cur_day ? "2px solid #00C48C" : undefined,
                  background:  cur_day ? "rgba(0,196,140,0.03)" : undefined,
                }}>
                <span className="text-sm font-bold text-right block mb-1"
                  style={{ color: cur_day ? "#00C48C" : "#0A1629" }}>
                  {day}
                </span>
                {dayDocs.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color:"#3F8CFF" }}>● {dayDocs.length}</span>
                    </div>
                    {dayDocs.slice(0, 3).map(doc => (
                      <div key={doc.id} className="h-[3px] rounded-full w-full"
                        style={{ background: HOLATI_CFG[doc.holati].color }}/>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap px-6 py-4" style={{ borderTop:"1px solid #F4F9FD" }}>
        {Object.values(HOLATI_CFG).map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: c.color }}/>
            <span className="text-xs" style={{ color:"#91929E" }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IjroNazoratPage() {
  const [tab,   setTab]   = useState<"panel" | "tasks" | "calendar">("panel");
  const [docs,  setDocs]  = useState<IjroDoc[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const user     = typeof window !== "undefined" ? getUser() : null;
  const initials = user ? user.full_name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").toUpperCase().slice(0,2) : "IJ";

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<IjroDoc[]>("/ijro-docs/");
      setDocs(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadDocs();
    apiFetch<Department[]>("/departments/").then(setDepts).catch(() => {});
  }, [loadDocs]);

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-xl sm:text-2xl" style={{ color:"#0A1629" }}>Ijro intizomi nazorati</h1>
          <p className="text-xs mt-1" style={{ color:"#91929E" }}>Hujjatlar va topshiriqlar bajarilishini kuzatib boring</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2 px-4 py-2.5"
            style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 4px 16px rgba(196,203,214,0.15)", minWidth:200 }}>
            <Search size={16} style={{ color:"#91929E" }}/>
            <input type="text" placeholder="Topshiriqlardan izlash..."
              className="bg-transparent outline-none text-sm flex-1" style={{ color:"#0A1629" }}/>
          </div>
          <div className="relative w-10 h-10 flex items-center justify-center"
            style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 4px 16px rgba(196,203,214,0.15)" }}>
            <Bell size={18} style={{ color:"#0A1629" }}/>
            <span className="absolute top-2 right-2 w-2 h-2" style={{ background:"#FF5C5C", borderRadius:"50%" }}/>
          </div>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 4px 16px rgba(196,203,214,0.15)" }}>
            <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
              style={{ background:"#3F8CFF", borderRadius:9 }}>
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-xs" style={{ color:"#0A1629" }}>{user?.full_name || "Foydalanuvchi"}</p>
              <p className="text-xs" style={{ color:"#91929E" }}>Ijro xodimi</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-5 p-1"
        style={{ background:"#FFFFFF", borderRadius:14, display:"inline-flex", boxShadow:"0 4px 16px rgba(196,203,214,0.15)" }}>
        <button onClick={() => setTab("panel")}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{ borderRadius:10, background: tab==="panel"?"#3F8CFF":"transparent", color: tab==="panel"?"#FFFFFF":"#7D8592" }}>
          <LayoutDashboard size={16}/> Boshqaruv paneli
        </button>
        <button onClick={() => setTab("tasks")}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{ borderRadius:10, background: tab==="tasks"?"#3F8CFF":"transparent", color: tab==="tasks"?"#FFFFFF":"#7D8592" }}>
          <List size={16}/> Topshiriqlar
        </button>
        <button onClick={() => setTab("calendar")}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{ borderRadius:10, background: tab==="calendar"?"#3F8CFF":"transparent", color: tab==="calendar"?"#FFFFFF":"#7D8592" }}>
          <Calendar size={16}/> Kalandar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color:"#3F8CFF" }}/>
        </div>
      ) : tab === "panel" ? (
        <BoshqaruvPaneli docs={docs} depts={depts} onRefresh={loadDocs} />
      ) : tab === "tasks" ? (
        <Topshiriqlar docs={docs} depts={depts} onRefresh={loadDocs} />
      ) : (
        <KalendarTab docs={docs} />
      )}
    </div>
  );
}
