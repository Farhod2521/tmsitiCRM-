"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Star, User, LogOut } from "lucide-react";
import LottiePlayer from "@/components/ui/LottiePlayer";
import { clearAuth } from "@/lib/auth";

const navItems = [
  { href: "/kadr/ball",    icon: Star, label: "Ball berish" },
  { href: "/kadr/profile", icon: User, label: "Profil"      },
];

export default function SidebarKadr() {
  const pathname = usePathname();
  const router   = useRouter();
  const isActive = (href: string) => pathname.startsWith(href);

  function handleLogout() { clearAuth(); router.push("/login"); }

  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col"
      style={{ width:260, background:"#FFFFFF", boxShadow:"4px 0 24px rgba(196,203,214,0.2)" }}>

      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <div className="w-[50px] h-[50px] flex items-center justify-center text-white font-bold text-lg"
          style={{ background:"#FF8C42", borderRadius:12 }}>K</div>
        <div>
          <p className="font-bold text-sm" style={{ color:"#0A1629" }}>TMSITI</p>
          <p className="text-xs" style={{ color:"#91929E" }}>Kadrlar bo'limi</p>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <li key={href} className="relative">
                <Link href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all"
                  style={{
                    background: active ? "rgba(255,140,66,0.1)" : "transparent",
                    color: active ? "#FF8C42" : "#7D8592",
                    fontWeight: active ? 700 : 600, fontSize:15,
                  }}>
                  <Icon size={20} style={{ color: active ? "#FF8C42" : "#7D8592" }}/>
                  {label}
                </Link>
                {active && (
                  <span className="absolute right-0 top-2 bottom-2"
                    style={{ width:4, background:"#FF8C42", borderRadius:2 }}/>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-2 mb-4">
        <div className="pt-2 pb-4 px-2 text-center"
          style={{ background:"rgba(255,140,66,0.07)", borderRadius:20 }}>
          <LottiePlayer
            src="https://lottie.host/fa6b782a-bce3-4f59-96b1-b1801001343b/TxASaLnUXj.lottie"
            width={200} height={200} className="mx-auto"/>
          <p className="text-xs mt-3 mb-3" style={{ color:"#7D8592", fontWeight:600 }}>
            Kadrlar bo'limi vakili
          </p>
        </div>
      </div>

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
