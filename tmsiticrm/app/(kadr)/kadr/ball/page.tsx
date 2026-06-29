"use client";

import Header from "@/components/layout/Header";
import XodimlarBallBerish from "@/components/ball/XodimlarBallBerish";

export default function KadrBallPage() {
  return (
    <div>
      <Header
        title="Xodimlar ball berish"
        subtitle="Kadrlar bo'limi — har bir xodimga kadr bali qo'yish (0–25)"
      />
      <XodimlarBallBerish mode="kadr" />
    </div>
  );
}
