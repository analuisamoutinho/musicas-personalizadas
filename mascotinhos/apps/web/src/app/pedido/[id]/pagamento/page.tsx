"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Copy, Check, Music, Clock } from "lucide-react";
import Image from "next/image";

export default function PagamentoPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const pixQrCodeBase64 = searchParams.get("qr") ?? "";
  const pixCopyPaste = searchParams.get("pix") ?? "";
  const orderId = params.id;

  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedidos/${orderId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.paymentStatus === "CONFIRMED" || data.orderStatus === "GENERATING" || data.orderStatus === "DELIVERED") {
        setPolling(false);
        router.push(`/pedido/${orderId}/acompanhar`);
      }
    } catch {
      // ignore transient errors
    }
  }, [orderId, router]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [polling, checkStatus]);

  async function copyPix() {
    await navigator.clipboard.writeText(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="min-h-screen bg-[#fff4f5] flex flex-col">
      <header className="flex items-center px-5 py-4 border-b border-[#f0dde0]">
        <a href="/" className="flex items-center gap-2 text-[#b10b68] font-extrabold text-lg">
          <Music className="w-5 h-5" />
          Músicas Personalizadas
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center px-5 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Pague com PIX 💚</h1>
          <p className="text-gray-500 text-sm">
            Assim que o pagamento for confirmado, começamos a criar sua música automaticamente.
          </p>
        </div>

        {/* QR Code */}
        {pixQrCodeBase64 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
            <Image
              src={`data:image/png;base64,${pixQrCodeBase64}`}
              alt="QR Code PIX"
              width={240}
              height={240}
              className="mx-auto rounded-xl"
            />
          </div>
        )}

        {/* Copy paste */}
        {pixCopyPaste && (
          <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">PIX Copia e Cola</p>
            <p className="text-xs text-gray-600 break-all font-mono bg-gray-50 rounded-lg p-3 mb-3 leading-relaxed">
              {pixCopyPaste}
            </p>
            <button
              onClick={copyPix}
              className="w-full flex items-center justify-center gap-2 bg-[#b10b68] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#95095a] transition-all"
            >
              {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código PIX</>}
            </button>
          </div>
        )}

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Aguardando confirmação do pagamento...</span>
        </div>

        <div className="mt-6 bg-[#fcca6d]/20 rounded-2xl p-4 text-sm text-gray-700 space-y-1">
          <p className="font-bold">💡 Como pagar:</p>
          <p>1. Abra o app do seu banco</p>
          <p>2. Escolha PIX → QR Code ou Copia e Cola</p>
          <p>3. Escaneie o QR code ou cole o código</p>
          <p>4. Confirme o pagamento de <strong>R$ 29,90</strong></p>
        </div>
      </main>
    </div>
  );
}
