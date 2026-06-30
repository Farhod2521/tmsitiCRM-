import Header from "@/components/layout/Header";
import { Settings, Shield, Bell, Palette, Globe, Key, ChevronRight } from "lucide-react";

const settingGroups = [
  {
    title: "Profil sozlamalari",
    icon: Settings,
    color: "#3F8CFF",
    bg: "rgba(63,140,255,0.1)",
    items: ["Shaxsiy ma'lumotlar", "Parolni o'zgartirish", "Ikki bosqichli autentifikatsiya"],
  },
  {
    title: "Xavfsizlik",
    icon: Shield,
    color: "#00C48C",
    bg: "rgba(0,196,140,0.1)",
    items: ["Kirish tarixi", "Faol seanslar", "Maxfiylik sozlamalari"],
  },
  {
    title: "Bildirishnomalar",
    icon: Bell,
    color: "#FFBD21",
    bg: "rgba(255,189,33,0.1)",
    items: ["Email bildirishnomalar", "SMS bildirishnomalar", "Tizim xabarlari"],
  },
  {
    title: "Ko'rinish",
    icon: Palette,
    color: "#6D5DD3",
    bg: "rgba(109,93,211,0.1)",
    items: ["Rang sxemasi", "Til sozlamalari", "Fon rasmi"],
  },
  {
    title: "Tizim",
    icon: Globe,
    color: "#15C0E6",
    bg: "rgba(21,192,230,0.1)",
    items: ["Ma'lumotlar zaxirasi", "Integratsiyalar", "API kalitlari"],
  },
  {
    title: "Rollar va huquqlar",
    icon: Key,
    color: "#FF5C5C",
    bg: "rgba(255,92,92,0.1)",
    items: ["Foydalanuvchi rollari", "Ruxsatlar", "Audit jurnali"],
  },
];

export default function SozlamalarPage() {
  return (
    <div>
      <Header title="Sozlamalar" subtitle="Tizim va foydalanuvchi sozlamalari" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {settingGroups.map((group) => (
          <div
            key={group.title}
            className="p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0px 6px 58px rgba(196, 203, 214, 0.103611)",
              borderRadius: 24,
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ background: group.bg, borderRadius: 14 }}
              >
                <group.icon size={22} style={{ color: group.color }} />
              </div>
              <h3 className="font-bold" style={{ color: "#0A1629" }}>
                {group.title}
              </h3>
            </div>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item}>
                  <button
                    className="w-full flex items-center justify-between p-3 text-sm font-bold text-left transition-all hover:pl-4"
                    style={{
                      color: "#7D8592",
                      background: "#F4F9FD",
                      borderRadius: 12,
                    }}
                  >
                    {item}
                    <ChevronRight size={16} style={{ color: "#91929E" }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
