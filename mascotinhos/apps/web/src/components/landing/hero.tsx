import { ArrowRight } from "lucide-react";

const musicCards = [
  { emoji: "❤️", label: "Para Namorado(a)", pos: "-left-[2%] top-0 w-[110px]", drift: "animate-drift-1", rotate: "-rotate-[7deg]" },
  { emoji: "👨‍👩‍👧", label: "Para os Pais", pos: "left-[28%] top-[28%] w-[120px]", drift: "animate-drift-2", rotate: "rotate-[4deg]" },
  { emoji: "🎂", label: "Aniversário", pos: "left-[50%] top-[4%] w-[130px] z-[2]", drift: "animate-drift-3", rotate: "-rotate-[3deg]" },
  { emoji: "💍", label: "Pedido de Casamento", pos: "hidden sm:block sm:right-[22%] sm:top-[30%] sm:w-[120px]", drift: "animate-drift-1-rev", rotate: "rotate-[6deg]" },
  { emoji: "👰", label: "Casamento", pos: "-right-[2%] top-0 w-[110px]", drift: "animate-drift-2-alt", rotate: "-rotate-[5deg]" },
  { emoji: "👶", label: "Para os Filhos", pos: "left-[8%] bottom-[4%] w-[120px]", drift: "animate-drift-3-rev", rotate: "rotate-[5deg]" },
  { emoji: "😭", label: "Pedido de Desculpas", pos: "hidden sm:block sm:left-[36%] sm:bottom-[4%] sm:w-[120px]", drift: "animate-drift-2", rotate: "-rotate-[2deg]" },
  { emoji: "✨", label: "Homenagem Especial", pos: "right-[8%] bottom-[4%] w-[110px]", drift: "animate-drift-1-slow", rotate: "-rotate-[4deg]" },
];

export default function Hero() {
  return (
    <section aria-label="Início" className="relative px-4 pt-14 pb-8 md:pt-20 md:pb-10">
      <div className="mx-auto max-w-6xl text-center">
        <span className="inline-flex items-center gap-2 bg-tertiary-container text-on-surface px-4 py-1.5 rounded-full text-xs font-bold -rotate-2 shadow-[0_6px_18px_rgba(252,202,109,0.5)]">
          🎵 mais de 2.347 músicas criadas esse mês
        </span>

        <h1 className="mt-6 mb-6 mx-auto max-w-5xl font-headline font-extrabold leading-[0.95] tracking-[-0.04em] text-on-surface text-[clamp(2.5rem,8vw,5.5rem)]">
          Transforme uma história real em uma{" "}
          <span className="font-script font-bold text-primary inline-block -rotate-3 text-[0.95em]">
            música que ficará
          </span>{" "}
          para sempre.
        </h1>

        <p className="max-w-xl mx-auto mb-4 text-lg font-medium text-on-surface-variant">
          Transformamos sua história de amor, amizade, família ou superação em uma música personalizada e emocionante.
          Feita especialmente para quem você ama.
        </p>

        <p className="max-w-md mx-auto mb-8 text-base text-on-surface-variant">
          Receba a letra completa e o áudio direto no site em poucos minutos.
        </p>

        <a
          href="/pedido"
          className="inline-flex items-center gap-3 bg-gradient-to-br from-primary to-primary-container text-white px-8 py-5 md:px-9 md:py-[22px] rounded-full font-extrabold text-lg md:text-[19px] -rotate-3 hover:rotate-[-1deg] hover:scale-[1.04] transition-all duration-200 sticker-shadow sticker-shadow-hover focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Quero minha música personalizada
          <ArrowRight className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={2.5} />
        </a>

        <p className="mt-6 text-sm font-semibold text-on-surface-variant">
          <s className="opacity-50 mr-2">R$ 79,90</s>
          <strong className="text-primary text-[17px]">R$ 29,90</strong>
          {" só essa semana"}
        </p>
      </div>

      {/* Floating music category cards */}
      <div className="mx-auto max-w-6xl">
        <div className="relative h-[420px] sm:h-[500px] lg:h-[640px] mt-10 md:mt-16 mb-6">
          {musicCards.map((card) => (
            <div
              key={card.label}
              className={`float-card absolute ${card.pos} ${card.drift} ${card.rotate} bg-white rounded-2xl p-4 shadow-[0_18px_40px_rgba(53,45,47,0.18)] transition-transform duration-300 cursor-pointer`}
            >
              <div className="flex flex-col items-center justify-center gap-2 py-2">
                <span className="text-4xl sm:text-5xl">{card.emoji}</span>
                <span className="text-[11px] sm:text-xs font-bold text-center text-on-surface leading-tight px-1">{card.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
