export default function MusicFAB() {
  return (
    <a
      href="/pedido"
      aria-label="Quero minha música personalizada"
      className="fixed bottom-6 right-5 z-50 flex items-center gap-2.5 bg-gradient-to-br from-primary to-primary-container text-white pl-4 pr-5 py-3.5 rounded-full font-extrabold text-sm shadow-[0_8px_28px_rgba(177,11,104,0.45)] hover:scale-105 hover:shadow-[0_12px_36px_rgba(177,11,104,0.55)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span className="text-xl" aria-hidden="true">🎵</span>
      <span className="hidden sm:inline">Quero minha música personalizada</span>
      <span className="sm:hidden">Quero minha música</span>
    </a>
  );
}
