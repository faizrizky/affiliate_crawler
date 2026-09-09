import { PageTransition } from "@/animations/page-transition";
import { AppShell } from "@/layout/app-shell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell>
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
