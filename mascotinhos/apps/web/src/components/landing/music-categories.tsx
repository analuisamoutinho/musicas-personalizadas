"use client";

import { useRef, useState, useCallback } from "react";

const categories = [
  {
    emoji: "❤️",
    label: "Para Namorado(a)",
    sub: "Declare seu amor com uma música única",
    gradient: "from-[#ff6b9d] to-[#c44569]",
  },
  {
    emoji: "🎂",
    label: "Aniversário",
    sub: "Faça esse dia ser inesquecível",
    gradient: "from-[#fcca6d] to-[#f0932b]",
  },
  {
    emoji: "👨‍👩‍👧",
    label: "Para os Pais",
    sub: "Uma homenagem que vai fazer chorar",
    gradient: "from-[#6c5ce7] to-[#a29bfe]",
  },
  {
    emoji: "👶",
    label: "Para os Filhos",
    sub: "Eternize o amor mais puro que existe",
    gradient: "from-[#00b894] to-[#55efc4]",
  },
  {
    emoji: "💍",
    label: "Pedido de Casamento",
    sub: "O sim mais emocionante da vida",
    gradient: "from-[#b10b68] to-[#fd79a8]",
  },
  {
    emoji: "👰",
    label: "Casamento",
    sub: "A trilha sonora do seu grande dia",
    gradient: "from-[#0984e3] to-[#74b9ff]",
  },
  {
    emoji: "😭",
    label: "Pedido de Desculpas",
    sub: "Palavras que o coração não consegue dizer",
    gradient: "from-[#636e72] to-[#b2bec3]",
  },
  {
    emoji: "✨",
    label: "Homenagem Especial",
    sub: "Para quem merece ser celebrado",
    gradient: "from-[#e17055] to-[#fdcb6e]",
  },
];

export default function MusicCategories() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    startX.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeft.current = trackRef.current.scrollLeft;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    trackRef.current.scrollLeft = scrollLeft.current - walk;
  }, [isDragging]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <section aria-label="Tipos de música" className="relative z-[1] py-16 md:py-20 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 mb-8 text-center">
        <span className="inline-flex items-center gap-2.5 font-script font-bold text-2xl text-primary mb-1.5 before:content-[''] before:w-8 before:h-0.5 before:bg-primary before:rounded-full after:content-[''] after:w-8 after:h-0.5 after:bg-primary after:rounded-full">
          para cada momento
        </span>
        <h2 className="font-headline font-extrabold tracking-[-0.03em] leading-[1.05] text-on-surface text-[clamp(2rem,4.5vw,3.5rem)] mt-1.5">
          Qual é a <span className="text-primary">sua história</span>?
        </h2>
      </div>

      {/* Carousel */}
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        className={`flex gap-4 overflow-x-auto scroll-smooth pb-4 px-4 md:px-8 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {categories.map((cat) => (
          <a
            key={cat.label}
            href="/pedido"
            draggable={false}
            onClick={(e) => isDragging && e.preventDefault()}
            style={{ scrollSnapAlign: "start" }}
            className={`flex-shrink-0 w-[200px] md:w-[240px] rounded-[22px] bg-gradient-to-br ${cat.gradient} p-6 flex flex-col justify-between aspect-[3/4] shadow-[0_8px_32px_rgba(0,0,0,0.15)] hover:scale-[1.03] transition-transform duration-200 no-underline`}
          >
            <span className="text-5xl md:text-6xl">{cat.emoji}</span>
            <div>
              <p className="text-white font-extrabold text-lg md:text-xl leading-tight mb-1 font-headline">
                {cat.label}
              </p>
              <p className="text-white/75 text-xs md:text-sm font-medium leading-snug">
                {cat.sub}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Fade hint on right */}
      <div className="pointer-events-none absolute right-0 top-[88px] bottom-4 w-16 bg-gradient-to-l from-[#fff4f5] to-transparent" />

      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
