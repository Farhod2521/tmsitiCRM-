"use client";

import { Bell, ChevronDown, Search, LogOut, User, Phone, ChevronRight, CheckCheck, MessageSquareWarning, FileText, ClipboardCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth";
import { useNotifications, type NotificationItem } from "@/lib/notifications";
import type { LoginResponse } from "@/lib/api";

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
    case "kadr":                 return "Kadrlar bo'limi";
    case "ijro":                 return "Ijro nazorati";
    case "xodim":                return "Xodim";
    default:                     return role;
  }
}

function profileHref(role: string): string {
  if (["superadmin", "direktor", "zamdirektor"].includes(role)) return "/superadmin/profile";
  if (["bolim_boshligi", "boshqarma_boshligi"].includes(role)) return "/bolimboshliq/profile";
  if (role === "ijro") return "/ijro/profile";
  return "/xodim/profile";
}

const SECTION_ICON: Record<NotificationItem["section"], { icon: typeof Bell; color: string; bg: string }> = {
  izohlar:   { icon: MessageSquareWarning, color: "#FF8C42", bg: "rgba(255,140,66,0.12)" },
  hujjatlar: { icon: FileText,             color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" },
  ijro:      { icon: ClipboardCheck,       color: "#3F8CFF", bg: "rgba(63,140,255,0.12)" },
};

// Tashqariga bosilganda yopiladigan ochiluvchi oyna uchun
function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) close(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

const CARD = { background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 };
const POPUP = { background: "#FFFFFF", borderRadius: 16, boxShadow: "0 16px 40px rgba(10,22,41,0.16)", border: "1px solid #F4F9FD" };

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const notif = useNotifications();

  const bellRef = useOutsideClose(bellOpen, () => setBellOpen(false));
  const accRef  = useOutsideClose(accOpen, () => setAccOpen(false));

  useEffect(() => {
    setUser(getUser());
  }, []);

  const initials    = user ? getInitials(user.full_name) : "SA";
  const displayName = user?.full_name  || "Super Admin";
  const displayRole = user ? getRoleLabel(user.role) : "Administrator";

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between flex-wrap gap-4 mb-6 lg:mb-8">
      <div className="min-w-0">
        <h1 className="font-bold text-xl sm:text-2xl lg:text-[28px] truncate" style={{ color: "#0A1629", lineHeight: "1.3" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm truncate" style={{ color: "#91929E", marginTop: 2 }}>{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Search — faqat md+ ekranlarda */}
        <div className="hidden md:flex items-center gap-2 px-4 py-3" style={{ ...CARD, minWidth: 200 }}>
          <Search size={18} style={{ color: "#91929E" }} />
          <input type="text" placeholder="Qidirish..."
            className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "#0A1629" }} />
        </div>

        {/* Search icon — faqat mobil/tablet */}
        <div className="md:hidden relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={CARD}>
          <Search size={18} style={{ color: "#0A1629" }} />
        </div>

        {/* Bildirishnomalar */}
        <div ref={bellRef} className="relative flex-shrink-0">
          <button onClick={() => { setBellOpen(v => !v); setAccOpen(false); }}
            aria-label={`Bildirishnomalar${notif.total ? ` (${notif.total})` : ""}`}
            className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center hover:opacity-80 transition-opacity"
            style={CARD}>
            <Bell size={20} style={{ color: "#0A1629" }} />
            {notif.total > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: "#FF5C5C", borderRadius: 10, border: "2px solid #F4F9FD" }}>
                {notif.total > 99 ? "99+" : notif.total}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[calc(100vw-32px)] max-w-[340px]" style={POPUP}>
              <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #F4F9FD" }}>
                <p className="font-bold text-sm" style={{ color: "#0A1629" }}>Bildirishnomalar</p>
                {notif.total > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5" style={{ color: "#FF5C5C", background: "rgba(255,92,92,0.1)", borderRadius: 8 }}>
                    {notif.total} ta
                  </span>
                )}
              </div>
              {notif.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <CheckCheck size={26} style={{ color: "#00C48C" }} />
                  <p className="text-xs" style={{ color: "#91929E" }}>Hozircha sizni kutayotgan ish yo&apos;q</p>
                </div>
              ) : (
                <ul className="p-2 max-h-[360px] overflow-y-auto">
                  {notif.items.map(item => {
                    const cfg = SECTION_ICON[item.section] ?? SECTION_ICON.ijro;
                    const Icon = cfg.icon;
                    return (
                      <li key={item.key}>
                        <Link href={item.href} onClick={() => setBellOpen(false)}
                          className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-[#F8FAFF] transition-colors">
                          <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center" style={{ background: cfg.bg, borderRadius: 10 }}>
                            <Icon size={16} style={{ color: cfg.color }} />
                          </span>
                          <span className="flex-1 text-xs font-semibold leading-snug" style={{ color: "#0A1629" }}>{item.title}</span>
                          <span className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                            style={{ background: "#FF5C5C", borderRadius: 11 }}>
                            {item.count}
                          </span>
                          <ChevronRight size={14} className="flex-shrink-0" style={{ color: "#B8C2D6" }} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Hisob */}
        <div ref={accRef} className="relative flex-shrink-0">
          <button onClick={() => { setAccOpen(v => !v); setBellOpen(false); }}
            className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 hover:opacity-80 transition-opacity text-left"
            style={CARD}>
            <div className="w-8 h-8 flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: "#3F8CFF", borderRadius: 10 }}>
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-sm leading-tight" style={{ color: "#0A1629" }}>{displayName}</p>
              <p className="text-xs" style={{ color: "#91929E" }}>{displayRole}</p>
            </div>
            <ChevronDown size={16} style={{ color: "#0A1629", transform: accOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}
              className="hidden sm:block" />
          </button>

          {accOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64" style={POPUP}>
              <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid #F4F9FD" }}>
                <div className="w-11 h-11 flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: "#3F8CFF", borderRadius: 12 }}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>{displayName}</p>
                  <p className="text-xs" style={{ color: "#91929E" }}>{displayRole}</p>
                  {user?.phone && (
                    <p className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "#7D8592" }}>
                      <Phone size={10} /> {user.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-2">
                {user && (
                  <Link href={profileHref(user.role)} onClick={() => setAccOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F8FAFF] transition-colors"
                    style={{ color: "#0A1629" }}>
                    <User size={16} style={{ color: "#7D8592" }} /> Profil
                  </Link>
                )}
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-[#FFF1F1] transition-colors"
                  style={{ color: "#FF5C5C" }}>
                  <LogOut size={16} /> Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
