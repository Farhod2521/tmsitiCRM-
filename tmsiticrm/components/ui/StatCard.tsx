import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  iconColor = "#3F8CFF",
  iconBg = "rgba(63,140,255,0.1)",
}: StatCardProps) {
  return (
    <div
      className="p-6 flex flex-col gap-4"
      style={{
        background: "#FFFFFF",
        boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
        borderRadius: 24,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-12 h-12 flex items-center justify-center"
          style={{ background: iconBg, borderRadius: 14 }}
        >
          <Icon size={22} style={{ color: iconColor }} />
        </div>
        {change && (
          <span
            className="text-xs font-bold px-2 py-1"
            style={{
              color: positive ? "#00C48C" : "#FF5C5C",
              background: positive
                ? "rgba(0,196,140,0.1)"
                : "rgba(255,92,92,0.1)",
              borderRadius: 8,
            }}
          >
            {positive ? "▲" : "▼"} {change}
          </span>
        )}
      </div>
      <div>
        <p
          className="text-3xl font-bold"
          style={{ color: "#0A1629" }}
        >
          {value}
        </p>
        <p className="text-sm mt-1" style={{ color: "#91929E" }}>
          {title}
        </p>
      </div>
    </div>
  );
}
