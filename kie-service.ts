// mascotinhos/apps/web/src/lib/kie-service.ts
//
// Integração com Kie.ai Suno API para geração de áudio automatizada.
// Docs: https://docs.kie.ai/suno-api/generate-music
//
// Fluxo:
// 1. POST /api/v1/generate → retorna taskId
// 2. Kie.ai chama nosso callBackUrl quando termina (webhook)
//    OU fazemos polling via GET /api/v1/music-task com o taskId

const KIE_API_BASE = "https://api.kie.ai";
const KIE_API_KEY  = process.env.KIE_API_KEY!;

// URL do nosso webhook que a Kie.ai vai chamar quando terminar
// Precisa ser uma URL pública — funciona em produção (Vercel)
function getCallbackUrl(orderId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://seudominio.vercel.app";
  return `${base}/api/webhooks/kie?orderId=${orderId}`;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type KieGeracaoInput = {
  titulo: string;
  letra: string;           // letra completa (bloco 3)
  estiloDetalhado: string; // descrição de estilo (bloco 2) — campo "style" do Suno
  voz: "MASCULINA" | "FEMININA";
  orderId: string;
};

export type KieResultado = {
  taskId: string;
  audioUrl?: string;       // preenchido quando concluído
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
};

// ─── Iniciar geração ──────────────────────────────────────────────────────────

export async function iniciarGeracaoKie(input: KieGeracaoInput): Promise<string> {
  const body = {
    customMode: true,
    instrumental: false,           // tem letra
    model: "V5_5",                 // modelo mais recente
    title: input.titulo.slice(0, 80),
    prompt: input.letra,           // a letra vai no campo prompt em custom mode
    style: input.estiloDetalhado.slice(0, 1000),
    vocalGender: input.voz === "MASCULINA" ? "m" : "f",
    callBackUrl: getCallbackUrl(input.orderId),
  };

  const response = await fetch(`${KIE_API_BASE}/api/v1/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Kie.ai error ${response.status}: ${erro}`);
  }

  const data = await response.json();

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Kie.ai resposta inválida: ${JSON.stringify(data)}`);
  }

  return data.data.taskId as string;
}

// ─── Polling de status (fallback se webhook não chegar) ───────────────────────

export async function consultarStatusKie(taskId: string): Promise<KieResultado> {
  const response = await fetch(
    `${KIE_API_BASE}/api/v1/music-task?taskId=${taskId}`,
    {
      headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Kie.ai status error ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`Kie.ai status inválido: ${JSON.stringify(data)}`);
  }

  const taskData = data.data;
  const status   = taskData.status as string;

  // Kie retorna dois áudios — pegamos o primeiro
  const sunoData = taskData.response?.sunoData?.[0];

  return {
    taskId,
    audioUrl: sunoData?.audioUrl,
    status:
      status === "SUCCESS"    ? "SUCCESS"    :
      status === "FAILED"     ? "FAILED"     :
      status === "PROCESSING" ? "PROCESSING" :
      "PENDING",
  };
}

// ─── Polling com retry (usado quando webhook falha) ───────────────────────────
// Tenta por até 10 minutos a cada 20 segundos

export async function aguardarGeracaoKie(
  taskId: string,
  maxTentativas = 30,
  intervalMs    = 20_000,
): Promise<KieResultado> {
  for (let i = 0; i < maxTentativas; i++) {
    const resultado = await consultarStatusKie(taskId);

    if (resultado.status === "SUCCESS" || resultado.status === "FAILED") {
      return resultado;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Kie.ai timeout após ${maxTentativas} tentativas`);
}
