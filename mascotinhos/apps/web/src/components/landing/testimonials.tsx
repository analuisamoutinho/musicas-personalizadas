// Real-voice testimonials. We keep gendered language ("filha"/"filho") in the
// quotes themselves because authentic parent voices ARE gendered — what we
// balance is the *mix* of son and daughter stories so any visiting parent
// sees themselves represented.
const testimonials = [
  {
    quote:
      "Saí chorando quando vi o convite da Helena. Várias amigas me pediram o contato depois.",
    name: "Camila Andrade",
    city: "São Paulo, SP",
    bg: "bg-tertiary-container",
    rotate: "-rotate-2",
    marginTop: "",
    text: "text-on-surface",
    starsColor: "text-on-surface",
  },
  {
    quote:
      "Mãe do Lucas, 5 anos. Virou astronauta e dorme abraçado com o quadro toda noite.",
    name: "Renata Lima",
    city: "Rio de Janeiro, RJ",
    bg: "bg-primary-container",
    rotate: "rotate-[1.8deg]",
    marginTop: "md:mt-5",
    text: "text-white",
    starsColor: "text-tertiary-container",
  },
  {
    quote:
      "Imprimi e coloquei na parede do quarto. Toda visita pergunta de que ateliê é ✨",
    name: "Beatriz Carvalho",
    city: "Belo Horizonte, MG",
    bg: "bg-[#c5e8ff]",
    rotate: "-rotate-[1.5deg]",
    marginTop: "",
    text: "text-on-surface",
    starsColor: "text-on-surface",
  },
];

export default function Testimonials() {
  return (
    <section
      aria-label="Depoimentos"
      className="relative z-[1] px-4 py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl text-center">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-primary mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-primary before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-primary after:rounded-full">
          o que as mães dizem
        </span>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-on-surface text-[clamp(2.25rem,5vw,4rem)] mt-1.5 mb-12">
          Bilhetinhos das nossas <span className="text-primary">clientes</span>.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-md md:max-w-none mx-auto">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className={`relative ${t.bg} ${t.rotate} ${t.marginTop} px-7 pt-7 pb-8 rounded shadow-[0_14px_32px_rgba(53,45,47,0.12)] transition-transform duration-300 hover:rotate-0 hover:-translate-y-1 before:content-[''] before:absolute before:-top-2.5 before:left-1/2 before:-translate-x-1/2 before:w-12 before:h-[18px] before:bg-black/10 before:rounded-sm`}
            >
              <div
                className={`text-sm tracking-[2px] mb-2 ${t.starsColor}`}
                role="img"
                aria-label="5 de 5 estrelas"
              >
                ★★★★★
              </div>
              <blockquote
                className={`font-script font-medium text-2xl leading-[1.3] mb-4 ${t.text}`}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full bg-white/50 grid place-items-center font-bold text-sm ${t.text === "text-white" ? "text-primary" : "text-on-surface"}`}
                  aria-hidden="true"
                >
                  {t.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className={`font-headline font-bold text-[13px] ${t.text === "text-white" ? "text-white" : "text-on-surface"}`}>
                    {t.name}
                  </div>
                  <div className={`text-xs opacity-70 ${t.text === "text-white" ? "text-white" : "text-on-surface"}`}>
                    {t.city}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
