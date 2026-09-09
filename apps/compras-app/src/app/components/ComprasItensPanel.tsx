/**
 * Bloco único de itens do pedido pra envio ao Financeiro.
 *
 * Cada material (seja do legacy details.materiais OU já em compras_itens) vira
 * uma linha na mesma tabela.
 *
 * Regras de checkbox:
 *   - Só habilita quando o item tem `comprar_em` <= hoje (ou vazio) E pelo menos 1
 *     orçamento marcado como escolhido.
 *   - Itens em cotacao com data futura ficam com chip "Agendado XX/XX".
 *
 * Botão único no rodapé: "Enviar N pro Financeiro aprovar cotação".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { Send, PackageCheck, Check, RotateCcw, Paperclip, FileText, Trash2, Star, Calendar, ChevronDown, ChevronRight, PackageSearch, Warehouse, Truck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

type Status =
  | "cotacao" | "aguardando_aprovacao" | "aprovado" | "em_rota"
  | "entregue" | "faturado" | "pago" | "reprovado";

type Orcamento = {
  id?: string;              // uuid local para react key
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  arquivo_url: string;
  arquivo_nome?: string;
  valor?: number;
  obs?: string;
  ts?: string;
  escolhido?: boolean;
};

type Fornecedor = {
  id: string;
  nome: string;
  cnpj?: string | null;
  razao_social?: string | null;
  telefone?: string | null;
  email?: string | null;
  pix?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  forma_pagamento?: string | null;
  prazo_pagamento?: string | null;
};

type Item = {
  id: string;
  card_id: string;
  seq: number;
  material: string;
  quantidade: string | null;
  fornecedor_id: string | null;
  fornecedor_nome_snapshot: string | null;
  forma_pagamento: string;
  prazo_faturamento_dias: number;
  prazo_faturamento_texto?: string | null;
  entrada_pct?: number | null;
  valor: number;
  status: Status;
  motivo_reprovacao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  comprar_em: string | null;      // yyyy-mm-dd
  orcamentos: Orcamento[];
  atendido_estoque: boolean;
  atendido_estoque_at: string | null;
  atendido_estoque_por: string | null;
  atendido_estoque_deposito: string | null;
  cotacao_grupo_id: string | null;
  cotacao_grupo_meta: {
    fornecedor_nome?: string;
    arquivo_url?: string;
    arquivo_nome?: string;
    valor_total?: number;
    criado_em?: string;
    criado_por?: string;
  } | null;
};

const LABEL: Record<Status, string> = {
  cotacao: "Cotação",
  aguardando_aprovacao: "Aguardando Financeiro",
  aprovado: "Aprovado · aguardando pagto",
  em_rota: "Em Rota",
  entregue: "Entregue",
  faturado: "Faturado",
  pago: "Pago",
  reprovado: "Reprovado",
};

const COR: Record<Status, string> = {
  cotacao: "#94A3B8",
  aguardando_aprovacao: "#EAB308",
  aprovado: "#8B5CF6",
  em_rota: "#3B82F6",
  entregue: "#14B8A6",
  faturado: "#F97316",
  pago: "#10B981",
  reprovado: "#EF4444",
};

const hojeIso = () => new Date().toISOString().slice(0, 10);

// Linha unificada: origem pode ser legacy (details.materiais) ou compras_itens (já existente)
type LinhaUnificada = {
  key: string;
  origem: "legacy" | "item";
  legacyIdx?: number;
  item?: Item;
  material: string;
  quantidade: string | null;
  fornecedor: string | null;       // nome exibido na linha
  fornecedor_id: string | null;    // id real do cadastro (é o que o envio valida)
  valor: number;
  status: Status | null;
  comprar_em: string | null;
  orcamentos: Orcamento[];
  agendado: boolean;              // comprar_em > hoje
  temOrcamento: boolean;          // pelo menos 1 escolhido
  atendidoEstoque: boolean;       // marcado como já tem em Almox
  atendidoEstoqueInfo?: string;   // "Curitiba · por Ronaldo em 13/08"
  podeSelecionar: boolean;        // habilita checkbox
};

export default function ComprasItensPanel({
  cardId, details, materiaisLegacy, t, onChanged,
}: {
  cardId: string;
  details: Record<string, any> | null;
  materiaisLegacy: any[];
  t: any;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [itens, setItens] = useState<Item[]>([]);
  // Multi-select persistente por card (sobrevive F5/troca de aba)
  const selKey = `ci-selecionados:${cardId}`;
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(selKey) || "{}"); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(selKey, JSON.stringify(selecionados)); } catch {} }, [selecionados, selKey]);
  const [prazoDefault, setPrazoDefault] = useState<number>(30);
  const [formaDefault, setFormaDefault] = useState<string>("faturado");
  const [filtroStatus, setFiltroStatus] = useState<"todos"|"cotacao"|"aguardando_aprovacao"|"aprovado"|"pago"|"reprovado">("todos");
  const [busy, setBusy] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  // Estado local pra legacies (comprar_em + orçamentos ainda não persistidos)
  const [legacyState, setLegacyState] = useState<Record<string, {
    comprar_em: string | null;
    orcamentos: Orcamento[];
    atendidoEstoque?: boolean;
    // Fornecedor escolhido na linha legacy antes dela virar compras_itens.
    // undefined = nunca mexeu (vale o que veio do card); null = limpou de propósito.
    fornecedor_id?: string | null;
    fornecedor_nome?: string | null;
  }>>({});
  const [conferindoEst, setConferindoEst] = useState(false);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await sb.from("compras_fornecedores").select("id,nome,cnpj,pix,banco,agencia,conta,razao_social,telefone,email,forma_pagamento,prazo_pagamento").eq("ativo", true).order("nome");
      setFornecedores((data || []) as Fornecedor[]);
    })();
  }, []);

  function fornecedorDadosOk(f: Fornecedor | undefined | null): boolean {
    if (!f) return false;
    if (!f.cnpj?.trim()) return false;
    const temBanco = !!(f.banco?.trim() && f.agencia?.trim() && f.conta?.trim());
    const temPix = !!f.pix?.trim();
    return temBanco || temPix;
  }
  /** Retorna o que falta pra fornecedor ser aceito (string vazia = OK).
   *  exigeBancario: PIX/banco só é obrigatório quando o Financeiro paga DIRETO
   *  (à vista, antecipado, parcelas no ato). Compra faturada é paga por boleto
   *  anexado depois na parcela — não precisa de PIX/banco do cadastro.
   *  (25/08: 3.679 de 3.686 fornecedores sem PIX/banco; trava universal
   *  bloqueava todo envio e induzia cadastro-lixo tipo banco=".") */
  function faltaNoFornecedor(f: Fornecedor | undefined | null, exigeBancario: boolean): string {
    if (!f) return "fornecedor nao selecionado";
    const falta: string[] = [];
    if (!f.cnpj?.trim()) falta.push("CNPJ");
    const temBanco = !!(f.banco?.trim() && f.agencia?.trim() && f.conta?.trim());
    const temPix = !!f.pix?.trim();
    if (exigeBancario && !temBanco && !temPix) {
      const parcial: string[] = [];
      if (!f.banco?.trim()) parcial.push("banco");
      if (!f.agencia?.trim()) parcial.push("agencia");
      if (!f.conta?.trim()) parcial.push("conta");
      falta.push(`PIX OU (${parcial.join("+")})`);
    }
    return falta.join(" + ");
  }
  function fornecedorById(id: string | null | undefined): Fornecedor | undefined {
    return id ? fornecedores.find((f) => f.id === id) : undefined;
  }
  /** Busca fresh do banco pros ids indicados — evita cache stale ao enviar pra Financeiro. */
  async function refetchFornecedores(ids: string[]): Promise<Map<string, Fornecedor>> {
    const uniq = Array.from(new Set(ids.filter(Boolean)));
    if (uniq.length === 0) return new Map();
    const { data } = await sb.from("compras_fornecedores")
      .select("id,nome,cnpj,pix,banco,agencia,conta,razao_social,telefone,email,forma_pagamento,prazo_pagamento")
      .in("id", uniq);
    const m = new Map<string, Fornecedor>();
    (data || []).forEach((f: any) => m.set(f.id, f as Fornecedor));
    if (data && data.length > 0) {
      setFornecedores((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p] as const));
        (data as Fornecedor[]).forEach((f) => byId.set(f.id, f));
        return Array.from(byId.values()).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      });
    }
    return m;
  }

  async function load() {
    const { data } = await sb.from("compras_itens").select("*").eq("card_id", cardId).order("seq");
    const arr = (data || []).map((it: any) => ({
      ...it,
      orcamentos: Array.isArray(it.orcamentos) ? it.orcamentos : [],
    })) as Item[];
    setItens(arr);
  }
  useEffect(() => {
    load();
    const ch = (sb as any).channel(`ci:${cardId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "compras_itens", filter: `card_id=eq.${cardId}` },
          () => load())
      .subscribe();
    return () => { (sb as any).removeChannel(ch); };
  }, [cardId]);

  const linhas = useMemo<LinhaUnificada[]>(() => {
    const itensPorNome = new Map(itens.map((i) => [(i.material || "").toLowerCase().trim(), i]));
    const out: LinhaUnificada[] = [];
    materiaisLegacy.forEach((m, i) => {
      const nome = (m.tipo || m.material || "").toString().trim();
      if (!nome) return;
      if (itensPorNome.has(nome.toLowerCase())) return;
      const key = `legacy:${i}`;
      const ls = legacyState[key] || { comprar_em: null, orcamentos: [] as Orcamento[], atendidoEstoque: false };
      const agendado = !!(ls.comprar_em && ls.comprar_em > hojeIso());
      const temOrc = ls.orcamentos.some((o) => o.escolhido);
      const atendido = !!ls.atendidoEstoque;
      // Fornecedor da linha legacy: o que o usuário escolheu aqui no painel tem
      // prioridade; senão vale o que já veio gravado no card (details.materiais).
      const fid = ls.fornecedor_id !== undefined ? ls.fornecedor_id : (m.fornecedor_id || null);
      const fnome = ls.fornecedor_id !== undefined ? (ls.fornecedor_nome || null) : (m.fornecedor || null);
      out.push({
        key, origem: "legacy", legacyIdx: i,
        material: nome,
        quantidade: m.quantidade || null,
        fornecedor: fnome,
        fornecedor_id: fid,
        valor: parseValor(m.valor),
        status: null,
        comprar_em: ls.comprar_em,
        orcamentos: ls.orcamentos,
        agendado,
        temOrcamento: temOrc,
        atendidoEstoque: atendido,
        podeSelecionar: !agendado && !atendido,
      });
    });
    itens.forEach((it) => {
      const key = `item:${it.id}`;
      const agendado = !!(it.comprar_em && it.comprar_em > hojeIso());
      const temOrc = (it.orcamentos || []).some((o) => o.escolhido);
      const atendido = !!it.atendido_estoque;
      const info = atendido
        ? [it.atendido_estoque_deposito, it.atendido_estoque_por, it.atendido_estoque_at ? new Date(it.atendido_estoque_at).toLocaleDateString("pt-BR") : ""]
            .filter(Boolean).join(" · ")
        : undefined;
      out.push({
        key, origem: "item", item: it,
        material: it.material,
        quantidade: it.quantidade,
        fornecedor: it.fornecedor_nome_snapshot,
        fornecedor_id: it.fornecedor_id || null,
        valor: it.valor,
        status: it.status,
        comprar_em: it.comprar_em,
        orcamentos: it.orcamentos || [],
        agendado,
        temOrcamento: temOrc,
        atendidoEstoque: atendido,
        atendidoEstoqueInfo: info,
        podeSelecionar: it.status === "cotacao" && !agendado && !atendido,
      });
    });
    return out;
  }, [materiaisLegacy, itens, legacyState]);

  const selecionaveis = linhas.filter((l) => l.podeSelecionar);
  const nSelecionados = Object.values(selecionados).filter(Boolean).length;
  const marcarTudo = (v: boolean) => {
    const m: Record<string, boolean> = {};
    selecionaveis.forEach((l) => { m[l.key] = v; });
    setSelecionados(m);
  };

  async function enviarPraAprovacao() {
    if (nSelecionados === 0) return;
    // Fetch fresh: cache do useEffect inicial pode estar velho se usuario editou fornecedor
    // em /fornecedores (rota separada) e voltou pro card. Busca direto pelos ids envolvidos.
    // Fornecedor do item OU do orçamento escolhido OU o que já vem na linha legacy
    // (item persistido pode não ter fornecedor_id gravado quando o fornecedor veio
    // só do orçamento anexado; linha legacy carrega o fornecedor_id do card).
    const fidDaLinha = (l: LinhaUnificada) =>
      (l.origem === "item" ? l.item?.fornecedor_id : l.fornecedor_id)
      || l.orcamentos.find((o) => o.escolhido)?.fornecedor_id
      || l.fornecedor_id;
    const idsEnvolvidos: string[] = linhas
      .filter((l) => selecionados[l.key] && !l.atendidoEstoque)
      .map((l) => fidDaLinha(l) || "")
      .filter(Boolean);
    const fornsFresh = await refetchFornecedores(idsEnvolvidos);
    const getForn = (fid: string | null | undefined) => fid ? (fornsFresh.get(fid) || fornecedorById(fid)) : undefined;

    // Guarda: TODO item selecionado precisa de fornecedor identificado (CNPJ).
    // PIX/banco só quando o pagamento é direto (não-faturado) — faturado é boleto depois.
    const exigeBancario = enviarForm.forma !== "faturado";
    const semDados = linhas.filter((l) => selecionados[l.key] && !l.atendidoEstoque)
      .map((l) => {
        const forn = getForn(fidDaLinha(l));
        const falta = faltaNoFornecedor(forn, exigeBancario);
        return falta ? { linha: l, forn, falta } : null;
      })
      .filter(Boolean) as { linha: LinhaUnificada; forn: Fornecedor | undefined; falta: string }[];
    if (semDados.length > 0) {
      const lista = semDados
        .map(({ linha, forn, falta }) =>
          `- ${linha.material.substring(0, 60)}\n   Fornecedor: ${forn?.nome || linha.fornecedor || "sem fornecedor"}\n   Falta: ${falta}`
        )
        .join("\n\n");
      alert(
        `Nao da pra enviar pro Financeiro: ${semDados.length} item(ns) com pendencia no fornecedor.\n\n${lista}\n\n` +
        (exigeBancario
          ? `Pagamento "${enviarForm.forma}" e pago direto pelo Financeiro, entao precisa de PIX ou banco/agencia/conta. Complete em Cadastros > Fornecedores (ou mude a forma pra faturado, que e pago por boleto).`
          : `Complete em Cadastros > Fornecedores.`)
      );
      return;
    }
    // Guarda: o Core paga pelo valor — item sem valor chegava R$ 0 na fila de pagamento (Will 21/08).
    const valorEfetivo = (l: LinhaUnificada) => {
      const escolhido = l.orcamentos.find((o) => o.escolhido);
      return (l.origem === "item" ? l.item?.valor || 0 : l.valor) || escolhido?.valor || 0;
    };
    const semValor = linhas.filter((l) => selecionados[l.key] && !l.atendidoEstoque && valorEfetivo(l) <= 0);
    if (semValor.length > 0) {
      const lista = semValor.map((l) => `- ${l.material.substring(0, 60)}`).join("\n");
      alert(
        `Nao da pra enviar pro Financeiro: ${semValor.length} item(ns) sem valor:\n\n${lista}\n\n` +
        `Preenche o campo Valor R$ do item (ou o valor do orcamento escolhido) — o Core precisa do valor pra fazer o pagamento.`
      );
      return;
    }
    setBusy("enviar");
    try {
      // Nunca envia itens atendidos do estoque pra Financeiro (double-guard além do podeSelecionar).
      const selecionadasLinhas = linhas.filter((l) => selecionados[l.key] && !l.atendidoEstoque);
      const jaMax = itens[itens.length - 1]?.seq || 0;
      let novoSeq = jaMax;
      const forma = enviarForm.forma;
      const prazoTexto = enviarForm.forma === "faturado" ? enviarForm.prazo : "";
      const prazo = parsePrazo(prazoTexto);
      // Pagamento misto: entrada_pct% vence no dia da aprovação, restante divide nos prazos.
      const eIn = parseFloat((enviarForm.entrada || "").replace(",", "."));
      const entradaPct = forma === "faturado" && eIn > 0 && eIn < 100 ? Math.round(eIn * 100) / 100 : null;

      const inserts = [] as any[];
      const updateIds = [] as string[];
      const valorFill = [] as { id: string; valor: number }[];
      for (const l of selecionadasLinhas) {
        if (l.origem === "legacy") {
          novoSeq += 1;
          const escolhido = l.orcamentos.find((o) => o.escolhido);
          inserts.push({
            card_id: cardId, seq: novoSeq,
            material: l.material.substring(0, 500),
            quantidade: l.quantidade,
            // Legacy vira item aqui: o fornecedor da linha (card ou escolhido no painel)
            // precisa ser gravado, senão o item nasce sem fornecedor no Financeiro.
            fornecedor_id: escolhido?.fornecedor_id || l.fornecedor_id || null,
            fornecedor_nome_snapshot: escolhido?.fornecedor_nome || l.fornecedor,
            forma_pagamento: forma,
            prazo_faturamento_dias: prazo,
            prazo_faturamento_texto: prazoTexto || null,
            entrada_pct: entradaPct,
            valor: escolhido?.valor || l.valor,
            comprar_em: l.comprar_em || null,
            orcamentos: l.orcamentos,
            status: "aguardando_aprovacao" as Status,
          });
        } else if (l.item) {
          updateIds.push(l.item.id);
          // Valor R$ do item zerado mas orçamento escolhido tem valor → herda pro pagamento no Core.
          const escolhido = l.orcamentos.find((o) => o.escolhido);
          if (!(l.item.valor > 0) && (escolhido?.valor || 0) > 0) {
            valorFill.push({ id: l.item.id, valor: escolhido!.valor! });
          }
        }
      }
      // Frete da remessa: vira uma LINHA própria (item FRETE) no mesmo envio.
      // Assim ele flui inteiro pelo pipeline (aprovação Core → pagamento → custo da obra)
      // sem mexer no Core. Fornecedor: herda quando a remessa é de fornecedor único
      // (frete normalmente cobrado pelo próprio fornecedor); remessa mista fica sem fornecedor.
      const freteVal = parseFloat((enviarForm.frete || "").replace(",", ".")) || 0;
      if (freteVal > 0) {
        const fidsUnicos = Array.from(new Set(selecionadasLinhas.map((l) => fidDaLinha(l)).filter(Boolean)));
        const fornFrete = fidsUnicos.length === 1 ? getForn(fidsUnicos[0]) : undefined;
        novoSeq += 1;
        inserts.push({
          card_id: cardId, seq: novoSeq,
          material: `FRETE (entrega de ${selecionadasLinhas.length} item(ns) desta remessa)`,
          quantidade: null,
          fornecedor_id: fornFrete?.id || null,
          fornecedor_nome_snapshot: fornFrete?.nome || null,
          forma_pagamento: forma,
          prazo_faturamento_dias: prazo,
          prazo_faturamento_texto: prazoTexto || null,
          entrada_pct: entradaPct,
          valor: freteVal,
          comprar_em: null,
          orcamentos: [],
          status: "aguardando_aprovacao" as Status,
        });
      }
      if (inserts.length) await sb.from("compras_itens").insert(inserts);
      if (updateIds.length) {
        await sb.from("compras_itens").update({
          status: "aguardando_aprovacao",
          forma_pagamento: forma,
          prazo_faturamento_dias: prazo,
          prazo_faturamento_texto: prazoTexto || null,
          entrada_pct: entradaPct,
          updated_at: new Date().toISOString(),
        }).in("id", updateIds);
        for (const vf of valorFill) {
          await sb.from("compras_itens").update({ valor: vf.valor }).eq("id", vf.id);
        }
      }
      if (!(details as any)?.compras_itens_ativo) {
        const novo = { ...(details || {}), compras_itens_ativo: true };
        await sb.from("kanban_cards").update({ details: novo, updated_at: new Date().toISOString() }).eq("id", cardId);
      }
      setEnviarModal(false);
      setSelecionados({});
      setLegacyState({});
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  async function marcarAtendidoEstoque(l: LinhaUnificada, valor: boolean, deposito?: string) {
    const quem = (user as any)?.nome || (user as any)?.email || "";
    if (l.origem === "item" && l.item) {
      const body: any = {
        atendido_estoque: valor,
        atendido_estoque_at: valor ? new Date().toISOString() : null,
        atendido_estoque_por: valor ? quem : null,
        atendido_estoque_deposito: valor ? (deposito || null) : null,
        updated_at: new Date().toISOString(),
      };
      await sb.from("compras_itens").update(body).eq("id", l.item.id);
      await load();
      onChanged();
    } else {
      setLegacyState((s) => ({
        ...s,
        [l.key]: {
          // Preserva fornecedor escolhido: marcar/desmarcar estoque não pode zerar a linha.
          ...(s[l.key] || {}),
          comprar_em: s[l.key]?.comprar_em ?? null,
          orcamentos: s[l.key]?.orcamentos ?? [],
          atendidoEstoque: valor,
        },
      }));
    }
    setSelecionados((sel) => ({ ...sel, [l.key]: false }));
  }

  // Consulta o saldo agregado (compras_estoque_mov = entradas − saídas) e marca
  // automaticamente os itens cuja descrição bate com material do card.
  async function conferirEstoqueTudo() {
    setConferindoEst(true);
    try {
      // Apelidos do cadastro de produtos: nome da NF/solicitação ≠ nome popular do mesmo material.
      // Canonicaliza os dois lados pro nome principal antes de casar.
      const { data: prods } = await sb.from("compras_produtos").select("descricao,apelidos").eq("ativo", true).limit(5000);
      const alias = new Map<string, string>();
      for (const p of (prods || [])) {
        const principal = String((p as any).descricao || "").trim().toUpperCase();
        if (!principal) continue;
        for (const a of ((p as any).apelidos || [])) {
          const k = String(a || "").trim().toUpperCase();
          if (k) alias.set(k, principal);
        }
      }
      const canon = (nome: string) => alias.get(nome) || nome;

      // Puxa 8k movimentos (suficiente pro estoque atual sem paginar) — agrega em memória
      const { data: movs } = await sb.from("compras_estoque_mov").select("descricao,tipo,quantidade,deposito").limit(8000);
      const saldos = new Map<string, { saldo: number; deposito: string }>();
      for (const m of (movs || [])) {
        const nome = canon(String((m as any).descricao || "").trim().toUpperCase());
        if (!nome) continue;
        const q = Number((m as any).quantidade) || 0;
        const cur = saldos.get(nome) || { saldo: 0, deposito: (m as any).deposito || "" };
        cur.saldo += (m as any).tipo === "Entrada" ? q : -q;
        if (!cur.deposito && (m as any).deposito) cur.deposito = (m as any).deposito;
        saldos.set(nome, cur);
      }
      const candidatos = linhas.filter((l) => l.podeSelecionar && !l.atendidoEstoque);
      let n = 0;
      for (const l of candidatos) {
        const chave = canon(String(l.material || "").trim().toUpperCase());
        const s = saldos.get(chave);
        if (s && s.saldo > 0) {
          await marcarAtendidoEstoque(l, true, s.deposito || "Almoxarifado");
          n++;
        }
      }
      alert(n === 0
        ? "Nenhum item bate com saldo em estoque. Marque manualmente se souber que tem."
        : `${n} item(ns) marcado(s) como já disponíveis no estoque.`);
    } catch (e: any) {
      alert("Falha ao conferir estoque: " + (e?.message || e));
    } finally { setConferindoEst(false); }
  }

  async function transicionar(id: string, novoStatus: Status) {
    setBusy(id);
    try {
      await sb.from("compras_itens").update({ status: novoStatus, updated_at: new Date().toISOString() }).eq("id", id);
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  async function reverterAprovacao(id: string) {
    if (!confirm("Reverter a aprovação? O item volta pra Cotação e o lançamento no Financeiro será cancelado.")) return;
    setBusy(id);
    try {
      const { error } = await sb.rpc("reverter_aprovacao_item_compra", { p_item_id: id });
      if (error) { alert("Falha: " + error.message); return; }
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  async function cancelarSolicitacao(id: string) {
    if (!confirm("Cancelar a solicitação ao Financeiro? O item volta pra Cotação e some da fila do Core.")) return;
    setBusy(id);
    try {
      await sb.from("compras_itens").update({
        status: "cotacao",
        aprovado_por: null,
        aprovado_em: null,
        motivo_reprovacao: null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  // Atualiza campos editáveis do item (comprar_em, orcamentos, valor, forma_pgto, prazo, fornecedor):
  //   - Item persistido: UPDATE direto
  //   - Legacy: só no estado local (só vai pro banco no envio) — só comprar_em+orcamentos
  async function updateCampoLinha(l: LinhaUnificada, patch: Partial<{
    comprar_em: string | null; orcamentos: Orcamento[];
    valor: number; forma_pagamento: string; prazo_faturamento_dias: number; prazo_faturamento_texto: string | null;
    entrada_pct: number | null;
    fornecedor_id: string | null; fornecedor_nome_snapshot: string | null;
  }>) {
    if (l.origem === "item" && l.item) {
      const body: any = { updated_at: new Date().toISOString() };
      if ("comprar_em" in patch) body.comprar_em = patch.comprar_em;
      if ("orcamentos" in patch) body.orcamentos = patch.orcamentos;
      if ("valor" in patch) body.valor = patch.valor;
      if ("forma_pagamento" in patch) body.forma_pagamento = patch.forma_pagamento;
      if ("prazo_faturamento_dias" in patch) body.prazo_faturamento_dias = patch.prazo_faturamento_dias;
      if ("prazo_faturamento_texto" in patch) body.prazo_faturamento_texto = patch.prazo_faturamento_texto;
      if ("entrada_pct" in patch) body.entrada_pct = patch.entrada_pct;
      if ("fornecedor_id" in patch) body.fornecedor_id = patch.fornecedor_id;
      if ("fornecedor_nome_snapshot" in patch) body.fornecedor_nome_snapshot = patch.fornecedor_nome_snapshot;
      await sb.from("compras_itens").update(body).eq("id", l.item.id);
      await load();
    } else {
      setLegacyState((s) => ({
        ...s,
        [l.key]: {
          // Espalha o estado atual pra não perder atendidoEstoque nem o fornecedor
          // já escolhido quando o patch é de outro campo.
          ...(s[l.key] || {}),
          comprar_em: "comprar_em" in patch ? (patch.comprar_em ?? null) : (s[l.key]?.comprar_em ?? null),
          orcamentos: "orcamentos" in patch ? (patch.orcamentos ?? []) : (s[l.key]?.orcamentos ?? []),
          ...( "fornecedor_id" in patch ? { fornecedor_id: patch.fornecedor_id ?? null } : {}),
          ...( "fornecedor_nome_snapshot" in patch ? { fornecedor_nome: patch.fornecedor_nome_snapshot ?? null } : {}),
        },
      }));
    }
  }

  const [enviarModal, setEnviarModal] = useState(false);
  // frete: R$ do frete da remessa (opcional). Vira uma linha FRETE própria no envio,
  // porque o valor comprado é só do produto e o frete também precisa ser pago pelo Financeiro.
  const [enviarForm, setEnviarForm] = useState<{ forma: string; prazo: string; entrada: string; frete: string }>({ forma: "faturado", prazo: "30", entrada: "", frete: "" });

  // Frete avulso (Will 26/08): o campo de frete do modal de envio só existe no PRIMEIRO
  // envio da remessa — se os itens já foram enviados/aprovados/pagos, não havia mais
  // NENHUM lugar pra lançar o frete (que muitas vezes só chega depois, na entrega/NF).
  // Este modal cria uma linha FRETE independente a qualquer momento, no mesmo pipeline
  // (aguardando_aprovacao → Core aprova → pagamento → custo da obra).
  const [freteModal, setFreteModal] = useState(false);
  const [freteForm, setFreteForm] = useState<{ valor: string; fornecedor_id: string | null; forma: string; prazo: string; obs: string }>({ valor: "", fornecedor_id: null, forma: "faturado", prazo: "30", obs: "" });

  async function lancarFreteAvulso() {
    const valor = parseFloat((freteForm.valor || "").replace(",", ".")) || 0;
    if (valor <= 0) { alert("Valor do frete tem que ser > 0."); return; }
    // Fornecedor (transportadora) é OPCIONAL — mas se escolhido e o Financeiro paga
    // direto (não-faturado), valem as mesmas exigências de PIX/banco do envio normal.
    const forn = fornecedorById(freteForm.fornecedor_id);
    if (forn) {
      const falta = faltaNoFornecedor(forn, freteForm.forma !== "faturado");
      if (falta) { alert(`Fornecedor com pendencia: falta ${falta}. Complete em Cadastros > Fornecedores (ou mude a forma pra faturado, que e pago por boleto).`); return; }
    }
    setBusy("frete");
    try {
      const prazoTexto = freteForm.forma === "faturado" ? freteForm.prazo : "";
      const prazo = parsePrazo(prazoTexto);
      const novoSeq = (itens[itens.length - 1]?.seq || 0) + 1;
      await sb.from("compras_itens").insert({
        card_id: cardId, seq: novoSeq,
        material: `FRETE${freteForm.obs.trim() ? ` (${freteForm.obs.trim().substring(0, 200)})` : ""}`,
        quantidade: null,
        fornecedor_id: forn?.id || null,
        fornecedor_nome_snapshot: forn?.nome || null,
        forma_pagamento: freteForm.forma,
        prazo_faturamento_dias: prazo,
        prazo_faturamento_texto: prazoTexto || null,
        valor,
        comprar_em: null,
        orcamentos: [],
        status: "aguardando_aprovacao" as Status,
      });
      // Liga a feature flag do fluxo por item (igual aos outros caminhos de escrita).
      if (!(details as any)?.compras_itens_ativo) {
        const novo = { ...(details || {}), compras_itens_ativo: true };
        await sb.from("kanban_cards").update({ details: novo, updated_at: new Date().toISOString() }).eq("id", cardId);
      }
      setFreteModal(false);
      setFreteForm({ valor: "", fornecedor_id: null, forma: "faturado", prazo: "30", obs: "" });
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  const [agrupModal, setAgrupModal] = useState(false);
  const [agrupForm, setAgrupForm] = useState<{
    fornecedor_id: string | null; valor_total: string; forma: string; prazo: string;
    arquivo?: File | null;
  }>({ fornecedor_id: null, valor_total: "", forma: "faturado", prazo: "30", arquivo: null });

  const [fornModal, setFornModal] = useState<{ open: boolean; edit: Fornecedor | null; nomeInicial?: string; onSelect?: (f: Fornecedor) => void }>({ open: false, edit: null });

  async function agruparEmCotacao() {
    const selecionadasLinhas = linhas.filter((l) => selecionados[l.key] && (
      l.origem === "legacy" || (l.origem === "item" && l.item?.status === "cotacao")
    ));
    if (selecionadasLinhas.length < 2) { alert("Selecione 2 ou mais itens em Cotação pra agrupar."); return; }
    const forn = fornecedorById(agrupForm.fornecedor_id);
    if (!forn) { alert("Selecione um fornecedor cadastrado."); return; }
    // Mesma regra do envio: PIX/banco só quando o Financeiro paga direto (não-faturado).
    // Compra faturada é paga por boleto anexado depois na parcela.
    {
      const faltaAgrup = faltaNoFornecedor(forn, agrupForm.forma !== "faturado");
      if (faltaAgrup) { alert(`Fornecedor com pendencia: falta ${faltaAgrup}. Complete em Cadastros > Fornecedores (ou mude a forma pra faturado, que e pago por boleto).`); return; }
    }
    const total = parseFloat(agrupForm.valor_total.replace(",", ".")) || 0;
    if (total <= 0) { alert("Valor total tem que ser > 0."); return; }
    setBusy("agrupar");
    try {
      let arquivo_url: string | undefined;
      let arquivo_nome: string | undefined;
      if (agrupForm.arquivo) {
        const f = agrupForm.arquivo;
        const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
        const path = `grupo/${cardId}/${Date.now()}.${ext}`;
        const { data, error } = await sb.storage.from("compras-orcamentos").upload(path, f, {
          contentType: f.type || "application/pdf",
        });
        if (error) { alert("Falha upload: " + error.message); return; }
        const { data: pub } = sb.storage.from("compras-orcamentos").getPublicUrl(data.path);
        arquivo_url = pub.publicUrl;
        arquivo_nome = f.name;
      }
      const grupoId = crypto.randomUUID();
      const meta = {
        fornecedor_id: forn.id,
        fornecedor_nome: forn.nome,
        arquivo_url, arquivo_nome,
        valor_total: total,
        forma_pagamento: agrupForm.forma,
        prazo_faturamento_dias: agrupForm.forma === "faturado" ? parsePrazo(agrupForm.prazo) : 0,
        prazo_faturamento_texto: agrupForm.forma === "faturado" ? agrupForm.prazo : null,
        criado_em: new Date().toISOString(),
        criado_por: (user as any)?.nome || (user as any)?.email || null,
      };
      const N = selecionadasLinhas.length;
      const valorPorItem = Math.round((total / N) * 100) / 100;

      const jaMax = itens[itens.length - 1]?.seq || 0;
      let novoSeq = jaMax;
      const inserts: any[] = [];
      const updates: Promise<any>[] = [];
      const forma = agrupForm.forma;
      const prazoTexto = agrupForm.forma === "faturado" ? agrupForm.prazo : "";
      const prazo = parsePrazo(prazoTexto);
      for (const l of selecionadasLinhas) {
        if (l.origem === "legacy") {
          novoSeq += 1;
          inserts.push({
            card_id: cardId, seq: novoSeq,
            material: l.material.substring(0, 500),
            quantidade: l.quantidade,
            fornecedor_id: forn.id,
            fornecedor_nome_snapshot: forn.nome,
            forma_pagamento: forma,
            prazo_faturamento_dias: prazo,
            prazo_faturamento_texto: prazoTexto || null,
            valor: valorPorItem,
            comprar_em: l.comprar_em || null,
            orcamentos: l.orcamentos,
            status: "cotacao",
            cotacao_grupo_id: grupoId,
            cotacao_grupo_meta: meta,
          });
        } else if (l.item) {
          updates.push(sb.from("compras_itens").update({
            cotacao_grupo_id: grupoId,
            cotacao_grupo_meta: meta,
            fornecedor_id: forn.id,
            fornecedor_nome_snapshot: forn.nome,
            forma_pagamento: forma,
            prazo_faturamento_dias: prazo,
            prazo_faturamento_texto: prazoTexto || null,
            valor: valorPorItem,
            updated_at: new Date().toISOString(),
          }).eq("id", l.item.id));
        }
      }
      if (inserts.length) await sb.from("compras_itens").insert(inserts);
      if (updates.length) await Promise.all(updates);

      if (!(details as any)?.compras_itens_ativo) {
        const novo = { ...(details || {}), compras_itens_ativo: true };
        await sb.from("kanban_cards").update({ details: novo, updated_at: new Date().toISOString() }).eq("id", cardId);
      }

      setAgrupModal(false);
      setAgrupForm({ fornecedor_id: null, valor_total: "", forma: "faturado", prazo: 30, arquivo: null });
      setSelecionados({});
      setLegacyState({});
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  async function desagruparCotacao(grupoId: string) {
    if (!confirm("Desagrupar essa cotação? Os itens voltam a ser individuais.")) return;
    setBusy("desagrupar");
    try {
      await sb.from("compras_itens").update({
        cotacao_grupo_id: null,
        cotacao_grupo_meta: null,
        updated_at: new Date().toISOString(),
      }).eq("cotacao_grupo_id", grupoId);
      await load();
      onChanged();
    } finally { setBusy(null); }
  }

  const nSelecItens = linhas.filter((l) => selecionados[l.key] && (
    l.origem === "legacy" || (l.origem === "item" && l.item?.status === "cotacao")
  )).length;

  if (linhas.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: 12, border: `1px solid ${t.border}`, background: `${t.statBg}80` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textPrimary }}>
            Itens do pedido
          </div>
          <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
            Anexe orçamento (PDF) e defina a data. Envie pro Financeiro só o que já tá pronto.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={conferirEstoqueTudo} disabled={conferindoEst}
                  title="Consulta saldos do Almoxarifado e marca automaticamente itens com estoque disponível"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                           background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                           fontSize: 10.5, fontWeight: 600, cursor: conferindoEst ? "wait" : "pointer",
                           opacity: conferindoEst ? 0.5 : 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <PackageSearch size={12} /> {conferindoEst ? "Conferindo…" : "Conferir estoque agora"}
          </button>
          {/* Lançar frete: sempre visível — o campo de frete do modal de envio só existe
              no 1º envio; depois disso o frete (que costuma chegar com a NF/entrega)
              precisava de um caminho próprio (Will 26/08). */}
          <button type="button" onClick={() => setFreteModal(true)}
                  title="Lança um frete avulso deste pedido como linha FRETE (vai pra aprovação do Financeiro)"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                           background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                           fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                           textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <Truck size={12} /> Lançar frete
          </button>
          {nSelecItens >= 2 && (
            <button type="button" onClick={() => setAgrupModal(true)}
                    title="Agrupa itens selecionados em UMA cotação do fornecedor (1 PDF cobre todos)"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                             background: t.textPrimary, border: `1px solid ${t.textPrimary}`, color: t.bg,
                             fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                             textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <Paperclip size={12} /> Agrupar {nSelecItens} em cotação
            </button>
          )}
        </div>
      </div>

      {/* Filtros por status (contador ao lado) */}
      {(() => {
        const contagem: Record<string, number> = { todos: linhas.length };
        for (const l of linhas) {
          const st = l.origem === "legacy" ? "cotacao" : (l.item?.status || "cotacao");
          contagem[st] = (contagem[st] || 0) + 1;
        }
        const opcoes: { key: typeof filtroStatus; lb: string }[] = [
          { key: "todos", lb: "Todos" },
          { key: "cotacao", lb: "Cotação" },
          { key: "aguardando_aprovacao", lb: "Aguardando" },
          { key: "aprovado", lb: "Aprovado" },
          { key: "pago", lb: "Pago" },
          { key: "reprovado", lb: "Reprovado" },
        ].filter((o) => o.key === "todos" || (contagem[o.key] || 0) > 0);
        if (opcoes.length <= 2) return null;
        return (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {opcoes.map((o) => (
              <button key={o.key} type="button" onClick={() => setFiltroStatus(o.key)}
                      style={{ padding: "3px 8px", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
                               letterSpacing: "0.05em", cursor: "pointer",
                               background: filtroStatus === o.key ? t.textPrimary : "transparent",
                               color: filtroStatus === o.key ? t.bg : t.textSecondary,
                               border: `1px solid ${filtroStatus === o.key ? t.textPrimary : t.border}` }}>
                {o.lb} <span style={{ opacity: 0.7 }}>{contagem[o.key] || 0}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {selecionaveis.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", fontSize: 10, color: t.textMuted }}>
            <input type="checkbox"
                   checked={selecionaveis.every((l) => selecionados[l.key])}
                   onChange={(e) => marcarTudo(e.target.checked)} />
            Marcar todos disponíveis ({selecionaveis.length})
          </div>
        )}
        {linhas.filter((l) => {
          if (filtroStatus === "todos") return true;
          const st = l.origem === "legacy" ? "cotacao" : (l.item?.status || "cotacao");
          return st === filtroStatus;
        }).map((l) => {
          const check = !!selecionados[l.key];
          const bg = check ? `${t.textPrimary}08` : "transparent";
          const isOpen = !!expandido[l.key];
          const rowBorder = l.atendidoEstoque ? "#94A3B8" : (check ? t.textPrimary : t.border);
          const rowBg = l.atendidoEstoque ? `${t.textMuted}0F` : bg;
          const matDeco = l.atendidoEstoque ? "line-through" : "none";
          const matColor = l.atendidoEstoque ? t.textMuted : t.textPrimary;
          return (
            <div key={l.key}
                 style={{ background: rowBg, border: `1px solid ${rowBorder}` }}>
              <label style={{ display: "grid",
                              gridTemplateColumns: "auto 1fr auto auto",
                              alignItems: "flex-start", gap: 10,
                              padding: "7px 10px",
                              cursor: l.podeSelecionar ? "pointer" : "default" }}>
                <input type="checkbox" checked={check} disabled={!l.podeSelecionar}
                       title={!l.podeSelecionar
                         ? (l.atendidoEstoque ? "Atendido do estoque — não vai pro Financeiro"
                                              : (l.agendado ? `Agendado pra ${l.comprar_em?.split("-").reverse().join("/")}` : "Não disponível"))
                         : ""}
                       onChange={(e) => setSelecionados((s) => ({ ...s, [l.key]: e.target.checked }))}
                       style={{ opacity: l.podeSelecionar ? 1 : 0.3 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: matColor, fontWeight: 500, textDecoration: matDeco }}>{l.material}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {l.quantidade && <span>{l.quantidade}</span>}
                    {l.fornecedor && !l.atendidoEstoque && <span>· {l.fornecedor}</span>}
                    {l.valor > 0 && !l.atendidoEstoque && <span>· R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    {l.origem === "item" && l.item && !l.atendidoEstoque && (
                      <span>· {l.item.forma_pagamento === "avista" ? "À vista" : l.item.forma_pagamento === "faturado" ? `Faturado ${l.item.prazo_faturamento_texto || l.item.prazo_faturamento_dias}d${(l.item.entrada_pct || 0) > 0 ? ` + entrada ${l.item.entrada_pct}%` : ""}` : l.item.forma_pagamento}</span>
                    )}
                    {l.agendado && !l.atendidoEstoque && (
                      <span style={{ color: "#3B82F6", fontWeight: 700 }}>
                        · 📅 Agendado {l.comprar_em?.split("-").reverse().join("/")}
                      </span>
                    )}
                    {l.orcamentos.length > 0 && !l.atendidoEstoque && (
                      <span style={{ color: l.temOrcamento ? "#10B981" : t.textMuted }}>
                        · 📎 {l.orcamentos.length} orçamento{l.orcamentos.length > 1 ? "s" : ""}{l.temOrcamento ? " ✓" : ""}
                      </span>
                    )}
                    {l.item?.cotacao_grupo_id && (
                      <span style={{ color: "#7C3AED", fontWeight: 700 }}>
                        · 🔗 Grupo {l.item.cotacao_grupo_meta?.fornecedor_nome || ""}
                        {l.item.cotacao_grupo_meta?.valor_total ? ` · R$ ${l.item.cotacao_grupo_meta.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} total` : ""}
                        {l.item.cotacao_grupo_meta?.arquivo_url && (
                          <a href={l.item.cotacao_grupo_meta.arquivo_url} target="_blank" rel="noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             style={{ color: "#7C3AED", marginLeft: 4, textDecoration: "underline" }}>PDF</a>
                        )}
                      </span>
                    )}
                    {l.atendidoEstoque && (
                      <span style={{ color: "#0891B2", fontWeight: 700 }}>
                        🏬 Atendido do estoque{l.atendidoEstoqueInfo ? ` · ${l.atendidoEstoqueInfo}` : ""}
                      </span>
                    )}
                  </div>
                  {l.item?.motivo_reprovacao && (
                    <div style={{ fontSize: 10, color: t.danger, marginTop: 3 }}>Motivo: {l.item.motivo_reprovacao}</div>
                  )}
                  {l.item?.aprovado_em && (l.status === "aprovado" || l.status === "em_rota" || l.status === "entregue" || l.status === "faturado" || l.status === "pago") && (
                    <div style={{ fontSize: 10, color: "#10B981", marginTop: 3, fontWeight: 600 }}>
                      ✓ Aprovado pelo Financeiro por {l.item.aprovado_por || "—"} em {new Date(l.item.aprovado_em).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
                {l.status && !l.atendidoEstoque && (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px",
                                 background: `${COR[l.status]}22`, color: COR[l.status], fontSize: 10, fontWeight: 700,
                                 letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {LABEL[l.status]}
                  </span>
                )}
                {l.atendidoEstoque && (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px",
                                 background: "#0891B222", color: "#0891B2", fontSize: 10, fontWeight: 700,
                                 letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Do estoque
                  </span>
                )}
                <div style={{ display: "flex", gap: 4, whiteSpace: "nowrap", alignItems: "center" }}>
                  {/* Botão "Do estoque" / "Desfazer" — só faz sentido enquanto em cotacao (ou legacy) */}
                  {(l.status === null || l.status === "cotacao") && (
                    l.atendidoEstoque ? (
                      <MiniBtn t={t} disabled={busy === l.key}
                               onClick={(e) => { e.preventDefault(); marcarAtendidoEstoque(l, false); }}
                               icon={<RotateCcw size={11} />} label="Desfazer estoque" />
                    ) : (
                      <MiniBtn t={t} disabled={busy === l.key}
                               onClick={(e) => { e.preventDefault(); marcarAtendidoEstoque(l, true, "Manual"); }}
                               icon={<Warehouse size={11} />} label="Do estoque" />
                    )
                  )}
                  {l.item && l.status === "aguardando_aprovacao" && (
                    <MiniBtn t={t} disabled={busy === l.item.id}
                             onClick={(e) => { e.preventDefault(); cancelarSolicitacao(l.item!.id); }}
                             icon={<RotateCcw size={11} />} label="Cancelar solicitação" />
                  )}
                  {l.item?.cotacao_grupo_id && l.status === "cotacao" && (
                    <MiniBtn t={t} disabled={busy === "desagrupar"}
                             onClick={(e) => { e.preventDefault(); desagruparCotacao(l.item!.cotacao_grupo_id!); }}
                             icon={<RotateCcw size={11} />} label="Desagrupar" />
                  )}
                  {l.item && (l.status === "aprovado" || l.status === "em_rota" || l.status === "entregue" || l.status === "faturado") && (
                    <MiniBtn t={t} disabled={busy === l.item.id}
                             onClick={(e) => { e.preventDefault(); reverterAprovacao(l.item!.id); }}
                             icon={<RotateCcw size={11} />} label="Reverter aprovação" />
                  )}
                  {l.item && (l.status === "aprovado" || l.status === "em_rota") && (
                    <MiniBtn t={t} disabled={busy === l.item.id} onClick={(e) => { e.preventDefault(); transicionar(l.item!.id, "entregue"); }}
                             icon={<PackageCheck size={11} />} label="Entregue" />
                  )}
                  {l.item && l.status === "entregue" && (
                    <MiniBtn t={t} disabled={busy === l.item.id} onClick={(e) => { e.preventDefault(); transicionar(l.item!.id, "faturado"); }}
                             icon={<Check size={11} />} label="Faturado" />
                  )}
                  {l.item && l.status === "reprovado" && (
                    <MiniBtn t={t} disabled={busy === l.item.id} onClick={(e) => { e.preventDefault(); transicionar(l.item!.id, "cotacao"); }}
                             icon={<RotateCcw size={11} />} label="Refazer" />
                  )}
                  <button type="button" onClick={(e) => { e.preventDefault(); setExpandido((x) => ({ ...x, [l.key]: !x[l.key] })); }}
                          title={isOpen ? "Fechar" : "Data + orçamentos"}
                          style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                                   padding: "2px 4px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                </div>
              </label>
              {l.item?.id && (l.status === "aprovado" || l.status === "em_rota" || l.status === "entregue" || l.status === "faturado" || l.status === "pago") && (
                <div style={{ padding: "0 10px 8px 10px" }}>
                  <ParcelasBox t={t} itemId={l.item.id} />
                </div>
              )}
              {isOpen && (
                <SubPanelOrcamentos
                  linha={l}
                  t={t}
                  onPatch={(patch) => updateCampoLinha(l, patch)}
                  fornecedores={fornecedores}
                  fornecedorDadosOk={fornecedorDadosOk}
                  fornecedorById={fornecedorById}
                  setFornModal={setFornModal}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <div style={{ fontSize: 10.5, color: t.textMuted }}>
          {nSelecionados > 0
            ? `${nSelecionados} de ${selecionaveis.length} selecionado(s)`
            : `${selecionaveis.length} disponível(is) pra enviar${itens.length ? ` · ${itens.length} já no fluxo` : ""}`}
        </div>
        <button onClick={() => {
                  // Autocomplete forma/prazo baseado no fornecedor mais frequente dos selecionados
                  const selecItens = linhas.filter((l) => selecionados[l.key] && l.origem === "item" && l.item);
                  const fornsCount = new Map<string, number>();
                  for (const l of selecItens) {
                    const id = l.item?.fornecedor_id;
                    if (id) fornsCount.set(id, (fornsCount.get(id) || 0) + 1);
                  }
                  const fornMaisFreq = [...fornsCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
                  const f = fornMaisFreq ? fornecedorById(fornMaisFreq) : null;
                  if (f?.forma_pagamento || f?.prazo_pagamento) {
                    setEnviarForm({
                      forma: f.forma_pagamento || "faturado",
                      prazo: f.prazo_pagamento || "30",
                      entrada: "",
                      frete: "",
                    });
                  }
                  setEnviarModal(true);
                }} disabled={busy === "enviar" || nSelecionados === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                         background: nSelecionados > 0 ? t.textPrimary : t.border,
                         color: nSelecionados > 0 ? t.bg : t.textMuted, border: "none",
                         cursor: nSelecionados > 0 ? "pointer" : "not-allowed",
                         fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                         textTransform: "uppercase", opacity: busy === "enviar" ? 0.5 : 1 }}>
          <Send size={12} /> {busy === "enviar" ? "Enviando…" : `Enviar${nSelecionados > 0 ? " " + nSelecionados : ""} pro Financeiro aprovar cotação`}
        </button>
      </div>

      {enviarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
             onClick={() => setEnviarModal(false)}>
          <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 20,
                        maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
               onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textPrimary }}>
              Enviar {nSelecionados} pro Financeiro
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: -6 }}>
              Escolha a forma de pagamento pra essa remessa. Vale pra todos os itens/grupos marcados.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Forma de pagamento</label>
              <input type="text" list="formas-pagto-sug" value={enviarForm.forma}
                     onChange={(e) => setEnviarForm((f) => ({ ...f, forma: e.target.value }))}
                     placeholder="faturado, à vista, 50% pedido / 50% entrega..."
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                              fontSize: 12, padding: "6px 8px" }} />
              <datalist id="formas-pagto-sug">
                <option value="faturado" />
                <option value="avista" />
                <option value="50% pedido / 50% entrega" />
                <option value="30% pedido / 70% entrega" />
                <option value="antecipado" />
              </datalist>
              {enviarForm.forma === "faturado" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 10.5, color: t.textSecondary }}>Prazo</label>
                    <input type="text" value={enviarForm.prazo}
                           onChange={(e) => setEnviarForm((f) => ({ ...f, prazo: e.target.value.replace(/\bdias?\b/gi, "").trim() }))}
                           placeholder="30 ou 30/60/90"
                           style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                    fontSize: 12, padding: "6px 8px", width: 160 }} />
                    <span style={{ fontSize: 10, color: t.textMuted }}>dias</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 10.5, color: t.textSecondary }}>Entrada no ato</label>
                    <input type="number" min={0} max={99} step={0.5} value={enviarForm.entrada}
                           onChange={(e) => setEnviarForm((f) => ({ ...f, entrada: e.target.value }))}
                           placeholder="0"
                           style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                    fontSize: 12, padding: "6px 8px", width: 70 }} />
                    <span style={{ fontSize: 10, color: t.textMuted }}>% do valor vence hoje; o restante divide nos prazos</span>
                  </div>
                  {(() => {
                    const p = parsePrazosLista(enviarForm.prazo);
                    if (p.length === 1 && p[0] === 0 && !enviarForm.prazo) return null;
                    const hoje = new Date();
                    const vencs = p.map((d) => { const dd = new Date(hoje); dd.setDate(dd.getDate() + d); return dd.toLocaleDateString("pt-BR"); });
                    const ok = p.length >= 1;
                    const eNum = parseFloat((enviarForm.entrada || "").replace(",", "."));
                    const temEntrada = eNum > 0 && eNum < 100;
                    return (
                      <div style={{ fontSize: 10, color: ok ? t.textSecondary : "#EF4444", background: `${t.textPrimary}05`,
                                    padding: "6px 8px", border: `1px dashed ${t.border}` }}>
                        {ok ? (
                          <>
                            {temEntrada && <>Entrada <b>{eNum}%</b> hoje ({hoje.toLocaleDateString("pt-BR")}) + </>}
                            <b>{p.length}</b> parcela(s){temEntrada ? " do restante" : ""}: {p.map((d, i) => `${d}d (${vencs[i]})`).join(" · ")}
                          </>
                        ) : "Prazo inválido — só números separados por /. Ex: 30/60/90."}
                      </div>
                    );
                  })()}
                </>
              )}
              {/* Frete da remessa: o valor dos itens é só do produto comprado; o frete
                  também precisa ser pago. Vira uma linha FRETE junto no envio. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 10.5, color: t.textSecondary }}>Frete R$</label>
                <input type="text" inputMode="decimal" value={enviarForm.frete}
                       onChange={(e) => setEnviarForm((f) => ({ ...f, frete: e.target.value }))}
                       placeholder="0,00"
                       style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                fontSize: 12, padding: "6px 8px", width: 110 }} />
                <span style={{ fontSize: 10, color: t.textMuted }}>opcional; entra como linha FRETE na mesma remessa</span>
              </div>
              {/* Resumo: total dos itens marcados + frete, pra conferir antes de mandar. */}
              {(() => {
                const sel = linhas.filter((l) => selecionados[l.key] && !l.atendidoEstoque);
                const totItens = sel.reduce((acc, l) => {
                  const escolhido = l.orcamentos.find((o) => o.escolhido);
                  return acc + (((l.origem === "item" ? l.item?.valor || 0 : l.valor) || escolhido?.valor || 0));
                }, 0);
                const fr = parseFloat((enviarForm.frete || "").replace(",", ".")) || 0;
                const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                return (
                  <div style={{ fontSize: 10, color: t.textSecondary, background: `${t.textPrimary}05`,
                                padding: "6px 8px", border: `1px dashed ${t.border}` }}>
                    Itens {fmt(totItens)}{fr > 0 ? <> + frete {fmt(fr)} = <b>{fmt(totItens + fr)}</b></> : <> = <b>{fmt(totItens)}</b></>}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={() => setEnviarModal(false)}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                               padding: "6px 12px", fontSize: 11, cursor: "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Cancelar
              </button>
              <button onClick={enviarPraAprovacao} disabled={busy === "enviar"}
                      style={{ background: t.textPrimary, border: `1px solid ${t.textPrimary}`, color: t.bg,
                               padding: "6px 14px", fontSize: 11, fontWeight: 700,
                               cursor: busy === "enviar" ? "wait" : "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em",
                               opacity: busy === "enviar" ? 0.6 : 1 }}>
                {busy === "enviar" ? "Enviando…" : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fornModal.open && (
        <FornecedorFormModal
          t={t}
          fornecedorEdit={fornModal.edit}
          nomeInicial={fornModal.nomeInicial}
          onClose={() => setFornModal({ open: false, edit: null })}
          onSaved={async (f) => {
            const { data } = await sb.from("compras_fornecedores").select("id,nome,cnpj,pix,banco,agencia,conta,razao_social,telefone,email,forma_pagamento,prazo_pagamento").eq("ativo", true).order("nome");
            setFornecedores((data || []) as Fornecedor[]);
            fornModal.onSelect?.(f);
            setFornModal({ open: false, edit: null });
          }}
        />
      )}

      {/* Modal de frete avulso: cria a linha FRETE a qualquer momento (mesmo com itens
          já enviados/pagos) — vai direto pra aprovação do Financeiro no Core. */}
      {freteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
             onClick={() => setFreteModal(false)}>
          <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 20,
                        maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
               onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textPrimary }}>
              Lançar frete
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: -6 }}>
              Vira uma linha FRETE deste pedido e vai pra aprovação do Financeiro, como qualquer item.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 10.5, color: t.textSecondary }}>Valor R$</label>
                <input type="text" inputMode="decimal" value={freteForm.valor} autoFocus
                       onChange={(e) => setFreteForm((f) => ({ ...f, valor: e.target.value }))}
                       placeholder="0,00"
                       style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                fontSize: 12, padding: "6px 8px", width: 110 }} />
              </div>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Transportadora / fornecedor (opcional)</label>
              <select value={freteForm.fornecedor_id || ""}
                      onChange={(e) => setFreteForm((f) => ({ ...f, fornecedor_id: e.target.value || null }))}
                      style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                               fontSize: 12, padding: "6px 8px" }}>
                <option value="">Sem fornecedor</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Forma de pagamento</label>
              {/* datalist próprio: o "formas-pagto-sug" vive dentro do modal de envio e
                  não existe no DOM quando só este modal está aberto */}
              <input type="text" list="formas-pagto-frete" value={freteForm.forma}
                     onChange={(e) => setFreteForm((f) => ({ ...f, forma: e.target.value }))}
                     placeholder="faturado, à vista..."
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                              fontSize: 12, padding: "6px 8px" }} />
              <datalist id="formas-pagto-frete">
                <option value="faturado" />
                <option value="avista" />
                <option value="antecipado" />
              </datalist>
              {freteForm.forma === "faturado" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 10.5, color: t.textSecondary }}>Prazo</label>
                  <input type="text" value={freteForm.prazo}
                         onChange={(e) => setFreteForm((f) => ({ ...f, prazo: e.target.value.replace(/\bdias?\b/gi, "").trim() }))}
                         placeholder="30 ou 30/60/90"
                         style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                  fontSize: 12, padding: "6px 8px", width: 160 }} />
                  <span style={{ fontSize: 10, color: t.textMuted }}>dias</span>
                </div>
              )}
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Observação (opcional)</label>
              <input type="text" value={freteForm.obs}
                     onChange={(e) => setFreteForm((f) => ({ ...f, obs: e.target.value }))}
                     placeholder="ex: entrega das ferragens, NF 1234"
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                              fontSize: 12, padding: "6px 8px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={() => setFreteModal(false)}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                               padding: "6px 12px", fontSize: 11, cursor: "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Cancelar
              </button>
              <button onClick={lancarFreteAvulso} disabled={busy === "frete"}
                      style={{ background: t.textPrimary, border: `1px solid ${t.textPrimary}`, color: t.bg,
                               padding: "6px 14px", fontSize: 11, fontWeight: 700,
                               cursor: busy === "frete" ? "wait" : "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em",
                               opacity: busy === "frete" ? 0.6 : 1 }}>
                {busy === "frete" ? "Lançando…" : "Lançar frete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {agrupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
             onClick={() => setAgrupModal(false)}>
          <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 20,
                        maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
               onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textPrimary }}>
              Agrupar {nSelecItens} itens em 1 cotação
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: -6 }}>
              O valor total é dividido igualmente entre os itens. Pode ajustar item a item depois.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Fornecedor *</label>
              <FornecedorPicker t={t} fornecedores={fornecedores}
                value={agrupForm.fornecedor_id}
                onChange={(id) => setAgrupForm((f) => ({ ...f, fornecedor_id: id }))}
                dadosOk={(f) => fornecedorDadosOk(f)}
                onCadastrar={(nome) => setFornModal({ open: true, edit: agrupForm.fornecedor_id ? fornecedorById(agrupForm.fornecedor_id) || null : null, nomeInicial: nome, onSelect: (f) => setAgrupForm((s) => ({ ...s, fornecedor_id: f.id })) })}
              />
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Valor total do orçamento (R$) *</label>
              <input type="text" inputMode="decimal" value={agrupForm.valor_total}
                     onChange={(e) => setAgrupForm((f) => ({ ...f, valor_total: e.target.value }))}
                     placeholder="0,00"
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                              fontSize: 12, padding: "6px 8px" }} />
              <label style={{ fontSize: 10.5, color: t.textSecondary, marginTop: 4 }}>Forma de pagamento *</label>
              <input type="text" list="formas-pagto-sug" value={agrupForm.forma}
                     onChange={(e) => setAgrupForm((f) => ({ ...f, forma: e.target.value }))}
                     placeholder="faturado, à vista, 50% pedido / 50% entrega..."
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                              fontSize: 12, padding: "6px 8px" }} />
              <datalist id="formas-pagto-sug">
                <option value="faturado" />
                <option value="avista" />
                <option value="50% pedido / 50% entrega" />
                <option value="30% pedido / 70% entrega" />
                <option value="antecipado" />
              </datalist>
              {agrupForm.forma === "faturado" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 10.5, color: t.textSecondary }}>Prazo</label>
                  <input type="text" value={agrupForm.prazo}
                         onChange={(e) => setAgrupForm((f) => ({ ...f, prazo: e.target.value }))}
                         placeholder="30 ou 30/60/90"
                         style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                                  fontSize: 12, padding: "6px 8px", width: 140 }} />
                  <span style={{ fontSize: 10, color: t.textMuted }}>dias</span>
                </div>
              )}
              <label style={{ fontSize: 10.5, color: t.textSecondary, marginTop: 4 }}>Orçamento PDF (opcional)</label>
              <input type="file" accept="application/pdf,image/*"
                     onChange={(e) => setAgrupForm((f) => ({ ...f, arquivo: e.target.files?.[0] || null }))}
                     style={{ fontSize: 11 }} />
              {agrupForm.arquivo && (
                <div style={{ fontSize: 10, color: t.textMuted }}>Arquivo: {agrupForm.arquivo.name}</div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={() => setAgrupModal(false)}
                      style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                               padding: "6px 12px", fontSize: 11, cursor: "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Cancelar
              </button>
              <button onClick={agruparEmCotacao} disabled={busy === "agrupar"}
                      style={{ background: t.textPrimary, border: `1px solid ${t.textPrimary}`, color: t.bg,
                               padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: busy === "agrupar" ? "wait" : "pointer",
                               textTransform: "uppercase", letterSpacing: "0.05em", opacity: busy === "agrupar" ? 0.6 : 1 }}>
                {busy === "agrupar" ? "Agrupando…" : "Agrupar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBtn({ t, disabled, onClick, icon, label }: {
  t: any; disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
            style={{ display: "inline-flex", alignItems: "center", gap: 4,
                     padding: "3px 8px", background: "transparent", border: `1px solid ${t.border}`,
                     color: t.textSecondary, fontSize: 10, cursor: disabled ? "wait" : "pointer",
                     opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" }}>
      {icon} {label}
    </button>
  );
}

// Sub-painel: input de data + lista de orçamentos com upload
function SubPanelOrcamentos({ linha, t, onPatch, fornecedores, fornecedorDadosOk, fornecedorById, setFornModal }: {
  linha: LinhaUnificada;
  t: any;
  onPatch: (patch: Partial<{
    comprar_em: string | null; orcamentos: Orcamento[];
    valor: number; forma_pagamento: string; prazo_faturamento_dias: number; prazo_faturamento_texto: string | null;
    fornecedor_id: string | null; fornecedor_nome_snapshot: string | null;
  }>) => Promise<void>;
  fornecedores: Fornecedor[];
  fornecedorDadosOk: (f: Fornecedor | undefined | null) => boolean;
  fornecedorById: (id: string | null | undefined) => Fornecedor | undefined;
  setFornModal: (m: { open: boolean; edit: Fornecedor | null; nomeInicial?: string; onSelect?: (f: Fornecedor) => void }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const novos: Orcamento[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
        const path = `${linha.item?.card_id || "legacy"}/${linha.key.replace(":", "_")}/${Date.now()}-${i}.${ext}`;
        const { data, error } = await sb.storage.from("compras-orcamentos").upload(path, f, {
          contentType: f.type || "application/pdf",
          upsert: false,
        });
        if (error) { alert("Falha upload: " + error.message); continue; }
        const { data: pub } = sb.storage.from("compras-orcamentos").getPublicUrl(data.path);
        novos.push({
          id: crypto.randomUUID(),
          arquivo_url: pub.publicUrl,
          arquivo_nome: f.name,
          ts: new Date().toISOString(),
          escolhido: linha.orcamentos.length === 0,   // 1º vira escolhido automático
          valor: linha.valor,
        });
      }
      const merged = [...linha.orcamentos, ...novos];
      // Garante que só 1 é escolhido; se o adicionado veio como escolhido, marca só ele
      const marcadoAgora = novos.find((o) => o.escolhido);
      const final = merged.map((o) => marcadoAgora ? { ...o, escolhido: o.id === marcadoAgora.id } : o);
      await onPatch({ orcamentos: final });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function marcarEscolhido(id: string) {
    const novo = linha.orcamentos.map((o) => ({ ...o, escolhido: o.id === id }));
    onPatch({ orcamentos: novo });
  }

  function removerOrc(id: string) {
    if (!confirm("Remover esse orçamento?")) return;
    const novo = linha.orcamentos.filter((o) => o.id !== id);
    // Se removeu o escolhido e sobrou algum, marca o primeiro
    if (!novo.some((o) => o.escolhido) && novo.length > 0) novo[0].escolhido = true;
    onPatch({ orcamentos: novo });
  }

  const item = linha.item;
  return (
    <div style={{ padding: "10px 12px", borderTop: `1px dashed ${t.border}`, background: t.bg, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Calendar size={13} color={t.textMuted} />
        <label style={{ fontSize: 10.5, color: t.textSecondary }}>Comprar em:</label>
        <input type="date"
               value={linha.comprar_em || ""}
               onChange={(e) => onPatch({ comprar_em: e.target.value || null })}
               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11, padding: "4px 6px", borderRadius: 0 }} />
        {linha.comprar_em && (
          <button type="button" onClick={() => onPatch({ comprar_em: null })}
                  style={{ background: "transparent", border: "none", color: t.textMuted, fontSize: 10, cursor: "pointer" }}>
            limpar
          </button>
        )}
        <span style={{ fontSize: 9.5, color: t.textMuted }}>vazio = comprar quando aprovado</span>
      </div>

      {/* Fornecedor aparece SEMPRE, inclusive na linha legacy (material que ainda nao
          virou compras_itens). Antes ficava escondido atras de {item && ...}: a linha
          exibia o nome do fornecedor vindo do card mas nao havia como escolher/corrigir,
          e o envio pro Financeiro acusava "fornecedor nao selecionado". */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label style={{ fontSize: 10.5, color: t.textSecondary, display: "block", marginBottom: 3 }}>Fornecedor:</label>
          <FornecedorPicker t={t} fornecedores={fornecedores}
            value={item ? item.fornecedor_id : linha.fornecedor_id}
            onChange={(id) => {
              const f = id ? fornecedores.find((x) => x.id === id) : null;
              onPatch({ fornecedor_id: id, fornecedor_nome_snapshot: f?.nome || null });
            }}
            dadosOk={(f) => fornecedorDadosOk(f)}
            onCadastrar={(nome) => {
              const atual = item ? item.fornecedor_id : linha.fornecedor_id;
              setFornModal({ open: true, edit: atual ? fornecedorById(atual) || null : null, nomeInicial: nome, onSelect: (f) => onPatch({ fornecedor_id: f.id, fornecedor_nome_snapshot: f.nome }) });
            }}
          />
        </div>
      </div>

      {item && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 10.5, color: t.textSecondary }}>Valor R$</label>
          <input type="number" step="0.01" min={0}
                 defaultValue={item.valor}
                 onBlur={(e) => {
                   const v = Math.max(0, parseFloat(e.target.value) || 0);
                   if (v !== item.valor) onPatch({ valor: v });
                 }}
                 style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11, padding: "4px 6px", width: 90 }} />
          <label style={{ fontSize: 10.5, color: t.textSecondary }}>Pgto</label>
          <input type="text" list="formas-pagto-sug" defaultValue={item.forma_pagamento}
                 onBlur={(e) => { const v = e.target.value.trim() || "faturado"; if (v !== item.forma_pagamento) onPatch({ forma_pagamento: v }); }}
                 placeholder="faturado, à vista, 50% pedido / 50% entrega..."
                 style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11, padding: "4px 6px", minWidth: 220 }} />
          <datalist id="formas-pagto-sug">
            <option value="faturado" />
            <option value="avista" />
            <option value="50% pedido / 50% entrega" />
            <option value="30% pedido / 70% entrega" />
            <option value="antecipado" />
          </datalist>
          {item.forma_pagamento === "faturado" && (
            <>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Prazo</label>
              <input type="text"
                     defaultValue={item.prazo_faturamento_texto || String(item.prazo_faturamento_dias || 30)}
                     onBlur={(e) => {
                       const txt = e.target.value.trim();
                       const num = parsePrazo(txt);
                       const cur = item.prazo_faturamento_texto || String(item.prazo_faturamento_dias || 0);
                       if (txt !== cur) onPatch({ prazo_faturamento_dias: num, prazo_faturamento_texto: txt || null });
                     }}
                     placeholder="30 ou 30/60/90"
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11, padding: "4px 6px", width: 130 }} />
              <span style={{ fontSize: 10, color: t.textMuted }}>d</span>
              <label style={{ fontSize: 10.5, color: t.textSecondary }}>Entrada</label>
              <input type="number" min={0} max={99} step={0.5}
                     defaultValue={item.entrada_pct ?? ""}
                     onBlur={(e) => {
                       const v = parseFloat(e.target.value.replace(",", "."));
                       const novo = v > 0 && v < 100 ? Math.round(v * 100) / 100 : null;
                       if (novo !== (item.entrada_pct ?? null)) onPatch({ entrada_pct: novo });
                     }}
                     placeholder="0"
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11, padding: "4px 6px", width: 60 }} />
              <span style={{ fontSize: 10, color: t.textMuted }}>% no ato</span>
            </>
          )}
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, color: t.textSecondary, fontWeight: 600 }}>
            <Paperclip size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Orçamentos ({linha.orcamentos.length})
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
                          border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSecondary,
                          fontSize: 10, cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.5 : 1 }}>
            <Paperclip size={11} /> {uploading ? "Enviando…" : "Anexar PDF"}
            <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple hidden
                   onChange={(e) => onUpload(e.target.files)} disabled={uploading} />
          </label>
        </div>
        {linha.orcamentos.length === 0 ? (
          <div style={{ fontSize: 10, color: t.textMuted, padding: "6px 0" }}>
            Sem orçamento por enquanto — opcional. Anexe o PDF do fornecedor se quiser mandar pro Financeiro conferir.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {linha.orcamentos.map((o) => (
              <div key={o.id}
                   style={{ display: "grid", gridTemplateColumns: "auto 1fr auto",
                            alignItems: "center", gap: 8, padding: "5px 8px",
                            border: `1px solid ${o.escolhido ? "#10B981" : t.border}`,
                            background: o.escolhido ? "#10B98110" : "transparent" }}>
                <button type="button" onClick={() => marcarEscolhido(o.id!)}
                        title={o.escolhido ? "Este é o orçamento escolhido" : "Marcar como escolhido"}
                        style={{ background: "transparent", border: "none", cursor: "pointer",
                                 color: o.escolhido ? "#10B981" : t.textMuted, padding: 2 }}>
                  <Star size={14} fill={o.escolhido ? "#10B981" : "none"} />
                </button>
                <a href={o.arquivo_url} target="_blank" rel="noreferrer"
                   style={{ display: "flex", alignItems: "center", gap: 6, color: t.textPrimary, fontSize: 11, textDecoration: "none", minWidth: 0 }}>
                  <FileText size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {o.arquivo_nome || "orçamento.pdf"}
                  </span>
                </a>
                <button type="button" onClick={() => removerOrc(o.id!)}
                        title="Remover"
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: t.textMuted, padding: 2 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParcelasBox({ t, itemId }: { t: any; itemId: string }) {
  const [parcelas, setParcelas] = useState<Array<{
    id: string; valor: number; data_vencimento: string; data_pagamento: string | null; status: string;
    numero_documento: string;
    boleto_url: string | null; boleto_nome: string | null;
    comprovante_url: string | null; comprovante_nome: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.rpc("compras_item_parcelas", { p_item_id: itemId });
        setParcelas((data as any[]) || []);
      } finally { setLoading(false); }
    })();
  }, [itemId]);
  if (loading) return <div style={{ fontSize: 10, color: t.textMuted, padding: 4 }}>Carregando parcelas…</div>;
  if (parcelas.length === 0) return null;
  const pagas = parcelas.filter((p) => ["pago", "conciliado", "recebido"].includes(p.status)).length;
  const totalPago = parcelas.filter((p) => ["pago", "conciliado", "recebido"].includes(p.status)).reduce((s, p) => s + Number(p.valor), 0);
  const totalAberto = parcelas.filter((p) => !["pago", "conciliado", "recebido", "cancelado"].includes(p.status)).reduce((s, p) => s + Number(p.valor), 0);
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(5,5,5,0.03)", border: `1px dashed ${t.border}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.textMuted, marginBottom: 6 }}>
        {parcelas.length === 1 ? "Boleto" : `Parcelas · ${pagas}/${parcelas.length} pagas`}
        {totalPago > 0 && <span style={{ marginLeft: 8, color: t.textSecondary }}>Pago R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
        {totalAberto > 0 && <span style={{ marginLeft: 8, color: t.textSecondary }}>Aberto R$ {totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {parcelas.map((p, i) => {
          const isPaga = ["pago", "conciliado", "recebido"].includes(p.status);
          const isVencida = !isPaga && p.data_vencimento < hoje;
          const isHoje = !isPaga && p.data_vencimento === hoje;
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "40px 90px 100px 1fr auto", gap: 8, alignItems: "center", fontSize: 10.5, padding: "3px 4px" }}>
              <span style={{ color: t.textMuted, fontWeight: 700 }}>{parcelas.length > 1 ? `${i+1}/${parcelas.length}` : ""}</span>
              <span style={{ color: t.textSecondary }}>{p.data_vencimento.split("-").reverse().join("/")}</span>
              <span style={{ color: t.textPrimary, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              <span style={{ color: isPaga ? "#10B981" : isVencida ? "#EF4444" : isHoje ? "#EAB308" : t.textMuted, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" }}>
                {isPaga ? `✓ Pago em ${p.data_pagamento?.split("-").reverse().join("/")}` : isVencida ? "Vencida" : isHoje ? "Vence hoje" : "A vencer"}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {p.boleto_url && (
                  <a href={p.boleto_url} target="_blank" rel="noreferrer" style={{ fontSize: 9.5, color: t.textSecondary, textDecoration: "underline" }}>
                    📎 boleto
                  </a>
                )}
                {p.comprovante_url && (
                  <a href={p.comprovante_url} target="_blank" rel="noreferrer" style={{ fontSize: 9.5, color: "#10B981", textDecoration: "underline", fontWeight: 600 }}>
                    💰 comprovante
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FornecedorPicker({ t, fornecedores, value, onChange, dadosOk, onCadastrar, placeholder = "Buscar ou cadastrar…" }: {
  t: any;
  fornecedores: Fornecedor[];
  value: string | null;
  onChange: (id: string | null) => void;
  dadosOk: (f: Fornecedor | undefined) => boolean;
  onCadastrar: (nomeInicial?: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selecionado = value ? fornecedores.find((f) => f.id === value) : null;
  const filtrados = q.trim()
    ? fornecedores.filter((f) => (f.nome || "").toLowerCase().includes(q.toLowerCase()) || (f.cnpj || "").includes(q))
    : fornecedores.slice(0, 12);
  return (
    <div style={{ position: "relative" }}>
      {selecionado ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", border: `1px solid ${t.border}`, background: t.inputBg }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 600 }}>
              {selecionado.nome}
              {dadosOk(selecionado)
                ? <span style={{ color: "#10B981", marginLeft: 6 }}>✓</span>
                : <span style={{ color: "#EF4444", marginLeft: 6 }}>⚠ dados incompletos</span>}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted }}>
              {selecionado.cnpj || "sem CNPJ"} · {selecionado.pix ? `PIX: ${selecionado.pix}` : selecionado.banco ? `${selecionado.banco} Ag ${selecionado.agencia || "?"} CC ${selecionado.conta || "?"}` : "sem banco/PIX"}
            </div>
          </div>
          {!dadosOk(selecionado) && (
            <button type="button" onClick={() => onCadastrar(selecionado.nome)}
                    style={{ background: "#EF4444", color: "#fff", border: "none", padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
              Completar
            </button>
          )}
          <button type="button" onClick={() => onChange(null)}
                  style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
            Trocar
          </button>
        </div>
      ) : (
        <>
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                 onFocus={() => setOpen(true)}
                 onBlur={() => setTimeout(() => setOpen(false), 200)}
                 placeholder={placeholder}
                 style={{ width: "100%", boxSizing: "border-box", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px" }} />
          {open && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: t.bg, border: `1px solid ${t.border}`, maxHeight: 240, overflowY: "auto", zIndex: 10 }}>
              {filtrados.length === 0 && q.trim() && (
                <div style={{ padding: 8, fontSize: 11, color: t.textMuted }}>Nenhum encontrado.</div>
              )}
              {filtrados.map((f) => {
                const tip = [
                  f.nome, f.cnpj ? `CNPJ ${f.cnpj}` : null, f.razao_social,
                  f.pix ? `PIX: ${f.pix}` : null,
                  (f.banco || f.agencia || f.conta) ? `Banco: ${f.banco || "?"} Ag ${f.agencia || "?"} CC ${f.conta || "?"}` : null,
                  f.telefone ? `Tel ${f.telefone}` : null, f.email,
                  f.forma_pagamento ? `Forma pagto padrão: ${f.forma_pagamento}` : null,
                  f.prazo_pagamento ? `Prazo padrão: ${f.prazo_pagamento}` : null,
                ].filter(Boolean).join("\n");
                return (
                  <div key={f.id} title={tip}
                       onMouseDown={() => { onChange(f.id); setQ(""); setOpen(false); }}
                       style={{ padding: "6px 8px", cursor: "pointer", borderBottom: `1px solid ${t.border}`, fontSize: 11 }}>
                    <div style={{ color: t.textPrimary, fontWeight: 600 }}>
                      {f.nome}{dadosOk(f) ? <span style={{ color: "#10B981", marginLeft: 4 }}>✓</span> : <span style={{ color: "#EAB308", marginLeft: 4 }}>⚠</span>}
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span>{f.cnpj || "sem CNPJ"}</span>
                      {f.forma_pagamento && <span>· {f.forma_pagamento}</span>}
                      {f.prazo_pagamento && <span>· prazo {f.prazo_pagamento}</span>}
                    </div>
                  </div>
                );
              })}
              <div onMouseDown={() => { onCadastrar(q); setQ(""); setOpen(false); }}
                   style={{ padding: "8px 10px", cursor: "pointer", background: t.textPrimary, color: t.bg, fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                + Cadastrar novo fornecedor{q.trim() ? ` "${q}"` : ""}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FornecedorFormModal({ t, fornecedorEdit, nomeInicial, onClose, onSaved }: {
  t: any;
  fornecedorEdit: Fornecedor | null;
  nomeInicial?: string;
  onClose: () => void;
  onSaved: (f: Fornecedor) => void;
}) {
  const [form, setForm] = useState<Partial<Fornecedor> & { categoria?: string }>({
    nome: fornecedorEdit?.nome || nomeInicial || "",
    cnpj: fornecedorEdit?.cnpj || "",
    razao_social: fornecedorEdit?.razao_social || "",
    telefone: fornecedorEdit?.telefone || "",
    email: fornecedorEdit?.email || "",
    pix: fornecedorEdit?.pix || "",
    banco: fornecedorEdit?.banco || "",
    agencia: fornecedorEdit?.agencia || "",
    conta: fornecedorEdit?.conta || "",
    categoria: (fornecedorEdit as any)?.categoria || "geral",
  });
  const [busy, setBusy] = useState(false);
  async function salvar() {
    if (!form.nome?.trim()) { alert("Nome é obrigatório."); return; }
    if (!form.cnpj?.trim()) { alert("CNPJ é obrigatório."); return; }
    // PIX/banco NÃO bloqueia mais o salvar (25/08): a trava universal induzia
    // cadastro-lixo (banco="." etc). A exigência real acontece no envio pro
    // Financeiro, e só quando a forma de pagamento é direta (não-faturado).
    setBusy(true);
    try {
      const body: any = {
        nome: form.nome.trim(), cnpj: form.cnpj.trim(),
        razao_social: form.razao_social?.trim() || null,
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
        pix: form.pix?.trim() || null,
        banco: form.banco?.trim() || null,
        agencia: form.agencia?.trim() || null,
        conta: form.conta?.trim() || null,
        categoria: form.categoria || "geral",
        ativo: true,
      };
      let saved: Fornecedor;
      if (fornecedorEdit) {
        const { data, error } = await sb.from("compras_fornecedores").update(body).eq("id", fornecedorEdit.id).select().single();
        if (error) { alert("Falha: " + error.message); return; }
        saved = data as Fornecedor;
      } else {
        const { data, error } = await sb.from("compras_fornecedores").insert(body).select().single();
        if (error) { alert("Falha: " + error.message); return; }
        saved = data as Fornecedor;
      }
      onSaved(saved);
    } finally { setBusy(false); }
  }
  const inp = { background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={onClose}>
      <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 20, maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textPrimary }}>
          {fornecedorEdit ? "Editar fornecedor" : "Novo fornecedor"}
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 10.5, color: t.textSecondary }}>Nome *</label>
          <input type="text" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} style={inp} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>CNPJ *</label>
              <input type="text" value={form.cnpj || ""} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
            <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Razão social</label>
              <input type="text" value={form.razao_social || ""} onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Telefone</label>
              <input type="text" value={form.telefone || ""} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
            <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Email</label>
              <input type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ borderTop: `1px dashed ${t.border}`, paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Dados de pagamento — precisa PIX OU banco/ag/conta</div>
            <label style={{ fontSize: 10.5, color: t.textSecondary }}>PIX</label>
            <input type="text" value={form.pix || ""} placeholder="chave PIX (CNPJ, email, celular ou aleatória)"
                   onChange={(e) => setForm((f) => ({ ...f, pix: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 6, marginTop: 4 }}>
              <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Banco</label>
                <input type="text" value={form.banco || ""} onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
              <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Agência</label>
                <input type="text" value={form.agencia || ""} onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
              <div><label style={{ fontSize: 10.5, color: t.textSecondary }}>Conta</label>
                <input type="text" value={form.conta || ""} onChange={(e) => setForm((f) => ({ ...f, conta: e.target.value }))} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary, padding: "6px 12px", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>Cancelar</button>
          <button onClick={salvar} disabled={busy}
                  style={{ background: t.textPrimary, border: `1px solid ${t.textPrimary}`, color: t.bg, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer", textTransform: "uppercase", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// "30" → 30 | "30/60/90" → 30 (primeira parcela) | "45d" → 45 | "" → 0
function parsePrazo(s: string | number | null | undefined): number {
  if (typeof s === "number") return Math.max(0, s|0);
  if (!s) return 0;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0]) : 0;
}

/** Extrai lista de prazos ignorando trechos com % ("50% pedido / 50% entrega" → []).
 *  "30/60/90" → [30,60,90] · "45 dias" → [45] · "à vista" → [0]. Mesma lógica da RPC. */
function parsePrazosLista(s: string | null | undefined): number[] {
  if (!s || !String(s).trim()) return [0];
  let clean = String(s).toLowerCase();
  clean = clean.replace(/\d+\s*%[^,/;]*/g, ""); // remove trechos com %
  const nums: number[] = [];
  const re = /(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 3650) nums.push(n);
  }
  return nums.length ? nums : [0];
}

function parseValor(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = v.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
