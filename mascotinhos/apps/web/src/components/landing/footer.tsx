import Image from "next/image";
import Link from "next/link";

const internalPageLinks = [
  { label: "Política de Privacidade", href: "/privacy" },
  { label: "Termos de Uso", href: "/terms" },
] as const;

const anchorLinks = [
  { label: "Como Funciona", href: "/#como-funciona" },
  { label: "Fazer Pedido", href: "/pedido" },
] as const;

export default function Footer() {
  return (
    <footer className="relative z-[1] bg-on-surface text-surface px-6 py-14 text-center">
      <div className="mx-auto max-w-3xl flex flex-col items-center gap-3">
        <Image
          src="/logo.svg"
          alt=""
          width={28}
          height={28}
          aria-hidden="true"
          className="h-7 w-7 brightness-0 invert opacity-90"
        />
        <p className="font-headline font-extrabold text-[22px] text-surface">Músicas Personalizadas</p>

        <p className="text-[13px] opacity-70 max-w-md" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} Músicas Personalizadas. Criamos músicas únicas com IA.
        </p>

        <nav
          aria-label="Links do rodapé"
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mt-4"
        >
          {anchorLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="opacity-80 hover:opacity-100 hover:text-tertiary-container transition-colors focus-visible:ring-2 focus-visible:ring-tertiary-container focus-visible:ring-offset-2 focus-visible:ring-offset-on-surface focus-visible:outline-none rounded"
            >
              {link.label}
            </a>
          ))}
          {internalPageLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="opacity-80 hover:opacity-100 hover:text-tertiary-container transition-colors focus-visible:ring-2 focus-visible:ring-tertiary-container focus-visible:ring-offset-2 focus-visible:ring-offset-on-surface focus-visible:outline-none rounded"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-[11px] opacity-60 mt-4">
          Seus dados são protegidos conforme a LGPD.
        </p>
      </div>
    </footer>
  );
}
