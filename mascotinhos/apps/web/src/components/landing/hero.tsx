import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section aria-label="Início" className="relative px-4 pt-14 pb-12 md:pt-20 md:pb-16 text-center">
      <div className="mx-auto max-w-4xl">
        <span className="inline-flex items-center gap-2 bg-tertiary-container text-on-surface px-4 py-1.5 rounded-full text-xs font-bold -rotate-2 shadow-[0_6px_18px_rgba(252,202,109,0.5)]">
          🎵 mais de 2.347 músicas criadas esse mês
        </span>

        <h1 className="mt-6 mb-6 font-headline font-extrabold leading-[0.95] tracking-[-0.04em] text-on-surface text-[clamp(2.75rem,9vw,6rem)]">
          Transforme uma história real em uma{" "}
          <span className="font-script font-bold text-primary inline-block -rotate-2 text-[0.9em]">
            música que ficará
          </span>{" "}
          para sempre.
        </h1>

        <p className="max-w-xl mx-auto mb-3 text-lg font-medium text-on-surface-variant">
          Transformamos sua história de amor, amizade, família ou superação em uma música personalizada e emocionante — feita especialmente para quem você ama.
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
    </section>
  );
}
