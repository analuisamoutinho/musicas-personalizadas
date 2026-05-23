import { env } from "@mascotinhos/env/web";
import prisma from "@mascotinhos/db";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import LiveTicker from "@/components/landing/live-ticker";
import HowItWorks from "@/components/landing/how-it-works";
import StyleBrowser from "@/components/styles/style-browser";
import Pricing from "@/components/landing/pricing";
import Testimonials from "@/components/landing/testimonials";
import Footer from "@/components/landing/footer";
import WhatsAppFAB from "@/components/whatsapp-fab";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const revalidate = 3600; // ISR: revalidate every 1 hour

export default async function Home() {
  const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  let templates: { id: string; name: string; slug: string; exampleImages: string[]; tags: string[]; popularity: number }[] = [];
  try {
    templates = await prisma.styleTemplate.findMany({
      where: { active: true },
      orderBy: { popularity: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        exampleImages: true,
        tags: true,
        popularity: true,
      },
    });
  } catch (err) {
    // DB unreachable during build - render with empty styles (ISR will populate on first request)
    console.error(JSON.stringify({ level: "error", event: "home_styles_fetch_failed", error: err instanceof Error ? err.message : String(err), service: "web" }));
  }

  const maxPopularity = templates.length > 0 ? templates[0]!.popularity : 0;

  // Local example images by slug - used until operator uploads real images to Supabase
  const localExampleImages: Record<string, string> = {
    princesa: "/images/portfolio/after-princesa.png",
    safari: "/images/portfolio/after-safari.png",
    "jardim-encantado": "/images/portfolio/after-jardim-encantado.png",
    sereia: "/images/portfolio/after-sereia.png",
    "super-heroi": "/images/portfolio/after-super-heroi.png",
    astronauta: "/images/portfolio/after-astronauta.png",
    fazendinha: "/images/portfolio/after-fazendinha.png",
  };

  const styles = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description:
      t.tags[0] ?? t.name,
    imageSrc:
      t.exampleImages[0] ??
      localExampleImages[t.slug] ??
      `https://placehold.co/280x192/b10b68/ffffff?text=${encodeURIComponent(t.name)}`,
    whatsappLink: buildWhatsAppLink(
      phoneNumber,
      `Oi! Quero mascotinho tema ${t.name}!`,
    ),
    isMostPopular: maxPopularity > 0 && t.popularity === maxPopularity,
  }));

  return (
    <>
      <Navbar phoneNumber={phoneNumber} />
      <main id="main-content" className="relative bg-surface min-h-screen pt-20">
        <div className="confetti-bg fixed inset-0 pointer-events-none z-0" aria-hidden="true" />
        <Hero phoneNumber={phoneNumber} />
        <LiveTicker />
        <HowItWorks />
        <StyleBrowser styles={styles} />
        <Pricing phoneNumber={phoneNumber} />
        <Testimonials />
        <Footer phoneNumber={phoneNumber} />
      </main>
      <WhatsAppFAB phoneNumber={phoneNumber} />
    </>
  );
}
