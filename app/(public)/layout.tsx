import { PublicHeader } from "@/components/layout/PublicHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      <PublicHeader />
      <main>{children}</main>
    </div>
  );
}
