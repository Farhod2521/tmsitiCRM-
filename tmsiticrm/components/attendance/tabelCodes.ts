// "Xodimlar davomati" jadvali kodlari va ranglari (jadval va tahrirlash oynasi uchun umumiy)
export const CODE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  "8":  { color: "#00A578", bg: "rgba(0,196,140,0.1)",    label: "Kelgan" },
  "X":  { color: "#B8C2D6", bg: "#F4F9FD",                label: "Dam olish kuni" },
  "MT": { color: "#B4780C", bg: "rgba(255,189,33,0.15)",  label: "Mehnat ta'tili" },
  "O'": { color: "#6D5DD3", bg: "rgba(109,93,211,0.12)",  label: "O'quv ta'tili" },
  "K":  { color: "#3F8CFF", bg: "rgba(63,140,255,0.12)",  label: "Xizmat safari" },
  "B":  { color: "#FF5C5C", bg: "rgba(255,92,92,0.12)",   label: "Bolnichniy" },
  "Д":  { color: "#91929E", bg: "rgba(145,146,158,0.12)", label: "Dekret" },
  "BY": { color: "#E0457B", bg: "rgba(224,69,123,0.1)",   label: "Bayram" },
};

// Kadr qo'lda tuzatgan kun belgisi
export const OVERRIDE_COLOR = "#6D5DD3";
