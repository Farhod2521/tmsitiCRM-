"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Save, RefreshCw, Users, CheckCircle2, Download, FileText, Info, X,
  FileDown, SlidersHorizontal, Building2, Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
export type BallMode = "kadr" | "ijro" | "direktor";

interface EmpScoreRow {
  employee_id:      number;
  full_name:        string;
  position:         string;
  role:             string;
  department_id:    number | null;
  department_name:  string | null;
  bolim_ball:       number | null;
  kadr_ball:        number | null;
  direktor_ball:    number | null;
  ijro_ball:        number | null;
  report_file_name: string | null;
}

interface BallState {
  bolim_ball?:    number | null;
  kadr_ball?:     number | null;
  direktor_ball?: number | null;
  ijro_ball?:     number | null;
}

const MON_NAMES = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];
const DEPT_COLORS = ["#3F8CFF","#00C48C","#FFBD21","#6D5DD3","#15C0E6","#FF5C5C","#FF8C42","#9B59B6"];

const FIELD_CONFIG: Record<BallMode, {key: keyof BallState; max: number; label: string; color: string}[]> = {
  kadr:     [{ key:"kadr_ball",  max:25, label:"KADR",   color:"#FF8C42" }],
  ijro:     [{ key:"ijro_ball",  max:10, label:"IJRO",   color:"#00C48C" }],
  direktor: [
    { key:"bolim_ball", max:65, label:"BO'LIM", color:"#3F8CFF" },
    { key:"kadr_ball",  max:25, label:"KADR",   color:"#FF8C42" },
    { key:"ijro_ball",  max:10, label:"IJRO",   color:"#00C48C" },
  ],
};

function getVal(r: EmpScoreRow, b: BallState, key: "bolim_ball" | "kadr_ball" | "ijro_ball"): number | null {
  return b[key] !== undefined ? (b[key] as number | null) : r[key];
}

function calcJami(r: EmpScoreRow, b: BallState): number | null {
  const bolim = getVal(r, b, "bolim_ball");
  const kadr  = getVal(r, b, "kadr_ball");
  const ijro  = getVal(r, b, "ijro_ball");
  if (bolim == null && kadr == null && ijro == null) return null;
  return (bolim ?? 0) + (kadr ?? 0) + (ijro ?? 0);
}

/* ── Filterlar ── */
type FilterKey = "barchasi" | "bolim_yoq" | "kadr_yoq" | "ijro_yoq" | "hisobot_yoq";

const FILTERS: { key: FilterKey; label: string; color: string; bg: string }[] = [
  { key: "barchasi",    label: "Barchasi",            color: "#3F8CFF", bg: "rgba(63,140,255,0.1)"  },
  { key: "bolim_yoq",   label: "Bo'lim ball yo'q",    color: "#FF5C5C", bg: "rgba(255,92,92,0.1)"   },
  { key: "kadr_yoq",    label: "Kadr ball yo'q",      color: "#FF8C42", bg: "rgba(255,140,66,0.12)" },
  { key: "ijro_yoq",    label: "Ijro ball yo'q",      color: "#00C48C", bg: "rgba(0,196,140,0.1)"   },
  { key: "hisobot_yoq", label: "Hisobot yo'q",        color: "#6D5DD3", bg: "rgba(109,93,211,0.1)"  },
];

function matchFilter(r: EmpScoreRow, b: BallState, key: FilterKey): boolean {
  switch (key) {
    case "barchasi":    return true;
    case "bolim_yoq":   return getVal(r, b, "bolim_ball") == null;
    case "kadr_yoq":    return getVal(r, b, "kadr_ball")  == null;
    case "ijro_yoq":    return getVal(r, b, "ijro_ball")  == null;
    case "hisobot_yoq": return !r.report_file_name;
  }
}

function getKpiLabel(total: number | null): { text: string; color: string; bg: string } {
  if (total == null) return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
  if (total >= 96)   return { text: "200%", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)" };
  if (total >= 91)   return { text: "150%", color: "#3F8CFF", bg: "rgba(63,140,255,0.10)" };
  if (total >= 86)   return { text: "125%", color: "#00C48C", bg: "rgba(0,196,140,0.10)" };
  if (total >= 81)   return { text: "100%", color: "#FFBD21", bg: "rgba(255,189,33,0.12)" };
  if (total >= 76)   return { text: "75%",  color: "#FF8C42", bg: "rgba(255,140,66,0.12)" };
  if (total >= 70)   return { text: "50%",  color: "#FF5C5C", bg: "rgba(255,92,92,0.10)" };
  return { text: "—", color: "#C4CBD6", bg: "#F4F9FD" };
}

function mkAvatar(n: string) {
  return n.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2);
}

interface Props { mode: BallMode; }

export default function XodimlarBallBerish({ mode }: Props) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows,  setRows]  = useState<EmpScoreRow[]>([]);
  const [balls, setBalls] = useState<Record<number, BallState>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [openDepts,  setOpenDepts]  = useState<Set<string>>(new Set());
  const [kpiModal,   setKpiModal]   = useState(false);
  const [filter,     setFilter]     = useState<FilterKey>("barchasi");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting,  setExporting]  = useState(false);

  /* ── Bo'limlar bo'yicha multi-select ── */
  const [selectedDepts,  setSelectedDepts]  = useState<Set<string>>(new Set());
  const [deptSelectOpen, setDeptSelectOpen] = useState(false);
  const deptSelectRef = useRef<HTMLDivElement>(null);

  /* ── Hisobot preview modal ── */
  const [reportModal,   setReportModal]   = useState<{ empId: number; fileName: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState<string | null>(null);
  const [reportKind,    setReportKind]    = useState<"docx" | "pdf" | "other" | null>(null);
  const [pdfUrl,        setPdfUrl]        = useState<string | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  const fields = FIELD_CONFIG[mode];

  const KPI_RANGES = [
    { from: 70,  to: 75,  foiz: "50%",  color: "#FF5C5C", bg: "rgba(255,92,92,0.10)"   },
    { from: 76,  to: 80,  foiz: "75%",  color: "#FF8C42", bg: "rgba(255,140,66,0.12)"  },
    { from: 81,  to: 85,  foiz: "100%", color: "#FFBD21", bg: "rgba(255,189,33,0.12)"  },
    { from: 86,  to: 90,  foiz: "125%", color: "#00C48C", bg: "rgba(0,196,140,0.10)"   },
    { from: 91,  to: 95,  foiz: "150%", color: "#3F8CFF", bg: "rgba(63,140,255,0.10)"  },
    { from: 96,  to: 100, foiz: "200%", color: "#6D5DD3", bg: "rgba(109,93,211,0.12)"  },
  ];

  /* ── Load ── */
  const loadData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSaved(false);
    try {
      const data = await apiFetch<EmpScoreRow[]>(`/ball/all-month?year=${y}&month=${m}`);
      setRows(data);

      // Initialize ball states from existing scores
      // direktor mode: faqat DB dagi qiymat, bo'sh bo'lsa null (avtomatik to'ldirmaslik)
      // kadr/ijro mode: bo'sh bo'lsa maksimum bilan to'ldirish
      const init: Record<number, BallState> = {};
      for (const r of data) {
        const def: BallState = {};
        for (const f of fields) {
          const cur = r[f.key as keyof EmpScoreRow] as number | null;
          def[f.key] = cur ?? (mode === "direktor" ? null : f.max);
        }
        init[r.employee_id] = def;
      }
      setBalls(init);

      // Auto-open all departments
      const depts = new Set(data.map(r => r.department_name ?? "Boshqa").filter(Boolean));
      setOpenDepts(new Set(depts));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadData(year, month); }, []); // eslint-disable-line

  function chMonth(dir: number) {
    let m = month + dir; let y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m); loadData(y, m);
  }

  function updateBall(empId: number, key: keyof BallState, val: number | null) {
    setBalls(prev => ({ ...prev, [empId]: { ...prev[empId], [key]: val } }));
  }

  function setAllDefault() {
    const next: Record<number, BallState> = {};
    for (const r of rows) {
      const def: BallState = {};
      for (const f of fields) def[f.key] = f.max;
      next[r.employee_id] = def;
    }
    setBalls(next);
  }

  /* ── Save ── */
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const emps = rows.map(r => ({
        employee_id:   r.employee_id,
        ...balls[r.employee_id],
      }));
      await apiFetch("/ball/bulk-save", {
        method: "POST",
        body: JSON.stringify({ year, month, employees: emps }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  /* ── Fayl yuklab olish (direktor) ── */
  async function downloadFile(empId: number) {
    try {
      const d = await apiFetch<{ file_name: string; file_b64: string }>(
        `/ball/report/${empId}/${year}/${month}`
      );
      const a = document.createElement("a");
      a.href = d.file_b64;
      a.download = d.file_name;
      a.click();
    } catch {
      alert("Fayl topilmadi");
    }
  }

  /* ── Bo'lim multi-select: tashqariga bosilganda yopish ── */
  useEffect(() => {
    if (!deptSelectOpen) return;
    function onClick(e: MouseEvent) {
      if (deptSelectRef.current && !deptSelectRef.current.contains(e.target as Node)) {
        setDeptSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [deptSelectOpen]);

  function toggleDept(name: string) {
    setSelectedDepts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  /* ── Hisobot preview ── */
  function openReport(empId: number, fileName: string) {
    setReportModal({ empId, fileName });
  }

  function closeReportModal() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setReportModal(null);
    setReportError(null);
    setReportKind(null);
    if (reportContainerRef.current) reportContainerRef.current.innerHTML = "";
  }

  useEffect(() => {
    if (!reportModal) return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      setReportError(null);
      setReportKind(null);
      try {
        const d = await apiFetch<{ file_name: string; file_b64: string }>(
          `/ball/report/${reportModal.empId}/${year}/${month}`
        );
        const ext = (d.file_name.split(".").pop() || "").toLowerCase();
        const commaIdx = d.file_b64.indexOf(",");
        const base64 = commaIdx >= 0 ? d.file_b64.slice(commaIdx + 1) : d.file_b64;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        if (cancelled) return;

        if (ext === "docx") {
          setReportKind("docx");
          const { renderAsync } = await import("docx-preview");
          if (reportContainerRef.current && !cancelled) {
            reportContainerRef.current.innerHTML = "";
            await renderAsync(new Blob([bytes]), reportContainerRef.current, undefined, {
              className: "docx-render", inWrapper: true,
            });
          }
        } else if (ext === "pdf") {
          setReportKind("pdf");
          setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
        } else {
          setReportKind("other");
        }
      } catch (e) {
        if (!cancelled) setReportError(e instanceof Error ? e.message : "Faylni yuklashda xato");
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportModal, year, month]);

  /* ── Filter counts ── */
  const filterCounts: Record<FilterKey, number> = {
    barchasi:    rows.length,
    bolim_yoq:   rows.filter(r => matchFilter(r, balls[r.employee_id] ?? {}, "bolim_yoq")).length,
    kadr_yoq:    rows.filter(r => matchFilter(r, balls[r.employee_id] ?? {}, "kadr_yoq")).length,
    ijro_yoq:    rows.filter(r => matchFilter(r, balls[r.employee_id] ?? {}, "ijro_yoq")).length,
    hisobot_yoq: rows.filter(r => matchFilter(r, balls[r.employee_id] ?? {}, "hisobot_yoq")).length,
  };

  /* ── Bo'limlar ro'yxati ── */
  const allDeptNames = Array.from(new Set(rows.map(r => r.department_name ?? "Boshqa"))).sort();

  /* ── Group by dept (filterlangan) ── */
  const filteredRows = rows
    .filter(r => matchFilter(r, balls[r.employee_id] ?? {}, filter))
    .filter(r => selectedDepts.size === 0 || selectedDepts.has(r.department_name ?? "Boshqa"));
  const grouped = new Map<string, EmpScoreRow[]>();
  for (const r of filteredRows) {
    const key = r.department_name ?? "Boshqa";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const deptList = Array.from(grouped.entries());

  const totalEmps = rows.length;
  const filledCount = rows.filter(r => {
    const b = balls[r.employee_id];
    return b && fields.every(f => b[f.key] != null);
  }).length;

  /* ── DOCX export ── */
  async function exportDocx() {
    setExporting(true);
    try {
      const {
        Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, WidthType, AlignmentType, ShadingType,
      } = await import("docx");

      const children: InstanceType<typeof Paragraph | typeof Table>[] = [
        new Paragraph({
          children: [new TextRun({ text: `Xodimlar ball berish — ${MON_NAMES[month-1]} ${year}`, bold: true, size: 32 })],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `${modeTitle} · Filtr: ${FILTERS.find(f => f.key === filter)?.label} · Jami: ${filteredRows.length} xodim`,
            italics: true, size: 20, color: "777777",
          })],
          spacing: { after: 300 },
        }),
      ];

      const headerCells = ["#", "F.I.Sh", "Lavozim", "BO'LIM /65", "KADR /25", "IJRO /10", "JAMI /100", "KPI FOIZ", "HISOBOT"];

      for (const [deptName, deptRows] of deptList) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${deptName} (${deptRows.length} xodim)`, bold: true, size: 24, color: "3F8CFF" })],
          spacing: { before: 280, after: 100 },
        }));

        const tableRows: InstanceType<typeof TableRow>[] = [
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

        deptRows.forEach((r, i) => {
          const b = balls[r.employee_id] ?? {};
          const bolim = getVal(r, b, "bolim_ball");
          const kadr  = getVal(r, b, "kadr_ball");
          const ijro  = getVal(r, b, "ijro_ball");
          const jami  = calcJami(r, b);
          const kpi   = getKpiLabel(jami);
          const cells = [
            String(i + 1), r.full_name, r.position,
            bolim != null ? String(bolim) : "—",
            kadr  != null ? String(kadr)  : "—",
            ijro  != null ? String(ijro)  : "—",
            jami  != null ? String(jami)  : "—",
            kpi.text,
            r.report_file_name ? "Bor" : "Yo'q",
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

        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ball-berish-${year}-${String(month).padStart(2, "0")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Eksport qilishda xato");
    } finally {
      setExporting(false);
    }
  }

  const modeTitle = mode === "kadr" ? "Kadr ball berish" : mode === "ijro" ? "Ijro ball berish" : "Direktor — barcha ballar";
  const modeColor = mode === "kadr" ? "#FF8C42" : mode === "ijro" ? "#00C48C" : "#6D5DD3";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Top toolbar + Filter (bitta qator) ── */}
      <div className="flex flex-col gap-3 px-6 py-4"
        style={{ background:"#FFFFFF", borderRadius:20, boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)" }}>

        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* Chap tomon: Month nav + Stats + Filtr + Bo'limlar */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Month nav */}
            <div className="flex items-center gap-2 p-1" style={{ background:"#F4F9FD", borderRadius:12 }}>
              <button onClick={() => chMonth(-1)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronLeft size={15} style={{ color:"#3F8CFF" }}/>
              </button>
              <span className="px-3 font-bold text-sm" style={{ color:"#0A1629", minWidth:100, textAlign:"center" }}>
                {MON_NAMES[month-1]} {year}
              </span>
              <button onClick={() => chMonth(1)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white transition-colors">
                <ChevronRight size={15} style={{ color:"#3F8CFF" }}/>
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 px-3.5 py-2"
              style={{ background:"rgba(63,140,255,0.06)", borderRadius:12 }}>
              <Users size={14} style={{ color:"#3F8CFF" }}/>
              <span className="text-sm font-bold" style={{ color:"#0A1629" }}>{totalEmps} xodim</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2"
              style={{ background:"rgba(0,196,140,0.06)", borderRadius:12 }}>
              <CheckCircle2 size={14} style={{ color:"#00C48C" }}/>
              <span className="text-sm font-bold" style={{ color:"#0A1629" }}>{filledCount}/{totalEmps} baholangan</span>
            </div>

            {/* Divider */}
            <div style={{ width:1, height:24, background:"#EEF2FF" }}/>

            {/* Filtr toggle */}
            <button onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 hover:opacity-80 transition-opacity"
              style={{ background: filterOpen ? "rgba(63,140,255,0.08)" : "#F4F9FD", borderRadius:12, color: filterOpen ? "#3F8CFF" : "#7D8592" }}>
              <SlidersHorizontal size={14}/>
              <span className="text-sm font-bold">Filtr</span>
              {filter !== "barchasi" && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-md"
                  style={{ background: FILTERS.find(f=>f.key===filter)!.bg, color: FILTERS.find(f=>f.key===filter)!.color }}>
                  {FILTERS.find(f=>f.key===filter)!.label}
                </span>
              )}
              {filterOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>

            {/* Bo'limlar multi-select */}
            <div className="relative" ref={deptSelectRef}>
              <button onClick={() => setDeptSelectOpen(v => !v)}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-bold transition-all"
                style={{
                  background: selectedDepts.size > 0 ? "rgba(63,140,255,0.1)" : "#F4F9FD",
                  color: selectedDepts.size > 0 ? "#3F8CFF" : "#7D8592",
                  borderRadius: 12,
                }}>
                <Building2 size={14}/>
                {selectedDepts.size === 0 ? "Barcha bo'limlar" : `${selectedDepts.size} ta bo'lim`}
                <ChevronDown size={14}/>
              </button>

              {deptSelectOpen && (
                <div className="absolute left-0 top-full mt-2 z-30"
                  style={{ background:"#FFFFFF", borderRadius:14, boxShadow:"0px 12px 40px rgba(10,22,41,0.18)", width:270, border:"1px solid #F4F9FD" }}>
                  <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom:"1px solid #F4F9FD" }}>
                    <span className="text-xs font-bold uppercase" style={{ color:"#91929E" }}>Bo'limlar ({allDeptNames.length})</span>
                    {selectedDepts.size > 0 && (
                      <button onClick={() => setSelectedDepts(new Set())} className="text-xs font-bold" style={{ color:"#FF5C5C" }}>
                        Tozalash
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {allDeptNames.map(name => {
                      const checked = selectedDepts.has(name);
                      return (
                        <label key={name}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-[#F8FAFF] transition-colors">
                          <input type="checkbox" checked={checked} onChange={() => toggleDept(name)}
                            className="w-4 h-4 cursor-pointer" style={{ accentColor:"#3F8CFF" }}/>
                          <span className="text-sm flex-1 truncate" style={{ color:"#0A1629", fontWeight: checked ? 700 : 500 }}>
                            {name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* O'ng tomon: Buttons */}
          <div className="flex gap-2">
            {mode !== "direktor" && (
              <button onClick={setAllDefault}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold"
                style={{ background:"#F4F9FD", borderRadius:12, color:"#7D8592" }}>
                <RefreshCw size={14}/> Default
              </button>
            )}
            <button onClick={exportDocx} disabled={exporting || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold disabled:opacity-40 transition-all"
              style={{ background:"rgba(63,140,255,0.08)", borderRadius:12, color:"#3F8CFF" }}>
              {exporting ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>}
              {exporting ? "Tayyorlanmoqda..." : "DOCX yuklab olish"}
            </button>
            <button onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{
                background: saved ? "#00C48C" : modeColor,
                borderRadius: 12,
                boxShadow: `0px 6px 12px ${modeColor}40`,
              }}>
              {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
              {saving ? "Saqlanmoqda..." : saved ? "Saqlandi ✓" : "Saqlash"}
            </button>
          </div>
        </div>

        {/* Filtr chiplari — collapsible */}
        {filterOpen && (
          <div className="flex items-center gap-2 flex-wrap pt-3" style={{ borderTop:"1px solid #F4F9FD" }}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold transition-all"
                  style={{
                    background: active ? f.bg : "#F4F9FD",
                    color:      active ? f.color : "#7D8592",
                    borderRadius: 12,
                    border: active ? `1.5px solid ${f.color}40` : "1.5px solid transparent",
                  }}>
                  {f.label}
                  <span className="px-1.5 py-0.5 text-xs rounded-md"
                    style={{
                      background: active ? `${f.color}22` : "rgba(145,146,158,0.12)",
                      color: active ? f.color : "#91929E",
                    }}>
                    {filterCounts[f.key]}
                  </span>
                </button>
              );
            })}
            <span className="ml-auto text-xs font-bold" style={{ color:"#91929E" }}>
              {filteredRows.length}/{totalEmps} ko'rsatilmoqda
            </span>
          </div>
        )}
      </div>

      {/* ── Main card ── */}
      <div style={{ background:"#FFFFFF", borderRadius:24, boxShadow:"0px 6px 58px rgba(196,203,214,0.103611)" }}>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: modeColor }}/>
            <span className="ml-2 font-bold text-sm" style={{ color: modeColor }}>Yuklanmoqda…</span>
          </div>
        ) : (
          <div className="py-2">
            {deptList.map(([deptName, deptRows], di) => {
              const isOpen = openDepts.has(deptName);
              const deptColor = DEPT_COLORS[di % DEPT_COLORS.length];

              return (
                <div key={deptName} style={{ borderBottom:"1px solid #F4F9FD" }}>
                  {/* Department accordion header */}
                  <button
                    onClick={() => {
                      setOpenDepts(prev => {
                        const next = new Set(prev);
                        if (next.has(deptName)) next.delete(deptName);
                        else next.add(deptName);
                        return next;
                      });
                    }}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-[#FAFCFF] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: deptColor, borderRadius: 10 }}>
                        {deptName.slice(0,2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm" style={{ color:"#0A1629" }}>{deptName}</p>
                        <p className="text-xs" style={{ color:"#91929E" }}>{deptRows.length} xodim</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1"
                        style={{ background:`${deptColor}18`, color:deptColor, borderRadius:8 }}>
                        {deptRows.filter(r => balls[r.employee_id] && fields.every(f => balls[r.employee_id][f.key] != null)).length}/{deptRows.length}
                      </span>
                      {isOpen
                        ? <ChevronUp size={16} style={{ color:"#91929E" }}/>
                        : <ChevronDown size={16} style={{ color:"#91929E" }}/>}
                    </div>
                  </button>

                  {/* Employee rows */}
                  {isOpen && (
                    <div className="overflow-x-auto">
                    <div style={{ minWidth: mode==="direktor" ? 920 : 700 }}>
                      {/* Table header */}
                      <div className="grid px-6 py-2 text-xs font-bold uppercase tracking-wide"
                        style={{
                          gridTemplateColumns: `50px 2fr ${fields.map(()=>"100px").join(" ")} 90px 100px${mode==="direktor"?" 120px":""}`,
                          color:"#91929E", letterSpacing:"0.05em",
                          background:"#F8FAFF",
                        }}>
                        <span>#</span>
                        <span>Xodim</span>
                        {fields.map(f => (
                          <span key={f.key} className="text-center" style={{ color: f.color }}>
                            {f.label} <span className="font-normal">/{f.max}</span>
                          </span>
                        ))}
                        <span className="text-center" style={{ color:"#0A1629" }}>JAMI</span>
                        <span className="flex items-center justify-center gap-1" style={{ color:"#6D5DD3" }}>
                          KPI FOIZ
                          <button
                            onClick={() => setKpiModal(true)}
                            className="hover:opacity-70 transition-opacity"
                            title="KPI foiz jadvalini ko'rish">
                            <Info size={13} style={{ color:"#6D5DD3" }}/>
                          </button>
                        </span>
                        {mode === "direktor" && (
                          <span className="text-center" style={{ color:"#3F8CFF" }}>Hisobot</span>
                        )}
                      </div>

                      {deptRows.map((r, idx) => {
                        const b = balls[r.employee_id] ?? {};
                        const jami = calcJami(r, b);
                        const kpi  = getKpiLabel(jami);
                        return (
                          <div key={r.employee_id}
                            className="grid items-center px-6 py-3 hover:bg-[#FAFCFF] transition-colors"
                            style={{
                              gridTemplateColumns: `50px 2fr ${fields.map(()=>"100px").join(" ")} 90px 100px${mode==="direktor"?" 120px":""}`,
                              borderTop: "1px solid #F4F9FD",
                            }}>
                            <span className="text-xs font-bold" style={{ color:"#91929E" }}>{idx+1}</span>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: deptColor, borderRadius:10 }}>
                                {mkAvatar(r.full_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color:"#0A1629" }}>{r.full_name}</p>
                                <p className="text-xs truncate" style={{ color:"#91929E" }}>{r.position}</p>
                              </div>
                            </div>
                            {fields.map(f => {
                              const val = b[f.key];
                              const numVal = val != null ? Number(val) : null;
                              const pct = numVal != null ? Math.round(numVal / f.max * 100) : 0;
                              return (
                                <div key={f.key} className="flex flex-col items-center gap-1 px-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={f.max}
                                    value={val ?? ""}
                                    onChange={e => {
                                      const v = e.target.value === "" ? null : Number(e.target.value);
                                      updateBall(r.employee_id, f.key, v);
                                    }}
                                    className="w-full text-center font-bold text-sm outline-none px-2 py-1.5"
                                    style={{
                                      background: "#F4F9FD",
                                      borderRadius: 10,
                                      color: "#0A1629",
                                      border: numVal != null && (numVal < 0 || numVal > f.max)
                                        ? `2px solid #FF5C5C`
                                        : `1.5px solid ${f.color}30`,
                                    }}
                                  />
                                  {/* mini progress */}
                                  <div className="w-full h-1 rounded-full" style={{ background:"#EEF2FF" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width:`${pct}%`, background: f.color }}/>
                                  </div>
                                </div>
                              );
                            })}
                            {/* JAMI */}
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="font-bold text-sm" style={{ color: jami != null ? "#0A1629" : "#C4CBD6" }}>
                                {jami != null ? jami : "—"}
                              </span>
                              <span className="text-xs" style={{ color:"#C4CBD6" }}>/100</span>
                            </div>

                            {/* KPI FOIZ */}
                            <div className="flex justify-center">
                              <span className="px-2.5 py-1 text-xs font-bold"
                                style={{ background: kpi.bg, color: kpi.color, borderRadius: 8 }}>
                                {kpi.text}
                              </span>
                            </div>

                            {/* Hisobot ustuni — faqat direktor */}
                            {mode === "direktor" && (
                              <div className="flex justify-center">
                                {r.report_file_name ? (
                                  <button
                                    onClick={() => openReport(r.employee_id, r.report_file_name!)}
                                    title={r.report_file_name}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80 transition-opacity"
                                    style={{ background:"rgba(109,93,211,0.1)", borderRadius:10, color:"#6D5DD3" }}>
                                    <Eye size={12}/>
                                    Ko'rish
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-3 py-2"
                                    style={{ background:"#F4F9FD", borderRadius:10 }}>
                                    <FileText size={12} style={{ color:"#C4CBD6" }}/>
                                    <span className="text-xs" style={{ color:"#C4CBD6" }}>Yo'q</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  )}
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="py-16 text-center">
                <Users size={36} style={{ color:"#D9E3F0", margin:"0 auto" }}/>
                <p className="font-bold mt-3" style={{ color:"#0A1629" }}>Xodimlar topilmadi</p>
              </div>
            )}
            {rows.length > 0 && filteredRows.length === 0 && (
              <div className="py-16 text-center">
                <SlidersHorizontal size={36} style={{ color:"#D9E3F0", margin:"0 auto" }}/>
                <p className="font-bold mt-3" style={{ color:"#0A1629" }}>Bu filtrga mos xodim topilmadi</p>
                <button onClick={() => setFilter("barchasi")}
                  className="mt-3 px-4 py-2 text-xs font-bold"
                  style={{ background:"#F4F9FD", borderRadius:10, color:"#3F8CFF" }}>
                  Barchasini ko'rsatish
                </button>
              </div>
            )}
          </div>
        )}
        <div className="pb-2"/>
      </div>
      {/* ── KPI Foiz modal ── */}
      {kpiModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10,22,41,0.45)" }}
          onClick={() => setKpiModal(false)}>
          <div
            className="relative flex flex-col gap-0 overflow-hidden"
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              boxShadow: "0px 20px 60px rgba(10,22,41,0.25)",
              minWidth: 320,
            }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid #F4F9FD" }}>
              <div>
                <p className="font-bold text-sm" style={{ color:"#0A1629" }}>KPI Foiz Jadval</p>
                <p className="text-xs mt-0.5" style={{ color:"#91929E" }}>Ball oralig'iga qarab KPI ulushi</p>
              </div>
              <button onClick={() => setKpiModal(false)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors">
                <X size={15} style={{ color:"#91929E" }}/>
              </button>
            </div>

            {/* Ranges */}
            <div className="flex flex-col gap-0">
              {KPI_RANGES.map((r, i) => (
                <div key={i}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: i < KPI_RANGES.length - 1 ? "1px solid #F4F9FD" : "none" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: r.color }}/>
                    <span className="text-sm font-medium" style={{ color:"#0A1629" }}>
                      {r.from} – {r.to} ball
                    </span>
                  </div>
                  <span className="px-3 py-1 text-sm font-bold"
                    style={{ background: r.bg, color: r.color, borderRadius: 8 }}>
                    {r.foiz}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="px-5 py-3" style={{ background:"#F8FAFF", borderTop:"1px solid #F4F9FD" }}>
              <p className="text-xs" style={{ color:"#91929E" }}>
                70 balldan past — KPI hisoblanmaydi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hisobot preview modal ── */}
      {reportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,22,41,0.6)" }}
          onClick={closeReportModal}>
          <div
            className="relative flex flex-col"
            style={{
              background: "#FFFFFF", borderRadius: 20, width: "100%", maxWidth: 880,
              height: "85vh", boxShadow: "0px 20px 60px rgba(10,22,41,0.3)",
            }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid #F4F9FD" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ background:"rgba(109,93,211,0.1)", borderRadius:10 }}>
                  <FileText size={16} style={{ color:"#6D5DD3" }}/>
                </div>
                <p className="font-bold text-sm truncate" style={{ color:"#0A1629" }}>{reportModal.fileName}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => downloadFile(reportModal.empId)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:opacity-80 transition-opacity"
                  style={{ background:"rgba(0,196,140,0.1)", borderRadius:10, color:"#00A578" }}>
                  <Download size={12}/> Yuklab olish
                </button>
                <button onClick={closeReportModal}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[#F4F9FD] rounded-lg transition-colors"
                  style={{ background:"#F4F9FD", borderRadius:10 }}>
                  <X size={15} style={{ color:"#91929E" }}/>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto" style={{ background:"#F8FAFF" }}>
              {reportLoading && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={26} className="animate-spin" style={{ color:"#6D5DD3" }}/>
                  <span className="ml-2 text-sm font-bold" style={{ color:"#6D5DD3" }}>Hujjat yuklanmoqda…</span>
                </div>
              )}

              {!reportLoading && reportError && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <FileText size={36} style={{ color:"#D9E3F0" }}/>
                  <p className="font-bold mt-3 text-sm" style={{ color:"#0A1629" }}>Faylni ko'rib bo'lmadi</p>
                  <p className="text-xs mt-1" style={{ color:"#91929E" }}>{reportError}</p>
                </div>
              )}

              {!reportLoading && !reportError && reportKind === "other" && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <FileText size={36} style={{ color:"#D9E3F0" }}/>
                  <p className="font-bold mt-3 text-sm" style={{ color:"#0A1629" }}>Bu format brauzerda ko'rsatilmaydi</p>
                  <p className="text-xs mt-1" style={{ color:"#91929E" }}>Faylni ko'rish uchun yuklab oling</p>
                  <button onClick={() => downloadFile(reportModal.empId)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold"
                    style={{ background:"#6D5DD3", color:"#FFFFFF", borderRadius:12 }}>
                    <Download size={14}/> Yuklab olish
                  </button>
                </div>
              )}

              {!reportLoading && !reportError && reportKind === "pdf" && pdfUrl && (
                <iframe src={pdfUrl} className="w-full h-full" style={{ border:"none" }}/>
              )}

              <div
                ref={reportContainerRef}
                style={{
                  display: reportKind === "docx" && !reportLoading && !reportError ? "block" : "none",
                  padding: 24,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
