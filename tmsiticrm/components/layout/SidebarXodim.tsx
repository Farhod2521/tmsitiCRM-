"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getUser } from "@/lib/auth";
import { Target, User, LogOut, Star } from "lucide-react";
import LottiePlayer from "@/components/ui/LottiePlayer";

const ROLE_LABEL: Record<string, string> = {
  kadr: "Kadrlar bo'limi vakili",
  ijro: "Ijro nazorati vakili",
};
const ROLE_COLOR: Record<string, string> = {
  kadr: "#FF8C42",
  ijro: "#00C48C",
};
const BALL_ROLES = ["kadr", "ijro"];

export default function SidebarXodim() {
  const pathname = usePathname();
  const router   = useRouter();
  const [role, setRole] = useState("");

  useEffect(() => {
    const u = getUser();
    if (u) setRole(u.role);
  }, []);

  const isActive = (href: string) => {
    if (href === "/xodim") return pathname === "/xodim";
    return pathname.startsWith(href);
  };

  function handleLogout() { clearAuth(); router.push("/login"); }

  const accent = ROLE_COLOR[role] ?? "#3F8CFF";

  const navItems = [
    { href: "/xodim/kpi",     icon: Target, label: "KPI"          },
    ...(BALL_ROLES.includes(role)
      ? [{ href: "/xodim/ball", icon: Star, label: "Ball berish" }]
      : []
    ),
    { href: "/xodim/profile", icon: User,   label: "Profil"       },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col"
      style={{ width:260, background:"#FFFFFF", boxShadow:"4px 0 24px rgba(196,203,214,0.2)" }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <div className="w-[50px] h-[50px] flex items-center justify-center text-white font-bold text-lg"
          style={{ background: accent, borderRadius:12 }}>T</div>
        <div>
          <p className="font-bold text-sm" style={{ color:"#0A1629" }}>TMSITI</p>
          <p className="text-xs" style={{ color:"#91929E" }}>
            {ROLE_LABEL[role] ?? "CRM"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <li key={href} className="relative">
                <Link href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all"
                  style={{
                    background: active ? `${accent}18` : "transparent",
                    color:      active ? accent : "#7D8592",
                    fontWeight: active ? 700 : 600,
                    fontSize:   15,
                  }}>
                  <Icon size={20} style={{ color: active ? accent : "#7D8592" }}/>
                  {label}
                </Link>
                {active && (
                  <span className="absolute right-0 top-2 bottom-2"
                    style={{ width:4, background:accent, borderRadius:2 }}/>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Support Card */}
      <div className="mx-2 mb-4">
        <div className="pt-2 pb-4 px-2 text-center"
          style={{ background:`${accent}12`, borderRadius:20 }}>
          <LottiePlayer
            src="https://lottie.host/fa6b782a-bce3-4f59-96b1-b1801001343b/TxASaLnUXj.lottie"
            width={200} height={200} className="mx-auto"/>
          <p className="text-xs mt-3 mb-3" style={{ color:"#7D8592", fontWeight:600 }}>
            Yordam kerakmi?
          </p>
          <button className="w-full py-2.5 text-white text-sm font-bold"
            style={{ background:accent, borderRadius:12, boxShadow:`0px 6px 12px ${accent}44` }}>
            Qo'llab-quvvatlash
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 pb-6">
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-[10px] hover:bg-red-50 transition-all"
          style={{ color:"#7D8592", fontWeight:600, fontSize:15 }}>
          <LogOut size={20}/> Chiqish
        </button>
      </div>
    </aside>
  );
}
