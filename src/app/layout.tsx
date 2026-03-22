import type { Metadata } from "next";
import { Syne, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Commune",
  description: "Propose projects. Vote together. Build what matters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${sourceSans.variable}`}>
      <body className="antialiased font-body">
        {children}
      </body>
    </html>
  );
}
