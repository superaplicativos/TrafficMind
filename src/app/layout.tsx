import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrafficMind — Rotas Inteligentes com IA",
  description:
    "Navegação mais inteligente, não apenas mais um mapa. O TrafficMind calcula múltiplas rotas alternativas e as classifica com um score transparente que combina tempo, trânsito, cruzamentos e complexidade da via.",
  keywords: ["navegação", "trânsito", "rotas", "IA", "OSRM", "GraphHopper", "OpenStreetMap", "MapLibre", "São Paulo"],
  authors: [{ name: "TrafficMind" }],
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0e14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
