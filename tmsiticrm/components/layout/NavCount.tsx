"use client";

/** Menyu bandi yonidagi qizil son (bildirishnomalar). 0 bo'lsa ko'rinmaydi. */
export default function NavCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[11px] font-bold text-white"
      style={{ background: "#FF5C5C", borderRadius: 11 }}
      aria-label={`${n} ta yangi`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
