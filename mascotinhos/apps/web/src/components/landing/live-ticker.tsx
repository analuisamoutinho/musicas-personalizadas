const tickerItems = [
  { emoji: "❤️", name: "Juliana, SP", action: "recebeu música para o namorado há 8 minutos" },
  { emoji: "🎂", name: "Camila, GO", action: "recebeu música de aniversário há 14 minutos" },
  { emoji: "👨‍👩‍👧", name: "Rafael, MG", action: "recebeu homenagem para os pais há 21 minutos" },
  { emoji: "💍", name: "Fernanda, SP", action: "recebeu pedido de casamento em música há 29 minutos" },
  { emoji: "✨", name: "Beatriz, RJ", action: "recebeu homenagem especial há 35 minutos" },
  { emoji: "👶", name: "Mariana, PR", action: "recebeu música para os filhos há 42 minutos" },
];

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
