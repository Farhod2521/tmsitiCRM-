"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Users, User, ClipboardList, Crown, Briefcase, Building2, Shield, Loader2, Repeat } from "lucide-react";
import { getUser, switchRole } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const ROLE_INFO: Record<string, { label: string; icon: typeof User; color: string }> = {
  ijro:               { label: "Ijro boshqaruvi",     icon: ClipboardCheck, color: "#00C48C" },
  bolim_boshligi:     { label: "Bo'lim boshlig'i",    icon: Users,          color: "#3F8CFF" },
  boshqarma_boshligi: { label: "Boshqarma boshlig'i", icon: Building2,      color: "#15C0E6" },
  kadr:               { label: "Kadr vakili",         icon: ClipboardList,  color: "#FF8C42" },
  xodim:              { label: "Xodim",               icon: User,           color: "#7D8592" },
  zamdirektor:        { label: "Zamdirektor",         icon: Briefcase,      color: "#6D5DD3" },
  direktor:           { label: "Direktor",            icon: Crown,          color: "#E0457B" },
  superadmin:         { label: "Administrator",       icon: Shield,         color: "#3F8CFF" },
};

/** Foydalanuvchining barcha rollari va hozirgi faol roli (bazadagi eng so'nggi holat bilan). */
export function useMyRoles(): { roles: string[]; active: string | null } {
  const [state, setState] = useState<{ roles: string[]; active: string | null }>({ roles: [], active: null });
  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setState({ roles: u.roles ?? [u.role], active: u.role });
    // Superadmin keyin qo'shgan rol ham qayta kirmasdan ko'rinsin
    apiFetch<{ roles?: string[] }>("/auth/me").then(me => {
      if (!me.roles) return;
      localStorage.setItem("crm_user", JSON.stringify({ ...u, roles: me.roles }));
      setState({ roles: me.roles, active: u.role });
    }).catch(() => {});
  }, []);
  return state;
}

export function roleLabel(role: string) {
  return ROLE_INFO[role]?.label ?? role;
}

/** Sidebar pastidagi "Boshqa rolga o'tish" punktlari — faqat bir nechta roli borlarga. */
export default function RoleSwitchNav() {
  const { roles, active } = useMyRoles();
  const [busy, setBusy] = useState<string | null>(null);
  const others = roles.filter(r => r !== active);
  if (!others.length) return null;

  return (
    <div className="mt-4 pt-3" style={{ borderTop: "1px solid #F4F9FD" }}>
      <p className="px-3 pb-1.5 text-[10px] font-bold uppercase flex items-center gap-1.5" style={{ color: "#B0B8C8", letterSpacing: "0.06em" }}>
        <Repeat size={11} /> Boshqa rolga o'tish
      </p>
      <ul className="flex flex-col gap-1">
        {others.map(r => {
          const info = ROLE_INFO[r] ?? { label: r, icon: User, color: "#7D8592" };
          const Icon = info.icon;
          return (
            <li key={r}>
              <button disabled={busy !== null}
                onClick={async () => {
                  setBusy(r);
                  try { await switchRole(r); }
                  catch (e) { alert(e instanceof Error ? e.message : "Xatolik"); setBusy(null); }
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all hover:opacity-90 text-left"
                style={{ background: `${info.color}14`, border: `1px dashed ${info.color}66` }}>
                {busy === r
                  ? <Loader2 size={20} className="animate-spin" style={{ color: info.color }} />
                  : <Icon size={20} style={{ color: info.color }} />}
                <span className="font-semibold text-[15px]" style={{ color: info.color }}>{info.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
