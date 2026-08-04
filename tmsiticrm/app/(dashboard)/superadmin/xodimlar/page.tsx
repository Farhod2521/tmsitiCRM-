"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import {
  Users, Plus, Search, Phone, Pencil, Trash2, X, Loader2,
  Download, KeyRound, ChevronDown, CheckCircle2, Palmtree, Baby, UserCheck,
  Building2, FlaskConical,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiDept { id: number; name: string; dept_type: string; }
interface ApiEmp {
  id: number; full_name: string; position: string;
  department_id: number | null; work_rate: number; phone: string;
  role: string; status: string; is_active: boolean;
  department?: ApiDept | null;
  work_location: string;
  has_photo?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin", direktor: "Direktor", zamdirektor: "Zamdirektor",
  bolim_boshligi: "Bo'lim boshlig'i", boshqarma_boshligi: "Boshqarma boshlig'i",
  xodim: "Xodim", kadr: "Kadr vakili", ijro: "Ijro vakili",
};
const ROLE_BADGE: Record<string, "primary" | "warning" | "success" | "gray"> = {
  superadmin: "primary", direktor: "primary", zamdirektor: "primary",
  bolim_boshligi: "primary", boshqarma_boshligi: "primary",
  kadr: "warning", ijro: "success", xodim: "gray",
};
const STATUS_LABEL: Record<string, string> = {
  faol: "Faol", otpuska: "Otpuskada", dekret: "Dekretda",
};
// faol — yashil; otpuska/dekret — "faol emas"ni bildirib kulrang bo'ladi
const STATUS_BADGE: Record<string, "success" | "gray"> = {
  faol: "success", otpuska: "gray", dekret: "gray",
};

const STATUS_MENU = [
  { status: "faol",    label: "Faol holatga qaytarish", icon: UserCheck, color: "#00C48C", bg: "rgba(0,196,140,0.1)"  },
  { status: "otpuska", label: "Otpuskaga chiqarish",    icon: Palmtree,  color: "#7D8592", bg: "rgba(125,133,146,0.1)" },
  { status: "dekret",  label: "Dekretga chiqarish",     icon: Baby,      color: "#7D8592", bg: "rgba(125,133,146,0.1)" },
];

const WORK_LOCATION_MENU = [
  { value: "vazirlik",     label: "Vazirlik",     icon: Building2,     color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  { value: "labaratoriya", label: "Labaratoriya", icon: FlaskConical,  color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
];

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Holatni o'zgartirish dropdowni ───────────────────────────────────────────

function StatusMenu({ emp, onChanged }: { emp: ApiEmp; onChanged: (id: number, status: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function assign(status: string) {
    setSaving(true);
    try {
      await apiFetch(`/employees/${emp.id}/set-status`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged(emp.id, status);
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} className="hover:opacity-80 transition-opacity">
        <Badge label={STATUS_LABEL[emp.status] || emp.status} variant={STATUS_BADGE[emp.status] || "gray"} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-56 py-1.5"
          style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 12px 32px rgba(10,22,41,0.16)", border: "1px solid #F4F9FD" }}>
          {STATUS_MENU.filter(s => s.status !== emp.status).map(s => {
            const Icon = s.icon;
            return (
              <button key={s.status} onClick={() => assign(s.status)} disabled={saving}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8FAFF] transition-colors disabled:opacity-50">
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ background: s.bg, borderRadius: 8 }}>
                  {saving ? <Loader2 size={12} className="animate-spin" style={{ color: s.color }} /> : <Icon size={13} style={{ color: s.color }} />}
                </div>
                <span className="text-xs font-semibold text-left" style={{ color: "#0A1629" }}>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ish joyini o'zgartirish dropdowni ────────────────────────────────────────

function WorkLocationMenu({ emp, onChanged }: { emp: ApiEmp; onChanged: (id: number, work_location: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = WORK_LOCATION_MENU.find(w => w.value === emp.work_location) ?? WORK_LOCATION_MENU[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function assign(work_location: string) {
    setSaving(true);
    try {
      await apiFetch(`/employees/${emp.id}/set-work-location`, { method: "PATCH", body: JSON.stringify({ work_location }) });
      onChanged(emp.id, work_location);
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} disabled={saving}
        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-50"
        style={{ background: current.bg, color: current.color, borderRadius: 8 }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CurrentIcon size={12} />}
        {current.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-48 py-1.5"
          style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 12px 32px rgba(10,22,41,0.16)", border: "1px solid #F4F9FD" }}>
          {WORK_LOCATION_MENU.filter(w => w.value !== emp.work_location).map(w => {
            const Icon = w.icon;
            return (
              <button key={w.value} onClick={() => assign(w.value)} disabled={saving}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8FAFF] transition-colors disabled:opacity-50">
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ background: w.bg, borderRadius: 8 }}>
                  <Icon size={13} style={{ color: w.color }} />
                </div>
                <span className="text-xs font-semibold text-left" style={{ color: "#0A1629" }}>{w.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Xodim qo'shish / tahrirlash modali ───────────────────────────────────────

function EmpFormModal({ emp, depts, onClose, onSaved }: {
  emp: ApiEmp | null; depts: ApiDept[]; onClose: () => void; onSaved: (id: number, password: string | null) => void;
}) {
  const isEdit = !!emp;
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name:     emp?.full_name ?? "",
    position:      emp?.position ?? "",
    department_id: emp?.department_id ?? null as number | null,
    work_rate:     emp?.work_rate ?? 1.0,
    phone:         emp?.phone ?? "",
    role:          emp?.role ?? "xodim",
    password:      "",
  });

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !form.password) {
      setError("Yangi xodim uchun parol kiritish shart");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        position: form.position,
        department_id: form.department_id,
        work_rate: form.work_rate,
        phone: form.phone,
      };
      if (form.password) payload.password = form.password;
      if (isEdit) {
        await apiFetch(`/employees/${emp!.id}`, { method: "PUT", body: JSON.stringify(payload) });
        onSaved(emp!.id, form.password || null);
      } else {
        const created = await apiFetch<ApiEmp>("/employees/", { method: "POST", body: JSON.stringify({ ...payload, role: form.role }) });
        onSaved(created.id, form.password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,41,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(10,22,41,0.25)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #F4F9FD" }}>
          <h2 className="font-bold text-lg" style={{ color: "#0A1629" }}>
            {isEdit ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:opacity-70"
            style={{ background: "#F4F9FD", borderRadius: 10 }}>
            <X size={16} style={{ color: "#7D8592" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2 text-xs font-bold" style={{ background: "rgba(255,92,92,0.1)", color: "#FF5C5C", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Ism familiyasi *</label>
            <input required value={form.full_name} onChange={e => setF("full_name", e.target.value)}
              className="w-full px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Lavozimi *</label>
            <input required value={form.position} onChange={e => setF("position", e.target.value)}
              className="w-full px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
          </div>

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Bo'lim</label>
            <div className="relative">
              <select value={form.department_id ?? ""} onChange={e => setF("department_id", e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: form.department_id ? "#0A1629" : "#91929E" }}>
                <option value="">Tanlanmagan</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Telefon raqami (login) *</label>
              <input required value={form.phone} onChange={e => setF("phone", e.target.value)}
                placeholder="+998901234567" className="w-full px-4 py-3 text-sm font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            </div>
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Ish stavkasi</label>
              <input type="number" step="0.1" min="0" max="2" value={form.work_rate}
                onChange={e => setF("work_rate", Number(e.target.value))}
                className="w-full px-4 py-3 text-sm font-bold outline-none"
                style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>Boshlang'ich rol</label>
              <div className="relative">
                <select value={form.role} onChange={e => setF("role", e.target.value)}
                  className="w-full appearance-none px-4 py-3 text-sm font-bold outline-none"
                  style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }}>
                  {Object.entries(ROLE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "#91929E" }} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#91929E" }}>
              {isEdit ? "Yangi parol (o'zgartirish uchun to'ldiring)" : "Parol *"}
            </label>
            <input type="text" value={form.password} onChange={e => setF("password", e.target.value)}
              placeholder={isEdit ? "Bo'sh qoldirilsa, parol o'zgarmaydi" : "Parol kiriting"}
              className="w-full px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "#F4F9FD", borderRadius: 12, border: "1.5px solid #EEF2FF", color: "#0A1629" }} />
          </div>
        </form>

        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #F4F9FD" }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold"
            style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>
            Bekor qilish
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "#3F8CFF", borderRadius: 12 }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Asosiy sahifa ─────────────────────────────────────────────────────────────

export default function XodimlarPage() {
  const [employees, setEmployees] = useState<ApiEmp[]>([]);
  const [depts,      setDepts]    = useState<ApiDept[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [search,     setSearch]   = useState("");
  const [formEmp,    setFormEmp]  = useState<ApiEmp | null | "new">(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting,  setExporting]  = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);
  // Xodimlarning joriy (qaytarib olingan) parollari — faqat superadmin ko'radi.
  // Faqat migratsiyadan keyin yaratilgan/paroli o'zgartirilgan xodimlarda mavjud bo'ladi.
  const [passwords,  setPasswords]  = useState<Record<number, string | null>>({});
  // Rasmlar alohida, asosiy ro'yxatdan keyin (bosqichma-bosqich) yuklanadi —
  // aks holda har bir so'rovda barcha selfi-rasmlar og'irlik qilib sahifani sekinlashtiradi.
  const [photos, setPhotos] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadPhotos = useCallback((emps: ApiEmp[]) => {
    emps.filter(e => e.has_photo).forEach(e => {
      apiFetch<{ photo_base64: string | null }>(`/employees/${e.id}/photo`)
        .then(res => { if (res.photo_base64) setPhotos(prev => ({ ...prev, [e.id]: res.photo_base64! })); })
        .catch(() => {});
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, d, p] = await Promise.all([
        apiFetch<ApiEmp[]>("/employees/"),
        apiFetch<ApiDept[]>("/departments/"),
        apiFetch<{ id: number; password: string | null }[]>("/employees/passwords").catch(() => []),
      ]);
      loadPhotos(e);
      setEmployees(e);
      setDepts(d);
      setPasswords(Object.fromEntries(p.map(x => [x.id, x.password])));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("Xodimni o'chirishni tasdiqlaysizmi? Bu amalni orqaga qaytarib bo'lmaydi.")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/employees/${id}`, { method: "DELETE" });
      setEmployees(prev => prev.filter(e => e.id !== id));
      setToast("Xodim muvaffaqiyatli o'chirildi");
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xatolik");
    } finally {
      setDeletingId(null);
    }
  }

  function handleStatusChange(id: number, status: string) {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status, is_active: status === "faol" } : e));
  }

  function handleWorkLocationChange(id: number, work_location: string) {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, work_location } : e));
  }

  function handleFormSaved(id: number, password: string | null) {
    if (password) setPasswords(prev => ({ ...prev, [id]: password }));
    load();
  }

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase()) ||
    e.phone.includes(search)
  );

  const stats = [
    { label: "Jami xodimlar", value: employees.length, color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
    { label: "Faol xodimlar", value: employees.filter(e => e.status === "faol").length, color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
    { label: "Otpuska/Dekret", value: employees.filter(e => e.status !== "faol").length, color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
    { label: "Bo'limlar soni", value: depts.length, color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
  ];

  async function exportDocx() {
    setExporting(true);
    try {
      const {
        Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, WidthType, AlignmentType, ShadingType,
      } = await import("docx");

      const headerCells = ["#", "F.I.Sh.", "Lavozim", "Bo'lim", "Telefon", "Parol", "Rol", "Holat"];
      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: headerCells.map(h => new TableCell({
            shading: { fill: "3F8CFF", type: ShadingType.SOLID, color: "auto" },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })],
            })],
          })),
        }),
      ];

      filtered.forEach((e, i) => {
        const cells = [
          String(i + 1), e.full_name, e.position,
          e.department?.name || "—", e.phone, passwords[e.id] || "—",
          ROLE_LABEL[e.role] || e.role, STATUS_LABEL[e.status] || e.status,
        ];
        tableRows.push(new TableRow({
          children: cells.map((text, ci) => new TableCell({
            children: [new Paragraph({
              alignment: ci === 1 || ci === 2 ? AlignmentType.LEFT : AlignmentType.CENTER,
              children: [new TextRun({ text, size: 18 })],
            })],
          })),
        }));
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Xodimlar ro'yxati", bold: true, size: 32 })],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Jami: ${filtered.length} xodim`, italics: true, size: 20, color: "777777" })],
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: "Eslatma: parollar bir tomonlama shifrlanadi — faqat shu seansda superadmin tomonidan yangi o'rnatilgan parollar ko'rsatiladi, boshqalari uchun \"—\" chiqadi.",
                italics: true, size: 16, color: "AA6600",
              })],
              spacing: { after: 260 },
            }),
            new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xodimlar-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Eksport qilishda xatolik");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <Header title="Xodimlar" subtitle="Barcha xodimlar ro'yxati va ma'lumotlari" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        {stats.map(s => (
          <div key={s.label} className="p-5 flex items-center gap-4"
            style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: s.bg, borderRadius: 14 }}>
              <Users size={22} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#0A1629" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#91929E" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="p-6" style={{ background: "#FFFFFF", boxShadow: "0px 6px 58px rgba(196,203,214,0.103611)", borderRadius: 24 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#F4F9FD", borderRadius: 12, minWidth: 220 }}>
            <Search size={16} style={{ color: "#91929E" }} />
            <input type="text" placeholder="Xodim qidirish..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1" style={{ color: "#0A1629" }} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportDocx} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              style={{ background: "#F4F9FD", color: "#7D8592", borderRadius: 12 }}>
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Word (.docx)
            </button>
            <button onClick={() => setFormEmp("new")}
              className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white"
              style={{ background: "#3F8CFF", borderRadius: 14, boxShadow: "0px 6px 12px rgba(63,140,255,0.263686)" }}>
              <Plus size={18} />
              Xodim qo'shish
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "2px solid #F4F9FD" }}>
                {["#", "Xodim", "Bo'lim", "Telefon", "Parol", "Rol", "Ish joyi", "Holat", ""].map(h => (
                  <th key={h} className="text-left pb-4 text-xs font-bold uppercase"
                    style={{ color: "#91929E", letterSpacing: "0.05em", paddingRight: 16 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <Loader2 size={28} className="mx-auto animate-spin" style={{ color: "#3F8CFF" }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <Users size={32} className="mx-auto mb-3" style={{ color: "#D9E3F0" }} />
                  <p className="text-sm font-bold" style={{ color: "#91929E" }}>Xodimlar topilmadi</p>
                </td></tr>
              ) : filtered.map((emp, i) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #F4F9FD" }} className="hover:bg-[#F4F9FD] transition-colors">
                  <td className="py-4 text-sm font-bold" style={{ color: "#91929E", paddingRight: 16 }}>{i + 1}</td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <div className="flex items-center gap-3">
                      {photos[emp.id] ? (
                        <img src={photos[emp.id]} alt={emp.full_name}
                          className="w-10 h-10 flex-shrink-0 object-cover"
                          style={{ borderRadius: 12 }} />
                      ) : (
                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                          style={{ background: "#3F8CFF", borderRadius: 12 }}>
                          {mkAvatar(emp.full_name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-sm" style={{ color: "#0A1629" }}>{emp.full_name}</p>
                        <p className="text-xs" style={{ color: "#91929E" }}>{emp.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    {emp.department ? (
                      <span className="text-xs font-bold px-2 py-1" style={{ color: "#3F8CFF", background: "rgba(63,140,255,0.1)", borderRadius: 8 }}>
                        {emp.department.name}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#D9E3F0" }}>—</span>
                    )}
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#0A1629" }}>
                      <Phone size={11} /> {emp.phone}
                    </span>
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    {passwords[emp.id] ? (
                      <span className="flex items-center gap-1 text-xs font-bold font-mono" style={{ color: "#0A1629" }}>
                        <KeyRound size={11} /> {passwords[emp.id]}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#91929E" }}>
                        <KeyRound size={11} /> ••••••••
                      </span>
                    )}
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <Badge label={ROLE_LABEL[emp.role] || emp.role} variant={ROLE_BADGE[emp.role] || "gray"} />
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <WorkLocationMenu emp={emp} onChanged={handleWorkLocationChange} />
                  </td>
                  <td className="py-4" style={{ paddingRight: 16 }}>
                    <StatusMenu emp={emp} onChanged={handleStatusChange} />
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setFormEmp(emp)} title="Tahrirlash"
                        className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity"
                        style={{ background: "rgba(63,140,255,0.1)", borderRadius: 8 }}>
                        <Pencil size={14} style={{ color: "#3F8CFF" }} />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} title="O'chirish" disabled={deletingId === emp.id}
                        className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
                        style={{ background: "rgba(255,92,92,0.1)", borderRadius: 8 }}>
                        {deletingId === emp.id
                          ? <Loader2 size={14} className="animate-spin" style={{ color: "#FF5C5C" }} />
                          : <Trash2 size={14} style={{ color: "#FF5C5C" }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-5">
          <p className="text-sm" style={{ color: "#91929E" }}>Jami {filtered.length} ta xodim ko'rsatilmoqda</p>
        </div>
      </div>

      {formEmp !== null && (
        <EmpFormModal
          emp={formEmp === "new" ? null : formEmp}
          depts={depts}
          onClose={() => setFormEmp(null)}
          onSaved={handleFormSaved}
        />
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 text-sm font-bold text-white"
          style={{ background: "#00C48C", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,196,140,0.35)" }}>
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
