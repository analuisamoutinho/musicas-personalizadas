// mascotinhos/apps/web/src/lib/gerar-letra.ts
//
// Geração de música personalizada em 3 blocos independentes.
// Insight do grupo de networking: separar título, estilo e letra
// melhora muito a qualidade — evita o modelo misturar tudo num prompt só.

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type BriefingMusica = {
  nomeHomenageado: string;   // só o PRIMEIRO nome (evita falso positivo de "famoso")
  vinculo: string;           // ex: "namorada", "mãe", "amigo de infância"
  historia: string;          // relato livre do cliente
  ritmo: string;             // ex: "sertanejo universitário", "pagode romântico"
  voz: "MASCULINA" | "FEMININA";
  fraseFinal?: string;       // frase obrigatória no final, se o cliente pediu
};

export type ResultadoGeracaoMusica = {
  titulo: string;
  estiloDetalhado: string;   // para copiar no campo "Style" do Suno/Kie
  letra: string;             // letra completa, pronta para copiar
  promptSuno: string;        // prompt compacto (≤450 chars) para o campo Prompt do Suno
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function chamarOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${erro}`);
  }

  const data = await response.json();
  const conteudo = data.choices?.[0]?.message?.content as string | undefined;
  if (!conteudo) throw new Error("OpenAI não retornou conteúdo.");
  return conteudo.trim();
}

/** Extrai apenas o primeiro nome para evitar que a IA confunda com famoso. */
function extrairPrimeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome.trim();
}

// ─── BLOCO 1 — Título ─────────────────────────────────────────────────────────

async function gerarTitulo(briefing: BriefingMusica): Promise<string> {
  const system = `Você cria títulos curtos e emocionais para músicas personalizadas.
Retorne APENAS o título — sem aspas, sem explicação, sem pontuação extra.
Máximo de 6 palavras. Deve soar como título de música real do estilo ${briefing.ritmo}.`;

  const user = `Nome: ${extrairPrimeiroNome(briefing.nomeHomenageado)}
Vínculo: ${briefing.vinculo}
História resumida: ${briefing.historia.slice(0, 300)}
Estilo: ${briefing.ritmo}`;

  return chamarOpenAI(system, user);
}

// ─── BLOCO 2 — Estilo detalhado ───────────────────────────────────────────────

async function gerarEstiloDetalhado(briefing: BriefingMusica, titulo: string): Promise<string> {
  const system = `Você descreve estilos musicais de forma técnica e precisa para uso no Suno/Kie.ai.
Retorne APENAS a descrição do estilo — sem explicação, sem título, sem letra.
Formato: [estilo principal], [BPM estimado], [instrumentos principais], [voz: masculina/feminina], [mood]
Máximo de 80 palavras.`;

  const user = `Título da música: ${titulo}
Estilo pedido pelo cliente: ${briefing.ritmo}
Voz: ${briefing.voz === "MASCULINA" ? "masculina" : "feminina"}
Mood geral da história: ${briefing.historia.slice(0, 200)}`;

  return chamarOpenAI(system, user);
}

// ─── BLOCO 3 — Letra ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT_LETRA = `Você é um compositor profissional, especializado em transformar histórias reais enviadas por clientes em músicas completas, emocionantes e prontas para gravação. Sempre que eu enviar um texto contando uma história, você deve automaticamente transformá-lo em uma música completa, seguindo todas as regras abaixo, sem pedir mais informações.

🔹 REGRAS FUNDAMENTAIS
Transformar TODO o texto enviado em música
Não inventar fatos: usar apenas o que foi contado
Não alterar o sentido da história
Organizar a narrativa musicalmente: começo → desenvolvimento → clímax → final
Linguagem simples, humana, emocional e cantável
A música deve ter duração equivalente a 3 minutos — no máximo 3 minutos e meio
Não soar como: relato de boletim / texto frio / livro literário longo
Estrofes devem ser respiradas, naturais e musicais

🔹 RIMAS E CONEXÃO
Evitar totalmente rimas forçadas
Usar rimas apenas quando forem naturais
Cada verso deve ter conexão lógica e emocional com o anterior
A letra deve fluir como uma conversa cantada, orgânica e verdadeira

🔹 TRATAMENTO DE TEMAS SENSÍVEIS
Dores, perdas, pobreza, doença, separações → tratar com respeito e sutileza
Evitar detalhamento excessivo
Priorizar emoção, superação e sentimento — sem peso excessivo

🔹 ESTRUTURA OBRIGATÓRIA
Início: como tudo começou
Meio: desafios, lutas, superações (sutis)
Clímax emocional bem construído
Final: amor, esperança, promessa ou declaração

⚠️ NUNCA USAR: "Verso 1", "Verso 2", "Refrão", "Ponte", "Pré-refrão" ou títulos técnicos
A letra deve vir corrida, como música pronta para cantar.

🔹 FORMATAÇÃO FINAL
❌ Não usar emojis
❌ Não explicar nada
❌ Não comentar o processo
✅ Entregar somente a letra da música
✅ Sempre na primeira pessoa
✅ Datas sempre por extenso
✅ Usar apenas o PRIMEIRO NOME do homenageado (nunca nome completo)`;

async function gerarLetraCompleta(briefing: BriefingMusica, titulo: string): Promise<string> {
  const primeiroNome = extrairPrimeiroNome(briefing.nomeHomenageado);

  const vozPerspectiva =
    briefing.voz === "MASCULINA"
      ? "ele cantando pra ela"
      : "ela cantando pra ele";

  const partes: string[] = [
    `Título da música: ${titulo}`,
    `Nome do homenageado (use APENAS esse): ${primeiroNome}`,
    `Vínculo: ${briefing.vinculo}`,
    `\nHistória e detalhes:\n${briefing.historia}`,
    `\nEstilo musical: ${briefing.ritmo}`,
    `Perspectiva da voz: ${vozPerspectiva}`,
  ];

  if (briefing.fraseFinal?.trim()) {
    partes.push(
      `\nFrase final obrigatória (colocar EXATAMENTE assim, sem alterar nenhuma palavra): "${briefing.fraseFinal.trim()}"`,
    );
  }

  partes.push("\nnova música");

  return chamarOpenAI(SYSTEM_PROMPT_LETRA, partes.join("\n"));
}

// ─── BLOCO 4 — Prompt compacto para Suno/Kie ─────────────────────────────────
// Baseado no insight do grupo: prompt limpo com máx. 450 chars
// Campos: NOME, VINCULO, MENSAGEM, ESTILO — sem frases do atendimento

async function gerarPromptSuno(briefing: BriefingMusica, titulo: string): Promise<string> {
  const system = `Você é um engenheiro de prompts musicais para Suno/Kie.ai.
Receba o briefing do cliente e transforme em um prompt limpo para gerar uma música personalizada.

Use SOMENTE:
NOME (apenas o primeiro nome)
VINCULO
MENSAGEM (essência emocional da história, sem detalhes desnecessários)
ESTILO

NUNCA inclua:
- Mensagens da atendente
- Frases sobre pagamento, prévia, Pix, visualização única
- Instruções do fluxo de atendimento
- Fatos inventados

Preserve: nomes, história, emoção e estilo musical.
Entregue APENAS o prompt final, direto e pronto para a Kie.ai/Suno.
LIMITE ABSOLUTO: 450 caracteres. Conte os caracteres antes de responder.`;

  const user = `Nome: ${extrairPrimeiroNome(briefing.nomeHomenageado)}
Vínculo: ${briefing.vinculo}
História: ${briefing.historia.slice(0, 400)}
Estilo: ${briefing.ritmo}
Voz: ${briefing.voz === "MASCULINA" ? "masculina" : "feminina"}
Título: ${titulo}`;

  const prompt = await chamarOpenAI(system, user);

  // Garantir que não passa de 450 caracteres
  return prompt.slice(0, 450);
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function gerarMusica(briefing: BriefingMusica): Promise<ResultadoGeracaoMusica> {
  // Os 3 blocos independentes — rodam em paralelo onde possível
  const titulo = await gerarTitulo(briefing);

  // Bloco 2 e 3 dependem do título, mas não um do outro — paralelo
  const [estiloDetalhado, letra] = await Promise.all([
    gerarEstiloDetalhado(briefing, titulo),
    gerarLetraCompleta(briefing, titulo),
  ]);

  // Bloco 4 usa título + briefing
  const promptSuno = await gerarPromptSuno(briefing, titulo);

  return {
    titulo,
    estiloDetalhado,
    letra,
    promptSuno,
  };
}

// ─── Compatibilidade com código anterior ─────────────────────────────────────
// Mantém o export `gerarLetra` que já existe nos outros arquivos

export async function gerarLetra(briefing: BriefingMusica): Promise<string> {
  const resultado = await gerarMusica(briefing);
  return resultado.letra;
}
