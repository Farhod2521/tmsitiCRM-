"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ArrowRight } from "lucide-react";
import LottiePlayer from "@/components/ui/LottiePlayer";
import { loginApi } from "@/lib/api";
import { saveAuth, getRoleRedirect } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+998 ");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    const local = digits.startsWith("998") ? digits.slice(3) : digits;
    let result = "+998 ";
    if (local.length > 0) result += local.slice(0, 2);
    if (local.length > 2) result += " " + local.slice(2, 5);
    if (local.length > 5) result += "-" + local.slice(5, 7);
    if (local.length > 7) result += "-" + local.slice(7, 9);
    return result;
  }

  function handlePhone(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError("");
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 12) {
      setError("Telefon raqamni to'liq kiriting");
      return;
    }
    if (!password) {
      setError("Parolni kiriting");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await loginApi("+" + digits, password);
      saveAuth(data);
      router.push(getRoleRedirect(data.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "#F4F9FD", fontFamily: "'Nunito Sans', sans-serif" }}
    >
      {/* Left — Lottie illustration */}
      <div
        className="hidden lg:flex flex-col items-center justify-center w-1/2 relative overflow-hidden"
        style={{ background: "#3F8CFF" }}
      >
        {/* decorative circles */}
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-10"
          style={{ background: "#FFFFFF" }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full opacity-10"
          style={{ background: "#FFFFFF" }}
        />
        <div
          className="absolute top-1/3 right-10 w-24 h-24 rounded-full opacity-10"
          style={{ background: "#FFFFFF" }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-14 h-14 flex items-center justify-center text-white font-bold text-2xl"
              style={{ background: "rgba(255,255,255,0.2)", borderRadius: 16 }}
            >
              T
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-xl leading-tight">TMSITI</p>
              <p className="text-white text-sm opacity-80">Korporativ boshqaruv tizimi</p>
            </div>
          </div>

          <LottiePlayer
            src="https://lottie.host/7bc1bb1a-fc8b-49df-b970-ddebbc849bc7/LstEDHAq8M.lottie"
            width={400}
            height={400}
          />

          <div>
            <h2 className="text-white font-bold text-3xl mb-3">
              Xush kelibsiz!
            </h2>
            <p className="text-white opacity-80 text-lg max-w-sm">
              TMSITI CRM tizimi orqali tashkilotingizni samarali boshqaring
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-8 mt-4">
            {[
              { value: "248", label: "Xodimlar" },
              { value: "14", label: "Bo'limlar" },
              { value: "87%", label: "KPI" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-white font-bold text-2xl">{s.value}</p>
                <p className="text-white opacity-70 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex flex-col items-center justify-center w-full lg:w-1/2 px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div
            className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl"
            style={{ background: "#3F8CFF", borderRadius: 14 }}
          >
            T
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: "#0A1629" }}>TMSITI CRM</p>
          </div>
        </div>

        <div
          className="w-full max-w-[380px] p-8"
          style={{
            background: "#FFFFFF",
            boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.15)",
            borderRadius: 28,
          }}
        >
          <div className="mb-8">
            <h1
              className="font-bold mb-1"
              style={{ fontSize: 26, color: "#0A1629" }}
            >
              Tizimga kirish
            </h1>
            <p style={{ color: "#91929E", fontSize: 14 }}>
              Faqat ruxsat etilgan foydalanuvchilar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Phone field */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: "#0A1629" }}
              >
                Telefon raqam
              </label>
              <div
                className="flex items-center gap-3 px-4"
                style={{
                  background: "#F4F9FD",
                  borderRadius: 14,
                  border: "2px solid transparent",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "#3F8CFF")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "transparent")
                }
              >
                {/* UZ Flag */}
                <div className="flex-shrink-0 flex flex-col gap-0.5 py-4">
                  <div className="w-6 h-1.5 rounded-sm" style={{ background: "#1EB3F0" }} />
                  <div className="w-6 h-1.5 rounded-sm" style={{ background: "#FFFFFF" }} />
                  <div className="w-6 h-1.5 rounded-sm" style={{ background: "#3AB54A" }} />
                </div>
                <div className="w-px h-6 flex-shrink-0" style={{ background: "#D9E3F0" }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhone}
                  placeholder="+998 99 000-00-00"
                  maxLength={17}
                  className="flex-1 bg-transparent outline-none py-4 text-sm font-bold"
                  style={{ color: "#0A1629" }}
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: "#0A1629" }}
              >
                Parol
              </label>
              <div
                className="flex items-center gap-3 px-4"
                style={{
                  background: "#F4F9FD",
                  borderRadius: 14,
                  border: "2px solid transparent",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "#3F8CFF")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "transparent")
                }
              >
                <Lock size={18} style={{ color: "#91929E", flexShrink: 0 }} />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Parolni kiriting"
                  className="flex-1 bg-transparent outline-none py-4 text-sm font-bold"
                  style={{ color: "#0A1629" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="flex-shrink-0"
                >
                  {showPass ? (
                    <EyeOff size={18} style={{ color: "#91929E" }} />
                  ) : (
                    <Eye size={18} style={{ color: "#91929E" }} />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 text-sm font-bold"
                style={{
                  background: "rgba(255,92,92,0.08)",
                  color: "#FF5C5C",
                  borderRadius: 12,
                  border: "1px solid rgba(255,92,92,0.2)",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-4 font-bold text-white mt-2"
              style={{
                background: loading ? "#91929E" : "#3F8CFF",
                borderRadius: 14,
                boxShadow: loading
                  ? "none"
                  : "0px 6px 12px rgba(63, 140, 255, 0.263686)",
                transition: "all 0.2s",
                fontSize: 16,
              }}
            >
              {loading ? (
                <>
                  <span
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  />
                  Tekshirilmoqda...
                </>
              ) : (
                <>
                  Kirish
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "#91929E" }}>
            Muammo bo'lsa IT bo'limi bilan bog'laning
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs" style={{ color: "#91929E" }}>
          © 2026 TMSITI CRM. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  );
}
