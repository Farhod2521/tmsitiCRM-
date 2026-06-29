import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

const kpiCategories = [
  {
    name: "Moliyaviy KPI",
    icon: "💰",
    color: "#00C48C",
    bg: "rgba(0,196,140,0.1)",
    items: [
      { name: "Oylik daromad", target: "1,500 mln", actual: "1,240 mln", pct: 82, trend: -3 },
      { name: "Xarajatlar nazorati", target: "500 mln", actual: "480 mln", pct: 96, trend: 5 },
      { name: "Foyda marjasi", target: "25%", actual: "22%", pct: 88, trend: 2 },
    ],
  },
  {
    name: "Operatsion KPI",
    icon: "⚙️",
    color: "#3F8CFF",
    bg: "rgba(63,140,255,0.1)",
    items: [
      { name: "Loyiha bajarilishi", target: "100%", actual: "87%", pct: 87, trend: 4 },
      { name: "Vaqtni samarali ishlatish", target: "95%", actual: "91%", pct: 96, trend: 2 },
      { name: "Mijoz qoniqishi", target: "90%", actual: "94%", pct: 104, trend: 7 },
    ],
  },
  {
    name: "HR KPI",
    icon: "👥",
    color: "#6D5DD3",
    bg: "rgba(109,93,211,0.1)",
    items: [
      { name: "Kadrlar almashinuvi", target: "< 5%", actual: "3.2%", pct: 95, trend: -1 },
      { name: "Taʼlim va rivojlanish", target: "80 soat", actual: "72 soat", pct: 90, trend: 8 },
      { name: "Xodimlar qoniqishi", target: "85%", actual: "88%", pct: 103, trend: 3 },
    ],
  },
];

const topPerformers = [
  { name: "Bobur Toshmatov", dept: "IT", score: 96, badge: "Oy yaxshisi", color: "#3F8CFF" },
  { name: "Nodira Hasanova", dept: "Moliya", score: 94, badge: "A'lochi", color: "#00C48C" },
  { name: "Alisher Karimov", dept: "IT", score: 94, badge: "Rahbar", color: "#6D5DD3" },
  { name: "Shahnoza Tosheva", dept: "HR", score: 91, badge: "Faol", color: "#FFBD21" },
];

export default function KpiPage() {
  return (
    <div>
      <Header title="KPI Boshqaruvi" subtitle="Ko'rsatkichlar va maqsadlar monitoringi" />

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: "Umumiy KPI", value: "87%", icon: Target, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)", change: "+5%" },
          { label: "Maqsadga yetdi", value: "11/14", icon: CheckCircle2, color: "#00C48C", bg: "rgba(0,196,140,0.1)", change: "+2" },
          { label: "Jarayonda", value: "2/14", icon: Clock, color: "#FFBD21", bg: "rgba(255,189,33,0.1)", change: "" },
          { label: "Orqada", value: "1/14", icon: AlertCircle, color: "#FF5C5C", bg: "rgba(255,92,92,0.1)", change: "-1" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-5"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ background: s.bg, borderRadius: 14 }}
              >
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              {s.change && (
                <span
                  className="text-xs font-bold px-2 py-1"
                  style={{
                    color: s.change.startsWith("-") ? "#FF5C5C" : "#00C48C",
                    background: s.change.startsWith("-") ? "rgba(255,92,92,0.1)" : "rgba(0,196,140,0.1)",
                    borderRadius: 8,
                  }}
                >
                  {s.change}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold" style={{ color: "#0A1629" }}>
              {s.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "#91929E" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* KPI Categories - 2 cols */}
        <div className="col-span-2 flex flex-col gap-5">
          {kpiCategories.map((cat) => (
            <div
              key={cat.name}
              className="p-6"
              style={{
                background: "#FFFFFF",
                boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
                borderRadius: 24,
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center text-xl"
                    style={{ background: cat.bg, borderRadius: 12 }}
                  >
                    {cat.icon}
                  </div>
                  <h3 className="font-bold" style={{ color: "#0A1629" }}>
                    {cat.name}
                  </h3>
                </div>
                <button style={{ color: "#91929E" }}>
                  <MoreHorizontal size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {cat.items.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                          {item.name}
                        </p>
                        <p className="text-xs" style={{ color: "#91929E" }}>
                          Maqsad: {item.target} → Haqiqiy: {item.actual}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.trend > 0 ? (
                          <TrendingUp size={14} style={{ color: "#00C48C" }} />
                        ) : (
                          <TrendingDown size={14} style={{ color: "#FF5C5C" }} />
                        )}
                        <span
                          className="text-xs font-bold"
                          style={{ color: item.trend > 0 ? "#00C48C" : "#FF5C5C" }}
                        >
                          {item.trend > 0 ? "+" : ""}
                          {item.trend}%
                        </span>
                        <span className="font-bold text-sm" style={{ color: "#0A1629" }}>
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                    <div
                      className="h-2.5 rounded-full overflow-hidden"
                      style={{ background: "#F4F9FD" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(item.pct, 100)}%`,
                          background:
                            item.pct >= 90
                              ? cat.color
                              : item.pct >= 75
                              ? "#FFBD21"
                              : "#FF5C5C",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Top Performers */}
        <div className="flex flex-col gap-5">
          <div
            className="p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Award size={20} style={{ color: "#FFBD21" }} />
              <h3 className="font-bold" style={{ color: "#0A1629" }}>
                Top xodimlar
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              {topPerformers.map((emp, i) => (
                <div key={emp.name} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
                    style={{
                      background: i === 0 ? "#FFBD21" : i === 1 ? "#91929E" : i === 2 ? "#CD7F32" : "#F4F9FD",
                      borderRadius: 10,
                      color: i < 3 ? "#FFFFFF" : "#7D8592",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: emp.color, borderRadius: 12 }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#0A1629" }}>
                      {emp.name}
                    </p>
                    <p className="text-xs" style={{ color: "#91929E" }}>
                      {emp.dept}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                      {emp.score}%
                    </p>
                    <Badge label={emp.badge} variant="primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Trend */}
          <div
            className="p-6"
            style={{
              background: "#3F8CFF",
              boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
              borderRadius: 24,
            }}
          >
            <h3 className="font-bold text-white mb-4">Oylik trend</h3>
            <div className="flex items-end gap-2 h-32">
              {[65, 72, 68, 80, 75, 87, 83, 90, 87, 92, 88, 87].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${(v / 100) * 100}px`,
                      background: i === 11 ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {["Y", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"].map((m, i) => (
                <span key={i} className="text-xs text-white opacity-60 flex-1 text-center">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Department KPIs */}
          <div
            className="p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <h3 className="font-bold mb-4" style={{ color: "#0A1629" }}>
              Bo'limlar KPI
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { name: "IT", kpi: 94, color: "#3F8CFF" },
                { name: "Moliya", kpi: 89, color: "#00C48C" },
                { name: "HR", kpi: 91, color: "#6D5DD3" },
                { name: "Marketing", kpi: 82, color: "#FFBD21" },
                { name: "Ishlab chiqarish", kpi: 78, color: "#15C0E6" },
              ].map((d) => (
                <div key={d.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: "#7D8592" }}>
                      {d.name}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "#0A1629" }}>
                      {d.kpi}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#F4F9FD" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.kpi}%`, background: d.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
