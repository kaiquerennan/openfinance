import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Visor • Clareza Financeira",
  description:
    "Suas finanças no celular: limites, transações, recorrentes, análises e metas sobre seus dados de Open Finance.",
};

export const viewport: Viewport = {
  themeColor: "#1e74f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${poppins.variable}`}>
      <body className="min-h-full">
        <div className="app-col mx-auto w-full max-w-md relative pb-32">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
