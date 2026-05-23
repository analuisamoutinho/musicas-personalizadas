"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export default function WhatsAppFAB({ phoneNumber }: { phoneNumber: string }) {
  const [isPulsing, setIsPulsing] = useState(true);
  const waLink = buildWhatsAppLink(phoneNumber, "Oi! Quero fazer meu mascotinho!");

  useEffect(() => {
    const timer = setTimeout(() => setIsPulsing(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Iniciar conversa no WhatsApp"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 bg-gradient-to-br from-primary to-primary-container text-white px-5 py-3.5 rounded-full font-bold text-sm -rotate-2 hover:rotate-0 hover:scale-[1.05] transition-transform duration-200 shadow-[0_0_0_3px_var(--color-tertiary-container),0_12px_32px_rgba(177,11,104,0.36)] focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none max-sm:left-6 max-sm:justify-center"
      style={
        isPulsing
          ? { animation: "whatsapp-pulse 1s ease-in-out infinite" }
          : undefined
      }
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      Quero o meu!
    </a>
  );
}
