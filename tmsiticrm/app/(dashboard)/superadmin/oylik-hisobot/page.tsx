"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api";
import {
  ChevronDown, ChevronLeft, ChevronRight, Loader2, Building2,
  Users, Eye,
} from "lucide-react";
import MonthlyReportModal from "@/components/reports/MonthlyReportModal";

const MON_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

interface Department { id: number; name: string; dept_type: string; order_num: number; }
interface Employee {
  id: number;
  full_name: string;
  position: string;
  department_id: number | null;
  department: Department | null;
  role: string;
}

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ["#3F8CFF", "#6D5DD3", "#00C48C", "#FFBD21", "#FF5C5C", "#15C0E6", "#FF8C42"];

export default function OylikHisobotPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reportTarget, setReportTarget] = useState<Employee | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Employee[]>("/employees/")
      .then(list => {
        setEmployees(list.filter(e => e.role !== "superadmin"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m);
  }

  const groups = useMemo(() => {
    const map = new Map<number, { dept: Department; employees: Employee[] }>();
    const noDept: Employee[] = [];
    for (const e of employees) {
      if (!e.department) { noDept.push(e); continue; }
      if (!map.has(e.department.id)) map.set(e.department.id, { dept: e.department, employees: [] });
      map.get(e.department.id)!.employees.push(e);
    }
    const list = Array.from(map.values()).sort((a, b) => (a.dept.order_num - b.dept.order_num) || a.dept.name.localeCompare(b.dept.name));
    if (noDept.length) list.push({ dept: { id: 0, name: "Bo'limsiz", dept_type: "xizmat", order_num: 999 }, employees: noDept });
    return list;
  }, [employees]);

  function toggle(id: number) {
    setExpanded(p => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <Header title="Oylik hisobot" subtitle="Bo'limlar bo'yicha xodimlarning to'liq oylik hisobotini ko'ring" />

      <div className="flex items-center justify-end mb-5">
        <div className="flex items-center gap-1 p-1" style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <button onClick={() => chMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronLeft size={15} style={{ color: "#3F8CFF" }} />
          </button>
          <span className="px-3 font-bold text-sm" style={{ color: "#0A1629", minWidth: 130, textAlign: "center" }}>
            {MON_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => chMonth(1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F9FD] transition-colors">
            <ChevronRight size={15} style={{ color: "#3F8CFF" }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: "#3F8CFF" }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center" style={{ background: "#FFFFFF", borderRadius: 24, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)" }}>
          <Users size={36} style={{ color: "#D9E3F0", margin: "0 auto" }} />
          <p className="font-bold mt-3" style={{ color: "#0A1629" }}>Xodimlar topilmadi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(({ dept, employees: emps }) => {
            const isOpen = expanded.has(dept.id);
            return (
              <div key={dept.id} style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", overflow: "hidden" }}>
                <button onClick={() => toggle(dept.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAFCFF] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,140,255,0.1)", borderRadius: 12 }}>
                      <Building2 size={18} style={{ color: "#3F8CFF" }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{dept.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{emps.length} ta xodim</p>
                    </div>
                  </div>
                  <ChevronDown size={18} style={{ color: "#7D8592", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid #F4F9FD" }}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                          {["Ism familiyasi", "Lavozimi", ""].map((h, i) => (
                            <th key={i} className="text-left px-6 py-3 text-xs font-bold uppercase"
                              style={{ color: "#91929E", letterSpacing: "0.04em", background: "#FAFCFF" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {emps.map((e, i) => (
                          <tr key={e.id} className="hover:bg-[#FAFCFF] transition-colors"
                            style={{ borderBottom: i < emps.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ background: AVATAR_COLORS[e.id % AVATAR_COLORS.length], borderRadius: 9 }}>
                                  {mkAvatar(e.full_name)}
                                </div>
                                <span className="text-sm font-bold" style={{ color: "#0A1629" }}>{e.full_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-sm" style={{ color: "#7D8592" }}>{e.position}</td>
                            <td className="px-6 py-3.5 text-right">
                              <button onClick={() => setReportTarget(e)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
                                style={{ background: "#3F8CFF", borderRadius: 9 }}>
                                <Eye size={13} /> Hisobot ko'rish
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reportTarget && (
        <MonthlyReportModal
          employeeId={reportTarget.id}
          year={year}
          month={month}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
