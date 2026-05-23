import Image from "next/image";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const internalPageLinks = [
  { label: "Política de Privacidade", href: "/privacy" },
  { label: "Termos de Uso", href: "/terms" },
] as const;

const anchorLinks = [
  { label: "Como Funciona", href: "/#como-funciona" },
  { label: "Contato", href: "/#contato" },
] as const;

/**
 * Formats a local Brazilian phone number (DDD + number, 10-11 digits) into
 * human-readable form. Falls back to raw number if length is unexpected.
 */
function formatBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return local;
}

export default function Footer({ phoneNumber }: { phoneNumber: string }) {
  const waLink = buildWhatsAppLink(phoneNumber, "Oi! Quero fazer meu mascotinho!");
  const displayPhone = formatBrPhone(phoneNumber);

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
        <p className="font-headline font-extrabold text-[22px] text-surface">Mascotinhos</p>

        <p className="text-[13px] opacity-70 max-w-md" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} Mascotinhos. Atendemos pelo WhatsApp.
        </p>

        <p className="text-sm mt-2" id="contato">
          WhatsApp:{" "}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Falar pelo WhatsApp: ${displayPhone}`}
            className="font-bold underline decoration-tertiary-container underline-offset-4 hover:text-tertiary-container transition-colors focus-visible:ring-2 focus-visible:ring-tertiary-container focus-visible:ring-offset-2 focus-visible:ring-offset-on-surface focus-visible:outline-none rounded"
          >
            {displayPhone}
          </a>
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
