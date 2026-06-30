import SidebarBolimBoshliq from "@/components/layout/SidebarBolimBoshliq";

export default function BolimBoshliqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#F4F9FD", minHeight: "100vh" }}>
      <SidebarBolimBoshliq />
      <main className="lg:ml-[260px] lg:w-[calc(100%-260px)] pt-20 px-4 pb-6 lg:p-6"
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
        }}>
        {children}
      </main>
    </div>
  );
}
