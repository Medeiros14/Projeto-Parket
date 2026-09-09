/**
 * Social Selling — funil de relacionamento com ARQUITETOS (Will 01/09).
 *
 * 3 pipelines em abas (Aquisição → Conexão → Ativação), operados pelo
 * Vinicius SDR. Contato acontece por WhatsApp E Instagram (perfil da
 * Parket). Movimento de card é 100% MANUAL, por drag-and-drop entre
 * colunas (e pra aba de outro pipeline = primeira coluna dele) ou pelo
 * select do modal. Os prazos de followup (3/7/30 dias) são só ALERTA
 * VISUAL: o chip de dias na etapa fica vermelho quando estoura o prazo
 * da coluna (kanban_columns.sla_label).
 *
 * Base inicial: ~290 arquitetos extraídos do próprio Homebroker
 * (sql/003_social_selling_base.sql). Bases novas entram por:
 *   1. botão "Novo contato" (cadastro manual)
 *   2. botão "Importar CSV" (nome;telefone;instagram;email) com dedup
 *      por nome normalizado E por telefone contra o que já existe.
 *
 * Fluxo entre pipelines (movimento cross-dept no select do card):
 *   Aquisição: respondeu → Conexão Realizada (pipeline 2)
 *   Conexão:   respondeu → Ativação (pipeline 3)
 *   Ativação:  concordou → Agendamento → Ganho (= agendamento realizado)
 */
import { useMemo, useRef, useState, type ReactNode, type DragEvent } from "react";
import { Loader2, Search, Plus, Upload, Phone, Instagram, X as XIcon, ChevronDown, Move } from "lucide-react";
import {
  api, useFetch,
  DEPT_SOCIAL_AQUISICAO, DEPT_SOCIAL_CONEXAO, DEPT_SOCIAL_ATIVACAO, DEPTS_SOCIAL,
  type KanbanCard, type KanbanColumn,
} from "../../lib/api";
import type { AppUser } from "../../lib/auth";

type SocialColumn = KanbanColumn & { sla_label?: string | null };

// Abas = pipelines. A ordem aqui é a ordem visual.
const PIPELINES: { dept: string; label: string }[] = [
  { dept: DEPT_SOCIAL_AQUISICAO, label: "Aquisição" },
  { dept: DEPT_SOCIAL_CONEXAO,   label: "Conexão" },
  { dept: DEPT_SOCIAL_ATIVACAO,  label: "Ativação" },
];

// ─── helpers ─────────────────────────────────────────────────────────

/** Dias inteiros desde o timestamp (usado no chip "Xd na etapa"). */
function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** "3 dias" → 3. Colunas sem sla_label não têm prazo (retorna null). */
function prazoDias(sla: string | null | undefined): number | null {
  const m = /(\d+)/.exec(sla || "");
  return m ? parseInt(m[1], 10) : null;
}

/** Nome normalizado pra dedup (mesma regra do backfill SQL). */
function normNome(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Só dígitos do telefone, últimos 11 (dedup por fone no import). */
function normFone(s: string): string {
  return s.replace(/\D/g, "").slice(-11);
}

/** Link wa.me a partir do telefone bruto. Prefixa 55 quando o número veio
 *  sem DDI (10/11 dígitos = DDD+fone BR). Retorna null se fone inválido. */
function waLink(fone: string): string | null {
  const d = fone.replace(/\D/g, "");
  if (d.length < 10) return null;
  const full = (d.length === 10 || d.length === 11) ? `55${d}` : d;
  return `https://wa.me/${full}`;
}

/** Listas de origem do card, pro filtro "por lista" da toolbar.
 *  origem_lista vem da planilha e pode ser composta ("TOP1000 2024 /
 *  TOP1000 2025") — separa em listas individuais pra o mesmo contato
 *  aparecer nos dois filtros. Quem não veio de planilha vira lista
 *  sintética pela origem (Base Homebroker / Cadastro manual / Import CSV). */
function listasDoCard(c: KanbanCard): string[] {
  const d = c.details || {};
  const raw = String(d.origem_lista || "").trim();
  if (raw) return raw.split("/").map((s) => s.trim()).filter(Boolean);
  if (d.origem === "homebroker") return ["Base Homebroker"];
  if (d.origem === "manual") return ["Cadastro manual"];
  if (d.origem === "importacao") return ["Import CSV"];
  return ["Sem lista"];
}

// ─── página ──────────────────────────────────────────────────────────

export function SocialSellingPage({ appUser }: { appUser: AppUser }) {
  const cols = useFetch<SocialColumn[]>(() => api.socialColumns(), []);
  const cards = useFetch(() => api.socialCards(), []);
  const [tab, setTab] = useState<string>(DEPT_SOCIAL_AQUISICAO);
  const [search, setSearch] = useState("");
  const [lista, setLista] = useState("");        // filtro por lista de origem ("" = todas)
  const [novoOpen, setNovoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selCard, setSelCard] = useState<KanbanCard | null>(null);
  // Overrides otimistas do drag-and-drop: cardId → posição nova. useFetch não
  // expõe setData, então o drop aplica aqui na hora (card muda de coluna sem
  // esperar o PATCH) e o erro reverte removendo a entrada. reload() limpa tudo.
  const [overrides, setOverrides] = useState<Map<string, { dept_id: string; column_id: string; updated_at: string }>>(new Map());
  const [moveErr, setMoveErr] = useState<string | null>(null);

  const reload = () => { setOverrides(new Map()); cards.reload(); };

  // Cards com override do drag aplicado por cima do fetch. updated_at vai
  // junto pro chip "Xd na etapa" zerar imediatamente ao mover.
  const allCards = useMemo(() => {
    if (overrides.size === 0) return cards.data || [];
    return (cards.data || []).map((c) => {
      const o = overrides.get(c.id);
      return o ? { ...c, ...o } : c;
    });
  }, [cards.data, overrides]);

  /** Move por drag-and-drop (mesma API do select do modal). Otimista:
   *  aplica o override antes do PATCH; falha reverte e mostra o erro. */
  const moverPorDrag = async (cardId: string, toDept: string, toSlug: string) => {
    const card = allCards.find((c) => c.id === cardId);
    if (!card || (card.dept_id === toDept && card.column_id === toSlug)) return;
    const fromSlug = card.column_id;
    setMoveErr(null);
    setOverrides((m) => new Map(m).set(cardId, { dept_id: toDept, column_id: toSlug, updated_at: new Date().toISOString() }));
    try {
      await api.socialMoverCard(cardId, fromSlug, toDept, toSlug, appUser.email);
    } catch (e: any) {
      setOverrides((m) => { const n = new Map(m); n.delete(cardId); return n; });
      setMoveErr(`Falha ao mover "${card.title}": ${e?.message || "erro"}`);
    }
  };

  // Opções do filtro de lista: todas as listas presentes no pipeline ativo,
  // com contagem, maiores primeiro (TOP1000 2025 tende a dominar).
  const listaOpcoes = useMemo(() => {
    const m = new Map<string, number>();
    allCards.filter((c) => c.dept_id === tab).forEach((c) => {
      listasDoCard(c).forEach((l) => m.set(l, (m.get(l) || 0) + 1));
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allCards, tab]);

  const filtered = useMemo(() => {
    let arr = allCards.filter((c) => c.dept_id === tab);
    if (lista) arr = arr.filter((c) => listasDoCard(c).includes(lista));
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((c) =>
        (c.title || "").toLowerCase().includes(s) ||
        JSON.stringify(c.details?.telefones || []).includes(s) ||
        (c.details?.instagram || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [allCards, tab, search, lista]);

  const columnsForTab = useMemo(
    () => (cols.data || []).filter((c) => c.dept_id === tab),
    [cols.data, tab]
  );

  const cardsByColumn = useMemo(() => {
    const m = new Map<string, KanbanCard[]>();
    filtered.forEach((c) => {
      if (!m.has(c.column_id)) m.set(c.column_id, []);
      m.get(c.column_id)!.push(c);
    });
    return m;
  }, [filtered]);

  // Vinicius (canSeeAll) + admins. Mesma população que vê o item no NAV,
  // repetido aqui como guarda pra URL digitada na mão. Fica DEPOIS dos
  // hooks acima pra não violar rules-of-hooks (early return antes de hook).
  if (!appUser.canSeeAll) {
    return <div className="p-12 text-center text-hb-textDim text-sm">Sem acesso ao Social Selling.</div>;
  }

  if (cols.loading || cards.loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando social selling…
    </div>
  );

  return (
    <div className="p-4 space-y-3 h-full flex flex-col">
      {/* Toolbar: abas dos pipelines + busca + ações de base */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-hb-panel border border-hb-border rounded-md p-0.5">
          {PIPELINES.map((p) => (
            // Aba também é alvo de drop: soltar um card aqui move ele pra
            // PRIMEIRA coluna do pipeline (fluxo "respondeu → Conexão" sem
            // abrir o modal). Drop na mesma aba não faz nada.
            <button key={p.dept} onClick={() => setTab(p.dept)}
              onDragOver={(e) => { if (p.dept !== tab) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const primeira = (cols.data || []).filter((c) => c.dept_id === p.dept)
                  .sort((a, b) => ((a as any).position ?? 0) - ((b as any).position ?? 0))[0];
                if (id && primeira && p.dept !== tab) moverPorDrag(id, p.dept, primeira.slug);
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                tab === p.dept ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
              }`}>
              {p.label} <span className="opacity-60 ml-1">({allCards.filter((c) => c.dept_id === p.dept).length})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, telefone, @instagram…"
            className="w-full bg-hb-panel border border-hb-border rounded pl-7 pr-3 py-1.5 text-xs outline-none focus:border-hb-accent" />
        </div>
        {/* Filtro por lista de origem (TOP1000 2025, Levantamento Showroom, Base Homebroker…)
            pra trabalhar uma base por vez sem se perder. Contagem é do pipeline ativo. */}
        <div className="relative">
          <select value={lista} onChange={(e) => setLista(e.target.value)}
            className="appearance-none bg-hb-panel border border-hb-border rounded pl-3 pr-7 py-1.5 text-xs outline-none focus:border-hb-accent text-hb-text cursor-pointer max-w-[220px]">
            <option value="">Todas as listas</option>
            {listaOpcoes.map(([nome, n]) => (
              <option key={nome} value={nome}>{nome} ({n})</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-hb-textDim pointer-events-none" />
        </div>
        <button onClick={() => setNovoOpen(true)}
          className="px-2.5 py-1.5 rounded border border-hb-accent/40 text-hb-accent text-xs font-semibold hover:bg-hb-accent/15 inline-flex items-center gap-1.5">
          <Plus size={12} /> Novo contato
        </button>
        <button onClick={() => setImportOpen(true)}
          className="px-2.5 py-1.5 rounded border border-hb-border text-hb-textDim text-xs font-semibold hover:text-hb-text hover:border-hb-accent inline-flex items-center gap-1.5">
          <Upload size={12} /> Importar CSV
        </button>
      </div>

      {/* Erro de movimento do drag (o modal tem tratamento próprio) */}
      {moveErr && (
        <div className="text-[11px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-3 py-1.5 flex items-center justify-between">
          <span>{moveErr}</span>
          <button onClick={() => setMoveErr(null)} className="text-hb-red hover:opacity-70"><XIcon size={12} /></button>
        </div>
      )}

      {/* Kanban do pipeline ativo */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-2 h-full pb-2" style={{ minWidth: "max-content" }}>
          {columnsForTab.map((col) => (
            <SocialColumnView key={col.id} col={col} cards={cardsByColumn.get(col.slug) || []}
              onOpen={(c) => setSelCard(c)}
              onDropCard={(cardId) => moverPorDrag(cardId, tab, col.slug)} />
          ))}
        </div>
      </div>

      {novoOpen && <NovoContatoModal appUser={appUser} onClose={() => setNovoOpen(false)} onCreated={() => { setNovoOpen(false); reload(); }} />}
      {importOpen && <ImportCsvModal appUser={appUser} existentes={allCards} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); reload(); }} />}
      {selCard && <ContatoModal appUser={appUser} card={selCard} cols={cols.data || []}
        onClose={() => setSelCard(null)} onChanged={() => { setSelCard(null); reload(); }} />}
    </div>
  );
}

// ─── coluna + card ───────────────────────────────────────────────────

// Quantos cards renderizar por coluna de cada vez. A Base tem 4.400+
// contatos: jogar tudo no DOM trava a página, então renderiza em levas
// e o "Mostrar mais" libera a próxima (o total real fica no header).
const CARDS_POR_LEVA = 80;

function SocialColumnView({ col, cards, onOpen, onDropCard }: {
  col: SocialColumn; cards: KanbanCard[]; onOpen: (c: KanbanCard) => void;
  onDropCard: (cardId: string) => void;
}) {
  const isGanho = col.slug === "ganho";
  const isPerdido = col.slug === "perdido";
  const headerColor = isGanho ? "text-hb-green" : isPerdido ? "text-hb-red" : "text-hb-gold";
  const prazo = prazoDias(col.sla_label);
  const [limite, setLimite] = useState(CARDS_POR_LEVA);
  const [dragOver, setDragOver] = useState(false);
  const visiveis = cards.slice(0, limite);
  return (
    <div
      // Coluna inteira é alvo de drop (não só a área dos cards) — mais fácil
      // de acertar quando a coluna destino está vazia ou cheia.
      onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault(); setDragOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropCard(id);
      }}
      className={`w-[250px] shrink-0 bg-hb-panel border rounded-md flex flex-col max-h-full transition ${
        dragOver ? "border-hb-accent bg-hb-accent/5" : "border-hb-border"
      }`}>
      <div className="px-3 py-2 border-b border-hb-border flex items-center justify-between">
        <div className={`text-[11px] font-bold uppercase tracking-wider ${headerColor}`}>{col.title}</div>
        <div className="flex items-center gap-1.5">
          {prazo != null && <span className="text-[9px] text-hb-textDim border border-hb-border rounded px-1">{prazo}d</span>}
          <div className="text-[10px] text-hb-textDim tabular">{cards.length}</div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-1.5 space-y-1.5">
        {cards.length === 0 && <div className="text-[10px] text-hb-textDim text-center py-4">vazio</div>}
        {visiveis.map((c) => <SocialCardItem key={c.id} card={c} prazo={prazo} onOpen={() => onOpen(c)} />)}
        {cards.length > limite && (
          <button onClick={() => setLimite((l) => l + CARDS_POR_LEVA)}
            className="w-full py-1.5 rounded border border-dashed border-hb-border text-[10px] text-hb-textDim hover:text-hb-text hover:border-hb-accent">
            Mostrar mais ({cards.length - limite} restantes)
          </button>
        )}
      </div>
    </div>
  );
}

function SocialCardItem({ card, prazo, onOpen }: { card: KanbanCard; prazo: number | null; onOpen: () => void }) {
  const d = card.details || {};
  const fone = (d.telefones || [])[0] || "";
  const insta = d.instagram || "";
  const wa = fone ? waLink(fone) : null;
  const nObras = Array.isArray(d.cards_origem) ? d.cards_origem.length : 0;
  // Dias na etapa: mover o card atualiza updated_at, então updated_at ≈
  // entrada na coluna. Editar contato também atualiza (aceitável: edição
  // costuma acompanhar uma interação real).
  const dias = diasDesde(card.updated_at || card.created_at);
  const estourou = prazo != null && dias > prazo;
  return (
    // div (não button) porque os chips de fone/insta viram links <a> — link
    // dentro de button é HTML inválido e quebra o clique em alguns browsers.
    <div onClick={onOpen} draggable
      onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", card.id)}
      className="w-full text-left bg-hb-bg border border-hb-border rounded p-2 hover:border-hb-accent transition cursor-pointer">
      <div className="text-xs font-semibold truncate text-hb-text">{card.title}</div>
      <div className="flex items-center gap-2 mt-1 text-[10px] text-hb-textDim min-h-[14px]">
        {/* Chips clicáveis: fone abre a conversa no WhatsApp, insta abre o
            perfil. stopPropagation pra não abrir o modal junto. */}
        {fone && (wa ? (
          <a href={wa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 truncate hover:text-hb-green">
            <Phone size={9} /> {fone}
          </a>
        ) : (
          <span className="inline-flex items-center gap-0.5 truncate"><Phone size={9} /> {fone}</span>
        ))}
        {insta && (
          <a href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 truncate text-hb-blue hover:opacity-80">
            <Instagram size={9} /> @{insta}
          </a>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[9px]">
        <div className="flex items-center gap-1">
          {/* Canal de abordagem (whatsapp / instagram / ambos) */}
          {d.canal && (
            <span className="px-1 rounded border border-hb-blue/40 text-hb-blue uppercase">{d.canal}</span>
          )}
          {nObras > 0 && <span className="text-hb-textDim">{nObras} obra{nObras > 1 ? "s" : ""}</span>}
        </div>
        {/* Chip de dias na etapa — vermelho quando estoura o prazo da coluna */}
        <span className={`px-1 rounded border tabular font-semibold ${
          estourou ? "border-hb-red/50 text-hb-red" : "border-hb-border text-hb-textDim"
        }`}>
          {dias}d{estourou ? " !" : ""}
        </span>
      </div>
    </div>
  );
}

// ─── modal do contato (editar + mover) ───────────────────────────────

function ContatoModal({ appUser, card, cols, onClose, onChanged }: {
  appUser: AppUser; card: KanbanCard; cols: SocialColumn[]; onClose: () => void; onChanged: () => void;
}) {
  const d = card.details || {};
  const [telefone, setTelefone] = useState<string>((d.telefones || []).join(", "));
  const [instagram, setInstagram] = useState<string>(d.instagram || "");
  const [email, setEmail] = useState<string>((d.emails || []).join(", "));
  const [canal, setCanal] = useState<string>(d.canal || "");
  const [obs, setObs] = useState<string>(d.observacoes || "");
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salvar = async () => {
    setSaving(true); setError(null);
    try {
      await api.socialAtualizarContato(card.id, d, {
        telefones: telefone.split(",").map((t) => t.trim()).filter(Boolean),
        emails: email.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
        instagram, canal, observacoes: obs,
      });
      onChanged();
    } catch (e: any) { setError(e?.message || "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const mover = async (v: string) => {
    const [dept, slug] = v.split("|");
    if (dept === card.dept_id && slug === card.column_id) return;
    setMoving(true); setError(null);
    try {
      await api.socialMoverCard(card.id, card.column_id, dept, slug, appUser.email);
      onChanged();
    } catch (e: any) { setError(e?.message || "Falha ao mover"); setMoving(false); }
  };

  return (
    <ModalShell title={card.title || "Contato"} onClose={onClose}>
      {/* Etapa: select agrupado pelos 3 pipelines — daqui o Vinicius faz
          o movimento manual, inclusive cross-pipeline (respondeu → Conexão etc). */}
      <label className="block text-[10px] uppercase tracking-wider text-hb-textDim mb-1">Etapa</label>
      <div className="relative mb-3">
        <select value={`${card.dept_id}|${card.column_id}`} onChange={(e) => mover(e.target.value)} disabled={moving}
          className="w-full bg-hb-bg border border-hb-border rounded pl-6 pr-6 py-1.5 text-xs outline-none focus:border-hb-accent appearance-none cursor-pointer">
          {PIPELINES.map((p) => (
            <optgroup key={p.dept} label={p.label}>
              {cols.filter((c) => c.dept_id === p.dept).map((c) => (
                <option key={c.id} value={`${p.dept}|${c.slug}`}>{c.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <Move size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-hb-textDim pointer-events-none" />
        <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-hb-textDim pointer-events-none" />
        {moving && <Loader2 size={9} className="animate-spin absolute right-5 top-1/2 -translate-y-1/2 text-hb-accent" />}
      </div>

      <Campo label="Telefones (separar por vírgula)" value={telefone} onChange={setTelefone} placeholder="(11) 99999-9999" />
      <Campo label="Instagram (sem @)" value={instagram} onChange={setInstagram} placeholder="arquiteta.exemplo" />
      <Campo label="Emails (separar por vírgula)" value={email} onChange={setEmail} placeholder="contato@studio.com" />
      <CanalSelect value={canal} onChange={setCanal} />
      <label className="block text-[10px] uppercase tracking-wider text-hb-textDim mb-1">Observações</label>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent mb-3" />

      {Array.isArray(d.cards_origem) && d.cards_origem.length > 0 && (
        <div className="text-[10px] text-hb-textDim mb-3">
          Passou por {d.cards_origem.length} obra{d.cards_origem.length > 1 ? "s" : ""} no funil comercial
          {d.origem ? ` · base: ${d.origem}` : ""}
        </div>
      )}

      {error && <div className="text-[10px] text-hb-red mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded border border-hb-border text-xs text-hb-textDim hover:text-hb-text">Fechar</button>
        <button onClick={salvar} disabled={saving}
          className="px-3 py-1.5 rounded bg-hb-accent text-hb-bg text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
          {saving && <Loader2 size={10} className="animate-spin" />} Salvar
        </button>
      </div>
    </ModalShell>
  );
}

// ─── modal novo contato ──────────────────────────────────────────────

function NovoContatoModal({ appUser, onClose, onCreated }: {
  appUser: AppUser; onClose: () => void; onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [canal, setCanal] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criar = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório"); return; }
    setSaving(true); setError(null);
    try {
      await api.socialCriarContato({
        nome, telefone, instagram, email, canal,
        observacoes: obs, origem: "manual", criadoPor: appUser.email,
      });
      onCreated();
    } catch (e: any) { setError(e?.message || "Falha ao criar"); setSaving(false); }
  };

  return (
    <ModalShell title="Novo contato (entra na Base)" onClose={onClose}>
      <Campo label="Nome *" value={nome} onChange={setNome} placeholder="Nome do arquiteto / escritório" />
      <Campo label="Telefone" value={telefone} onChange={setTelefone} placeholder="(11) 99999-9999" />
      <Campo label="Instagram (sem @)" value={instagram} onChange={setInstagram} placeholder="arquiteta.exemplo" />
      <Campo label="Email" value={email} onChange={setEmail} placeholder="contato@studio.com" />
      <CanalSelect value={canal} onChange={setCanal} />
      <label className="block text-[10px] uppercase tracking-wider text-hb-textDim mb-1">Observações</label>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent mb-3" />
      {error && <div className="text-[10px] text-hb-red mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded border border-hb-border text-xs text-hb-textDim hover:text-hb-text">Cancelar</button>
        <button onClick={criar} disabled={saving}
          className="px-3 py-1.5 rounded bg-hb-accent text-hb-bg text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
          {saving && <Loader2 size={10} className="animate-spin" />} Criar na Base
        </button>
      </div>
    </ModalShell>
  );
}

// ─── modal importar CSV ──────────────────────────────────────────────

/** Importa base externa. Formato: 1 contato por linha, colunas separadas
 *  por ; ou , na ordem: nome;telefone;instagram;email (só nome obrigatório).
 *  Linha de cabeçalho é detectada ("nome") e pulada. Dedup contra a base
 *  existente por nome normalizado E por telefone (últimos 11 dígitos). */
function ImportCsvModal({ appUser, existentes, onClose, onDone }: {
  appUser: AppUser; existentes: KanbanCard[]; onClose: () => void; onDone: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lerArquivo = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setTexto(String(reader.result || ""));
    reader.readAsText(f, "utf-8");
  };

  const importar = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      // Índices de dedup da base atual (todos os 3 pipelines)
      const nomes = new Set(existentes.map((c) => normNome(c.title || "")));
      const fones = new Set<string>();
      existentes.forEach((c) => (c.details?.telefones || []).forEach((t: string) => {
        const n = normFone(t); if (n.length >= 8) fones.add(n);
      }));

      const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let criados = 0, pulados = 0;
      for (const linha of linhas) {
        const sep = linha.includes(";") ? ";" : ",";
        const [nome, telefone, instagram, email] = linha.split(sep).map((x) => (x || "").trim().replace(/^"|"$/g, ""));
        if (!nome || normNome(nome) === "nome") continue;  // header ou vazio
        const fn = normFone(telefone || "");
        if (nomes.has(normNome(nome)) || (fn.length >= 8 && fones.has(fn))) { pulados++; continue; }
        await api.socialCriarContato({
          nome, telefone, instagram, email,
          origem: "importacao", criadoPor: appUser.email,
        });
        nomes.add(normNome(nome));
        if (fn.length >= 8) fones.add(fn);
        criados++;
      }
      setResult(`${criados} contato(s) criado(s) na Base · ${pulados} pulado(s) (já existiam)`);
    } catch (e: any) { setError(e?.message || "Falha na importação"); }
    finally { setRunning(false); }
  };

  return (
    <ModalShell title="Importar base (CSV)" onClose={onClose} wide>
      <div className="text-[10px] text-hb-textDim mb-2">
        Formato: uma linha por contato, colunas <strong>nome;telefone;instagram;email</strong> (só o nome é obrigatório).
        Duplicados por nome ou telefone são pulados automaticamente.
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => fileRef.current?.click()}
          className="px-2.5 py-1.5 rounded border border-hb-border text-xs text-hb-textDim hover:text-hb-text hover:border-hb-accent inline-flex items-center gap-1.5">
          <Upload size={11} /> Escolher arquivo…
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />
        <span className="text-[10px] text-hb-textDim">ou cole o conteúdo abaixo</span>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8}
        placeholder={"Maria Silva;(11) 99999-1234;maria.arq;maria@studio.com\nJoão Souza;;joaosouza.arq;"}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-[11px] font-mono outline-none focus:border-hb-accent mb-3" />
      {result && <div className="text-[11px] text-hb-green mb-2">{result}</div>}
      {error && <div className="text-[10px] text-hb-red mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={result ? onDone : onClose} className="px-3 py-1.5 rounded border border-hb-border text-xs text-hb-textDim hover:text-hb-text">
          {result ? "Concluir" : "Cancelar"}
        </button>
        {!result && (
          <button onClick={importar} disabled={running || !texto.trim()}
            className="px-3 py-1.5 rounded bg-hb-accent text-hb-bg text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
            {running && <Loader2 size={10} className="animate-spin" />} Importar
          </button>
        )}
      </div>
    </ModalShell>
  );
}

// ─── peças compartilhadas dos modais ─────────────────────────────────

function ModalShell({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-hb-panel border border-hb-border rounded-lg p-4 w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[90vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-hb-text truncate">{title}</div>
          <button onClick={onClose} className="text-hb-textDim hover:text-hb-text"><XIcon size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="mb-2">
      <label className="block text-[10px] uppercase tracking-wider text-hb-textDim mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent" />
    </div>
  );
}

/** Canal de abordagem — o contato no Instagram é feito pelo perfil da
 *  PARKET (não perfil pessoal), então o campo só marca POR ONDE abordar. */
function CanalSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2">
      <label className="block text-[10px] uppercase tracking-wider text-hb-textDim mb-1">Canal de contato</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent">
        <option value="">Não definido</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram (perfil Parket)</option>
        <option value="ambos">Ambos</option>
      </select>
    </div>
  );
}
