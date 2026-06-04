import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro, Caveat } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../index.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-be-vietnam-pro",
  weight: ["400", "500", "700"],
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  title: "Músicas Personalizadas | A música perfeita para quem você ama",
  description:
    "Criamos músicas personalizadas únicas pelo WhatsApp. Para aniversários, declarações e momentos especiais. Via PIX.",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Músicas Personalizadas | A música perfeita para quem você ama",
    description:
      "Músicas personalizadas para aniversários, declarações e momentos especiais. Pronto em minutos pelo WhatsApp.",
    type: "website",
    locale: "pt_BR",
    siteName: "Músicas Personalizadas",
    images: [{ url: "/logo.png", width: 800, height: 800, alt: "Músicas Personalizadas" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Músicas Personalizadas | A música perfeita para quem você ama",
    description:
      "Músicas personalizadas para momentos especiais. Via PIX.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakarta.variable} ${beVietnam.variable} ${caveat.variable} font-body antialiased`}>
        {children}
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </body>
    </html>
  );
}
