import prisma from "@mascotinhos/db";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import LiveTicker from "@/components/landing/live-ticker";
import HowItWorks from "@/components/landing/how-it-works";
import StyleBrowser from "@/components/styles/style-browser";
import Pricing from "@/components/landing/pricing";
import Testimonials from "@/components/landing/testimonials";
import Footer from "@/components/landing/footer";

export const revalidate = 3600; // ISR: revalidate every 1 hour

export default async function Home() {
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
    console.error(JSON.stringify({ level: "error", event: "home_styles_fetch_failed", error: err instanceof Error ? err.message : String(err), service: "web" }));
  }

  const maxPopularity = templates.length > 0 ? templates[0]!.popularity : 0;

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
    description: t.tags[0] ?? t.name,
    imageSrc:
      t.exampleImages[0] ??
      localExampleImages[t.slug] ??
      `https://placehold.co/280x192/b10b68/ffffff?text=${encodeURIComponent(t.name)}`,
    ctaHref: "/pedido",
    isMostPopular: maxPopularity > 0 && t.popularity === maxPopularity,
  }));

  return (
    <>
      <Navbar />
      <main id="main-content" className="relative bg-surface min-h-screen pt-20">
        <div className="confetti-bg fixed inset-0 pointer-events-none z-0" aria-hidden="true" />
        <Hero />
        <LiveTicker />
        <HowItWorks />
        <StyleBrowser styles={styles} />
        <Pricing />
        <Testimonials />
        <Footer />
      </main>
    </>
  );
}
