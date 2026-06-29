import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, MoreHorizontal } from "lucide-react";

const transactions = [
  { id: "TXN-001", desc: "IT jihozlar xaridi", dept: "IT", amount: -45000000, date: "10 May", type: "expense", status: "Tasdiqlangan" },
  { id: "TXN-002", desc: "Xizmat ko'rsatish daromadi", dept: "Marketing", amount: 120000000, date: "09 May", type: "income", status: "Tasdiqlangan" },
  { id: "TXN-003", desc: "Xodimlar ish haqi", dept: "HR", amount: -380000000, date: "05 May", type: "expense", status: "Tasdiqlangan" },
  { id: "TXN-004", desc: "Loyiha shartnoma", dept: "Rahbariyat", amount: 250000000, date: "03 May", type: "income", status: "Kutilmoqda" },
  { id: "TXN-005", desc: "Ofis ijarasi", dept: "Rahbariyat", amount: -15000000, date: "01 May", type: "expense", status: "Tasdiqlangan" },
];

function formatMoney(amount: number) {
  const abs = Math.abs(amount / 1000000);
  return `${amount > 0 ? "+" : "-"}${abs.toFixed(1)} mln so'm`;
}

export default function MoliyaPage() {
  return (
    <div>
      <Header title="Moliya" subtitle="Moliyaviy ko'rsatkichlar va tranzaksiyalar" />

      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: "Jami daromad", value: "1,240 mln", trend: "+8%", up: true, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
          { label: "Jami xarajat", value: "890 mln", trend: "+3%", up: false, color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
          { label: "Sof foyda", value: "350 mln", trend: "+12%", up: true, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
          { label: "Byudjet balansi", value: "610 mln", trend: "+5%", up: true, color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
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
                <Wallet size={22} style={{ color: s.color }} />
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
            <p className="text-2xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
            <p className="text-sm mt-1" style={{ color: "#91929E" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div
        className="p-6"
        style={{
          background: "#FFFFFF",
          boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
          borderRadius: 24,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold" style={{ color: "#0A1629" }}>So'nggi tranzaksiyalar</h3>
          <button style={{ color: "#91929E" }}><MoreHorizontal size={20} /></button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
              {["ID", "Tavsif", "Bo'lim", "Summa", "Sana", "Holat", ""].map((h) => (
                <th key={h} className="text-left pb-3 text-xs font-bold uppercase" style={{ color: "#91929E", paddingRight: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #F4F9FD" }} className="hover:bg-[#F4F9FD] transition-colors">
                <td className="py-4 text-xs font-bold" style={{ color: "#91929E", paddingRight: 12 }}>{t.id}</td>
                <td className="py-4 font-bold text-sm" style={{ color: "#0A1629", paddingRight: 12 }}>{t.desc}</td>
                <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 12 }}>{t.dept}</td>
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <div className="flex items-center gap-1">
                    {t.type === "income" ? (
                      <ArrowUpRight size={14} style={{ color: "#00C48C" }} />
                    ) : (
                      <ArrowDownLeft size={14} style={{ color: "#FF5C5C" }} />
                    )}
                    <span className="font-bold text-sm" style={{ color: t.type === "income" ? "#00C48C" : "#FF5C5C" }}>
                      {formatMoney(t.amount)}
                    </span>
                  </div>
                </td>
                <td className="py-4 text-sm" style={{ color: "#7D8592", paddingRight: 12 }}>{t.date}</td>
                <td className="py-4" style={{ paddingRight: 12 }}>
                  <Badge label={t.status} variant={t.status === "Tasdiqlangan" ? "success" : "warning"} />
                </td>
                <td className="py-4"><button style={{ color: "#91929E" }}><MoreHorizontal size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
