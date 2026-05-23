// Hard-coded for now; could later read from `order.completedAt` desc.
// Mix of girl/boy names so the social proof reads inclusive.
const tickerItems = [
  { emoji: "🎂", name: "Helena, 3 anos", action: "virou princesa há 12 minutos" },
  { emoji: "🚀", name: "Lucas, 5 anos", action: "virou astronauta há 18 minutos" },
  { emoji: "🦋", name: "Sofia, 4 anos", action: "virou fadinha há 24 minutos" },
  { emoji: "🦁", name: "Theo, 6 anos", action: "virou explorador há 31 minutos" },
  { emoji: "🐚", name: "Maitê, 4 anos", action: "virou sereia há 38 minutos" },
  { emoji: "💥", name: "Pedro, 7 anos", action: "virou super-herói há 44 minutos" },
];

// Duplicate so the -50% translate forms a seamless loop.
const items = [...tickerItems, ...tickerItems];

export default function LiveTicker() {

  return (
    <div
      aria-label="Pedidos recentes"
      className="relative z-[2] -mx-5 -rotate-[1.2deg] overflow-hidden bg-on-surface text-surface border-y-4 border-tertiary-container py-4"
    >
      <div className="flex w-max gap-[60px] whitespace-nowrap animate-scroll-ticker" aria-hidden="true">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 text-base font-semibold">
            <span aria-hidden="true">{item.emoji}</span>
            <strong className="font-bold">{item.name}</strong>
            <span>{item.action}</span>
            <span aria-hidden="true" className="text-tertiary-container ml-[60px]">★</span>
          </div>
        ))}
      </div>
    </div>
  );
}
