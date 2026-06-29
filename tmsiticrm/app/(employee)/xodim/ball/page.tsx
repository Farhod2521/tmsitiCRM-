"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import XodimlarBallBerish, { BallMode } from "@/components/ball/XodimlarBallBerish";
import { getUser } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const MODE_CONFIG: Record<string, { mode: BallMode; subtitle: string }> = {
  kadr: { mode:"kadr", subtitle:"Kadrlar bo'limi — har bir xodimga kadr bali qo'yish (0–25)" },
  ijro: { mode:"ijro", subtitle:"Ijro nazorati — har bir xodimga ijro bali qo'yish (0–10)"  },
};

export default function XodimBallPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<{ mode: BallMode; subtitle: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/login"); return; }
    const c = MODE_CONFIG[u.role];
    if (!c) { router.replace("/xodim/kpi"); return; }
    setCfg(c);
  }, [router]);

  if (!cfg) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin" style={{ color:"#3F8CFF" }}/>
      </div>
    );
  }

  return (
    <div>
      <Header title="Xodimlar ball berish" subtitle={cfg.subtitle}/>
      <XodimlarBallBerish mode={cfg.mode}/>
    </div>
  );
}
