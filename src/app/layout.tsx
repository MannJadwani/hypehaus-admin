import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { cookies } from "next/headers";
import { verifyAdminJWT } from "@/lib/jwt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hypehaus Admin",
  description: "Manage events, ticket tiers, and images",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  let isAuthed = false;
  if (token) {
    try {
      verifyAdminJWT(token);
      isAuthed = true;
    } catch {}
  }
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--hh-bg)] text-[var(--hh-text)]`}>
        <div className="flex min-h-screen">
          {isAuthed ? <Sidebar /> : null}
          <main className="flex-1 px-4 py-4 md:px-6 md:py-6 w-full min-w-0">
        {children}
          </main>
        </div>
      </body>
    </html>
  );
}
