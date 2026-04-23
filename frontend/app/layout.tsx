import type { Metadata } from "next";
import localFont from "next/font/local";
import "../src/app/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Providers } from "@/app/providers";

const geistSans = localFont({
  src: "../src/app/fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../src/app/fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AthleteIQ",
  description: "AI-powered athlete intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-ink`}>
        <AuthProvider>
          <Providers>{children}</Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
