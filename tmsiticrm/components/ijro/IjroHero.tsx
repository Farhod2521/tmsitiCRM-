"use client";

/** Ijro sahifalari banneri: chapda to'q ko'k fon va sarlavha, o'ngda bino va bayroq rasmi. */
export default function IjroHero({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={{ borderRadius: 22, boxShadow: "0 10px 30px rgba(16,40,90,0.18)" }}>
      {/* Rasm yuqoridan (bayroq ko'rinadigan qilib) joylashtiriladi */}
      <div className="absolute inset-0" style={{ backgroundImage: "url(/ijro-hero.jpg)", backgroundSize: "cover", backgroundPosition: "right 12%" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #0B2A5B 0%, rgba(11,42,91,0.94) 30%, rgba(11,42,91,0.55) 55%, rgba(11,42,91,0.05) 80%)" }} />
      <div className="relative px-5 sm:px-7 pt-6 sm:pt-7 pb-5 sm:pb-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-2xl sm:text-[30px] leading-tight text-white">{title}</h1>
            {subtitle && <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.78)" }}>{subtitle}</p>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Banner ichidagi kichik statistika kartochkasi (shaffof oyna uslubida). */
export function HeroStat({ icon: Icon, label, value, color, note }: {
  icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: number | string; color: string; note?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 min-w-0"
      style={{ background: "rgba(11,42,91,0.45)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 14, backdropFilter: "blur(8px)" }}>
      <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center" style={{ background: color, borderRadius: 10 }}>
        <Icon size={17} color="#FFFFFF" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-xl font-bold leading-none text-white">{value}</span>
          {note}
        </span>
        <span className="block text-[11.5px] leading-tight mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>{label}</span>
      </span>
    </div>
  );
}
