import { useEffect, useState, type CSSProperties } from "react";
import { fonts, DARK } from "../theme";
import { api, fmtBr, type Relatorio, type RelatorioInsights } from "../api";

/* ═══════════════════════════════════════════════════════════════════
   RELATÓRIO · saúde do setor de Projetos (BI, só gestora).
   Blocos: KPIs de topo, Insights da IA (cache 24h + botão Atualizar),
   Funil por fase, Time por projetista, Alertas acionáveis (atrasos
   reais / parados 30d+ / liberação pendente) e Mix Revestimento x
   Marcenaria por fase. Todo card citado é clicável e abre o CardModal.
   ═══════════════════════════════════════════════════════════════════ */

type Tokens = typeof DARK;

const PRIO_COR: Record<string, string> = { alta: "#EF4444", media: "#F59E0B", baixa: "#8590A2" };

export default function RelatorioView({ t, onOpen }: { t: Tokens; onOpen: (cardId: string) => void }) {
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState("");
  const [ins, setIns] = useState<RelatorioInsights | null>(null);
  const [insErro, setInsErro] = useState("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    api.relatorio().then(setRel).catch(e => setErro(String(e)));
    // Insights entram em paralelo: se não tem cache o backend chama a IA
    // na primeira abertura do dia (pode demorar alguns segundos).
    api.relatorioInsights().then(setIns).catch(e => setInsErro(String(e)));
  }, []);

  const atualizarAnalise = async () => {
    setGerando(true); setInsErro("");
    try { setIns(await api.relatorioInsights(true)); }
    catch (e) { setInsErro(String(e)); }
    finally { setGerando(false); }
  };

  if (erro) return <div style={{ padding: 22, fontSize: 11, color: "#EF4444" }}>{erro}</div>;
  if (!rel) return (
    <div style={{
      margin: "60px auto", fontFamily: fonts.cinzel, fontSize: 10,
      letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary,
    }}>Carregando relatório…</div>
  );

  const k = rel.kpis;
  // Ordem visual dos KPIs: primeiro o que exige ação, depois contexto.
  const kpis: { label: string; valor: number; cor?: string; hint: string }[] = [
    { label: "Cards abertos", valor: k.cards_abertos, hint: "Cards não arquivados fora das listas de template" },
    { label: "Fila de entrada", valor: k.fila_entrada, cor: k.fila_entrada > 40 ? "#F59E0B" : undefined, hint: "Cards em CONTRATOS NOVOS aguardando triagem" },
    { label: "Sem responsável", valor: k.sem_responsavel, cor: k.sem_responsavel > 0 ? "#F59E0B" : undefined, hint: "Cards sem projetista delegado no app" },
    { label: "Atrasos reais", valor: k.atrasos_reais, cor: k.atrasos_reais > 0 ? "#EF4444" : "#10B981", hint: "Prazo do projetista vencido em fase de projeto" },
    { label: "Parados 30d+", valor: k.parados_30d, cor: k.parados_30d > 0 ? "#EF4444" : "#10B981", hint: "Cards sem atividade há mais de 30 dias em fase ativa" },
    { label: "Liberação pendente", valor: k.cards_liberacao_pendente, cor: k.cards_liberacao_pendente > 0 ? "#F59E0B" : undefined, hint: "Cards com item do gestão ainda não liberado pra produção" },
    { label: "Prazos sujos", valor: k.prazos_sujos, cor: k.prazos_sujos > 0 ? "#8590A2" : undefined, hint: "Prazo vencido em card já em obra ou finalizado: limpar, não cobrar" },
    { label: "Due Trello vencido", valor: k.due_vencido, hint: "Data de entrega do card Trello vencida e não concluída" },
  ];

  const secTitulo = (txt: string) => (
    <div style={{
      fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em",
      textTransform: "uppercase", color: t.textSecondary, margin: "26px 0 10px", fontWeight: 600,
    }}>{txt}</div>
  );
  const th: CSSProperties = {
    textAlign: "left", padding: "6px 10px", fontSize: 8.5, letterSpacing: "0.1em",
    textTransform: "uppercase", color: t.textTertiary, borderBottom: `1px solid ${t.border2}`,
    whiteSpace: "nowrap",
  };
  const td: CSSProperties = {
    padding: "6px 10px", fontSize: 10.5, color: t.textPrimary,
    borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap",
  };
  const linkCard = (id: string, nome: string) => (
    <button onClick={() => onOpen(id)} title="Abrir card" style={{
      background: "transparent", border: "none", padding: 0, cursor: "pointer",
      color: t.accent, fontSize: 10.5, textAlign: "left", textDecoration: "underline",
    }}>{nome}</button>
  );

  const maxFunil = Math.max(1, ...rel.funil.map(f => f.cards));

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 26px 40px" }}>
      {/* ─── KPIs ─── */}
      <div style={{
        display: "grid", gap: 10,
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
      }}>
        {kpis.map(kp => (
          <div key={kp.label} title={kp.hint} style={{
            background: t.card1, border: `1px solid ${t.border1}`, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: kp.cor || t.textPrimary, lineHeight: 1 }}>
              {kp.valor}
            </div>
            <div style={{
              fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
              color: t.textTertiary, marginTop: 6,
            }}>{kp.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Insights da IA ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {secTitulo("Insights da IA")}
        <div style={{ flex: 1 }} />
        {ins && (
          <span style={{ fontSize: 9, color: t.textTertiary, marginTop: 16 }}>
            {ins.cache ? "análise de " : "gerado agora, "}
            {new Date(ins.gerado_em).toLocaleString("pt-BR").slice(0, 17)}
          </span>
        )}
        <button onClick={atualizarAnalise} disabled={gerando} style={{
          fontFamily: fonts.cinzel, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase",
          padding: "6px 12px", cursor: "pointer", background: "transparent",
          border: `1px solid ${t.accent}`, color: t.accent, marginTop: 16,
          opacity: gerando ? 0.5 : 1,
        }}>{gerando ? "Analisando…" : "Atualizar análise"}</button>
      </div>
      {insErro && <div style={{ fontSize: 10, color: "#EF4444", marginBottom: 8 }}>{insErro}</div>}
      {!ins && !insErro && (
        <div style={{ fontSize: 10, color: t.textTertiary }}>Gerando análise, aguarde…</div>
      )}
      {ins && (
        <div style={{ display: "grid", gap: 8 }}>
          {ins.insights.map((i, idx) => (
            <div key={idx} style={{
              background: t.card1, border: `1px solid ${t.border1}`,
              borderLeft: `3px solid ${PRIO_COR[i.prioridade] || t.border2}`,
              padding: "10px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary }}>{i.titulo}</span>
                <span style={{
                  fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: PRIO_COR[i.prioridade] || t.textTertiary, fontWeight: 700,
                }}>{i.prioridade}</span>
              </div>
              <div style={{ fontSize: 10.5, color: t.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                {i.detalhe}
              </div>
            </div>
          ))}
          {ins.insights.length === 0 && (
            <div style={{ fontSize: 10, color: t.textTertiary }}>A IA não devolveu recomendações.</div>
          )}
        </div>
      )}

      {/* ─── Funil por fase ─── */}
      {secTitulo("Funil por fase")}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Fase</th><th style={th}>Cards</th><th style={{ ...th, width: "30%" }}></th>
            <th style={th}>Sem resp.</th><th style={th}>Due vencido</th>
            <th style={th}>Parado méd.</th><th style={th}>Parado máx.</th>
          </tr></thead>
          <tbody>
            {rel.funil.map(f => (
              <tr key={f.fase}>
                <td style={td}>{f.fase}</td>
                <td style={{ ...td, fontWeight: 700 }}>{f.cards}</td>
                <td style={{ ...td, minWidth: 120 }}>
                  <div style={{
                    height: 8, width: `${Math.round((f.cards / maxFunil) * 100)}%`,
                    minWidth: 2, background: t.accent, opacity: 0.75,
                  }} />
                </td>
                <td style={{ ...td, color: f.sem_resp > 0 ? "#F59E0B" : t.textTertiary }}>{f.sem_resp}</td>
                <td style={{ ...td, color: f.due_vencido > 0 ? "#EF4444" : t.textTertiary }}>{f.due_vencido}</td>
                <td style={{ ...td, color: t.textSecondary }}>{f.dias_parado_med}d</td>
                <td style={{ ...td, color: f.dias_parado_max >= 90 ? "#EF4444" : t.textSecondary }}>{f.dias_parado_max}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Time por projetista ─── */}
      {secTitulo("Time por projetista")}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Projetista</th><th style={th}>Cards</th>
            <th style={th}>Atraso real</th><th style={th}>Prazo sujo</th>
            <th style={th}>Em aberto</th><th style={th}>Entregues</th>
          </tr></thead>
          <tbody>
            {rel.time.map(p => (
              <tr key={p.projetista}>
                <td style={{ ...td, fontWeight: 600 }}>{p.projetista}</td>
                <td style={td}>{p.cards}</td>
                <td style={{ ...td, color: p.atraso_real > 0 ? "#EF4444" : "#10B981", fontWeight: 700 }}>{p.atraso_real}</td>
                <td style={{ ...td, color: t.textTertiary }}>{p.prazo_sujo}</td>
                <td style={td}>{p.em_aberto}</td>
                <td style={{ ...td, color: "#10B981" }}>{p.entregues}</td>
              </tr>
            ))}
            {rel.time.length === 0 && (
              <tr><td style={td} colSpan={6}>Nenhum card delegado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Alertas: atrasos reais ─── */}
      {secTitulo(`Atrasos reais (${rel.atrasos_reais.length})`)}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Card</th><th style={th}>Fase</th><th style={th}>Projetista</th>
            <th style={th}>Prazo</th><th style={th}>Atraso</th><th style={th}>Etapa</th>
          </tr></thead>
          <tbody>
            {rel.atrasos_reais.map(a => (
              <tr key={a.card_id + a.projetista}>
                <td style={{ ...td, whiteSpace: "normal", maxWidth: 340 }}>{linkCard(a.card_id, a.nome)}</td>
                <td style={td}>{a.fase}</td>
                <td style={td}>{a.projetista}</td>
                <td style={td}>{fmtBr(a.prazo)}</td>
                <td style={{ ...td, color: "#EF4444", fontWeight: 700 }}>{a.dias_atraso}d</td>
                <td style={{ ...td, color: t.textSecondary }}>{a.etapa_projetista || ""}</td>
              </tr>
            ))}
            {rel.atrasos_reais.length === 0 && (
              <tr><td style={{ ...td, color: "#10B981" }} colSpan={6}>Nenhum atraso real. Setor em dia.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Alertas: parados 30d+ ─── */}
      {secTitulo(`Parados 30 dias ou mais (${rel.parados.length})`)}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Card</th><th style={th}>Fase</th><th style={th}>Parado há</th>
          </tr></thead>
          <tbody>
            {rel.parados.map(p => (
              <tr key={p.card_id}>
                <td style={{ ...td, whiteSpace: "normal", maxWidth: 420 }}>{linkCard(p.card_id, p.nome)}</td>
                <td style={td}>{p.fase}</td>
                <td style={{ ...td, color: p.dias_parado >= 90 ? "#EF4444" : "#F59E0B", fontWeight: 700 }}>
                  {p.dias_parado}d
                </td>
              </tr>
            ))}
            {rel.parados.length === 0 && (
              <tr><td style={{ ...td, color: "#10B981" }} colSpan={3}>Nenhum card parado. Fluxo saudável.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Alertas: liberação pra produção pendente ─── */}
      {secTitulo(`Liberação pra produção pendente (${rel.liberacao.length})`)}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Card</th><th style={th}>Fase</th><th style={th}>Itens não liberados</th>
          </tr></thead>
          <tbody>
            {rel.liberacao.map(l => (
              <tr key={l.card_id}>
                <td style={{ ...td, whiteSpace: "normal", maxWidth: 420 }}>{linkCard(l.card_id, l.nome)}</td>
                <td style={td}>{l.fase}</td>
                <td style={{ ...td, color: "#F59E0B", fontWeight: 700 }}>{l.itens_nao_liberados}</td>
              </tr>
            ))}
            {rel.liberacao.length === 0 && (
              <tr><td style={{ ...td, color: "#10B981" }} colSpan={3}>Tudo liberado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Mix Revestimento x Marcenaria por fase ─── */}
      {secTitulo("Mix Revestimento x Marcenaria por fase")}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Fase</th><th style={th}>Marcenaria</th>
            <th style={th}>Revestimento</th><th style={th}>Sem itens no gestão</th>
          </tr></thead>
          <tbody>
            {rel.funil.map(f => {
              const m = rel.mix[f.fase];
              if (!m) return null;
              return (
                <tr key={f.fase}>
                  <td style={td}>{f.fase}</td>
                  <td style={{ ...td, color: "#9F8FEF", fontWeight: 600 }}>{m.marcenaria}</td>
                  <td style={{ ...td, color: "#579DFF", fontWeight: 600 }}>{m.revestimento}</td>
                  <td style={{ ...td, color: m.sem_itens > 0 ? "#F59E0B" : t.textTertiary }}>{m.sem_itens}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
