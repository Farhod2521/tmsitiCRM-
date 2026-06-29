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
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="font-bold" style={{ fontSize: 28, color: "#0A1629", lineHeight: "38px" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: "#91929E", fontSize: 14, marginTop: 2 }}>{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14, minWidth: 240 }}>
          <Search size={18} style={{ color: "#91929E" }} />
          <input type="text" placeholder="Qidirish..."
            className="bg-transparent outline-none text-sm flex-1" style={{ color: "#0A1629" }} />
        </div>

        {/* Notifications */}
        <div className="relative w-12 h-12 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 }}>
          <Bell size={20} style={{ color: "#0A1629" }} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2"
            style={{ background: "#FF5C5C", borderRadius: "50%" }} />
        </div>

        {/* Account */}
        <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 14 }}>
          <div className="w-8 h-8 flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "#3F8CFF", borderRadius: 10 }}>
            {initials}
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "#0A1629" }}>{displayName}</p>
            <p className="text-xs" style={{ color: "#91929E" }}>{displayRole}</p>
          </div>
          <ChevronDown size={16} style={{ color: "#0A1629" }} />
        </div>
      </div>
    </header>
  );
}
