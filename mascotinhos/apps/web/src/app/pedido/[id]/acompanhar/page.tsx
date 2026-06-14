"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Music, Download, Loader2, CheckCircle, Clock } from "lucide-react";

type Status = {
  orderStatus: string;
  paymentStatus: string;
  musicaTitulo: string | null;
  musicaAudioPreviewUrl: string | null;
  musicaAudioFinalUrl: string | null;
};

const STATUS_LABELS: Record<string, { label: string; emoji: string; description: string }> = {
  PENDING: { label: "Aguardando pagamento", emoji: "⏳", description: "Confirme o pagamento para começarmos." },
  PAID: { label: "Pagamento confirmado", emoji: "✅", description: "Sua música está na fila!" },
  GENERATING: { label: "Criando sua música...", emoji: "🎵", description: "Nossa IA está compondo com carinho. Pode levar alguns minutos." },
  DELIVERED: { label: "Música pronta!", emoji: "🎉", description: "Sua música personalizada está pronta!" },
  CANCELLED: { label: "Pedido cancelado", emoji: "❌", description: "Entre em contato se precisar de ajuda." },
};

export default function AcompanharPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [status, setStatus] = useState<Status | null>(null);
  const [polling, setPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedidos/${orderId}/status`);
      if (!res.ok) return;
      const data: Status = await res.json();
      setStatus(data);
      if (data.orderStatus === "DELIVERED" || data.orderStatus === "CANCELLED") {
        setPolling(false);
      }
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  const info = status ? STATUS_LABELS[status.orderStatus] ?? STATUS_LABELS.PENDING : null;
  const audioUrl = status?.musicaAudioFinalUrl ?? status?.musicaAudioPreviewUrl ?? null;
  const isDelivered = status?.orderStatus === "DELIVERED";

  return (
    <div className="min-h-screen bg-[#fff4f5] flex flex-col">
      <header className="flex items-center px-5 py-4 border-b border-[#f0dde0]">
        <a href="/" className="flex items-center gap-2 text-[#b10b68] font-extrabold text-lg">
          <Music className="w-5 h-5" />
          Músicas Personalizadas
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center px-5 py-8 max-w-md mx-auto w-full">
        {!status ? (
          <div className="flex flex-col items-center gap-3 mt-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : (
          <>
            {/* Status card */}
            <div className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-center mb-6">
              <div className="text-5xl mb-3">{info?.emoji}</div>
              <h1 className="text-xl font-extrabold text-gray-900 mb-1">{info?.label}</h1>
              <p className="text-gray-500 text-sm">{info?.description}</p>

              {status.orderStatus === "GENERATING" && (
                <div className="flex items-center justify-center gap-2 mt-4 text-[#b10b68] text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Criando... atualizando em instantes</span>
                </div>
              )}
            </div>

            {/* Progress steps */}
            <div className="w-full space-y-3 mb-6">
              {[
                { key: ["PAID", "GENERATING", "DELIVERED"], label: "Pagamento confirmado", icon: CheckCircle },
                { key: ["GENERATING", "DELIVERED"], label: "Gerando sua música", icon: Music },
                { key: ["DELIVERED"], label: "Música entregue!", icon: CheckCircle },
              ].map((step, i) => {
                const done = step.key.includes(status.orderStatus);
                const active = step.key[0] === status.orderStatus;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${done ? "bg-[#b10b68]/5" : "bg-gray-50"}`}>
                    {active && !done ? (
                      <Loader2 className="w-5 h-5 text-[#b10b68] animate-spin flex-shrink-0" />
                    ) : (
                      <step.icon className={`w-5 h-5 flex-shrink-0 ${done ? "text-[#b10b68]" : "text-gray-300"}`} />
                    )}
                    <span className={`text-sm font-semibold ${done ? "text-gray-800" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                    {done && !active && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                  </div>
                );
              })}
            </div>

            {/* Audio player */}
            {audioUrl && (
              <div className="w-full bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                {status.musicaTitulo && (
                  <p className="font-bold text-gray-900 text-center">🎵 {status.musicaTitulo}</p>
                )}
                <audio controls className="w-full" src={audioUrl}>
                  Seu navegador não suporta o player de áudio.
                </audio>
                <a
                  href={audioUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full bg-[#b10b68] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#95095a] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Baixar música
                </a>
              </div>
            )}

            {!isDelivered && (
              <div className="flex items-center gap-2 text-gray-400 text-xs mt-4">
                <Clock className="w-3 h-3" />
                <span>Esta página atualiza automaticamente</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
