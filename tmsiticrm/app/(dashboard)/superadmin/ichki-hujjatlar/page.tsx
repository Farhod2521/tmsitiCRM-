"use client";

import Header from "@/components/layout/Header";
import InternalDocZamdirektorInboxTab from "@/components/internal-docs/InternalDocZamdirektorInboxTab";

export default function IchkiHujjatlarPage() {
  return (
    <div>
      <Header title="Xodim hujjatlari" subtitle="Bo'lim boshliqlaridan tasdiqlanib kelgan ichki hujjatlar" />
      <InternalDocZamdirektorInboxTab />
    </div>
  );
}
