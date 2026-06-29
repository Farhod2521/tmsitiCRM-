interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "danger" | "purple" | "cyan" | "gray";
}

const variants = {
  primary: { color: "#3F8CFF", bg: "rgba(63,140,255,0.1)" },
  success: { color: "#00C48C", bg: "rgba(0,196,140,0.1)" },
  warning: { color: "#FFBD21", bg: "rgba(255,189,33,0.1)" },
  danger: { color: "#FF5C5C", bg: "rgba(255,92,92,0.1)" },
  purple: { color: "#6D5DD3", bg: "rgba(109,93,211,0.1)" },
  cyan: { color: "#15C0E6", bg: "rgba(21,192,230,0.1)" },
  gray: { color: "#7D8592", bg: "rgba(125,133,146,0.1)" },
};

export default function Badge({ label, variant = "gray" }: BadgeProps) {
  const { color, bg } = variants[variant];
  return (
    <span
      className="inline-flex items-center px-3 py-1 text-xs font-bold"
      style={{ color, background: bg, borderRadius: 8 }}
    >
      {label}
    </span>
  );
}
