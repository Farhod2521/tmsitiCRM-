"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  Users, Building2, UserX, FileCheck, ArrowRight, Loader2,
  BarChart3, ClipboardCheck, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";

interface ApiEmp { id: number; is_active: boolean; status: string; }
interface ApiDept { id: number; name: string; }
interface ApiDoc {
  id: number; sarlavha: string | null; hujjat_raqami: string | null;
  ijro_muddati: string | null; holati: string; masul_bolimlar_nomi: string | null;
}
interface PendingMsg { count: number }

const QUICK_LINKS = [
  { href: "/superadmin/bolimlar",   icon: Building2,      label: "Bo'limlar",     desc: "Bo'limlar va xodimlar ro'yxati", color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  { href: "/superadmin/hisobotlar", icon: BarChart3,       label: "Hisobotlar",    desc: "Haftalik hisobotlarni ko'rish",  color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  { href: "/superadmin/nazorat",    icon: FileCheck,       label: "Ijro nazorati", desc: "Topshiriqlar va hujjatlar",      color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
  { href: "/superadmin/davomat",    icon: ClipboardCheck,  label: "Davomat",       desc: "Kunlik davomat monitoringi",     color: "#FFBD21", bg: "rgba(255,189,33,0.1)"  },
];

function daysLeft(d: string | null): { text: string; color: string } | null {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)} kun o'tgan`, color: "#FF5C5C" };
  if (diff === 0) return { text: "Bugun",             color: "#FF5C5C" };
  if (diff <= 5)  return { text: `${diff} kun qoldi`, color: "#FFBD21" };
  return           { text: `${diff} kun qoldi`,       color: "#00C48C" };
}

export default function DirektorDashboard() {
  const [emps, setEmps] = useState<ApiEmp[]>([]);
  const [depts, setDepts] = useState<ApiDept[]>([]);
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [absentToday, setAbsentToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    Promise.all([
      apiFetch<ApiEmp[]>("/employees/").catch(() => []),
      apiFetch<ApiDept[]>("/departments/").catch(() => []),
      apiFetch<ApiDoc[]>("/ijro-docs/").catch(() => []),
      apiFetch<PendingMsg>("/attendance/pending-message").catch(() => null),
    ]).then(([e, d, docList, pending]) => {
      setEmps(e);
      setDepts(d);
      setDocs(docList);
      setAbsentToday(pending?.count ?? null);
      setLoading(false);
    });
  }, []);

  const activeEmps = emps.filter(e => e.is_active && e.status === "faol").length;
  const doneDocsCount = docs.filter(d => d.holati === "bajarildi").length;
  const overdue = docs.filter(d => d.holati !== "bajarildi" && d.ijro_muddati && new Date(d.ijro_muddati).getTime() < Date.now());
  const upcoming = docs
    .filter(d => d.holati !== "bajarildi" && d.ijro_muddati)
    .sort((a, b) => new Date(a.ijro_muddati!).getTime() - new Date(b.ijro_muddati!).getTime())
    .slice(0, 6);

  const today = new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });

  const stats = [
    { label: "Faol xodimlar",        value: activeEmps,               icon: Users,          color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
    { label: "Bo'limlar soni",       value: depts.length,             icon: Building2,      color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
    { label: "Bugun kelmaganlar",    value: absentToday ?? "—",       icon: UserX,          color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
    { label: "Bajarilgan topshiriq", value: `${doneDocsCount}/${docs.length}`, icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
  ];

  return (
    <div>
      <Header title={`Xush kelibsiz, ${user?.full_name?.split(" ")[0] || ""}`} subtitle={today} />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
            {stats.map(s => (
              <div key={s.label} className="p-5 flex items-center gap-4"
                style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center" style={{ background: s.bg, borderRadius: 14 }}>
                  <s.icon size={22} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {overdue.length > 0 && (
            <div className="flex items-center gap-3 p-4 mb-6" style={{ background: "rgba(255,92,92,0.06)", border: "1px solid rgba(255,92,92,0.15)", borderRadius: 18 }}>
              <AlertTriangle size={20} style={{ color: "#FF5C5C" }} className="flex-shrink-0" />
              <p className="text-sm font-bold" style={{ color: "#0A1629" }}>
                {overdue.length} ta topshiriqning muddati o'tgan —{" "}
                <Link href="/superadmin/nazorat" className="underline" style={{ color: "#FF5C5C" }}>ko'rish</Link>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Quick links */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {QUICK_LINKS.map(q => (
                <Link key={q.href} href={q.href}
                  className="p-5 flex items-center gap-4 hover:opacity-90 transition-opacity"
                  style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center" style={{ background: q.bg, borderRadius: 14 }}>
                    <q.icon size={22} style={{ color: q.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{q.label}</p>
                    <p className="text-xs truncate" style={{ color: "#91929E" }}>{q.desc}</p>
                  </div>
                  <ArrowRight size={16} style={{ color: "#D0D9E8" }} className="flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* Upcoming deadlines */}
            <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base" style={{ color: "#0A1629" }}>Yaqinlashayotgan muddatlar</h2>
                <Link href="/superadmin/nazorat" className="text-xs font-bold" style={{ color: "#3F8CFF" }}>Barchasi</Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={26} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
                  <p className="text-xs" style={{ color: "#91929E" }}>Yaqin muddatli topshiriq yo'q</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map(d => {
                    const dl = daysLeft(d.ijro_muddati);
                    return (
                      <div key={d.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>
                            {d.sarlavha || (d.hujjat_raqami ? `№ ${d.hujjat_raqami}` : `Hujjat #${d.id}`)}
                          </p>
                          <p className="text-xs truncate" style={{ color: "#91929E" }}>{d.masul_bolimlar_nomi || "—"}</p>
                        </div>
                        {dl && (
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: dl.color }}>{dl.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
