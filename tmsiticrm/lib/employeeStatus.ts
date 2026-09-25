// PATCH /employees/{id}/set-status javobi (EmployeeOut'ning holatga oid qismi).
// Boshlanish sanasi kelajakda bo'lsa — xodim joriy holatida qoladi, yangi holat
// planned_* maydonlarida turadi va sanasi kelganda backend o'zi o'tkazadi.
export interface StatusResult {
  status: string;
  status_date_from: string | null;
  status_date_to: string | null;
  is_active: boolean;
  planned_status: string | null;
  planned_from: string | null;
  planned_to: string | null;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" bugundan keyinmi (holat rejalashtiriladi, darhol o'zgarmaydi). */
export function isFutureDate(iso: string | null | undefined): boolean {
  return !!iso && iso > todayIso();
}

/** Ro'yxatdagi xodimni set-status javobi bilan yangilash. */
export function applyStatusResult<T extends object>(emp: T, res: StatusResult): T {
  return {
    ...emp,
    status: res.status,
    status_date_from: res.status_date_from,
    status_date_to: res.status_date_to,
    is_active: res.is_active,
    planned_status: res.planned_status,
    planned_from: res.planned_from,
    planned_to: res.planned_to,
  };
}
