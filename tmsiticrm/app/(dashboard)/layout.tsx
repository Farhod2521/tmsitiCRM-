import Sidebar from "@/components/layout/Sidebar";
import PostLoginPrompts from "@/components/auth/PostLoginPrompts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#F4F9FD", minHeight: "100vh" }}>
      <PostLoginPrompts />
      <Sidebar />
      <main
        className="lg:ml-[260px] lg:w-[calc(100%-260px)] pt-20 px-4 pb-6 lg:p-6"
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
