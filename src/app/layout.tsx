import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ciomas Keramik - Sistem Manajemen",
  description: "Sistem Manajemen Toko Keramik Ciomas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
