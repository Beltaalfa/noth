import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hub.nortempresarial.com.br";

export const metadata: Metadata = {
  title: "Hub - Nortempresarial",
  description: "Portal do Cliente e Painel Admin",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-dark.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-light.png", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/icon-dark.png", type: "image/png" }],
  },
  openGraph: {
    title: "Hub - Nortempresarial",
    description: "Portal do Cliente e Painel Admin",
    url: baseUrl,
    siteName: "Hub Nortempresarial",
    images: [{ url: "/icon-dark.png", width: 512, height: 512, alt: "North" }],
    locale: "pt_BR",
  },
  twitter: {
    card: "summary",
    title: "Hub - Nortempresarial",
    description: "Portal do Cliente e Painel Admin",
    images: [`${baseUrl}/icon-dark.png`],
  },
  appleWebApp: {
    capable: true,
    title: "Hub",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-zinc-100 min-h-screen`}
      >
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
