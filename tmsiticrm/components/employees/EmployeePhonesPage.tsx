"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { Search, Phone, Copy, Check, Loader2, Inbox, Building2 } from "lucide-react";

interface Emp {
  id: number;
  full_name: string;
  position: string;
  phone: string;
  role: string;
  department: { id: number; name: string } | null;
}

const CARD: React.CSSProperties = { background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" };
const COLORS = ["#3F8CFF", "#6D5DD3", "#00A578", "#FF8C42", "#15C0E6", "#E5484D"];

function initials(n: string) { return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2); }
const digits = (s: string) => (s || "").replace(/\D/g, "");

/** "+998901234567" → "+998 90 123 45 67" */
function fmtPhone(p: string) {
  const d = digits(p);
  const m = d.match(/^(998)(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
  const n = d.match(/^(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (n) return `+998 ${n[1]} ${n[2]} ${n[3]} ${n[4]}`;
  return p;
}
const telHref = (p: string) => { const d = digits(p); return `tel:+${d.length === 9 ? "998" + d : d}`; };

/** Direktor/zamdirektor: xodimlarning ism-familiyasi va telefon raqamlari — qidiruv bilan. */
export default function EmployeePhonesPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<Emp[]>("/employees/")
      .then(r => setEmps(r.filter(e => e.role !== "superadmin" && e.phone)))
      .catch(e => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sd = digits(q);
    const list = emps.filter(e => !s ||
      e.full_name.toLowerCase().includes(s) ||
      (e.position || "").toLowerCase().includes(s) ||
      (e.department?.name || "").toLowerCase().includes(s) ||
      (sd.length >= 2 && digits(e.phone).includes(sd)));
    const map = new Map<string, Emp[]>();
    for (const e of list) {
      const k = e.department?.name || "Rahbariyat";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()]
      .map(([name, rows]) => ({ name, rows: rows.sort((a, b) => a.full_name.localeCompare(b.full_name)) }))
      .sort((a, b) => (a.name === "Rahbariyat" ? -1 : b.name === "Rahbariyat" ? 1 : a.name.localeCompare(b.name)));
  }, [emps, q]);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  async function copy(e: Emp) {
    try { await navigator.clipboard.writeText(fmtPhone(e.phone)); setCopied(e.id); setTimeout(() => setCopied(null), 1500); } catch { /* ruxsat yo'q */ }
  }

  return (
    <div>
      <Header title="Xodim telefon raqamlari" subtitle="Ism-familiya, lavozim, bo'lim yoki raqam bo'yicha qidiring" />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-[260px] max-w-[560px]" style={{ ...CARD, borderRadius: 14 }}>
          <Search size={17} style={{ color: "#91929E" }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Masalan: Karimov, 90 123, Yuridik bo'lim..."
            className="outline-none text-sm bg-transparent flex-1" />
        </label>
        <span className="px-4 py-3 text-sm font-semibold" style={{ ...CARD, borderRadius: 14, color: "#7D8592" }}>
          <b style={{ color: "#0A1629" }}>{total}</b> ta xodim
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: "#E5484D" }}>{error}</p>
      ) : !total ? (
        <div className="flex flex-col items-center gap-2 py-16" style={CARD}>
          <Inbox size={34} style={{ color: "#D0D9E8" }} />
          <p className="text-sm font-bold" style={{ color: "#91929E" }}>Hech narsa topilmadi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(g => (
            <section key={g.name} style={CARD} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: "1px solid #F1F3F7" }}>
                <Building2 size={16} style={{ color: "#3F8CFF" }} />
                <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{g.name}</p>
                <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "#F4F9FD", color: "#7D8592" }}>{g.rows.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3">
                {g.rows.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid #F7F8FA" }}>
                    <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: COLORS[(e.id + i) % COLORS.length] }}>{initials(e.full_name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>{e.full_name}</p>
                      <p className="text-xs truncate" style={{ color: "#91929E" }}>{e.position}</p>
                      <a href={telHref(e.phone)} className="text-sm font-semibold hover:underline" style={{ color: "#3F8CFF" }}>{fmtPhone(e.phone)}</a>
                    </div>
                    <a href={telHref(e.phone)} title="Qo'ng'iroq qilish" className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl hover:opacity-80"
                      style={{ background: "rgba(0,165,120,0.1)", color: "#00A578" }}><Phone size={16} /></a>
                    <button onClick={() => copy(e)} title="Nusxa olish" className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-[#EEF1F6]"
                      style={{ background: "#F4F9FD", color: copied === e.id ? "#00A578" : "#7D8592" }}>
                      {copied === e.id ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
