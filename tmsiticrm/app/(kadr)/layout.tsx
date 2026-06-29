import SidebarKadr from "@/components/layout/SidebarKadr";

export default function KadrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background:"#F4F9FD", minHeight:"100vh" }}>
      <SidebarKadr />
      <main style={{ marginLeft:260, width:"calc(100% - 260px)", minHeight:"100vh", padding:"24px", boxSizing:"border-box" }}>
        {children}
      </main>
    </div>
  );
}
