"use client";

import { Menu } from "lucide-react";

interface Props {
  accent: string;
  letter: string;
  onOpen: () => void;
}

export default function MobileTopBar({ accent, letter, onOpen }: Props) {
  return (
    <div
      className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{ height: 56, background: "#FFFFFF", boxShadow: "0px 2px 16px rgba(196,203,214,0.3)" }}
    >
      <button
        onClick={onOpen}
        className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        style={{ background: "#F4F9FD", borderRadius: 10 }}
      >
        <Menu size={20} style={{ color: accent }} />
      </button>

      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 flex items-center justify-center text-white font-bold text-xs"
          style={{ background: accent, borderRadius: 8 }}
        >
          {letter}
        </div>
        <span className="font-bold text-sm" style={{ color: "#0A1629" }}>TMSITI</span>
      </div>

      <div style={{ width: 36 }} />
    </div>
  );
}
