import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Fiscal, type FiscalInput, type Agenda, type AgendaInput, type AgendaAnexo, type AgendaStatus, type AgendaTipo, type ProjetoResumo, type LaudoAll } from "../api";
import { fonts, useTokens } from "../theme";
import { LaudoDetalheModal } from "../components/LaudoDetalheModal";

/** Setor Fiscal — CRUD nativo da equipe.
 *  Reusa `public.fiscal_equipe` (mesma tabela do Space) via API FastAPI própria
 *  do parket-gestao. Novos módulos (Kanban Semanal, Agenda, Laudos) entram como
 *  novas sub-abas depois. */

const PERMISSOES_DISPONIVEIS = [
  { key: "laudos",  label: "Laudos & Vistorias" },
  { key: "agenda",  label: "Agenda de vistoria" },
  { key: "fotos",   label: "Upload de fotos" },
  { key: "compras", label: "Solicitar compras" },
  { key: "admin",   label: "Admin (gerenciar equipe)" },
] as const;

type TabId = "equipe" | "kanban" | "laudos";

export default function FiscalPage() {
  const t = useTokens();
  const nav = useNavigate();
  const sub = (useParams()["*"] || "").split("/")[0];
  const aba: TabId = sub === "equipe" || sub === "laudos" ? sub : "kanban";
  const setAba = (a: TabId) => nav(`/fiscal/${a}`);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden" }}>
      {/* HEAD */}
      <div style={{ padding: "20px 32px 14px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 20, letterSpacing: "0.14em",
          textTransform: "uppercase", color: t.textPrimary,
        }}>
          Fiscal
        </div>
        <div style={{
          fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.20em",
          color: t.textTertiary, textTransform: "uppercase", marginTop: 6,
        }}>
          Gestão da equipe + kanban semanal de vistorias
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: "flex", gap: 4, padding: "0 32px",
        borderBottom: `1px solid ${t.border1}`, background: t.card1,
      }}>
        <TabBtn active={aba === "kanban"} onClick={() => setAba("kanban")} t={t}>Kanban Semanal</TabBtn>
        <TabBtn active={aba === "equipe"} onClick={() => setAba("equipe")} t={t}>Equipe</TabBtn>
        <TabBtn active={aba === "laudos"} onClick={() => setAba("laudos")} t={t}>Gestão de Laudos</TabBtn>
      </div>

      {aba === "equipe" ? <EquipeTab /> :
       aba === "kanban" ? <KanbanSemanalTab /> :
       <GestaoLaudosTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children, t }: {
  active: boolean; onClick: () => void; children: any; t: any;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 18px", background: "transparent", border: "none",
      borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
      color: active ? t.textPrimary : t.textSecondary, cursor: "pointer",
      fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em",
      textTransform: "uppercase",
      transition: "color 0.15s, border-color 0.15s",
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EQUIPE — lista + criar/editar/desativar
// ═══════════════════════════════════════════════════════════════════

function EquipeTab() {
  const t = useTokens();
  const [items, setItems] = useState<Fiscal[]>([]);
  const [q, setQ] = useState("");
  const [showInativos, setShowInativos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: "novo" } | { kind: "editar"; f: Fiscal } | null>(null);
  const [projetosFiscal, setProjetosFiscal] = useState<Fiscal | null>(null);

  const load = () => {
    setLoading(true);
    api.fiscalList({ q: q || undefined, ativo: showInativos ? undefined : true })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { const id = setTimeout(load, 220); return () => clearTimeout(id); }, [q, showInativos]);

  const stats = useMemo(() => ({
    total:    items.length,
    ativos:   items.filter(f => f.ativo).length,
    admins:   items.filter(f => f.ativo && f.permissoes?.admin).length,
  }), [items]);

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* KPIs + ações */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
        <Kpi label="Fiscais" v={stats.total} t={t} />
        <Kpi label="Ativos"  v={stats.ativos} t={t} accent />
        <Kpi label="Admins"  v={stats.admins} t={t} />
        <div style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="BUSCAR NOME / EMAIL / TELEFONE" style={inputStyle(t)} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.20em", color: t.textSecondary, textTransform: "uppercase", cursor: "pointer" }}>
          <input type="checkbox" checked={showInativos} onChange={(e) => setShowInativos(e.target.checked)} />
          Mostrar inativos
        </label>
        <button onClick={() => setModal({ kind: "novo" })} style={btnPrimario(t)}>+ Novo fiscal</button>
      </div>

      {/* Tabela */}
      <div style={{ display: "grid", gap: 2 }}>
        <RowHead t={t} />
        {loading && (
          <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
            carregando…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
            nenhum fiscal encontrado
          </div>
        )}
        {items.map((f) => (
          <FiscalRow key={f.id} f={f} t={t}
            onOpenProjetos={() => setProjetosFiscal(f)}
            onEdit={() => setModal({ kind: "editar", f })}
            onDesativar={async () => {
              if (!confirm(`Desativar ${f.nome}?`)) return;
              await api.fiscalDelete(f.id); load();
            }}
            onReativar={async () => {
              await api.fiscalPatch(f.id, { ativo: true }); load();
            }}
          />
        ))}
      </div>

      {modal && (
        <FiscalModal
          initial={modal.kind === "editar" ? modal.f : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {projetosFiscal && (
        <FiscalProjetosModal
          fiscal={projetosFiscal}
          onClose={() => setProjetosFiscal(null)}
        />
      )}
    </section>
  );
}

function RowHead({ t }: { t: any }) {
  const c: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
    textTransform: "uppercase", color: t.textTertiary,
  };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.5fr 1.4fr 1.2fr 1fr 90px 160px",
      gap: 12, padding: "8px 12px", background: t.card1,
      borderBottom: `1px solid ${t.border1}`, alignItems: "center",
    }}>
      <span style={c}>Nome</span>
      <span style={c}>E-mail</span>
      <span style={c}>Telefone</span>
      <span style={c}>Permissões</span>
      <span style={c}>Status</span>
      <span style={c}>Ações</span>
    </div>
  );
}

function FiscalRow({ f, t, onEdit, onDesativar, onReativar, onOpenProjetos }: {
  f: Fiscal; t: any;
  onEdit: () => void; onDesativar: () => void; onReativar: () => void;
  onOpenProjetos: () => void;
}) {
  const perms = f.permissoes || {};
  const permsAtivas = Object.keys(perms).filter(k => perms[k]);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpenProjetos}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Ver projetos vinculados"
      style={{
        display: "grid", gridTemplateColumns: "1.5fr 1.4fr 1.2fr 1fr 90px 160px",
        gap: 12, padding: "10px 12px", alignItems: "center",
        background: hover ? t.card2 : t.card1,
        border: `1px solid ${hover ? t.border2 : t.border1}`,
        borderLeft: `3px solid ${f.ativo ? t.accent : t.border1}`,
        opacity: f.ativo ? 1 : 0.55,
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
      }}>
      <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {f.nome}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {f.email || "—"}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary }}>{f.telefone || "—"}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {permsAtivas.length === 0 && <span style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase" }}>—</span>}
        {permsAtivas.slice(0, 3).map(p => (
          <span key={p} style={{
            fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
            color: t.accent, border: `1px solid ${t.borderHover}`,
            padding: "2px 6px", background: t.card2,
          }}>{p}</span>
        ))}
        {permsAtivas.length > 3 && (
          <span style={{ fontSize: 8, color: t.textTertiary }}>+{permsAtivas.length - 3}</span>
        )}
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: f.ativo ? t.accent : t.textTertiary }}>
        ● {f.ativo ? "ativo" : "inativo"}
      </div>
      <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => { e.stopPropagation(); onOpenProjetos(); }}
          style={{ ...btnSecundario(t), color: t.accent, borderColor: t.accent }}>Obras</button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={btnSecundario(t)}>Editar</button>
        {f.ativo ? (
          <button onClick={(e) => { e.stopPropagation(); onDesativar(); }} style={{ ...btnSecundario(t), color: t.textTertiary }}>×</button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onReativar(); }} style={btnSecundario(t)}>↺</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — criar/editar fiscal
// ═══════════════════════════════════════════════════════════════════

function FiscalModal({ initial, onClose, onSaved }: {
  initial: Fiscal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTokens();
  const [nome, setNome] = useState(initial?.nome || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [telefone, setTelefone] = useState(initial?.telefone || "");
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(
    initial?.permissoes || { laudos: true, agenda: true, fotos: true, compras: false, admin: false }
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!nome.trim()) { setErro("Nome é obrigatório."); return; }
    setSaving(true); setErro(null);
    const payload: FiscalInput = {
      nome: nome.trim(),
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      permissoes,
    };
    try {
      if (initial) await api.fiscalPatch(initial.id, payload);
      else         await api.fiscalCreate(payload);
      onSaved();
    } catch (e: any) {
      setErro(String(e?.message || e));
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: (t as any).overlay || "rgba(0,0,0,0.55)",
      display: "grid", placeItems: "center", zIndex: 100, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(520px, 96vw)", background: t.bg, border: `1px solid ${t.border2}`,
        padding: 24, fontFamily: fonts.inter,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textPrimary, marginBottom: 4,
        }}>
          {initial ? "Editar fiscal" : "Novo fiscal"}
        </div>
        <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
          Cadastro compartilhado com o Space (public.fiscal_equipe)
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Campo t={t} label="Nome *">
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus style={inputStyle(t)} placeholder="ex: Felipe Almeida" />
          </Campo>
          <Campo t={t} label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle(t)} placeholder="fiscal@parket.com.br" />
          </Campo>
          <Campo t={t} label="Telefone">
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inputStyle(t)} placeholder="+55 11 9..." />
          </Campo>
          <Campo t={t} label="Permissões">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.key} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", background: t.card1, border: `1px solid ${t.border1}`,
                  cursor: "pointer", fontSize: 10, color: t.textPrimary,
                }}>
                  <input type="checkbox" checked={!!permissoes[p.key]}
                    onChange={(e) => setPermissoes({ ...permissoes, [p.key]: e.target.checked })} />
                  {p.label}
                </label>
              ))}
            </div>
          </Campo>
        </div>

        {erro && (
          <div style={{ fontSize: 10, color: t.accent, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 14 }}>
            ⚠ {erro}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
          <button onClick={onClose} disabled={saving} style={btnSecundario(t)}>Cancelar</button>
          <button onClick={salvar} disabled={saving || !nome.trim()} style={{
            ...btnPrimario(t),
            opacity: (saving || !nome.trim()) ? 0.5 : 1,
            cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? "Salvando…" : initial ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KANBAN SEMANAL — 7 colunas (seg-dom) com vistorias agrupadas por dia
// ═══════════════════════════════════════════════════════════════════

const DIAS_LABEL = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
export const TIPO_LABEL: Record<string, string> = {
  "1vistoria":      "1ª Vistoria",
  "2vistoria":      "2ª Vistoria",
  "acompanhamento": "Acompanhamento",
  "entrega":        "Entrega",
  "reparo":         "Reparo",
  "termo":          "Termo de Responsabilidade",
  "fotografico":    "Relatório Fotográfico",
};
const TIPOS: AgendaTipo[] = ["1vistoria", "2vistoria", "acompanhamento", "entrega", "reparo"];
const STATUS_LIST: AgendaStatus[] = ["agendado", "confirmado", "realizado", "cancelado"];
const TAGS_PADRAO = ["Medição", "Liberação", "Acompanhamento", "Reparo"];

/** Segunda-feira 00:00 da semana da data d (weekStartsOn=1). */
function inicioDaSemana(d: Date): Date {
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  const wd = dt.getDay(); // 0=dom, 1=seg...
  const diff = wd === 0 ? -6 : 1 - wd;
  dt.setDate(dt.getDate() + diff);
  return dt;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDataCurta(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtRange(a: Date, b: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${a.toLocaleDateString("pt-BR", opts)} — ${b.toLocaleDateString("pt-BR", opts)}, ${a.getFullYear()}`;
}
function corDoStatus(s: AgendaStatus, t: any): string {
  switch (s) {
    case "confirmado": return "#7BA394";     // verde
    case "realizado":  return t.accent;
    case "cancelado":  return "#B85B4C";     // vermelho
    default:           return "#C7A45B";     // amber (agendado)
  }
}

function KanbanSemanalTab() {
  const t = useTokens();
  const [semanaBase, setSemanaBase] = useState<Date>(inicioDaSemana(new Date()));
  const [items, setItems] = useState<Agenda[]>([]);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);
  const [fiscalFilter, setFiscalFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: "novo"; dia: Date; projetoId?: string; online?: boolean } | { kind: "editar"; a: Agenda } | null>(null);
  const [obras, setObras] = useState<ObraVinculada[]>([]);
  const [obrasLoading, setObrasLoading] = useState(false);

  const fim = useMemo(() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); return d; }, [semanaBase]);

  const load = () => {
    setLoading(true);
    api.agendaList({
      from: ymd(semanaBase),
      to:   ymd(fim),
      fiscal_id: fiscalFilter || undefined,
    }).then(setItems).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [semanaBase, fiscalFilter]);
  useEffect(() => { api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([])); }, []);

  // Coluna OBRAS (modelo Trello): obras vinculadas ao fiscal filtrado, ou de todos
  useEffect(() => {
    let cancelado = false;
    setObrasLoading(true);
    const carga: Promise<ObraVinculada[]> = fiscalFilter
      ? api.fiscalProjetos(fiscalFilter).then(list =>
          list.map(p => ({ ...p, fiscais_nomes: [] as string[] })))
      : Promise.all(fiscais.map(f =>
          api.fiscalProjetos(f.id)
            .then(list => list.map(p => ({ p, nome: f.nome })))
            .catch(() => [] as { p: ProjetoResumo; nome: string }[])
        )).then(chunks => {
          const map = new Map<string, ObraVinculada>();
          for (const chunk of chunks) for (const { p, nome } of chunk) {
            const cur = map.get(p.id);
            if (cur) cur.fiscais_nomes.push(nome);
            else map.set(p.id, { ...p, fiscais_nomes: [nome] });
          }
          return Array.from(map.values());
        });
    carga
      .then(list => { if (!cancelado) setObras(list.sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""))); })
      .catch(() => { if (!cancelado) setObras([]); })
      .finally(() => { if (!cancelado) setObrasLoading(false); });
    return () => { cancelado = true; };
  }, [fiscalFilter, fiscais]);

  // Status da semana por obra (selo no card da coluna OBRAS):
  // realizado > confirmado > agendado; cancelado não sinaliza.
  const statusObra = useMemo(() => {
    const prio: Record<string, number> = { agendado: 1, confirmado: 2, realizado: 3 };
    const norm = (s?: string | null) => (s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,()/\\\-–_]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    const byCard = new Map<string, AgendaStatus>();
    const byCliente = new Map<string, AgendaStatus>();
    const best = (m: Map<string, AgendaStatus>, k: string, s: AgendaStatus) => {
      if (!prio[s]) return;
      const cur = m.get(k);
      if (!cur || prio[s] > prio[cur]) m.set(k, s);
    };
    for (const a of items) {
      if (a.card_id) best(byCard, a.card_id, a.status);
      const n = norm(a.cliente);
      if (n) best(byCliente, n, a.status);
    }
    const out = new Map<string, AgendaStatus>();
    for (const p of obras) {
      const s = (p.card_id ? byCard.get(p.card_id) : undefined) || byCliente.get(norm(p.cliente));
      if (s) out.set(p.id, s);
    }
    return out;
  }, [items, obras]);

  const itensVisiveis = useMemo(() => {
    let out = items;
    if (tagFilter) out = out.filter(a => (a.tags || []).includes(tagFilter));
    return out;
  }, [items, tagFilter]);

  const tagsDisponiveis = useMemo(() => {
    const set = new Set<string>(TAGS_PADRAO);
    for (const a of items) for (const tag of (a.tags || [])) set.add(tag);
    return [...set];
  }, [items]);

  // Agrupamento por dia (índice 0..6 = seg..dom).
  // Online NÃO força mais a coluna própria: com no_calendario=true fica no dia (selo Online).
  const porDia = useMemo(() => {
    const acc: Agenda[][] = [[], [], [], [], [], [], []];
    for (const a of itensVisiveis) {
      if (a.online && !a.no_calendario) continue;
      const d = new Date(a.data_inicio);
      const idx = (d.getDay() + 6) % 7; // seg=0
      acc[idx].push(a);
    }
    return acc;
  }, [itensVisiveis]);

  // Coluna Acompanhamento Online: só os online SEM dia fixado (no_calendario=false) da semana visível
  const onlineItens = useMemo(() => {
    let out = items.filter(a => a.online && !a.no_calendario);
    if (tagFilter) out = out.filter(a => (a.tags || []).includes(tagFilter));
    return out.sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  }, [items, tagFilter]);

  const stats = useMemo(() => ({
    total:      itensVisiveis.length,
    agendados:  itensVisiveis.filter(x => x.status === "agendado").length,
    confirmados: itensVisiveis.filter(x => x.status === "confirmado").length,
    realizados: itensVisiveis.filter(x => x.status === "realizado").length,
  }), [itensVisiveis]);

  const dias: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaBase); d.setDate(d.getDate() + i); return d;
  });

  const setPatch = async (a: Agenda, patch: Partial<AgendaInput>) => {
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, ...patch as any } : x));
    try { await api.agendaPatch(a.id, patch); load(); }
    catch (e: any) { alert("Falhou: " + e.message); load(); }
  };

  // Drag-and-drop: mover vistoria pra outro dia mantendo o horário.
  // Vindo da coluna ONLINE, continua online — só ganha dia no calendário (no_calendario=true).
  const moverAgendaParaDia = (agendaId: string, novoDia: Date) => {
    const a = items.find(x => x.id === agendaId);
    if (!a) return;
    const naColunaOnline = a.online && !a.no_calendario;
    const orig = new Date(a.data_inicio);
    const novo = new Date(novoDia);
    novo.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    if (novo.getTime() === orig.getTime() && !naColunaOnline) return;
    const patch: Partial<AgendaInput> = { data_inicio: novo.toISOString() };
    if (naColunaOnline) patch.no_calendario = true;
    setPatch(a, patch);
  };

  const moverAgendaParaOnline = (agendaId: string) => {
    const a = items.find(x => x.id === agendaId);
    if (!a || (a.online && !a.no_calendario)) return;
    setPatch(a, { online: true, no_calendario: false });
  };

  return (
    <section style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      {/* Barra de controle — 2 linhas estruturadas:
          Linha 1 (controles): Navegação + Range à esquerda, Filtro + Ação à direita.
          Linha 2 (métricas):  KPIs alinhados horizontalmente com espaço uniforme.
          Sem flex-wrap desordenado — cada linha respira independente. */}
      <div style={{
        padding: "14px 32px 12px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* Linha 1 — Controles */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d); }} style={navBtn(t)}>‹</button>
              <button onClick={() => setSemanaBase(inicioDaSemana(new Date()))} style={{ ...navBtn(t), padding: "6px 12px" }}>Hoje</button>
              <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d); }} style={navBtn(t)}>›</button>
            </div>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.18em",
              textTransform: "uppercase", color: t.textPrimary, whiteSpace: "nowrap",
            }}>
              {fmtRange(semanaBase, new Date(fim.getTime() - 86400000))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <select
              value={fiscalFilter}
              onChange={(e) => setFiscalFilter(e.target.value)}
              style={{ ...inputStyle(t), width: 220, flex: "0 0 auto" }}
            >
              <option value="">TODOS OS FISCAIS</option>
              {fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{ ...inputStyle(t), width: 170, flex: "0 0 auto" }}
            >
              <option value="">TODAS AS TAGS</option>
              {tagsDisponiveis.map(tag => <option key={tag} value={tag}>{tag.toUpperCase()}</option>)}
            </select>
            <button onClick={() => setModal({ kind: "novo", dia: dias[0] })} style={{ ...btnPrimario(t), whiteSpace: "nowrap", flex: "0 0 auto" }}>
              + Nova vistoria
            </button>
          </div>
        </div>

        {/* Linha 2 — Métricas */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8, padding: "10px 14px",
          background: t.card1, border: `1px solid ${t.border1}`,
        }}>
          <MiniKpi label="Total"       v={stats.total}       t={t} />
          <MiniKpi label="Agendados"   v={stats.agendados}   t={t} corValor="#C7A45B" />
          <MiniKpi label="Confirmados" v={stats.confirmados} t={t} corValor="#7BA394" />
          <MiniKpi label="Realizados"  v={stats.realizados}  t={t} corValor={t.accent} />
        </div>
      </div>

      {/* Grid: coluna fixa OBRAS (modelo Trello) + ONLINE (sem dia) + 7 colunas de dias */}
      <div style={{
        display: "grid", gridTemplateColumns: "minmax(215px, 235px) repeat(8, minmax(200px, 1fr))",
        gap: 6, padding: "12px 20px", overflow: "auto", background: t.bg,
      }}>
        <ColunaObras
          obras={obras} t={t} loading={obrasLoading}
          fiscalNome={fiscalFilter ? (fiscais.find(f => f.id === fiscalFilter)?.nome || "") : ""}
          statusObra={statusObra}
          onAgendar={(p) => setModal({ kind: "novo", dia: dias[0], projetoId: p.id })}
        />
        <ColunaOnline
          itens={onlineItens} t={t} loading={loading}
          onAdd={() => setModal({ kind: "novo", dia: dias[0], online: true })}
          onEdit={(a) => setModal({ kind: "editar", a })}
          onStatus={(a, status) => setPatch(a, { status })}
          onDropAgenda={moverAgendaParaOnline}
          onDropObra={(pid) => setModal({ kind: "novo", dia: dias[0], projetoId: pid, online: true })}
        />
        {dias.map((d, i) => (
          <ColunaDia key={i} data={d} label={DIAS_LABEL[i]} itens={porDia[i]}
            t={t} loading={loading}
            onAdd={() => setModal({ kind: "novo", dia: d })}
            onEdit={(a) => setModal({ kind: "editar", a })}
            onStatus={(a, status) => setPatch(a, { status })}
            onDropAgenda={(id) => moverAgendaParaDia(id, d)}
            onDropObra={(pid) => setModal({ kind: "novo", dia: d, projetoId: pid })}
          />
        ))}
      </div>

      {modal && (
        <AgendaModal
          initial={modal.kind === "editar" ? modal.a : null}
          diaSugerido={modal.kind === "novo" ? modal.dia : null}
          projetoIdInicial={modal.kind === "novo" ? modal.projetoId || null : null}
          onlineInicial={modal.kind === "novo" ? !!modal.online : false}
          fiscalIdInicial={fiscalFilter || null}
          fiscais={fiscais}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onDelete={modal.kind === "editar" ? async () => {
            if (!confirm("Excluir esta vistoria?")) return;
            await api.agendaDelete(modal.a.id); setModal(null); load();
          } : undefined}
        />
      )}
    </section>
  );
}

type ObraVinculada = ProjetoResumo & { fiscais_nomes: string[] };

const STATUS_SELO_LABEL: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado",
};

function ColunaObras({ obras, t, loading, fiscalNome, statusObra, onAgendar }: {
  obras: ObraVinculada[]; t: any; loading: boolean; fiscalNome: string;
  statusObra: Map<string, AgendaStatus>;
  onAgendar: (p: ObraVinculada) => void;
}) {
  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.borderHover}`,
      borderTop: `3px solid ${t.accent}`,
      display: "flex", flexDirection: "column", minHeight: 400,
      position: "sticky", left: 0, zIndex: 5,
      boxShadow: "8px 0 14px rgba(0,0,0,0.28)",
    }}>
      {/* header */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.accent }}>
            Obras
          </span>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 11, color: t.textPrimary, fontVariantNumeric: "tabular-nums" as any }}>
            {obras.length}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 8, letterSpacing: "0.16em", color: t.textTertiary, textTransform: "uppercase" }}>
          {fiscalNome ? `Obras de ${fiscalNome}` : "Todas as obras vinculadas"}
        </div>
      </div>

      {/* cards de obra */}
      <div style={{ flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
        {loading && obras.length === 0 && (
          <div style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.18em", textAlign: "center", padding: 12, textTransform: "uppercase" }}>…</div>
        )}
        {!loading && obras.length === 0 && (
          <div style={{
            border: `1px dashed ${t.border1}`, padding: "18px 10px", textAlign: "center",
            fontSize: 9, letterSpacing: "0.16em", color: t.textTertiary, textTransform: "uppercase", lineHeight: 1.8,
          }}>
            Nenhuma obra vinculada.<br />Vincule na aba Equipe → Projetos do fiscal.
          </div>
        )}
        {obras.map(p => {
          const selo = statusObra.get(p.id);
          const seloCor = selo ? corDoStatus(selo, t) : "";
          return (
          <div key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "obra", projetoId: p.id }));
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
            background: t.card2, border: `1px solid ${t.border1}`,
            borderLeft: `3px solid ${selo ? seloCor : t.accent}`,
            padding: "7px 9px", cursor: "grab",
          }}>
            <Link to={`/projetos/${p.id}`} style={{
              fontSize: 10.5, color: t.textPrimary, textDecoration: "none",
              textTransform: "uppercase", letterSpacing: "0.04em", display: "block",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.cliente || p.obra_code || "?"}
            </Link>
            {selo && (
              <div style={{
                marginTop: 4, display: "inline-block",
                fontSize: 7.5, letterSpacing: "0.18em", textTransform: "uppercase",
                fontFamily: fonts.cinzel, color: seloCor,
                border: `1px solid ${seloCor}`, padding: "2px 6px",
              }}>
                ● {STATUS_SELO_LABEL[selo] || selo}
              </div>
            )}
            <div style={{ fontSize: 8, letterSpacing: "0.12em", color: t.textTertiary, marginTop: 3, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.numero_proposta && <span>#{p.numero_proposta}</span>}
              {p.numero_proposta && p.obra_code && <span>{"  ·  "}</span>}
              {p.obra_code && <span>{p.obra_code}</span>}
            </div>
            {p.fiscais_nomes.length > 0 && (
              <div style={{ fontSize: 8.5, color: t.textSecondary, marginTop: 2, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.fiscais_nomes.join(" · ")}
              </div>
            )}
            <button onClick={() => onAgendar(p)} style={{
              marginTop: 5, background: "transparent", border: `1px dashed ${t.border1}`,
              color: t.accent, cursor: "pointer", width: "100%",
              padding: "3px 6px", fontSize: 8, letterSpacing: "0.16em",
              fontFamily: fonts.inter, textTransform: "uppercase",
            }}>+ agendar</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// Coluna ONLINE: só os agendamentos online SEM dia fixado (no_calendario=false).
// Online com dia marcado fica na coluna do dia com o selo Online.
function ColunaOnline({ itens, t, loading, onAdd, onEdit, onStatus, onDropAgenda, onDropObra }: {
  itens: Agenda[]; t: any; loading: boolean;
  onAdd: () => void;
  onEdit: (a: Agenda) => void;
  onStatus: (a: Agenda, s: AgendaStatus) => void;
  onDropAgenda: (agendaId: string) => void;
  onDropObra: (projetoId: string) => void;
}) {
  const AZUL = "#4A7FA5";
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        try {
          const d = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (d.kind === "agenda" && d.id) onDropAgenda(d.id);
          else if (d.kind === "obra" && d.projetoId) onDropObra(d.projetoId);
        } catch { /* drop de fora — ignora */ }
      }}
      style={{
        background: dragOver ? t.card2 : t.card1,
        border: `1px solid ${dragOver ? AZUL : t.border1}`,
        borderTop: `3px solid ${AZUL}`,
        display: "flex", flexDirection: "column", minHeight: 400,
        transition: "background 0.1s, border-color 0.1s",
      }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: AZUL }}>
            Acompanhamento Online
          </span>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 11, color: t.textPrimary, fontVariantNumeric: "tabular-nums" as any }}>
            {itens.length}
          </span>
        </div>
        <button onClick={onAdd} style={{
          marginTop: 6, background: "transparent", border: `1px dashed ${t.border1}`,
          color: t.textTertiary, cursor: "pointer", width: "100%",
          padding: "4px 6px", fontSize: 9, letterSpacing: "0.16em",
          fontFamily: fonts.inter, textTransform: "uppercase",
        }}>+ Nova</button>
      </div>
      <div style={{ flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
        {loading && itens.length === 0 && (
          <div style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.18em", textAlign: "center", padding: 12, textTransform: "uppercase" }}>…</div>
        )}
        {itens.map(a => (
          <CardAgenda key={a.id} a={a} t={t} comData onEdit={() => onEdit(a)} onStatus={(s) => onStatus(a, s)} />
        ))}
      </div>
    </div>
  );
}

function ColunaDia({ data, label, itens, t, loading, onAdd, onEdit, onStatus, onDropAgenda, onDropObra }: {
  data: Date; label: string; itens: Agenda[]; t: any; loading: boolean;
  onAdd: () => void;
  onEdit: (a: Agenda) => void;
  onStatus: (a: Agenda, s: AgendaStatus) => void;
  onDropAgenda: (agendaId: string) => void;
  onDropObra: (projetoId: string) => void;
}) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const isHoje = data.getTime() === hoje.getTime();
  const isPassado = data.getTime() < hoje.getTime();
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        try {
          const d = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (d.kind === "agenda" && d.id) onDropAgenda(d.id);
          else if (d.kind === "obra" && d.projetoId) onDropObra(d.projetoId);
        } catch { /* drop de fora — ignora */ }
      }}
      style={{
      background: dragOver ? t.card2 : t.card1,
      border: `1px solid ${dragOver ? t.accent : (isHoje ? t.borderHover : t.border1)}`,
      borderTop: `3px solid ${isHoje || dragOver ? t.accent : (isPassado ? t.border1 : t.borderHover)}`,
      display: "flex", flexDirection: "column", minHeight: 400,
      transition: "background 0.1s, border-color 0.1s",
    }}>
      {/* header do dia */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: isHoje ? t.accent : t.textSecondary }}>
            {label} · {fmtDataCurta(data)}
          </span>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 11, color: t.textPrimary, fontVariantNumeric: "tabular-nums" as any }}>
            {itens.length}
          </span>
        </div>
        <button onClick={onAdd} style={{
          marginTop: 6, background: "transparent", border: `1px dashed ${t.border1}`,
          color: t.textTertiary, cursor: "pointer", width: "100%",
          padding: "4px 6px", fontSize: 9, letterSpacing: "0.16em",
          fontFamily: fonts.inter, textTransform: "uppercase",
        }}>+ Nova</button>
      </div>

      {/* cards */}
      <div style={{ flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
        {loading && itens.length === 0 && (
          <div style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.18em", textAlign: "center", padding: 12, textTransform: "uppercase" }}>…</div>
        )}
        {itens.map(a => (
          <CardAgenda key={a.id} a={a} t={t} onEdit={() => onEdit(a)} onStatus={(s) => onStatus(a, s)} />
        ))}
      </div>
    </div>
  );
}

function CardAgenda({ a, t, onEdit, onStatus, comData }: {
  a: Agenda; t: any; onEdit: () => void; onStatus: (s: AgendaStatus) => void; comData?: boolean;
}) {
  const cor = corDoStatus(a.status, t);
  const horaSo = new Date(a.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hora = comData
    ? `${new Date(a.data_inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${horaSo}`
    : horaSo;
  return (
    <div onClick={onEdit}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "agenda", id: a.id }));
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{
      background: t.card2, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
      padding: "6px 8px", cursor: "grab",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase", color: cor }}>
          {TIPO_LABEL[a.tipo]}
        </span>
        <span style={{ fontSize: 9, color: t.textTertiary, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em" }}>{hora}</span>
      </div>
      <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
        <span style={{
          fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "2px 5px",
          color: a.online ? "#4A7FA5" : t.textTertiary,
          border: `1px solid ${a.online ? "#4A7FA5" : t.border1}`,
          background: a.online ? "rgba(74,127,165,0.10)" : "transparent",
        }}>{a.online ? "Online" : "Presencial"}</span>
        {(a.tags || []).map(tag => (
          <span key={tag} style={{
            fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "2px 5px",
            color: "#8A7350",
            border: "1px solid #8A7350",
            background: "rgba(138,115,80,0.10)",
          }}>{tag}</span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.textPrimary, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {a.cliente || a.obra || "—"}
      </div>
      {a.fiscal_nome && (
        <div style={{ fontSize: 9, color: t.textSecondary, marginTop: 2, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.fiscal_nome}
        </div>
      )}
      <select value={a.status} onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatus(e.target.value as AgendaStatus)}
        style={{
          marginTop: 4, width: "100%", background: "transparent", color: cor,
          border: `1px solid ${t.border1}`, padding: "3px 6px",
          fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
          fontFamily: fonts.inter, outline: "none",
        }}>
        {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

// ─── Modal criar/editar vistoria ────────────────────
export function AgendaModal({ initial, diaSugerido, fiscais, projetoIdInicial, cardIdInicial, fiscalIdInicial, onlineInicial, onClose, onSaved, onDelete }: {
  initial: Agenda | null;
  diaSugerido: Date | null;
  fiscais: Fiscal[];
  /** Se vier de um card de projeto, já pré-seleciona (aba Laudos & Vistorias do projeto). */
  projetoIdInicial?: string | null;
  cardIdInicial?: string | null;
  fiscalIdInicial?: string | null;
  onlineInicial?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const t = useTokens();
  const iso = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}T09:00`;
  };
  const [tipo, setTipo] = useState<AgendaTipo>(initial?.tipo || "1vistoria");
  const [dataInicio, setDataInicio] = useState(
    initial ? initial.data_inicio.slice(0, 16)
            : diaSugerido ? iso(diaSugerido) : iso(new Date())
  );
  const [fiscalId, setFiscalId] = useState(initial?.fiscal_id || fiscalIdInicial || "");
  const [obra, setObra] = useState(initial?.obra || "");
  const [cliente, setCliente] = useState(initial?.cliente || "");
  const [endereco, setEndereco] = useState(initial?.endereco || "");
  const [notas, setNotas] = useState(initial?.notas || "");
  const [status, setStatus] = useState<AgendaStatus>(initial?.status || "agendado");
  const [online, setOnline] = useState<boolean>(initial?.online ?? onlineInicial ?? false);
  // Online não força mais a coluna Acompanhamento Online: default é ficar no dia,
  // exceto quando o modal foi aberto pela própria coluna Online (onlineInicial).
  const [noCalendario, setNoCalendario] = useState<boolean>(
    initial ? (initial.online ? !!initial.no_calendario : true) : !(onlineInicial ?? false)
  );
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [novaTag, setNovaTag] = useState("");
  // Anexos do agendamento (projeto anexado, o que foi vendido…). Upload sobe
  // na hora pro bucket fiscal-anexos; a lista só é gravada no Salvar.
  const [anexos, setAnexos] = useState<AgendaAnexo[]>(initial?.attachments || []);
  const [subindoAnexo, setSubindoAnexo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const subirAnexos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubindoAnexo(true); setErro(null);
    try {
      for (const f of Array.from(files)) {
        const meta = await api.agendaAnexoUpload(f);
        setAnexos(prev => [...prev, meta]);
      }
    } catch (e: any) {
      setErro(`Falha no upload do anexo: ${String(e?.message || e)}`);
    } finally {
      setSubindoAnexo(false);
    }
  };

  // ── Combobox de Projetos (gestao.projetos) — sincroniza com o Kanban do Space ──
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [projetoId, setProjetoId] = useState<string>(projetoIdInicial || "");
  const [cardIdManual, setCardIdManual] = useState<string | null>(initial?.card_id || cardIdInicial || null);

  useEffect(() => {
    api.projetosLista().then((list) => {
      setProjetos(list);
      // Autopreenche cliente/obra/endereço se veio de projeto pré-selecionado
      if (projetoIdInicial) {
        const p = list.find(x => x.id === projetoIdInicial);
        if (p) {
          if (!cliente) setCliente(p.cliente || "");
          if (!obra) setObra(p.obra_code || "");
          if (!endereco) setEndereco(p.endereco || "");
          if (!cardIdManual) setCardIdManual(p.card_id);
        }
      }
    }).catch(() => setProjetos([]));
  }, []); // eslint-disable-line

  // Ao carregar em modo "editar", tenta detectar qual projeto casa com card_id
  useEffect(() => {
    if (initial?.card_id && projetos.length > 0) {
      const p = projetos.find(x => x.card_id === initial.card_id);
      if (p) setProjetoId(p.id);
    }
  }, [initial?.card_id, projetos.length]); // eslint-disable-line

  const selecionarProjeto = (pid: string) => {
    setProjetoId(pid);
    if (!pid) { setCardIdManual(null); return; }
    const p = projetos.find(x => x.id === pid);
    if (!p) return;
    setCliente(p.cliente || "");
    setObra(p.obra_code || "");
    setEndereco(p.endereco || "");
    setCardIdManual(p.card_id);
  };

  const salvar = async () => {
    if (!dataInicio) { setErro("Data/hora é obrigatória."); return; }
    setSaving(true); setErro(null);
    const payload: AgendaInput = {
      tipo, data_inicio: new Date(dataInicio).toISOString(),
      fiscal_id: fiscalId || null,
      card_id: cardIdManual,        // sincroniza com o Kanban do Space
      obra: obra.trim() || null,
      cliente: cliente.trim() || null,
      endereco: endereco.trim() || null,
      notas: notas.trim() || null,
      status,
      online,
      no_calendario: online ? noCalendario : false,
      tags,
      attachments: anexos,
    };
    try {
      if (initial) await api.agendaPatch(initial.id, payload);
      else         await api.agendaCreate(payload);
      onSaved();
    } catch (e: any) {
      setErro(String(e?.message || e));
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: (t as any).overlay || "rgba(0,0,0,0.55)",
      display: "grid", placeItems: "center", zIndex: 100, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(560px, 96vw)", background: t.bg, border: `1px solid ${t.border2}`,
        padding: 24, fontFamily: fonts.inter,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary, marginBottom: 4 }}>
          {initial ? "Editar vistoria" : "Nova vistoria"}
        </div>
        <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
          public.fiscal_agenda · compartilhada com o Space
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo t={t} label="Tipo *">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as AgendaTipo)} style={inputStyle(t)}>
                {TIPOS.map(x => <option key={x} value={x}>{TIPO_LABEL[x]}</option>)}
              </select>
            </Campo>
            <Campo t={t} label="Data / Hora *">
              <input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={inputStyle(t)} />
            </Campo>
          </div>
          {/* Projeto (Kanban) — combobox principal: selecionar aqui autopreenche cliente/obra/endereço e o card_id */}
          <Campo t={t} label="Projeto / Cliente (Kanban) *">
            <select value={projetoId} onChange={(e) => selecionarProjeto(e.target.value)} style={inputStyle(t)}>
              <option value="">— selecionar projeto —</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.cliente}
                  {p.obra_code ? ` · ${p.obra_code}` : ""}
                  {p.numero_proposta ? ` · #${p.numero_proposta}` : ""}
                </option>
              ))}
            </select>
          </Campo>

          {/* Campos autopreenchidos — visíveis + editáveis (fallback pra vistorias sem projeto) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo t={t} label="Cliente">
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} style={inputStyle(t)} placeholder="Nome do cliente" />
            </Campo>
            <Campo t={t} label="Obra">
              <input value={obra} onChange={(e) => setObra(e.target.value)} style={inputStyle(t)} placeholder="Nome da obra / código" />
            </Campo>
          </div>
          <Campo t={t} label="Endereço">
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} style={inputStyle(t)} placeholder="Endereço da obra" />
          </Campo>
          {cardIdManual && (
            <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase", color: t.accent, padding: "6px 0" }}>
              Vinculado ao Kanban · card_id {cardIdManual.slice(0, 8)}…
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Campo t={t} label="Fiscal">
              <select value={fiscalId} onChange={(e) => setFiscalId(e.target.value)} style={inputStyle(t)}>
                <option value="">— não atribuído —</option>
                {fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Campo>
            <Campo t={t} label="Modalidade">
              <select value={online ? "online" : "presencial"} onChange={(e) => setOnline(e.target.value === "online")} style={inputStyle(t)}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </Campo>
            <Campo t={t} label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as AgendaStatus)} style={inputStyle(t)}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>
          </div>
          {online && (
            <Campo t={t} label="Posição no kanban">
              <select
                value={noCalendario ? "dia" : "coluna"}
                onChange={(e) => setNoCalendario(e.target.value === "dia")}
                style={inputStyle(t)}
              >
                <option value="dia">No dia do calendário</option>
                <option value="coluna">Coluna Acompanhamento Online</option>
              </select>
            </Campo>
          )}
          <Campo t={t} label="Tags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {[...TAGS_PADRAO, ...tags.filter(x => !TAGS_PADRAO.includes(x))].map(tag => {
                const ativa = tags.includes(tag);
                return (
                  <button key={tag} type="button"
                    onClick={() => setTags(prev => ativa ? prev.filter(x => x !== tag) : [...prev, tag])}
                    style={{
                      fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
                      padding: "4px 8px", cursor: "pointer",
                      color: ativa ? "#fff" : t.textSecondary,
                      background: ativa ? t.accent : "transparent",
                      border: `1px solid ${ativa ? t.accent : t.border1}`,
                    }}>{tag}</button>
                );
              })}
              <input
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = novaTag.trim();
                    if (v && !tags.some(x => x.toLowerCase() === v.toLowerCase())) setTags(prev => [...prev, v]);
                    setNovaTag("");
                  }
                }}
                placeholder="+ nova tag (Enter)"
                style={{ ...inputStyle(t), width: 150, flex: "0 0 auto" }}
              />
            </div>
          </Campo>
          <Campo t={t} label="Notas">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} style={{ ...inputStyle(t), resize: "vertical", fontFamily: fonts.inter }} placeholder="Observações" />
          </Campo>
          {/* Anexos: PDF/imagem do projeto e do que foi vendido — o fiscal vê no Verifica */}
          <Campo t={t} label="Anexos (projeto, proposta…)">
            <div style={{ display: "grid", gap: 6 }}>
              {anexos.map((a, i) => (
                <div key={`${a.url}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: `1px solid ${t.border1}`, padding: "6px 10px",
                }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{
                    flex: 1, fontSize: 11, color: t.textPrimary, textDecoration: "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.nome}
                    {a.size ? <span style={{ color: t.textTertiary }}> · {(a.size / 1024 / 1024).toFixed(1)}MB</span> : null}
                  </a>
                  <button type="button" onClick={() => setAnexos(prev => prev.filter((_, k) => k !== i))} style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "#B85B4C", fontFamily: fonts.cinzel, fontSize: 9,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                  }}>Remover</button>
                </div>
              ))}
              <label style={{
                border: `1px dashed ${t.border1}`, padding: "8px 10px", cursor: subindoAnexo ? "wait" : "pointer",
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                color: t.textSecondary, textAlign: "center" as const, opacity: subindoAnexo ? 0.5 : 1,
              }}>
                {subindoAnexo ? "Enviando…" : "+ Adicionar arquivo (PDF, imagem)"}
                <input type="file" multiple accept="application/pdf,image/*" disabled={subindoAnexo}
                  onChange={(e) => { subirAnexos(e.target.files); e.target.value = ""; }}
                  style={{ display: "none" }} />
              </label>
            </div>
          </Campo>
        </div>

        {erro && (
          <div style={{ fontSize: 10, color: "#B85B4C", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 14 }}>
            ⚠ {erro}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 22 }}>
          <div>
            {onDelete && (
              <button onClick={onDelete} disabled={saving} style={{
                ...btnSecundario(t), color: "#B85B4C", borderColor: "#B85B4C",
              }}>Excluir</button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} disabled={saving} style={btnSecundario(t)}>Cancelar</button>
            <button onClick={salvar} disabled={saving} style={{
              ...btnPrimario(t), opacity: saving ? 0.5 : 1, cursor: saving ? "wait" : "pointer",
            }}>{saving ? "Salvando…" : initial ? "Salvar" : "Agendar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, v, t, corValor }: { label: string; v: number; t: any; corValor?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "4px 8px",
    }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 20, color: corValor || t.textPrimary,
        marginTop: 4, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em",
      }}>
        {v}
      </div>
    </div>
  );
}

function navBtn(t: any): React.CSSProperties {
  return {
    background: "transparent", border: `1px solid ${t.border1}`,
    color: t.textSecondary, cursor: "pointer",
    padding: "6px 10px", fontSize: 12, fontFamily: fonts.cinzel,
    letterSpacing: "0.18em",
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers de estilo
// ═══════════════════════════════════════════════════════════════════

function Campo({ t, label, children }: { t: any; label: string; children: any }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{
        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.24em",
        textTransform: "uppercase", color: t.textTertiary,
      }}>{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, v, t, accent }: { label: string; v: number; t: any; accent?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "4px 8px",
    }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 22, fontVariantNumeric: "tabular-nums" as any,
        letterSpacing: "0.04em", color: accent ? t.accent : t.textPrimary, marginTop: 4,
      }}>
        {v}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FISCAL · Modal de projetos vinculados
// Aberto ao clicar em qualquer linha do Equipe.
// Vínculo persiste em kanban_cards.details.fiscais[] (via /api/fiscal/equipe/{fid}/projetos).
// ═══════════════════════════════════════════════════════════════════

function FiscalProjetosModal({ fiscal, onClose }: {
  fiscal: Fiscal; onClose: () => void;
}) {
  const t = useTokens();
  const [vinculados, setVinculados] = useState<ProjetoResumo[]>([]);
  const [todos, setTodos] = useState<ProjetoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adicionar, setAdicionar] = useState(false);
  const [busca, setBusca] = useState("");

  const load = () => {
    setLoading(true);
    api.fiscalProjetos(fiscal.id)
      .then(setVinculados)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [fiscal.id]);
  useEffect(() => {
    api.projetosLista().then(setTodos).catch(() => setTodos([]));
  }, []);

  const disponiveis = useMemo(() => {
    const linked = new Set(vinculados.map(p => p.id));
    const query = busca.trim().toLowerCase();
    return todos.filter(p => {
      if (linked.has(p.id)) return false;
      if (!query) return true;
      return (
        (p.cliente || "").toLowerCase().includes(query) ||
        (p.obra_code || "").toLowerCase().includes(query) ||
        (p.numero_proposta || "").toLowerCase().includes(query) ||
        (p.endereco || "").toLowerCase().includes(query)
      );
    });
  }, [todos, vinculados, busca]);

  const vincular = async (pid: string) => {
    try {
      await api.fiscalProjetoAdd(fiscal.id, pid);
      setBusca("");
      load();
    } catch (e) { console.error(e); }
  };

  const desvincular = async (p: ProjetoResumo) => {
    if (!confirm(`Desvincular "${p.cliente}" de ${fiscal.nome}?`)) return;
    try {
      await api.fiscalProjetoDel(fiscal.id, p.id);
      load();
    } catch (e) { console.error(e); }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, border: `1px solid ${t.border2}`,
        maxWidth: 780, width: "100%", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px 14px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: t.accent, marginBottom: 4,
            }}>
              Projetos do Fiscal
            </div>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 18, letterSpacing: "0.12em",
              textTransform: "uppercase", color: t.textPrimary,
            }}>
              {fiscal.nome}
            </div>
            <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 4, letterSpacing: "0.04em" }}>
              {fiscal.email || "—"}
              {fiscal.telefone && <span>{"  ·  "}{fiscal.telefone}</span>}
            </div>
          </div>
          <button onClick={onClose} style={btnSecundario(t)}>Fechar</button>
        </div>

        {/* Métricas */}
        <div style={{
          padding: "10px 24px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", gap: 24, background: t.card1,
        }}>
          <Kpi label="Projetos vinculados" v={vinculados.length} t={t} accent />
          <Kpi label="Disponíveis" v={disponiveis.length} t={t} />
          <div style={{ flex: 1 }} />
          {!adicionar && (
            <button onClick={() => setAdicionar(true)} style={{
              background: t.card2, color: t.accent,
              border: `1px solid ${t.accent}`, padding: "8px 16px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", cursor: "pointer", alignSelf: "center",
            }}>+ Vincular obra</button>
          )}
        </div>

        {/* Body */}
        <div style={{ overflow: "auto", flex: 1, padding: "14px 20px 20px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              carregando…
            </div>
          ) : (
            <>
              {adicionar && (
                <div style={{
                  background: t.card1, border: `1px solid ${t.border2}`, padding: 14, marginBottom: 14,
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar projeto por cliente, obra ou nº proposta…"
                      style={{ ...inputStyle(t), flex: 1 }}
                      autoFocus
                    />
                    <button onClick={() => { setAdicionar(false); setBusca(""); }} style={btnSecundario(t)}>
                      Fechar
                    </button>
                  </div>
                  <div style={{
                    display: "grid", gap: 4, maxHeight: 320, overflow: "auto",
                  }}>
                    {disponiveis.slice(0, 30).map(p => (
                      <button key={p.id}
                        onClick={() => vincular(p.id)}
                        style={{
                          textAlign: "left", padding: "8px 12px",
                          background: t.card2, color: t.textPrimary,
                          border: `1px solid ${t.border1}`, borderLeft: `3px solid ${t.accent}`,
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 12, alignItems: "center",
                        }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.cliente || p.obra_code || "?"}
                          </div>
                          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: t.textTertiary, marginTop: 3, textTransform: "uppercase" }}>
                            {p.numero_proposta && <span>#{p.numero_proposta}</span>}
                            {p.numero_proposta && p.endereco && <span>{"  ·  "}</span>}
                            {p.endereco && <span>{p.endereco}</span>}
                          </div>
                        </div>
                        <span style={{
                          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                          textTransform: "uppercase", color: t.accent,
                        }}>+ vincular</span>
                      </button>
                    ))}
                    {disponiveis.length === 0 && (
                      <div style={{ padding: 12, color: t.textTertiary, fontSize: 10 }}>
                        {todos.length === 0
                          ? "Nenhum projeto disponível ainda."
                          : busca
                            ? "Nenhum resultado pra essa busca."
                            : "Todos os projetos já foram vinculados."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {vinculados.length === 0 ? (
                <div style={{
                  background: t.card1, border: `1px dashed ${t.border1}`,
                  padding: "24px 16px", textAlign: "center", marginBottom: 14,
                  fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
                }}>
                  Nenhum projeto vinculado ainda
                </div>
              ) : (
                <div style={{ display: "grid", gap: 4, marginBottom: 14 }}>
                  {vinculados.map(p => (
                    <ProjetoVinculadoRow key={p.id} p={p} t={t} onDesvincular={() => desvincular(p)} />
                  ))}
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjetoVinculadoRow({ p, t, onDesvincular }: {
  p: ProjetoResumo; t: any; onDesvincular: () => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center",
      padding: "10px 14px",
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${t.accent}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <Link to={`/projetos/${p.id}`} style={{
          fontSize: 12, color: t.textPrimary, textDecoration: "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
        }}>
          {p.cliente || p.obra_code || "?"} →
        </Link>
        <div style={{ fontSize: 8, letterSpacing: "0.14em", color: t.textTertiary, marginTop: 3, textTransform: "uppercase", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.numero_proposta && <span>#{p.numero_proposta}</span>}
          {p.obra_code && <span>{p.obra_code}</span>}
          {p.endereco && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>{p.endereco}</span>}
        </div>
      </div>
      <button onClick={onDesvincular} title="Desvincular"
        style={{
          background: "transparent", color: "#B85B4C",
          border: `1px solid #B85B4C`, padding: "5px 10px",
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
          textTransform: "uppercase", cursor: "pointer",
        }}>× desvincular</button>
    </div>
  );
}

function inputStyle(t: any): React.CSSProperties {
  return {
    background: t.inputBg, border: `1px solid ${t.border1}`,
    color: t.textPrimary, outline: "none",
    padding: "8px 12px", fontSize: 11, letterSpacing: "0.04em",
    fontFamily: fonts.inter,
    width: "100%", boxSizing: "border-box", minWidth: 0,
  };
}

function btnPrimario(t: any): React.CSSProperties {
  return {
    background: t.accent, color: t.bg, border: "none",
    padding: "9px 16px",
    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
    textTransform: "uppercase", cursor: "pointer",
  };
}

function btnSecundario(t: any): React.CSSProperties {
  return {
    background: "transparent", color: t.textSecondary,
    border: `1px solid ${t.border1}`, padding: "6px 10px",
    fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.18em",
    textTransform: "uppercase", cursor: "pointer",
  };
}

// ═══════════════════════════════════════════════════════════════════
// GESTÃO DE LAUDOS — lista todos os fiscal_laudos com filtros + link projeto
// ═══════════════════════════════════════════════════════════════════

const TIPOS_LAUDO_MENU: Array<{ id: string; label: string }> = [
  { id: "",                label: "Todos os tipos" },
  { id: "1vistoria",       label: "1ª Vistoria" },
  { id: "2vistoria",       label: "2ª Vistoria" },
  { id: "acompanhamento",  label: "Acompanhamento" },
  { id: "entrega",         label: "Entrega" },
  { id: "reparo",          label: "Reparo" },
  { id: "termo",           label: "Termo de Responsabilidade" },
  { id: "fotografico",     label: "Relatório Fotográfico" },
];
const STATUS_LAUDO_MENU: Array<{ id: string; label: string }> = [
  { id: "",              label: "Todos os status" },
  { id: "pendente",      label: "Pendente" },
  { id: "agendado",      label: "Agendado" },
  { id: "em_andamento",  label: "Em andamento" },
  { id: "concluido",     label: "Concluído" },
  { id: "cancelado",     label: "Cancelado" },
];

function corLaudoStatus(s: string, t: any): string {
  const st = (s || "").toLowerCase();
  if (st === "concluido")    return t.accent;
  if (st === "em_andamento") return "#C7A45B";
  if (st === "agendado")     return "#8CA9B8";
  if (st === "cancelado")    return "#5F5D58";
  return "#B85B4C"; // pendente
}
function fmtDataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function GestaoLaudosTab() {
  const t = useTokens();
  const [q, setQ] = useState("");
  const [fiscalId, setFiscalId] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<LaudoAll[]>([]);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [laudoAberto, setLaudoAberto] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.laudosAll({
      q: q || undefined,
      fiscal_id: fiscalId || undefined,
      tipo: tipo || undefined,
      status: status || undefined,
    }).then(setItems).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { const id = setTimeout(load, 220); return () => clearTimeout(id); },
    [q, fiscalId, tipo, status]);
  useEffect(() => { api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([])); }, []);

  const stats = useMemo(() => ({
    total:       items.length,
    concluidos:  items.filter(l => l.status === "concluido").length,
    andamento:   items.filter(l => l.status === "em_andamento").length,
    vinculados:  items.filter(l => l.projeto_id).length,
  }), [items]);

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* Barra de filtros — 2 linhas estruturadas (mesmo padrão do Kanban Semanal):
          Linha 1 (métricas):  4 KPIs em grid uniforme (Laudos, Concluídos, Em curso, Vinculados)
          Linha 2 (controles): busca livre à esquerda, 3 dropdowns à direita (Fiscal / Tipo / Status) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {/* Linha 1 — Métricas */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8, padding: "12px 16px",
          background: t.card1, border: `1px solid ${t.border1}`,
        }}>
          <Kpi label="Laudos"     v={stats.total}      t={t} />
          <Kpi label="Concluídos" v={stats.concluidos} t={t} accent />
          <Kpi label="Em curso"   v={stats.andamento}  t={t} />
          <Kpi label="Vinculados" v={stats.vinculados} t={t} />
        </div>

        {/* Linha 2 — Controles: busca (esquerda expande) + 3 filtros (direita fixa) */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="BUSCAR CLIENTE / OBRA / ENDEREÇO"
            style={{ ...inputStyle(t), flex: "1 1 240px", minWidth: 220, maxWidth: 380 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <select value={fiscalId} onChange={(e) => setFiscalId(e.target.value)} style={{ ...inputStyle(t), width: 180, flex: "0 0 auto" }}>
              <option value="">TODOS OS FISCAIS</option>
              {fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>

            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...inputStyle(t), width: 160, flex: "0 0 auto" }}>
              {TIPOS_LAUDO_MENU.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle(t), width: 160, flex: "0 0 auto" }}>
              {STATUS_LAUDO_MENU.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Header + Lista */}
      <LaudoAllHead t={t} />
      {loading && (
        <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          carregando…
        </div>
      )}
      {!loading && items.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          nenhum laudo encontrado
        </div>
      )}
      <div style={{ display: "grid", gap: 2 }}>
        {items.map(l => <LaudoAllRow key={l.id} l={l} t={t} onOpen={() => setLaudoAberto(l.id)} />)}
      </div>

      {laudoAberto && (
        <LaudoDetalheModal laudoId={laudoAberto} onClose={() => setLaudoAberto(null)} />
      )}
    </section>
  );
}

function LaudoAllHead({ t }: { t: any }) {
  const c: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
    textTransform: "uppercase", color: t.textTertiary,
  };
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "130px 1.6fr 1.2fr 90px 110px 110px 90px",
      gap: 12, padding: "8px 12px", background: t.card1,
      borderBottom: `1px solid ${t.border1}`, alignItems: "center",
    }}>
      <span style={c}>Tipo</span>
      <span style={c}>Cliente / Obra</span>
      <span style={c}>Fiscal</span>
      <span style={c}>Data</span>
      <span style={c}>Setor</span>
      <span style={c}>Projeto</span>
      <span style={c}>Status</span>
    </div>
  );
}

function LaudoAllRow({ l, t, onOpen }: { l: LaudoAll; t: any; onOpen: () => void }) {
  const cor = corLaudoStatus(l.status, t);
  return (
    <div onClick={onOpen} style={{
      display: "grid",
      gridTemplateColumns: "130px 1.6fr 1.2fr 90px 110px 110px 90px",
      gap: 12, padding: "10px 12px", alignItems: "center",
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
      cursor: "pointer", transition: "background 120ms",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = t.card2; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = t.card1; }}
    >
      <div>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor }}>
          {TIPO_LABEL[l.tipo as AgendaTipo] || l.tipo}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {l.cliente || l.obra || "—"}
        </div>
        {l.endereco && (
          <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.endereco}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {l.fiscal_nome || "—"}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, fontVariantNumeric: "tabular-nums" as any }}>
        {fmtDataBR(l.data_vistoria || l.data_agendamento || l.created_at)}
      </div>
      <div style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.10em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {l.setor || "—"}
      </div>
      <div>
        {l.projeto_id ? (
          <Link to={`/projetos/${l.projeto_id}`} onClick={(e) => e.stopPropagation()} style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            color: t.accent, textDecoration: "none",
            border: `1px solid ${t.borderHover}`, padding: "4px 8px",
          }}>Abrir →</Link>
        ) : (
          <span style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>—</span>
        )}
      </div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor, textAlign: "right" }}>
        {l.status}
      </div>
    </div>
  );
}
