import Header from "@/components/layout/Header";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import {
  Users,
  Building2,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";

const stats = [
  {
    title: "Jami xodimlar",
    value: "248",
    change: "12%",
    positive: true,
    icon: Users,
    iconColor: "#3F8CFF",
    iconBg: "rgba(63,140,255,0.1)",
  },
  {
    title: "Bo'limlar soni",
    value: "14",
    change: "2",
    positive: true,
    icon: Building2,
    iconColor: "#6D5DD3",
    iconBg: "rgba(109,93,211,0.1)",
  },
  {
    title: "Oylik KPI",
    value: "87%",
    change: "5%",
    positive: true,
    icon: Target,
    iconColor: "#00C48C",
    iconBg: "rgba(0,196,140,0.1)",
  },
  {
    title: "Daromad (mln so'm)",
    value: "1,240",
    change: "8%",
    positive: false,
    icon: TrendingUp,
    iconColor: "#FFBD21",
    iconBg: "rgba(255,189,33,0.1)",
  },
];

const recentActivities = [
  { user: "Alisher Karimov", action: "Yangi hisobot yukladi", time: "10 daqiqa oldin", type: "success" },
  { user: "Malika Yusupova", action: "KPI baholash o'zgartirildi", time: "32 daqiqa oldin", type: "warning" },
  { user: "Bobur Toshmatov", action: "Xodim qo'shildi", time: "1 soat oldin", type: "primary" },
  { user: "Dilnoza Rahimova", action: "Hisobot tasdiqlandi", time: "2 soat oldin", type: "success" },
  { user: "Sanjar Umarov", action: "Buyurtma bekor qilindi", time: "3 soat oldin", type: "danger" },
];

const topDepartments = [
  { name: "IT Bo'limi", head: "Alisher Karimov", employees: 42, kpi: 94, trend: true },
  { name: "Moliya Bo'limi", head: "Nodira Hasanova", employees: 18, kpi: 89, trend: true },
  { name: "Marketing", head: "Jasur Mirzayev", employees: 25, kpi: 82, trend: false },
  { name: "HR Bo'limi", head: "Shahnoza Tosheva", employees: 12, kpi: 91, trend: true },
  { name: "Ishlab chiqarish", head: "Ulugbek Saidov", employees: 67, kpi: 78, trend: false },
];

const tasks = [
  { title: "Q2 hisobotini tayyorlash", due: "Bugun", priority: "danger", done: false },
  { title: "Yangi xodimlar onboardingi", due: "Ertaga", priority: "warning", done: false },
  { title: "KPI maqsadlarini yangilash", due: "15 May", priority: "primary", done: true },
  { title: "IT bo'limi audit", due: "20 May", priority: "purple", done: false },
];

const activityColors: Record<string, string> = {
  success: "#00C48C",
  warning: "#FFBD21",
  primary: "#3F8CFF",
  danger: "#FF5C5C",
};

export default function SuperadminDashboard() {
  return (
    <div>
      <Header
        title="Bosh sahifa"
        subtitle="Bugun, 12 May 2026"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Top Departments - spans 2 cols */}
        <div
          className="col-span-2 p-6"
          style={{
            background: "#FFFFFF",
            boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
            borderRadius: 24,
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
              Bo'limlar reytingi
            </h2>
            <a
              href="/superadmin/bolimlar"
              className="flex items-center gap-1 text-sm font-bold"
              style={{ color: "#3F8CFF" }}
            >
              Barchasi <ArrowRight size={14} />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F4F9FD" }}>
                  {["Bo'lim", "Rahbar", "Xodimlar", "KPI", "Holat"].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-3 text-xs font-bold uppercase"
                      style={{ color: "#91929E", letterSpacing: "0.05em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topDepartments.map((dept, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid #F4F9FD" }}
                    className="hover:bg-[#F4F9FD] transition-colors"
                  >
                    <td className="py-4 font-bold text-sm" style={{ color: "#0A1629" }}>
                      {dept.name}
                    </td>
                    <td className="py-4 text-sm" style={{ color: "#7D8592" }}>
                      {dept.head}
                    </td>
                    <td className="py-4 text-sm font-bold" style={{ color: "#0A1629" }}>
                      {dept.employees}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 h-2 rounded-full overflow-hidden"
                          style={{ background: "#F4F9FD", maxWidth: 80 }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${dept.kpi}%`,
                              background: dept.kpi >= 85 ? "#00C48C" : dept.kpi >= 75 ? "#FFBD21" : "#FF5C5C",
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold" style={{ color: "#0A1629" }}>
                          {dept.kpi}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge
                        label={dept.trend ? "Yuqori" : "Tushgan"}
                        variant={dept.trend ? "success" : "danger"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-5">
          {/* Tasks */}
          <div
            className="p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
                Vazifalar
              </h2>
              <span
                className="text-xs font-bold px-2 py-1"
                style={{ color: "#3F8CFF", background: "rgba(63,140,255,0.1)", borderRadius: 8 }}
              >
                {tasks.filter((t) => !t.done).length} qolgan
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      background: task.done ? "rgba(0,196,140,0.1)" : "rgba(63,140,255,0.1)",
                      border: `2px solid ${task.done ? "#00C48C" : "#3F8CFF"}`,
                    }}
                  >
                    {task.done && <CheckCircle2 size={12} style={{ color: "#00C48C" }} />}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: task.done ? "#91929E" : "#0A1629",
                        textDecoration: task.done ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={11} style={{ color: "#91929E" }} />
                      <span className="text-xs" style={{ color: "#91929E" }}>
                        {task.due}
                      </span>
                      <Badge label="Muhim" variant={task.priority as never} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Stats */}
          <div
            className="p-6"
            style={{
              background: "#3F8CFF",
              boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
              borderRadius: 24,
            }}
          >
            <h3 className="font-bold text-white mb-4">Tezkor statistika</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: "Faol xodimlar", value: "231 / 248", pct: 93 },
                { label: "Bajarilgan topshiriqlar", value: "142 / 180", pct: 79 },
                { label: "KPI maqsad", value: "87 / 100", pct: 87 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-white opacity-80">{item.label}</span>
                    <span className="text-xs font-bold text-white">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.pct}%`, background: "#FFFFFF" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div
        className="mt-5 p-6"
        style={{
          background: "#FFFFFF",
          boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
          borderRadius: 24,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
            So'nggi faoliyat
          </h2>
          <button style={{ color: "#91929E" }}>
            <MoreHorizontal size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {recentActivities.map((act, i) => (
            <div key={i} className="flex items-center gap-4">
              <div
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                style={{
                  background: activityColors[act.type],
                  borderRadius: 12,
                }}
              >
                {act.user.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                  {act.user}
                </p>
                <p className="text-xs" style={{ color: "#91929E" }}>
                  {act.action}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {act.type === "danger" ? (
                  <AlertCircle size={14} style={{ color: "#FF5C5C" }} />
                ) : (
                  <CheckCircle2 size={14} style={{ color: activityColors[act.type] }} />
                )}
                <span className="text-xs" style={{ color: "#91929E" }}>
                  {act.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
