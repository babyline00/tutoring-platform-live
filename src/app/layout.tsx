import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Powered Tutoring Platform (Live)",
  description:
    "Live AI-assisted tutoring — tutor panel with concept-to-lesson suggestions, practice problem generation, answer evaluation, session timeline, step-by-step replay, and end-of-session summary.",
  keywords: [
    "AI tutoring",
    "live tutoring",
    "practice problems",
    "answer evaluation",
    "session replay",
    "Next.js",
    "z-ai-web-dev-sdk",
  ],
  authors: [{ name: "AI-Powered Tutoring Platform (Live)" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
