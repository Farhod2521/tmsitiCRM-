"use client";

import Header from "@/components/layout/Header";
import XodimlarBallBerish from "@/components/ball/XodimlarBallBerish";

export default function IjroBallPage() {
  return (
    <div>
      <Header
        title="Xodimlar ball berish"
        subtitle="Ijro nazorati — har bir xodimga ijro bali qo'yish (0–10)"
      />
      <XodimlarBallBerish mode="ijro" />
    </div>
  );
}
