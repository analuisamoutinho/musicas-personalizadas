const benefits = [
  "Escrita exclusivamente para sua história",
  "Feita com nomes, datas e momentos reais",
  "Perfeita para presentes emocionantes",
  "Entrega rápida no site",
  "Pode ser usada para gravação futura",
  "Texto pronto para compartilhar",
];

export default function Benefits() {
  return (
    <section aria-label="Benefícios" className="relative z-[1] px-4 py-20 md:py-24 bg-[#fff4f5]">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-primary mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-primary before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-primary after:rounded-full">
          não é só uma música
        </span>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-on-surface text-[clamp(2.25rem,5vw,4rem)] mt-1.5 mb-4">
          É uma lembrança que{" "}
          <span className="text-primary">ninguém esquece.</span>
        </h2>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
          {benefits.map((b) => (
            <div
              key={b}
              className="flex items-start gap-3 bg-white rounded-2xl px-5 py-4 shadow-[0_4px_16px_rgba(177,11,104,0.07)] border border-[#f5dde5]"
            >
              <span className="text-primary font-extrabold text-xl mt-0.5">✔</span>
              <span className="text-[15px] font-semibold text-on-surface">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
