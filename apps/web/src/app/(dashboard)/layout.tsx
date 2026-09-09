import { AuthGate } from "@/auth/auth-gate";
import { PageTransition } from "@/animations/page-transition";
import { AppShell } from "@/layout/app-shell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <AppShell>
        <PageTransition>{children}</PageTransition>
      </AppShell>
    </AuthGate>
  );
}
