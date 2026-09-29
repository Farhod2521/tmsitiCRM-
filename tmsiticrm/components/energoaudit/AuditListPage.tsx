"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import { Zap, Plus, Search, Loader2, FileText, Download, Trash2, PencilLine, Eye, X, Image as ImageIcon } from "lucide-react";
import { AuditListItem, AuditFull, downloadAuditDocx } from "./api";

/** Energoaudit hisobotlari ro'yxati — bo'limning barcha xodimlari hammasini
 *  (kim to'ldirgani bilan) ko'radi. basePath — "/xodim/energoaudit" yoki "/bolimboshliq/energoaudit". */
export default function AuditListPage({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await apiFetch<AuditListItem[]>("/energoaudit")); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function download(r: AuditListItem) {
    setBusy(r.id);
    try { await downloadAuditDocx(r.id, r.title); }
    catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); }
    finally { setBusy(null); }
  }

  async function remove(r: AuditListItem) {
    if (!confirm(`"${r.title}" hisobotini o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    setBusy(r.id);
    try { await apiFetch(`/energoaudit/${r.id}`, { method: "DELETE" }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); }
    finally { setBusy(null); }
  }

  const q = search.trim().toLowerCase();
  const visible = rows.filter(r => !q || [r.title, r.bino_nomi, r.created_by_name].some(v => (v || "").toLowerCase().includes(q)));

  return (
    <div>
      <Header title="Energiya audit" subtitle="Energoaudit hisobotlari — to'ldiring, hisob-kitob avtomatik, Word'da yuklab oling" />

      <div style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "#FFB020", borderRadius: 12 }}>
              <Zap size={19} color="#FFFFFF" />
            </div>
            <div>
              <h3 className="font-bold" style={{ color: "#0A1629" }}>Hisobotlar</h3>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Jami: {rows.length} ta · Uy-joy binolari shabloni</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ border: "1px solid #D9E3F0", borderRadius: 10, minWidth: 220 }}>
              <Search size={15} style={{ color: "#91929E" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nomi, bino yoki muallif..."
                className="bg-transparent outline-none text-sm flex-1 min-w-0" />
            </div>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: "#3F8CFF", borderRadius: 10, boxShadow: "0 6px 12px rgba(63,140,255,0.26)" }}>
              <Plus size={16} /> Yangi yaratish
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin" style={{ color: "#3F8CFF" }} /></div>
        ) : error ? (
          <p className="text-center text-sm py-16" style={{ color: "#FF5C5C" }}>{error}</p>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={34} className="mx-auto" style={{ color: "#D9E3F0" }} />
            <p className="mt-3 font-bold" style={{ color: "#0A1629" }}>{rows.length ? "Hech narsa topilmadi" : "Hali hisobot yo'q"}</p>
            {!rows.length && <p className="text-sm mt-1" style={{ color: "#91929E" }}>&quot;Yangi yaratish&quot; tugmasini bosing</p>}
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F4F9FD" }}>
                  {["№", "Hisobot nomi", "Bino", "Muallif", "Oxirgi o'zgarish", "Suratlar", ""].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2.5 text-xs font-bold whitespace-nowrap" style={{ color: "#3D4557" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[#FAFCFF] cursor-pointer" style={{ borderBottom: "1px solid #F4F9FD" }}
                    onClick={() => router.push(`${basePath}/${r.id}`)}>
                    <td className="px-3 py-3 text-xs" style={{ color: "#91929E" }}>{i + 1}</td>
                    <td className="px-3 py-3 font-semibold" style={{ color: "#0A1629", minWidth: 180 }}>{r.title}</td>
                    <td className="px-3 py-3 text-xs" style={{ color: "#3D4557", maxWidth: 320 }}>
                      <span className="line-clamp-2">{r.bino_nomi || "—"}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#3D4557" }}>{r.created_by_name || "—"}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "#7D8592" }}>
                      {r.updated_at ? fmtDateTimeUz(r.updated_at, true) : "—"}
                      {r.updated_by_name && <span className="block" style={{ color: "#91929E" }}>{r.updated_by_name}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "#7D8592" }}>
                      <span className="inline-flex items-center gap-1"><ImageIcon size={13} /> {r.photos}</span>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => router.push(`${basePath}/${r.id}`)} title={r.can_edit ? "Tahrirlash" : "Ko'rish"}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#EEF4FF]">
                          {r.can_edit ? <PencilLine size={15} style={{ color: "#3F8CFF" }} /> : <Eye size={15} style={{ color: "#3F8CFF" }} />}
                        </button>
                        <button onClick={() => download(r)} disabled={busy === r.id} title="Word (docx) yuklab olish"
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E7F8EE] disabled:opacity-50">
                          {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} style={{ color: "#00A578" }} />}
                        </button>
                        {r.can_edit && (
                          <button onClick={() => remove(r)} disabled={busy === r.id} title="O'chirish"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FDECEC] disabled:opacity-50">
                            <Trash2 size={15} style={{ color: "#FF5C5C" }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={id => router.push(`${basePath}/${id}`)} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [bino, setBino] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) { setError("Hisobot nomini kiriting"); return; }
    setSaving(true); setError(null);
    try {
      const a = await apiFetch<AuditFull>("/energoaudit", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), data: bino.trim() ? { bino_nomi: bino.trim(), sarlavha: title.trim() } : { sarlavha: title.trim() } }),
      });
      onCreated(a.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik"); setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(10,22,41,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(10,22,41,0.25)" }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <p className="font-bold" style={{ color: "#0A1629" }}>Yangi energoaudit hisoboti</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center" style={{ background: "#F4F9FD", borderRadius: 8 }}>
            <X size={15} style={{ color: "#7D8592" }} />
          </button>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-bold mb-1.5" style={{ color: "#7D8592" }}>Hisobot nomi (obyekt)</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Масалан: Миробод тумани, 12-уй"
            className="w-full px-4 py-3 text-sm outline-none" style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0" }} />
          <label className="block text-xs font-bold mt-3 mb-1.5" style={{ color: "#7D8592" }}>Bino (hisobot matni uchun)</label>
          <textarea value={bino} onChange={e => setBino(e.target.value)} rows={2}
            placeholder="Масалан: Тошкент ш., Миробод т., ... 12-уйда жойлашган кўп қаватли турар-жой биносида"
            className="w-full px-4 py-3 text-sm outline-none resize-none" style={{ background: "#F4F9FD", borderRadius: 12, border: "1px solid #D9E3F0" }} />
          <p className="text-[11px] mt-2" style={{ color: "#91929E" }}>Qolgan ma&apos;lumotlar keyingi oynada to&apos;ldiriladi — shablondagi namunaviy qiymatlar bilan boshlanadi.</p>
          {error && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold" style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>Bekor qilish</button>
          <button onClick={create} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#3F8CFF", borderRadius: 12 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Yaratish
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
