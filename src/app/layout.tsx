import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SGF - Sistema de Gestão Financeira | IPA",
  description: "Sistema de Gestão Financeira focado na integração Setor IPA e Setor Financeiro",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`}>
      <body className="bg-[#080808] text-[#F5F5F5] font-sans antialiased overflow-x-hidden min-h-screen">
        {children}
      </body>
    </html>
  );
}
