import { ArrowRight } from "lucide-react";

export default function FinalCta() {
  return (
    <section
      aria-label="Chamada final"
      className="relative z-[1] px-4 py-24 md:py-32 text-center bg-gradient-to-b from-[#ffe6ea] to-[#fff4f5]"
    >
      <div className="mx-auto max-w-3xl">
        <p className="font-headline font-extrabold text-on-surface-variant text-xl md:text-2xl mb-2">
          Existem presentes que acabam.
        </p>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.0] text-on-surface text-[clamp(2.5rem,6vw,4.5rem)] mt-2 mb-6">
          Existem presentes que{" "}
          <span className="text-primary">ficam para sempre.</span>
        </h2>
        <p className="max-w-xl mx-auto text-on-surface-variant text-lg mb-10">
          Uma música personalizada guarda histórias, sentimentos e momentos
          que nenhuma foto consegue contar. Surpreenda alguém especial hoje.
        </p>
        <a
          href="/pedido"
          className="inline-flex items-center gap-3 bg-gradient-to-br from-primary to-primary-container text-white px-9 py-5 rounded-full font-extrabold text-lg -rotate-2 hover:rotate-0 hover:scale-[1.04] transition-all duration-200 sticker-shadow sticker-shadow-hover focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Quero transformar minha história em música
          <ArrowRight className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
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
