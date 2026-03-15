import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revolution Engine",
  description: "A platform where social movements collaboratively shape their direction",
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
