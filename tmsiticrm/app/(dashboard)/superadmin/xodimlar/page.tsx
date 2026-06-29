import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  Star,
} from "lucide-react";

const employees = [
  { id: 1, name: "Alisher Karimov", role: "CTO", dept: "IT Bo'limi", phone: "+998 90 123 45 67", email: "a.karimov@tmsiti.uz", kpi: 94, status: "Faol", rating: 5, joined: "Jan 2020" },
  { id: 2, name: "Nodira Hasanova", role: "CFO", dept: "Moliya", phone: "+998 91 234 56 78", email: "n.hasanova@tmsiti.uz", kpi: 89, status: "Faol", rating: 4, joined: "Mar 2019" },
  { id: 3, name: "Jasur Mirzayev", role: "CMO", dept: "Marketing", phone: "+998 93 345 67 89", email: "j.mirzayev@tmsiti.uz", kpi: 82, status: "Faol", rating: 4, joined: "Jun 2021" },
  { id: 4, name: "Shahnoza Tosheva", role: "HR Director", dept: "HR", phone: "+998 94 456 78 90", email: "sh.tosheva@tmsiti.uz", kpi: 91, status: "Faol", rating: 5, joined: "Feb 2018" },
  { id: 5, name: "Ulugbek Saidov", role: "COO", dept: "Ishlab chiqarish", phone: "+998 95 567 89 01", email: "u.saidov@tmsiti.uz", kpi: 78, status: "Ta'tilda", rating: 3, joined: "Sep 2020" },
  { id: 6, name: "Kamola Nazarova", role: "Legal Director", dept: "Huquq", phone: "+998 97 678 90 12", email: "k.nazarova@tmsiti.uz", kpi: 88, status: "Faol", rating: 4, joined: "Dec 2021" },
  { id: 7, name: "Bobur Toshmatov", role: "Senior Developer", dept: "IT Bo'limi", phone: "+998 90 789 01 23", email: "b.toshmatov@tmsiti.uz", kpi: 96, status: "Faol", rating: 5, joined: "Apr 2022" },
  { id: 8, name: "Dilnoza Rahimova", role: "Accountant", dept: "Moliya", phone: "+998 91 890 12 34", email: "d.rahimova@tmsiti.uz", kpi: 85, status: "Faol", rating: 4, joined: "Jul 2021" },
];

const deptColors: Record<string, string> = {
  "IT Bo'limi": "#3F8CFF",
  "Moliya": "#00C48C",
  "Marketing": "#FFBD21",
  "HR": "#6D5DD3",
  "Ishlab chiqarish": "#15C0E6",
  "Huquq": "#FF5C5C",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "Faol") return <Badge label={status} variant="success" />;
  if (status === "Ta'tilda") return <Badge label={status} variant="warning" />;
  return <Badge label={status} variant="gray" />;
}

export default function XodimlarPage() {
  return (
    <div>
      <Header title="Xodimlar" subtitle="Barcha xodimlar ro'yxati va ma'lumotlari" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: "Jami xodimlar", value: "248", color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
          { label: "Faol xodimlar", value: "231", color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
          { label: "Ta'tildagilar", value: "12", color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
          { label: "Yangi (bu oy)", value: "5", color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-5 flex items-center gap-4"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg, borderRadius: 14 }}
            >
              <Users size={22} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div
        className="p-6"
        style={{
          background: "#FFFFFF",
          boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
          borderRadius: 24,
        }}
      >
        {/* Table toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{
                background: "#F4F9FD",
                borderRadius: 12,
                minWidth: 220,
              }}
            >
              <Search size={16} style={{ color: "#91929E" }} />
              <input
                type="text"
                placeholder="Xodim qidirish..."
                className="bg-transparent outline-none text-sm flex-1"
                style={{ color: "#0A1629" }}
              />
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold"
              style={{
                background: "#F4F9FD",
                color: "#7D8592",
                borderRadius: 12,
              }}
            >
              <Filter size={16} />
              Filter
            </button>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white"
            style={{
              background: "#3F8CFF",
              borderRadius: 14,
              boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
            }}
          >
            <Plus size={18} />
            Xodim qo'shish
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                {["#", "Xodim", "Lavozim", "Bo'lim", "Aloqa", "KPI", "Reyting", "Holat", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left pb-4 text-xs font-bold uppercase"
                      style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 16 }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const color = deptColors[emp.dept] || "#7D8592";
                return (
                  <tr
                    key={emp.id}
                    style={{ borderBottom: "1px solid #F4F9FD" }}
                    className="hover:bg-[#F4F9FD] transition-colors"
                  >
                    <td className="py-4 text-sm font-bold" style={{ color: "#91929E", paddingRight: 16 }}>
                      {emp.id}
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                          style={{ background: color, borderRadius: 12 }}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                            {emp.name}
                          </p>
                          <p className="text-xs" style={{ color: "#91929E" }}>
                            {emp.joined} dan
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 16 }}>
                      {emp.role}
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <span
                        className="text-xs font-bold px-2 py-1"
                        style={{ color, background: `${color}18`, borderRadius: 8 }}
                      >
                        {emp.dept}
                      </span>
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-xs" style={{ color: "#7D8592" }}>
                          <Phone size={11} /> {emp.phone}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: "#7D8592" }}>
                          <Mail size={11} /> {emp.email.split("@")[0]}...
                        </span>
                      </div>
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: "#F4F9FD", width: 60 }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${emp.kpi}%`,
                              background:
                                emp.kpi >= 85 ? "#00C48C" : emp.kpi >= 75 ? "#FFBD21" : "#FF5C5C",
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold" style={{ color: "#0A1629" }}>
                          {emp.kpi}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            fill={s <= emp.rating ? "#FFBD21" : "none"}
                            style={{ color: s <= emp.rating ? "#FFBD21" : "#D9E3F0" }}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-4" style={{ paddingRight: 16 }}>
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="py-4">
                      <button style={{ color: "#91929E" }}>
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm" style={{ color: "#91929E" }}>
            Jami 248 xodimdan 1-8 ko'rsatilmoqda
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, "...", 31].map((p, i) => (
              <button
                key={i}
                className="w-9 h-9 flex items-center justify-center text-sm font-bold"
                style={{
                  background: p === 1 ? "#3F8CFF" : "#F4F9FD",
                  color: p === 1 ? "#FFFFFF" : "#7D8592",
                  borderRadius: 10,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
