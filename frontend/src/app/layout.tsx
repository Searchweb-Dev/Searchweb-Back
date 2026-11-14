import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { SaveLinkDialog } from "@/components/dialogs/SaveLinkDialog";
import { CreateFolderDialog } from "@/components/dialogs/CreateFolderDialog";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

import { AgentationProvider } from "@/components/providers/AgentationProvider";
import { Toaster } from "@/components/ui/Toaster";
import { SITE_URL } from "@/lib/config/site";

const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ReLink - 북마크의 진화, AI 지능형 관리",
  description: "AI를 통해 북마크를 지능적으로 관리하세요. ReLink.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet" />
      </head>
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      <body className={`${inter.variable} font-sans antialiased bg-background-light dark:bg-background-dark text-text-main h-screen overflow-hidden flex transition-colors duration-200`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </AuthProvider>
            <SaveLinkDialog />
            <CreateFolderDialog />
            <Toaster />
            <AgentationProvider />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
