import SidebarXodim from "@/components/layout/SidebarXodim";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#F4F9FD", minHeight: "100vh" }}>
      <SidebarXodim />
      <main
        style={{
          marginLeft: 260,
          width: "calc(100% - 260px)",
          minHeight: "100vh",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
