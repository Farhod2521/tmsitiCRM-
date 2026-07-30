"use client";

import { useState } from "react";
import { Send, X, KeyRound, Loader2 } from "lucide-react";
import { openTelegramLink } from "@/lib/telegram";

export default function TelegramLinkPrompt({ onClose }: { onClose: () => void }) {
  const [opening, setOpening] = useState(false);

  async function handleClick() {
    setOpening(true);
    try {
      await openTelegramLink();
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[420px] p-7 relative text-center"
        style={{ background: "#FFFFFF", borderRadius: 28, boxShadow: "0px 30px 80px rgba(0,0,0,0.25)" }}>

        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center"
          style={{ background: "#F4F9FD", borderRadius: 10 }}>
          <X size={15} style={{ color: "#91929E" }} />
        </button>

        <div className="w-16 h-16 mx-auto flex items-center justify-center mb-4"
          style={{ background: "rgba(34,158,217,0.1)", borderRadius: 20 }}>
          <KeyRound size={28} style={{ color: "#229ED9" }} />
        </div>

        <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
          Telefon raqam va parolingizni yangilang
        </h2>
        <p className="text-sm mt-2" style={{ color: "#7D8592" }}>
          Xavfsizlik uchun hisobingizni Telegram orqali tasdiqlashingiz kerak.
          Bu bir necha soniya vaqt oladi.
        </p>

        <button onClick={handleClick} disabled={opening}
          className="w-full mt-6 py-3.5 flex items-center justify-center gap-2 font-bold text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          style={{ background: "#229ED9", borderRadius: 14, boxShadow: "0px 6px 12px rgba(34,158,217,0.3)" }}>
          {opening ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Yangilash
        </button>

        <button onClick={onClose}
          className="w-full mt-2.5 py-2.5 font-bold text-xs"
          style={{ color: "#91929E" }}>
          Keyinroq
        </button>
      </div>
    </div>
  );
}
