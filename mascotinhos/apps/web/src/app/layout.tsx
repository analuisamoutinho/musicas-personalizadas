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
  title: "Mascotinhos | Sua criança como personagem exclusivo",
  description:
    "Transformamos a foto da sua criança em uma ilustração personalizada para convites, lembranças e topo de bolo. R$29,90 via PIX.",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Mascotinhos | Sua criança como personagem exclusivo",
    description:
      "Ilustrações personalizadas para festas infantis. Convites, lembranças e topo de bolo. R$29,90 via PIX. Pronto em minutos pelo WhatsApp.",
    type: "website",
    locale: "pt_BR",
    siteName: "Mascotinhos",
    images: [{ url: "/logo.png", width: 800, height: 800, alt: "Mascotinhos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mascotinhos | Sua criança como personagem exclusivo",
    description:
      "Ilustrações personalizadas para festas infantis. R$29,90 via PIX.",
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
