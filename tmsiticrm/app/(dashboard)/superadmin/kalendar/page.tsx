import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { CalendarDays, Clock, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const events = [
  { time: "09:00", title: "Rahbariyat yig'ilishi", dept: "Rahbariyat", duration: "1 soat", color: "#3F8CFF" },
  { time: "11:00", title: "IT bo'limi sprint planlamasi", dept: "IT", duration: "2 soat", color: "#6D5DD3" },
  { time: "14:00", title: "Yangi xodimlar onboarding", dept: "HR", duration: "3 soat", color: "#00C48C" },
  { time: "16:30", title: "Moliya hisoboti ko'rib chiqish", dept: "Moliya", duration: "1 soat", color: "#FFBD21" },
];

const days = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const dates = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, 31, null, null],
];

export default function KalendarPage() {
  return (
    <div>
      <Header title="Kalendar" subtitle="Yig'ilishlar va tadbirlar rejasi" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar Widget */}
        <div
          className="p-6"
          style={{
            background: "#FFFFFF",
            boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
            borderRadius: 24,
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold" style={{ color: "#0A1629" }}>
              May 2026
            </h3>
            <div className="flex gap-2">
              <button
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: "#F4F9FD", borderRadius: 8 }}
              >
                <ChevronLeft size={16} style={{ color: "#7D8592" }} />
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: "#F4F9FD", borderRadius: 8 }}
              >
                <ChevronRight size={16} style={{ color: "#7D8592" }} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-bold py-1"
                style={{ color: "#91929E" }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dates.flat().map((date, i) => (
              <div
                key={i}
                className="aspect-square flex items-center justify-center text-sm font-bold cursor-pointer transition-all hover:scale-110"
                style={{
                  background: date === 12 ? "#3F8CFF" : "transparent",
                  color: date === 12 ? "#FFFFFF" : date ? "#0A1629" : "transparent",
                  borderRadius: date === 12 ? 10 : 0,
                  boxShadow: date === 12 ? "0px 6px 12px rgba(63, 140, 255, 0.263686)" : "none",
                }}
              >
                {date}
              </div>
            ))}
          </div>

          <button
            className="w-full mt-5 flex items-center justify-center gap-2 py-3 font-bold text-sm text-white"
            style={{
              background: "#3F8CFF",
              borderRadius: 14,
              boxShadow: "0px 6px 12px rgba(63, 140, 255, 0.263686)",
            }}
          >
            <Plus size={16} />
            Tadbir qo'shish
          </button>
        </div>

        {/* Today's Events */}
        <div
          className="col-span-2 p-6"
          style={{
            background: "#FFFFFF",
            boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
            borderRadius: 24,
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold" style={{ color: "#0A1629" }}>
              Bugungi tadbirlar — 12 May 2026
            </h3>
            <Badge label={`${events.length} tadbir`} variant="primary" />
          </div>

          <div className="flex flex-col gap-4">
            {events.map((event, i) => (
              <div
                key={i}
                className="flex gap-4 p-4"
                style={{
                  background: "#F4F9FD",
                  borderRadius: 16,
                  borderLeft: `4px solid ${event.color}`,
                }}
              >
                <div className="flex-shrink-0 text-center">
                  <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                    {event.time}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={11} style={{ color: "#91929E" }} />
                    <p className="text-xs" style={{ color: "#91929E" }}>
                      {event.duration}
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: "#0A1629" }}>
                    {event.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#91929E" }}>
                    {event.dept}
                  </p>
                </div>
                <div
                  className="w-3 h-3 rounded-full self-center flex-shrink-0"
                  style={{ background: event.color }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
