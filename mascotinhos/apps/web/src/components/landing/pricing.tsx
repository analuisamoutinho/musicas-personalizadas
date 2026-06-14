import { ArrowRight } from "lucide-react";

const perks = [
  "Música totalmente personalizada",
  "Letra com nomes, datas e momentos reais",
  "Entrega rápida no site",
  "Revisão inclusa",
  "Pode ser usada para gravação futura",
  "Texto pronto para compartilhar",
];

export default function Pricing() {
  return (
    <section
      aria-label="Preço"
      className="relative z-[1] px-4 py-24 md:py-28 text-center bg-gradient-to-b from-surface to-[#ffe6ea]"
    >
      <div className="mx-auto max-w-4xl">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-primary mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-primary before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-primary after:rounded-full">
          preço que cabe no coração
        </span>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-on-surface text-[clamp(2.25rem,5vw,4rem)] mt-1.5 mb-2">
          Menos que um <span className="text-primary">combo de hambúrguer</span>.
          <br />
          Dura uma{" "}
          <span className="inline-block bg-tertiary-container px-3 -rotate-[1.5deg] rounded-md">
            vida toda
          </span>
          .
        </h2>

        <div className="relative inline-block bg-white p-10 md:p-14 rounded-[28px] -rotate-[1.5deg] mt-8 shadow-[0_0_0_4px_var(--color-tertiary-container),0_0_0_8px_var(--color-on-surface),0_24px_60px_rgba(177,11,104,0.20)]">
          <span aria-hidden="true" className="absolute -top-7 left-1/2 -translate-x-1/2 rotate-[8deg] text-4xl">
            💛
          </span>

          <div className="text-[13px] font-bold text-on-surface-variant tracking-[0.18em] uppercase">
            Uma música exclusiva
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-on-surface-variant">
            <s className="font-headline text-2xl md:text-3xl font-bold opacity-50">R$ 79,90</s>
            <span className="bg-tertiary-container text-on-surface text-[11px] font-extrabold px-2.5 py-1 rounded-full -rotate-3 shadow-[0_4px_10px_rgba(252,202,109,0.5)]">
              −63%
            </span>
          </div>

          <div className="font-headline font-extrabold text-primary leading-none tracking-[-0.04em] mt-1 mb-2 text-[clamp(5rem,15vw,8.75rem)]">
            <span className="text-4xl align-super mr-1 text-on-surface-variant">R$</span>
            29
            <span className="text-4xl text-on-surface-variant">,90</span>
          </div>

          <div className="text-[13px] font-bold text-primary uppercase tracking-[0.12em] mb-4">
            somente esta semana
          </div>

          <div className="font-script text-[28px] text-on-surface mb-6">
            pague uma vez. a lembrança fica para sempre.
          </div>

          <ul className="text-left max-w-[320px] mx-auto my-6 space-y-1">
            {perks.map((perk) => (
              <li
                key={perk}
                className="flex items-center gap-2.5 py-1.5 text-[15px] text-on-surface before:content-['✓'] before:text-primary before:font-extrabold"
              >
                {perk}
              </li>
            ))}
          </ul>

          <a
            href="/pedido"
            className="inline-flex items-center gap-2.5 bg-gradient-to-br from-primary to-primary-container text-white px-7 py-4 rounded-full font-extrabold text-base -rotate-2 hover:rotate-0 hover:scale-[1.04] transition-all duration-200 sticker-shadow sticker-shadow-hover focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Quero minha música!
            <ArrowRight className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </section>
  );
}
