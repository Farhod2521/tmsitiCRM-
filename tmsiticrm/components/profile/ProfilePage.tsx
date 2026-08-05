"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  Phone, Mail, Building2, Calendar, Edit3,
  X, Save, Briefcase, Award, Star, Camera, Send, ShieldCheck, KeyRound,
  Loader2, Clock, CheckCircle2, RefreshCw,
} from "lucide-react";
import { getUser, saveAuth, getProfileExtra, saveProfileExtra } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { openTelegramLink } from "@/lib/telegram";
import MyIjroTasksCard from "@/components/profile/MyIjroTasksCard";
import WeeklyReportCard from "@/components/reports/WeeklyReportCard";

interface Department {
  id: number;
  name: string;
  dept_type: string;
}

interface Employee {
  id: number;
  full_name: string;
  position: string;
  phone: string;
  role: string;
  work_rate: number;
  department: Department | null;
  is_active: boolean;
  telegram_id?: number | null;
  telegram_username?: string | null;
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "superadmin":           return "Administrator";
    case "direktor":             return "Direktor";
    case "zamdirektor":          return "Direktor o'rinbosari";
    case "bolim_boshligi":       return "Bo'lim boshlig'i";
    case "boshqarma_boshligi":   return "Boshqarma boshlig'i";
    case "xodim":                return "Xodim";
    default:                     return role;
  }
}

const AVATAR_COLORS = [
  "#3F8CFF", "#6D5DD3", "#00C48C", "#FFBD21", "#FF5C5C", "#15C0E6",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function ProfilePage() {
  const [emp, setEmp]       = useState<Employee | null>(null);
  const [extra, setExtra]   = useState({ email: "", ish_staji: "" });
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm]     = useState({ full_name: "", phone: "", email: "", ish_staji: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Parolni Telegram orqali (kod bilan) yangilash
  const [showPwReset, setShowPwReset] = useState(false);
  const [pwStep, setPwStep] = useState<"sending" | "code" | "password" | "success">("sending");
  const [pwCode, setPwCode] = useState("");
  const [pwNewPassword, setPwNewPassword] = useState("");
  const [pwNewPassword2, setPwNewPassword2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSecondsLeft, setPwSecondsLeft] = useState(180);

  // Profil rasmi
  const [photo, setPhoto]         = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useState(() => typeof document !== "undefined" ? document.createElement("input") : null)[0];

  // Rasm yuklash
  function compressAndUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const MAX = 640;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.75);
        setPhotoUploading(true);
        try {
          await apiFetch("/employees/me/photo", {
            method: "PATCH",
            body: JSON.stringify({ photo_base64: base64 }),
          });
          setPhoto(base64);
        } catch {
          // silent — show old photo
        } finally {
          setPhotoUploading(false);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function openPhotoPicker() {
    if (!photoInputRef) return;
    photoInputRef.type    = "file";
    photoInputRef.accept  = "image/*";
    (photoInputRef as any).capture = "user";
    photoInputRef.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) compressAndUpload(file);
    };
    photoInputRef.click();
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Employee>("/auth/me");
        setEmp(data);
      } catch {
        const u = getUser();
        if (u) {
          setEmp({
            id: u.id, full_name: u.full_name, position: "",
            phone: u.phone, role: u.role, work_rate: 1.0,
            department: null, is_active: true,
          });
        }
      }
      const ex = getProfileExtra();
      setExtra({ email: ex.email || "", ish_staji: ex.ish_staji?.toString() || "" });
      // Saqlangan profil rasmini yuklash
      try {
        const p = await apiFetch<{ photo_base64: string | null }>("/employees/me/photo");
        if (p.photo_base64) setPhoto(p.photo_base64);
      } catch { /* rasm yo'q — muammo emas */ }
      setLoading(false);
    })();
  }, []);

  function openEdit() {
    if (!emp) return;
    setForm({ full_name: emp.full_name, phone: emp.phone, email: extra.email, ish_staji: extra.ish_staji });
    setSaveError("");
    setShowEdit(true);
  }

  async function handleSave() {
    if (!emp) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await apiFetch<Employee>(`/employees/${emp.id}`, {
        method: "PUT",
        body: JSON.stringify({ full_name: form.full_name, phone: form.phone }),
      });
      setEmp(updated);

      const newExtra = {
        email: form.email || undefined,
        ish_staji: form.ish_staji ? parseInt(form.ish_staji) : undefined,
      };
      saveProfileExtra(newExtra);
      setExtra({ email: form.email, ish_staji: form.ish_staji });

      const u = getUser();
      if (u) saveAuth({ ...u, full_name: updated.full_name, phone: updated.phone });

      setShowEdit(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Saqlashda xato yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  // Countdown — kod amal qilish muddati
  useEffect(() => {
    if (!showPwReset || pwStep !== "code" || pwSecondsLeft <= 0) return;
    const t = setInterval(() => setPwSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [showPwReset, pwStep, pwSecondsLeft]);

  async function openPasswordReset() {
    setShowPwReset(true);
    setPwStep("sending");
    setPwError(null);
    setPwCode("");
    setPwNewPassword("");
    setPwNewPassword2("");
    try {
      const res = await apiFetch<{ sent: boolean; expires_in_seconds: number }>(
        "/employees/me/password-reset/request", { method: "POST" }
      );
      setPwSecondsLeft(res.expires_in_seconds);
      setPwStep("code");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Kod yuborilmadi");
    }
  }

  async function handleVerifyCode() {
    if (pwCode.length !== 5) return;
    setPwSubmitting(true);
    setPwError(null);
    try {
      await apiFetch("/employees/me/password-reset/verify", {
        method: "POST",
        body: JSON.stringify({ code: pwCode }),
      });
      setPwStep("password");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Kod noto'g'ri");
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleConfirmNewPassword() {
    setPwError(null);
    if (pwNewPassword.length < 6) { setPwError("Parol kamida 6 belgidan iborat bo'lishi kerak"); return; }
    if (pwNewPassword !== pwNewPassword2) { setPwError("Parollar mos kelmadi"); return; }
    setPwSubmitting(true);
    try {
      await apiFetch("/employees/me/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ code: pwCode, new_password: pwNewPassword }),
      });
      setPwStep("success");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setPwSubmitting(false);
    }
  }

  if (loading || !emp) {
    return (
      <div>
        <Header title="Mening profilim" subtitle="Shaxsiy ma'lumotlar" />
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 rounded-full animate-spin"
            style={{ borderColor: "#3F8CFF", borderTopColor: "transparent" }} />
        </div>
      </div>
    );
  }

  const initials  = getInitials(emp.full_name);
  const aColor    = avatarColor(emp.id);
  const deptName  = emp.department?.name || "—";
  const stajiVal  = extra.ish_staji ? `${extra.ish_staji} yil` : "—";
  const position  = emp.position || getRoleLabel(emp.role);
  const empCode   = `EMP-${String(emp.id).padStart(4, "0")}`;

  return (
    <div className="relative">
      <Header title="Mening profilim" subtitle="Shaxsiy ma'lumotlar" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Profile card ── */}
        <div className="p-6 flex flex-col items-center text-center"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>

          {/* Avatar — bosilganda rasm yuklash */}
          <div className="relative mb-4 cursor-pointer group" onClick={openPhotoPicker}>
            {photo ? (
              <img
                src={photo}
                alt="Profil"
                className="w-24 h-24 object-cover"
                style={{ borderRadius: 28, border: `3px solid ${aColor}` }}
              />
            ) : (
              <div
                className="w-24 h-24 flex items-center justify-center text-white font-bold text-3xl"
                style={{ background: aColor, borderRadius: 28 }}
              >
                {initials}
              </div>
            )}
            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.45)", borderRadius: 28 }}
            >
              {photoUploading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={22} style={{ color: "#fff" }} />}
              <span className="text-[10px] text-white font-bold mt-1">Rasm o'zgartir</span>
            </div>
          </div>
          {!photo && (
            <button
              onClick={openPhotoPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold mb-2 -mt-1"
              style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10, color: "#3F8CFF" }}
            >
              <Camera size={12} />
              Rasm qo'shish
            </button>
          )}

          <h2 className="font-bold text-xl" style={{ color: "#0A1629" }}>{emp.full_name}</h2>
          <p className="text-sm mt-1 mb-3" style={{ color: "#91929E" }}>{position}</p>
          <Badge label={emp.is_active ? "Faol" : "Nofaol"} variant={emp.is_active ? "success" : "danger"} />

          {/* Info list */}
          <div className="w-full mt-6 flex flex-col gap-3">
            {[
              { icon: Building2, label: deptName },
              { icon: Phone,     label: emp.phone },
              ...(extra.email      ? [{ icon: Mail,     label: extra.email }] : []),
              ...(extra.ish_staji ? [{ icon: Calendar,  label: `Ish staji: ${extra.ish_staji} yil` }] : []),
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10 }}>
                  <item.icon size={16} style={{ color: "#3F8CFF" }} />
                </div>
                <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* Edit button */}
          <button onClick={openEdit}
            className="w-full mt-6 py-3 flex items-center justify-center gap-2 font-bold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
            <Edit3 size={16} />
            Profilni tahrirlash
          </button>
        </div>

        {/* ── Right ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Ish stavkasi", value: `${emp.work_rate}`,   icon: Briefcase, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
              { label: "Ish staji",    value: stajiVal,              icon: Calendar,  color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
              { label: "Xodim kodi",   value: empCode,               icon: Award,     color: "#00C48C", bg: "rgba(0,196,140,0.1)"  },
            ].map((s) => (
              <div key={s.label} className="p-5"
                style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 20 }}>
                <div className="w-10 h-10 flex items-center justify-center mb-3"
                  style={{ background: s.bg, borderRadius: 12 }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <p className="text-xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: "#91929E" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Telefon raqam va parol — Telegram orqali tasdiqlash/tiklash */}
          <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(34,158,217,0.1)", borderRadius: 14 }}>
                  <KeyRound size={20} style={{ color: "#229ED9" }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Telefon raqam va parol</h3>
                  {emp.telegram_id ? (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#00C48C" }}>
                      <ShieldCheck size={12} />
                      Telegram orqali bog'langan{emp.telegram_username ? ` (@${emp.telegram_username})` : ""}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>Hali Telegram bilan bog'lanmagan</p>
                  )}
                </div>
              </div>

              {emp.telegram_id ? (
                <button onClick={openPasswordReset}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white flex-shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: "#229ED9", borderRadius: 12 }}>
                  <KeyRound size={15} />
                  Parolni o'zgartirish
                </button>
              ) : (
                <button onClick={() => openTelegramLink()}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white flex-shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: "#229ED9", borderRadius: 12 }}>
                  <Send size={15} />
                  Telefon va parolni tasdiqlash
                </button>
              )}
            </div>
          </div>

          {/* Additional info */}
          <div className="p-6"
            style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: "#0A1629" }}>Qo'shimcha ma'lumotlar</h3>
              <button onClick={openEdit}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                style={{ background: "rgba(63,140,255,0.1)", borderRadius: 10, color: "#3F8CFF" }}>
                <Edit3 size={13} /> Tahrirlash
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Xodim ID",     value: empCode },
                { label: "Lavozim",      value: emp.position || "—" },
                { label: "Bo'lim",       value: deptName },
                { label: "Rol",          value: getRoleLabel(emp.role) },
                { label: "Ish staji",    value: stajiVal },
                { label: "Ish stavkasi", value: `${emp.work_rate} stavka` },
                { label: "Telefon",      value: emp.phone },
                { label: "Email",        value: extra.email || "—" },
                { label: "Ish jadvali",  value: "Dushanba – Juma" },
                { label: "Ish vaqti",    value: "09:00 – 18:00" },
              ].map((item) => (
                <div key={item.label} className="p-3" style={{ background: "#F4F9FD", borderRadius: 14 }}>
                  <p className="text-xs" style={{ color: "#91929E" }}>{item.label}</p>
                  <p className="font-bold text-sm mt-0.5 truncate" style={{ color: "#0A1629" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ijro nazorati (menga biriktirilgan topshiriqlar) ── */}
      <div className="mt-5">
        <MyIjroTasksCard />
      </div>

      {/* ── Haftalik hisobotlar ── */}
      <div className="mt-5">
        <WeeklyReportCard />
      </div>

      {/* ── Edit Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(10,22,41,0.45)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-[460px] p-8 relative"
            style={{ background: "#FFFFFF", borderRadius: 28, boxShadow: "0px 30px 80px rgba(0,0,0,0.18)" }}>

            <button onClick={() => setShowEdit(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <X size={15} style={{ color: "#91929E" }} />
            </button>

            {/* Modal header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center"
                style={{ background: "rgba(63,140,255,0.1)", borderRadius: 14 }}>
                <Edit3 size={22} style={{ color: "#3F8CFF" }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>Profilni tahrirlash</h3>
                <p className="text-xs" style={{ color: "#91929E" }}>Ma'lumotlarni yangilang</p>
              </div>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-4">
              {[
                { label: "Ism familiya",       key: "full_name",  placeholder: "Familiya Ism",         type: "text"   },
                { label: "Telefon raqam",       key: "phone",      placeholder: "+998 90 000-00-00",    type: "tel"    },
                { label: "Email (ixtiyoriy)",   key: "email",      placeholder: "example@tmsiti.uz",    type: "email"  },
                { label: "Ish staji (yil)",     key: "ish_staji",  placeholder: "3",                    type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: "#0A1629" }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    min={f.type === "number" ? 0 : undefined}
                    max={f.type === "number" ? 60 : undefined}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 text-sm font-bold outline-none"
                    style={{ background: "#F4F9FD", borderRadius: 14, color: "#0A1629" }}
                  />
                </div>
              ))}
            </div>

            {saveError && (
              <div className="mt-3 px-4 py-3 text-sm font-bold"
                style={{ background: "rgba(255,92,92,0.08)", color: "#FF5C5C", borderRadius: 12 }}>
                {saveError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-3 font-bold text-sm"
                style={{ background: "#F4F9FD", borderRadius: 14, color: "#7D8592" }}>
                Bekor qilish
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
                {saving
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Save size={15} />}
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Parolni Telegram orqali yangilash modali ── */}
      {showPwReset && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(10,22,41,0.45)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowPwReset(false)}>
          <div className="w-full max-w-[440px] p-7 relative"
            style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 30px 80px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>

            <button onClick={() => setShowPwReset(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
              style={{ background: "#F4F9FD", borderRadius: 10 }}>
              <X size={15} style={{ color: "#91929E" }} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center"
                style={{ background: "rgba(34,158,217,0.1)", borderRadius: 14 }}>
                <KeyRound size={20} style={{ color: "#229ED9" }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: "#0A1629" }}>Parolni o'zgartirish</h3>
                <p className="text-xs" style={{ color: "#91929E" }}>Telegram orqali tasdiqlash</p>
              </div>
            </div>

            {pwStep === "sending" && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                {pwError ? (
                  <>
                    <p className="text-sm font-bold" style={{ color: "#FF5C5C" }}>{pwError}</p>
                    <button onClick={openPasswordReset}
                      className="mt-4 flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white"
                      style={{ background: "#229ED9", borderRadius: 12 }}>
                      <RefreshCw size={14} /> Qayta urinish
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 size={26} className="animate-spin mb-3" style={{ color: "#229ED9" }} />
                    <p className="text-sm" style={{ color: "#91929E" }}>Telegramga kod yuborilmoqda...</p>
                  </>
                )}
              </div>
            )}

            {pwStep === "code" && (
              <>
                <p className="text-sm" style={{ color: "#7D8592" }}>
                  Telegramingizga 5 xonali kod yuborildi. Kodni quyida kiriting.
                </p>
                <input
                  value={pwCode}
                  onChange={e => setPwCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="•••••"
                  inputMode="numeric"
                  maxLength={5}
                  className="w-full mt-4 px-4 py-3.5 text-center text-2xl font-bold tracking-[0.5em] outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 14, border: "1.5px solid #EEF2FF", color: "#0A1629" }}
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: pwSecondsLeft <= 30 ? "#FF5C5C" : "#91929E" }}>
                    <Clock size={12} />
                    {pwSecondsLeft > 0
                      ? `${Math.floor(pwSecondsLeft / 60)}:${String(pwSecondsLeft % 60).padStart(2, "0")} qoldi`
                      : "Muddati tugadi"}
                  </span>
                  {pwSecondsLeft <= 0 && (
                    <button onClick={openPasswordReset} className="text-xs font-bold" style={{ color: "#229ED9" }}>
                      Kodni qayta yuborish
                    </button>
                  )}
                </div>
                {pwError && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{pwError}</p>}
                <button onClick={handleVerifyCode} disabled={pwCode.length !== 5 || pwSubmitting || pwSecondsLeft <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 mt-5 font-bold text-sm text-white disabled:opacity-50"
                  style={{ background: "#229ED9", borderRadius: 14 }}>
                  {pwSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  Tasdiqlash
                </button>
              </>
            )}

            {pwStep === "password" && (
              <>
                <p className="text-sm mb-4" style={{ color: "#7D8592" }}>
                  Kod tasdiqlandi. Endi yangi parolingizni kiriting.
                </p>
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "#91929E" }}>Yangi parol</label>
                <input type="password" value={pwNewPassword} onChange={e => setPwNewPassword(e.target.value)}
                  placeholder="Kamida 6 belgi"
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                <label className="text-xs font-bold mb-1.5 mt-3 block" style={{ color: "#91929E" }}>Yangi parolni takrorlang</label>
                <input type="password" value={pwNewPassword2} onChange={e => setPwNewPassword2(e.target.value)}
                  placeholder="Parolni qayta yozing"
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
                {pwError && <p className="text-xs font-bold mt-2" style={{ color: "#FF5C5C" }}>{pwError}</p>}
                <button onClick={handleConfirmNewPassword} disabled={pwSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 mt-5 font-bold text-sm text-white disabled:opacity-50"
                  style={{ background: "#229ED9", borderRadius: 14 }}>
                  {pwSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Saqlash
                </button>
              </>
            )}

            {pwStep === "success" && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 flex items-center justify-center mb-3" style={{ background: "rgba(0,196,140,0.1)", borderRadius: 18 }}>
                  <CheckCircle2 size={26} style={{ color: "#00C48C" }} />
                </div>
                <p className="font-bold text-base" style={{ color: "#0A1629" }}>Parol yangilandi</p>
                <p className="text-sm mt-1" style={{ color: "#91929E" }}>Yangi login ma'lumotlaringiz Telegramga yuborildi</p>
                <button onClick={() => setShowPwReset(false)}
                  className="mt-5 px-6 py-2.5 font-bold text-sm" style={{ background: "#F4F9FD", borderRadius: 12, color: "#7D8592" }}>
                  Yopish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
