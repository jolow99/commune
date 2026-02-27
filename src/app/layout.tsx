import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commune",
  description: "A multiplayer platform where social movements collaboratively edit a live website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
