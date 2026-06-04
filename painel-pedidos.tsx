// mascotinhos/apps/web/src/app/painel/page.tsx
// Painel de gestão de pedidos de música personalizada

"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Status =
  | "BRIEFING_RECEBIDO"
  | "LETRA_GERADA"
  | "AGUARDANDO_AUDIO"
  | "PREVIEW_ENVIADO"
  | "AGUARDANDO_PAGAMENTO"
  | "PAGO"
  | "ENTREGUE";

type Ritmo =
  | "SERTANEJO_UNIVERSITARIO"
  | "SERTANEJO_ROMANTICO"
  | "PAGODE_ROMANTICO"
  | "POP_ROMANTICO"
  | "GOSPEL_LEVE";

type Voz = "MASCULINA" | "FEMININA";

type Pedido = {
  id: string;
  criadoEm: string;
  telefone: string;
  nomeHomenageado: string;
  vinculo?: string;
  historia: string;
  ritmo: Ritmo;
  voz: Voz;
  fraseFinal?: string;
  // resultado dos 3 blocos
  titulo?: string;
  estiloDetalhado?: string;
  letra?: string;
  promptSuno?: string;
  letraGeradaEm?: string;
  status: Status;
  audioPreviewUrl?: string;
  audioFinalUrl?: string;
  pagoEm?: string;
  entregueEm?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; cor: string; next?: Status }> = {
  BRIEFING_RECEBIDO:     { label: "Briefing recebido",      cor: "#6366f1", next: "LETRA_GERADA" },
  LETRA_GERADA:          { label: "Letra gerada",           cor: "#8b5cf6", next: "AGUARDANDO_AUDIO" },
  AGUARDANDO_AUDIO:      { label: "Aguardando áudio",       cor: "#f59e0b", next: "PREVIEW_ENVIADO" },
  PREVIEW_ENVIADO:       { label: "Preview enviado",        cor: "#3b82f6", next: "AGUARDANDO_PAGAMENTO" },
  AGUARDANDO_PAGAMENTO:  { label: "Aguard. pagamento",      cor: "#f97316", next: "PAGO" },
  PAGO:                  { label: "Pago ✓",                 cor: "#10b981", next: "ENTREGUE" },
  ENTREGUE:              { label: "Entregue ✓",             cor: "#059669" },
};

const RITMO_LABEL: Record<Ritmo, string> = {
  SERTANEJO_UNIVERSITARIO: "Sertanejo univ.",
  SERTANEJO_ROMANTICO:     "Sertanejo rom.",
  PAGODE_ROMANTICO:        "Pagode rom.",
  POP_ROMANTICO:           "Pop rom.",
  GOSPEL_LEVE:             "Gospel leve",
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PainelPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<Status | "TODOS">("TODOS");
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);
  const [buscando, setBuscando] = useState("");

  const buscarPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/pedidos");
      const data = await res.json();
      setPedidos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscarPedidos();
    const intervalo = setInterval(buscarPedidos, 15000); // atualiza a cada 15s
    return () => clearInterval(intervalo);
  }, [buscarPedidos]);

  const pedidosFiltrados = pedidos.filter((p) => {
    const matchStatus = filtroStatus === "TODOS" || p.status === filtroStatus;
    const matchBusca =
      buscando === "" ||
      p.nomeHomenageado.toLowerCase().includes(buscando.toLowerCase()) ||
      p.telefone.includes(buscando);
    return matchStatus && matchBusca;
  });

  const contadores = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s as Status] = pedidos.filter((p) => p.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  return (
    <div style={estilos.root}>
      {/* ── Header ── */}
      <header style={estilos.header}>
        <div>
          <h1 style={estilos.titulo}>🎵 Músicas Personalizadas</h1>
          <p style={estilos.subtitulo}>{pedidos.length} pedidos no total</p>
        </div>
        <div style={estilos.headerAcoes}>
          <input
            placeholder="Buscar por nome ou telefone…"
            value={buscando}
            onChange={(e) => setBuscando(e.target.value)}
            style={estilos.inputBusca}
          />
          <button onClick={buscarPedidos} style={estilos.btnAtualizar}>
            ↻ Atualizar
          </button>
        </div>
      </header>

      {/* ── Contadores de status ── */}
      <div style={estilos.contadoresWrap}>
        <button
          style={{ ...estilos.contador, ...(filtroStatus === "TODOS" ? estilos.contadorAtivo : {}) }}
          onClick={() => setFiltroStatus("TODOS")}
        >
          <span style={estilos.contadorNum}>{pedidos.length}</span>
          <span style={estilos.contadorLabel}>Todos</span>
        </button>
        {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => (
          <button
            key={s}
            style={{
              ...estilos.contador,
              borderTop: `3px solid ${STATUS_CONFIG[s].cor}`,
              ...(filtroStatus === s ? estilos.contadorAtivo : {}),
            }}
            onClick={() => setFiltroStatus(s)}
          >
            <span style={{ ...estilos.contadorNum, color: STATUS_CONFIG[s].cor }}>
              {contadores[s]}
            </span>
            <span style={estilos.contadorLabel}>{STATUS_CONFIG[s].label}</span>
          </button>
        ))}
      </div>

      {/* ── Tabela de pedidos ── */}
      <div style={estilos.tabelaWrap}>
        {carregando ? (
          <div style={estilos.vazio}>Carregando pedidos…</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={estilos.vazio}>Nenhum pedido encontrado.</div>
        ) : (
          <table style={estilos.tabela}>
            <thead>
              <tr>
                {["Data", "Homenageado", "Telefone", "Ritmo", "Voz", "Status", "Ações"].map((h) => (
                  <th key={h} style={estilos.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((p) => (
                <tr key={p.id} style={estilos.tr}>
                  <td style={estilos.td}>{formatarData(p.criadoEm)}</td>
                  <td style={{ ...estilos.td, fontWeight: 600 }}>{p.nomeHomenageado}</td>
                  <td style={estilos.td}>{p.telefone}</td>
                  <td style={estilos.td}>{RITMO_LABEL[p.ritmo]}</td>
                  <td style={estilos.td}>{p.voz === "FEMININA" ? "👩 Feminina" : "👨 Masculina"}</td>
                  <td style={estilos.td}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={estilos.td}>
                    <button
                      style={estilos.btnVer}
                      onClick={() => setPedidoAberto(p)}
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal de detalhe ── */}
      {pedidoAberto && (
        <ModalPedido
          pedido={pedidoAberto}
          onFechar={() => setPedidoAberto(null)}
          onAtualizar={(pedidoAtualizado) => {
            setPedidos((prev) =>
              prev.map((p) => (p.id === pedidoAtualizado.id ? pedidoAtualizado : p))
            );
            setPedidoAberto(pedidoAtualizado);
          }}
        />
      )}
    </div>
  );
}

// ─── Badge de status ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      background: cfg.cor + "20",
      color: cfg.cor,
      border: `1px solid ${cfg.cor}40`,
      borderRadius: 20,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Modal de detalhe do pedido ───────────────────────────────────────────────

function ModalPedido({
  pedido,
  onFechar,
  onAtualizar,
}: {
  pedido: Pedido;
  onFechar: () => void;
  onAtualizar: (p: Pedido) => void;
}) {
  const [aba, setAba] = useState<"briefing" | "letra" | "acoes">("briefing");
  const [processando, setProcessando] = useState(false);
  const [urlAudio, setUrlAudio] = useState(pedido.audioPreviewUrl ?? "");
  const [urlFinal, setUrlFinal] = useState(pedido.audioFinalUrl ?? "");

  async function retentarLetra() {
    setProcessando(true);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/retentar-letra`, { method: "POST" });
      const data = await res.json();
      onAtualizar(data);
    } finally {
      setProcessando(false);
    }
  }

  async function avancarStatus() {
    const cfg = STATUS_CONFIG[pedido.status];
    if (!cfg.next) return;
    setProcessando(true);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: cfg.next }),
      });
      const data = await res.json();
      onAtualizar(data);
    } finally {
      setProcessando(false);
    }
  }

  async function salvarAudioPreview() {
    setProcessando(true);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioPreviewUrl: urlAudio,
          status: "AGUARDANDO_AUDIO",
        }),
      });
      const data = await res.json();
      onAtualizar(data);
    } finally {
      setProcessando(false);
    }
  }

  async function salvarAudioFinal() {
    setProcessando(true);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioFinalUrl: urlFinal,
          status: "PAGO",
        }),
      });
      const data = await res.json();
      onAtualizar(data);
    } finally {
      setProcessando(false);
    }
  }

  const cfg = STATUS_CONFIG[pedido.status];

  return (
    <div style={estilos.overlay} onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div style={estilos.modal}>
        {/* Header do modal */}
        <div style={estilos.modalHeader}>
          <div>
            <h2 style={estilos.modalTitulo}>{pedido.nomeHomenageado}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <StatusBadge status={pedido.status} />
              <span style={{ color: "#888", fontSize: 13 }}>{pedido.telefone}</span>
              <span style={{ color: "#888", fontSize: 13 }}>·</span>
              <span style={{ color: "#888", fontSize: 13 }}>{formatarData(pedido.criadoEm)}</span>
            </div>
          </div>
          <button onClick={onFechar} style={estilos.btnFechar}>✕</button>
        </div>

        {/* Abas */}
        <div style={estilos.abas}>
          {(["briefing", "letra", "acoes"] as const).map((a) => (
            <button
              key={a}
              style={{ ...estilos.aba, ...(aba === a ? estilos.abaAtiva : {}) }}
              onClick={() => setAba(a)}
            >
              {{ briefing: "📋 Briefing", letra: "🎤 Letra", acoes: "⚡ Ações" }[a]}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <div style={estilos.modalConteudo}>

          {aba === "briefing" && (
            <div>
              <Campo label="Ritmo">{RITMO_LABEL[pedido.ritmo]}</Campo>
              <Campo label="Voz">{pedido.voz === "FEMININA" ? "Feminina" : "Masculina"}</Campo>
              {pedido.fraseFinal && (
                <Campo label="Frase final obrigatória">
                  <em>"{pedido.fraseFinal}"</em>
                </Campo>
              )}
              <Campo label="História / detalhes">
                <div style={estilos.textoLongo}>{pedido.historia}</div>
              </Campo>
            </div>
          )}

          {aba === "letra" && (
            <div>
              {!pedido.letra ? (
                <div style={estilos.semLetra}>
                  {pedido.status === "BRIEFING_RECEBIDO"
                    ? "A letra está sendo gerada automaticamente…"
                    : "Letra ainda não gerada."}
                  <button
                    style={{ ...estilos.btnAcao, marginTop: 16 }}
                    onClick={retentarLetra}
                    disabled={processando}
                  >
                    {processando ? "Gerando…" : "↻ Gerar agora"}
                  </button>
                </div>
              ) : (
                <>
                  {/* Título */}
                  {pedido.titulo && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Título</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>{pedido.titulo}</div>
                    </div>
                  )}

                  {/* Estilo detalhado — campo Style do Suno */}
                  {pedido.estiloDetalhado && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
                          Estilo <span style={{ color: "#6366f1" }}>(copiar no campo Style do Suno)</span>
                        </div>
                        <button style={estilos.btnSecundario} onClick={() => navigator.clipboard.writeText(pedido.estiloDetalhado!)}>
                          📋 Copiar
                        </button>
                      </div>
                      <div style={{ background: "#f0f0f8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#333", lineHeight: 1.6 }}>
                        {pedido.estiloDetalhado}
                      </div>
                    </div>
                  )}

                  {/* Prompt compacto Suno — ≤450 chars */}
                  {pedido.promptSuno && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
                          Prompt Suno/Kie <span style={{ color: "#888", fontWeight: 400 }}>({pedido.promptSuno.length} chars)</span>
                        </div>
                        <button style={estilos.btnSecundario} onClick={() => navigator.clipboard.writeText(pedido.promptSuno!)}>
                          📋 Copiar
                        </button>
                      </div>
                      <div style={{ background: "#f0f0f8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#333", lineHeight: 1.6 }}>
                        {pedido.promptSuno}
                      </div>
                    </div>
                  )}

                  {/* Letra completa */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>Letra completa</div>
                      <button style={estilos.btnSecundario} onClick={() => navigator.clipboard.writeText(pedido.letra!)}>
                        📋 Copiar letra
                      </button>
                    </div>
                    <div style={estilos.letraWrap}>
                      <pre style={estilos.letraTexto}>{pedido.letra}</pre>
                    </div>
                  </div>

                  <button style={{ ...estilos.btnSecundario, marginTop: 10 }} onClick={retentarLetra} disabled={processando}>
                    ↻ Regenerar tudo
                  </button>
                </>
              )}
            </div>
          )}

          {aba === "acoes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Upload do preview */}
              <div style={estilos.cardAcao}>
                <h4 style={estilos.cardAcaoTitulo}>🎧 URL do áudio preview</h4>
                <p style={estilos.cardAcaoDesc}>
                  Após gerar no Suno, cole aqui a URL do áudio para o preview protegido.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={urlAudio}
                    onChange={(e) => setUrlAudio(e.target.value)}
                    placeholder="https://..."
                    style={estilos.inputUrl}
                  />
                  <button
                    style={estilos.btnAcao}
                    onClick={salvarAudioPreview}
                    disabled={!urlAudio || processando}
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Upload do final */}
              <div style={estilos.cardAcao}>
                <h4 style={estilos.cardAcaoTitulo}>📦 URL do áudio final</h4>
                <p style={estilos.cardAcaoDesc}>
                  Após pagamento confirmado, cole aqui a URL do arquivo final para entrega.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={urlFinal}
                    onChange={(e) => setUrlFinal(e.target.value)}
                    placeholder="https://..."
                    style={estilos.inputUrl}
                  />
                  <button
                    style={estilos.btnAcao}
                    onClick={salvarAudioFinal}
                    disabled={!urlFinal || processando}
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Avançar status manualmente */}
              {cfg.next && (
                <div style={estilos.cardAcao}>
                  <h4 style={estilos.cardAcaoTitulo}>📌 Avançar status manualmente</h4>
                  <p style={estilos.cardAcaoDesc}>
                    Mover de <strong>{cfg.label}</strong> para{" "}
                    <strong>{STATUS_CONFIG[cfg.next].label}</strong>.
                  </p>
                  <button
                    style={{ ...estilos.btnAcao, background: STATUS_CONFIG[cfg.next].cor }}
                    onClick={avancarStatus}
                    disabled={processando}
                  >
                    {processando ? "Salvando…" : `Marcar como "${STATUS_CONFIG[cfg.next].label}"`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campo auxiliar ───────────────────────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "#1a1a2e", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const estilos: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f7f8fc",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    padding: "0 0 40px",
  },
  header: {
    background: "#1a1a2e",
    padding: "20px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  titulo: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
  },
  subtitulo: {
    color: "#8888aa",
    fontSize: 13,
    margin: "4px 0 0",
  },
  headerAcoes: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  inputBusca: {
    background: "#ffffff18",
    border: "1px solid #ffffff22",
    borderRadius: 8,
    color: "#fff",
    padding: "8px 14px",
    fontSize: 14,
    width: 240,
    outline: "none",
  },
  btnAtualizar: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  contadoresWrap: {
    display: "flex",
    gap: 12,
    padding: "20px 32px",
    overflowX: "auto",
    background: "#fff",
    borderBottom: "1px solid #e8e8f0",
  },
  contador: {
    background: "#f7f8fc",
    border: "1px solid #e8e8f0",
    borderRadius: 10,
    padding: "10px 16px",
    cursor: "pointer",
    textAlign: "center",
    minWidth: 90,
    transition: "all 0.15s",
  },
  contadorAtivo: {
    background: "#1a1a2e",
    borderColor: "#1a1a2e",
  },
  contadorNum: {
    display: "block",
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  contadorLabel: {
    display: "block",
    fontSize: 11,
    color: "#666",
    marginTop: 2,
    whiteSpace: "nowrap",
  },
  tabelaWrap: {
    margin: "24px 32px 0",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e8e8f0",
    overflow: "hidden",
  },
  tabela: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 16px",
    background: "#f7f8fc",
    fontSize: 12,
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "left",
    borderBottom: "1px solid #e8e8f0",
  },
  tr: {
    borderBottom: "1px solid #f0f0f8",
  },
  td: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#1a1a2e",
    verticalAlign: "middle",
  },
  btnVer: {
    background: "#6366f115",
    color: "#6366f1",
    border: "1px solid #6366f130",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  vazio: {
    padding: "48px",
    textAlign: "center",
    color: "#888",
    fontSize: 15,
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#00000055",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 640,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 24px 80px #0000003a",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #e8e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: "#1a1a2e",
  },
  btnFechar: {
    background: "none",
    border: "none",
    fontSize: 18,
    color: "#888",
    cursor: "pointer",
    lineHeight: 1,
    padding: 4,
  },
  abas: {
    display: "flex",
    borderBottom: "1px solid #e8e8f0",
    padding: "0 24px",
  },
  aba: {
    background: "none",
    border: "none",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    color: "#888",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -1,
  },
  abaAtiva: {
    color: "#6366f1",
    borderBottomColor: "#6366f1",
  },
  modalConteudo: {
    padding: "20px 24px",
    overflowY: "auto",
    flex: 1,
  },
  textoLongo: {
    background: "#f7f8fc",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    lineHeight: 1.7,
    color: "#333",
    whiteSpace: "pre-wrap",
    maxHeight: 200,
    overflowY: "auto",
  },
  letraWrap: {
    background: "#1a1a2e",
    borderRadius: 10,
    padding: "20px 24px",
    maxHeight: 360,
    overflowY: "auto",
  },
  letraTexto: {
    color: "#e8e8ff",
    fontSize: 14,
    lineHeight: 2,
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    margin: 0,
  },
  semLetra: {
    textAlign: "center",
    color: "#888",
    padding: "32px 0",
    fontSize: 15,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  cardAcao: {
    background: "#f7f8fc",
    border: "1px solid #e8e8f0",
    borderRadius: 10,
    padding: "16px 20px",
  },
  cardAcaoTitulo: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 4px",
  },
  cardAcaoDesc: {
    fontSize: 13,
    color: "#666",
    margin: "0 0 12px",
    lineHeight: 1.5,
  },
  inputUrl: {
    flex: 1,
    border: "1px solid #e8e8f0",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  btnAcao: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnSecundario: {
    background: "#f0f0f8",
    color: "#6366f1",
    border: "1px solid #6366f130",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
