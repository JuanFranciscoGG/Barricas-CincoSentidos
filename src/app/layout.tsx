import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Cinco Sentidos — Barricas",
  description: "Plataforma de gestión de proyectos de vino personalizados en barrica.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${archivo.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
