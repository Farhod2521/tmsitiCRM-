"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import {
  ClipboardList, CheckCircle2, Clock, XCircle, ArrowRight,
  Loader2, Building2, FileText,
} from "lucide-react";

interface Department { id: number; name: string; dept_type: string; }
interface BolimInfo { id: number; name: string; holati: string; }
interface ApiDoc {
  id: number;
  sarlavha: string | null;
  hujjat_raqami: string | null;
  masul_bolimlar_info: string | null;
  holati: string;
  created_at: string | null;
}

type Bucket = "bajarilgan" | "jarayonda" | "bajarilmagan";

interface TaskRow { deptId: number; deptName: string; holati: string; docId: number; docTitle: string; createdAt: string | null; }

interface DeptRow { dept: Department; total: number; bajarilgan: number; jarayonda: number; bajarilmagan: number; pct: number; }

// Status ranglari — ilova bo'ylab izchil ishlatiladigan status palitrasi
// (Badge komponentidagi success/warning/danger bilan bir xil).
const STATUS_COLOR: Record<Bucket, string> = {
  bajarilgan:   "#00C48C",
  jarayonda:    "#FFBD21",
  bajarilmagan: "#FF5C5C",
};
const STATUS_BG: Record<Bucket, string> = {
  bajarilgan:   "rgba(0,196,140,0.1)",
  jarayonda:    "rgba(255,189,33,0.1)",
  bajarilmagan: "rgba(255,92,92,0.1)",
};
const STATUS_LABEL: Record<Bucket, string> = {
  bajarilgan: "Bajarilgan", jarayonda: "Jarayonda", bajarilmagan: "Bajarilmagan",
};

function bucketOf(holati: string): Bucket {
  if (holati === "bajarildi") return "bajarilgan";
  if (holati === "rad_etildi") return "bajarilmagan";
  return "jarayonda"; // yuborildi | qabul_qilindi | bajarilmoqda | tasdiq_kutilmoqda
}

function flattenTasks(docs: ApiDoc[]): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const d of docs) {
    if (!d.masul_bolimlar_info) continue;
    let info: BolimInfo[] = [];
    try { info = JSON.parse(d.masul_bolimlar_info); } catch { continue; }
    const docTitle = d.sarlavha || (d.hujjat_raqami ? `№ ${d.hujjat_raqami}` : `Hujjat #${d.id}`);
    for (const b of info) {
      rows.push({ deptId: b.id, deptName: b.name, holati: b.holati, docId: d.id, docTitle, createdAt: d.created_at });
    }
  }
  return rows;
}

function computeDeptRows(depts: Department[], tasks: TaskRow[]): DeptRow[] {
  return depts
    .map(dept => {
      const t = tasks.filter(x => x.deptId === dept.id);
      const bajarilgan   = t.filter(x => bucketOf(x.holati) === "bajarilgan").length;
      const jarayonda    = t.filter(x => bucketOf(x.holati) === "jarayonda").length;
      const bajarilmagan = t.filter(x => bucketOf(x.holati) === "bajarilmagan").length;
      return { dept, total: t.length, bajarilgan, jarayonda, bajarilmagan, pct: t.length ? Math.round((bajarilgan / t.length) * 100) : 0 };
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

// ─── Status holati aylanasi (donut) ────────────────────────────────────────────

function StatusDonut({ bajarilgan, jarayonda, bajarilmagan }: { bajarilgan: number; jarayonda: number; bajarilmagan: number }) {
  const total = bajarilgan + jarayonda + bajarilmagan;
  const size = 168, stroke = 24, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const gap = total > 0 ? 4 : 0;
  const segments: { bucket: Bucket; value: number }[] = [
    { bucket: "bajarilgan", value: bajarilgan },
    { bucket: "jarayonda", value: jarayonda },
    { bucket: "bajarilmagan", value: bajarilmagan },
  ];
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Jami ${total} topshiriq: ${bajarilgan} bajarilgan, ${jarayonda} jarayonda, ${bajarilmagan} bajarilmagan`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F4F9FD" strokeWidth={stroke} />
      {total > 0 && segments.map(s => {
        if (s.value === 0) return null;
        const frac = s.value / total;
        const len = Math.max(frac * c - gap, 0);
        const dashoffset = -offset;
        offset += frac * c;
        return (
          <circle key={s.bucket} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={STATUS_COLOR[s.bucket]} strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={dashoffset}
            strokeLinecap="butt" transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{`${STATUS_LABEL[s.bucket]}: ${s.value} (${Math.round(frac * 100)}%)`}</title>
          </circle>
        );
      })}
      <text x="50%" y="46%" textAnchor="middle" fontSize="28" fontWeight="700" fill="#0A1629" fontFamily="inherit">{total}</text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="12" fill="#91929E" fontFamily="inherit">Jami</text>
    </svg>
  );
}

export default function DirektorDashboard() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Department[]>("/departments/").catch(() => []),
      apiFetch<ApiDoc[]>("/ijro-docs/").catch(() => []),
    ]).then(([d, docList]) => {
      setDepts(d);
      setDocs(docList);
      setLoading(false);
    });
  }, []);

  const tasks = flattenTasks(docs);
  const total         = tasks.length;
  const bajarilgan    = tasks.filter(t => bucketOf(t.holati) === "bajarilgan").length;
  const jarayonda     = tasks.filter(t => bucketOf(t.holati) === "jarayonda").length;
  const bajarilmagan  = tasks.filter(t => bucketOf(t.holati) === "bajarilmagan").length;
  const bajarilishPct = total ? Math.round((bajarilgan / total) * 100) : 0;
  const jarayondaPct  = total ? Math.round((jarayonda / total) * 100) : 0;
  const bajarilmaganPct = total ? Math.round((bajarilmagan / total) * 100) : 0;

  const deptRows = computeDeptRows(depts, tasks);

  const activeTasks = [...tasks]
    .filter(t => bucketOf(t.holati) !== "bajarilgan")
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const today = new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });

  const stats: { label: string; value: number; sub: string; icon: typeof ClipboardList; bucket: Bucket | "all" }[] = [
    { label: "Jami topshiriqlar", value: total,         sub: `${deptRows.length} ta bo'limga yuborilgan`, icon: ClipboardList, bucket: "all" },
    { label: "Bajarilgan",        value: bajarilgan,    sub: `${bajarilishPct}% bajarilish darajasi`,      icon: CheckCircle2,  bucket: "bajarilgan" },
    { label: "Jarayonda",         value: jarayonda,     sub: `${jarayondaPct}% jarayonda`,                 icon: Clock,          bucket: "jarayonda" },
    { label: "Bajarilmagan",      value: bajarilmagan,  sub: `${bajarilmaganPct}% rad etilgan`,            icon: XCircle,        bucket: "bajarilmagan" },
  ];

  return (
    <div>
      <Header title="Ijro topshiriqlar" subtitle={`Bo'limlar bo'yicha topshiriqlar statistikasi — ${today}`} />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
            {stats.map(s => {
              const color = s.bucket === "all" ? "#3F8CFF" : STATUS_COLOR[s.bucket];
              const bg = s.bucket === "all" ? "rgba(63,140,255,0.1)" : STATUS_BG[s.bucket];
              return (
                <div key={s.label} className="p-5" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center" style={{ background: bg, borderRadius: 12 }}>
                      <s.icon size={19} style={{ color }} />
                    </div>
                    <p className="text-xs font-bold" style={{ color: "#91929E" }}>{s.label}</p>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: "#91929E" }}>{s.sub}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Bo'limlar bo'yicha topshiriqlar */}
            <div className="lg:col-span-2 p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
              <h2 className="font-bold text-lg mb-5" style={{ color: "#0A1629" }}>Bo'limlar bo'yicha topshiriqlar</h2>

              {deptRows.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 size={28} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
                  <p className="text-sm" style={{ color: "#91929E" }}>Hali hech qaysi bo'limga topshiriq yuborilmagan</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                        {["Bo'lim", "Jami", "Bajarilgan", "Jarayonda", "Bajarilmagan", "Bajarilish %"].map(h => (
                          <th key={h} className="text-left pb-3 text-xs font-bold uppercase" style={{ color: "#91929E", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deptRows.map(r => (
                        <tr key={r.dept.id} style={{ borderBottom: "1px solid #F4F9FD" }} className="hover:bg-[#F4F9FD] transition-colors">
                          <td className="py-3.5 font-bold text-sm" style={{ color: "#0A1629" }}>{r.dept.name}</td>
                          <td className="py-3.5 text-sm font-bold" style={{ color: "#0A1629" }}>{r.total}</td>
                          <td className="py-3.5 text-sm font-bold" style={{ color: STATUS_COLOR.bajarilgan }}>{r.bajarilgan}</td>
                          <td className="py-3.5 text-sm font-bold" style={{ color: STATUS_COLOR.jarayonda }}>{r.jarayonda}</td>
                          <td className="py-3.5 text-sm font-bold" style={{ color: STATUS_COLOR.bajarilmagan }}>{r.bajarilmagan}</td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 rounded-full overflow-hidden flex-1" style={{ background: "#F4F9FD", maxWidth: 90 }}>
                                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 75 ? STATUS_COLOR.bajarilgan : r.pct >= 40 ? STATUS_COLOR.jarayonda : STATUS_COLOR.bajarilmagan }} />
                              </div>
                              <span className="text-xs font-bold" style={{ color: "#0A1629" }}>{r.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-center mt-5">
                <a href="/superadmin/bolimlar" className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#3F8CFF" }}>
                  Barcha bo'limlarni ko'rish <ArrowRight size={14} />
                </a>
              </div>
            </div>

            {/* Right column: donut + active tasks */}
            <div className="flex flex-col gap-5">
              <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
                <h2 className="font-bold text-base mb-5" style={{ color: "#0A1629" }}>Topshiriqlar holati</h2>
                {total === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#91929E" }}>Hali topshiriq yo'q</p>
                ) : (
                  <div className="flex items-center gap-5">
                    <StatusDonut bajarilgan={bajarilgan} jarayonda={jarayonda} bajarilmagan={bajarilmagan} />
                    <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                      {(["bajarilgan", "jarayonda", "bajarilmagan"] as Bucket[]).map(b => {
                        const val = b === "bajarilgan" ? bajarilgan : b === "jarayonda" ? jarayonda : bajarilmagan;
                        const pct = total ? Math.round((val / total) * 100) : 0;
                        return (
                          <div key={b} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[b] }} />
                            <span className="text-xs flex-1 truncate" style={{ color: "#7D8592" }}>{STATUS_LABEL[b]}</span>
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: "#0A1629" }}>{val} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
                <h2 className="font-bold text-base mb-4" style={{ color: "#0A1629" }}>Faol topshiriqlar</h2>
                {activeTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText size={24} className="mx-auto mb-2" style={{ color: "#D0D9E8" }} />
                    <p className="text-xs" style={{ color: "#91929E" }}>Faol topshiriq yo'q</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {activeTasks.map(t => {
                      const b = bucketOf(t.holati);
                      return (
                        <div key={`${t.docId}-${t.deptId}`} className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: STATUS_COLOR[b] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: "#0A1629" }}>{t.docTitle}</p>
                            <p className="text-xs truncate" style={{ color: "#91929E" }}>{t.deptName}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 flex-shrink-0" style={{ background: STATUS_BG[b], color: STATUS_COLOR[b], borderRadius: 6 }}>
                            {STATUS_LABEL[b]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-center mt-4">
                  <a href="/superadmin/nazorat" className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#3F8CFF" }}>
                    Barcha topshiriqlar <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
