// Davomat arizasi bosqichlari: bo'lim boshlig'i -> kadr -> zamdirektor.
const STAGE_ORDER: Record<string, number> = {
  bolim_kutilmoqda: 0,
  kutilmoqda: 1,
  kadr_tasdiqladi: 2,
};

/** Ariza hali oldingi bosqichda turgan bo'lsa (navbat bu rolga kelmagan) —
 *  kim kutilayotganini qaytaradi; aks holda null. */
export function waitingFor(status: string, actionStatus: string): string | null {
  const s = STAGE_ORDER[status];
  const a = STAGE_ORDER[actionStatus];
  if (s === undefined || a === undefined || s >= a) return null;
  return status === "bolim_kutilmoqda" ? "Bo'lim boshlig'i hali tasdiqlamagan" : "Kadr hali tasdiqlamagan";
}
