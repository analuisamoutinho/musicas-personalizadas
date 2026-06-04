// mascotinhos/apps/web/src/app/painel/dashboard/page.tsx
// Dashboard financeiro + operacional
// Dados de investimento/leads vêm da sua planilha (input manual ou futura integração Meta Ads API)
// Dados de pedidos/prévias/vendas/alterações vêm do banco

"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DiaMetrica = {
  data: string;          // "17/05"
  dia?: string;          // "segunda"
  investido: number;     // vem da planilha / input manual
  leads: number;         // vem da conta de anúncios
  previas: number;       // calculado: pedidos com status >= PREVIEW_ENVIADO
  vendas: number;        // calculado: pedidos com status >= PAGO
  faturado: number;      // calculado: vendas * precoUnitario
  alteracoes: number;    // calculado: soma de revisoes_solicitadas por pedido
};

type Metricas = {
  inv: number;
  fat: number;
  leads: number;
  previas: number;
  vendas: number;
  alt: number;
  lucro: number;
  cpl: number;
  cpv: number;
  txConv: number;
  txAlt: number;
  roas: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularMetricas(rows: DiaMetrica[]): Metricas {
  const inv      = rows.reduce((s, r) => s + r.investido, 0);
  const fat      = rows.reduce((s, r) => s + r.faturado, 0);
  const leads    = rows.reduce((s, r) => s + r.leads, 0);
  const previas  = rows.reduce((s, r) => s + r.previas, 0);
  const vendas   = rows.reduce((s, r) => s + r.vendas, 0);
  const alt      = rows.reduce((s, r) => s + r.alteracoes, 0);
  const lucro    = fat - inv;
  const cpl      = leads  > 0 ? inv / leads  : 0;
  const cpv      = vendas > 0 ? inv / vendas : 0;
  const txConv   = previas > 0 ? (vendas / previas) * 100 : 0;
  const txAlt    = previas > 0 ? (alt    / previas) * 100 : 0;
  const roas     = inv > 0 ? fat / inv : 0;
  return { inv, fat, leads, previas, vendas, alt, lucro, cpl, cpv, txConv, txAlt, roas };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Dashboard() {
  const [dados, setDados] = useState<DiaMetrica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<"7d" | "30d" | "mes">("7d");

  const buscarDados = useCallback(async () => {
    try {
      // Busca pedidos do banco e agrega por dia
      const res = await fetch(`/api/dashboard?periodo=${periodo}`);
      const data = await res.json();
      setDados(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const m = calcularMetricas(dados);

  const cards: { label: string; valor: string; sub?: string; cor?: string }[] = [
    { label: "Investido",          valor: fmt(m.inv) },
    { label: "Faturado",           valor: fmt(m.fat) },
    { label: "Lucro",              valor: fmt(m.lucro),        cor: m.lucro >= 0 ? "verde" : "vermelho" },
    { label: "ROAS",               valor: m.roas.toFixed(1) + "x", cor: m.roas >= 1 ? "verde" : "vermelho" },
    { label: "Leads",              valor: String(m.leads) },
    { label: "Custo por lead",     valor: fmt(m.cpl) },
    { label: "Prévias enviadas",   valor: String(m.previas) },
    { label: "Vendas",             valor: String(m.vendas) },
    { label: "Custo por venda",    valor: m.cpv > 0 ? fmt(m.cpv) : "—" },
    { label: "Conv. prévia→venda", valor: m.txConv.toFixed(0) + "%", sub: "taxa de conversão" },
    { label: "Alterações solicitadas", valor: String(m.alt), sub: `${m.txAlt.toFixed(0)}% das prévias`, cor: m.txAlt > 30 ? "vermelho" : "neutro" },
  ];

  return (
    <div style={e.root}>
      {/* Header */}
      <div style={e.header}>
        <h1 style={e.titulo}>Dashboard</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {(["7d", "30d", "mes"] as const).map((p) => (
            <button
              key={p}
              style={{ ...e.btnPeriodo, ...(periodo === p ? e.btnPeriodoAtivo : {}) }}
              onClick={() => setPeriodo(p)}
            >
              {{ "7d": "7 dias", "30d": "30 dias", mes: "Este mês" }[p]}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div style={e.vazio}>Carregando dados…</div>
      ) : (
        <>
          {/* Cards */}
          <div style={e.cardsGrid}>
            {cards.map((c) => (
              <div key={c.label} style={e.card}>
                <div style={e.cardLabel}>{c.label}</div>
                <div style={{
                  ...e.cardValor,
                  color: c.cor === "verde" ? "#27500A" : c.cor === "vermelho" ? "#A32D2D" : undefined,
                }}>
                  {c.valor}
                </div>
                {c.sub && <div style={e.cardSub}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Gráfico investido vs faturado */}
          <div style={{ ...e.card, margin: "0 24px 16px", padding: "16px 20px" }}>
            <div style={e.cardLabel}>Investido vs Faturado por dia</div>
            <GraficoBarras dados={dados} />
          </div>

          {/* Tabela detalhada */}
          <div style={{ margin: "0 24px" }}>
            <div style={{ ...e.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8e8f0" }}>
                <span style={e.cardLabel}>Detalhamento diário</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={e.tabela}>
                  <thead>
                    <tr>
                      {["Data", "Dia", "Investido", "Leads", "Custo/lead", "Prévias", "Vendas", "Faturado", "Lucro", "Alterações"].map((h) => (
                        <th key={h} style={e.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((r) => {
                      const lucro = r.faturado - r.investido;
                      return (
                        <tr key={r.data} style={e.tr}>
                          <td style={e.td}>{r.data}</td>
                          <td style={{ ...e.td, color: "#888" }}>{r.dia || "—"}</td>
                          <td style={e.td}>{fmt(r.investido)}</td>
                          <td style={e.td}>{r.leads || "—"}</td>
                          <td style={e.td}>{r.leads > 0 ? fmt(r.investido / r.leads) : "—"}</td>
                          <td style={e.td}>{r.previas || "—"}</td>
                          <td style={e.td}>{r.vendas || "—"}</td>
                          <td style={e.td}>{fmt(r.faturado)}</td>
                          <td style={{ ...e.td, color: lucro >= 0 ? "#27500A" : "#A32D2D", fontWeight: 600 }}>
                            {fmt(lucro)}
                          </td>
                          <td style={e.td}>
                            {r.alteracoes}
                            {r.previas > 0 && (
                              <span style={{ color: "#888", fontSize: 11, marginLeft: 4 }}>
                                ({Math.round((r.alteracoes / r.previas) * 100)}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Nota sobre dados manuais */}
            <div style={e.nota}>
              Investido e leads: inseridos manualmente ou via integração com Meta Ads API.
              Prévias, vendas, faturado e alterações: calculados automaticamente a partir dos pedidos.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Gráfico de barras simples ────────────────────────────────────────────────

function GraficoBarras({ dados }: { dados: DiaMetrica[] }) {
  const ativos = dados.filter((r) => r.investido > 0 || r.faturado > 0);
  if (!ativos.length) return <div style={{ color: "#888", fontSize: 13, padding: "16px 0" }}>Sem dados.</div>;

  const maxVal = Math.max(...ativos.flatMap((r) => [r.investido, r.faturado]), 1);
  const H = 100;
  const barW = 18;
  const gap = 8;
  const groupW = barW * 2 + gap;
  const groupGap = 24;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${ativos.length * (groupW + groupGap) + 16} ${H + 24}`}
        style={{ minWidth: ativos.length * 60 }}
      >
        {ativos.map((r, i) => {
          const x = 8 + i * (groupW + groupGap);
          const hInv = Math.round((r.investido / maxVal) * (H - 10));
          const hFat = Math.round((r.faturado / maxVal) * (H - 10));
          return (
            <g key={r.data}>
              <rect x={x}          y={H - hInv} width={barW} height={hInv} rx={3} fill="#AFA9EC" />
              <rect x={x + barW + gap} y={H - hFat} width={barW} height={hFat} rx={3} fill="#5DCAA5" />
              <text x={x + groupW / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="#888">{r.data}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <LegendaItem cor="#AFA9EC" label="Investido" />
        <LegendaItem cor="#5DCAA5" label="Faturado" />
      </div>
    </div>
  );
}

function LegendaItem({ cor, label }: { cor: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888" }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: cor, display: "inline-block" }} />
      {label}
    </span>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const e: Record<string, React.CSSProperties> = {
  root:           { minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 40 },
  header:         { background: "#1a1a2e", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  titulo:         { color: "#fff", fontSize: 18, fontWeight: 600, margin: 0 },
  btnPeriodo:     { background: "transparent", border: "1px solid #ffffff30", color: "#aaa", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  btnPeriodoAtivo:{ background: "#6366f1", borderColor: "#6366f1", color: "#fff" },
  cardsGrid:      { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, padding: "20px 24px 16px" },
  card:           { background: "#fff", border: "1px solid #e8e8f0", borderRadius: 10, padding: "12px 14px" },
  cardLabel:      { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 6 },
  cardValor:      { fontSize: 20, fontWeight: 600, color: "#1a1a2e" },
  cardSub:        { fontSize: 11, color: "#888", marginTop: 3 },
  tabela:         { width: "100%", borderCollapse: "collapse" as const },
  th:             { padding: "10px 12px", background: "#f7f8fc", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase" as const, letterSpacing: 0.8, textAlign: "left" as const, borderBottom: "1px solid #e8e8f0" },
  tr:             { borderBottom: "1px solid #f0f0f8" },
  td:             { padding: "10px 12px", fontSize: 13, color: "#1a1a2e" },
  vazio:          { padding: 48, textAlign: "center" as const, color: "#888" },
  nota:           { fontSize: 11, color: "#aaa", marginTop: 12, lineHeight: 1.6, paddingBottom: 8 },
};
