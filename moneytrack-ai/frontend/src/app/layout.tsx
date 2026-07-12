import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "เงินไปไหน?",
    template: "%s | เงินไปไหน?",
  },
  description: "จดรายรับรายจ่ายผ่าน LINE พร้อมสรุปและวิเคราะห์การเงิน",
  icons: {
    icon: "/brand/moneytrack-icon-round.png",
    apple: "/brand/moneytrack-icon-round.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://static.line-scdn.net" />
        <link rel="dns-prefetch" href="https://static.line-scdn.net" />
        {apiOrigin && <link rel="preconnect" href={apiOrigin} />}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
