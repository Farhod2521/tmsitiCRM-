"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { Users, Search, Loader2, Paperclip } from "lucide-react";
import { apiFetch } from "@/lib/api";
import EmployeeFilesModal from "@/components/employees/EmployeeFilesModal";

interface ApiDept { id: number; name: string; dept_type: string; }
interface ApiEmp {
  id: number; full_name: string; position: string;
  department_id: number | null; status: string;
  status_date_from?: string | null;
  status_date_to?: string | null;
  department?: ApiDept | null;
}

const STATUS_LABEL: Record<string, string> = {
  faol: "Faol",
  otpuska: "Mehnat ta'tilida",
  dekret: "Dekretda",
  shafyor_farrosh: "Texnik xodimlar",
  xizmat_safarida: "Xizmat safarida",
  oquv_tatilida: "O'quv ta'tilida",
  mehnatga_layoqatsiz: "Mehnatga layoqatsiz (bolnichniy)",
  online: "Online ishlaydi",
};
const STATUS_BADGE: Record<string, "success" | "gray"> = {
  faol: "success", otpuska: "gray", dekret: "gray", shafyor_farrosh: "gray",
  xizmat_safarida: "gray", oquv_tatilida: "gray", mehnatga_layoqatsiz: "gray", online: "gray",
};

function fmtDateUz(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function KadrXodimlarPage() {
  const [employees, setEmployees] = useState<ApiEmp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filesFor, setFilesFor] = useState<ApiEmp | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const e = await apiFetch<ApiEmp[]>("/employees/");
      setEmployees(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Header title="Xodimlar" subtitle="Xodimlar holati va shaxsiy fayllari (buyruqlar)" />

      <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5" style={{ background: "#F4F9FD", borderRadius: 12, minWidth: 220, maxWidth: 320 }}>
          <Search size={16} style={{ color: "#91929E" }} />
          <input type="text" placeholder="Xodim qidirish..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm flex-1" style={{ color: "#0A1629" }} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                {["#", "Xodim", "Bo'lim", "Holati", "Muddat", "Fayllar"].map(h => (
                  <th key={h} className="text-left pb-4 text-xs font-bold uppercase"
                    style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 16 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <Loader2 size={28} className="mx-auto animate-spin" style={{ color: "#3F8CFF" }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <Users size={32} className="mx-auto mb-3" style={{ color: "#D9E3F0" }} />
                  <p className="text-sm font-bold" style={{ color: "#91929E" }}>Xodimlar topilmadi</p>
                </td></tr>
              ) : filtered.map((emp, i) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #F4F9FD" }} className="hover:bg-[#F4F9FD] transition-colors">
                  <td className="py-4 text-sm font-bold" style={{ color: "#91929E", paddingRight: 16 }}>{i + 1}</td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                        style={{ background: "#FF8C42", borderRadius: 12 }}>
                        {mkAvatar(emp.full_name)}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{emp.full_name}</p>
                        <p className="text-xs" style={{ color: "#91929E" }}>{emp.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    {emp.department ? (
                      <span className="text-xs font-bold px-2 py-1" style={{ color: "#3F8CFF", background: "rgba(63,140,255,0.1)", borderRadius: 8 }}>
                        {emp.department.name}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#D9E3F0" }}>—</span>
                    )}
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <Badge label={STATUS_LABEL[emp.status] || emp.status} variant={STATUS_BADGE[emp.status] || "gray"} />
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    {emp.status === "dekret" ? (
                      <span className="text-xs font-bold" style={{ color: "#7D8592" }}>Cheksiz</span>
                    ) : emp.status_date_from && emp.status_date_to ? (
                      <p className="text-xs font-bold whitespace-nowrap" style={{ color: "#0A1629" }}>
                        {fmtDateUz(emp.status_date_from)} — {fmtDateUz(emp.status_date_to)}
                      </p>
                    ) : (
                      <span className="text-xs" style={{ color: "#D9E3F0" }}>—</span>
                    )}
                  </td>
                  <td className="py-4">
                    <button onClick={() => setFilesFor(emp)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(63,140,255,0.1)", color: "#3F8CFF", borderRadius: 8 }}>
                      <Paperclip size={13} /> Fayllar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-5">
          <p className="text-sm" style={{ color: "#91929E" }}>Jami {filtered.length} ta xodim ko'rsatilmoqda</p>
        </div>
      </div>

      {filesFor && (
        <EmployeeFilesModal employeeId={filesFor.id} employeeName={filesFor.full_name} onClose={() => setFilesFor(null)} />
      )}
    </div>
  );
}
