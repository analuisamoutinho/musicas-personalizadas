"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Music } from "lucide-react";

const RITMOS = [
  { value: "SERTANEJO_UNIVERSITARIO", label: "Sertanejo Universitário" },
  { value: "SERTANEJO_ROMANTICO", label: "Sertanejo Romântico / Arrocha" },
  { value: "PAGODE_ROMANTICO", label: "Pagode Romântico" },
  { value: "POP_ROMANTICO", label: "Pop Romântico" },
  { value: "GOSPEL", label: "Gospel" },
  { value: "FUNK", label: "Funk" },
];

const VINCULOS = [
  "Filho(a)", "Esposo(a)", "Namorado(a)", "Mãe", "Pai", "Irmão(ã)",
  "Avó / Avô", "Amigo(a)", "Outro",
];

type FormData = {
  nomeHomenageado: string;
  vinculo: string;
  historia: string;
  fraseFinal: string;
  ritmo: string;
  voz: string;
  nomeCliente: string;
  email: string;
};

export default function PedidoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<FormData>({
    nomeHomenageado: "",
    vinculo: "",
    historia: "",
    fraseFinal: "",
    ritmo: "SERTANEJO_UNIVERSITARIO",
    voz: "FEMININA",
    nomeCliente: "",
    email: "",
  });

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function canNext() {
    if (step === 1) return form.nomeHomenageado.trim() && form.vinculo;
    if (step === 2) return form.historia.trim().length >= 20;
    if (step === 3) return form.ritmo && form.voz;
    if (step === 4) return form.nomeCliente.trim() && form.email.includes("@");
    return false;
  }

  async function submit() {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/pedidos/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao criar pedido");
      router.push(`/pedido/${data.orderId}/pagamento?qr=${encodeURIComponent(data.pixQrCodeBase64)}&pix=${encodeURIComponent(data.pixCopyPaste)}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar pedido");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fff4f5] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[#f0dde0]">
        <a href="/" className="flex items-center gap-2 text-[#b10b68] font-extrabold text-lg">
          <Music className="w-5 h-5" />
          Músicas Personalizadas
        </a>
        <span className="text-sm text-gray-500 font-medium">Etapa {step} de 4</span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-[#f0dde0]">
        <div
          className="h-1 bg-[#b10b68] transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-start px-5 py-8 max-w-lg mx-auto w-full">
        {/* Step 1 */}
        {step === 1 && (
          <div className="w-full space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Quem vai receber? 🎵</h1>
              <p className="text-gray-500 text-sm">A música será feita especialmente para essa pessoa.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome de quem vai receber</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#b10b68] bg-white"
                  placeholder="Ex: Maria, João, Mãe..."
                  value={form.nomeHomenageado}
                  onChange={(e) => update("nomeHomenageado", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Qual é o vínculo?</label>
                <div className="flex flex-wrap gap-2">
                  {VINCULOS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update("vinculo", v)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                        form.vinculo === v
                          ? "bg-[#b10b68] text-white border-[#b10b68]"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#b10b68]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="w-full space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Conta a história 💛</h1>
              <p className="text-gray-500 text-sm">
                Quanto mais detalhes, mais especial fica a música. Pode contar a ocasião, memórias, por que essa pessoa é especial...
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  História / mensagem <span className="font-normal text-gray-400">(mínimo 20 caracteres)</span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#b10b68] bg-white resize-none"
                  rows={5}
                  placeholder={`Ex: Minha mãe sempre acordou cedo pra fazer o café antes de todo mundo levantar. Ela é meu porto seguro há 30 anos...`}
                  value={form.historia}
                  onChange={(e) => update("historia", e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">{form.historia.length} caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Frase final da música <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#b10b68] bg-white"
                  placeholder='Ex: "Te amo pra sempre, filha"'
                  value={form.fraseFinal}
                  onChange={(e) => update("fraseFinal", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="w-full space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Estilo da música 🎶</h1>
              <p className="text-gray-500 text-sm">Escolha o ritmo e o tipo de voz.</p>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ritmo</label>
                <div className="space-y-2">
                  {RITMOS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => update("ritmo", r.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                        form.ritmo === r.value
                          ? "bg-[#b10b68] text-white border-[#b10b68]"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#b10b68]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Voz do cantor(a)</label>
                <div className="flex gap-3">
                  {[
                    { value: "FEMININA", label: "Feminina 👩" },
                    { value: "MASCULINA", label: "Masculina 👨" },
                  ].map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => update("voz", v.value)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                        form.voz === v.value
                          ? "bg-[#b10b68] text-white border-[#b10b68]"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#b10b68]"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="w-full space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Quase lá! ✨</h1>
              <p className="text-gray-500 text-sm">Seus dados para receber a música.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu nome</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#b10b68] bg-white"
                  placeholder="Seu nome completo"
                  value={form.nomeCliente}
                  onChange={(e) => update("nomeCliente", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu e-mail</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#b10b68] bg-white"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Você vai receber o link da música por e-mail.</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2 text-sm">
              <p className="font-bold text-gray-800 mb-3">Resumo do pedido</p>
              <p><span className="text-gray-500">Para:</span> <strong>{form.nomeHomenageado}</strong> ({form.vinculo})</p>
              <p><span className="text-gray-500">Ritmo:</span> <strong>{RITMOS.find((r) => r.value === form.ritmo)?.label}</strong></p>
              <p><span className="text-gray-500">Voz:</span> <strong>{form.voz === "FEMININA" ? "Feminina" : "Masculina"}</strong></p>
              <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                <span className="text-gray-500">Valor</span>
                <span className="font-extrabold text-[#b10b68] text-lg">R$ 29,90</span>
              </div>
            </div>

            {erro && <p className="text-red-500 text-sm font-medium">{erro}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="w-full mt-8 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm hover:border-[#b10b68] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex-1 flex items-center justify-center gap-2 bg-[#b10b68] text-white px-6 py-4 rounded-full font-extrabold text-base disabled:opacity-40 hover:bg-[#95095a] transition-all"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canNext() || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-[#b10b68] text-white px-6 py-4 rounded-full font-extrabold text-base disabled:opacity-40 hover:bg-[#95095a] transition-all"
            >
              {loading ? "Gerando PIX..." : "Pagar com PIX — R$ 29,90"}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
