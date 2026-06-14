import Image from "next/image";
import { Music } from "lucide-react";

export default function Navbar() {
  return (
    <>
      {/* Skip to main content - first focusable element on page for keyboard/SR users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:outline-none"
      >
        Pular para o conteúdo principal
      </a>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-surface/85">
        <nav
          aria-label="Navegação principal"
          className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-4"
        >
          <a href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="Músicas Personalizadas"
              width={38}
              height={38}
              className="h-9 w-9 -rotate-6"
              priority
            />
            <span className="text-primary font-headline text-xl md:text-[22px] font-extrabold tracking-tight">
              Músicas Personalizadas
            </span>
          </a>
          <a
            href="/pedido"
            className="inline-flex items-center gap-2 bg-on-surface text-white px-5 py-2.5 rounded-full font-bold text-sm -rotate-2 hover:rotate-0 hover:scale-105 transition-transform duration-200 shadow-[0_6px_18px_rgba(0,0,0,0.18)] focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Music className="h-3.5 w-3.5" aria-hidden="true" />
            Quero o meu
          </a>
        </nav>
      </header>
    </>
  );
}
