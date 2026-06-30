"use client";

import { Bell, ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import type { LoginResponse } from "@/lib/api";

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "superadmin":           return "Administrator";
    case "bolim_boshligi":       return "Bo'lim boshlig'i";
    case "boshqarma_boshligi":   return "Boshqarma boshlig'i";
    case "xodim":                return "Xodim";
    default:                     return role;
  }
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [user, setUser] = useState<LoginResponse | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const initials    = user ? getInitials(user.full_name) : "SA";
  const displayName = user?.full_name  || "Super Admin";
  const displayRole = user ? getRoleLabel(user.role) : "Administrator";

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
        <div className="hidden md:flex items-center gap-2 px-4 py-3"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14, minWidth: 200 }}>
          <Search size={18} style={{ color: "#91929E" }} />
          <input type="text" placeholder="Qidirish..."
            className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "#0A1629" }} />
        </div>

        {/* Search icon — faqat mobil/tablet */}
        <div className="md:hidden relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 }}>
          <Search size={18} style={{ color: "#0A1629" }} />
        </div>

        {/* Notifications */}
        <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 }}>
          <Bell size={20} style={{ color: "#0A1629" }} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2"
            style={{ background: "#FF5C5C", borderRadius: "50%" }} />
        </div>

        {/* Account */}
        <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 }}>
          <div className="w-8 h-8 flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: "#3F8CFF", borderRadius: 10 }}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="font-bold text-sm leading-tight" style={{ color: "#0A1629" }}>{displayName}</p>
            <p className="text-xs" style={{ color: "#91929E" }}>{displayRole}</p>
          </div>
          <ChevronDown size={16} style={{ color: "#0A1629" }} className="hidden sm:block" />
        </div>
      </div>
    </header>
  );
}
