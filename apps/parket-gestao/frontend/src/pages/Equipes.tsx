import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import { api, type ContratoGeralResp, type EquipeComObras, type EquipeObra, type EquipeParket, type Item, type ObraComPrestadores, type ObrasPrestadoresResp, type PrestadorAcesso, type PrestadorAvaliacao, type PrestadorEvento, type Projeto, type TermoResumo } from "../api";

/** Operações · Instaladores (rota /equipes, nome antigo da tela) — cadastro
 *  completo do prestador (nome, CNPJ, endereço, email, foto) + obras
 *  vinculadas + anexos de obra (termos). A CRIAÇÃO de termo saiu daqui:
 *  o fluxo canônico (#1932) é vincular o prestador na página do Projeto
 *  (Visão Geral), que auto-cria o termo pendente com todos os itens; o termo
 *  vira ANEXO do contrato geral quando o prestador ativa a obra por OTP no
 *  Instala (F4/F5 #1988-#1989). O bloco Contrato geral mostra o aceite da
 *  versão vigente dos termos (assinado no primeiro login do Instala). */

const INSTALA_URL = "https://instala.parket.works";

function corPorSlaStatus(s: string | null): string {
  switch (s) {
    case "ok": return "#3fa96b";
    case "atrasado": return "#d05a3b";
    case "atencao": return "#c7a45b";
    default: return "#8CA9B8";
  }
}

function labelColuna(col: string | null): string {
  if (!col) return "—";
  return col.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type StatusBanco = "em_obra" | "disponivel" | "bloqueado";

const STATUS_INFO: Record<StatusBanco, { label: string; cor: string }> = {
  em_obra: { label: "Em obra", cor: "#3fa96b" },
  disponivel: { label: "Disponível", cor: "#8CA9B8" },
  bloqueado: { label: "Bloqueado", cor: "#d05a3b" },
};

const TIER_COR: Record<string, string> = { A: "#3fa96b", B: "#c7a45b", C: "#d05a3b" };

function statusDe(eq: EquipeComObras): StatusBanco {
  return (eq.status_banco as StatusBanco) || (eq.obras.length > 0 ? "em_obra" : "disponivel");
}

function Estrelas({ v, t, size = 12 }: { v: number; t: any; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(v) ? "#C7A45B" : t.border2 }}>★</span>
      ))}
    </span>
  );
}

function EstrelasInput({ v, onChange, t }: { v: number; onChange: (n: number) => void; t: any }) {
  return (
    <span style={{ fontSize: 20, letterSpacing: 2, lineHeight: 1, cursor: "pointer", userSelect: "none" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} onClick={() => onChange(i)} style={{ color: i <= v ? "#C7A45B" : t.border2 }}>★</span>
      ))}
    </span>
  );
}

export default function EquipesPage() {
  const t = useTokens();
  const [dados, setDados] = useState<EquipeComObras[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusBanco>("todos");
  const [editarEq, setEditarEq] = useState<EquipeComObras | null>(null);
  const [avaliarEq, setAvaliarEq] = useState<EquipeComObras | null>(null);
  const [mancadaEq, setMancadaEq] = useState<EquipeComObras | null>(null);
  const [bloquearEq, setBloquearEq] = useState<EquipeComObras | null>(null);
  // Lista de login/senha do instala.parket.works (gate no backend: superadmin + planejamento@)
  const [verAcessos, setVerAcessos] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  // Duas visões da mesma base: por prestador (padrão) e por obra
  const [aba, setAba] = useState<"prestadores" | "obras">("prestadores");
  const [novoPrestador, setNovoPrestador] = useState(false);

  // Status do contrato geral por equipe (1 chamada batch; falha não trava a tela)
  const [contratoGeral, setContratoGeral] = useState<ContratoGeralResp | null>(null);
  useEffect(() => {
    api.contratoGeral().then(setContratoGeral).catch(() => setContratoGeral(null));
  }, [refreshTick]);

  useEffect(() => {
    setLoading(true);
    api.operacoesEquipes()
      .then((r) => {
        const flat: EquipeComObras[] = [];
        for (const g of r.grupos) flat.push(...g.equipes);
        setDados(flat);
        setErro(null);
      })
      .catch((e) => setErro(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [refreshTick]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dados.filter((e) => {
      if (filtroStatus !== "todos" && statusDe(e) !== filtroStatus) return false;
      if (!q) return true;
      // Busca cobre TODAS as frentes: procurar por "Deck" acha quem tem Deck
      // como frente secundária, não só quem tem Deck como categoria principal.
      const hay = `${e.nome} ${e.categoria} ${(e.categorias || []).join(" ")} ${e.telefone || ""}`.toLowerCase();
      if (hay.includes(q)) return true;
      return e.obras.some((o) => (o.cliente || "").toLowerCase().includes(q));
    });
  }, [dados, busca, filtroStatus]);

  const grupos = useMemo(() => {
    const m = new Map<string, EquipeComObras[]>();
    for (const e of filtrados) {
      const cat = e.categoria || "—";
      const arr = m.get(cat) || [];
      arr.push(e);
      m.set(cat, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtrados]);

  const stats = useMemo(() => ({
    equipes: dados.length,
    em_obra: dados.filter((e) => statusDe(e) === "em_obra").length,
    disponiveis: dados.filter((e) => statusDe(e) === "disponivel").length,
    bloqueados: dados.filter((e) => statusDe(e) === "bloqueado").length,
    obras_total: dados.reduce((s, e) => s + e.obras.length, 0),
  }), [dados]);

  const toggle = (id: string) => setExpanded((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px 32px 40px" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: t.textPrimary }}>
          OPERAÇÕES · INSTALADORES
        </div>
        <div style={{ fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em", color: t.textTertiary, marginTop: 4 }}>
          Cadastro em <code style={{ background: t.card2, padding: "1px 6px" }}>equipes_parket</code>, obras vinculadas via <code style={{ background: t.card2, padding: "1px 6px" }}>kanban_cards.details.prestadores</code>. App em <a href={INSTALA_URL} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "underline" }}>{INSTALA_URL}</a>.
        </div>
      </header>

      {/* Alterna entre a visão por prestador e a visão por obra (a que existia
          no admin do instala). O botão Novo prestador vale nas duas. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        {([["prestadores", "Prestadores"], ["obras", "Obras x Prestadores"]] as const).map(([id, label]) => {
          const on = aba === id;
          return (
            <button
              key={id}
              onClick={() => setAba(id)}
              style={{
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", padding: "8px 16px", cursor: "pointer",
                background: on ? t.accent : "transparent",
                color: on ? "#050505" : t.textSecondary,
                border: `1px solid ${on ? t.accent : t.border2}`,
              }}
            >{label}</button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setNovoPrestador(true)}
          style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "8px 16px", cursor: "pointer",
            background: t.accent, color: "#050505", border: `1px solid ${t.accent}`,
          }}
        >+ Novo prestador</button>
      </div>

      {aba === "obras" && (
        <ObrasPrestadoresView t={t} tick={refreshTick} onRefresh={() => setRefreshTick((x) => x + 1)} />
      )}

      {aba === "prestadores" && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KPI t={t} label="Prestadores" v={stats.equipes} />
        <KPI t={t} label="Em obra" v={stats.em_obra} />
        <KPI t={t} label="Disponíveis" v={stats.disponiveis} />
        <KPI t={t} label="Bloqueados" v={stats.bloqueados} />
        <KPI t={t} label="Obras vinculadas" v={stats.obras_total} />
        {/* Quantos prestadores ja aceitaram a versao vigente do contrato geral no Instala */}
        {contratoGeral && (
          <KPI t={t} label={`Contrato geral v${contratoGeral.versao_vigente}`}
            v={`${dados.filter((e) => contratoGeral.por_equipe[e.id]?.vigente).length}/${dados.length}`} />
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar equipe, categoria, cliente…"
          style={{
            flex: 1, minWidth: 220, padding: "8px 12px",
            background: t.card2, border: `1px solid ${t.border1}`,
            color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.04em",
          }}
        />
        {(["todos", "em_obra", "disponivel", "bloqueado"] as const).map((f) => {
          const ativo = filtroStatus === f;
          const label = f === "todos" ? "Todos" : STATUS_INFO[f].label;
          const cor = f === "todos" ? t.accent : STATUS_INFO[f].cor;
          return (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              style={{
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", padding: "7px 14px", cursor: "pointer",
                background: ativo ? cor : "transparent",
                color: ativo ? "#050505" : t.textSecondary,
                border: `1px solid ${ativo ? cor : t.border2}`,
              }}
            >{label}</button>
          );
        })}
        {/* Abre a lista de acesso (login + senha) que o prestador usa no instala */}
        <button
          onClick={() => setVerAcessos(true)}
          style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "7px 14px", cursor: "pointer",
            background: "transparent", color: t.accent,
            border: `1px solid ${t.accent}`,
          }}
        >Acessos do app</button>
      </div>

      {loading && <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>Carregando…</div>}
      {erro && <div style={{ padding: 20, color: "#d05a3b", fontFamily: fonts.inter, fontSize: 11 }}>Erro: {erro}</div>}
      {!loading && !erro && grupos.length === 0 && (
        <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>
          Nenhuma equipe encontrada.
        </div>
      )}

      {!loading && !erro && grupos.map(([cat, equipes]) => (
        <section key={cat} style={{ marginBottom: 22 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.24em",
            textTransform: "uppercase", color: t.accent, marginBottom: 8,
          }}>
            {cat} · {equipes.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {equipes.map((eq) => (
              <EquipeCard
                key={eq.id}
                eq={eq} t={t}
                cg={contratoGeral}
                aberto={expanded.has(eq.id)}
                tick={refreshTick}
                onToggle={() => toggle(eq.id)}
                onEditar={() => setEditarEq(eq)}
                onAvaliar={() => setAvaliarEq(eq)}
                onMancada={() => setMancadaEq(eq)}
                onBloquear={() => setBloquearEq(eq)}
                onRefresh={() => setRefreshTick((x) => x + 1)}
              />
            ))}
          </div>
        </section>
      ))}
      </>}

      {novoPrestador && (
        <NovoPrestadorModal
          t={t}
          onFechar={() => setNovoPrestador(false)}
          onSaved={() => { setNovoPrestador(false); setRefreshTick((x) => x + 1); }}
        />
      )}

      {editarEq && (
        <EditarEquipeModal
          eq={editarEq}
          t={t}
          onFechar={() => setEditarEq(null)}
          onSaved={() => { setEditarEq(null); setRefreshTick((x) => x + 1); }}
        />
      )}

      {avaliarEq && (
        <AvaliarModal
          eq={avaliarEq}
          t={t}
          onFechar={() => setAvaliarEq(null)}
          onOk={() => { setAvaliarEq(null); setRefreshTick((x) => x + 1); }}
        />
      )}

      {mancadaEq && (
        <MancadaModal
          eq={mancadaEq}
          t={t}
          onFechar={() => setMancadaEq(null)}
          onOk={() => { setMancadaEq(null); setRefreshTick((x) => x + 1); }}
        />
      )}

      {bloquearEq && (
        <BloquearModal
          eq={bloquearEq}
          t={t}
          onFechar={() => setBloquearEq(null)}
          onOk={() => { setBloquearEq(null); setRefreshTick((x) => x + 1); }}
        />
      )}

      {verAcessos && <AcessosModal t={t} onFechar={() => setVerAcessos(false)} />}
    </div>
  );
}

function KPI({ t, label, v }: { t: any; label: string; v: number | string }) {
  return (
    <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "10px 14px" }}>
      <div style={{ fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 20, letterSpacing: "0.08em", color: t.textPrimary, marginTop: 4 }}>
        {v}
      </div>
    </div>
  );
}

function EquipeCard({ eq, t, cg, aberto, tick, onToggle, onEditar, onAvaliar, onMancada, onBloquear, onRefresh }: {
  eq: EquipeComObras; t: any; cg: ContratoGeralResp | null; aberto: boolean; tick: number;
  onToggle: () => void; onEditar: () => void;
  onAvaliar: () => void; onMancada: () => void; onBloquear: () => void; onRefresh: () => void;
}) {
  // Aceite do contrato geral deste prestador (null = ainda nao assinou no Instala)
  const aceiteCg = cg?.por_equipe[eq.id] || null;
  const instalaHref = `${INSTALA_URL}/`;
  const nAtivas = eq.obras.length;
  const status = statusDe(eq);
  const bloqueado = status === "bloqueado";
  const [termos, setTermos] = useState<TermoResumo[]>([]);
  const [loadingTermos, setLoadingTermos] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState<PrestadorAvaliacao[]>([]);
  const [eventos, setEventos] = useState<PrestadorEvento[]>([]);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [reativando, setReativando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setLoadingTermos(true);
    api.termosList({ equipe_id: eq.id })
      .then(setTermos)
      .catch(() => setTermos([]))
      .finally(() => setLoadingTermos(false));
  }, [aberto, eq.id]);

  useEffect(() => {
    if (!aberto) return;
    setLoadingFicha(true);
    api.equipeFicha(eq.id)
      .then((r) => { setAvaliacoes(r.avaliacoes || []); setEventos(r.eventos || []); })
      .catch(() => { setAvaliacoes([]); setEventos([]); })
      .finally(() => setLoadingFicha(false));
  }, [aberto, eq.id, tick]);

  async function reativar() {
    if (!window.confirm(`Reativar ${eq.nome}? O prestador volta a aparecer como disponível.`)) return;
    setReativando(true);
    try {
      await api.equipeReativar(eq.id);
      onRefresh();
    } finally { setReativando(false); }
  }

  return (
    <div style={{ border: `1px solid ${t.border1}`, background: t.card2 }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", cursor: "pointer", minWidth: 0,
        }}
      >
        <button
          onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
          style={{
            width: 26, height: 26, padding: 0, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: t.card1, border: `1px solid ${t.border2}`,
            color: t.textSecondary, fontSize: 11, cursor: "pointer",
          }}
        >{aberto ? "▾" : "▸"}</button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {eq.tier && (
              <span title={`Tier ${eq.tier}`} style={{
                fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.05em",
                color: "#050505", background: TIER_COR[eq.tier], width: 18, height: 18,
                display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{eq.tier}</span>
            )}
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.14em",
              color: bloqueado ? "#d05a3b" : t.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{eq.nome}</span>
            {/* Frentes extras: o instalador agora é uma linha só (dedup 018), então
                as outras categorias que ele atende viram chips aqui. A principal
                fica de fora porque já é o título do grupo. */}
            {(eq.categorias || [])
              .filter((c) => c && c !== eq.categoria)
              .map((c) => (
                <span key={c} title={`Também atende ${c}`} style={{
                  fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: t.textSecondary,
                  border: `1px solid ${t.border1}`, padding: "2px 6px",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>{c}</span>
              ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
            {eq.score != null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Estrelas v={eq.score} t={t} />
                <span style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textSecondary }}>
                  {eq.score.toFixed(1)} · {eq.aval_n} {eq.aval_n === 1 ? "avaliação" : "avaliações"}
                </span>
              </span>
            )}
            {(eq.mancadas || 0) > 0 && (
              <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.08em", color: "#d05a3b" }}>
                {eq.mancadas} {eq.mancadas === 1 ? "mancada" : "mancadas"}
              </span>
            )}
            <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>
              {eq.telefone || "sem tel"}
            </span>
            {(eq as any).cnpj_cpf && (
              <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em", color: t.textSecondary }}>
                {(eq as any).cnpj_cpf}
              </span>
            )}
            {/* Situação do contrato geral: verde = versão vigente aceita; âmbar =
                versão antiga (re-aceite no próximo login) ou ainda sem aceite */}
            {cg && (
              <span style={{
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
                color: aceiteCg?.vigente ? "#3fa96b" : "#c7a45b",
              }}>
                {aceiteCg
                  ? (aceiteCg.vigente
                    ? `contrato v${aceiteCg.versao_termos}`
                    : `contrato v${aceiteCg.versao_termos} · re-aceite pendente`)
                  : "sem contrato geral"}
              </span>
            )}
            {eq.pct_ok != null && (
              <span style={{
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
                color: eq.pct_ok >= 80 ? "#3fa96b" : eq.pct_ok >= 50 ? "#c7a45b" : "#d05a3b",
              }}>{eq.pct_ok.toFixed(0)}% ok</span>
            )}
            {bloqueado && eq.bloqueio_motivo && (
              <span style={{ fontFamily: fonts.inter, fontSize: 9, color: "#d05a3b", fontStyle: "italic" }}>
                {eq.bloqueio_motivo}
              </span>
            )}
          </div>
        </div>

        <span style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
          textTransform: "uppercase", color: STATUS_INFO[status].cor,
          padding: "4px 10px", border: `1px solid ${STATUS_INFO[status].cor}`,
          flexShrink: 0,
        }}>
          {STATUS_INFO[status].label}{status === "em_obra" && nAtivas > 1 ? ` · ${nAtivas}` : ""}
        </span>

        <button
          onClick={(ev) => { ev.stopPropagation(); onEditar(); }}
          style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "6px 12px",
            background: "transparent", color: t.textPrimary, border: `1px solid ${t.border2}`,
            cursor: "pointer", flexShrink: 0,
          }}
        >Editar</button>

        <a
          href={instalaHref}
          target="_blank"
          rel="noreferrer"
          onClick={(ev) => ev.stopPropagation()}
          title="Abrir instala.parket.works"
          style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "6px 12px",
            background: "transparent", color: t.textSecondary, textDecoration: "none",
            border: `1px solid ${t.border2}`, flexShrink: 0,
          }}
        >App ↗</a>
      </div>

      {aberto && (
        <div style={{ borderTop: `1px solid ${t.border1}`, padding: "4px 0 8px" }}>
          <div style={{
            padding: "6px 20px", fontFamily: fonts.cinzel, fontSize: 8,
            letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary,
          }}>Obras vinculadas</div>
          {nAtivas === 0 ? (
            <div style={{ padding: "6px 20px 10px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
              Sem obras vinculadas.
            </div>
          ) : (
            eq.obras.map((o) => <ObraRow key={o.card_id} o={o} t={t} />)
          )}

          {/* Contrato geral: assinado 1 vez no primeiro login do Instala; cada
              obra abaixo adere como anexo por OTP (F4/F5 #1988-#1989) */}
          <div style={{
            padding: "10px 20px 4px", fontFamily: fonts.cinzel, fontSize: 8,
            letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary,
          }}>Contrato geral de prestação de serviços</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 20px", borderTop: `1px solid ${t.border1}`,
            fontFamily: fonts.inter, fontSize: 11,
          }}>
            {aceiteCg ? (<>
              <span style={{
                fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                textTransform: "uppercase", padding: "3px 8px", flexShrink: 0,
                color: aceiteCg.vigente ? "#3fa96b" : "#c7a45b",
                border: `1px solid ${aceiteCg.vigente ? "#3fa96b" : "#c7a45b"}`,
              }}>{aceiteCg.vigente ? "Aceito" : "Versão antiga"}</span>
              <span style={{ flex: 1, minWidth: 0, color: t.textPrimary }}>
                Termos versão {aceiteCg.versao_termos}
                {!aceiteCg.vigente && cg && (
                  <span style={{ color: "#c7a45b" }}> (vigente é v{cg.versao_vigente}: re-aceite no próximo login)</span>
                )}
                {aceiteCg.aceito_em && (
                  <span style={{ color: t.textTertiary }}> · {new Date(aceiteCg.aceito_em).toLocaleDateString("pt-BR")}</span>
                )}
              </span>
              {aceiteCg.pdf_url && (
                <a href={aceiteCg.pdf_url} target="_blank" rel="noreferrer" style={{
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                  textTransform: "uppercase", color: t.accent, textDecoration: "underline",
                  flexShrink: 0,
                }}>PDF ↗</a>
              )}
            </>) : (
              <span style={{ color: t.textTertiary }}>
                Sem aceite: o prestador assina no próximo login do {" "}
                <a href={INSTALA_URL} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "underline" }}>Instala</a>.
              </span>
            )}
          </div>

          {/* Identificação visual do aceite (Will 02/09): selfie + assinatura
              registradas no contrato geral; clicar abre a imagem original */}
          {aceiteCg && (aceiteCg.selfie_url || aceiteCg.assinatura_url) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "4px 20px 10px", fontFamily: fonts.inter, fontSize: 9,
            }}>
              {aceiteCg.selfie_url && (
                <a href={aceiteCg.selfie_url} target="_blank" rel="noreferrer"
                   title="Registro facial do aceite"
                   style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  <img src={aceiteCg.selfie_url} alt="Selfie do aceite" style={{
                    width: 44, height: 44, objectFit: "cover", borderRadius: "50%",
                    border: `1px solid ${t.border1}`, flexShrink: 0,
                  }} />
                  <span style={{ color: t.textTertiary }}>Registro facial</span>
                </a>
              )}
              {aceiteCg.assinatura_url && (
                <a href={aceiteCg.assinatura_url} target="_blank" rel="noreferrer"
                   title="Assinatura do aceite"
                   style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  {/* PNG da assinatura sai do wizard com fundo branco + traço escuro */}
                  <img src={aceiteCg.assinatura_url} alt="Assinatura do aceite" style={{
                    height: 34, maxWidth: 120, objectFit: "contain", background: "#ffffff",
                    border: `1px solid ${t.border1}`, borderRadius: 3, padding: "2px 6px", flexShrink: 0,
                  }} />
                  <span style={{ color: t.textTertiary }}>Assinatura</span>
                </a>
              )}
            </div>
          )}

          <div style={{
            padding: "10px 20px 4px", fontFamily: fonts.cinzel, fontSize: 8,
            letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary,
          }}>Anexos de obra / termos</div>
          {loadingTermos && (
            <div style={{ padding: "6px 20px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
              carregando…
            </div>
          )}
          {!loadingTermos && termos.length === 0 && (
            <div style={{ padding: "6px 20px 10px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
              Nenhum termo gerado ainda.
            </div>
          )}
          {termos.map((tm) => {
            const aceito = tm.status === "aceito";
            const cor = aceito ? "#3fa96b" : tm.status === "pendente" ? "#c7a45b" : t.textTertiary;
            // Diferencia anexo ativado por OTP (fluxo novo) do termo legado re-assinado
            const chip = aceito
              ? (tm.contrato_aceite_id ? "Ativado" : "Assinado (legado)")
              : tm.status === "pendente" ? "Ativação pendente" : tm.status;
            return (
              <div key={tm.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 20px", borderTop: `1px solid ${t.border1}`,
                fontFamily: fonts.inter, fontSize: 11,
              }}>
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                  textTransform: "uppercase", padding: "3px 8px", flexShrink: 0,
                  color: cor, border: `1px solid ${cor}`,
                }}>{chip}</span>

                {tm.projeto_id ? (
                  <Link to={`/projetos/${tm.projeto_id}`} style={{
                    flex: 1, minWidth: 0, color: t.textPrimary, textDecoration: "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {tm.cliente || "(obra sem título)"}
                    {tm.obra_code ? <span style={{ color: t.textTertiary }}> · {tm.obra_code}</span> : null}
                  </Link>
                ) : (
                  <span style={{ flex: 1, minWidth: 0, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tm.cliente || "(obra sem título)"}
                    {tm.obra_code ? <span style={{ color: t.textTertiary }}> · {tm.obra_code}</span> : null}
                  </span>
                )}

                <span style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, flexShrink: 0 }}>
                  {tm.n_itens} {tm.n_itens === 1 ? "item" : "itens"}
                  {aceito && tm.aceito_em && ` · ${new Date(tm.aceito_em).toLocaleDateString("pt-BR")}`}
                </span>

                {tm.pdf_url && (
                  <a href={tm.pdf_url} target="_blank" rel="noreferrer" style={{
                    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                    textTransform: "uppercase", color: t.accent, textDecoration: "underline",
                    flexShrink: 0,
                  }}>PDF ↗</a>
                )}
              </div>
            );
          })}

          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "12px 20px 4px", borderTop: `1px solid ${t.border1}`, marginTop: 8,
          }}>
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
              textTransform: "uppercase", color: t.textTertiary, marginRight: "auto",
            }}>Ficha do prestador</span>
            <button onClick={onAvaliar} style={btnMini(t, t.accent)}>Avaliar</button>
            <button onClick={onMancada} style={btnMini(t, "#c7a45b")}>Mancada / elogio</button>
            {bloqueado ? (
              <button onClick={reativar} disabled={reativando} style={btnMini(t, "#3fa96b")}>
                {reativando ? "Reativando…" : "Reativar"}
              </button>
            ) : (
              <button onClick={onBloquear} style={btnMini(t, "#d05a3b")}>Bloquear</button>
            )}
          </div>

          {bloqueado && (
            <div style={{ padding: "8px 20px 0", fontFamily: fonts.inter, fontSize: 10, color: "#d05a3b" }}>
              Bloqueado{eq.bloqueado_em ? ` em ${new Date(eq.bloqueado_em).toLocaleDateString("pt-BR")}` : ""}
              {eq.bloqueado_por ? ` por ${eq.bloqueado_por}` : ""}
              {eq.bloqueio_motivo ? ` — ${eq.bloqueio_motivo}` : ""}
            </div>
          )}

          {loadingFicha && (
            <div style={{ padding: "8px 20px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
              carregando ficha…
            </div>
          )}

          {!loadingFicha && (
            <>
              <div style={{
                padding: "10px 20px 4px", fontFamily: fonts.cinzel, fontSize: 8,
                letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary,
              }}>Avaliações ({avaliacoes.length})</div>
              {avaliacoes.length === 0 && (
                <div style={{ padding: "4px 20px 6px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
                  Nenhuma avaliação ainda.
                </div>
              )}
              {avaliacoes.slice(0, 8).map((a) => {
                const media = (a.nota_qualidade + a.nota_prazo + a.nota_postura + a.nota_retrabalho) / 4;
                return (
                  <div key={a.id} style={{
                    padding: "7px 20px", borderTop: `1px solid ${t.border1}`,
                    fontFamily: fonts.inter, fontSize: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Estrelas v={media} t={t} />
                      <span style={{ color: t.textSecondary }}>{media.toFixed(1)}</span>
                      <span style={{
                        fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em",
                        textTransform: "uppercase", color: t.textSecondary,
                        border: `1px solid ${t.border2}`, padding: "2px 6px",
                      }}>{a.papel === "fiscal" ? "Fiscal" : "Gestão"}</span>
                      {a.obra && <span style={{ color: t.textPrimary }}>{a.obra}</span>}
                      <span style={{ color: t.textTertiary, marginLeft: "auto" }}>
                        {a.avaliador_nome || a.avaliador_email} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 3, color: t.textTertiary, fontSize: 9, flexWrap: "wrap" }}>
                      <span>Qualidade {a.nota_qualidade}</span>
                      <span>Prazo {a.nota_prazo}</span>
                      <span>Postura {a.nota_postura}</span>
                      <span>Retrabalho {a.nota_retrabalho}</span>
                    </div>
                    {a.comentario && (
                      <div style={{ marginTop: 3, color: t.textSecondary, fontStyle: "italic" }}>"{a.comentario}"</div>
                    )}
                  </div>
                );
              })}

              <div style={{
                padding: "10px 20px 4px", fontFamily: fonts.cinzel, fontSize: 8,
                letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary,
              }}>Mancadas & elogios ({eventos.length})</div>
              {eventos.length === 0 && (
                <div style={{ padding: "4px 20px 6px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
                  Nenhum registro.
                </div>
              )}
              {eventos.slice(0, 8).map((ev) => {
                const mancada = ev.tipo === "mancada";
                const cor = !mancada ? "#3fa96b" : ev.gravidade === "grave" ? "#d05a3b" : ev.gravidade === "media" ? "#c7a45b" : t.textSecondary;
                return (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "baseline", gap: 10,
                    padding: "6px 20px", borderTop: `1px solid ${t.border1}`,
                    fontFamily: fonts.inter, fontSize: 10, flexWrap: "wrap",
                  }}>
                    <span style={{
                      fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em",
                      textTransform: "uppercase", color: cor, border: `1px solid ${cor}`,
                      padding: "2px 6px", flexShrink: 0,
                    }}>{mancada ? `Mancada${ev.gravidade ? ` · ${ev.gravidade}` : ""}` : "Elogio"}</span>
                    <span style={{ flex: 1, minWidth: 160, color: t.textPrimary }}>
                      {ev.descricao}{ev.obra ? <span style={{ color: t.textTertiary }}> · {ev.obra}</span> : null}
                    </span>
                    <span style={{ color: t.textTertiary, flexShrink: 0 }}>
                      {ev.registrado_por ? `${ev.registrado_por} · ` : ""}{new Date(ev.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const btnMini = (t: any, cor: string): React.CSSProperties => ({
  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em",
  textTransform: "uppercase", padding: "5px 10px",
  background: "transparent", color: cor, border: `1px solid ${cor}`,
  cursor: "pointer", flexShrink: 0,
});

function ObraRow({ o, t }: { o: EquipeObra; t: any }) {
  const cor = corPorSlaStatus(o.sla_status);
  const inner = (
    <>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cor, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 11,
        color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {o.cliente || "(sem cliente)"} {o.obra_code ? <span style={{ color: t.textTertiary }}>· {o.obra_code}</span> : null}
      </span>
      <span style={{
        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textSecondary, flexShrink: 0,
      }}>{labelColuna(o.column_id)}</span>
    </>
  );
  const style: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "6px 20px", textDecoration: "none" };
  return o.projeto_id
    ? <Link to={`/projetos/${o.projeto_id}`} style={style}>{inner}</Link>
    : <div style={style}>{inner}</div>;
}

/* ─── Visão Obras x Prestadores ──────────────────────────────────────
 * É a tela que antes vivia no admin do instala.parket.works, trazida pro
 * gestão. O vínculo obra<->prestador mora em dois lugares que precisam bater:
 * kanban_cards.details.prestadores (gestão) e prestador_card (instala). O
 * endpoint devolve a união dos dois e a origem de cada vínculo, então o que
 * estiver só de um lado aparece marcado e o botão Sincronizar iguala tudo.
 * Vincular aqui também auto-cria o termo pendente da obra quando o card tem
 * projeto no gestão (mesmo fluxo da página do Projeto).
 * Visual: redesenho 08/09 no padrão da aba Prestadores (seções por fase com
 * header cinzel + paleta padrão do gestão), a pedido do Will.
 */

// Rótulos das fases do kanban. Cores na paleta PADRÃO do gestão (verde ok /
// dourado atenção / vermelho problema / azul neutro), não mais as pastéis
// herdadas do admin do instala.
const FASE_INFO: Record<string, { label: string; cor: string }> = {
  "entrada": { label: "Entrada", cor: "#8CA9B8" },
  "pendente": { label: "Pendente", cor: "#c7a45b" },
  "acompanhamento": { label: "Acompanhamento", cor: "#8CA9B8" },
  "primeira-vistoria": { label: "1ª Vistoria", cor: "#8CA9B8" },
  "segunda-vistoria": { label: "2ª Vistoria", cor: "#8CA9B8" },
  "pre-cronograma": { label: "Pré-Cronograma", cor: "#c7a45b" },
  "cronograma-final": { label: "Cronograma Final", cor: "#3fa96b" },
  "obras-liberadas": { label: "Obras Liberadas", cor: "#3fa96b" },
  "reparos": { label: "Reparos", cor: "#d05a3b" },
  "travado": { label: "Travado", cor: "#d05a3b" },
  "projeto": { label: "Projeto", cor: "#8CA9B8" },
};

// Obra que precisa de atenção primeiro aparece no topo
const PRIO_FASE: Record<string, number> = {
  "reparos": 0, "travado": 1, "segunda-vistoria": 2, "primeira-vistoria": 3,
  "pendente": 4, "entrada": 5, "pre-cronograma": 6, "acompanhamento": 7,
  "cronograma-final": 8, "obras-liberadas": 9,
};

function ObrasPrestadoresView({ t, tick, onRefresh }: {
  t: any; tick: number; onRefresh: () => void;
}) {
  const [dados, setDados] = useState<ObrasPrestadoresResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  // Dois filtros independentes: situação do vínculo (chips) + fase (select).
  // Substitui a fileira antiga de 12 chips de fase, que não escalava.
  const [filtroVinculo, setFiltroVinculo] = useState<"todas" | "sem-prestador" | "fora-sincronia">("todas");
  const [filtroFase, setFiltroFase] = useState<string>("todas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [localTick, setLocalTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.obrasPrestadores()
      .then((r) => { setDados(r); setErro(null); })
      .catch((e) => setErro(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [tick, localTick]);

  const obras = dados?.obras || [];
  const equipes = dados?.equipes || [];

  // Contagem por fase pro select do filtro
  const porFase = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of obras) {
      const k = o.column_id || "sem-fase";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [obras]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return obras.filter((o) => {
      if (filtroVinculo === "sem-prestador" && o.prestadores.length > 0) return false;
      if (filtroVinculo === "fora-sincronia" && !o.prestadores.some((p) => p.origem !== "ambos")) return false;
      if (filtroFase !== "todas" && (o.column_id || "sem-fase") !== filtroFase) return false;
      if (!q) return true;
      const hay = `${o.cliente || ""} ${o.obra_code || ""} ${o.prestadores.map((p) => p.nome).join(" ")}`;
      return hay.toLowerCase().includes(q);
    });
  }, [obras, busca, filtroVinculo, filtroFase]);

  // Seções por fase (mesma estrutura da aba Prestadores, que agrupa por
  // categoria): fase com prioridade de atenção primeiro, obra em ordem
  // alfabética dentro da seção.
  const secoes = useMemo(() => {
    const m = new Map<string, ObraComPrestadores[]>();
    for (const o of filtradas) {
      const k = o.column_id || "sem-fase";
      const arr = m.get(k) || [];
      arr.push(o);
      m.set(k, arr);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => (PRIO_FASE[a] ?? 99) - (PRIO_FASE[b] ?? 99) || a.localeCompare(b))
      .map(([fase, arr]) => [fase, arr.sort((x, y) =>
        (x.cliente || "").localeCompare(y.cliente || "", "pt-BR"))] as const);
  }, [filtradas]);

  const totalVinculos = useMemo(
    () => obras.reduce((s, o) => s + o.prestadores.length, 0), [obras]);
  const semPrestador = useMemo(
    () => obras.filter((o) => o.prestadores.length === 0).length, [obras]);
  const desalinhados = useMemo(
    () => obras.reduce((s, o) => s + o.prestadores.filter((p) => p.origem !== "ambos").length, 0),
    [obras]);

  async function vincular(cardId: string, equipeId: string, cliente: string | null) {
    setSalvando(cardId); setAviso(null);
    try {
      const r = await api.obraPrestadorAdd(cardId, equipeId);
      // Feedback do vínculo completo: card + instala + termo do projeto.
      // termo null = card sem projeto no gestão, sem itens pro anexo.
      const quem = cliente || "obra";
      setAviso(r.termo
        ? `Prestador vinculado a ${quem} no gestão e no Instala. Termo da obra criado/atualizado com ${r.termo.itens} ${r.termo.itens === 1 ? "item" : "itens"}.`
        : `Prestador vinculado a ${quem} no gestão e no Instala. Obra sem projeto no gestão: o termo é criado quando o projeto existir (vincule pela página do Projeto).`);
      setLocalTick((x) => x + 1);
      onRefresh();
    } catch (e: any) {
      setAviso(String(e?.message || e));
    } finally { setSalvando(null); }
  }

  async function desvincular(cardId: string, equipeId: string | null, prestadorId: string | null) {
    const alvo = equipeId || prestadorId;
    if (!alvo) return;
    setSalvando(cardId); setAviso(null);
    try {
      await api.obraPrestadorDel(cardId, alvo);
      setLocalTick((x) => x + 1);
      onRefresh();
    } catch (e: any) {
      setAviso(String(e?.message || e));
    } finally { setSalvando(null); }
  }

  async function sincronizar() {
    setSincronizando(true); setAviso(null);
    try {
      const r = await api.prestadoresReconciliar();
      setAviso(`Sincronizado. Instala recebeu ${r.criados_instala}, gestão recebeu ${r.criados_gestao}.`);
      setLocalTick((x) => x + 1);
      onRefresh();
    } catch (e: any) {
      setAviso(String(e?.message || e));
    } finally { setSincronizando(false); }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KPI t={t} label="Obras" v={obras.length} />
        <KPI t={t} label="Vínculos" v={totalVinculos} />
        <KPI t={t} label="Sem prestador" v={semPrestador} />
        <KPI t={t} label="Fora de sincronia" v={desalinhados} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar obra, cliente ou prestador…"
          style={{
            flex: 1, minWidth: 220, padding: "8px 12px",
            background: t.card2, border: `1px solid ${t.border1}`,
            color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.04em",
          }}
        />
        {/* Chips de situação do vínculo, no mesmo molde dos chips de status
            da aba Prestadores (cinzel + cor cheia quando ativo) */}
        {([["todas", "Todas", t.accent],
           ["sem-prestador", "Sem prestador", "#d05a3b"],
           ["fora-sincronia", "Fora de sincronia", "#c7a45b"]] as const).map(([f, label, cor]) => {
          const ativo = filtroVinculo === f;
          return (
            <button
              key={f}
              onClick={() => setFiltroVinculo(f)}
              style={{
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", padding: "7px 14px", cursor: "pointer",
                background: ativo ? cor : "transparent",
                color: ativo ? "#050505" : t.textSecondary,
                border: `1px solid ${ativo ? cor : t.border2}`,
              }}
            >{label}</button>
          );
        })}
        {/* Fase do kanban vira select: 11 fases não cabem como chips */}
        <select
          value={filtroFase}
          onChange={(e) => setFiltroFase(e.target.value)}
          style={{
            padding: "7px 10px", background: t.card2,
            border: `1px solid ${filtroFase !== "todas" ? t.accent : t.border1}`,
            color: filtroFase !== "todas" ? t.accent : t.textSecondary, outline: "none",
            fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer",
          }}
        >
          <option value="todas">Todas as fases</option>
          {Array.from(porFase.keys())
            .sort((a, b) => (PRIO_FASE[a] ?? 99) - (PRIO_FASE[b] ?? 99))
            .map((f) => (
              <option key={f} value={f}>
                {(FASE_INFO[f]?.label || labelColuna(f))} ({porFase.get(f)})
              </option>
            ))}
        </select>
        {/* Roda a reconciliação nos dois sentidos: o que existe no gestão passa
            a existir no instala e vice-versa. */}
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          title="Iguala os vínculos do gestão e do instala.parket.works"
          style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "7px 14px",
            cursor: sincronizando ? "default" : "pointer",
            background: "transparent", color: t.accent,
            border: `1px solid ${t.accent}`, opacity: sincronizando ? 0.5 : 1,
          }}
        >{sincronizando ? "Sincronizando…" : "Sincronizar com o instala"}</button>
      </div>

      {aviso && (
        <div style={{
          fontFamily: fonts.inter, fontSize: 10, color: t.textPrimary,
          background: t.card2, border: `1px solid ${t.accent}`,
          padding: "8px 12px", marginBottom: 12, lineHeight: 1.5,
        }}>{aviso}</div>
      )}

      {loading && <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>Carregando…</div>}
      {erro && <div style={{ padding: 20, color: "#d05a3b", fontFamily: fonts.inter, fontSize: 11 }}>Erro: {erro}</div>}
      {!loading && !erro && filtradas.length === 0 && (
        <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>
          Nenhuma obra encontrada.
        </div>
      )}

      {!loading && !erro && secoes.map(([fase, lista]) => (
        <section key={fase} style={{ marginBottom: 22 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          }}>
            <span style={{
              width: 8, height: 8, background: FASE_INFO[fase]?.cor || t.textTertiary,
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.24em",
              textTransform: "uppercase", color: t.accent,
            }}>
              {(FASE_INFO[fase]?.label || labelColuna(fase))} · {lista.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lista.map((o) => (
              <ObraPrestadorCard
                key={o.card_id}
                o={o} t={t} equipes={equipes}
                aberto={aberta === o.card_id}
                salvando={salvando === o.card_id}
                onToggle={() => setAberta(aberta === o.card_id ? null : o.card_id)}
                onVincular={(eid) => vincular(o.card_id, eid, o.cliente)}
                onDesvincular={(eid, pid) => desvincular(o.card_id, eid, pid)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ObraPrestadorCard({ o, t, equipes, aberto, salvando, onToggle, onVincular, onDesvincular }: {
  o: ObraComPrestadores; t: any;
  equipes: ObrasPrestadoresResp["equipes"];
  aberto: boolean; salvando: boolean;
  onToggle: () => void;
  onVincular: (equipeId: string) => void;
  onDesvincular: (equipeId: string | null, prestadorId: string | null) => void;
}) {
  const [buscaPrest, setBuscaPrest] = useState("");
  const info = FASE_INFO[o.column_id || ""];
  const semPrestador = o.prestadores.length === 0;
  // Vínculos meio-sincronizados (só gestão ou só instala): o card avisa em dourado
  const foraSync = o.prestadores.filter((p) => p.origem !== "ambos").length;
  // Esconde do seletor quem já está na obra (por equipe ou por prestador)
  const jaNaObra = new Set(o.prestadores.flatMap((p) => [p.equipe_id, p.prestador_id].filter(Boolean) as string[]));
  const candidatos = equipes.filter((e) => {
    if (jaNaObra.has(e.id) || (e.prestador_id && jaNaObra.has(e.prestador_id))) return false;
    const q = buscaPrest.trim().toLowerCase();
    if (!q) return true;
    return `${e.nome} ${e.categoria || ""}`.toLowerCase().includes(q);
  });
  // Seletor agrupado por categoria (INSTALADOR, MARCENEIRO...) pra escolha rápida
  const porCategoria = new Map<string, typeof candidatos>();
  for (const e of candidatos) {
    const cat = (e.categoria || "SEM CATEGORIA").toUpperCase();
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(e);
  }
  const categorias = Array.from(porCategoria.keys()).sort();

  return (
    <div style={{ border: `1px solid ${t.border1}`, background: t.card2 }}>
      {/* Linha fechada: toggle + cliente + resumo + fase + ação, no padrão EquipeCard */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", cursor: "pointer", minWidth: 0,
        }}
      >
        <button
          onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
          style={{
            width: 26, height: 26, padding: 0, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: t.card1, border: `1px solid ${t.border2}`,
            color: t.textSecondary, fontSize: 11, cursor: "pointer",
          }}
        >{aberto ? "▾" : "▸"}</button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.14em",
              color: t.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{o.cliente || "Sem cliente"}</span>
            {o.obra_code && (
              <span style={{
                fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em",
                textTransform: "uppercase", color: t.textSecondary,
                border: `1px solid ${t.border1}`, padding: "2px 6px",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>{o.obra_code}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.08em",
              color: semPrestador ? "#d05a3b" : t.textSecondary,
            }}>
              {semPrestador ? "sem prestador"
                : `${o.prestadores.length} ${o.prestadores.length === 1 ? "prestador" : "prestadores"}`}
            </span>
            {foraSync > 0 && (
              <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.08em", color: "#c7a45b" }}>
                {foraSync} fora de sincronia
              </span>
            )}
            {!semPrestador && (
              <span style={{
                fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340,
              }}>
                {o.prestadores.map((p) => p.nome).join(" · ")}
              </span>
            )}
          </div>
        </div>

        {info && (
          <span style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.14em",
            textTransform: "uppercase", padding: "4px 10px", flexShrink: 0,
            color: info.cor, border: `1px solid ${info.cor}`,
          }}>{info.label}</span>
        )}
        {o.projeto_id && (
          <Link
            to={`/projetos/${o.projeto_id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.14em",
              textTransform: "uppercase", padding: "5px 10px", flexShrink: 0,
              color: t.textSecondary, border: `1px solid ${t.border2}`,
              textDecoration: "none",
            }}
          >Abrir obra</Link>
        )}
      </div>

      {aberto && (
        <div style={{ borderTop: `1px solid ${t.border1}`, padding: "12px 14px 14px", background: t.card1 }}>
          {/* Vinculados: chip com nome + categoria; dourado quando o vínculo só existe de um lado */}
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.2em",
                        textTransform: "uppercase", color: t.accent, marginBottom: 8 }}>
            Vinculados · {o.prestadores.length}
          </div>
          {semPrestador && (
            <div style={{ fontFamily: fonts.inter, fontSize: 10, color: "#d05a3b", marginBottom: 12 }}>
              Nenhum prestador vinculado a esta obra.
            </div>
          )}
          {!semPrestador && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {o.prestadores.map((p) => (
                <span
                  key={(p.equipe_id || p.prestador_id || p.nome) as string}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: t.card2, border: `1px solid ${p.origem === "ambos" ? t.border1 : "#c7a45b"}`,
                    padding: "5px 8px 5px 10px",
                  }}
                >
                  <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textPrimary }}>{p.nome}</span>
                  {p.categoria && (
                    <span style={{ fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.1em",
                                   textTransform: "uppercase", color: t.textTertiary }}>{p.categoria}</span>
                  )}
                  {p.origem !== "ambos" && (
                    <span
                      title="Vínculo existe só de um lado. Use Sincronizar com o instala."
                      style={{ fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.1em",
                               textTransform: "uppercase", color: "#c7a45b" }}
                    >só {p.origem}</span>
                  )}
                  <button
                    onClick={() => onDesvincular(p.equipe_id, p.prestador_id)}
                    disabled={salvando}
                    title="Desvincular desta obra"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: t.textTertiary, fontSize: 12, lineHeight: 1, padding: 0,
                    }}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          {/* Adicionar: busca + candidatos agrupados por categoria */}
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.2em",
                        textTransform: "uppercase", color: t.accent, marginBottom: 8 }}>
            Adicionar prestador
          </div>
          <input
            value={buscaPrest}
            onChange={(e) => setBuscaPrest(e.target.value)}
            placeholder="Filtrar prestador…"
            style={{
              width: "100%", maxWidth: 320, padding: "6px 10px", marginBottom: 10,
              background: t.card2, border: `1px solid ${t.border1}`,
              color: t.textPrimary, outline: "none",
              fontFamily: fonts.inter, fontSize: 10,
            }}
          />
          <div style={{ maxHeight: 220, overflow: "auto" }}>
            {categorias.map((cat) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.18em",
                              textTransform: "uppercase", color: t.textTertiary, marginBottom: 6 }}>
                  {cat} · {porCategoria.get(cat)!.length}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {porCategoria.get(cat)!.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onVincular(e.id)}
                      disabled={salvando}
                      style={{
                        fontFamily: fonts.inter, fontSize: 10, padding: "5px 10px",
                        cursor: salvando ? "default" : "pointer",
                        background: "transparent", color: t.textSecondary,
                        border: `1px solid ${t.border2}`,
                        opacity: salvando ? 0.5 : 1,
                      }}
                    >+ {e.nome}</button>
                  ))}
                </div>
              </div>
            ))}
            {candidatos.length === 0 && (
              <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
                Nenhum prestador disponível para adicionar.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Modal: cadastrar prestador novo ────────────────────────────── */

function NovoPrestadorModal({ t, onFechar, onSaved }: {
  t: any; onFechar: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [categoria, setCategoria] = useState("INSTALADOR");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) { setErro("Informe o nome"); return; }
    setSalvando(true); setErro(null);
    try {
      await api.equipeCreate({
        nome: nome.trim(), categoria: categoria.trim().toUpperCase(),
        telefone: telefone || null, cnpj_cpf: cnpj || null,
        email: email || null, endereco: endereco || null, ativo: true,
      });
      onSaved();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setSalvando(false); }
  }

  return (
    <ModalShell t={t} title="NOVO PRESTADOR" onFechar={onFechar}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Campo label="Nome" value={nome} onChange={setNome} t={t} full />
        <Campo label="Categoria" value={categoria} onChange={setCategoria} t={t} />
        <Campo label="Telefone" value={telefone} onChange={setTelefone} t={t} />
        <Campo label="CNPJ / CPF" value={cnpj} onChange={setCnpj} t={t} />
        <Campo label="Email" value={email} onChange={setEmail} t={t} />
        <Campo label="Endereço" value={endereco} onChange={setEndereco} t={t} full />
      </div>
      <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 10, lineHeight: 1.6 }}>
        O cadastro entra em equipes_parket. O login do app é gerado depois, em Acessos do app.
      </div>
      {erro && <div style={{ color: "#d05a3b", marginTop: 10, fontFamily: fonts.inter, fontSize: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={btnAccent(t)}>
          {salvando ? "Salvando…" : "Cadastrar"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Modal: editar cadastro da equipe ───────────────────────────── */

function EditarEquipeModal({ eq, t, onFechar, onSaved }: {
  eq: EquipeComObras; t: any; onFechar: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState(eq.nome);
  const [telefone, setTelefone] = useState(eq.telefone || "");
  const [cnpj, setCnpj] = useState((eq as any).cnpj_cpf || "");
  const [endereco, setEndereco] = useState((eq as any).endereco || "");
  const [email, setEmail] = useState((eq as any).email || "");
  const [foto, setFoto] = useState((eq as any).foto_url || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await api.equipePatch(eq.id, {
        nome, telefone: telefone || null, cnpj_cpf: cnpj || null,
        endereco: endereco || null, email: email || null,
        foto_url: foto || null, categoria: eq.categoria,
      });
      onSaved();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setSalvando(false); }
  }

  return (
    <ModalShell t={t} title={`EDITAR · ${eq.nome}`} onFechar={onFechar}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Campo label="Nome"     value={nome}     onChange={setNome} t={t} full />
        <Campo label="Telefone" value={telefone} onChange={setTelefone} t={t} />
        <Campo label="CNPJ / CPF" value={cnpj}   onChange={setCnpj} t={t} />
        <Campo label="Email"    value={email}    onChange={setEmail} t={t} />
        <Campo label="Endereço" value={endereco} onChange={setEndereco} t={t} full />
        <Campo label="Foto (URL)" value={foto}   onChange={setFoto} t={t} full />
      </div>
      {erro && <div style={{ color: "#d05a3b", marginTop: 10, fontFamily: fonts.inter, fontSize: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={btnAccent(t)}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Modal: avaliar prestador (fiscal / gestão) ─────────────────── */

function AvaliarModal({ eq, t, onFechar, onOk }: {
  eq: EquipeComObras; t: any; onFechar: () => void; onOk: () => void;
}) {
  const [papel, setPapel] = useState<"fiscal" | "gestao">("gestao");
  const [obraIdx, setObraIdx] = useState<number>(-1);
  const [obraLivre, setObraLivre] = useState("");
  const [notas, setNotas] = useState({ qualidade: 0, prazo: 0, postura: 0, retrabalho: 0 });
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criterios: Array<[keyof typeof notas, string]> = [
    ["qualidade", "Qualidade / acabamento"],
    ["prazo", "Prazo"],
    ["postura", "Postura / comunicação"],
    ["retrabalho", "Retrabalho"],
  ];

  async function enviar() {
    if (Object.values(notas).some((n) => n < 1)) { setErro("Dê nota de 1 a 5 nos 4 critérios"); return; }
    const obraSel = obraIdx >= 0 ? eq.obras[obraIdx] : null;
    setEnviando(true); setErro(null);
    try {
      await api.equipeAvaliar(eq.id, {
        nota_qualidade: notas.qualidade,
        nota_prazo: notas.prazo,
        nota_postura: notas.postura,
        nota_retrabalho: notas.retrabalho,
        papel,
        card_id: obraSel?.card_id || null,
        obra: obraSel ? (obraSel.cliente || null) : (obraLivre.trim() || null),
        comentario: comentario.trim() || null,
      });
      onOk();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setEnviando(false); }
  }

  return (
    <ModalShell t={t} title={`AVALIAR · ${eq.nome}`} onFechar={onFechar}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {(["fiscal", "gestao"] as const).map((p) => (
          <button key={p} onClick={() => setPapel(p)} style={{
            flex: 1, padding: "8px 0", cursor: "pointer",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            background: papel === p ? t.accent : "transparent",
            color: papel === p ? "#050505" : t.textSecondary,
            border: `1px solid ${papel === p ? t.accent : t.border2}`,
          }}>{p === "fiscal" ? "Fiscal da obra" : "Gestão"}</button>
        ))}
      </div>

      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
      }}>Obra avaliada</div>
      {eq.obras.length > 0 ? (
        <select
          value={obraIdx}
          onChange={(e) => setObraIdx(Number(e.target.value))}
          style={{
            width: "100%", padding: "7px 10px", background: t.card2,
            border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 11, marginBottom: 14,
          }}
        >
          <option value={-1}>— sem obra específica —</option>
          {eq.obras.map((o, i) => (
            <option key={o.card_id} value={i}>{o.cliente || o.card_id}{o.obra_code ? ` · ${o.obra_code}` : ""}</option>
          ))}
        </select>
      ) : (
        <input
          value={obraLivre}
          onChange={(e) => setObraLivre(e.target.value)}
          placeholder="Nome da obra (opcional)"
          style={{
            width: "100%", padding: "7px 10px", background: t.card2,
            border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 11, marginBottom: 14,
          }}
        />
      )}

      {criterios.map(([k, label]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textPrimary }}>{label}</span>
          <EstrelasInput v={notas[k]} onChange={(n) => setNotas((prev) => ({ ...prev, [k]: n }))} t={t} />
        </div>
      ))}

      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textTertiary, margin: "8px 0 4px",
      }}>Comentário (opcional)</div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        style={{
          width: "100%", padding: "7px 10px", background: t.card2,
          border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
          fontFamily: fonts.inter, fontSize: 11, resize: "vertical",
        }}
      />

      {erro && <div style={{ color: "#d05a3b", marginTop: 10, fontFamily: fonts.inter, fontSize: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Cancelar</button>
        <button onClick={enviar} disabled={enviando} style={btnAccent(t)}>
          {enviando ? "Enviando…" : "Salvar avaliação"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Modal: registrar mancada / elogio ──────────────────────────── */

function MancadaModal({ eq, t, onFechar, onOk }: {
  eq: EquipeComObras; t: any; onFechar: () => void; onOk: () => void;
}) {
  const [tipo, setTipo] = useState<"mancada" | "elogio">("mancada");
  const [gravidade, setGravidade] = useState<"leve" | "media" | "grave">("media");
  const [descricao, setDescricao] = useState("");
  const [obraIdx, setObraIdx] = useState<number>(-1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!descricao.trim()) { setErro("Descreva o que aconteceu"); return; }
    const obraSel = obraIdx >= 0 ? eq.obras[obraIdx] : null;
    setEnviando(true); setErro(null);
    try {
      await api.equipeEvento(eq.id, {
        tipo,
        gravidade: tipo === "mancada" ? gravidade : undefined,
        descricao: descricao.trim(),
        card_id: obraSel?.card_id || null,
        obra: obraSel?.cliente || null,
      });
      onOk();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setEnviando(false); }
  }

  return (
    <ModalShell t={t} title={`REGISTRO · ${eq.nome}`} onFechar={onFechar}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {(["mancada", "elogio"] as const).map((tp) => {
          const cor = tp === "mancada" ? "#d05a3b" : "#3fa96b";
          const ativo = tipo === tp;
          return (
            <button key={tp} onClick={() => setTipo(tp)} style={{
              flex: 1, padding: "8px 0", cursor: "pointer",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              background: ativo ? cor : "transparent",
              color: ativo ? "#050505" : t.textSecondary,
              border: `1px solid ${ativo ? cor : t.border2}`,
            }}>{tp === "mancada" ? "Mancada" : "Elogio"}</button>
          );
        })}
      </div>

      {tipo === "mancada" && (
        <>
          <div style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
            textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
          }}>Gravidade</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["leve", "media", "grave"] as const).map((g) => {
              const ativo = gravidade === g;
              const cor = g === "grave" ? "#d05a3b" : g === "media" ? "#c7a45b" : t.textSecondary;
              return (
                <button key={g} onClick={() => setGravidade(g)} style={{
                  flex: 1, padding: "7px 0", cursor: "pointer",
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
                  background: ativo ? cor : "transparent",
                  color: ativo ? "#050505" : t.textSecondary,
                  border: `1px solid ${ativo ? cor : t.border2}`,
                }}>{g === "media" ? "Média" : g}</button>
              );
            })}
          </div>
        </>
      )}

      {eq.obras.length > 0 && (
        <>
          <div style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
            textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
          }}>Obra (opcional)</div>
          <select
            value={obraIdx}
            onChange={(e) => setObraIdx(Number(e.target.value))}
            style={{
              width: "100%", padding: "7px 10px", background: t.card2,
              border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
              fontFamily: fonts.inter, fontSize: 11, marginBottom: 14,
            }}
          >
            <option value={-1}>— sem obra específica —</option>
            {eq.obras.map((o, i) => (
              <option key={o.card_id} value={i}>{o.cliente || o.card_id}{o.obra_code ? ` · ${o.obra_code}` : ""}</option>
            ))}
          </select>
        </>
      )}

      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
      }}>O que aconteceu</div>
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={4}
        placeholder={tipo === "mancada" ? "Ex.: abandonou a obra 2 dias sem avisar…" : "Ex.: entregou antes do prazo com acabamento impecável…"}
        style={{
          width: "100%", padding: "7px 10px", background: t.card2,
          border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
          fontFamily: fonts.inter, fontSize: 11, resize: "vertical",
        }}
      />

      {erro && <div style={{ color: "#d05a3b", marginTop: 10, fontFamily: fonts.inter, fontSize: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Cancelar</button>
        <button onClick={enviar} disabled={enviando} style={btnAccent(t)}>
          {enviando ? "Enviando…" : "Registrar"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Modal: bloquear prestador ──────────────────────────────────── */

function BloquearModal({ eq, t, onFechar, onOk }: {
  eq: EquipeComObras; t: any; onFechar: () => void; onOk: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!motivo.trim()) { setErro("Motivo é obrigatório"); return; }
    setEnviando(true); setErro(null);
    try {
      await api.equipeBloquear(eq.id, motivo.trim());
      onOk();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setEnviando(false); }
  }

  return (
    <ModalShell t={t} title={`BLOQUEAR · ${eq.nome}`} onFechar={onFechar}>
      <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
        Prestador bloqueado <b style={{ color: "#d05a3b" }}>sai do banco ativo</b>: não aparece pra vincular
        em obra nova até ser reativado. O histórico (avaliações, obras, termos) fica preservado.
      </div>
      {eq.obras.length > 0 && (
        <div style={{ fontFamily: fonts.inter, fontSize: 10, color: "#c7a45b", marginBottom: 12 }}>
          Atenção: essa equipe está em {eq.obras.length} {eq.obras.length === 1 ? "obra ativa" : "obras ativas"}.
          O bloqueio não desvincula as obras em andamento.
        </div>
      )}
      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
      }}>Motivo do bloqueio (obrigatório)</div>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={4}
        placeholder="Ex.: sumiu no meio da obra da MARIANA E BRUNO, 3 mancadas graves…"
        style={{
          width: "100%", padding: "7px 10px", background: t.card2,
          border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
          fontFamily: fonts.inter, fontSize: 11, resize: "vertical",
        }}
      />
      {erro && <div style={{ color: "#d05a3b", marginTop: 10, fontFamily: fonts.inter, fontSize: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Cancelar</button>
        <button onClick={enviar} disabled={enviando} style={{
          ...btnAccent(t), background: "#d05a3b",
        }}>{enviando ? "Bloqueando…" : "Bloquear prestador"}</button>
      </div>
    </ModalShell>
  );
}

/* ─── Acessos do instala (login + senha por prestador) ───────────── */

/** Lista de acesso do app instala.parket.works.
 *  Mostra login e senha em claro (o Will pediu senha visível), com botão de
 *  copiar, gerar acesso pra quem ainda não tem e resetar senha de quem já tem.
 *  O backend gateia por superadmin ou allowlist (planejamento@parket.com.br);
 *  quando barra, volta 403 e a lista mostra o aviso em vez dos dados. */
function AcessosModal({ t, onFechar }: { t: any; onFechar: () => void }) {
  const [linhas, setLinhas] = useState<PrestadorAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [negado, setNegado] = useState(false);
  const [busca, setBusca] = useState("");
  const [soSemAcesso, setSoSemAcesso] = useState(false);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  // Edição manual do acesso: prestador em edição + os dois campos do rascunho
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ login: string; senha: string }>({ login: "", senha: "" });

  function carregar() {
    setLoading(true);
    api.prestadorAcessos()
      .then((r) => { setLinhas(r); setErro(null); setNegado(false); })
      .catch((e) => {
        const msg = String(e?.message || e);
        if (msg.startsWith("403")) setNegado(true); else setErro(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (soSemAcesso && l.tem_acesso) return false;
      if (!q) return true;
      const hay = `${l.nome || ""} ${l.login || ""} ${l.telefone || ""} ${l.equipes.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [linhas, busca, soSemAcesso]);

  const comAcesso = linhas.filter((l) => l.tem_acesso).length;

  async function copiar(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado((c) => (c === id ? null : c)), 1500);
    } catch { /* clipboard bloqueado: o texto já está visível na tela */ }
  }

  async function gerarOuResetar(l: PrestadorAcesso) {
    if (l.tem_acesso && !window.confirm(
      `Resetar a senha de ${l.nome}? O login continua ${l.login}, mas a senha atual para de funcionar no instala.`
    )) return;
    setTrabalhando(l.prestador_id);
    try {
      const r = await api.prestadorAcessoSet(l.prestador_id);
      setLinhas((prev) => prev.map((x) => x.prestador_id === l.prestador_id
        ? { ...x, login: r.login, senha: r.senha, tem_acesso: true }
        : x));
    } catch (e: any) {
      window.alert(`Não deu pra gerar o acesso: ${String(e?.message || e)}`);
    } finally { setTrabalhando(null); }
  }

  /** Abre a linha em modo edição já preenchida com o acesso atual. Quem ainda
   *  não tem acesso começa com os campos vazios e sai daqui com acesso criado. */
  function abrirEdicao(l: PrestadorAcesso) {
    setEditando(l.prestador_id);
    setRascunho({ login: l.login || "", senha: l.senha || "" });
  }

  /** Salva login e senha digitados. Mesmo endpoint do gerar/resetar: o backend
   *  faz upsert e recusa (409) se o login já for de outro prestador. */
  async function salvarEdicao(l: PrestadorAcesso) {
    const login = rascunho.login.trim().toLowerCase();
    const senha = rascunho.senha.trim();
    if (!login || !senha) { window.alert("Preencha login e senha."); return; }
    setTrabalhando(l.prestador_id);
    try {
      const r = await api.prestadorAcessoSet(l.prestador_id, { login, senha });
      setLinhas((prev) => prev.map((x) => x.prestador_id === l.prestador_id
        ? { ...x, login: r.login, senha: r.senha, tem_acesso: true }
        : x));
      setEditando(null);
    } catch (e: any) {
      window.alert(`Não deu pra salvar o acesso: ${String(e?.message || e)}`);
    } finally { setTrabalhando(null); }
  }

  return (
    <ModalShell t={t} title="ACESSOS DO INSTALA" onFechar={onFechar} wide>
      {negado ? (
        <div style={{ fontFamily: fonts.inter, fontSize: 11, color: "#c7a45b", lineHeight: 1.6 }}>
          Você não tem permissão para ver ou gerar acesso de prestador.
          A lista é liberada só para <b>planejamento@parket.com.br</b> e para os admins gerais (superadmin).
        </div>
      ) : (
        <>
          <div style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, marginBottom: 12, lineHeight: 1.6 }}>
            Login e senha que o prestador usa em <a href={INSTALA_URL} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "underline" }}>{INSTALA_URL}</a>.
            Ele entra uma vez só no aparelho: a sessão fica salva. Resetar a senha mantém o mesmo login.
            Em Editar dá pra trocar login e senha na mão; o login não pode repetir o de outro prestador.
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, login, telefone…"
              style={{
                flex: 1, minWidth: 200, padding: "7px 10px", background: t.card2,
                border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
                fontFamily: fonts.inter, fontSize: 11,
              }}
            />
            <button
              onClick={() => setSoSemAcesso((v) => !v)}
              style={{
                ...btnGhost(t),
                padding: "7px 12px",
                color: soSemAcesso ? "#050505" : t.textSecondary,
                background: soSemAcesso ? t.accent : "transparent",
                border: `1px solid ${soSemAcesso ? t.accent : t.border2}`,
              }}
            >Sem acesso</button>
            <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
              {comAcesso}/{linhas.length} com acesso
            </span>
          </div>

          {loading && <div style={{ padding: 16, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>Carregando…</div>}
          {erro && <div style={{ padding: 16, color: "#d05a3b", fontFamily: fonts.inter, fontSize: 11 }}>Erro: {erro}</div>}
          {!loading && !erro && filtrados.length === 0 && (
            <div style={{ padding: 16, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>
              Nenhum prestador encontrado.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtrados.map((l) => (
              <div key={l.prestador_id} style={{
                display: "grid", gridTemplateColumns: "1.1fr 1.3fr 0.9fr auto",
                gap: 10, alignItems: "center",
                background: t.card2, border: `1px solid ${t.border1}`, padding: "8px 10px",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.nome || "—"}
                  </div>
                  <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                    {l.categoria || "—"}
                    {!l.no_gestao && <span style={{ color: "#c7a45b" }}> · fora da lista de equipes</span>}
                    {l.ativo === false && <span style={{ color: "#d05a3b" }}> · inativo</span>}
                  </div>
                </div>

                {/* Login: texto clicável pra copiar, ou input quando em edição */}
                <div style={{ minWidth: 0 }}>
                  {editando === l.prestador_id ? (
                    <input
                      value={rascunho.login}
                      onChange={(e) => setRascunho((r) => ({ ...r, login: e.target.value }))}
                      placeholder="nome.instalador@parket.com.br"
                      autoCapitalize="none" autoCorrect="off" spellCheck={false}
                      style={{
                        width: "100%", padding: "5px 8px", background: t.card1,
                        border: `1px solid ${t.border2}`, color: t.textPrimary, outline: "none",
                        fontFamily: fonts.inter, fontSize: 11,
                      }}
                    />
                  ) : l.tem_acesso ? (
                    <button
                      onClick={() => copiar(`${l.prestador_id}:login`, l.login || "")}
                      title="Copiar login"
                      style={{
                        background: "transparent", border: "none", padding: 0, cursor: "pointer",
                        fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary,
                        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >{copiado === `${l.prestador_id}:login` ? "copiado" : l.login}</button>
                  ) : (
                    <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>sem acesso</span>
                  )}
                </div>

                {/* Senha: mesma lógica do login */}
                <div>
                  {editando === l.prestador_id ? (
                    <input
                      value={rascunho.senha}
                      onChange={(e) => setRascunho((r) => ({ ...r, senha: e.target.value }))}
                      placeholder="senha"
                      autoCapitalize="none" autoCorrect="off" spellCheck={false}
                      style={{
                        width: "100%", padding: "5px 8px", background: t.card1,
                        border: `1px solid ${t.border2}`, color: t.textPrimary, outline: "none",
                        fontFamily: fonts.inter, fontSize: 11,
                      }}
                    />
                  ) : l.tem_acesso ? (
                    <button
                      onClick={() => copiar(`${l.prestador_id}:senha`, l.senha || "")}
                      title="Copiar senha"
                      style={{
                        background: "transparent", border: "none", padding: 0, cursor: "pointer",
                        fontFamily: fonts.inter, fontSize: 11, color: t.accent,
                      }}
                    >{copiado === `${l.prestador_id}:senha` ? "copiado" : l.senha}</button>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {editando === l.prestador_id ? (
                    <>
                      <button
                        onClick={() => salvarEdicao(l)}
                        disabled={trabalhando === l.prestador_id}
                        style={{
                          ...btnGhost(t), padding: "6px 12px", fontSize: 8, whiteSpace: "nowrap",
                          color: "#050505", background: t.accent, border: `1px solid ${t.accent}`,
                        }}
                      >{trabalhando === l.prestador_id ? "…" : "Salvar"}</button>
                      <button
                        onClick={() => setEditando(null)}
                        style={{ ...btnGhost(t), padding: "6px 10px", fontSize: 8, whiteSpace: "nowrap" }}
                      >Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => abrirEdicao(l)}
                        style={{ ...btnGhost(t), padding: "6px 10px", fontSize: 8, whiteSpace: "nowrap" }}
                      >Editar</button>
                      <button
                        onClick={() => gerarOuResetar(l)}
                        disabled={trabalhando === l.prestador_id}
                        style={{ ...btnGhost(t), padding: "6px 12px", fontSize: 8, whiteSpace: "nowrap" }}
                      >
                        {trabalhando === l.prestador_id ? "…" : l.tem_acesso ? "Resetar senha" : "Gerar acesso"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onFechar} style={btnGhost(t)}>Fechar</button>
      </div>
    </ModalShell>
  );
}

/* ─── Shell + primitivas ─────────────────────────────────────────── */

function ModalShell({ t, title, onFechar, children, wide }: {
  t: any; title: string; onFechar: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        // modalBg (opaco) e nao card1 (translucido): sobre o overlay preto o
        // card1 deixava o texto do modal ilegivel no tema claro
        background: t.modalBg, border: `1px solid ${t.border1}`,
        padding: 22, minWidth: 420, maxWidth: wide ? 720 : 520, width: "94%",
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", color: t.textPrimary }}>
            {title}
          </div>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: t.textSecondary,
            fontSize: 18, cursor: "pointer", padding: 0,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, t, full }: {
  label: string; value: string; onChange: (v: string) => void; t: any; full?: boolean;
}) {
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
      }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "7px 10px", background: t.card2,
          border: `1px solid ${t.border1}`, color: t.textPrimary, outline: "none",
          fontFamily: fonts.inter, fontSize: 11,
        }}
      />
    </label>
  );
}

const btnAccent = (t: any): React.CSSProperties => ({
  padding: "8px 18px", background: t.accent, color: "#050505",
  border: "none", cursor: "pointer",
  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
});
const btnGhost = (t: any): React.CSSProperties => ({
  padding: "8px 18px", background: "transparent", color: t.textSecondary,
  border: `1px solid ${t.border2}`, cursor: "pointer",
  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
});
