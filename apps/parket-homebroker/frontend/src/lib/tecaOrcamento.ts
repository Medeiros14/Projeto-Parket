/**
 * Teca IA — geração automática de orçamento a partir do Homebroker.
 *
 * O vendedor conversa com o valoria_assistant (EAS) num passo a passo guiado;
 * a Teca entrevista, consulta o catálogo e emite a action `montar_orcamento`
 * com os itens já precificados. Aqui a gente:
 *  - fala com o agente via /api/eas/... (proxy nginx injeta o Bearer, igual Valoria)
 *  - parseia os action blocks do markdown (mesmo formato do actionExecutor da Valoria)
 *  - insere a simulação pronta no banco da Valoria (ops.simulacoes/ambientes/simulacao_itens)
 *    vinculada ao card criado pelo fluxo normal do Solicitar Orçamento.
 */
import { supabaseValoria } from "./supabase";

// ─── Chat com o agente (porta do agentApi.ts da Valoria) ───────────────────

export type AgentEvent =
  | { type: "delta"; text: string }
  | { type: "done"; full: string }
  | { type: "error"; message: string };

const ENDPOINT = "/api/eas/agents/valoria_assistant/runs";

export async function runTeca(opts: {
  message: string;
  sessionId?: string | null;
  signal?: AbortSignal;
  onEvent: (e: AgentEvent) => void;
}): Promise<{ sessionId: string | null; full: string }> {
  const fd = new FormData();
  fd.append("message", opts.message);
  fd.append("stream", "true");
  if (opts.sessionId) fd.append("session_id", opts.sessionId);

  const res = await fetch(ENDPOINT, { method: "POST", body: fd, signal: opts.signal });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    opts.onEvent({ type: "error", message: `${res.status} ${text.slice(0, 200)}` });
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let sessionId: string | null = null;

  while (true) {
    let done: boolean, value: Uint8Array | undefined;
    try {
      ({ done, value } = await reader.read());
    } catch (e) {
      // SSE longo pode ser resetado no caminho (Cloudflare/WARP) — se já temos
      // conteúdo, seguimos com ele (as actions provavelmente já chegaram).
      if (full) break;
      throw e;
    }
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt: any;
        try { evt = JSON.parse(payload); } catch { continue; }
        if (!sessionId && evt.session_id) sessionId = evt.session_id;
        const ev = evt.event || evt.type || "";
        const isDelta = ev === "RunContent" || ev === "RunResponseContent" || ev === "RunResponseContentEvent";
        const isFinal = ev === "RunCompleted" || ev === "RunContentCompleted";
        if (isDelta) {
          const txt = typeof evt.content === "string" ? evt.content : "";
          if (txt) { full += txt; opts.onEvent({ type: "delta", text: txt }); }
        } else if (isFinal) {
          if (!full && typeof evt.content === "string" && evt.content) {
            full = evt.content;
            opts.onEvent({ type: "delta", text: evt.content });
          }
        } else if (ev === "RunErrorEvent" || ev === "RunError" || ev === "RunFailed") {
          opts.onEvent({ type: "error", message: String(evt.content || "erro") });
        }
      }
    }
  }

  opts.onEvent({ type: "done", full });
  return { sessionId, full };
}

// ─── Action blocks (mesmo formato/regex do actionExecutor da Valoria) ──────

export type ParsedAction = { type: string; payload: any; raw: string };

const ACTION_RE = /```action:([a-z_]+)\s*\n([\s\S]*?)\s*```/g;

export function parseActions(markdown: string): ParsedAction[] {
  const out: ParsedAction[] = [];
  let m: RegExpExecArray | null;
  ACTION_RE.lastIndex = 0;
  while ((m = ACTION_RE.exec(markdown)) !== null) {
    let payload: any = null;
    try { payload = JSON.parse(m[2].trim()); } catch { continue; }
    out.push({ type: m[1], payload, raw: m[2].trim() });
  }
  return out;
}

export function stripActions(markdown: string): string {
  return markdown.replace(ACTION_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Seed da entrevista ─────────────────────────────────────────────────────

export function buildSeedMessage(d: {
  cliente: string; vendedor: string;
  cidade?: string; condominio?: string; endereco?: string;
  produtos: string[]; metragem?: number | null;
  metragens_por_produto?: Record<string, number>;
  observacoes?: string;
}): string {
  const porProduto = d.metragens_por_produto || {};
  const temPorProduto = Object.values(porProduto).some((v) => Number(v) > 0);
  const linhaPorProduto = temPorProduto
    ? "- Metragem por produto: " + Object.entries(porProduto)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k} ${v} m²`).join(" · ")
    : "";
  const linhas = [
    `- Cliente: ${d.cliente}`,
    `- Vendedor: ${d.vendedor}`,
    d.cidade ? `- Cidade: ${d.cidade}` : "",
    d.condominio ? `- Condomínio: ${d.condominio}` : "",
    d.endereco ? `- Endereço: ${d.endereco}` : "",
    `- Produtos selecionados: ${d.produtos.join(", ") || "(nenhum)"}`,
    linhaPorProduto,
    d.metragem ? `- Metragem total aproximada: ${d.metragem} m²` : "",
    d.observacoes ? `- Observações do vendedor: ${d.observacoes}` : "",
  ].filter(Boolean).join("\n");

  return `[MODO ENTREVISTA — SOLICITAR ORÇAMENTO PELO HOMEBROKER]
Você está atendendo um VENDEDOR da Parket (não um orçamentista) dentro do pipeline de vendas do Homebroker, no fluxo "Gerar orçamento automaticamente com a Teca IA". Não há card aberto na Valoria nesta conversa.

Dados já preenchidos no formulário:
${linhas}

SUA TAREFA: entrevistar o vendedor, passo a passo, pra completar TUDO que falta pra montar o orçamento completo:
1. Ambientes da obra e metragem (m²) POR ambiente e por produto (porta/escada em quantidade).
2. Espécie/linha e acabamento de cada produto — use a tool catalogo_consultar pra listar as opções REAIS do catálogo quando o vendedor não souber, e ofereça as opções mais comuns.
3. Dimensão/formato quando aplicável (régua, espinha de peixe, chevron, largura da régua…).
4. Extras que façam sentido: rodapé, degraus, recortes.

REGRAS DA ENTREVISTA:
- Pergunte UMA coisa por vez, mensagens curtas e objetivas (o vendedor está com o cliente).
- Não invente valores nem espécies — tudo do catálogo via catalogo_consultar.
- NÃO emita nenhuma action durante a entrevista.

QUANDO TIVER TUDO: mostre um RESUMO da lista (ambiente · produto · espécie · m²) e pergunte "Posso gerar o orçamento?". Só depois do OK do vendedor, precifique CADA item pelo catálogo (preço all-in por m²) e emita UMA ÚNICA action \`\`\`action:montar_orcamento\`\`\` com o payload completo:
{"titulo": "...", "fonte": "teca-homebroker", "itens": [{"ambiente": "...", "categoria": "piso|forro|painel|porta|escada|deck|marcenaria|rodape|revestimento|brise", "especie": "...", "cor": "...", "dimensao": "...", "subtipo": "...", "m2": 0, "qtd": 0, "perda_pct": 10, "preco_unitario": 0, "valor_material": 0, "valor_insumos": 0, "valor_instalacao": 0, "valor_total": 0, "obs": "..."}]}
Precificação: valor_total = preço do catálogo × ceil(m2 × (1 + perda_pct/100)); divida em valor_material=70%, valor_insumos=10%, valor_instalacao=20% do total. Porta: use qtd (não m2) e o preço por porta do catálogo. Se um item não existir no catálogo, inclua com valores 0 e avise no obs que o orçamentista precisa precificar.

Comece agora: cumprimente o vendedor pelo primeiro nome e faça a primeira pergunta.`;
}

// ─── Montagem da simulação no banco da Valoria ──────────────────────────────

export type MontarResultado = {
  simulacaoId: string;
  nAmbientes: number;
  nItens: number;
  total: number;
  semPreco: string[];
};

/** Insere a simulação pronta (payload da action montar_orcamento) no banco da
 *  Valoria, vinculada ao ops.cards_solicitacao criado pelo solicitarOrcamento.
 *  Versão enxuta do montarOrcamentoFiel da Valoria: os valores JÁ vêm
 *  precificados pela Teca — aqui só insere, nunca recalcula. */
export async function montarOrcamentoValoria(valoriaCardId: string, payload: any): Promise<MontarResultado> {
  const itens: any[] = Array.isArray(payload?.itens) ? payload.itens : [];
  if (itens.length === 0) throw new Error("A Teca não retornou itens no orçamento.");

  const { data: simRow, error: simErr } = await supabaseValoria.from("simulacoes").insert({
    card_id: valoriaCardId,
    titulo: payload.titulo || "Orçamento Teca IA",
    versao: 1,
    status: "rascunho",
    desconto_perc: Number(payload.desconto_perc) || 0,
    desconto_valor: Number(payload.desconto_valor) || 0,
    frete_valor: Number(payload.frete_valor) || 0,
    validade_dias: Number(payload.validade_dias) || 30,
    forma_pagamento: payload.forma_pagamento ?? null,
    meta: { imported: true, source: "teca-homebroker", imported_at: new Date().toISOString() },
  }).select("id").single();
  if (simErr) throw new Error("Falha ao criar simulação na Valoria: " + simErr.message);
  const simId = (simRow as any).id;

  try {
    // Ambientes (dedup por nome)
    const ambMap: Record<string, string> = {};
    let ambOrdem = 0;
    for (const it of itens) {
      const nome = String(it.ambiente || "").trim();
      if (!nome || ambMap[nome]) continue;
      const { data: amb, error: ambErr } = await supabaseValoria.from("ambientes")
        .insert({ simulacao_id: simId, nome, ordem: ambOrdem++ })
        .select("id").single();
      if (ambErr) throw new Error("Falha ao criar ambiente: " + ambErr.message);
      ambMap[nome] = (amb as any).id;
    }

    const semPreco: string[] = [];
    const rows = itens.map((it, i) => {
      const categoria = String(it.categoria || "").toLowerCase().trim() || "piso";
      const isPorta = categoria === "porta";
      const valorMaterial = Number(it.valor_material) || 0;
      const insumos = Number(it.valor_insumos) || 0;
      const instalacao = Number(it.valor_instalacao) || 0;
      const total = it.valor_total != null ? Number(it.valor_total) : valorMaterial + insumos + instalacao;
      const metragem = isPorta && Number(it.qtd) > 0 ? Number(it.qtd) : (Number(it.m2) || Number(it.qtd) || 1);
      const baseUnit = valorMaterial > 0 ? valorMaterial : total;
      const precoUnit = it.preco_unitario != null
        ? Number(it.preco_unitario)
        : (metragem > 0 && baseUnit > 0 ? baseUnit / metragem : 0);
      if (total <= 0) semPreco.push(`${categoria.toUpperCase()} ${it.especie || ""} (${it.ambiente || "?"})`.trim());
      return {
        simulacao_id: simId,
        ambiente_id: ambMap[String(it.ambiente || "").trim()] || null,
        categoria,
        subtipo: it.subtipo ? String(it.subtipo).toLowerCase() : null,
        especie_nome: it.especie || null,
        cor: it.cor ? String(it.cor).trim() : null,
        dimensao_label: it.dimensao || null,
        metragem_informada: metragem,
        perda_pct: isPorta ? 0 : (Number(it.perda_pct) || 0),
        preco_unitario: Number(precoUnit.toFixed(2)),
        valor_material: valorMaterial,
        valor_insumos: insumos,
        valor_instalacao: instalacao,
        valor_total: total,
        gestao_obra_pct: 10,
        valor_gestao: 0,
        descritivo: it.obs ? String(it.obs) : null,
        ordem: i,
        meta: { imported: true, source: "teca-homebroker" },
      };
    });

    const { error: itErr } = await supabaseValoria.from("simulacao_itens").insert(rows);
    if (itErr) throw new Error("Falha ao criar itens: " + itErr.message);

    const total = rows.reduce((s, r) => s + (Number(r.valor_total) || 0), 0);
    return { simulacaoId: simId, nAmbientes: Object.keys(ambMap).length, nItens: rows.length, total, semPreco };
  } catch (e) {
    // Rollback best-effort — não deixa simulação meio-montada no kanban do orçamentista
    await supabaseValoria.from("simulacao_itens").delete().eq("simulacao_id", simId);
    await supabaseValoria.from("ambientes").delete().eq("simulacao_id", simId);
    await supabaseValoria.from("simulacoes").delete().eq("id", simId);
    throw e;
  }
}
