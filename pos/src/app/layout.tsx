import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Billing from "./components/Billing";
import ClientProviders from "./components/ClientProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS System",
  description: "Point of Sale System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProviders>
          <div className="flex h-screen overflow-hidden bg-[#f0f2f5]">
            {/* LEFT: Billing Panel */}
            <Billing />
            {/* RIGHT: Main content */}
            <main className="flex-1 bg-[#f0f2f5] overflow-y-auto">
              {children}
            </main>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
