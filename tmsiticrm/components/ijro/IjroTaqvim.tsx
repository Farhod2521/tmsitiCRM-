"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Search, Paperclip, Inbox,
} from "lucide-react";
import type { IjroDoc } from "@/components/ijro/IjroNazorat";
import IjroDocModal from "@/components/ijro/IjroDocModal";
import {
  TASK_STATUS, MONTHS, WEEKDAYS, MANBA_LABEL, TUR_LABEL, ymd, daysFromToday, calendarStatus, fmtShort, relDays,
  StatusPill, StatusIcon, infoOf, type TaskStatus,
} from "@/components/ijro/ijroShared";

const ORDER: TaskStatus[] = ["otgan", "tasdiqlashda", "bajarilmoqda", "bajarilgan"];
const PANEL_KEY = "ijro_taqvim_panel";

function DocCard({ d, onOpen }: { d: IjroDoc; onOpen: () => void }) {
  const s = calendarStatus(d);
  const overdue = s === "otgan";
  const late = overdue ? -(daysFromToday(d.ijro_muddati) ?? 0) : 0;
  const bolimlar = infoOf(d).filter(b => b.holati !== "rad_etildi").map(b => b.name);
  return (
    <button onClick={onOpen} className="w-full text-left p-4 flex gap-3 transition-shadow hover:shadow-md"
      style={{ background: overdue ? "#FEF3F2" : "#FFFFFF", border: `1px solid ${overdue ? "#F9C6BE" : "#E4E7EC"}`, borderRadius: 14 }}>
      <StatusIcon s={s} size={22} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <b className="text-[15px]" style={{ color: "#101828" }}>{d.hujjat_raqami || `DOC-${d.id}`}</b>
          <span className="text-xs" style={{ color: "#667085" }}>{fmtShort(d.hujjat_sanasi || d.created_at)}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#F2F4F7", color: "#475467", borderRadius: 6 }}>{TUR_LABEL[d.tur] ?? d.tur}</span>
            {d.fayl_name && <span className="flex items-center gap-0.5 text-xs" style={{ color: "#475467" }}><Paperclip size={12} />1</span>}
          </span>
        </span>
        <span className="block text-[13.5px] font-medium mt-1.5 line-clamp-2" style={{ color: "#101828" }}>{d.mazmun || d.sarlavha || "—"}</span>
        {d.sarlavha && d.mazmun && <span className="block text-[13px] mt-1 line-clamp-1" style={{ color: "#667085" }}>{d.sarlavha}</span>}
        <span className="block text-xs mt-1 truncate" style={{ color: "#667085" }}>
          {MANBA_LABEL[d.manba] ?? ""}{bolimlar.length ? ` · ${bolimlar[0]}${bolimlar.length > 1 ? ` +${bolimlar.length - 1}` : ""}` : ""}
        </span>
        {overdue && late > 0 && (
          <span className="flex justify-end mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold" style={{ background: "#FDE7E4", color: "#B42318", border: "1px solid #F9C6BE", borderRadius: 8 }}>
              <StatusIcon s="otgan" size={14} /> {late} kun kechikdi
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

/** Ijro roli — Taqvim: oy kalendari + tanlangan kun hujjatlari paneli. */
export default function IjroTaqvim({ docs, myId }: { docs: IjroDoc[]; myId: number | null }) {
  const today = ymd(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(today);
  const [panel, setPanel] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  // Panel holati eslab qolinadi
  useEffect(() => { try { if (localStorage.getItem(PANEL_KEY) === "1") setPanel(true); } catch { /* noop */ } }, []);
  function togglePanel(v: boolean) { setPanel(v); try { localStorage.setItem(PANEL_KEY, v ? "1" : "0"); } catch { /* noop */ } }

  const visible = useMemo(() => docs.filter(d => d.ijro_muddati && (!onlyMine || d.created_by === myId)), [docs, onlyMine, myId]);
  const byDay = useMemo(() => {
    const m = new Map<string, IjroDoc[]>();
    for (const d of visible) { const k = d.ijro_muddati!.slice(0, 10); (m.get(k) ?? m.set(k, []).get(k)!).push(d); }
    return m;
  }, [visible]);

  const first = (cursor.getDay() + 6) % 7;
  const nDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Date[] = Array.from({ length: Math.ceil((first + nDays) / 7) * 7 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - first + 1));
  const monthActive = visible.filter(d => d.ijro_muddati!.slice(0, 7) === ymd(cursor).slice(0, 7) && calendarStatus(d) !== "bajarilgan").length;

  const selDocs = (byDay.get(sel) ?? []).filter(d => {
    if (!q.trim()) return true;
    const hay = [d.hujjat_raqami, d.sarlavha, d.mazmun, d.masul_bolimlar_nomi, d.masul_bolim_boshliqlari_nomi, d.masul_orinbosar_nomi].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const selDate = new Date(sel + "T00:00:00");
  const selRel = daysFromToday(sel) ?? 0;

  function pick(k: string) {
    setSel(k);
    togglePanel(true);
    const d = new Date(k + "T00:00:00");
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function shiftDay(n: number) { const d = new Date(sel + "T00:00:00"); d.setDate(d.getDate() + n); pick(ymd(d)); }

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 6px 30px rgba(196,203,214,0.18)" }}>
      {/* Yuqori panel */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid #EEF1F6" }}>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Oldingi oy"
          className="w-10 h-10 flex items-center justify-center hover:bg-[#F7F9FC]" style={{ border: "1px solid #E4E7EC", borderRadius: 10 }}>
          <ChevronLeft size={18} style={{ color: "#344054" }} />
        </button>
        <h2 className="font-bold text-2xl sm:text-[30px] text-center" style={{ color: "#101828", minWidth: 210 }}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Keyingi oy"
          className="w-10 h-10 flex items-center justify-center hover:bg-[#F7F9FC]" style={{ border: "1px solid #E4E7EC", borderRadius: 10 }}>
          <ChevronRight size={18} style={{ color: "#344054" }} />
        </button>
        {monthActive > 0 && (
          <span className="min-w-8 h-8 px-2 flex items-center justify-center text-sm font-bold text-white" title="Shu oydagi bajarilmagan topshiriqlar"
            style={{ background: "#3F8CFF", borderRadius: 999 }}>{monthActive}</span>
        )}
        <div className="ml-auto flex items-center gap-4">
          {myId !== null && (
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none" style={{ color: "#344054" }}>
              <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="w-4 h-4 accent-[#3F8CFF]" />
              Men kiritgan topshiriqlar
            </label>
          )}
          <button onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); pick(today); }}
            className="px-4 py-2.5 text-sm font-semibold hover:bg-[#F7F9FC]" style={{ border: "1px solid #E4E7EC", borderRadius: 10, color: "#101828" }}>
            Bugun
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Kalendar */}
        <div className="flex-1 min-w-0 px-3 sm:px-5 pb-5 pt-4">
          <div className="flex items-center gap-4 mb-3 min-h-10">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {ORDER.map(s => (
                <span key={s} className="flex items-center gap-2 text-[13px]" style={{ color: "#475467" }}>
                  <StatusIcon s={s} size={18} />{TASK_STATUS[s].label}
                </span>
              ))}
            </div>
            <button onClick={() => togglePanel(!panel)} aria-label={panel ? "Panelni yopish" : "Panelni ochish"}
              title={panel ? "Panelni yopish" : "Kun hujjatlarini ochish"}
              className="relative ml-auto w-10 h-10 flex-shrink-0 flex items-center justify-center hover:bg-[#F7F9FC]"
              style={{ border: "1px solid #E4E7EC", borderRadius: 10 }}>
              {panel ? <ChevronsRight size={18} style={{ color: "#344054" }} /> : <ChevronsLeft size={18} style={{ color: "#344054" }} />}
              {!panel && (byDay.get(sel)?.length ?? 0) > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: "#3F8CFF" }} />}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map(w => (
              <span key={w} className="px-1 pb-1 text-[11px] sm:text-sm font-semibold truncate" style={{ color: "#101828" }}>
                <span className="sm:hidden">{w.slice(0, 2)}</span><span className="hidden sm:inline">{panel ? w.slice(0, 3) : w}</span>
              </span>
            ))}
            {cells.map(c => {
              const k = ymd(c), inMonth = c.getMonth() === cursor.getMonth();
              const isToday = k === today, isSel = k === sel && panel;
              const list = byDay.get(k) ?? [];
              const counts = ORDER.map(s => [s, list.filter(d => calendarStatus(d) === s).length] as const).filter(([, n]) => n > 0);
              return (
                <button key={k} onClick={() => pick(k)}
                  className={`text-left p-1.5 sm:p-2.5 flex flex-col gap-1.5 transition-colors hover:border-[#B2C7F5] min-h-[62px] ${panel ? "sm:min-h-[128px]" : "sm:min-h-[150px]"}`}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isSel || isToday ? "#7EA6F8" : "#E4E7EC"}`,
                    background: isSel ? "#F4F7FF" : "#FFFFFF",
                    boxShadow: isSel ? "0 0 0 1px #7EA6F8" : undefined,
                  }}>
                  {isToday ? (
                    <span className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#3F8CFF" }}>{c.getDate()}</span>
                  ) : (
                    <span className="h-7 flex items-center px-0.5 text-sm font-semibold" style={{ color: inMonth ? "#101828" : "#98A2B3" }}>{c.getDate()}</span>
                  )}
                  <span className="flex flex-col gap-1.5 w-full mt-0.5">
                    {counts.map(([s, n]) => (
                      <span key={s} className="hidden sm:block"><StatusPill s={s} count={n} compact={panel} /></span>
                    ))}
                    {counts.length > 0 && (
                      <span className="sm:hidden flex flex-wrap gap-1">
                        {counts.map(([s]) => <span key={s} className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS[s].color }} />)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kun paneli */}
        {panel && (
          <div className="lg:w-[46%] flex-shrink-0 p-4 sm:p-5 flex flex-col gap-4" style={{ borderLeft: "1px solid #EEF1F6" }}>
            <div className="flex items-center gap-4 p-4" style={{ background: "#F7F9FC", border: "1px solid #E4E7EC", borderRadius: 16 }}>
              <span className="w-12 h-12 flex-shrink-0 flex items-center justify-center" style={{ background: "#E4ECFF", borderRadius: 12 }}>
                <CalendarDays size={22} style={{ color: "#3F5BD8" }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-base sm:text-lg leading-snug" style={{ color: "#101828" }}>
                  {WEEKDAYS[(selDate.getDay() + 6) % 7]}, {selDate.getDate()} {MONTHS[selDate.getMonth()].toLowerCase()} {selDate.getFullYear()}
                </span>
                <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold" style={{ background: "#E4E7EC", color: "#475467", borderRadius: 999 }}>{relDays(selRel)}</span>
              </span>
              <span className="flex gap-2">
                <button onClick={() => shiftDay(-1)} aria-label="Oldingi kun" className="w-10 h-10 flex items-center justify-center bg-white hover:bg-[#F2F4F7]" style={{ border: "1px solid #E4E7EC", borderRadius: 10 }}>
                  <ChevronLeft size={18} style={{ color: "#101828" }} />
                </button>
                <button onClick={() => shiftDay(1)} aria-label="Keyingi kun" className="w-10 h-10 flex items-center justify-center bg-white hover:bg-[#F2F4F7]" style={{ border: "1px solid #E4E7EC", borderRadius: 10 }}>
                  <ChevronRight size={18} style={{ color: "#101828" }} />
                </button>
              </span>
            </div>

            <label className="flex items-center gap-3 px-4 py-3" style={{ border: "1px solid #D0D5DD", borderRadius: 10 }}>
              <Search size={18} style={{ color: "#667085" }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Raqam, mazmun yoki ijrochi bo'yicha qidirish"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: "#101828" }} />
            </label>

            {selDocs.length ? ORDER.map(s => {
              const g = selDocs.filter(d => calendarStatus(d) === s);
              if (!g.length) return null;
              const c = TASK_STATUS[s];
              return (
                <div key={s} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 text-sm font-semibold" style={{ background: c.bg, color: c.color, borderRadius: 8 }}>
                      <StatusIcon s={s} size={16} />{c.label}<b className="ml-1">{g.length}</b>
                    </span>
                    <span className="flex-1 h-px" style={{ background: "#E4E7EC" }} />
                  </div>
                  {g.map(d => <DocCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} />)}
                </div>
              );
            }) : (
              <div className="flex flex-col items-center gap-2 py-12">
                <Inbox size={32} style={{ color: "#D0D5DD" }} />
                <p className="text-sm" style={{ color: "#98A2B3" }}>{q ? "Qidiruv bo'yicha topilmadi" : "Bu kunga muddatli topshiriq yo'q"}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {openId !== null && <IjroDocModal docId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
