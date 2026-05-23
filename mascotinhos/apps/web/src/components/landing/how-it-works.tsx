import WhatsAppPreview from "./whatsapp-preview";

const steps = [
  {
    num: 1,
    scribble: '"manda uma fotinha"',
    title: "Você manda a foto",
    description: "Aquela foto fofa que você ama. Pode ser tirada do celular mesmo.",
    rotate: "-rotate-[2.5deg]",
    marginTop: "",
    scene: 1 as const,
  },
  {
    num: 2,
    scribble: '"escolhe o tema"',
    title: "Escolhe o cenário",
    description: "Princesa, fadinha, sereia, astronauta, safari… mais de 12 temas autorais.",
    rotate: "rotate-[1.5deg]",
    marginTop: "md:mt-4",
    scene: 2 as const,
  },
  {
    num: 3,
    scribble: '"prontinho!"',
    title: "Recebe em minutos",
    description: "O arquivo em alta resolução chega no WhatsApp. Pronto pra imprimir tudo.",
    rotate: "-rotate-[1.8deg]",
    marginTop: "",
    scene: 3 as const,
  },
];

export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-label="Como funciona"
      className="px-4 py-20 md:py-24 relative z-[1]"
    >
      <div className="mx-auto max-w-6xl text-center">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-primary mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-primary before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-primary after:rounded-full">
          como vira mascotinho
        </span>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-on-surface text-[clamp(2.25rem,5vw,4rem)] mt-1.5 mb-4">
          Mais simples
          <br />
          que{" "}
          <span className="inline-block bg-tertiary-container px-3 -rotate-[1.5deg] rounded-md text-on-surface">
            pedir um lanche
          </span>
          .
        </h2>
        <p className="max-w-xl mx-auto text-on-surface-variant text-[17px]">
          Três passos. No WhatsApp. Sem app, sem cadastro, sem bagunça.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-9 mt-14 max-w-sm mx-auto md:max-w-none">
          {steps.map((step) => (
            <div
              key={step.num}
              className={`polaroid ${step.rotate} ${step.marginTop} text-center transition-transform duration-300 hover:rotate-0 hover:-translate-y-1.5`}
            >
              <div className="aspect-[1.1/1] bg-[linear-gradient(135deg,rgba(252,202,109,0.2),rgba(255,109,173,0.15))] rounded relative overflow-hidden mb-4">
                <WhatsAppPreview scene={step.scene} />
                <div className="absolute -top-3.5 -right-3.5 w-11 h-11 rounded-full bg-primary text-white grid place-items-center font-extrabold text-lg -rotate-[8deg] shadow-[0_6px_18px_rgba(177,11,104,0.4)]">
                  {step.num}
                </div>
              </div>
              <span className="font-script text-[22px] text-primary block mb-2">
                {step.scribble}
              </span>
              <h3 className="font-headline font-extrabold text-[22px] tracking-[-0.01em] mt-1 mb-2 text-on-surface">
                {step.title}
              </h3>
              <p className="text-[15px] text-on-surface-variant">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
