import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Three responsive size/position tiers, copied from the mockup so the
// floating gallery doesn't crowd at 375px (small mobile) and reads at scale
// on desktop. Default = small mobile (<sm), sm: = mid tablet, lg: = desktop.
const galleryCards = [
  {
    src: "/images/portfolio/after-princesa.png",
    alt: "Mascotinho estilo princesa",
    tag: "princesa ✨",
    pos:
      "-left-[2%] top-0 w-[100px] h-[140px]" +
      " sm:left-[2%] sm:top-[4%] sm:w-[130px] sm:h-[180px]" +
      " lg:left-[4%] lg:top-[8%] lg:w-[200px] lg:h-[280px]",
    drift: "animate-drift-1",
    rotate: "-rotate-[7deg]",
  },
  {
    src: "/images/portfolio/after-jardim-encantado.png",
    alt: "Mascotinho estilo jardim encantado",
    tag: "jardim encantado 🦋",
    pos:
      "left-[28%] top-[30%] w-[110px] h-[155px]" +
      " sm:left-[24%] sm:top-[32%] sm:w-[150px] sm:h-[210px]" +
      " lg:left-[22%] lg:top-[38%] lg:w-[220px] lg:h-[310px]",
    drift: "animate-drift-2",
    rotate: "rotate-[4deg]",
  },
  {
    src: "/images/portfolio/after-sereia.png",
    alt: "Mascotinho estilo sereia",
    tag: "sereia 🐚",
    pos:
      "left-[50%] top-[4%] w-[120px] h-[168px] z-[2]" +
      " sm:left-[44%] sm:top-[6%] sm:w-[160px] sm:h-[220px]" +
      " lg:left-[42%] lg:top-[10%] lg:w-[240px] lg:h-[340px]",
    drift: "animate-drift-3",
    rotate: "-rotate-[3deg]",
  },
  {
    src: "/images/portfolio/after-astronauta.png",
    alt: "Mascotinho estilo astronauta",
    tag: "astronauta 🚀",
    // Hidden under sm to avoid crowding at 375px (mockup .fc-4 hides at <600px)
    pos:
      "hidden sm:block sm:right-[22%] sm:top-[32%] sm:w-[130px] sm:h-[180px]" +
      " lg:right-[22%] lg:top-[36%] lg:w-[200px] lg:h-[280px]",
    drift: "animate-drift-1-rev",
    rotate: "rotate-[6deg]",
  },
  {
    src: "/images/portfolio/after-safari.png",
    alt: "Mascotinho estilo safari",
    tag: "safari 🦁",
    pos:
      "-right-[2%] top-0 w-[100px] h-[140px]" +
      " sm:right-[2%] sm:top-[2%] sm:w-[120px] sm:h-[160px]" +
      " lg:right-[4%] lg:top-[6%] lg:w-[180px] lg:h-[250px]",
    drift: "animate-drift-2-alt",
    rotate: "-rotate-[5deg]",
  },
  {
    src: "/images/portfolio/after-fazendinha.png",
    alt: "Mascotinho estilo fazendinha",
    tag: "fazendinha 🐮",
    pos:
      "left-[8%] bottom-[4%] w-[110px] h-[155px]" +
      " sm:left-[4%] sm:bottom-[6%] sm:w-[130px] sm:h-[180px]" +
      " lg:left-[8%] lg:bottom-[4%] lg:w-[190px] lg:h-[260px]",
    drift: "animate-drift-3-rev",
    rotate: "rotate-[5deg]",
  },
  {
    src: "/images/portfolio/after-super-heroi.png",
    alt: "Mascotinho estilo super-herói",
    tag: "super-herói 💥",
    pos:
      "right-[8%] bottom-[4%] w-[110px] h-[155px]" +
      " sm:right-[6%] sm:bottom-[6%] sm:w-[140px] sm:h-[190px]" +
      " lg:right-[8%] lg:bottom-[4%] lg:w-[210px] lg:h-[290px]",
    drift: "animate-drift-1-slow",
    rotate: "-rotate-[4deg]",
  },
];

export default function Hero({ phoneNumber }: { phoneNumber: string }) {
  const waLink = buildWhatsAppLink(phoneNumber, "Oi! Quero fazer meu mascotinho!");

  return (
    <section
      aria-label="Início"
      className="relative px-4 pt-14 pb-8 md:pt-20 md:pb-10"
    >
      <div className="mx-auto max-w-6xl text-center">
        <span className="inline-flex items-center gap-2 bg-tertiary-container text-on-surface px-4 py-1.5 rounded-full text-xs font-bold -rotate-2 shadow-[0_6px_18px_rgba(252,202,109,0.5)]">
          🎉 mais de 2.347 mascotinhos esse mês
        </span>

        <h1 className="mt-6 mb-6 mx-auto max-w-5xl font-headline font-extrabold leading-[0.95] tracking-[-0.04em] text-on-surface text-[clamp(2.75rem,9vw,6.5rem)]">
          É a festa da{" "}
          <span className="font-script font-bold text-primary inline-block -rotate-3 text-[0.9em]">
            sua criança.
          </span>
          <br />
          Que ela seja a{" "}
          <span className="relative inline-block">
            <span className="relative z-10">estrela</span>
            <span
              aria-hidden="true"
              className="absolute left-[4%] right-[4%] bottom-1 h-[18%] bg-tertiary-container rounded-full -skew-x-6 -z-0"
            />
          </span>
          .
        </h1>

        <p className="max-w-xl mx-auto mb-8 text-lg font-medium text-on-surface-variant">
          Transformamos sua criança em princesa, fadinha, sereia ou astronauta.
          Para o convite, a lembrancinha ou o topo de bolo. Tudo pelo WhatsApp, em poucos minutos.
        </p>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-gradient-to-br from-primary to-primary-container text-white px-8 py-5 md:px-9 md:py-[22px] rounded-full font-extrabold text-lg md:text-[19px] -rotate-3 hover:rotate-[-1deg] hover:scale-[1.04] transition-all duration-200 sticker-shadow sticker-shadow-hover focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Quero o mascotinho!
          <ArrowRight className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={2.5} />
        </a>

        <p className="mt-6 text-sm font-semibold text-on-surface-variant">
          <s className="opacity-50 mr-2">R$ 79,90</s>
          <strong className="text-primary text-[17px]">R$ 29,90</strong>
          {" só essa semana"}
        </p>
      </div>

      {/* Drifting gallery */}
      <div className="mx-auto max-w-6xl">
        <div className="relative h-[460px] sm:h-[560px] lg:h-[720px] mt-10 md:mt-16 mb-6">
          {galleryCards.map((card) => (
            <div
              key={card.src}
              // `float-card` is the hook for the !important hover rule in
              // globals.css that pauses the drift loop and lifts the card.
              className={`float-card absolute ${card.pos} ${card.drift} ${card.rotate} bg-white rounded-2xl p-3 shadow-[0_18px_40px_rgba(53,45,47,0.18)] transition-transform duration-300 cursor-pointer`}
            >
              <div className="relative w-full h-full overflow-hidden rounded-[10px]">
                <Image
                  src={card.src}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 240px"
                  className="object-cover"
                />
                <div className="absolute bottom-1 left-0 right-0 text-center font-script font-bold text-base sm:text-[18px] text-on-surface drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  {card.tag}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
