import Image from "next/image";

interface StyleBrowserProps {
  styles: Array<{
    id: string;
    name: string;
    imageSrc: string;
    whatsappLink: string;
  }>;
}

// Tag emojis indexed by canonical style name. Falls back to ✨ if not matched.
const tagEmoji: Record<string, string> = {
  Princesa: "👑",
  "Jardim Encantado": "🦋",
  Sereia: "🐚",
  Astronauta: "🚀",
  Safari: "🦁",
  "Super-Herói": "💥",
  "Super-Heroi": "💥",
  Fazendinha: "🐮",
};

export default function StyleBrowser({ styles }: StyleBrowserProps) {
  if (styles.length === 0) return null;

  return (
    <section
      aria-labelledby="estilos-heading"
      id="estilos"
      className="relative z-[1] bg-on-surface text-surface py-20 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-6 text-center">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-tertiary-container mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-tertiary-container before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-tertiary-container after:rounded-full">
          os cenários
        </span>
        <h2
          id="estilos-heading"
          className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-surface text-[clamp(2.25rem,5vw,4rem)] mt-1.5 mb-4"
        >
          Doze mundos.
          <br />
          <span className="inline-block bg-tertiary-container text-on-surface px-3 -rotate-[1.5deg] rounded-md">
            Uma estrela só
          </span>
          .
        </h2>
        <p className="max-w-xl mx-auto text-surface/75 text-[17px] mb-12">
          Os mais pedidos pelas mães. Tem mais saindo do forno toda semana.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 md:gap-4">
          {styles.map((style) => (
            <a
              key={style.id}
              href={style.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Quero o estilo ${style.name}, abre o WhatsApp`}
              className="group relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-tertiary-container focus-visible:ring-offset-2 focus-visible:ring-offset-on-surface focus-visible:outline-none"
            >
              <Image
                src={style.imageSrc}
                alt={`Exemplo de mascotinho estilo ${style.name}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 bg-surface/95 text-on-surface text-[13px] font-bold py-2 px-3.5 rounded-full backdrop-blur-md text-center shadow-lg">
                {style.name} {tagEmoji[style.name] ?? "✨"}
              </div>
            </a>
          ))}

          {/* Coming soon tile */}
          <div
            className="aspect-[2/3] rounded-2xl bg-gradient-to-br from-primary-container to-tertiary-container grid place-items-center text-center p-4"
            aria-hidden="true"
          >
            <div>
              <div className="text-white font-extrabold text-lg leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                +5 cenários novos
              </div>
              <div className="font-script text-2xl text-white mt-2">
                vem ver no WhatsApp ✨
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
