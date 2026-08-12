"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, Timer, Send,
  Lock, Unlock, X, CheckCheck,
} from "lucide-react";

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

interface WeekInfo {
  week: number; start: string; end: string; label: string; max_ball: number; is_current: boolean;
}
interface WindowOverride {
  id: number; year: number; month: number; week: number; open_until: string; created_by: number | null;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HisobotSozlamalariPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [overrides, setOverrides] = useState<WindowOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [extendTarget, setExtendTarget] = useState<WeekInfo | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<WeekInfo | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const w = await apiFetch<WeekInfo[]>(`/reports/weekly/weeks?year=${y}&month=${m}`);
      setWeeks(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Haftalar ro'yxatini yuklab bo'lmadi");
      setWeeks([]);
      setLoading(false);
      return;
    }
    try {
      const o = await apiFetch<WindowOverride[]>(`/reports/weekly/window-overrides?year=${y}&month=${m}`);
      setOverrides(o);
    } catch (e) {
      console.error("window-overrides yuklashda xato (backend yangilanmagan bo'lishi mumkin):", e);
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); load(y, m);
  }

  async function closeOverride(id: number) {
    if (!confirm("Uzaytirilgan muddatni bekor qilib, haftani yana yopishni tasdiqlaysizmi?")) return;
    try {
      await apiFetch(`/reports/weekly/window-override/${id}`, { method: "DELETE" });
      load(year, month);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    }
  }

  const today = todayStr();

  return (
    <div>
      <Header title="Hisobot sozlamalari" subtitle="Haftalik hisobot muddatlarini boshqaring va topshirmaganlarga eslatma yuboring" />

      <div className="flex items-center justify-end mb-5">
        <div className="flex items-center gap-1 p-1" style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
          </button>
          <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 130, textAlign: "center" }}>
            {MON_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : error ? (
        <div className="py-20 text-center" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <p className="font-bold" style={{ color: "#FF5C5C" }}>{error}</p>
          <p className="text-xs mt-2" style={{ color: "#91929E" }}>Backend yangilanganini va deploy qilinganini tekshiring.</p>
        </div>
      ) : weeks.length === 0 ? (
        <div className="py-20 text-center" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <p className="font-bold" style={{ color: "#0A1629" }}>Bu oy uchun haftalar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {weeks.map(w => {
            const override = overrides.find(o => o.week === w.week);
            const isPast = w.end < today && !w.is_current;
            const isFuture = w.start > today && !w.is_current;
            const isOpen = w.is_current || !!override;

            return (
              <div key={w.week} className="p-4" style={{ background: "#FFFFFF", borderRadius: 18, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} style={{ color: "#91929E" }} />
                  <span className="text-sm font-bold" style={{ color: "#0A1629" }}>{w.week}-hafta</span>
                </div>
                <p className="text-xs mb-3" style={{ color: "#91929E" }}>{w.label}</p>

                {w.is_current ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 mb-3" style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 8 }}>
                    <Unlock size={11} /> Joriy hafta
                  </span>
                ) : override ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 mb-3" style={{ background: "rgba(0,196,140,0.1)", color: "#00C48C", borderRadius: 8 }}>
                    <Unlock size={11} /> {fmtDt(override.open_until)} gacha ochiq
                  </span>
                ) : isFuture ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 mb-3" style={{ background: "#F4F9FD", color: "#C4CBD6", borderRadius: 8 }}>
                    Hali boshlanmagan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 mb-3" style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 8 }}>
                    <Lock size={11} /> Yopilgan
                  </span>
                )}

                <div className="flex flex-col gap-2">
                  {isPast && (
                    override ? (
                      <button onClick={() => closeOverride(override.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
                        style={{ background: "#FFFFFF", border: "1.5px solid #FFD5D5", color: "#FF5C5C", borderRadius: 10 }}>
                        <Lock size={12} /> Muddatidan oldin yopish
                      </button>
                    ) : (
                      <button onClick={() => setExtendTarget(w)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white"
                        style={{ background: "#3F8CFF", borderRadius: 10 }}>
                        <Timer size={12} /> Muddatni uzaytirish
                      </button>
                    )
                  )}
                  {!isOpen && (
                    <button onClick={() => setNotifyTarget(w)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white"
                      style={{ background: "#0088CC", borderRadius: 10 }}>
                      <Send size={12} /> Telegram orqali eslatish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {extendTarget && (
        <ExtendModal
          year={year} month={month} week={extendTarget}
          onClose={() => setExtendTarget(null)}
          onSaved={() => { setExtendTarget(null); load(year, month); }}
        />
      )}

      {notifyTarget && (
        <NotifyModal
          year={year} month={month} week={notifyTarget.week} weekLabel={notifyTarget.label}
          onClose={() => setNotifyTarget(null)}
        />
      )}
    </div>
  );
}

function ExtendModal({ year, month, week, onClose, onSaved }: {
  year: number; month: number; week: WeekInfo; onClose: () => void; onSaved: () => void;
}) {
  const [dt, setDt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!dt) { alert("Sana va vaqtni tanlang"); return; }
    setSaving(true);
    try {
      await apiFetch("/reports/weekly/window-override", {
        method: "POST",
        body: JSON.stringify({ year, month, week: week.week, open_until: dt }),
      });
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[440px] p-7 relative"
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 10 }}>
          <X size={15} style={{ color: "#91929E" }} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 flex items-center justify-center" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 14 }}>
            <Timer size={20} style={{ color: "#3F8CFF" }} />
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>Muddatni uzaytirish</h3>
            <p className="text-xs" style={{ color: "#91929E" }}>{week.week}-hafta ({week.label})</p>
          </div>
        </div>

        <label className="block text-sm font-bold mb-2" style={{ color: "#0A1629" }}>Qachongacha ochiq bo'lsin</label>
        <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
          className="w-full px-4 py-3 text-sm font-bold outline-none"
          style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629", border: "1.5px solid #EEF2FF" }} />
        <p className="text-xs mt-2" style={{ color: "#91929E" }}>Belgilangan vaqtgacha xodimlar shu hafta uchun hisobot yuklay/tahrirlay oladi.</p>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 font-bold text-sm" style={{ background: "#F4F9FD", borderRadius: 14, color: "#7D8592" }}>
            Bekor qilish
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.3)" }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={15} />}
            {saving ? "Saqlanmoqda..." : "Ochish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotifyModal({ year, month, week, weekLabel, onClose }: {
  year: number; month: number; week: number; weekLabel: string; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [count, setCount] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    apiFetch<{ count: number; text: string }>(`/reports/weekly/missing?year=${year}&month=${month}&week=${week}`)
      .then(d => { setCount(d.count); setText(d.text); })
      .catch(() => alert("Ma'lumotni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [year, month, week]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiFetch("/reports/weekly/send-telegram", { method: "POST", body: JSON.stringify({ text }) });
      setSent(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Yuborishda xato");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-[520px] p-7 relative"
        style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 10 }}>
          <X size={15} style={{ color: "#91929E" }} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center" style={{ background: "rgba(0,136,204,0.1)", borderRadius: 14 }}>
            <Send size={20} style={{ color: "#0088CC" }} />
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>Telegram orqali eslatish</h3>
            <p className="text-xs" style={{ color: "#91929E" }}>{week}-hafta ({weekLabel}) — guruhga xabar yuboriladi</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={24} className="animate-spin" style={{ color: "#3F8CFF" }} />
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 flex items-center justify-center mb-3" style={{ background: "rgba(0,196,140,0.1)", borderRadius: 18 }}>
              <CheckCheck size={26} style={{ color: "#00C48C" }} />
            </div>
            <p className="font-bold text-base" style={{ color: "#0A1629" }}>Xabar yuborildi</p>
            <p className="text-sm mt-1" style={{ color: "#91929E" }}>Telegram guruhiga muvaffaqiyatli jo'natildi</p>
            <button onClick={onClose} className="mt-5 px-6 py-2.5 font-bold text-sm" style={{ background: "#F4F9FD", borderRadius: 12, color: "#7D8592" }}>
              Yopish
            </button>
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 flex items-center justify-center mb-3" style={{ background: "rgba(0,196,140,0.1)", borderRadius: 18 }}>
              <CheckCheck size={26} style={{ color: "#00C48C" }} />
            </div>
            <p className="font-bold text-base" style={{ color: "#0A1629" }}>Hammasi topshirilgan</p>
            <p className="text-sm mt-1" style={{ color: "#91929E" }}>Bu hafta uchun hisobot topshirmaganlar yo'q</p>
          </div>
        ) : (
          <>
            <label className="block text-sm font-bold mb-2" style={{ color: "#0A1629" }}>
              Xabar matni
              <span className="ml-2 text-xs font-normal" style={{ color: "#91929E" }}>({count} kishi)</span>
            </label>
            <textarea rows={9} value={text} onChange={e => setText(e.target.value)}
              className="w-full px-4 py-3 text-sm outline-none resize-none"
              style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629", border: "1.5px solid #EEF2FF", lineHeight: 1.6 }} />
            <p className="text-[11px] mt-1.5" style={{ color: "#91929E" }}>Xohlasangiz matnga qo'shimcha yozib qo'shishingiz mumkin.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-3 font-bold text-sm" style={{ background: "#F4F9FD", borderRadius: 14, color: "#7D8592" }}>
                Bekor qilish
              </button>
              <button onClick={handleSend} disabled={sending}
                className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#0088CC", borderRadius: 14, boxShadow: "0px 6px 12px rgba(0,136,204,0.3)" }}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                {sending ? "Yuborilmoqda..." : "Yuborish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
