"use client";

import Header from "@/components/layout/Header";
import XodimlarBallBerish from "@/components/ball/XodimlarBallBerish";

export default function DirektorBallBerish() {
  return (
    <div>
      <Header
        title="Xodimlar ball berish"
        subtitle="Direktor — barcha xodimlar uchun to'liq ball boshqaruvi"
      />
      <XodimlarBallBerish mode="direktor" />
    </div>
  );
}
