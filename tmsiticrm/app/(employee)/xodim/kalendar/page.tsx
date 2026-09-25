"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2, PartyPopper, Trash2, X, CalendarDays } from "lucide-react";

interface Holiday {
  id: number;
  date: string; // "2026-09-01"
  name: string;
}

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const HOLIDAY_COLOR = "#E0457B";
const HOLIDAY_BG = "rgba(224,69,123,0.1)";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmtUz(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

export default function KalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Tanlangan kun uchun forma
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      setHolidays(await apiFetch<Holiday[]>(`/holidays?year=${y}`));
    } catch (e) {
      console.error(e);
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const byDate = new Map(holidays.map(h => [h.date, h]));
  const selectedHoliday = selected ? byDate.get(selected) : undefined;

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  function openDay(d: string) {
    setSelected(d);
    setName(byDate.get(d)?.name ?? "");
    setDateTo("");
    setError(null);
  }

  async function save() {
    if (!selected) return;
    if (!name.trim()) { setError("Bayram nomini kiriting"); return; }
    if (dateTo && dateTo < selected) { setError("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas"); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch<Holiday[]>("/holidays", {
        method: "POST",
        body: JSON.stringify({ date_from: selected, date_to: dateTo || null, name: name.trim() }),
      });
      await load(year);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function remove(h: Holiday) {
    if (!confirm(`${fmtUz(h.date)} — "${h.name}" bayram belgisini olib tashlaysizmi?`)) return;
    try {
      await apiFetch(`/holidays/${h.id}`, { method: "DELETE" });
      await load(year);
      if (selected === h.date) setSelected(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    }
  }

  // Kalendar katakchalari (Dushanbadan boshlanadi)
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const todayIso = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const monthHolidays = holidays.filter(h => h.date.startsWith(monthPrefix));

  return (
    <div>
      <Header title="Kalendar" subtitle="Bayram kunlarini belgilang — tabel, davomat va telegram eslatmalari shunga moslashadi" />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Kalendar */}
        <div style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
            <div>
              <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Bayram kunlari kalendari</h3>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Kun ustiga bosib bayram deb belgilang</p>
            </div>
            <div className="flex items-center gap-1 p-1" style={{ background: "#F4F9FD", borderRadius: 12 }}>
              <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
              </button>
              <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 120, textAlign: "center" }}>
                {MON_NAMES[month - 1]} {year}
              </span>
              <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {WEEK_DAYS.map((w, i) => (
                    <div key={w} className="text-center text-xs font-bold py-1" style={{ color: i >= 5 ? "#FF8C8C" : "#91929E" }}>{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {cells.map((d, idx) => {
                    if (d === null) return <div key={`e${idx}`} />;
                    const ds = iso(year, month, d);
                    const h = byDate.get(ds);
                    const isWeekend = idx % 7 >= 5;
                    const isSel = selected === ds;
                    const isToday = ds === todayIso;
                    return (
                      <button key={ds} onClick={() => openDay(ds)}
                        className="flex flex-col items-start justify-between p-2 text-left transition-all hover:shadow-md"
                        style={{
                          minHeight: 84,
                          borderRadius: 14,
                          background: h ? HOLIDAY_BG : isWeekend ? "#FAFCFF" : "#FFFFFF",
                          border: isSel ? `2px solid ${h ? HOLIDAY_COLOR : "#3F8CFF"}` : isToday ? "2px solid #3F8CFF55" : "1px solid #F0F3F8",
                        }}>
                        <span className="text-sm font-bold" style={{ color: h ? HOLIDAY_COLOR : isWeekend ? "#FF8C8C" : "#0A1629" }}>{d}</span>
                        {h && (
                          <span className="flex items-start gap-1 text-[10.5px] font-bold leading-tight w-full" style={{ color: HOLIDAY_COLOR }}>
                            <PartyPopper size={11} className="flex-shrink-0 mt-px" />
                            <span className="line-clamp-2 break-words">{h.name}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* O'ng panel: forma + ro'yxat */}
        <div className="flex flex-col gap-6">
          {selected && (
            <div className="p-5" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold" style={{ color: "#91929E" }}>{selectedHoliday ? "Bayramni tahrirlash" : "Bayram deb belgilash"}</p>
                  <p className="font-bold text-lg mt-0.5" style={{ color: "#0A1629" }}>{fmtUz(selected)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
                  <X size={15} style={{ color: "#7D8592" }} />
                </button>
              </div>

              <label className="block text-xs font-bold mt-4 mb-1.5" style={{ color: "#7D8592" }}>Bayram nomi</label>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="Masalan: Mustaqillik kuni"
                onKeyDown={e => { if (e.key === "Enter") save(); }}
                className="w-full px-4 py-3 text-sm outline-none"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0", color: "#0A1629" }} />

              {!selectedHoliday && (
                <>
                  <label className="block text-xs font-bold mt-3 mb-1.5" style={{ color: "#7D8592" }}>Gacha (ixtiyoriy — bir necha kunlik bayram uchun)</label>
                  <input type="date" value={dateTo} min={selected} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-4 py-3 text-sm outline-none"
                    style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0", color: "#0A1629" }} />
                </>
              )}

              {error && <p className="text-xs font-bold mt-3" style={{ color: "#FF5C5C" }}>{error}</p>}

              <div className="flex items-center gap-2 mt-4">
                <button onClick={save} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: HOLIDAY_COLOR, borderRadius: 12, boxShadow: `0px 6px 12px ${HOLIDAY_COLOR}4D` }}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <PartyPopper size={15} />}
                  {selectedHoliday ? "Saqlash" : "Bayram deb belgilash"}
                </button>
                {selectedHoliday && (
                  <button onClick={() => remove(selectedHoliday)} title="Bayram belgisini olib tashlash"
                    className="w-12 h-[46px] flex items-center justify-center"
                    style={{ background: "rgba(255,92,92,0.1)", borderRadius: 12 }}>
                    <Trash2 size={16} style={{ color: "#FF5C5C" }} />
                  </button>
                )}
              </div>

              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "#A8B0BD" }}>
                Bayram kuni ish kuni hisoblanmaydi: tabelda <b style={{ color: HOLIDAY_COLOR }}>BY</b> belgisi turadi,
                kelmaganlar hisoblanmaydi va telegram bot 09:00 eslatmasini yubormaydi.
              </p>
            </div>
          )}

          <div className="p-5" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={16} style={{ color: HOLIDAY_COLOR }} />
              <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{MON_NAMES[month - 1]} bayramlari</p>
            </div>
            {monthHolidays.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "#91929E" }}>Bu oyda bayram belgilanmagan</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {monthHolidays.map(h => (
                  <li key={h.id} className="flex items-center gap-3 p-3" style={{ background: HOLIDAY_BG, borderRadius: 12 }}>
                    <button onClick={() => openDay(h.date)} className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold" style={{ color: HOLIDAY_COLOR }}>{fmtUz(h.date)}</p>
                      <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{h.name}</p>
                    </button>
                    <button onClick={() => remove(h)} title="O'chirish" className="w-8 h-8 flex items-center justify-center flex-shrink-0 hover:bg-white rounded-lg transition-colors">
                      <Trash2 size={14} style={{ color: "#FF5C5C" }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {holidays.length > monthHolidays.length && (
              <p className="text-[11px] mt-3" style={{ color: "#A8B0BD" }}>{year}-yilda jami {holidays.length} ta bayram kuni belgilangan</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
