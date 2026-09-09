/**
 * Modal do card de Compras — mesmos kanban_cards do Space.
 * Checklists vivem em details.checklists [{name, items:[{name,done}]}] e
 * comentários em chat_messages [{id,user,user_id,avatar,msg,attachments,mentions,ts}]
 * (shape idêntico ao _ComentariosTab do Space — os dois apps leem/escrevem igual).
 * Não fecha com click no backdrop (padrão Parket: só X / Fechar).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { COLUNAS_COMPRAS, type DeptCompras } from "../lib/theme";
import { X, Send, Trash2, Package, CalendarClock, User, Building2, FileText, Pencil, Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { ComprasCard } from "../pages/Kanban";
import { GastosProjeto } from "./HistoricoProjeto";
import ComprasItensPanel from "./ComprasItensPanel";
import { DitadoBtn } from "./DitadoBtn";

// Ronaldo + admins podem editar a solicitação e excluir cards (pedido do Will 10/07/2026)
const EDITORES_COMPRAS = new Set(["compras.01@parket.com.br"]);
const ROLES_EDITORES = new Set(["admin", "superadmin"]);

type FornecedorRow = {
  id: string; nome: string; tipo: string | null; cnpj: string | null; razao_social: string | null;
  telefone: string | null; email: string | null; pix: string | null;
  banco: string | null; agencia: string | null; conta: string | null;
  forma_pagamento: string | null; prazo_pagamento: string | null;
};

function parseValor(s: any): number {
  if (typeof s === "number") return s;
  let str = String(s ?? "").replace(/[R$\s]/g, "");
  if (str.includes(",")) str = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* Item da lista de fabricação de uma OP do PCP (producao_ordens.itens).
   Só os campos que o Ronaldo precisa ver aqui. */
type ItemOP = {
  numero?: string | null;
  categoria?: string | null;
  subtipo?: string | null;
  especie?: string | null;
  cor?: string | null;
  dimensao?: string | null;
  ambiente?: string | null;
  metragem?: number | null;
  qtd?: number | null;
  descritivo?: string | null;
  porta?: { tipo?: string | null; largura_cm?: number | null; altura_cm?: number | null } | null;
};

/* Medida da porta no mesmo formato da proposta: "MEDIDAS (1,58 x 2,50)".
   Acima de 10 o número veio em cm, abaixo já veio em metro (mesma regra do
   cmToM do renderer da proposta). */
function medidasPorta(p?: { largura_cm?: number | null; altura_cm?: number | null } | null): string | null {
  const emM = (v: number) => (v > 10 ? v / 100 : v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const l = Number(p?.largura_cm) || 0;
  const a = Number(p?.altura_cm) || 0;
  return l > 0 && a > 0 ? `MEDIDAS (${emM(l)} x ${emM(a)})` : null;
}

/* Mesmo nome que a Produção mostra no card dela (nomeProdutoFab do producao-app):
   categoria na frente e, na sequência, o produto tirado do descritivo da
   proposta, porque marcenaria/forro/painel só têm o nome completo lá.
   Duplicado aqui de propósito: os dois apps não compartilham código. */
function nomeProdutoOP(it: ItemOP): string {
  const cat = String(it.categoria || "").trim().toUpperCase();
  const rotulo = cat === "PORTA" ? `PORTA${it.porta?.tipo ? " " + it.porta.tipo.toUpperCase() : ""}` : cat || "MARCENARIA";
  const campos = [it.subtipo, it.especie, it.cor].filter(Boolean).join(" · ");
  if (cat === "PORTA") return [rotulo, campos].filter(Boolean).join(" · ");
  let desc = String(it.descritivo || "").split("\n")[0].trim();
  if (desc.toUpperCase().startsWith(rotulo)) desc = desc.slice(rotulo.length).replace(/^[\s\-–—:]+/, "").trim();
  if (desc.length > 90) desc = desc.slice(0, 90).trimEnd() + "…";
  return [rotulo, desc || campos].filter(Boolean).join(" · ");
}

// Combobox de fornecedor: digita pra buscar por nome/CNPJ ou escolhe na lista (mesmo padrão do projeto no /solicitar)
function FornecedorPicker({ value, onChange, fornecedores, t, width }: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  fornecedores: FornecedorRow[];
  t: any;
  width?: number | string;
}) {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const sel = value ? fornecedores.find((f) => f.id === value) : undefined;
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? fornecedores.filter((f) => f.nome.toLowerCase().includes(q) || (f.cnpj || "").toLowerCase().includes(q))
      : fornecedores;
    return base.slice(0, 40);
  }, [busca, fornecedores]);
  return (
    <div style={{ position: "relative", width: width ?? "100%" }}>
      <input
        type="text"
        name={`forn-${Math.random().toString(36).slice(2, 8)}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        value={sel ? sel.nome : busca}
        placeholder="Fornecedor…"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => { setBusca(e.target.value); if (sel) onChange(null); setOpen(true); }}
        style={{
          width: "100%", boxSizing: "border-box", background: t.inputBg,
          border: `1px solid ${t.border}`, color: sel ? t.textPrimary : t.textMuted,
          fontSize: 11.5, padding: "5px 22px 5px 6px", borderRadius: 0, outline: "none",
          WebkitTextSecurity: "none" as any,
        }} />
      {(sel || busca) && (
        <button type="button" title="Limpar"
                onMouseDown={(e) => { e.preventDefault(); onChange(null); setBusca(""); }}
                style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: t.textMuted, cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
          <X size={11} />
        </button>
      )}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, minWidth: "100%", zIndex: 30,
          background: t.modalBg, border: `1px solid ${t.borderStrong}`,
          maxHeight: 180, overflowY: "auto", boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        }}>
          {filtrados.map((f) => (
            <div key={f.id}
                 onMouseDown={(e) => { e.preventDefault(); onChange(f.id); setBusca(""); setOpen(false); }}
                 style={{ padding: "6px 8px", fontSize: 11.5, color: t.textPrimary, cursor: "pointer", borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
              {f.nome}{f.cnpj ? <span style={{ color: t.textMuted }}> · {f.cnpj}</span> : null}
            </div>
          ))}
          {filtrados.length === 0 && (
            <div style={{ padding: "6px 8px", fontSize: 11, color: t.textMuted }}>Nenhum fornecedor encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}

type ChatMsg = {
  id: string;
  user: string;
  user_id?: string | null;
  avatar?: string;
  msg: string;
  attachments?: any[];
  mentions?: string[];
  ts: string;
};

export default function CardModal({ cardId, dept, onClose, onChanged }: {
  cardId: string;
  dept: DeptCompras;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTheme();
  const { user } = useAuth();
  const [card, setCard] = useState<ComprasCard | null>(null);
  const [chatText, setChatText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [ePrazo, setEPrazo] = useState("");
  const [eObs, setEObs] = useState("");
  const [eDadosPagto, setEDadosPagto] = useState("");
  const [eMats, setEMats] = useState<{ tipo: string; quantidade: string; justificativa: string; fornecedor_id: string; valor: string }[]>([]);
  const [editingProdutos, setEditingProdutos] = useState(false);
  const [eProdutos, setEProdutos] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<FornecedorRow[]>([]);
  const [valLocal, setValLocal] = useState<Record<number, string>>({});

  // Todos os kanbans veem todos os fornecedores (pedido do Will 10/07); o tipo é só organizacional na aba Fornecedores.
  // Filtra: só empresas com CNPJ válido (14 dígitos) — o cadastro tem 1.334 CPFs de funcionário/prestador que sujavam o dropdown (Will 13/08).
  // Se ainda quiser CPF, cadastra manualmente na aba Fornecedores.
  const fornDisponiveis = useMemo(
    () => fornecedores.filter((f) => (f.cnpj || "").replace(/\D/g, "").length === 14),
    [fornecedores],
  );

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("compras_fornecedores")
        .select("id,nome,tipo,cnpj,razao_social,telefone,email,pix,banco,agencia,conta,forma_pagamento,prazo_pagamento")
        .eq("ativo", true).order("nome");
      setFornecedores((data as unknown as FornecedorRow[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) { setRole(null); return; }
    (async () => {
      const { data } = await sb.from("user_profiles").select("role").eq("id", user.id).single();
      setRole((data as any)?.role ?? null);
    })();
  }, [user?.id]);

  const podeEditar = (!!user?.email && EDITORES_COMPRAS.has(user.email)) || (!!role && ROLES_EDITORES.has(role));

  const colunas = COLUNAS_COMPRAS[dept];

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("kanban_cards").select("*").eq("id", cardId).single();
      setCard(data as unknown as ComprasCard);
    })();
  }, [cardId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [card?.chat_messages?.length]);

  // Itens da OP quando a solicitação nasceu na Produção (details.op_id).
  // Leitura ao vivo da producao_ordens: se o PCP mexer na lista de fabricação,
  // o Ronaldo vê o estado atual, não uma cópia congelada no envio (Will 04/09).
  // Fica recolhido por padrão pra não poluir o card.
  const [opItens, setOpItens] = useState<ItemOP[] | null>(null);
  const [opAberta, setOpAberta] = useState(false);
  const opId = String(((card?.details || {}) as any).op_id || "");
  useEffect(() => {
    if (!opId) { setOpItens(null); return; }
    (async () => {
      const { data } = await sb.from("producao_ordens").select("itens").eq("id", opId).single();
      setOpItens(((data as any)?.itens as ItemOP[]) || []);
    })();
  }, [opId]);

  // Nome do projeto/cliente + obra + solicitante — herdados do card pai (HB) em
  // cards do watcher-contrato (fabricação/OP) que só têm parent_card_id.
  const [projNome, setProjNome] = useState("");
  const [obraHerdada, setObraHerdada] = useState("");        // ex: "MIRAGEM CASA 12"
  const [solicHerdado, setSolicHerdado] = useState("");      // ex: "Douglas · Vendas"
  useEffect(() => {
    const d = (card?.details || {}) as Record<string, any>;
    const direto = String(d.projeto_nome || d.projeto_fixo || d.projeto || d.cliente || d.obra_nome || "").trim();
    if (direto) setProjNome(direto);
    if (card?.parent_card_id) {
      sb.from("kanban_cards").select("title,obra,details,responsavel").eq("id", card.parent_card_id).single()
        .then(({ data }) => {
          if (!data) return;
          const pd = ((data as any).details || {}) as Record<string, any>;
          if (!direto) setProjNome(String((data as any).title || pd.cliente || pd.projeto_nome || "").trim());
          const codPai = String((data as any).obra || pd.obra_nome || pd.projeto_fixo_codigo || "").trim();
          if (codPai) setObraHerdada(codPai);
          const solPai = String(pd.solicitante || pd.arquiteto || (data as any).responsavel || "").trim();
          const setPai = String(pd.setor || "").trim();
          if (solPai || setPai) setSolicHerdado([solPai, setPai].filter(Boolean).join(" · "));
        });
    } else {
      setObraHerdada("");
      setSolicHerdado("");
      if (!direto) setProjNome("");
    }
  }, [card?.id]);

  const det = (card?.details || {}) as Record<string, any>;
  // Cards do watcher-contrato-assinado (dept compras-taiara) trazem a lista do
  // que foi vendido pra Instalação ver produto+metragem, não só insumos.
  // Solicitação manual (formulario_publico) não popula esse campo → não renderiza.
  const produtosVendidos: any[] = Array.isArray(det.produtos_vendidos) ? det.produtos_vendidos : [];
  const materiais: any[] = Array.isArray(det.materiais) ? det.materiais : [];
  // Linhas exibidas no card: materiais, ou fallback parseado de details.itens (cards do watcher/Space)
  const matRows: any[] = materiais.length > 0
    ? materiais
    : (Array.isArray(det.itens) ? det.itens : []).map((it: any) => {
        const s = String(it || "");
        const m = s.match(/^([\d.,]+(?:\s+\S{1,5})?)\s*[—-]\s*(.+)$/);
        return { tipo: m ? m[2] : s, quantidade: m ? m[1] : "", justificativa: "" };
      });
  const checklists: { name: string; items: { name: string; done: boolean }[] }[] =
    Array.isArray(det.checklists) ? det.checklists : [];
  const chat: ChatMsg[] = Array.isArray(card?.chat_messages) ? (card!.chat_messages as ChatMsg[]) : [];

  const meName = user?.nome || user?.email || "Usuário";
  const meInitials = useMemo(
    () => meName.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
    [meName]
  );

  async function patch(fields: Record<string, any>) {
    if (!card) return;
    setSaving(true);
    setCard((prev) => (prev ? { ...prev, ...fields } as ComprasCard : prev));
    const { error } = await sb.from("kanban_cards")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", card.id);
    setSaving(false);
    if (error) alert("Falha ao salvar: " + error.message);
    else onChanged();
  }

  // Escolha rápida de fornecedor/valor por item, direto no card (sem modo edição).
  // Persiste em details.materiais — se o card só tinha itens (strings), materializa o array.
  async function setMatField(i: number, fields: { fornecedor_id?: string | null; valor?: string | null }) {
    const base = matRows.map((m: any) => ({ ...m }));
    if (!base[i]) return;
    const row = { ...base[i], ...fields };
    if ("fornecedor_id" in fields) {
      row.fornecedor = fields.fornecedor_id
        ? fornecedores.find((f) => f.id === fields.fornecedor_id)?.nome ?? null
        : null;
    }
    base[i] = row;
    await patch({ details: { ...det, materiais: base } });
  }

  function toggleCheck(ci: number, ii: number) {
    if (!card) return;
    const next = checklists.map((cl, i) =>
      i !== ci ? cl : { ...cl, items: cl.items.map((it, j) => (j !== ii ? it : { ...it, done: !it.done })) }
    );
    const total = next.reduce((s, cl) => s + cl.items.length, 0);
    const done = next.reduce((s, cl) => s + cl.items.filter((it) => it.done).length, 0);
    patch({ details: { ...det, checklists: next }, checklist_done: done, checklist_total: total });
  }

  async function sendChat() {
    const txt = chatText.trim();
    if (!txt || !card) return;
    const novo: ChatMsg = {
      id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
      user: meName,
      user_id: user?.id || null,
      avatar: meInitials,
      msg: txt,
      attachments: [],
      mentions: [],
      ts: new Date().toISOString(),
    };
    setChatText("");
    await patch({ chat_messages: [...chat, novo] });
  }

  async function delChat(id: string) {
    await patch({ chat_messages: chat.filter((m) => m.id !== id) });
  }

  function iniciarEdicao() {
    if (!card) return;
    setETitle(card.title || "");
    setEPrazo(det.data_limite_entrega || "");
    setEObs(det.obs_solicitacao || det.observacoes || "");
    setEDadosPagto(det.dados_pagto_obs || "");
    setEMats(materiais.length
      ? materiais.map((m: any) => ({ tipo: m.tipo || "", quantidade: m.quantidade || "", justificativa: m.justificativa || "", fornecedor_id: m.fornecedor_id || "", valor: m.valor != null ? String(m.valor) : "" }))
      : [{ tipo: "", quantidade: "", justificativa: "", fornecedor_id: "", valor: "" }]);
    setEditing(true);
  }

  async function salvarEdicao() {
    if (!card) return;
    const mats = eMats.filter((m) => m.tipo.trim()).map((m) => {
      const f = m.fornecedor_id ? fornecedores.find((x) => x.id === m.fornecedor_id) : undefined;
      return {
        tipo: m.tipo, quantidade: m.quantidade, justificativa: m.justificativa,
        fornecedor_id: m.fornecedor_id || null,
        fornecedor: f?.nome || null,
        valor: m.valor.trim() || null,
      };
    });
    await patch({
      title: eTitle.trim() || card.title,
      details: {
        ...det,
        materiais: mats,
        // itens (strings) mantém compat com o Space (PDF/render lá usa esse campo)
        itens: mats.map((m) => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`),
        data_limite_entrega: ePrazo || det.data_limite_entrega,
        obs_solicitacao: eObs,
        observacoes: eObs,
        dados_pagto_obs: eDadosPagto,
        editado_por: user?.email,
        editado_em: new Date().toISOString(),
      },
    });
    setEditing(false);
  }

  async function excluirCard() {
    if (!card) return;
    if (!window.confirm(`Excluir o card "${card.title}"?\n\nEssa ação não tem volta.`)) return;
    const { data, error } = await sb.from("kanban_cards").delete().eq("id", card.id).select("id");
    if (error || !data?.length) {
      alert(error ? "Falha ao excluir: " + error.message : "Sem permissão pra excluir este card.");
      return;
    }
    onChanged();
    onClose();
  }

  // Mesmo PDF do card no Space (dept-layout): HTML imprimível via window.print
  async function gerarPdf() {
    if (!card) return;
    const d = det;
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Projeto/Obra podem chegar via vários caminhos:
    //  • card manual: details.projeto_nome / details.projeto (input do /solicitar)
    //  • card do watcher-contrato: details.projeto_fixo (+ _codigo) + parent_card_id (pai=HB)
    //  • re-import HB: details.cliente / details.obra_nome
    let projNome = String(d.projeto_nome || d.projeto_fixo || d.projeto || d.cliente || d.obra_nome || d.arquiteto || "").trim();
    const projCod = String(d.projeto_fixo_codigo || d.obra_codigo || card.obra || "").trim();
    let obraEndereco = String(d.obra_endereco || d.endereco || d.endereco_obra || "").trim();
    // Cards vindos do watcher-contrato-assinado (fabricação/OP) só têm parent_card_id → HB;
    // solicitante/projeto ficam no card pai. Vamos herdar tudo que faltar.
    let solicitanteHerdado = "";
    let setorHerdado = "";
    if ((!projNome || !obraEndereco) && card.parent_card_id) {
      try {
        const { data: p } = await sb.from("kanban_cards").select("title,obra,details,responsavel").eq("id", card.parent_card_id).single();
        if (p) {
          const pd = ((p as any).details || {}) as Record<string, any>;
          if (!projNome) {
            projNome = String((p as any).title || pd.cliente || pd.projeto_nome || "").trim();
            if ((p as any).obra && !projNome.includes(String((p as any).obra))) {
              projNome = `${(p as any).obra} — ${projNome}`;
            }
          }
          if (!obraEndereco) obraEndereco = String(pd.obra_endereco || pd.endereco || pd.endereco_obra || "").trim();
          solicitanteHerdado = String(pd.solicitante || pd.arquiteto || (p as any).responsavel || "").trim();
          setorHerdado = String(pd.setor || "").trim();
        }
      } catch { /* noop */ }
    }
    // PKT-COMPRAS-PDF-TITULO-FALLBACK-20260820: se nenhum campo de projeto veio
    // preenchido (card antigo criado antes do fix do autocomplete), usa o title do
    // card como fallback — só ignora quando o title é o genérico "Solicitação — <data>".
    if (!projNome && card.title && !/^Solicita[çc][ãa]o\s*[—-]/i.test(String(card.title))) {
      projNome = String(card.title).trim();
    }
    const projDisplay = projNome || projCod || "-";
    const obraDisplay = [projCod && projCod !== projNome ? projCod : "", obraEndereco].filter(Boolean).join(" · ") || "-";
    const solicitanteDisplay = String(d.solicitante || d.arquiteto || card.responsavel || solicitanteHerdado || "").trim() || "-";
    const setorDisplay = String(d.setor || setorHerdado || "").trim() || "-";
    // d.materiais é a fonte autoritativa (tem qtd/tipo/justificativa/fornecedor/valor);
    // d.itens é só string de display pra compat com o Space. Preferir materiais
    // resolve o caso em que a unidade tem >5 chars (unidades/metros/caixas) e
    // quebrava o parse do d.itens — justificativa sumia do PDF.
    const matsArr: { tipo: string; quantidade: string; justificativa: string; fornecedor?: string | null; fornecedor_id?: string | null; valor?: string | null }[] =
      Array.isArray(d.materiais) && d.materiais.length > 0
        ? d.materiais.map((m: any) => ({
            tipo: m?.tipo || "",
            quantidade: m?.quantidade || "",
            justificativa: m?.justificativa || "",
            fornecedor: m?.fornecedor || null,
            fornecedor_id: m?.fornecedor_id || null,
            valor: m?.valor != null ? String(m.valor) : null,
          }))
        : Array.isArray(d.itens)
          ? d.itens.map((it: any) => {
              const s = String(it || "");
              const m = s.match(/^([\d.,]+(?:\s+\S{1,5})?)\s*[—-]\s*(.+)$/);
              return { tipo: m ? m[2] : s, quantidade: m ? m[1] : "", justificativa: "", fornecedor: null, fornecedor_id: null, valor: null };
            })
          : [];
    const temForn = matsArr.some((m) => m.fornecedor || m.fornecedor_id || m.valor);
    const totalPdf = matsArr.reduce((s, m) => s + parseValor(m.valor), 0);
    const fornNome = (m: any) => m.fornecedor || fornecedores.find((f) => f.id === m.fornecedor_id)?.nome || "";
    const porFornPdf: [string, number][] = (() => {
      const map = new Map<string, number>();
      for (const m of matsArr) {
        const v = parseValor(m.valor);
        if (!v) continue;
        const nome = fornNome(m) || "Sem fornecedor";
        map.set(nome, (map.get(nome) || 0) + v);
      }
      return [...map.entries()];
    })();
    const subtotais = temForn && porFornPdf.length > 1
      ? porFornPdf.map(([nome, v]) =>
          `<tr><td colspan="4" style="text-align:right;color:#555">Total — ${esc(nome)}</td><td style="color:#555">${esc(fmtBRL(v))}</td><td></td></tr>`
        ).join("")
      : "";
    const mats = matsArr.map((m, i) =>
      temForn
        ? `<tr><td>${i + 1}</td><td>${esc(m.quantidade) || "-"}</td><td>${esc(m.tipo) || "-"}</td><td>${esc(fornNome(m)) || "-"}</td><td>${m.valor ? esc(fmtBRL(parseValor(m.valor))) : "-"}</td><td>${esc(m.justificativa) || "-"}</td></tr>`
        : `<tr><td>${i + 1}</td><td>${esc(m.quantidade) || "-"}</td><td>${esc(m.tipo) || "-"}</td><td>${esc(m.justificativa) || "-"}</td></tr>`
    ).join("") + subtotais + (temForn && totalPdf > 0
      ? `<tr><td colspan="4" style="text-align:right;font-weight:bold">${porFornPdf.length > 1 ? "TOTAL GERAL" : "TOTAL"}</td><td style="font-weight:bold">${esc(fmtBRL(totalPdf))}</td><td></td></tr>`
      : "");
    const matsHead = temForn
      ? "<th>#</th><th>Qtd</th><th>Item</th><th>Fornecedor</th><th>Valor</th><th>Justificativa</th>"
      : "<th>#</th><th>Qtd</th><th>Item</th><th>Justificativa</th>";
    const prodsArr: any[] = Array.isArray(d.produtos_vendidos) ? d.produtos_vendidos : [];
    const prodTotalGeral = prodsArr.reduce((s, p) => s + (Number(p?.metragem) || 0), 0);
    const fmtPdfDims = (L: any, H: any) => (!L && !H) ? "" : `${L || "?"}×${H || "?"} cm`;
    const prodSec = prodsArr.length > 0
      ? `<h2>Material vendido</h2>` + prodsArr.map((p: any) => {
          const header = [p?.categoria, p?.subtipo, p?.especie, p?.cor].filter(Boolean).join(" · ") || "Sem categoria";
          const total = Number(p?.metragem) || 0;
          const mStr = total > 0 ? `${total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : "-";
          const portas: any[] = Array.isArray(p?.portas) ? p.portas : [];
          const insumos: any[] = Array.isArray(p?.insumos) ? p.insumos : [];
          const hasSub = portas.length > 0 || insumos.length > 0;
          const headerRow = `<div style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;${hasSub ? "background:#f4f4f4;border-bottom:1px solid #ccc;" : ""}"><span style="font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;font-size:12px">${esc(header)}</span><span style="font-weight:bold;white-space:nowrap;font-size:12px">${mStr}</span></div>`;
          const portaRows = portas.length > 0
            ? `<div style="padding:4px 12px 8px">` + portas.map((it: any) => {
                const parts = [
                  it.qtd_folhas ? `${it.qtd_folhas} folha${it.qtd_folhas > 1 ? "s" : ""}` : null,
                  it.codigo, it.tipo, fmtPdfDims(it.largura_cm, it.altura_cm), it.ambiente, it.obs,
                ].filter(Boolean).map((x: any) => esc(x)).join(" · ");
                const m = Number(it.metragem) || 0;
                const mLinha = m > 0 ? `${m.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : "";
                return `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:11.5px"><span>${parts || "-"}</span><span style="font-weight:bold;white-space:nowrap">${mLinha}</span></div>`;
              }).join("") + `</div>`
            : "";
          const insRows = insumos.length > 0
            ? `<div style="padding:6px 12px 10px;${portas.length > 0 ? "border-top:1px solid #ccc;" : ""}"><div style="font-size:9.5px;font-weight:bold;color:#666;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Material que vai usar</div>` + insumos.map((ins: any) =>
                `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:11.5px"><span>${esc(ins.nome)}</span><span style="font-weight:bold;white-space:nowrap">${esc(ins.qtd)} ${esc(ins.unidade)}</span></div>`
              ).join("") + `</div>`
            : "";
          return `<div style="border:1px solid #ccc;margin:6px 0">${headerRow}${portaRows}${insRows}</div>`;
        }).join("") + (prodTotalGeral > 0 && prodsArr.length > 1
          ? `<div style="display:flex;justify-content:space-between;padding:8px 14px;border-top:2px solid #555;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;margin-top:4px"><span>Total geral</span><span>${prodTotalGeral.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²</span></div>`
          : "")
      : "";
    const fornIds = [...new Set(matsArr.map((m) => m.fornecedor_id).filter(Boolean))] as string[];
    const fornUsados = fornIds.map((id) => fornecedores.find((f) => f.id === id)).filter(Boolean) as FornecedorRow[];
    const fornSec = fornUsados.map((f) => {
      const l1 = [f.cnpj ? `CNPJ: ${esc(f.cnpj)}` : "", f.telefone ? `Tel: ${esc(f.telefone)}` : "", f.email ? esc(f.email) : ""].filter(Boolean).join(" · ");
      const l2 = [
        f.forma_pagamento ? `Pagamento: ${esc(f.forma_pagamento)}${f.prazo_pagamento ? ` (${esc(f.prazo_pagamento)})` : ""}` : "",
        f.pix ? `PIX: ${esc(f.pix)}` : "",
        f.banco ? `Banco: ${esc(f.banco)}${f.agencia ? ` Ag ${esc(f.agencia)}` : ""}${f.conta ? ` C/C ${esc(f.conta)}` : ""}` : "",
      ].filter(Boolean).join(" · ");
      return `<div class="forn"><b>${esc(f.nome)}${f.razao_social ? ` · ${esc(f.razao_social)}` : ""}</b>${l1 ? `<br>${l1}` : ""}${l2 ? `<br>${l2}` : ""}</div>`;
    }).join("");
    const cls = (d.checklists || []).map((cl: any) =>
      `<div class="cl-sec"><h4>${esc(cl.name)}</h4><ul>${(cl.items || []).map((it: any) =>
        `<li>${it.done ? "✓" : "☐"} ${esc(it.name)}${it.obs ? " — " + esc(it.obs) : ""}</li>`).join("")}</ul></div>`
    ).join("");
    const fmtD = (dt: any) => { if (!dt) return "-"; try { return new Date(dt).toLocaleDateString("pt-BR"); } catch { return String(dt); } };
    const obs = d.obs_solicitacao || d.observacoes || card.description || "";
    // A tabela "Materiais solicitados" so some quando o card ja mostra a secao
    // "Material vendido" (produtos_vendidos), pra nao repetir a mesma lista duas
    // vezes. Antes a regra era "tem contrato_id", e isso zerava o PDF dos cards
    // que o PCP manda (tag pcp-envio): eles herdam o contrato_id da OP mas
    // trazem a lista real em materiais, sem nenhum produtos_vendidos.
    const html =`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(card.title || "Solicitação")}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:20px auto;padding:20px;color:#000;font-size:13px}h1{font-size:18px;margin:0 0 6px;color:#333}h2{font-size:14px;border-bottom:1px solid #ccc;padding:10px 0 6px;margin-top:20px;color:#555}h4{font-size:12px;margin:8px 0 4px;color:#333}.header{border-bottom:2px solid #D4A853;padding-bottom:12px;margin-bottom:16px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}.meta div{padding:4px 0}.meta strong{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.03em}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f4f4;font-size:11px;text-transform:uppercase;letter-spacing:0.03em}.cl-sec{margin:8px 0}ul{margin:4px 0;padding-left:20px}li{margin:2px 0;font-size:12px}.obs{background:#fafafa;padding:10px;border-left:3px solid #D4A853;margin:8px 0;white-space:pre-wrap;font-size:12px}.forn{border:1px solid #ccc;padding:8px 10px;margin:6px 0;font-size:12px;line-height:1.6}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ccc;font-size:10px;color:#888;text-align:center}@media print{body{margin:0}}</style></head><body><div class="header"><h1>${esc(card.title || "Solicitação de Compras")}</h1><div style="font-size:11px;color:#888">Setor: <b>${esc(card.dept_id || "-")}</b> · Status: <b>${esc(card.column_id || "-")}</b></div></div><div class="meta"><div><strong>Solicitante</strong><br>${esc(solicitanteDisplay)}</div><div><strong>Setor origem</strong><br>${esc(setorDisplay)}</div><div><strong>Data</strong><br>${esc(d.data_solicitacao_fmt || fmtD(d.data_solicitacao || card.created_at))}</div><div><strong>Prazo</strong><br>${esc(fmtD(d.data_limite_entrega || d.prazo))}</div><div><strong>Projeto</strong><br>${esc(projDisplay)}</div><div><strong>Obra</strong><br>${esc(obraDisplay)}</div><div><strong>Responsável</strong><br>${esc(card.responsavel || d.responsavel_compras || "-")}</div><div><strong>SLA</strong><br>${esc(card.sla || "-")}</div><div><strong>Prioridade</strong><br>${esc(card.priority || "media")}</div></div>${prodSec}${mats && prodsArr.length === 0 ? `<h2>Materiais solicitados</h2><table><thead><tr>${matsHead}</tr></thead><tbody>${mats}</tbody></table>` : ""}${fornSec ? `<h2>Dados de pagamento — Fornecedores</h2>${fornSec}` : ""}${obs ? `<h2>Observações</h2><div class="obs">${esc(obs)}</div>` : ""}${cls ? `<h2>Checklists</h2>${cls}` : ""}<div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} · Card ID: ${esc(card.id)}<br>Parket — Sistema de Compras</div></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Popup bloqueado — libere popups pra gerar o PDF."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }

  if (!card) {
    return (
      <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center" }}>
        <div style={{ color: t.textMuted, fontSize: 13 }}>Carregando card…</div>
      </div>
    );
  }

  const labelSt: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{
        width: 1200, maxWidth: "96vw", maxHeight: "92vh",
        background: t.modalBg, border: `1px solid ${t.borderStrong}`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input value={eTitle} onChange={(e) => setETitle(e.target.value)}
                     style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 14, fontWeight: 600, padding: "7px 10px", borderRadius: 0, outline: "none" }} />
            ) : (
              <div style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary, lineHeight: 1.4 }}>{card.title}</div>
            )}
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
              Solicitado em {new Date(det.data_solicitacao || card.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {card.responsavel || "—"}
              {saving && <span style={{ marginLeft: 10, color: t.warning }}>salvando…</span>}
            </div>
          </div>

          {podeEditar && !editing && (
            <button onClick={iniciarEdicao} title="Editar solicitação" style={{
              background: t.inputBg, border: `1px solid ${t.border}`, color: t.textSecondary,
              cursor: "pointer", padding: "7px 12px", borderRadius: 0,
              fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Pencil size={13} /> Editar
            </button>
          )}
          {podeEditar && editing && (
            <>
              <button onClick={salvarEdicao} disabled={saving} style={{
                background: t.accent, color: t.bg, border: "none", cursor: "pointer",
                padding: "7px 14px", borderRadius: 0, fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1,
              }}>
                Salvar
              </button>
              <button onClick={() => setEditing(false)} style={{
                background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted,
                cursor: "pointer", padding: "7px 12px", borderRadius: 0, fontSize: 12,
              }}>
                Cancelar
              </button>
            </>
          )}
          {podeEditar && !editing && (
            <button onClick={excluirCard} title="Excluir card" style={{
              background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
              color: "#EF4444", cursor: "pointer", padding: "7px 12px", borderRadius: 0,
              fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Trash2 size={13} /> Excluir
            </button>
          )}

          <button onClick={gerarPdf} title="Gerar PDF" style={{
            background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
            color: "#10B981", cursor: "pointer", padding: "7px 12px", borderRadius: 0,
            fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <FileText size={13} /> PDF
          </button>

          <select
            value={card.column_id}
            onChange={(e) => patch({ column_id: e.target.value })}
            style={{
              background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
              fontSize: 12, padding: "7px 10px", borderRadius: 0, outline: "none", maxWidth: 260,
            }}>
            {colunas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            {!colunas.some((c) => c.id === card.column_id) && (
              <option value={card.column_id}>{card.column_id}</option>
            )}
          </select>

          <select
            value={card.priority || "media"}
            onChange={(e) => patch({ priority: e.target.value })}
            style={{
              background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
              fontSize: 12, padding: "7px 10px", borderRadius: 0, outline: "none",
            }}>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>

          <button onClick={onClose} title="Fechar" style={{
            background: "transparent", border: "none", color: t.textMuted, cursor: "pointer",
            padding: 6, display: "grid", placeItems: "center",
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body: 2 colunas — detalhes | comentários */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1.7, overflowY: "auto", padding: 20, borderRight: `1px solid ${t.border}` }}>
            {/* Bloco OBRA + PROJETO — sempre visível (crítico pra Compras + Fabricação identificar o card).
               Herda do card pai quando é card do watcher-contrato (só tem parent_card_id). */}
            {(projNome || obraHerdada || card.obra) && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px",
                marginBottom: 12, background: `${t.accent}12`, border: `1px solid ${t.accent}40`,
              }}>
                <Building2 size={14} style={{ color: t.accent, marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textMuted, fontWeight: 700 }}>
                    Obra
                  </div>
                  <div style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600, marginTop: 1 }}>
                    {projNome || obraHerdada || card.obra || "—"}
                  </div>
                  {(obraHerdada && obraHerdada !== projNome) && (
                    <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>
                      Cód: {obraHerdada}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meta */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <div style={labelSt}><User size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Solicitante</div>
                <div style={{ fontSize: 12, color: t.textPrimary }}>
                  {det.solicitante || det.pedido_por || det.arquiteto || solicHerdado || card.responsavel || "—"}
                </div>
              </div>
              <div>
                <div style={labelSt}><Building2 size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Setor</div>
                <div style={{ fontSize: 12, color: t.textPrimary }}>{det.setor || "—"}</div>
              </div>
              <div>
                <div style={labelSt}><CalendarClock size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Prazo de entrega</div>
                {editing ? (
                  <input type="date" value={ePrazo} onChange={(e) => setEPrazo(e.target.value)}
                         style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "5px 8px", borderRadius: 0, outline: "none" }} />
                ) : (
                  <div style={{ fontSize: 12, color: t.textPrimary }}>
                    {det.data_limite_entrega
                      ? new Date(det.data_limite_entrega + "T12:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                )}
              </div>
            </div>

            {!editing && projNome && <GastosProjeto nome={projNome} t={t} />}

            {editing ? (
              <div style={{ marginBottom: 18 }}>
                <div style={labelSt}>Observações</div>
                <textarea value={eObs} onChange={(e) => setEObs(e.target.value)} rows={3}
                          style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "8px 10px", borderRadius: 0, outline: "none", resize: "vertical" }} />
              </div>
            ) : (det.obs_solicitacao || det.observacoes || card.description) && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelSt}>Observações</div>
                <div style={{ fontSize: 12, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {det.obs_solicitacao || det.observacoes || card.description}
                </div>
              </div>
            )}

            {editing ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={labelSt}>💰 Dados de pagamento / observações do Compras</div>
                  <DitadoBtn t={t} onText={(seg) => setEDadosPagto((v) => (v ? v + " " : "") + seg)} />
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>
                  Informações que vão pro Financeiro (PIX, boleto, condições, etc). Aparece destacado na tela de aprovações.
                </div>
                <textarea value={eDadosPagto} onChange={(e) => setEDadosPagto(e.target.value)} rows={3}
                          placeholder="Ex: PIX CNPJ 19.393.712/0001-46 — pagamento em 2x sem juros"
                          style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "8px 10px", borderRadius: 0, outline: "none", resize: "vertical" }} />
              </div>
            ) : det.dados_pagto_obs && (
              <div style={{ marginBottom: 18, background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.35)", padding: "8px 10px" }}>
                <div style={labelSt}>💰 Dados de pagamento</div>
                <div style={{ fontSize: 12, color: t.textPrimary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {det.dados_pagto_obs}
                </div>
              </div>
            )}

            {!editing && !editingProdutos && (() => {
              // Watcher já entrega agrupado por (categoria/subtipo/espécie/cor), com:
              //   metragem total, portas[] (se cat=porta), insumos[] próprios do produto.
              const totalGeral = produtosVendidos.reduce((s: number, p: any) => s + (Number(p.metragem) || 0), 0);
              const fmtDims = (L: any, H: any) => (!L && !H) ? "" : `${L || "?"}×${H || "?"} cm`;
              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={labelSt}><Package size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Material vendido ({produtosVendidos.length})</div>
                    <button type="button" onClick={() => {
                      setEProdutos(JSON.parse(JSON.stringify(produtosVendidos)));
                      setEditingProdutos(true);
                    }} style={{
                      background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
                      padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: "0.05em",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}><Pencil size={10} /> Editar</button>
                  </div>
                  {produtosVendidos.length === 0 && (
                    <div style={{ fontSize: 11, color: t.textMuted, fontStyle: "italic", padding: "8px 0" }}>
                      Nenhum produto cadastrado — clique em Editar pra adicionar.
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {produtosVendidos.map((p: any, gi: number) => {
                      const header = [p.categoria, p.subtipo, p.especie, p.cor].filter(Boolean).join(" · ") || "Sem categoria";
                      const total = Number(p.metragem) || 0;
                      const portas: any[] = Array.isArray(p.portas) ? p.portas : [];
                      const insumos: any[] = Array.isArray(p.insumos) ? p.insumos : [];
                      const hasSub = portas.length > 0 || insumos.length > 0;
                      return (
                        <div key={gi} style={{ border: `1px solid ${t.border}` }}>
                          <div style={{
                            padding: "10px 14px", background: hasSub ? t.cardBg : "transparent",
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                            borderBottom: hasSub ? `1px solid ${t.border}` : "none",
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, letterSpacing: "0.04em", textTransform: "uppercase" }}>{header}</div>
                            {total > 0 && (
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap" }}>
                                {total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
                              </div>
                            )}
                          </div>
                          {portas.length > 0 && (
                            <div style={{ padding: "6px 14px 8px" }}>
                              {portas.map((it: any, i: number) => {
                                const parts = [
                                  it.qtd_folhas ? `${it.qtd_folhas} folha${it.qtd_folhas > 1 ? "s" : ""}` : null,
                                  it.codigo, it.tipo,
                                  fmtDims(it.largura_cm, it.altura_cm),
                                  it.ambiente, it.obs,
                                ].filter(Boolean);
                                const m = Number(it.metragem) || 0;
                                return (
                                  <div key={i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
                                    padding: "4px 0", fontSize: 11.5, color: t.textSecondary,
                                  }}>
                                    <div style={{ flex: 1 }}>{parts.join(" · ") || "—"}</div>
                                    {m > 0 && (
                                      <div style={{ color: t.textPrimary, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {m.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {insumos.length > 0 && (
                            <div style={{ padding: "8px 14px 10px", borderTop: portas.length > 0 ? `1px solid ${t.border}` : "none" }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Material que vai usar</div>
                              {insumos.map((ins: any, i: number) => (
                                <div key={i} style={{
                                  display: "flex", justifyContent: "space-between", gap: 10,
                                  padding: "3px 0", fontSize: 11.5, color: t.textSecondary,
                                }}>
                                  <div style={{ flex: 1 }}>{ins.nome}</div>
                                  <div style={{ color: t.textPrimary, fontWeight: 600, whiteSpace: "nowrap" }}>
                                    {ins.qtd} {ins.unidade}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {totalGeral > 0 && produtosVendidos.length > 1 && (
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 14px", borderTop: `2px solid ${t.borderStrong}`, marginTop: 4,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Total geral</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap" }}>
                          {totalGeral.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {editingProdutos && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelSt}><Package size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Editar material vendido</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {eProdutos.map((p: any, pi: number) => (
                    <div key={pi} style={{ border: `1px solid ${t.border}`, padding: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 8 }}>
                        <input value={p.categoria || ""} placeholder="Categoria (piso/forro/porta…)"
                               onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, categoria: e.target.value } : x))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", outline: "none" }} />
                        <input value={p.subtipo || ""} placeholder="Subtipo"
                               onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, subtipo: e.target.value } : x))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", outline: "none" }} />
                        <input value={p.especie || ""} placeholder="Espécie"
                               onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, especie: e.target.value } : x))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", outline: "none" }} />
                        <input value={p.cor || ""} placeholder="Cor"
                               onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, cor: e.target.value } : x))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", outline: "none" }} />
                        <button type="button" onClick={() => setEProdutos((arr) => arr.filter((_, j) => j !== pi))}
                                title="Remover produto"
                                style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, width: 30, cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Metragem total</span>
                        <input value={p.metragem ?? ""} type="number" step="0.01" placeholder="0"
                               onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, metragem: parseFloat(e.target.value) || 0 } : x))}
                               style={{ width: 100, background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "5px 8px", outline: "none" }} />
                        <span style={{ fontSize: 11, color: t.textMuted }}>m²</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Material que vai usar</div>
                        {(p.insumos || []).map((ins: any, ii: number) => (
                          <div key={ii} style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 0.6fr auto", gap: 6, marginBottom: 4 }}>
                            <input value={ins.nome || ""} placeholder="Nome do insumo"
                                   onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, insumos: x.insumos.map((y: any, k: number) => k === ii ? { ...y, nome: e.target.value } : y) } : x))}
                                   style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11.5, padding: "5px 8px", outline: "none" }} />
                            <input value={ins.qtd || ""} placeholder="Qtd"
                                   onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, insumos: x.insumos.map((y: any, k: number) => k === ii ? { ...y, qtd: e.target.value } : y) } : x))}
                                   style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11.5, padding: "5px 8px", outline: "none" }} />
                            <input value={ins.unidade || ""} placeholder="und"
                                   onChange={(e) => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, insumos: x.insumos.map((y: any, k: number) => k === ii ? { ...y, unidade: e.target.value } : y) } : x))}
                                   style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11.5, padding: "5px 8px", outline: "none" }} />
                            <button type="button" onClick={() => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, insumos: x.insumos.filter((_: any, k: number) => k !== ii) } : x))}
                                    title="Remover insumo"
                                    style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, width: 26, cursor: "pointer", display: "grid", placeItems: "center" }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setEProdutos((arr) => arr.map((x, j) => j === pi ? { ...x, insumos: [...(x.insumos || []), { nome: "", qtd: "", unidade: "un" }] } : x))}
                                style={{ background: "transparent", border: `1px dashed ${t.border}`, color: t.textSecondary, padding: "4px 10px", fontSize: 10.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <Plus size={10} /> Adicionar insumo
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEProdutos((arr) => [...arr, { categoria: "", subtipo: "", especie: "", cor: "", metragem: 0, insumos: [] }])}
                          style={{ alignSelf: "flex-start", background: "transparent", border: `1px dashed ${t.borderHover}`, color: t.textSecondary, padding: "6px 12px", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Plus size={11} /> Adicionar produto
                  </button>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={async () => {
                      const limpos = eProdutos
                        .filter((p) => p.categoria || p.especie || (p.insumos || []).length > 0)
                        .map((p) => ({
                          ...p,
                          metragem: Number(p.metragem) || 0,
                          insumos: (p.insumos || []).filter((i: any) => (i.nome || "").trim()),
                        }));
                      await patch({ details: { ...det, produtos_vendidos: limpos } });
                      setEditingProdutos(false);
                    }} style={{
                      background: t.accent, color: t.bg, border: "none",
                      padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>Salvar produtos</button>
                    <button type="button" onClick={() => setEditingProdutos(false)}
                            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {editing && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelSt}><Package size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Materiais</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {eMats.map((m, i) => (
                    <div key={i} style={{ border: `1px solid ${t.border}`, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 1.5fr auto", gap: 6, alignItems: "center" }}>
                        <input value={m.tipo} placeholder="Material"
                               onChange={(e) => setEMats((arr) => arr.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", borderRadius: 0, outline: "none" }} />
                        <input value={m.quantidade} placeholder="Qtd"
                               onChange={(e) => setEMats((arr) => arr.map((x, j) => (j === i ? { ...x, quantidade: e.target.value } : x)))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", borderRadius: 0, outline: "none" }} />
                        <input value={m.justificativa} placeholder="Justificativa"
                               onChange={(e) => setEMats((arr) => arr.map((x, j) => (j === i ? { ...x, justificativa: e.target.value } : x)))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", borderRadius: 0, outline: "none" }} />
                        <button type="button" onClick={() => setEMats((arr) => arr.filter((_, j) => j !== i))}
                                disabled={eMats.length === 1} title="Remover"
                                style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, width: 30, height: 30, cursor: eMats.length === 1 ? "default" : "pointer", opacity: eMats.length === 1 ? 0.3 : 1, display: "grid", placeItems: "center" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 6, alignItems: "center" }}>
                        <FornecedorPicker value={m.fornecedor_id} fornecedores={fornDisponiveis} t={t}
                                          onChange={(id) => setEMats((arr) => arr.map((x, j) => (j === i ? { ...x, fornecedor_id: id || "" } : x)))} />
                        <input value={m.valor} placeholder="Valor (R$)"
                               onChange={(e) => setEMats((arr) => arr.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12, padding: "6px 8px", borderRadius: 0, outline: "none" }} />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEMats((arr) => [...arr, { tipo: "", quantidade: "", justificativa: "", fornecedor_id: "", valor: "" }])}
                          style={{ alignSelf: "flex-start", background: "transparent", border: `1px dashed ${t.border}`, color: t.textSecondary, padding: "6px 12px", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Plus size={11} /> Adicionar material
                  </button>
                </div>
              </div>
            )}

            {/* Alterações feitas pela Produção na lista de fabricação (com justificativa) —
               espelhadas pelo watcher em details.edicoes_producao quando a OP é editada. */}
            {!editing && Array.isArray(det.edicoes_producao) && det.edicoes_producao.length > 0 && (
              <div style={{ border: `1px solid ${t.warning}`, padding: "12px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.warning, marginBottom: 8 }}>
                  Alterações da Produção na lista de fabricação ({det.edicoes_producao.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {det.edicoes_producao.map((ed: any, i: number) => (
                    <div key={i} style={{ borderLeft: `2px solid ${t.warning}`, paddingLeft: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: t.textPrimary }}>
                        {(() => { try { return new Date(ed.at).toLocaleDateString("pt-BR"); } catch { return String(ed.at || ""); } })()} — {ed.por || "Produção"}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textSecondary, margin: "2px 0 4px" }}>
                        <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.06em" }}>Justificativa: </span>
                        {ed.justificativa}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: t.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
                        {(ed.mudancas || []).map((m: string, j: number) => <li key={j}>{m}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Itens da OP — o que a fábrica vai produzir com o material desta
               solicitação. Só aparece quando o card veio do PCP (details.op_id),
               recolhido por padrão: é contexto de apoio, o pedido em si continua
               sendo a lista de materiais logo abaixo (Will 04/09). */}
            {!editing && !!opId && !!opItens?.length && (
              <div style={{ border: `1px solid ${t.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpAberta((v) => !v)}
                  style={{
                    width: "100%", background: "transparent", border: "none", cursor: "pointer",
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                  }}
                >
                  {opAberta ? <ChevronDown size={13} style={{ color: t.textMuted, flexShrink: 0 }} />
                            : <ChevronRight size={13} style={{ color: t.textMuted, flexShrink: 0 }} />}
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary }}>
                    Itens da {opId} ({opItens.length})
                  </span>
                  <span style={{ fontSize: 10, color: t.textMuted, marginLeft: "auto" }}>
                    {opAberta ? "recolher" : "ver o que a fábrica vai produzir"}
                  </span>
                </button>
                {opAberta && (
                  <div style={{ borderTop: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
                    {opItens.map((it, i) => {
                      const m2 = Number(it.metragem) || 0;
                      const qtd = String(it.categoria || "").trim().toUpperCase() === "PORTA" ? (Number(it.qtd) || 0) : 0;
                      // 2a linha: só o que ajuda a conferir o material (ambiente, medidas
                      // da porta, dimensão, m², qtd de portas).
                      const medidas = qtd ? medidasPorta(it.porta) : null;
                      const detalhes = [
                        it.ambiente || null,
                        medidas,
                        !medidas && it.dimensao && it.dimensao !== "—" ? it.dimensao : null,
                        m2 ? `${m2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : null,
                        qtd ? `${qtd} ${qtd > 1 ? "portas" : "porta"}` : null,
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={i} style={{ padding: "8px 14px", borderTop: i ? `1px solid ${t.border}` : "none" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: t.textPrimary }}>
                            {it.numero ? <span style={{ color: t.textMuted, fontWeight: 700 }}>{it.numero} </span> : null}
                            {nomeProdutoOP(it)}
                          </div>
                          {detalhes && (
                            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{detalhes}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Materiais — fornecedor/valor escolhíveis direto no card.
               Em cards vindos do watcher (contrato assinado, det.contrato_id),
               a fonte de verdade é a seção "Material vendido" acima; a tabela
               agregada antiga polui a Justificativa com "produto · dimensão"
               e por isso fica escondida — mesmo quando produtos_vendidos é
               vazio (ex: sim apagada da Valoria — Will preenche pelo Editar). */}
            {!editing && matRows.length > 0 && !det.contrato_id && (() => {
              const mostraForn = podeEditar || matRows.some((m: any) => m.fornecedor || m.fornecedor_id || m.valor);
              const total = matRows.reduce((s: number, m: any) => s + parseValor(m.valor), 0);
              const porForn: [string, number][] = (() => {
                const map = new Map<string, number>();
                for (const m of matRows) {
                  const v = parseValor(m.valor);
                  if (!v) continue;
                  const nome = m.fornecedor || fornecedores.find((f) => f.id === m.fornecedor_id)?.nome || "Sem fornecedor";
                  map.set(nome, (map.get(nome) || 0) + v);
                }
                return [...map.entries()];
              })();
              const headers = mostraForn
                ? ["Material", "Qtd", "Fornecedor", "Valor", "Justificativa"]
                : ["Material", "Qtd", "Justificativa"];
              return (
              <div style={{ marginBottom: 18 }}>
                <div style={labelSt}><Package size={9} style={{ marginRight: 4, verticalAlign: "-1px" }} />Materiais ({matRows.length})</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "6px 8px", color: t.textMuted,
                          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                          borderBottom: `1px solid ${t.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matRows.map((m: any, i: number) => {
                      const fNome = m.fornecedor || fornecedores.find((f) => f.id === m.fornecedor_id)?.nome;
                      return (
                      <tr key={i}>
                        <td style={{ padding: "7px 8px", color: t.textPrimary, borderBottom: `1px solid ${t.border}`, minWidth: 160 }}>{m.tipo}</td>
                        <td style={{ padding: "7px 8px", color: t.textSecondary, borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{m.quantidade || "—"}</td>
                        {mostraForn && (
                          <>
                            <td style={{ padding: "4px 6px", borderBottom: `1px solid ${t.border}` }}>
                              {podeEditar ? (
                                <FornecedorPicker value={m.fornecedor_id} fornecedores={fornDisponiveis} t={t} width={170}
                                                  onChange={(id) => setMatField(i, { fornecedor_id: id })} />
                              ) : (
                                <span style={{ color: t.textSecondary }}>{fNome || "—"}</span>
                              )}
                            </td>
                            <td style={{ padding: "4px 6px", borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
                              {podeEditar ? (
                                <input value={valLocal[i] ?? (m.valor != null ? String(m.valor) : "")}
                                       placeholder="R$"
                                       onChange={(e) => setValLocal((v) => ({ ...v, [i]: e.target.value }))}
                                       onBlur={() => {
                                         if (valLocal[i] === undefined) return;
                                         const atual = m.valor != null ? String(m.valor) : "";
                                         if (valLocal[i].trim() !== atual) setMatField(i, { valor: valLocal[i].trim() || null });
                                       }}
                                       style={{ width: 90, background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11.5, padding: "5px 6px", borderRadius: 0, outline: "none" }} />
                              ) : (
                                <span style={{ color: t.textPrimary }}>{m.valor ? fmtBRL(parseValor(m.valor)) : "—"}</span>
                              )}
                            </td>
                          </>
                        )}
                        <td style={{ padding: "7px 8px", color: t.textSecondary, borderBottom: `1px solid ${t.border}` }}>{m.justificativa || "—"}</td>
                      </tr>
                      );
                    })}
                    {mostraForn && porForn.length > 1 && porForn.map(([nome, v]) => (
                      <tr key={nome}>
                        <td colSpan={3} style={{ padding: "6px 8px", color: t.textMuted, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "right" }}>Total — {nome}</td>
                        <td style={{ padding: "6px 8px", color: t.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtBRL(v)}</td>
                        <td />
                      </tr>
                    ))}
                    {mostraForn && total > 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: "7px 8px", color: t.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right", borderTop: `1px solid ${t.border}` }}>{porForn.length > 1 ? "Total geral" : "Total"}</td>
                        <td style={{ padding: "7px 8px", color: t.textPrimary, fontWeight: 700, whiteSpace: "nowrap", borderTop: `1px solid ${t.border}` }}>{fmtBRL(total)}</td>
                        <td style={{ borderTop: `1px solid ${t.border}` }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              );
            })()}

            {/* Fluxo por item (compras_itens) — feature flag details.compras_itens_ativo */}
            {!editing && (
              <ComprasItensPanel cardId={card.id} details={det} materiaisLegacy={matRows} t={t} onChanged={onChanged} />
            )}

            {/* Dados de pagamento dos fornecedores usados nos materiais */}
            {!editing && (() => {
              const ids = [...new Set(matRows.map((m: any) => m.fornecedor_id).filter(Boolean))] as string[];
              const usados = ids.map((id) => fornecedores.find((f) => f.id === id)).filter(Boolean) as FornecedorRow[];
              if (!usados.length) return null;
              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={labelSt}>Dados de pagamento — Fornecedores</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {usados.map((f) => (
                      <div key={f.id} style={{ border: `1px solid ${t.border}`, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: t.textPrimary, fontSize: 12 }}>{f.nome}{f.razao_social ? ` · ${f.razao_social}` : ""}</div>
                        <div style={{ color: t.textSecondary }}>
                          {f.cnpj && <>CNPJ: {f.cnpj} · </>}
                          {f.telefone && <>Tel: {f.telefone} · </>}
                          {f.email && <>{f.email}</>}
                        </div>
                        <div style={{ color: t.textSecondary }}>
                          {f.forma_pagamento && <>Pagamento: {f.forma_pagamento}{f.prazo_pagamento ? ` (${f.prazo_pagamento})` : ""} · </>}
                          {f.pix && <>PIX: {f.pix} · </>}
                          {f.banco && <>Banco: {f.banco}{f.agencia ? ` Ag ${f.agencia}` : ""}{f.conta ? ` C/C ${f.conta}` : ""}</>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Checklists */}
            {checklists.map((cl, ci) => {
              const done = cl.items.filter((i) => i.done).length;
              return (
                <div key={ci} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={labelSt}>{cl.name}</div>
                    <div style={{ fontSize: 10, color: done === cl.items.length ? t.success : t.textMuted }}>
                      {done}/{cl.items.length}
                    </div>
                  </div>
                  <div style={{ height: 3, background: t.border, marginBottom: 8 }}>
                    <div style={{
                      height: "100%", width: `${cl.items.length ? (done / cl.items.length) * 100 : 0}%`,
                      background: done === cl.items.length ? t.success : t.accent, transition: "width 0.2s",
                    }} />
                  </div>
                  {cl.items.map((it, ii) => (
                    <label key={ii} style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 2px",
                      fontSize: 12, color: it.done ? t.textMuted : t.textPrimary,
                      textDecoration: it.done ? "line-through" : "none", cursor: "pointer",
                    }}>
                      <input type="checkbox" checked={!!it.done} onChange={() => toggleCheck(ci, ii)} style={{ marginTop: 2 }} />
                      <span>{it.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Comentários */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
              <div style={labelSt}>Comentários ({chat.length})</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {chat.length === 0 && (
                <div style={{ color: t.textMuted, fontSize: 11, textAlign: "center", padding: 20 }}>
                  Nenhum comentário ainda.
                </div>
              )}
              {chat.map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: t.accentSoft,
                    color: t.textPrimary, fontSize: 9, fontWeight: 700,
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>{m.avatar || (m.user || "?").slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.textPrimary }}>{m.user}</span>
                      <span style={{ fontSize: 9, color: t.textMuted }}>
                        {new Date(m.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {m.user_id && user?.id === m.user_id && (
                        <button onClick={() => delChat(m.id)} title="Apagar" style={{
                          background: "transparent", border: "none", color: t.textMuted,
                          cursor: "pointer", padding: 0, marginLeft: "auto",
                        }}>
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.45, marginTop: 2 }}>
                      {m.msg}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${t.border}`, display: "flex", gap: 8 }}>
              <textarea
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Escreva um comentário…"
                rows={2}
                style={{
                  flex: 1, background: t.inputBg, border: `1px solid ${t.border}`,
                  color: t.textPrimary, fontSize: 12, padding: "8px 10px", borderRadius: 0,
                  outline: "none", resize: "none",
                }} />
              <button onClick={sendChat} disabled={!chatText.trim()} title="Enviar" style={{
                background: t.accent, color: t.bg, border: "none", padding: "0 14px",
                cursor: chatText.trim() ? "pointer" : "default", opacity: chatText.trim() ? 1 : 0.4,
                display: "grid", placeItems: "center",
              }}>
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
