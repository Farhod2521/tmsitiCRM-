"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  BarChart3,
  LogOut,
  CalendarDays,
  Wallet,
  Settings,
  ClipboardCheck,
  Star,
  X,
} from "lucide-react";
import LottiePlayer from "@/components/ui/LottiePlayer";
import MobileTopBar from "@/components/layout/MobileTopBar";

const navItems = [
  { href: "/superadmin",              icon: LayoutDashboard, label: "Dashboard",   enabled: true  },
  { href: "/superadmin/bolimlar",     icon: Building2,       label: "Bo'limlar",   enabled: true  },
  { href: "/superadmin/ball-berish",  icon: Star,            label: "Ball berish", enabled: true  },
  { href: "/superadmin/davomat",      icon: ClipboardCheck,  label: "Davomat",     enabled: true  },
  { href: "/superadmin/sozlamalar",   icon: Settings,        label: "Sozlamalar",  enabled: true  },
  { href: "/superadmin/xodimlar",     icon: Users,           label: "Xodimlar",    enabled: false },
  { href: "/superadmin/kpi",          icon: Target,          label: "KPI",         enabled: false },
  { href: "/superadmin/hisobotlar",   icon: BarChart3,       label: "Hisobotlar",  enabled: false },
  { href: "/superadmin/kalendar",     icon: CalendarDays,    label: "Kalendar",    enabled: false },
  { href: "/superadmin/moliya",       icon: Wallet,          label: "Moliya",      enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/superadmin") return pathname === "/superadmin";
    return pathname.startsWith(href);
  };

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <>
      <MobileTopBar accent="#3F8CFF" letter="T" onOpen={() => setMobileOpen(true)} />

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ background: "rgba(10,22,41,0.5)" }}
          onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          width: 260,
          background: "#FFFFFF",
          boxShadow: "4px 0 24px rgba(196, 203, 214, 0.2)",
        }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 w-8 h-8 flex items-center justify-center"
          style={{ background: "#F4F9FD", borderRadius: 8 }}
        >
          <X size={16} style={{ color: "#7D8592" }} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
          <div
            className="w-[50px] h-[50px] flex items-center justify-center text-white font-bold text-lg"
            style={{ background: "#3F8CFF", borderRadius: 12 }}
          >
            T
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
              TMSITI
            </p>
            <p className="text-xs" style={{ color: "#91929E" }}>
              CRM
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 overflow-y-auto" onClick={() => setMobileOpen(false)}>
        <ul className="flex flex-col gap-1">
          {navItems.map(({ href, icon: Icon, label, enabled }) => {
            const active = isActive(href);
            if (!enabled) {
              return (
                <li key={href} className="relative">
                  <span
                    className="flex items-center gap-3 px-3 py-3 rounded-[10px] cursor-not-allowed select-none"
                    title="Tez kunda ishga tushiriladi"
                    style={{
                      color: "#C4CBD6",
                      fontWeight: 600,
                      fontSize: 15,
                      opacity: 0.6,
                    }}
                  >
                    <Icon size={20} style={{ color: "#C4CBD6" }} />
                    {label}
                    <span
                      className="ml-auto text-[10px] font-bold px-1.5 py-0.5"
                      style={{ background: "#F4F9FD", color: "#C4CBD6", borderRadius: 6 }}
                    >
                      Tez kunda
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all"
                  style={{
                    background: active ? "rgba(63,140,255,0.1)" : "transparent",
                    color: active ? "#3F8CFF" : "#7D8592",
                    fontWeight: active ? 700 : 600,
                    fontSize: 15,
                  }}
                >
                  <Icon
                    size={20}
                    style={{ color: active ? "#3F8CFF" : "#7D8592" }}
                  />
                  {label}
                </Link>
                {active && (
                  <span
                    className="absolute right-0 top-2 bottom-2"
                    style={{
                      width: 4,
                      background: "#3F8CFF",
                      borderRadius: 2,
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Support Card */}
      <div className="mx-2 mb-4">
        <div
          className="pt-2 pb-4 px-2 text-center"
          style={{
            background: "rgba(63,140,255,0.07)",
            borderRadius: 20,
          }}
        >
          <LottiePlayer
            src="https://lottie.host/fa6b782a-bce3-4f59-96b1-b1801001343b/TxASaLnUXj.lottie"
            width={200}
            height={200}
            className="mx-auto"
          />
          <p
            className="text-xs mt-3 mb-3"
            style={{ color: "#7D8592", fontWeight: 600 }}
          >
            Yordam kerakmi?
          </p>
          <button
            className="w-full py-2.5 text-white text-sm font-bold"
            style={{
              background: "#3F8CFF",
              borderRadius: 12,
              boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
            }}
          >
            Qo'llab-quvvatlash
          </button>
        </div>
      </div>

        {/* Logout */}
        <div className="px-4 pb-6">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-[10px] transition-all hover:bg-red-50"
            style={{ color: "#7D8592", fontWeight: 600, fontSize: 15 }}
          >
            <LogOut size={20} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
