import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#F4F9FD", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 260,
          width: "calc(100% - 260px)",
          minHeight: "100vh",
          padding: "24px 24px 24px 24px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
