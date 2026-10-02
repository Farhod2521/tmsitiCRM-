"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { apiFetch } from "@/lib/api";
import { fmtDateTimeUz } from "@/lib/datetime";
import {
  Send, Paperclip, X, Loader2, Film, Image as ImageIcon, FileText, Users, CheckCircle2, AlertTriangle, History, ChevronDown, ChevronUp,
} from "lucide-react";

interface Broadcast {
  id: number;
  text_html: string | null;
  file_name: string | null;
  file_kind: string | null;
  status: "sending" | "done";
  total: number;
  sent: number;
  failed: number;
  failed_list: { name: string; reason: string }[];
  error: string | null;
  created_by_name: string | null;
  created_at: string;
  finished_at: string | null;
}

const MAX_MB = 50;
const KIND_ICON: Record<string, typeof Film> = { video: Film, animation: Film, photo: ImageIcon, document: FileText };

/** Telegram tushunmaydigan teglarni olib tashlab, oldindan ko'rish uchun soddalashtirilgan HTML. */
function previewHtml(src: string) {
  return src
    .replace(/<\/?(h[1-6])[^>]*>/g, m => (m.startsWith("</") ? "</b><br/>" : "<b>"))
    .replace(/<p[^>]*>/g, "").replace(/<\/p>/g, "<br/><br/>")
    .replace(/<li[^>]*>/g, "• ").replace(/<\/li>/g, "<br/>")
    .replace(/<\/?(ul|ol|figure|table|tbody|tr|td|th|span|div)[^>]*>/g, "")
    .replace(/(<br\/>\s*){3,}/g, "<br/><br/>")
    .replace(/(<br\/>\s*)+$/, "");
}

function plainLen(html: string) {
  if (typeof document === "undefined") return 0;
  const d = document.createElement("div"); d.innerHTML = html;
  return (d.textContent || "").trim().length;
}

export default function TelegramBroadcastPage() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [recip, setRecip] = useState<{ linked: number; total: number } | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try { setHistory(await apiFetch<Broadcast[]>("/telegram-broadcast")); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    apiFetch<{ linked: number; total: number }>("/telegram-broadcast/recipients").then(setRecip).catch(() => {});
    loadHistory();
  }, [loadHistory]);

  // Yuborilayotgan xabar bo'lsa — jarayonni kuzatib turamiz
  const active = history.some(h => h.status === "sending");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(loadHistory, 2000);
    return () => clearInterval(t);
  }, [active, loadHistory]);

  function pickFile(f: File | null) {
    setError(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (f && f.size > MAX_MB * 1024 * 1024) { setError(`Fayl ${MAX_MB} MB dan oshmasligi kerak`); return; }
    setFile(f);
    setFileUrl(f && (f.type.startsWith("video/") || f.type.startsWith("image/")) ? URL.createObjectURL(f) : null);
  }

  const len = plainLen(text);
  const captionTooLong = !!file && len > 1024;
  const canSend = (len > 0 || !!file) && !sending && !active;

  async function send() {
    if (!canSend) return;
    if (!confirm(`Xabar Telegram'i bog'langan ${recip?.linked ?? "barcha"} ta xodimga yuboriladi. Davom etasizmi?`)) return;
    setSending(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("text_html", text);
      if (file) fd.append("file", file);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("crm_token");
      const res = await fetch(`${API_URL}/telegram-broadcast`, { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Yuborib bo'lmadi");
      setText(""); pickFile(null);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally { setSending(false); }
  }

  const card = { background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 } as const;
  const FileIcon = file ? (file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".gif") ? Film : file.type.startsWith("image/") ? ImageIcon : FileText) : Paperclip;

  return (
    <div>
      <Header title="Telegram xabar" subtitle="Bot orqali barcha xodimlarning shaxsiy Telegram'iga xabar yuborish" />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* Yozish */}
        <div className="p-6" style={card}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "#229ED9", borderRadius: 12 }}>
                <Send size={18} color="#FFFFFF" />
              </div>
              <div>
                <p className="font-bold" style={{ color: "#0A1629" }}>Yangi xabar</p>
                <p className="text-xs" style={{ color: "#91929E" }}>Video, rasm yoki hujjat + matn — yoki faqat matn</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{ background: "rgba(34,158,217,0.1)", color: "#1C83B6", borderRadius: 10 }}>
              <Users size={14} /> Qabul qiluvchilar: {recip ? `${recip.linked} / ${recip.total}` : "…"}
            </span>
          </div>

          {/* Fayl */}
          <input ref={inputRef} type="file" className="hidden"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            onChange={e => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          {file ? (
            <div className="flex items-center gap-3 p-3 mb-4" style={{ background: "#F4F9FD", borderRadius: 14, border: "1px solid #E4EAF2" }}>
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,140,255,0.12)", borderRadius: 10 }}>
                <FileIcon size={18} style={{ color: "#3F8CFF" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{file.name}</p>
                <p className="text-xs" style={{ color: "#91929E" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button onClick={() => pickFile(null)} className="w-8 h-8 flex items-center justify-center" style={{ background: "#FFFFFF", borderRadius: 8 }} title="Olib tashlash">
                <X size={15} style={{ color: "#7D8592" }} />
              </button>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-5 mb-4 text-sm font-bold hover:bg-[#EEF5FF] transition-colors"
              style={{ border: "1.5px dashed #C9D6E8", borderRadius: 14, color: "#3F8CFF", background: "#FAFCFF" }}>
              <Paperclip size={17} /> Video, rasm yoki fayl biriktirish (ixtiyoriy, {MAX_MB} MB gacha)
            </button>
          )}

          {/* Matn */}
          <RichTextEditor value={text} onChange={setText} placeholder="Xabar matnini yozing..." />
          <div className="flex items-center justify-between mt-2 text-xs">
            <span style={{ color: captionTooLong ? "#E07A1F" : "#91929E" }}>
              {captionTooLong
                ? "Matn 1024 belgidan uzun — fayl va matn alohida xabar bo'lib boradi"
                : file ? "Matn fayl ostida (izoh) bo'lib boradi" : "Telegram: qalin, kursiv, havola, ro'yxatlar saqlanadi"}
            </span>
            <span style={{ color: "#91929E" }}>{len} belgi</span>
          </div>

          {error && <p className="text-sm font-bold mt-3" style={{ color: "#FF5C5C" }}>{error}</p>}
          {active && <p className="text-sm font-bold mt-3" style={{ color: "#E07A1F" }}>Oldingi xabar hali yuborilmoqda — tugashini kuting.</p>}

          <div className="flex justify-end mt-4">
            <button onClick={send} disabled={!canSend}
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#229ED9", borderRadius: 12, boxShadow: "0 6px 14px rgba(34,158,217,0.3)" }}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Hammaga yuborish
            </button>
          </div>
        </div>

        {/* Ko'rinish + tarix */}
        <div className="flex flex-col gap-5">
          <div className="p-5" style={card}>
            <p className="font-bold text-sm mb-3" style={{ color: "#0A1629" }}>Telegram&apos;da ko&apos;rinishi</p>
            <div className="p-4" style={{ background: "linear-gradient(160deg,#CFE6B6,#E8E3A3)", borderRadius: 16 }}>
              {(file || len > 0) ? (
                <div className="max-w-[300px] overflow-hidden" style={{ background: "#FFFFFF", borderRadius: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>
                  {fileUrl && file?.type.startsWith("video/") && <video src={fileUrl} className="w-full max-h-72 object-cover" autoPlay muted loop playsInline />}
                  {fileUrl && file?.type.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl} alt="" className="w-full max-h-72 object-cover" />
                  )}
                  {file && !fileUrl && (
                    <div className="flex items-center gap-2 px-3 pt-3"><FileText size={28} style={{ color: "#229ED9" }} /><span className="text-xs font-bold truncate">{file.name}</span></div>
                  )}
                  {len > 0 && (
                    <div className="px-3 py-2 text-[13px] leading-snug [&_a]:text-[#229ED9] [&_a]:underline" style={{ color: "#0A1629" }}
                      dangerouslySetInnerHTML={{ __html: previewHtml(text) }} />
                  )}
                  <p className="text-[10px] text-right px-3 pb-1.5" style={{ color: "#A0A8B4" }}>TMSITI CRM BOT</p>
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: "#5B6B3A" }}>Xabar shu yerda ko&apos;rinadi</p>
              )}
            </div>
          </div>

          <div className="p-5" style={card}>
            <p className="flex items-center gap-2 font-bold text-sm mb-3" style={{ color: "#0A1629" }}><History size={16} style={{ color: "#3F8CFF" }} /> Yuborilganlar</p>
            {history.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "#91929E" }}>Hali xabar yuborilmagan</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {history.map(h => {
                  const KIcon = h.file_kind ? KIND_ICON[h.file_kind] ?? FileText : FileText;
                  const pct = h.total ? Math.round(((h.sent + h.failed) / h.total) * 100) : 0;
                  const snippet = (h.text_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                  const open = openId === h.id;
                  return (
                    <li key={h.id} className="p-3" style={{ background: "#FAFCFF", borderRadius: 14, border: "1px solid #F0F3F8" }}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,158,217,0.1)", borderRadius: 8 }}>
                          <KIcon size={15} style={{ color: "#229ED9" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate" style={{ color: "#0A1629" }}>{snippet || h.file_name || "—"}</p>
                          <p className="text-[11px]" style={{ color: "#91929E" }}>{fmtDateTimeUz(h.created_at, true)} · {h.created_by_name ?? "—"}</p>
                        </div>
                      </div>
                      {h.status === "sending" ? (
                        <div className="mt-2">
                          <div className="h-1.5 overflow-hidden" style={{ background: "#E4EAF2", borderRadius: 4 }}>
                            <div className="h-full" style={{ width: `${pct}%`, background: "#229ED9", transition: "width .4s" }} />
                          </div>
                          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "#1C83B6" }}><Loader2 size={11} className="animate-spin" /> Yuborilmoqda: {h.sent + h.failed} / {h.total || "…"}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mt-2 text-[11px] font-bold">
                          <span className="flex items-center gap-1" style={{ color: "#16A34A" }}><CheckCircle2 size={12} /> {h.sent} ta yetdi</span>
                          {h.failed > 0 && (
                            <button onClick={() => setOpenId(open ? null : h.id)} className="flex items-center gap-1" style={{ color: "#E07A1F" }}>
                              <AlertTriangle size={12} /> {h.failed} ta yetmadi {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                      )}
                      {h.error && <p className="text-[11px] mt-1" style={{ color: "#EF4444" }}>{h.error}</p>}
                      {open && (
                        <ul className="mt-2 text-[11px] flex flex-col gap-1" style={{ color: "#7D8592" }}>
                          {h.failed_list.map((f, i) => (
                            <li key={i}><b style={{ color: "#3D4557" }}>{f.name}</b> — {/blocked/i.test(f.reason) ? "botni bloklagan" : /chat not found/i.test(f.reason) ? "botga /start bosmagan" : f.reason}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
