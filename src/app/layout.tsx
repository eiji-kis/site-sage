import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSessionProvider } from "@/components/providers/session-provider";
import { AmbientBackground } from "@/components/shell/ambient-background";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Site Sage",
  description: "Company knowledge bases and public chatbots",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-background ${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-transparent text-foreground">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <AppSessionProvider>{children}</AppSessionProvider>
        </div>
      </body>
    </html>
  );
}
