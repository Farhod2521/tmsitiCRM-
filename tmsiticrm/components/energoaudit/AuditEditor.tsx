"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import {
  ArrowLeft, Save, Download, Loader2, Plus, Trash2, Calculator, Building2, Ruler, DoorOpen, Layers,
  Home, Scale, Camera, X, CheckCircle2, XCircle, Lock,
} from "lucide-react";
import { AuditFull, AuditCalc, AuditData, AuditLayer, downloadAuditDocx, nf } from "./api";
import { REGIONS, tumanlarOf } from "./regions";

type FieldDef = {
  key: string; label: string; hint?: string; wide?: boolean; area?: boolean; num?: boolean; unit?: string;
  calc?: (c: AuditCalc) => string;          // faqat ko'rsatiladi — boshqa maydonlardan hisoblanadi
  select?: "viloyat" | "tuman";
};

const S_UMUMIY: FieldDef[] = [
  { key: "viloyat", label: "Viloyat", select: "viloyat" },
  { key: "tuman", label: "Tuman / shahar", select: "tuman" },
  { key: "bino_nomi", label: "Bino (matnda)", hint: "… кўчаси 12-уйда жойлашган кўп қаватли турар-жой биносида", wide: true, area: true },
  { key: "qurilgan_yil", label: "Qurilgan yil", num: true },
  { key: "umumiy_maydon", label: "Umumiy maydoni", num: true, unit: "m²" },
  { key: "qavatlar_soni", label: "Qavatlar soni", num: true },
  { key: "fasad_izolyatsiya", label: "Fasad issiqlik himoyasi", hint: "мавжуд эмас" },
  { key: "isitish_turi", label: "Isitish tizimi turi", hint: "марказий иситиш тизими" },
  { key: "issiq_suv", label: "Issiq suv ta'minoti", hint: "Автоном (алоҳида)" },
  { key: "issiqlik_manbai", label: "Issiqlik manbai", hint: "марказий иссиқлик таъминоти" },
  { key: "resurslar", label: "Iste'mol qilinadigan resurslar", hint: "электр энергияси ва иссиқлик энергиясини", wide: true },
];
const S_OLCHAM: FieldDef[] = [
  { key: "uzunlik", label: "Uzunligi", num: true, unit: "m" },
  { key: "kenglik", label: "Eni", num: true, unit: "m" },
  { key: "balandlik", label: "Balandligi", num: true, unit: "m" },
  { key: "hajm", label: "Umumiy hajmi (uzunlik × eni × balandlik)", unit: "m³", calc: c => nf(c.hajm, 1) },
  { key: "tom_maydon", label: "Tom maydoni", num: true, unit: "m²" },
  { key: "devor_maydon", label: "Devor maydoni (bo'sh — avto)", num: true, unit: "m²" },
  { key: "pastki_konstruksiya", label: "Pastki konstruksiya", hint: "ертўла ораёпмаси" },
  { key: "tom_turi", label: "Tom turi", hint: "чордоқли икки нишабли" },
  { key: "tom_tavsif", label: "Tom tavsifi", wide: true, area: true },
];
const S_DERAZA: FieldDef[] = [
  { key: "deraza_soni", label: "Derazalar soni", num: true, unit: "ta" },
  { key: "deraza_maydon", label: "Derazalar maydoni (soni × 2,2)", unit: "m²", calc: c => nf(c.deraza_maydon_asosiy) },
  { key: "yolak_deraza_soni", label: "Yo'lak derazalari soni", num: true, unit: "ta" },
  { key: "yolak_deraza_maydon", label: "Yo'lak derazalari maydoni (soni × 1,5)", unit: "m²", calc: c => nf(c.yolak_deraza_maydon) },
  { key: "eshik_soni", label: "Eshiklar soni", num: true, unit: "ta" },
  { key: "eshik_maydon", label: "Eshiklar maydoni (soni × 1,9)", unit: "m²", calc: c => nf(c.eshik_maydon) },
  { key: "deraza_R", label: "Deraza R", num: true, unit: "m²·°C/W" },
  { key: "eshik_R", label: "Eshik R", num: true, unit: "m²·°C/W" },
];
const S_NORMA: FieldDef[] = [
  { key: "bino_toifa", label: "Bino toifasi (jadvalda)", hint: "Кўп қаватли уй-жойлар" },
  { key: "dd", label: "Dd, °C·sutka", num: true },
  { key: "t_ichki", label: "Ichki harorat tᵢ", num: true, unit: "°C" },
  { key: "t_tashqi", label: "Tashqi harorat tₑ", num: true, unit: "°C" },
  { key: "norma_toifa", label: "Me'yor: bino toifasi", wide: true },
  { key: "norma_dd", label: "Me'yor: Dd oralig'i" },
  { key: "norma_devor", label: "R talab — devor", num: true },
  { key: "norma_tom", label: "R talab — tom", num: true },
  { key: "norma_pol", label: "R talab — pol", num: true },
  { key: "norma_deraza", label: "R talab — deraza", num: true },
  { key: "norma_eshik", label: "R talab — eshik", num: true },
  { key: "norma_fonar", label: "R talab — fonar", num: true },
];
const PHOTOS: { slot: string; title: string; hint: string }[] = [
  { slot: "rasm_1", title: "1-расм. Девор конструкциясининг қатламлари", hint: "Devor qatlamlari hisobidan oldin" },
  { slot: "rasm_2", title: "2-расм. Томёпма конструкциясининг қатламлари", hint: "Tomyopma hisobidan keyin" },
];
// 3-rasm (tepловизор suratlari) — bir nechta; Word'da 3 ustunli jadvalga joylanadi
const RASM3_MAX = 12;
const rasm3Slots = (photos: Record<string, string>) =>
  Object.keys(photos).filter(k => (k === "rasm_3" || k.startsWith("rasm_3_")) && photos[k])
    .sort((a, b) => (a === "rasm_3" ? 0 : Number(a.split("_")[2])) - (b === "rasm_3" ? 0 : Number(b.split("_")[2])));

const INPUT = "w-full px-3 py-2.5 text-sm outline-none disabled:opacity-70";
const INPUT_STYLE = { background: "#F4F9FD", borderRadius: 10, border: "1px solid #E4EAF2", color: "#0A1629" } as const;

/** Rasmni 1600 px gacha kichraytirib JPEG data URL qiladi. */
function resizeImage(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    img.src = URL.createObjectURL(file);
  });
}

export default function AuditEditor({ id, basePath }: { id: number; basePath: string }) {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditFull | null>(null);
  const [title, setTitle] = useState("");
  const [data, setData] = useState<AuditData | null>(null);
  const [calc, setCalc] = useState<AuditCalc | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<AuditFull>(`/energoaudit/${id}`)
      .then(a => { setAudit(a); setTitle(a.title); setData(a.data); setCalc(a.calc); setPhotos(a.photo_data || {}); })
      .catch(e => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [id]);

  const editable = !!audit?.can_edit;

  // Jonli hisob-kitob (saqlamasdan)
  const recalc = useCallback((d: AuditData) => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(() => {
      apiFetch<AuditCalc>("/energoaudit/calc", { method: "POST", body: JSON.stringify({ data: d }) })
        .then(setCalc).catch(() => {});
    }, 350);
  }, []);

  function update(patch: Partial<AuditData>) {
    if (!data) return;
    const next = { ...data, ...patch } as AuditData;
    setData(next); setDirty(true); recalc(next);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(): Promise<boolean> {
    if (!data) return false;
    setSaving(true); setError(null);
    try {
      const a = await apiFetch<AuditFull>(`/energoaudit/${id}`, { method: "PUT", body: JSON.stringify({ title, data }) });
      setAudit(a); setCalc(a.calc); setDirty(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      return false;
    } finally { setSaving(false); }
  }

  async function download() {
    if (editable && dirty && !(await save())) return;
    setDownloading(true);
    try { await downloadAuditDocx(id, title); }
    catch (e) { setError(e instanceof Error ? e.message : "Xatolik"); }
    finally { setDownloading(false); }
  }

  async function setPhoto(slot: string, file: File | null) {
    setPhotoBusy(slot); setError(null);
    try {
      const image = file ? await resizeImage(file) : null;
      await apiFetch(`/energoaudit/${id}/photos/${slot}`, { method: "PUT", body: JSON.stringify({ image }) });
      setPhotos(p => { const n = { ...p }; if (image) n[slot] = image; else delete n[slot]; return n; });
    } catch (e) { setError(e instanceof Error ? e.message : "Surat yuklanmadi"); }
    finally { setPhotoBusy(null); }
  }

  if (error && !audit) return <div><Header title="Energiya audit" /><p className="text-sm py-10 text-center" style={{ color: "#FF5C5C" }}>{error}</p></div>;
  if (!audit || !data) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>;

  const field = (f: FieldDef) => {
    const labelEl = (
      <span className="block text-[11px] font-bold mb-1" style={{ color: "#7D8592" }}>
        {f.label}{f.unit && <span style={{ color: "#A8B0BD" }}> · {f.unit}</span>}
      </span>
    );
    if (f.calc) {
      return (
        <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
          {labelEl}
          <div className="w-full px-3 py-2.5 text-sm font-bold flex items-center justify-between gap-2"
            style={{ background: "#EEF5FF", borderRadius: 10, border: "1px dashed #B9D2F5", color: "#2D6BE0" }} title="Avtomatik hisoblanadi">
            {calc ? f.calc(calc) : "—"}<Calculator size={14} style={{ color: "#8FB4EA" }} />
          </div>
        </div>
      );
    }
    if (f.select) {
      const opts = f.select === "viloyat" ? REGIONS.map(r => r.nomi) : tumanlarOf(String(data.viloyat || ""));
      const cur = String(data[f.key] ?? "");
      return (
        <label key={f.key}>
          {labelEl}
          <select value={cur} disabled={!editable || (f.select === "tuman" && !data.viloyat)}
            onChange={e => update(f.select === "viloyat" ? { viloyat: e.target.value, tuman: "" } : { tuman: e.target.value })}
            className={INPUT} style={INPUT_STYLE}>
            <option value="">— tanlang —</option>
            {cur && !opts.includes(cur) && <option value={cur}>{cur}</option>}
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    }
    const raw = data[f.key];
    const value = raw == null ? "" : String(raw);
    const common = {
      value, disabled: !editable, style: INPUT_STYLE,
      placeholder: f.key === "devor_maydon" && calc ? `avto: ${nf(calc.devor_maydon_auto)}` : f.hint,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update({ [f.key]: f.num ? e.target.value.replace(",", ".") : e.target.value } as Partial<AuditData>),
    };
    return (
      <label key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
        {labelEl}
        {f.area
          ? <textarea rows={2} className={`${INPUT} resize-none`} {...common} />
          : <input inputMode={f.num ? "decimal" : undefined} className={INPUT} {...common} />}
      </label>
    );
  };

  return (
    <div>
      <Header title="Energiya audit" subtitle={`Muallif: ${audit.created_by_name ?? "—"}${audit.updated_at ? ` · oxirgi o'zgarish ${fmtDateTimeUz(audit.updated_at, true)}${audit.updated_by_name ? ` (${audit.updated_by_name})` : ""}` : ""}`} />

      {/* Yuqori panel */}
      <div className="sticky top-0 z-20 flex items-center gap-3 flex-wrap mb-5 px-4 py-3"
        style={{ background: "rgba(255,255,255,0.96)", borderRadius: 16, boxShadow: "0px 6px 30px rgba(196,203,214,0.25)" }}>
        <button onClick={() => { if (!dirty || confirm("Saqlanmagan o'zgarishlar bor. Chiqasizmi?")) router.push(basePath); }}
          className="w-9 h-9 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 10 }} title="Ro'yxatga qaytish">
          <ArrowLeft size={17} style={{ color: "#3D4557" }} />
        </button>
        <input value={title} disabled={!editable} onChange={e => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 min-w-[200px] px-3 py-2 font-bold outline-none" style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />
        {!editable && (
          <span className="flex items-center gap-1 text-xs font-bold px-3 py-2" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 10 }}>
            <Lock size={13} /> Faqat ko&apos;rish
          </span>
        )}
        {editable && (
          <button onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#3F8CFF", borderRadius: 10 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {dirty ? "Saqlash" : "Saqlangan"}
          </button>
        )}
        <button onClick={download} disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "#00A578", borderRadius: 10 }}>
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Word (.docx)
        </button>
      </div>
      {error && <p className="text-sm font-bold mb-4" style={{ color: "#FF5C5C" }}>{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Card icon={Building2} title="Bino haqida umumiy ma'lumot" sub="2.1 va 2.2-bo'limlar">{S_UMUMIY.map(field)}</Card>
          <Card icon={Ruler} title="Hajm-reja yechimlari" sub="2.3-bo'lim — o'lchamlar va maydonlar">{S_OLCHAM.map(field)}</Card>
          <Card icon={DoorOpen} title="Deraza va eshiklar" sub="1-jadval va issiqlik yo'qotish hisobi">{S_DERAZA.map(field)}</Card>
          <LayersCard title="Tashqi devor qatlamlari" sub="Ichkaridan tashqariga · R = δ / λ"
            layers={data.devor_qatlamlar} calcLayers={calc?.devor.qatlamlar} editable={editable}
            onChange={l => update({ devor_qatlamlar: l })}
            alpha={[["alfa_ichki", "αᵢ (ichki)"], ["alfa_devor", "αₑ (tashqi)"]]} data={data} onAlpha={update} />
          <LayersCard title="Tomyopma qatlamlari" sub="Tom konstruksiyasi · R = δ / λ"
            layers={data.tom_qatlamlar} calcLayers={calc?.tom.qatlamlar} editable={editable}
            onChange={l => update({ tom_qatlamlar: l })}
            alpha={[["alfa_tom", "αₑ (tom)"]]} data={data} onAlpha={update} />
          <LayersCard title="Pol qatlamlari" sub="Pastki konstruksiya (ertўla orayopmasi) · R = δ / λ · bo'sh bo'lsa — jadvalda «Мавжуд эмас»"
            layers={(data.pol_qatlamlar as AuditLayer[] | undefined) ?? []} calcLayers={calc?.pol.qatlamlar} editable={editable} allowEmpty
            onChange={l => update({ pol_qatlamlar: l })}
            alpha={[["alfa_pol_ichki", "αᵢ (ichki)"], ["alfa_pol", "αₑ (tashqi)"], ["pol_n", "n (koef.)"], ["pol_maydon", "Maydoni, m²"]]}
            placeholders={{ pol_maydon: calc ? `avto: ${nf(calc.pol_maydon_auto)}` : "", pol_n: "0.6" }}
            data={data} onAlpha={update} />
          <Card icon={Scale} title="Me'yorlar va harorat" sub="16-jadval (ҚМҚ 2.01.04-18) va Δt">{S_NORMA.map(field)}</Card>

          {/* Suratlar */}
          <section style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
            <SectionHead icon={Camera} title="Suratlar" sub="Hujjatdagi joyiga sarlavhasi bilan qo'yiladi · surat yuklanmasa, sarlavhasi ham chiqmaydi" />
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PHOTOS.map(ph => (
                <div key={ph.slot}>
                  <PhotoSlot src={photos[ph.slot]} busy={photoBusy === ph.slot} editable={editable}
                    onPick={f => setPhoto(ph.slot, f)} onRemove={() => setPhoto(ph.slot, null)} />
                  <p className="text-xs font-bold mt-2 text-center" style={{ color: "#0A1629" }}>{ph.title}</p>
                  <p className="text-[11px] text-center" style={{ color: "#91929E" }}>{ph.hint}</p>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-bold" style={{ color: "#0A1629" }}>3-расм. Иссиқлик йўқотишларининг тепловизион тасвири</p>
                  <p className="text-[11px]" style={{ color: "#91929E" }}>Bir nechta rasm · Word&apos;da 3 ustunli jadvalga joylanadi · {rasm3Slots(photos).length}/{RASM3_MAX}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rasm3Slots(photos).map(slot => (
                  <PhotoSlot key={slot} src={photos[slot]} busy={photoBusy === slot} editable={editable}
                    onPick={f => setPhoto(slot, f)} onRemove={() => setPhoto(slot, null)} />
                ))}
                {editable && rasm3Slots(photos).length < RASM3_MAX && (() => {
                  // keyingi bo'sh raqam (rasm_3_1 … rasm_3_12)
                  const used = new Set(Object.keys(photos));
                  const next = Array.from({ length: RASM3_MAX }, (_, i) => `rasm_3_${i + 1}`).find(k => !used.has(k)) ?? "";
                  return next ? <PhotoSlot key={`new-${next}`} busy={photoBusy === next} editable onPick={f => setPhoto(next, f)} onRemove={() => {}} /> : null;
                })()}
              </div>
            </div>
          </section>
        </div>

        <CalcPanel calc={calc} />
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, sub }: { icon: typeof Home; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10 }}>
        <Icon size={17} style={{ color: "#3F8CFF" }} />
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{title}</p>
        {sub && <p className="text-[11px]" style={{ color: "#91929E" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Card({ icon, title, sub, children }: { icon: typeof Home; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
      <SectionHead icon={icon} title={title} sub={sub} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-5 pb-5">{children}</div>
    </section>
  );
}

function LayersCard({ title, sub, layers, calcLayers, editable, onChange, alpha, data, onAlpha, allowEmpty, placeholders }: {
  title: string; sub: string; layers: AuditLayer[]; calcLayers?: { R: number }[]; editable: boolean;
  onChange: (l: AuditLayer[]) => void; alpha: [string, string][]; data: AuditData; onAlpha: (p: Partial<AuditData>) => void;
  allowEmpty?: boolean; placeholders?: Record<string, string>;
}) {
  const upd = (i: number, patch: Partial<AuditLayer>) => onChange(layers.map((l, j) => j === i ? { ...l, ...patch } : l));
  return (
    <section style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
      <SectionHead icon={Layers} title={title} sub={sub} />
      <div className="px-5 pb-5">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 6px" }}>
          <thead>
            <tr>{["№", "Qatlam nomi", "δ, mm", "λ, W/m·°C", "R", ""].map(h => (
              <th key={h} className="text-left px-1.5 text-[11px] font-bold" style={{ color: "#91929E" }}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {!layers.length && (
              <tr><td colSpan={6} className="px-1.5 py-3 text-xs" style={{ color: "#91929E" }}>Qatlam yo&apos;q — hujjatda «Мавжуд эмас» deb yoziladi</td></tr>
            )}
            {layers.map((l, i) => (
              <tr key={i}>
                <td className="px-1.5 text-xs font-bold" style={{ color: "#91929E", width: 28 }}>{i + 1}</td>
                <td className="px-1.5"><input value={l.nomi} disabled={!editable} onChange={e => upd(i, { nomi: e.target.value })} className={INPUT} style={INPUT_STYLE} /></td>
                <td className="px-1.5" style={{ width: 90 }}><input inputMode="decimal" value={String(l.qalinlik ?? "")} disabled={!editable}
                  onChange={e => upd(i, { qalinlik: e.target.value.replace(",", ".") })} className={`${INPUT} text-center`} style={INPUT_STYLE} /></td>
                <td className="px-1.5" style={{ width: 100 }}><input inputMode="decimal" value={String(l.lambda ?? "")} disabled={!editable}
                  onChange={e => upd(i, { lambda: e.target.value.replace(",", ".") })} className={`${INPUT} text-center`} style={INPUT_STYLE} /></td>
                <td className="px-1.5 font-bold text-center" style={{ color: "#3F8CFF", width: 70 }}>{nf(calcLayers?.[i]?.R, 3)}</td>
                <td className="px-1" style={{ width: 36 }}>
                  {editable && (allowEmpty || layers.length > 1) && (
                    <button onClick={() => onChange(layers.filter((_, j) => j !== i))} title="O'chirish"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FDECEC]"><Trash2 size={14} style={{ color: "#FF5C5C" }} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end justify-between gap-3 flex-wrap mt-2">
          {editable ? (
            <button onClick={() => onChange([...layers, { nomi: "", qalinlik: "", lambda: "" }])}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 10 }}>
              <Plus size={14} /> Qatlam qo&apos;shish
            </button>
          ) : <span />}
          <div className="flex gap-2 flex-wrap">
            {alpha.map(([k, label]) => (
              <label key={k} style={{ width: 110 }}>
                <span className="block text-[11px] font-bold mb-1" style={{ color: "#7D8592" }}>{label}</span>
                <input inputMode="decimal" value={String(data[k] ?? "")} disabled={!editable} placeholder={placeholders?.[k]}
                  onChange={e => onAlpha({ [k]: e.target.value.replace(",", ".") } as Partial<AuditData>)} className={INPUT} style={INPUT_STYLE} />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoSlot({ src, busy, editable, onPick, onRemove }: {
  src?: string; busy: boolean; editable: boolean; onPick: (f: File) => void; onRemove: () => void;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden flex items-center justify-center"
      style={{ background: "#F4F9FD", borderRadius: 12, border: src ? "1px solid #E4EAF2" : "1.5px dashed #C9D6E8" }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="w-full h-full object-cover" />
        : <Camera size={22} style={{ color: "#C4CBD6" }} />}
      {busy && <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.7)" }}><Loader2 size={20} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>}
      {editable && !busy && (
        <>
          <label className="absolute inset-0 cursor-pointer" title={src ? "Almashtirish" : "Surat yuklash"}>
            <input type="file" accept="image/jpeg,image/png" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
          </label>
          {src && (
            <button onClick={onRemove} title="O'chirish" className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center"
              style={{ background: "rgba(10,22,41,0.6)", borderRadius: 8 }}>
              <X size={14} color="#FFFFFF" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CalcPanel({ calc }: { calc: AuditCalc | null }) {
  if (!calc) return null;
  const ok = (v: boolean | null) => v == null ? null : v
    ? <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#16A34A" }}><CheckCircle2 size={13} /> мос</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#EF4444" }}><XCircle size={13} /> мос эмас</span>;
  const colors: Record<string, string> = { tom: "#6D5DD3", devor: "#3F8CFF", deraza: "#15C0E6", eshik: "#FFB020", pol: "#8D6E63" };
  const row = (label: React.ReactNode, value: React.ReactNode) => (
    <div className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: "1px solid #F4F9FD" }}>
      <span style={{ color: "#7D8592" }}>{label}</span><span className="font-bold" style={{ color: "#0A1629" }}>{value}</span>
    </div>
  );
  return (
    <aside className="xl:sticky xl:top-24 flex flex-col gap-4">
      <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
        <SectionHead icon={Calculator} title="Hisob-kitob" sub="Forma o'zgarishi bilan avtomatik yangilanadi" />
        <div className="px-5 pb-5">
          {row(<>Devor R<sub>0</sub></>, <span className="flex items-center gap-2">{nf(calc.devor.R0, 3)} {ok(calc.taqqoslash.devor)}</span>)}
          {row(<>Tom R<sub>0</sub></>, <span className="flex items-center gap-2">{nf(calc.tom.R0, 3)} {ok(calc.taqqoslash.tom)}</span>)}
          {row(<>Pol R<sub>0</sub></>, calc.pol.R0 == null ? <span style={{ color: "#91929E" }}>mavjud emas</span>
            : <span className="flex items-center gap-2">{nf(calc.pol.R0, 3)} {ok(calc.taqqoslash.pol)}</span>)}
          {row("Derazalar", <span className="flex items-center gap-2">{calc.deraza_soni} ta · {nf(calc.deraza_maydon)} m² {ok(calc.taqqoslash.deraza)}</span>)}
          {row("Umumiy hajm", `${nf(calc.hajm, 1)} m³`)}
          {row("Devor maydoni", `${nf(calc.devor_maydon)} m²`)}
          {row("Δt", `${nf(calc.dt, 1)} °C`)}

          <p className="text-xs font-bold mt-4 mb-2" style={{ color: "#3D4557" }}>Issiqlik yo&apos;qotishlari — jami {nf(calc.jami_kw, 1)} kVt</p>
          <div className="flex h-3 overflow-hidden mb-3" style={{ borderRadius: 6, background: "#F4F9FD" }}>
            {calc.yoqotishlar.map(x => <div key={x.key} style={{ width: `${x.ulush}%`, background: colors[x.key] }} title={`${x.nomi}: ${x.ulush}%`} />)}
          </div>
          {calc.yoqotishlar.map(x => (
            <div key={x.key} className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-2" style={{ color: "#3D4557" }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors[x.key] }} />{x.nomi}
              </span>
              <span className="font-bold" style={{ color: "#0A1629" }}>{nf(x.kw, 2)} kVt <span className="font-normal text-xs" style={{ color: "#91929E" }}>({nf(x.ulush, 1)}%)</span></span>
            </div>
          ))}
        </div>
      </div>

    </aside>
  );
}
