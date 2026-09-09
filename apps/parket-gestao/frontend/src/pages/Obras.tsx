import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import {
  api,
  type EquipeParket,
  type EquipeInput,
  type CronogramaRow,
  type CronogramaInput,
  type ProjetoResumo,
  type Item,
  type Fiscal,
} from "../api";
import { produtoHeaderDe } from "./ObraAcompanhamento";

/** Setor Gestão de Obras — prestadores + cronograma.
 *  Reusa public.equipes_parket (mesma tabela do dept-obras do Space + check
 *  diário WhatsApp) e public.cronograma_obras (mesma tabela do
 *  cronograma.parket.works). Editar aqui reflete lá e vice-versa. */

const CATEGORIAS = [
  "Estrutura",
  "Forro/Painel Revestimento",
  "Acabamento",
  "Piso",
  "Escada",
  "Deck",
  "Marcenaria",
  "Marcenaria Acabamento",
  "Brasilia Instalação/Marcenaria",
  "Terceiro Salvador",
  "Reparo",
] as const;

const TIPOS_CRONO = [
  { id: "obras",       label: "Obras" },
  { id: "marcenaria",  label: "Marcenaria" },
  { id: "reparos",     label: "Reparos" },
] as const;

const CATEGORIAS_CRONO = [
  { id: "acompanhamento",   label: "Acompanhamento", cor: "#8CA9B8" },
  { id: "obras_liberadas",  label: "Obras liberadas", cor: "#C7A45B" },
  { id: "cronograma_final", label: "Cronograma final", cor: "#7BA394" },
  { id: "travado",          label: "Travado", cor: "#B85B4C" },
  { id: "finalizadas",      label: "Finalizadas", cor: "#5F5D58" },
] as const;

type TabId = "cronograma" | "prestadores";

export default function ObrasPage() {
  const t = useTokens();
  const nav = useNavigate();
  const sub = (useParams()["*"] || "").split("/")[0];
  const aba: TabId = sub === "prestadores" ? "prestadores" : "cronograma";
  const setAba = (a: TabId) => nav(`/obras/${a}`);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden" }}>
      <div style={{ padding: "20px 32px 14px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 20, letterSpacing: "0.14em",
          textTransform: "uppercase", color: t.textPrimary,
        }}>
          Gestão de Obras
        </div>
        <div style={{
          fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.20em",
          color: t.textTertiary, textTransform: "uppercase", marginTop: 6,
        }}>
          Prestadores + Cronograma · sincronizado com Space e cronograma.parket.works
        </div>
      </div>

      <div style={{
        display: "flex", gap: 4, padding: "0 32px",
        borderBottom: `1px solid ${t.border1}`, background: t.card1,
      }}>
        <TabBtn active={aba === "cronograma"}  onClick={() => setAba("cronograma")}  t={t}>Cronograma</TabBtn>
        <TabBtn active={aba === "prestadores"} onClick={() => setAba("prestadores")} t={t}>Prestadores</TabBtn>
      </div>

      {aba === "cronograma" ? <CronogramaTab /> : <PrestadoresTab />}
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
// PRESTADORES — cards com todas as informações + CRUD
// ═══════════════════════════════════════════════════════════════════

function PrestadoresTab() {
  const t = useTokens();
  const [items, setItems] = useState<EquipeParket[]>([]);
  const [q, setQ] = useState("");
  const [showInativos, setShowInativos] = useState(false);
  const [categoria, setCategoria] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: "novo" } | { kind: "editar"; e: EquipeParket } | null>(null);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (q) params.q = q;
    if (!showInativos) params.ativo = true;
    if (categoria) params.categoria = categoria;
    api.equipesList(params)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [q, showInativos, categoria]);

  const stats = useMemo(() => {
    const ativos = items.filter(i => i.ativo);
    return {
      total: items.length,
      ativos: ativos.length,
      checks: ativos.reduce((s, i) => s + (i.total_checks || 0), 0),
      pct_medio: ativos.length
        ? Math.round(ativos.reduce((s, i) => s + Number(i.pct_ok || 0), 0) / ativos.length)
        : 0,
    };
  }, [items]);

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* Métricas */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        padding: "12px 16px", background: t.card1, border: `1px solid ${t.border1}`,
        marginBottom: 12,
      }}>
        <MiniStat label="Prestadores" v={stats.total} t={t} />
        <MiniStat label="Ativos" v={stats.ativos} t={t} corValor={t.accent} />
        <MiniStat label="Checks totais" v={stats.checks} t={t} />
        <MiniStat label="% OK médio" v={`${stats.pct_medio}%`} t={t} corValor="#7BA394" />
      </div>

      {/* Controles */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 220px auto auto",
        gap: 8, marginBottom: 18, alignItems: "center",
      }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          style={inputStyle(t)}
        />
        <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle(t)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em",
          textTransform: "uppercase", color: t.textSecondary, cursor: "pointer",
          padding: "8px 12px", border: `1px solid ${t.border1}`, background: t.card1,
        }}>
          <input type="checkbox" checked={showInativos} onChange={e => setShowInativos(e.target.checked)} />
          Inativos
        </label>
        <button onClick={() => setModal({ kind: "novo" })} style={btnPrimary(t)}>
          + Novo prestador
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
          carregando…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          background: t.card1, border: `1px dashed ${t.border1}`,
          padding: "24px 16px", textAlign: "center",
          fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
        }}>
          Nenhum prestador nesse filtro
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 10,
        }}>
          {items.map(e => (
            <PrestadorCard key={e.id} e={e} t={t}
              onEdit={() => setModal({ kind: "editar", e })}
              onToggleAtivo={async () => {
                await api.equipePatch(e.id, { ativo: !e.ativo });
                load();
              }}
            />
          ))}
        </div>
      )}

      {modal && (
        <EquipeModal
          initial={modal.kind === "editar" ? modal.e : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </section>
  );
}

function PrestadorCard({ e, t, onEdit, onToggleAtivo }: {
  e: EquipeParket; t: any; onEdit: () => void; onToggleAtivo: () => void;
}) {
  const corCategoria = categoriaCor(e.categoria);
  const pct = Number(e.pct_ok || 0);
  const corPct = pct >= 80 ? "#7BA394" : pct >= 50 ? "#C7A45B" : "#B85B4C";
  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`,
      borderLeft: `3px solid ${e.ativo ? corCategoria : t.border1}`,
      padding: "12px 14px 10px", display: "flex", flexDirection: "column", gap: 10,
      opacity: e.ativo ? 1 : 0.55,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
            textTransform: "uppercase", color: corCategoria,
          }}>
            {e.categoria}
          </div>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.08em",
            color: t.textPrimary, marginTop: 3, textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {e.nome}
          </div>
          {e.telefone && (
            <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 3, letterSpacing: "0.04em" }}>
              {e.telefone}
            </div>
          )}
        </div>
        {!e.ativo && (
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
            textTransform: "uppercase", color: t.textTertiary,
            padding: "2px 6px", border: `1px solid ${t.border1}`,
          }}>Inativo</div>
        )}
      </div>

      {/* Grid de stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        padding: "8px 0 6px", borderTop: `1px solid ${t.border1}`,
      }}>
        <StatMini label="% OK" v={`${Math.round(pct)}%`} t={t} cor={corPct} />
        <StatMini label="Checks" v={e.total_checks} t={t} />
        <StatMini label="Ocorr." v={e.total_ocorrencias} t={t} cor={e.total_ocorrencias > 0 ? "#B85B4C" : undefined} />
        <StatMini label="Obras" v={e.obras_distintas} t={t} />
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: `1px solid ${t.border1}`, paddingTop: 8, gap: 6, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 8, letterSpacing: "0.18em", color: t.textTertiary, textTransform: "uppercase" }}>
          {e.ultimo_check ? `Último · ${fmtD(e.ultimo_check)}` : "Sem check ainda"}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onToggleAtivo} style={btnGhost(t)}>
            {e.ativo ? "Desativar" : "Reativar"}
          </button>
          <button onClick={onEdit} style={btnAccent(t)}>Editar</button>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, v, t, cor }: { label: string; v: any; t: any; cor?: string }) {
  return (
    <div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 13, color: cor || t.textPrimary,
        marginTop: 2, fontVariantNumeric: "tabular-nums" as any,
      }}>{v}</div>
    </div>
  );
}

function EquipeModal({ initial, onClose, onSaved }: {
  initial: EquipeParket | null; onClose: () => void; onSaved: () => void;
}) {
  const t = useTokens();
  const [nome, setNome] = useState(initial?.nome || "");
  const [telefone, setTelefone] = useState(initial?.telefone || "");
  const [categoria, setCategoria] = useState(initial?.categoria || CATEGORIAS[0]);
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const save = async () => {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    setErro(null);
    setSaving(true);
    try {
      const payload: EquipeInput = {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        categoria,
        ativo,
      };
      if (initial) await api.equipePatch(initial.id, payload);
      else await api.equipeCreate(payload);
      onSaved();
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, border: `1px solid ${t.border2}`, maxWidth: 480, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border1}` }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary }}>
            {initial ? "Editar Prestador" : "Novo Prestador"}
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          <Field label="Nome" t={t}>
            <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle(t)} autoFocus />
          </Field>
          <Field label="Categoria" t={t}>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle(t)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Telefone" t={t}>
            <input value={telefone} onChange={e => setTelefone(e.target.value)}
              placeholder="11 99999-9999" style={inputStyle(t)} />
          </Field>
          <label style={{
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em",
            textTransform: "uppercase", color: t.textSecondary,
          }}>
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            Ativo
          </label>
          {erro && <div style={{ fontSize: 10, color: "#B85B4C" }}>{erro}</div>}
        </div>
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={btnGhost(t)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary(t)}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CRONOGRAMA — tabela editável estilo cronograma.parket.works
// ═══════════════════════════════════════════════════════════════════

function CronogramaTab() {
  const t = useTokens();
  const [tipo, setTipo] = useState<string>("obras");
  const [categoria, setCategoria] = useState<string>("");
  const [projetoId, setProjetoId] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [rows, setRows] = useState<CronogramaRow[]>([]);
  const [equipes, setEquipes] = useState<EquipeParket[]>([]);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: "novo" } | { kind: "editar"; r: CronogramaRow } | null>(null);
  const [itensAberto, setItensAberto] = useState<{ projetoId: string; crono: CronogramaRow } | null>(null);

  const projetoById = useMemo(() => {
    const m = new Map<string, ProjetoResumo>();
    projetos.forEach(p => { if (p.card_id) m.set(p.card_id, p); });
    return m;
  }, [projetos]);

  // Fallback: quando cronograma_obras.card_id não bate com gestao.projetos.card_id
  // (comum enquanto contratos ainda não foram sincronizados via RPC), tenta
  // linkar pelo nome — normaliza pra maiúsculas + remove acentos e pontuação.
  const normalizeNome = (s: string) =>
    s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
     .replace(/[^A-Z0-9 ]/g, "").trim();
  const projetoByNome = useMemo(() => {
    const m = new Map<string, ProjetoResumo>();
    projetos.forEach(p => {
      if (p.cliente) m.set(normalizeNome(p.cliente), p);
    });
    return m;
  }, [projetos]);

  const resolveProjeto = (r: CronogramaRow): ProjetoResumo | null => {
    if (r.card_id) {
      const byCard = projetoById.get(r.card_id);
      if (byCard) return byCard;
    }
    const key = normalizeNome(r.nome_obra || "");
    if (!key) return null;
    // match exato ou startsWith (nomes podem ser abreviados no cronograma)
    if (projetoByNome.has(key)) return projetoByNome.get(key)!;
    for (const [k, p] of projetoByNome) {
      if (k.startsWith(key) || key.startsWith(k)) return p;
    }
    return null;
  };

  const cardIdSelecionado = projetoId ? (projetos.find(p => p.id === projetoId)?.card_id || undefined) : undefined;

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (tipo) params.tipo = tipo;
    if (categoria) params.categoria = categoria;
    if (q) params.q = q;
    if (cardIdSelecionado) params.card_id = cardIdSelecionado;
    api.cronogramaList(params)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [tipo, categoria, projetoId, q]);

  useEffect(() => {
    api.equipesList({ ativo: true }).then(setEquipes).catch(() => setEquipes([]));
    api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([]));
    api.projetosLista().then(setProjetos).catch(() => setProjetos([]));
  }, []);

  const contadores = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of rows) acc[r.categoria] = (acc[r.categoria] || 0) + 1;
    return acc;
  }, [rows]);

  const patchInline = async (id: string, patch: Partial<CronogramaInput>) => {
    await api.cronogramaPatch(id, patch);
    load();
  };

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* Métricas por categoria */}
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${CATEGORIAS_CRONO.length}, 1fr)`,
        gap: 8, padding: "12px 16px",
        background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 12,
      }}>
        {CATEGORIAS_CRONO.map(c => (
          <MiniStat key={c.id} label={c.label} v={contadores[c.id] || 0} t={t} corValor={c.cor} />
        ))}
      </div>

      {/* Controles — linha 1: tipos */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {TIPOS_CRONO.map(x => (
          <PillBtn key={x.id} active={tipo === x.id} onClick={() => setTipo(x.id)} t={t}>
            {x.label}
          </PillBtn>
        ))}
        <div style={{ width: 12 }} />
        <PillBtn active={categoria === ""} onClick={() => setCategoria("")} t={t}>Todas</PillBtn>
        {CATEGORIAS_CRONO.map(c => (
          <PillBtn key={c.id} active={categoria === c.id} onClick={() => setCategoria(c.id)} t={t}>
            {c.label}
          </PillBtn>
        ))}
      </div>

      {/* Controles — linha 2: busca + projeto + novo */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 260px auto",
        gap: 8, marginBottom: 14, alignItems: "center",
      }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por obra, equipe, fiscal, serviço, local…"
          style={inputStyle(t)}
        />
        <select value={projetoId} onChange={e => setProjetoId(e.target.value)} style={inputStyle(t)}>
          <option value="">Todos os projetos</option>
          {projetos.map(p => (
            <option key={p.id} value={p.id}>
              {p.cliente || p.obra_code || p.numero_proposta || p.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button onClick={() => setModal({ kind: "novo" })} style={btnPrimary(t)}>
          + Nova linha
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
          carregando…
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          background: t.card1, border: `1px dashed ${t.border1}`,
          padding: "24px 16px", textAlign: "center",
          fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
        }}>
          Nenhuma linha no cronograma pra esse filtro
        </div>
      ) : (
        <div style={{
          display: "grid", gap: 4,
        }}>
          <CronogramaHead t={t} />
          {rows.map(r => {
            const proj = resolveProjeto(r);
            return (
            <CronogramaRowView
              key={r.id} r={r} t={t}
              equipes={equipes}
              fiscais={fiscais}
              projetoLabel={proj?.cliente || null}
              projetoIdMap={proj?.id || null}
              onPatch={patch => patchInline(r.id, patch)}
              onEdit={() => setModal({ kind: "editar", r })}
              onAbrirItens={pid => setItensAberto({ projetoId: pid, crono: r })}
              onConcluir={async () => {
                const hoje = new Date().toISOString().slice(0, 10);
                await api.cronogramaPatch(r.id, {
                  categoria: "finalizadas",
                  data_finalizacao: hoje,
                  status_obra: r.status_obra || "concluida",
                });
                load();
              }}
              onDelete={async () => {
                if (!confirm(`Remover "${r.nome_obra}" do cronograma?`)) return;
                await api.cronogramaDelete(r.id);
                load();
              }}
            />
          );
          })}
        </div>
      )}

      {modal && (
        <CronogramaModal
          initial={modal.kind === "editar" ? modal.r : null}
          tipoDefault={tipo}
          categoriaDefault={categoria || "acompanhamento"}
          equipes={equipes}
          fiscais={fiscais}
          projetos={projetos}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {itensAberto && (
        <ItensProjetoModal
          projetoId={itensAberto.projetoId}
          crono={itensAberto.crono}
          equipes={equipes}
          projetos={projetos}
          onClose={() => setItensAberto(null)}
        />
      )}
    </section>
  );
}

const CRONO_COLS = "1.8fr 1.2fr 130px 120px 1fr 120px 120px 180px";

function CronogramaHead({ t }: { t: any }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: CRONO_COLS,
      gap: 8, padding: "8px 12px",
      fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
      textTransform: "uppercase", color: t.textTertiary,
      background: t.card1, border: `1px solid ${t.border1}`,
    }}>
      <div>Obra / Cliente</div>
      <div>Equipe</div>
      <div>Fiscal</div>
      <div>Serviço</div>
      <div>Local · Contrato</div>
      <div>Início</div>
      <div>Término</div>
      <div style={{ textAlign: "right" }}>Ações</div>
    </div>
  );
}

function CronogramaRowView({ r, t, equipes, fiscais, projetoLabel, projetoIdMap, onPatch, onEdit, onDelete, onConcluir, onAbrirItens }: {
  r: CronogramaRow; t: any; equipes: EquipeParket[]; fiscais: Fiscal[];
  projetoLabel: string | null; projetoIdMap: string | null;
  onPatch: (patch: Partial<CronogramaInput>) => void;
  onEdit: () => void; onDelete: () => void; onConcluir: () => void;
  onAbrirItens: (projetoId: string) => void;
}) {
  const cor = categoriaCronoCor(r.categoria);
  const finalizada = r.categoria === "finalizadas";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: CRONO_COLS,
      gap: 8, padding: "10px 12px", alignItems: "center",
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
      opacity: finalizada ? 0.65 : 1,
    }}>
      <div
        onClick={() => { if (projetoIdMap) onAbrirItens(projetoIdMap); }}
        style={{
          minWidth: 0,
          cursor: projetoIdMap ? "pointer" : "default",
          padding: "2px 4px", margin: "-2px -4px",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => {
          if (projetoIdMap) (e.currentTarget as HTMLDivElement).style.background = t.card2;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
        title={projetoIdMap ? "Ver itens do projeto" : undefined}
      >
        <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
          {r.nome_obra}
          {projetoIdMap && (
            <span style={{ fontSize: 10, color: t.textTertiary }}>›</span>
          )}
        </div>
        <div style={{ fontSize: 8, letterSpacing: "0.18em", color: t.textTertiary, marginTop: 3, textTransform: "uppercase", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: cor }}>{labelCategoriaCrono(r.categoria)}</span>
          {projetoLabel && projetoIdMap && (
            <>
              <span>·</span>
              <span style={{ color: t.textSecondary }}>projeto: {projetoLabel}</span>
            </>
          )}
          {!projetoIdMap && r.card_id && (
            <>
              <span>·</span>
              <span title={r.card_id}>card {r.card_id.slice(0, 6)}</span>
            </>
          )}
        </div>
      </div>
      <ComboEquipeInline r={r} equipes={equipes} onPatch={onPatch} t={t} />
      <ComboFiscalInline r={r} fiscais={fiscais} onPatch={onPatch} t={t} />
      <InlineText v={r.servico} placeholder="serviço…" t={t}
        onSave={v => onPatch({ servico: v || null })} />
      <div style={{ minWidth: 0, fontSize: 10, color: t.textSecondary, letterSpacing: "0.04em" }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.localizacao || "—"}
        </div>
        {r.contrato && (
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: t.textTertiary, textTransform: "uppercase", marginTop: 2 }}>
            contrato · {r.contrato}
          </div>
        )}
      </div>
      <InlineDate v={r.inicio_dia} t={t}
        onSave={v => onPatch({ inicio_dia: v })} />
      <InlineDate v={r.termino_dia} t={t}
        onSave={v => onPatch({ termino_dia: v })} />
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
        {finalizada ? (
          <span title={r.data_finalizacao ? `Concluído em ${fmtBR(toISO(r.data_finalizacao))}` : "Concluído"}
            style={{
              padding: "6px 10px", background: "#7BA394", color: t.bg,
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}>✓ Concluído</span>
        ) : (
          <button onClick={onConcluir} title="Marcar obra como concluída"
            style={{
              background: "transparent", color: "#7BA394",
              border: `1px solid #7BA394`, padding: "6px 10px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
            }}>Concluir</button>
        )}
        <button onClick={onEdit} style={btnGhost(t)}>Editar</button>
        <button onClick={onDelete} style={{
          ...btnGhost(t), color: "#B85B4C", borderColor: "#B85B4C",
        }}>×</button>
      </div>
    </div>
  );
}

function InlineText({ v, placeholder, onSave, t, mono }: {
  v: string | null; placeholder: string; onSave: (v: string) => void; t: any; mono?: boolean;
}) {
  const [val, setVal] = useState(v || "");
  useEffect(() => setVal(v || ""), [v]);
  const commit = () => { if (val !== (v || "")) onSave(val); };
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      style={{
        ...inputStyle(t),
        fontVariantNumeric: mono ? ("tabular-nums" as any) : undefined,
        padding: "6px 8px",
      }}
    />
  );
}

/** Célula editável de data. Aceita e mostra dd/mm/yyyy, salva ISO no banco.
 *  Tolerante a valores legados: strings livres tipo "15/07" viram a data ISO
 *  do ano corrente; strings não parseáveis continuam sendo mostradas raw. */
function InlineDate({ v, onSave, t }: {
  v: string | null; onSave: (v: string | null) => void; t: any;
}) {
  const iso = toISO(v);
  const [val, setVal] = useState<string>(iso);
  useEffect(() => setVal(toISO(v)), [v]);
  const commit = () => {
    if (val !== iso) onSave(val || null);
  };
  return (
    <input
      type="date"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{
        ...inputStyle(t),
        padding: "6px 8px",
        fontVariantNumeric: "tabular-nums" as any,
        colorScheme: (t.bg === "#0a0a0a" || t.bg === "#050505") ? "dark" : "light",
      }}
      title={val ? fmtBR(val) : "sem data"}
    />
  );
}

function ComboEquipeInline({ r, equipes, onPatch, t }: {
  r: CronogramaRow; equipes: EquipeParket[]; onPatch: (patch: Partial<CronogramaInput>) => void; t: any;
}) {
  return (
    <select
      value={r.equipe || ""}
      onChange={e => onPatch({ equipe: e.target.value || null })}
      style={inputStyle(t)}
    >
      <option value="">— equipe —</option>
      {equipes.map(eq => (
        <option key={eq.id} value={eq.nome}>{eq.nome} · {eq.categoria}</option>
      ))}
      {r.equipe && !equipes.find(e => e.nome === r.equipe) && (
        <option value={r.equipe}>{r.equipe}</option>
      )}
    </select>
  );
}

/** Combo de fiscais — puxa da tabela fiscal_equipe (Fiscal · Equipe).
 *  Tolera valores livres/legados: se o texto atual não bate com nenhum fiscal
 *  cadastrado, mostra o valor original como opção extra pra não perder o dado. */
function ComboFiscalInline({ r, fiscais, onPatch, t }: {
  r: CronogramaRow; fiscais: Fiscal[]; onPatch: (patch: Partial<CronogramaInput>) => void; t: any;
}) {
  const currentMatches = r.fiscal && fiscais.find(
    f => f.nome.trim().toUpperCase() === r.fiscal!.trim().toUpperCase()
  );
  return (
    <select
      value={currentMatches ? currentMatches.nome : (r.fiscal || "")}
      onChange={e => onPatch({ fiscal: e.target.value || null })}
      style={inputStyle(t)}
      title="Fiscal responsável (Fiscal · Equipe)"
    >
      <option value="">— fiscal —</option>
      {fiscais.map(f => (
        <option key={f.id} value={f.nome}>{f.nome}</option>
      ))}
      {r.fiscal && !currentMatches && (
        <option value={r.fiscal}>{r.fiscal}</option>
      )}
    </select>
  );
}

function CronogramaModal({ initial, tipoDefault, categoriaDefault, equipes, fiscais, projetos, onClose, onSaved }: {
  initial: CronogramaRow | null;
  tipoDefault: string;
  categoriaDefault: string;
  equipes: EquipeParket[];
  fiscais: Fiscal[];
  projetos: ProjetoResumo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTokens();
  const [tipo, setTipo] = useState(initial?.tipo || tipoDefault);
  const [categoria, setCategoria] = useState(initial?.categoria || categoriaDefault);
  const [nome_obra, setNomeObra] = useState(initial?.nome_obra || "");
  const [projetoId, setProjetoId] = useState<string>(() => {
    if (initial?.card_id) {
      const p = projetos.find(x => x.card_id === initial.card_id);
      return p?.id || "";
    }
    return "";
  });
  const [equipe, setEquipe] = useState(initial?.equipe || "");
  const [fiscal, setFiscal] = useState(initial?.fiscal || "");
  const [servico, setServico] = useState(initial?.servico || "");
  const [dias, setDias] = useState(initial?.dias || "");
  const [custos, setCustos] = useState(initial?.custos || "");
  const [inicio_dia, setInicio] = useState(toISO(initial?.inicio_dia || ""));
  const [termino_dia, setTermino] = useState(toISO(initial?.termino_dia || ""));
  const [contrato, setContrato] = useState(initial?.contrato || "");
  const [dispos, setDispos] = useState(initial?.dispos || "");
  const [status_obra, setStatusObra] = useState(initial?.status_obra || "");
  const [localizacao, setLocalizacao] = useState(initial?.localizacao || "");
  const [observacao, setObservacao] = useState(initial?.observacao || "");
  const [data_finalizacao, setDataFim] = useState(toISO(initial?.data_finalizacao || ""));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Autofill quando um projeto é escolhido
  useEffect(() => {
    if (!projetoId) return;
    const p = projetos.find(x => x.id === projetoId);
    if (!p) return;
    if (!nome_obra) setNomeObra(p.cliente || p.obra_code || "");
    if (!localizacao && p.endereco) setLocalizacao(p.endereco);
    if (!contrato && p.numero_proposta) setContrato(p.numero_proposta);
  }, [projetoId]);

  const save = async () => {
    if (!nome_obra.trim()) { setErro("Nome da obra é obrigatório"); return; }
    setErro(null);
    setSaving(true);
    try {
      const card_id = projetoId
        ? (projetos.find(p => p.id === projetoId)?.card_id || null)
        : (initial?.card_id ?? null);
      const payload: CronogramaInput = {
        tipo, categoria, nome_obra: nome_obra.trim(),
        card_id,
        equipe: equipe.trim() || null,
        fiscal: fiscal.trim() || null,
        servico: servico.trim() || null,
        dias: dias.trim() || null,
        custos: custos.trim() || null,
        inicio_dia: inicio_dia.trim() || null,
        termino_dia: termino_dia.trim() || null,
        contrato: contrato.trim() || null,
        dispos: dispos.trim() || null,
        status_obra: status_obra.trim() || null,
        localizacao: localizacao.trim() || null,
        observacao: observacao.trim() || null,
        data_finalizacao: data_finalizacao.trim() || null,
      };
      if (initial) await api.cronogramaPatch(initial.id, payload);
      else await api.cronogramaCreate(payload);
      onSaved();
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, border: `1px solid ${t.border2}`, maxWidth: 720, width: "100%",
        maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border1}` }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary }}>
            {initial ? "Editar Cronograma" : "Nova linha do Cronograma"}
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Tipo" t={t}>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle(t)}>
              {TIPOS_CRONO.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Categoria" t={t}>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle(t)}>
              {CATEGORIAS_CRONO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Projeto (vincula automaticamente)" t={t} span={2}>
            <select value={projetoId} onChange={e => setProjetoId(e.target.value)} style={inputStyle(t)}>
              <option value="">— sem vínculo —</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.cliente || p.obra_code || p.numero_proposta || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Obra / Cliente" t={t} span={2}>
            <input value={nome_obra} onChange={e => setNomeObra(e.target.value)} style={inputStyle(t)} autoFocus />
          </Field>
          <Field label="Equipe" t={t}>
            <select value={equipe} onChange={e => setEquipe(e.target.value)} style={inputStyle(t)}>
              <option value="">—</option>
              {equipes.map(eq => (
                <option key={eq.id} value={eq.nome}>{eq.nome} · {eq.categoria}</option>
              ))}
            </select>
          </Field>
          <Field label="Fiscal" t={t}>
            <select value={fiscal} onChange={e => setFiscal(e.target.value)} style={inputStyle(t)}>
              <option value="">— fiscal —</option>
              {fiscais.map(f => (
                <option key={f.id} value={f.nome}>{f.nome}</option>
              ))}
              {fiscal && !fiscais.find(f => f.nome.trim().toUpperCase() === fiscal.trim().toUpperCase()) && (
                <option value={fiscal}>{fiscal}</option>
              )}
            </select>
          </Field>
          <Field label="Serviço" t={t}>
            <input value={servico} onChange={e => setServico(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Status obra" t={t}>
            <input value={status_obra} onChange={e => setStatusObra(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Início" t={t}>
            <input type="date" value={inicio_dia} onChange={e => setInicio(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Término" t={t}>
            <input type="date" value={termino_dia} onChange={e => setTermino(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Dias" t={t}>
            <input value={dias} onChange={e => setDias(e.target.value)} placeholder="ex: 7d" style={inputStyle(t)} />
          </Field>
          <Field label="Custos" t={t}>
            <input value={custos} onChange={e => setCustos(e.target.value)} placeholder="R$ …" style={inputStyle(t)} />
          </Field>
          <Field label="Contrato" t={t}>
            <input value={contrato} onChange={e => setContrato(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Disposições" t={t}>
            <input value={dispos} onChange={e => setDispos(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Localização" t={t} span={2}>
            <input value={localizacao} onChange={e => setLocalizacao(e.target.value)} style={inputStyle(t)} />
          </Field>
          <Field label="Data finalização" t={t}>
            <input type="date" value={data_finalizacao} onChange={e => setDataFim(e.target.value)} style={inputStyle(t)} />
          </Field>
          <div />
          <Field label="Observação" t={t} span={2}>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              rows={3} style={{ ...inputStyle(t), minHeight: 60, fontFamily: fonts.inter }} />
          </Field>
          {erro && <div style={{ gridColumn: "span 2", fontSize: 10, color: "#B85B4C" }}>{erro}</div>}
        </div>
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={btnGhost(t)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary(t)}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ITENS DO PROJETO — abertos ao clicar no cliente/obra na tabela de cronograma
// Mostra cada item com: equipe responsável, data início, data fim,
// e botão Concluído (status "entregue" + executado_em=hoje) ou Reabrir.
// Sincroniza com gestao.itens via api.itemPatch.
// ═══════════════════════════════════════════════════════════════════

export const STATUS_CONCLUIDO = new Set(["entregue", "instalado"]);

function ItensProjetoModal({ projetoId, crono, equipes, projetos, onClose }: {
  projetoId: string;
  crono: CronogramaRow;
  equipes: EquipeParket[];
  projetos: ProjetoResumo[];
  onClose: () => void;
}) {
  const t = useTokens();
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const projeto = projetos.find(p => p.id === projetoId);
  const cronoInicio = toISO(crono.inicio_dia);
  const cronoTermino = toISO(crono.termino_dia);
  const [finalizadoAviso, setFinalizadoAviso] = useState<string | null>(null);
  const finalizedRef = useRef(crono.categoria === "finalizadas");

  const load = () => {
    setLoading(true);
    api.itens(projetoId)
      .then(setItens)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projetoId]);

  const stats = useMemo(() => {
    const concluidos = itens.filter(i => STATUS_CONCLUIDO.has(i.status)).length;
    return {
      total: itens.length,
      concluidos,
      pct: itens.length ? Math.round((concluidos / itens.length) * 100) : 0,
    };
  }, [itens]);

  // Quando todos os itens ficam concluídos, propaga pro cronograma:
  // categoria=finalizadas + data_finalizacao = maior executado_em entre os itens.
  useEffect(() => {
    if (finalizedRef.current || itens.length === 0) return;
    const allDone = itens.every(i => STATUS_CONCLUIDO.has(i.status));
    if (!allDone) return;
    finalizedRef.current = true;
    const lastDate = itens.reduce<string | null>((acc, it) => {
      const raw = it.executado_em ? String(it.executado_em).slice(0, 10) : null;
      return raw && (!acc || raw > acc) ? raw : acc;
    }, null) || new Date().toISOString().slice(0, 10);
    api.cronogramaPatch(crono.id, {
      categoria: "finalizadas",
      data_finalizacao: lastDate,
      status_obra: "concluida",
    }).then(() => {
      setFinalizadoAviso(lastDate);
    }).catch(err => {
      console.error("falha ao finalizar cronograma", err);
      finalizedRef.current = false;
    });
  }, [itens, crono.id]);

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, border: `1px solid ${t.border2}`,
        maxWidth: 1180, width: "100%", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px 14px",
          borderBottom: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: t.accent, marginBottom: 4,
            }}>
              Itens do Projeto
            </div>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 18, letterSpacing: "0.12em",
              textTransform: "uppercase", color: t.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {projeto?.cliente || projeto?.obra_code || "Projeto"}
            </div>
            {(projeto?.endereco || projeto?.numero_proposta) && (
              <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 4, letterSpacing: "0.04em" }}>
                {projeto?.numero_proposta && <span>#{projeto.numero_proposta} · </span>}
                {projeto?.endereco}
              </div>
            )}
          </div>
          <button onClick={onClose} style={btnGhost(t)}>Fechar</button>
        </div>

        {/* Métricas + herança do cronograma */}
        <div style={{
          padding: "10px 24px", borderBottom: `1px solid ${t.border1}`,
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, background: t.card1,
        }}>
          <MiniStat label="Itens" v={stats.total} t={t} />
          <MiniStat label="Concluídos" v={stats.concluidos} t={t} corValor="#7BA394" />
          <MiniStat label="% Progresso" v={`${stats.pct}%`} t={t} corValor={t.accent} />
        </div>
        {(cronoInicio || cronoTermino || crono.equipe) && (
          <div style={{
            padding: "8px 24px", borderBottom: `1px solid ${t.border1}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 12, flexWrap: "wrap", background: t.card2,
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em",
            textTransform: "uppercase", color: t.textTertiary,
          }}>
            <span>Cronograma da obra {"·"} datas herdadas nos itens sem override</span>
            <span style={{ fontVariantNumeric: "tabular-nums" as any, color: t.textSecondary }}>
              Início · {fmtBR(cronoInicio) || "—"}
              {"  ·  "}
              Término · {fmtBR(cronoTermino) || "—"}
              {crono.equipe && <span style={{ color: t.accent }}>{"  ·  "}equipe · {crono.equipe}</span>}
            </span>
          </div>
        )}

        {finalizadoAviso && (
          <div style={{
            padding: "8px 24px", borderBottom: `1px solid ${t.border1}`,
            background: "rgba(123,163,148,0.14)",
            color: "#7BA394",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", textAlign: "center",
          }}>
            ✓ Todos os itens concluídos — cronograma marcado como finalizado em {fmtBR(finalizadoAviso)}
          </div>
        )}

        {/* Lista */}
        <div style={{ overflow: "auto", flex: 1, padding: "12px 20px 20px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              carregando…
            </div>
          ) : itens.length === 0 ? (
            <div style={{
              background: t.card1, border: `1px dashed ${t.border1}`,
              padding: "24px 16px", textAlign: "center",
              fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
            }}>
              Nenhum item registrado no projeto
            </div>
          ) : (
            <CategoriasAgregadas
              projetoId={projetoId} itens={itens} setItens={setItens} reload={load}
              equipes={equipes} cronoInicio={cronoInicio} cronoTermino={cronoTermino}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Lista de itens do projeto embutível (usada no painel expandido do
 *  cronograma da home). Mesmos controles do modal: equipe, datas com
 *  herança do cronograma, Concluir/Reabrir e auto-finalize da obra. */
export function ItensProjetoLista({ projetoId, crono, equipes }: {
  projetoId: string;
  crono: CronogramaRow;
  equipes: EquipeParket[];
}) {
  const t = useTokens();
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const cronoInicio = toISO(crono.inicio_dia);
  const cronoTermino = toISO(crono.termino_dia);
  const finalizedRef = useRef(crono.categoria === "finalizadas");

  const load = () => {
    setLoading(true);
    api.itens(projetoId)
      .then(setItens)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projetoId]);

  useEffect(() => {
    if (finalizedRef.current || itens.length === 0) return;
    const allDone = itens.every(i => STATUS_CONCLUIDO.has(i.status));
    if (!allDone) return;
    finalizedRef.current = true;
    const lastDate = itens.reduce<string | null>((acc, it) => {
      const raw = it.executado_em ? String(it.executado_em).slice(0, 10) : null;
      return raw && (!acc || raw > acc) ? raw : acc;
    }, null) || new Date().toISOString().slice(0, 10);
    api.cronogramaPatch(crono.id, {
      categoria: "finalizadas",
      data_finalizacao: lastDate,
      status_obra: "concluida",
    }).catch(err => {
      console.error("falha ao finalizar cronograma", err);
      finalizedRef.current = false;
    });
  }, [itens, crono.id]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: t.textTertiary, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>
        carregando itens…
      </div>
    );
  }
  if (itens.length === 0) {
    return (
      <div style={{
        background: t.card1, border: `1px dashed ${t.border1}`,
        padding: "18px 14px", textAlign: "center",
        fontSize: 9, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
      }}>
        Nenhum item registrado no projeto
      </div>
    );
  }
  return (
    <CategoriasAgregadas
      projetoId={projetoId} itens={itens} setItens={setItens} reload={load}
      equipes={equipes} cronoInicio={cronoInicio} cronoTermino={cronoTermino}
    />
  );
}

/* ─── Agregação por categoria geral (Will 18/08) ────────────────
   O cronograma não opera por subitem: 1 linha por categoria
   (PISO, FORRO, …) com METRAGEM TOTAL; equipe/datas/status valem
   pro grupo inteiro (bulk em gestao.itens, endpoint itens/categoria).
   Os subitens seguem visíveis num detalhe read-only colapsado. */

type GrupoCategoria = {
  categoria: string;
  produto: string;
  itens: Item[];
  metragem: number;
  unidade: string;
  responsavel: string | null;
  inicio: string | null;
  fim: string | null;
  concluidos: number;
  ordemMin: number;
};

const UN_M2 = new Set(["m²", "m2"]);

function categoriaRaizDe(it: Item): string {
  const raw = (it.meta as any)?.categoria_raiz || it.categoria || "";
  return String(raw).split("||")[0].trim().toUpperCase();
}

function agruparPorCategoria(itens: Item[]): GrupoCategoria[] {
  const grupos = new Map<string, Item[]>();
  for (const it of itens) {
    if (it.status === "cancelado") continue;
    const cat = categoriaRaizDe(it);
    if (!cat) continue;
    (grupos.get(cat) ?? grupos.set(cat, []).get(cat)!).push(it);
  }
  return Array.from(grupos.entries()).map(([categoria, list]) => {
    // Metragem total = soma dos itens em m² (produto vendido);
    // grupo sem nenhum m² (ex: só portas em un) soma na unidade própria.
    const m2 = list.filter(i => UN_M2.has((i.unidade || "").trim().toLowerCase()));
    const base = m2.length ? m2 : list;
    const metragem = base.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
    const unidade = m2.length ? "m²" : (base[0]?.unidade || "");
    const resp = new Set(list.map(i => i.responsavel).filter(Boolean));
    const inicio = list.reduce<string | null>((acc, i) => {
      const v = toISO(i.previsao_inicio || null);
      return v && (!acc || v < acc) ? v : acc;
    }, null);
    const fim = list.reduce<string | null>((acc, i) => {
      const v = toISO(i.previsao_fim || null);
      return v && (!acc || v > acc) ? v : acc;
    }, null);
    const produto = produtoHeaderDe((list[0]?.meta as any) || {}, list[0]?.categoria);
    const ordemMin = Math.min(...list.map(i =>
      Number(String((i.meta as any)?.codigo || i.ordem).split(".")[0]) || 0));
    return {
      categoria, produto, itens: list, metragem, unidade,
      responsavel: resp.size === 1 ? (Array.from(resp)[0] as string) : null,
      inicio, fim,
      concluidos: list.filter(i => STATUS_CONCLUIDO.has(i.status)).length,
      ordemMin,
    };
  }).sort((a, b) => a.ordemMin - b.ordemMin);
}

const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function CategoriasAgregadas({ projetoId, itens, setItens, reload, equipes, cronoInicio, cronoTermino }: {
  projetoId: string;
  itens: Item[];
  setItens: (updater: (prev: Item[]) => Item[]) => void;
  reload: () => void;
  equipes: EquipeParket[];
  cronoInicio: string;
  cronoTermino: string;
}) {
  const t = useTokens();
  const grupos = useMemo(() => agruparPorCategoria(itens), [itens]);

  const bulk = async (g: GrupoCategoria, p: Partial<Item>) => {
    const ids = new Set(g.itens.map(i => i.id));
    setItens(prev => prev.map(x => (ids.has(x.id) ? { ...x, ...p } as Item : x)));
    try {
      await api.projetoCategoriaPatch(projetoId, g.categoria, p as any);
    } catch (e) {
      console.error(e);
      reload();
    }
  };

  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.7fr 130px 1.2fr 120px 120px 130px",
        gap: 8, padding: "8px 12px",
        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
        textTransform: "uppercase", color: t.textTertiary,
        background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 4,
      }}>
        <div>Serviço</div>
        <div>Metragem total</div>
        <div>Equipe responsável</div>
        <div>Início</div>
        <div>Término</div>
        <div style={{ textAlign: "right" }}>Status</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {grupos.map(g => (
          <CategoriaRow key={g.categoria} g={g} t={t} equipes={equipes}
            fallbackInicio={cronoInicio} fallbackTermino={cronoTermino}
            onBulk={p => bulk(g, p)} />
        ))}
      </div>
    </div>
  );
}

function CategoriaRow({ g, t, equipes, fallbackInicio, fallbackTermino, onBulk }: {
  g: GrupoCategoria; t: any; equipes: EquipeParket[];
  fallbackInicio: string; fallbackTermino: string;
  onBulk: (p: Partial<Item>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const allDone = g.concluidos === g.itens.length && g.itens.length > 0;
  const cor = allDone ? "#7BA394" : "#C7A45B";

  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.7fr 130px 1.2fr 120px 120px 130px",
        gap: 8, alignItems: "center", padding: "10px 12px",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.20em",
              textTransform: "uppercase", color: t.accent, whiteSpace: "nowrap",
            }}>{g.categoria}</span>
            <button
              onClick={() => setAberto(v => !v)}
              title="ver itens que compõem o serviço"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.14em",
                textTransform: "uppercase", color: t.textTertiary, padding: 0,
                whiteSpace: "nowrap",
              }}
            >{aberto ? "▾" : "▸"} {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}</button>
          </div>
          {g.produto && (
            <div style={{
              fontSize: 9, letterSpacing: "0.10em", color: t.textSecondary,
              marginTop: 3, textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{g.produto}</div>
          )}
        </div>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 13, color: t.textPrimary,
          fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}>
          {fmtQtd(g.metragem)} <span style={{ fontSize: 9, color: t.textTertiary }}>{g.unidade}</span>
        </div>
        <select
          value={g.responsavel || ""}
          onChange={e => onBulk({ responsavel: e.target.value || null })}
          style={inputStyle(t)}
        >
          <option value="">— equipe —</option>
          {equipes.map(eq => (
            <option key={eq.id} value={eq.nome}>{eq.nome} · {eq.categoria}</option>
          ))}
          {g.responsavel && !equipes.find(e => e.nome === g.responsavel) && (
            <option value={g.responsavel}>{g.responsavel}</option>
          )}
        </select>
        <ItemDate v={g.inicio} fallback={fallbackInicio} t={t}
          onSave={v => onBulk({ previsao_inicio: v })} />
        <ItemDate v={g.fim} fallback={fallbackTermino} t={t}
          onSave={v => onBulk({ previsao_fim: v })} />
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
          {!allDone && g.concluidos > 0 && (
            <span style={{
              fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em",
              color: t.textTertiary, fontVariantNumeric: "tabular-nums" as any,
              whiteSpace: "nowrap",
            }}>{g.concluidos}/{g.itens.length}</span>
          )}
          {allDone ? (
            <button
              onClick={() => onBulk({ status: "pendente", executado_em: null as any })}
              title="Concluído — clique pra reabrir o serviço inteiro"
              style={{
                padding: "6px 10px", background: "#7BA394", color: t.bg,
                border: `1px solid #7BA394`,
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >✓ Concluído</button>
          ) : (
            <button
              onClick={() => {
                const hoje = new Date().toISOString().slice(0, 10);
                onBulk({ status: "entregue", executado_em: hoje });
              }}
              title="Concluir todos os itens do serviço"
              style={{
                background: "transparent", color: "#7BA394",
                border: `1px solid #7BA394`, padding: "6px 10px",
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >Concluir</button>
          )}
        </div>
      </div>

      {aberto && (
        <div style={{ padding: "4px 12px 10px 24px", borderTop: `1px solid ${t.border1}` }}>
          {g.itens
            .slice()
            .sort((a, b) => String((a.meta as any)?.codigo || a.ordem)
              .localeCompare(String((b.meta as any)?.codigo || b.ordem), undefined, { numeric: true }))
            .map(it => (
              <div key={it.id} style={{
                display: "flex", alignItems: "baseline", gap: 10,
                padding: "4px 0", fontSize: 10, color: t.textSecondary,
              }}>
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.10em",
                  color: t.textTertiary, fontVariantNumeric: "tabular-nums" as any,
                  minWidth: 44,
                }}>{(it.meta as any)?.codigo || it.ordem}</span>
                <span style={{
                  flex: 1, minWidth: 0, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{it.ambiente || it.descritivo}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap" }}>
                  {fmtQtd(Number(it.quantidade) || 0)} {it.unidade}
                </span>
                <span style={{
                  fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: STATUS_CONCLUIDO.has(it.status) ? "#7BA394" : t.textTertiary,
                  whiteSpace: "nowrap", minWidth: 62, textAlign: "right",
                }}>{STATUS_CONCLUIDO.has(it.status) ? "concluído" : it.status}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ItemDate({ v, fallback, onSave, t }: {
  v: string | null; fallback?: string;
  onSave: (v: string | null) => void; t: any;
}) {
  // Se o item não tem data própria, exibe a data do cronograma (herança visual).
  // Salvar só é disparado se o usuário alterar o valor mostrado.
  const own = toISO(v);
  const displayed = own || fallback || "";
  const [val, setVal] = useState<string>(displayed);
  useEffect(() => setVal(own || fallback || ""), [own, fallback]);
  const commit = () => { if (val !== displayed) onSave(val || null); };
  const inheriting = !own && !!fallback && !!val;
  return (
    <input
      type="date"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{
        ...inputStyle(t),
        padding: "6px 8px",
        fontVariantNumeric: "tabular-nums" as any,
        colorScheme: (t.bg === "#0a0a0a" || t.bg === "#050505") ? "dark" : "light",
        // sinaliza herança do cronograma com opacidade + borda pontilhada
        opacity: inheriting ? 0.7 : 1,
        borderStyle: inheriting ? "dashed" : "solid",
      }}
      title={
        val
          ? (inheriting ? `Herdado do cronograma · ${fmtBR(val)}` : fmtBR(val))
          : "sem data"
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// UTILS visuais (compartilhados também com o card do projeto)
// ═══════════════════════════════════════════════════════════════════

export function MiniStat({ label, v, t, corValor }: {
  label: string; v: any; t: any; corValor?: string;
}) {
  return (
    <div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 20, color: corValor || t.textPrimary,
        marginTop: 3, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em",
      }}>{v}</div>
    </div>
  );
}

function Field({ label, children, t, span }: { label: string; children: any; t: any; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

function PillBtn({ active, onClick, children, t }: {
  active: boolean; onClick: () => void; children: any; t: any;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px",
      background: active ? t.card2 : "transparent",
      color: active ? t.textPrimary : t.textSecondary,
      border: `1px solid ${active ? t.border2 : t.border1}`,
      fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
      cursor: "pointer",
    }}>{children}</button>
  );
}

// Cor associada a cada categoria de prestador (bordas + label)
export function categoriaCor(cat: string): string {
  const map: Record<string, string> = {
    "Estrutura":                     "#C7A45B",
    "Forro/Painel Revestimento":     "#8CA9B8",
    "Acabamento":                    "#7BA394",
    "Piso":                          "#B8893A",
    "Escada":                        "#B85B4C",
    "Deck":                          "#5F5D58",
    "Marcenaria":                    "#A58BC4",
    "Marcenaria Acabamento":         "#8B6DAA",
    "Brasilia Instalação/Marcenaria":"#7A9E8B",
    "Terceiro Salvador":             "#D18B5F",
    "Reparo":                        "#B85B4C",
  };
  return map[cat] || "#C7A45B";
}

function categoriaCronoCor(cat: string): string {
  return CATEGORIAS_CRONO.find(c => c.id === cat)?.cor || "#8CA9B8";
}
function labelCategoriaCrono(cat: string): string {
  return CATEGORIAS_CRONO.find(c => c.id === cat)?.label || cat;
}

function fmtD(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Converte valor da coluna text pra ISO (yyyy-mm-dd) — aceito por <input type="date">.
 *  Tolera formatos legados: "15/07", "15/07/26", "15/07/2026". Devolve "" se não parsear. */
export function toISO(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  // Já é ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm[/yy[yy]]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3] || String(new Date().getFullYear());
    if (y.length === 2) y = (Number(y) >= 70 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
  }
  return "";
}

/** ISO → dd/mm/yy pra exibição na tabela. */
export function fmtBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  }
  return s; // fallback: mostra raw se não conseguir parsear
}

// ─── styles ─────────────────────────────────────────────

export const inputStyle = (t: any): React.CSSProperties => ({
  padding: "8px 10px", background: t.card2, border: `1px solid ${t.border1}`,
  color: t.textPrimary, outline: "none",
  fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.04em",
  width: "100%", boxSizing: "border-box", minWidth: 0,
});

export const btnPrimary = (t: any): React.CSSProperties => ({
  background: t.accent, color: t.bg, border: "none",
  padding: "9px 16px", fontFamily: fonts.cinzel, fontSize: 9,
  letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer",
  whiteSpace: "nowrap",
});

export const btnGhost = (t: any): React.CSSProperties => ({
  background: "transparent", color: t.textSecondary,
  border: `1px solid ${t.border1}`, padding: "6px 12px",
  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
  textTransform: "uppercase", cursor: "pointer",
});

export const btnAccent = (t: any): React.CSSProperties => ({
  background: t.card2, color: t.accent,
  border: `1px solid ${t.accent}`, padding: "6px 12px",
  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
  textTransform: "uppercase", cursor: "pointer",
});

export const modalBackdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20, zIndex: 1000,
};
