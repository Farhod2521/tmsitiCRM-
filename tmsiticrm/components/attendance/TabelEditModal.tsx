"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { X, Loader2, Save, RotateCcw, PencilLine } from "lucide-react";
import { CODE_CFG, OVERRIDE_COLOR } from "@/components/attendance/tabelCodes";

export interface EditableRow {
  employee_id: number;
  full_name: string;
  department_name: string | null;
  cells: Record<string, string>;
  auto_cells?: Record<string, string>;
  overridden?: number[];
  day_info?: Record<string, { check_in: string | null }>;
}

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

// Oynadagi tanlov tugmalari: kod | "" (bo'sh) | null (avtomatik hisobga qaytarish)
const PALETTE: { code: string | null; label: string }[] = [
  { code: "8",  label: "8 — Kelgan" },
  { code: "MT", label: "MT — Mehnat ta'tili" },
  { code: "B",  label: "B — Bolnichniy" },
  { code: "K",  label: "K — Xizmat safari" },
  { code: "O'", label: "O' — O'quv ta'tili" },
  { code: "Д",  label: "Д — Dekret" },
  { code: "X",  label: "X — Dam olish" },
  { code: "",   label: "Bo'sh (kelmagan)" },
  { code: null, label: "Avtomatik hisob" },
];

/** Kadr: bitta xodimning oylik davomatini qo'lda tuzatish. Kunlarni tanlab,
 *  pastdagi koddan birini bosing — "Saqlash" bosilganda tabelga yoziladi. */
export default function TabelEditModal({ row, year, month, daysInMonth, holidays, onClose, onSaved }: {
  row: EditableRow;
  year: number;
  month: number;
  daysInMonth: number;
  holidays?: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  // {kun: kod | null} — saqlanmagan o'zgarishlar (null = avtomatikka qaytarish)
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overridden = new Set(row.overridden ?? []);
  const auto = row.auto_cells ?? row.cells;

  function effective(day: number): { code: string; isOverride: boolean } {
    const k = String(day);
    if (k in draft) {
      const v = draft[k];
      return v === null ? { code: auto[k] ?? "", isOverride: false } : { code: v, isOverride: true };
    }
    return { code: row.cells[k] ?? "", isOverride: overridden.has(day) };
  }

  function toggle(day: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  }

  function selectWorkdays() {
    const s = new Set<number>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = (new Date(year, month - 1, d).getDay() + 6) % 7;
      if (dow < 5 && !holidays?.[String(d)]) s.add(d);
    }
    setSelected(s);
  }

  function apply(code: string | null) {
    if (selected.size === 0) { setError("Avval kunlarni tanlang"); return; }
    setError(null);
    setDraft(prev => {
      const next = { ...prev };
      selected.forEach(d => {
        const k = String(d);
        // Asl holat bilan bir xil bo'lsa — o'zgarish sifatida saqlamaymiz
        const unchanged = code === null ? !overridden.has(d) : overridden.has(d) && row.cells[k] === code;
        if (unchanged) delete next[k]; else next[k] = code;
      });
      return next;
    });
    setSelected(new Set());
  }

  const changedCount = Object.keys(draft).length;

  async function save() {
    if (!changedCount) { onClose(); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch("/tabel/auto/overrides", {
        method: "PUT",
        body: JSON.stringify({ employee_id: row.employee_id, year, month, changes: draft }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}>
        {/* Sarlavha */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(109,93,211,0.12)", borderRadius: 12 }}>
              <PencilLine size={18} style={{ color: OVERRIDE_COLOR }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate" style={{ color: "#0A1629" }}>{row.full_name}</p>
              <p className="text-xs truncate" style={{ color: "#91929E" }}>
                {MON_NAMES[month - 1]} {year}{row.department_name ? ` · ${row.department_name}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex-shrink-0 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-xs" style={{ color: "#7D8592" }}>
              Kunlarni bosib tanlang, so&apos;ng pastdan kodni tanlang.
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={selectWorkdays} className="px-2.5 py-1.5 text-[11px] font-bold" style={{ background: "#F4F9FD", color: "#3F8CFF", borderRadius: 8 }}>
                Ish kunlarini tanlash
              </button>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} className="px-2.5 py-1.5 text-[11px] font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 8 }}>
                  Tanlovni bekor qilish ({selected.size})
                </button>
              )}
            </div>
          </div>

          {/* Kalendar */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEK_DAYS.map((w, i) => (
              <div key={w} className="text-center text-[11px] font-bold" style={{ color: i >= 5 ? "#FF8C8C" : "#91929E" }}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, idx) => {
              if (d === null) return <div key={`e${idx}`} />;
              const k = String(d);
              const { code, isOverride } = effective(d);
              const cfg = CODE_CFG[code];
              const isSel = selected.has(d);
              const pending = k in draft;
              const autoCode = auto[k] ?? "";
              const checkIn = row.day_info?.[k]?.check_in;
              const holiday = holidays?.[k];
              return (
                <button key={k} onClick={() => toggle(d)}
                  title={[holiday && `Bayram: ${holiday}`, checkIn && `Keldi: ${checkIn}`, isOverride && `Avtomatik: ${autoCode || "bo'sh"}`].filter(Boolean).join(" · ") || undefined}
                  className="relative flex flex-col items-center justify-center gap-1 py-2 transition-all"
                  style={{
                    minHeight: 62,
                    borderRadius: 12,
                    background: isSel ? "rgba(63,140,255,0.08)" : "#FFFFFF",
                    border: isSel ? "2px solid #3F8CFF" : pending ? `2px dashed ${OVERRIDE_COLOR}` : "1px solid #F0F3F8",
                  }}>
                  <span className="text-[11px] font-bold" style={{ color: idx % 7 >= 5 ? "#FF8C8C" : "#0A1629" }}>{d}</span>
                  <span className="inline-flex items-center justify-center text-[10px] font-bold"
                    style={{ minWidth: 26, height: 20, padding: "0 3px", borderRadius: 5, color: cfg?.color || "#C4CBD6", background: cfg?.bg || "#F8FAFF", border: code ? "none" : "1px dashed #D9E3F0" }}>
                    {code || "—"}
                  </span>
                  {checkIn && <span className="text-[9px] leading-none" style={{ color: "#A8B0BD" }}>{checkIn}</span>}
                  {isOverride && (
                    <span className="absolute" title="Kadr tuzatgan" style={{ top: 4, right: 4, width: 6, height: 6, borderRadius: 3, background: OVERRIDE_COLOR }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Kodlar */}
          <p className="text-xs font-bold mt-4 mb-2" style={{ color: "#7D8592" }}>
            {selected.size > 0 ? `Tanlangan ${selected.size} kunga qo'yish:` : "Kod (avval kunlarni tanlang):"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map(p => {
              const cfg = p.code ? CODE_CFG[p.code] : undefined;
              return (
                <button key={p.label} onClick={() => apply(p.code)} disabled={selected.size === 0}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-bold disabled:opacity-40 hover:shadow-sm transition-all"
                  style={{
                    borderRadius: 10,
                    background: p.code === null ? "#F4F9FD" : cfg?.bg || "#FFFFFF",
                    color: p.code === null ? "#7D8592" : cfg?.color || "#7D8592",
                    border: p.code === "" ? "1px dashed #D9E3F0" : "1px solid transparent",
                  }}>
                  {p.code === null && <RotateCcw size={12} />}
                  {p.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "#A8B0BD" }}>
            <span style={{ color: OVERRIDE_COLOR }}>●</span> — kadr qo&apos;lda tuzatgan kun. &quot;Avtomatik hisob&quot; tuzatishni olib tashlaydi —
            kun yana davomat, ta&apos;til va bayramlar bo&apos;yicha hisoblanadi. Qo&apos;lda qo&apos;yilgan &quot;8&quot; kechikishsiz to&apos;liq 8 soat hisoblanadi.
          </p>
          {error && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{error}</p>}
        </div>

        {/* Pastki qism */}
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderTop: "1px solid #F4F9FD" }}>
          <span className="text-xs font-bold" style={{ color: changedCount ? OVERRIDE_COLOR : "#A8B0BD" }}>
            {changedCount ? `${changedCount} ta kun o'zgartirildi` : "O'zgarish yo'q"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>
              Bekor qilish
            </button>
            <button onClick={save} disabled={saving || !changedCount}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#3F8CFF", borderRadius: 12, boxShadow: "0px 6px 12px rgba(63,140,255,0.3)" }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Saqlash
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
