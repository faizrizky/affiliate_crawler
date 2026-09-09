import type { Metadata } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import "@aff/ui/tokens.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Threads Affiliate Content Researcher",
  description:
    "Turn live Threads conversations into publish-ready affiliate copy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
