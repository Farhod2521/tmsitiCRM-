import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  BarChart3,
  FileText,
  Download,
  Eye,
  Plus,
  Filter,
  TrendingUp,
  TrendingDown,
  Calendar,
  MoreHorizontal,
} from "lucide-react";

const reports = [
  {
    id: 1,
    title: "Oylik moliyaviy hisobot",
    type: "Moliya",
    period: "Aprel 2026",
    author: "Nodira Hasanova",
    date: "01 May 2026",
    status: "Tasdiqlangan",
    size: "2.4 MB",
    color: "#00C48C",
  },
  {
    id: 2,
    title: "HR faoliyat hisoboti",
    type: "HR",
    period: "Aprel 2026",
    author: "Shahnoza Tosheva",
    date: "02 May 2026",
    status: "Ko'rib chiqilmoqda",
    size: "1.8 MB",
    color: "#6D5DD3",
  },
  {
    id: 3,
    title: "IT bo'limi texnik hisobot",
    type: "IT",
    period: "Aprel 2026",
    author: "Alisher Karimov",
    date: "03 May 2026",
    status: "Tasdiqlangan",
    size: "3.1 MB",
    color: "#3F8CFF",
  },
  {
    id: 4,
    title: "Marketing kampaniya tahlili",
    type: "Marketing",
    period: "Q1 2026",
    author: "Jasur Mirzayev",
    date: "05 May 2026",
    status: "Qoralama",
    size: "5.2 MB",
    color: "#FFBD21",
  },
  {
    id: 5,
    title: "Ishlab chiqarish hisoboti",
    type: "Ishlab chiqarish",
    period: "Aprel 2026",
    author: "Ulugbek Saidov",
    date: "06 May 2026",
    status: "Tasdiqlangan",
    size: "4.7 MB",
    color: "#15C0E6",
  },
  {
    id: 6,
    title: "Yillik strategik hisobot",
    type: "Rahbariyat",
    period: "2025 yil",
    author: "Super Admin",
    date: "10 May 2026",
    status: "Ko'rib chiqilmoqda",
    size: "8.3 MB",
    color: "#FF5C5C",
  },
];

const statusVariant: Record<string, "success" | "warning" | "gray"> = {
  Tasdiqlangan: "success",
  "Ko'rib chiqilmoqda": "warning",
  Qoralama: "gray",
};

const summaryData = [
  { label: "Jami hisobotlar", value: "84", trend: "+12", up: true, icon: FileText, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
  { label: "Tasdiqlangan", value: "61", trend: "+8", up: true, icon: BarChart3, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
  { label: "Kutilmoqda", value: "18", trend: "-3", up: false, icon: Calendar, color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
  { label: "Qoralamalar", value: "5", trend: "+1", up: true, icon: FileText, color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
];

export default function HisobotlarPage() {
  return (
    <div>
      <Header title="Hisobotlar" subtitle="Tashkilot hisobotlari va tahlillar" />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        {summaryData.map((s) => (
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
              <span
                className="flex items-center gap-1 text-xs font-bold px-2 py-1"
                style={{
                  color: s.up ? "#00C48C" : "#FF5C5C",
                  background: s.up ? "rgba(0,196,140,0.1)" : "rgba(255,92,92,0.1)",
                  borderRadius: 8,
                }}
              >
                {s.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {s.trend}
              </span>
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

      {/* Filters & Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {["Barchasi", "Moliya", "HR", "IT", "Marketing"].map((tab, i) => (
            <button
              key={tab}
              className="px-4 py-2 text-sm font-bold transition-all"
              style={{
                background: i === 0 ? "#3F8CFF" : "#FFFFFF",
                color: i === 0 ? "#FFFFFF" : "#7D8592",
                borderRadius: 10,
                boxShadow: i === 0 ? "0px 6px 12px rgba(63, 140, 255, 0.263686)" : "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              }}
            >
              {tab}
            </button>
          ))}
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold"
            style={{
              background: "#FFFFFF",
              color: "#7D8592",
              borderRadius: 10,
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
            }}
          >
            <Filter size={14} />
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
          Hisobot yaratish
        </button>
      </div>

      {/* Reports Table */}
      <div
        className="p-6"
        style={{
          background: "#FFFFFF",
          boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
          borderRadius: 24,
        }}
      >
        <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
              {["Hisobot nomi", "Turi", "Davr", "Muallif", "Sana", "Hajm", "Holat", "Amallar"].map((h) => (
                <th
                  key={h}
                  className="text-left pb-4 text-xs font-bold uppercase"
                  style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 12 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                style={{ borderBottom: "1px solid #F4F9FD" }}
                className="hover:bg-[#F4F9FD] transition-colors"
              >
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
                      style={{ background: `${report.color}18`, borderRadius: 12 }}
                    >
                      <FileText size={18} style={{ color: report.color }} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                      {report.title}
                    </p>
                  </div>
                </td>
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <span
                    className="text-xs font-bold px-2 py-1"
                    style={{
                      color: report.color,
                      background: `${report.color}18`,
                      borderRadius: 8,
                    }}
                  >
                    {report.type}
                  </span>
                </td>
                <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 12 }}>
                  {report.period}
                </td>
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 flex items-center justify-center font-bold text-white text-xs"
                      style={{ background: report.color, borderRadius: 8 }}
                    >
                      {report.author.charAt(0)}
                    </div>
                    <span className="text-sm" style={{ color: "#7D8592" }}>
                      {report.author}
                    </span>
                  </div>
                </td>
                <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 12 }}>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {report.date}
                  </div>
                </td>
                <td className="py-4 text-sm font-bold" style={{ color: "#0A1629", paddingRight: 12 }}>
                  {report.size}
                </td>
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <Badge label={report.status} variant={statusVariant[report.status]} />
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(63,140,255,0.1)", borderRadius: 8 }}
                    >
                      <Eye size={14} style={{ color: "#3F8CFF" }} />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(0,196,140,0.1)", borderRadius: 8 }}
                    >
                      <Download size={14} style={{ color: "#00C48C" }} />
                    </button>
                    <button style={{ color: "#91929E" }}>
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between flex-wrap gap-3 mt-5">
          <p className="text-sm" style={{ color: "#91929E" }}>
            Jami 84 hisobotdan 1-6 ko'rsatilmoqda
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, "...", 14].map((p, i) => (
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

      {/* Recent Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div
          className="p-6"
          style={{
            background: "#FFFFFF",
            boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
            borderRadius: 24,
          }}
        >
          <h3 className="font-bold mb-4" style={{ color: "#0A1629" }}>
            Bo'limlar bo'yicha hisobotlar
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { name: "Moliya", count: 24, color: "#00C48C" },
              { name: "IT Bo'limi", count: 18, color: "#3F8CFF" },
              { name: "Ishlab chiqarish", count: 16, color: "#15C0E6" },
              { name: "HR", count: 14, color: "#6D5DD3" },
              { name: "Marketing", count: 12, color: "#FFBD21" },
            ].map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm font-bold w-28" style={{ color: "#7D8592" }}>
                  {d.name}
                </span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#F4F9FD" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.count / 24) * 100}%`, background: d.color }}
                  />
                </div>
                <span className="text-sm font-bold w-8 text-right" style={{ color: "#0A1629" }}>
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="p-6"
          style={{
            background: "#3F8CFF",
            boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
            borderRadius: 24,
          }}
        >
          <h3 className="font-bold text-white mb-4">Hisobot holatlari</h3>
          <div className="flex items-center justify-center gap-8 h-32">
            {[
              { label: "Tasdiqlangan", pct: 73, color: "#FFFFFF" },
              { label: "Kutilmoqda", pct: 21, color: "rgba(255,255,255,0.5)" },
              { label: "Qoralama", pct: 6, color: "rgba(255,255,255,0.25)" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{
                    background: item.color,
                    color: item.color === "#FFFFFF" ? "#3F8CFF" : "#FFFFFF",
                  }}
                >
                  {item.pct}%
                </div>
                <span className="text-xs text-white opacity-80 text-center">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 text-center" style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12 }}>
            <p className="text-white font-bold">84 ta hisobot jami</p>
            <p className="text-white text-xs opacity-75">2026 yil, 1-apreldan buyon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
