import { useCallback, useEffect, useState } from "react";
import { Receipt, RefreshCw, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { GESTAO_API } from "../lib/offline";
import { Screen } from "../app/components/Screen";

/* Custos: aba da nav (no lugar de Equipe, Will 08/09).
 * Acompanhamento dos lançamentos de Custos de Terceiros do próprio prestador:
 * a gestão lança em gestao.parket.works/custos, o Core aprova e paga, e aqui
 * o instalador acompanha o status de cada lançamento dele (com glosas,
 * histórico e o comprovante quando pago). Fonte = API do gestão, endpoints
 * /api/custos/app/* keyed pelo UUID do prestador (mesmo padrão /api/instala). */

type Lanc = {
  id: string; numero: string; status: string; motivo: string | null;
  data_ida: string | null; data_volta: string | null;
  total_lancado_cent: number; total_aprovado_cent: number;
  adiantamento_cent: number; saldo_cent: number;
  comprovante_url: string | null; comprovante_nome: string | null;
  pago_em: string | null; created_at: string;
  cliente: string | null; endereco: string | null;
  n_despesas: number; n_glosadas: number;
};
type Despesa = {
  id: string; categoria: string | null; subcategoria: string | null;
  descricao: string | null; data: string | null;
  quantidade: number | null; valor_unitario_cent: number | null; valor_total_cent: number;
  status: string; glosa_motivo: string | null;
  anexo_url: string | null; anexo_nome: string | null;
};
type Hist = { de: string | null; para: string; usuario_nome: string | null; observacao: string | null; created_at: string };
type Detalhe = { despesas: Despesa[]; historico: Hist[] };

const fmtC = (cent: number) => (Number(cent || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtD = (d: string | null) => (d ? new Date(d.length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-");

/* Cor e rótulo por status do lançamento. Segue a mesma lógica de cor do
 * Pagamentos: amarelo = esperando dinheiro, verde = dinheiro na conta. */
const STATUS: Record<string, { rotulo: string; cor: string }> = {
  rascunho:   { rotulo: "RASCUNHO",   cor: "#9CA3AF" },
  enviado:    { rotulo: "ENVIADO",    cor: "#60A5FA" },
  em_analise: { rotulo: "EM ANÁLISE", cor: "#60A5FA" },
  aprovado:   { rotulo: "APROVADO",   cor: "#FBBF24" },
  devolvido:  { rotulo: "DEVOLVIDO",  cor: "#F87171" },
  pago:       { rotulo: "PAGO",       cor: "#34D399" },
};

export function Custos({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Detalhe carregado por lançamento (cache) + qual card está expandido
  const [detalhes, setDetalhes] = useState<Record<string, Detalhe>>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregandoDet, setCarregandoDet] = useState<string | null>(null);
  // Visor do comprovante DENTRO do app (regra: app de campo não abre aba nova)
  const [visor, setVisor] = useState<{ url: string; nome: string } | null>(null);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true); setErro(null);
    try {
      const r = await fetch(`${GESTAO_API}/api/custos/app/lancamentos?prestador_id=${encodeURIComponent(prestador.id)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setLancs((j.items as Lanc[]) ?? []);
    } catch {
      setErro("Não deu pra carregar seus lançamentos. Confira a internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  // Expande o card e busca o detalhe (despesas + histórico) na primeira vez
  const alternar = async (l: Lanc) => {
    if (aberto === l.id) { setAberto(null); return; }
    setAberto(l.id);
    if (detalhes[l.id] || !prestador) return;
    setCarregandoDet(l.id);
    try {
      const r = await fetch(`${GESTAO_API}/api/custos/app/lancamentos/${l.id}?prestador_id=${encodeURIComponent(prestador.id)}`);
      if (r.ok) {
        const j = await r.json();
        setDetalhes((d) => ({ ...d, [l.id]: { despesas: j.despesas ?? [], historico: j.historico ?? [] } }));
      }
    } finally {
      setCarregandoDet(null);
    }
  };

  // Totais do topo: quanto está em análise, quanto foi aprovado e quanto já caiu
  const emAnalise = lancs.filter((l) => ["enviado", "em_analise"].includes(l.status)).reduce((a, l) => a + l.total_lancado_cent, 0);
  const aprovado = lancs.filter((l) => l.status === "aprovado").reduce((a, l) => a + l.saldo_cent, 0);
  const pago = lancs.filter((l) => l.status === "pago").reduce((a, l) => a + l.total_aprovado_cent, 0);

  return (
    <Screen slug={slug} titulo="Custos" subtitulo="seus lançamentos de despesas"
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>

      {/* Resumo: espelha os 3 momentos do fluxo (análise, aprovado, pago) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { l: "EM ANÁLISE", v: emAnalise, c: T.textPrimary },
          { l: "APROVADO", v: aprovado, c: "#FBBF24" },
          { l: "PAGO", v: pago, c: "#34D399" },
        ].map((b) => (
          <div key={b.l} style={{ padding: "12px 10px", background: T.cardBg, border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.16em", color: T.textMuted, marginBottom: 4 }}>{b.l}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: b.c }}>{fmtC(b.v)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 90, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : erro ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          {erro}
        </div>
      ) : lancs.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}` }}>
          <Receipt size={26} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Você ainda não tem lançamento de custos.<br />Quando a gestão lançar um pra você, ele aparece aqui.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lancs.map((l) => {
            const st = STATUS[l.status] ?? { rotulo: l.status.toUpperCase(), cor: T.textMuted };
            const det = detalhes[l.id];
            const expandido = aberto === l.id;
            // Valor de destaque: depois de aprovado mostra o que sobra a receber
            // (saldo = aprovado menos adiantamento); pago mostra o aprovado.
            const valor = l.status === "pago" ? l.total_aprovado_cent
              : l.status === "aprovado" ? l.saldo_cent
              : l.total_lancado_cent;
            return (
              <div key={l.id} style={{ background: T.cardBg, border: `1px solid ${T.border}` }}>
                {/* Cabeçalho do card: toque expande o detalhe */}
                <button onClick={() => alternar(l)} style={{
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  background: "transparent", border: "none", color: T.textPrimary, padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted }}>
                      {l.numero} · {fmtD(l.created_at)}
                    </span>
                    <span style={{ fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, color: st.cor, whiteSpace: "nowrap" }}>
                      {st.rotulo}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.cliente ?? "Obra"}
                  </div>
                  {l.motivo && (
                    <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4, marginBottom: 4 }}>{l.motivo}</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10.5, color: T.textMuted }}>
                      {l.data_ida ? `${fmtD(l.data_ida)}${l.data_volta ? ` a ${fmtD(l.data_volta)}` : ""} · ` : ""}
                      {l.n_despesas} {l.n_despesas === 1 ? "despesa" : "despesas"}
                      {l.n_glosadas > 0 && <span style={{ color: "#F87171" }}> · {l.n_glosadas} glosada{l.n_glosadas > 1 ? "s" : ""}</span>}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: st.cor }}>{fmtC(valor)}</span>
                      {expandido ? <ChevronUp size={14} style={{ color: T.textMuted }} /> : <ChevronDown size={14} style={{ color: T.textMuted }} />}
                    </span>
                  </div>
                  {/* Adiantamento descontado aparece junto pra conta fechar na cabeça dele */}
                  {l.adiantamento_cent > 0 && l.status !== "rascunho" && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                      adiantamento descontado: {fmtC(l.adiantamento_cent)}
                    </div>
                  )}
                </button>

                {/* Comprovante do pagamento: abre no visor do app, nunca em aba nova */}
                {l.status === "pago" && l.comprovante_url && (
                  <button onClick={() => setVisor({ url: l.comprovante_url!, nome: l.comprovante_nome || `Comprovante ${l.numero}` })} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer",
                    padding: "10px 14px", background: "transparent", color: "#34D399",
                    border: "none", borderTop: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600,
                  }}>
                    <Paperclip size={13} /> Ver comprovante{l.pago_em ? ` · pago em ${fmtD(l.pago_em)}` : ""}
                  </button>
                )}

                {/* Detalhe expandido: despesas item a item + trilha de status */}
                {expandido && (
                  <div style={{ borderTop: `1px solid ${T.border}` }}>
                    {carregandoDet === l.id && !det ? (
                      <div style={{ padding: "14px", fontSize: 11, color: T.textMuted }}>Carregando…</div>
                    ) : !det ? (
                      <div style={{ padding: "14px", fontSize: 11, color: T.textMuted }}>Não deu pra carregar o detalhe.</div>
                    ) : (
                      <>
                        {det.despesas.map((d) => (
                          <div key={d.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 11.5, color: T.textPrimary, lineHeight: 1.4 }}>
                                {d.categoria ?? "Despesa"}{d.subcategoria ? ` · ${d.subcategoria}` : ""}
                              </span>
                              <span style={{
                                fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
                                color: d.status === "glosado" ? "#F87171" : T.textPrimary,
                                textDecoration: d.status === "glosado" ? "line-through" : "none",
                              }}>
                                {fmtC(d.valor_total_cent)}
                              </span>
                            </div>
                            <div style={{ fontSize: 10.5, color: T.textMuted, lineHeight: 1.4 }}>
                              {fmtD(d.data)}{d.descricao ? ` · ${d.descricao}` : ""}
                            </div>
                            {/* Glosa: o item foi cortado da conta; o motivo vem da gestão */}
                            {d.status === "glosado" && (
                              <div style={{ fontSize: 10.5, color: "#F87171", marginTop: 3, lineHeight: 1.4 }}>
                                Glosada{d.glosa_motivo ? `: ${d.glosa_motivo}` : ""}
                              </div>
                            )}
                          </div>
                        ))}
                        {det.historico.length > 0 && (
                          <div style={{ padding: "10px 14px" }}>
                            <div style={{ fontSize: 8.5, letterSpacing: "0.16em", color: T.textMuted, marginBottom: 6 }}>HISTÓRICO</div>
                            {det.historico.map((h, i) => (
                              <div key={i} style={{ fontSize: 10.5, color: T.textMuted, lineHeight: 1.6 }}>
                                {fmtD(h.created_at)} · {(STATUS[h.para]?.rotulo ?? h.para.toUpperCase())}
                                {h.usuario_nome ? ` por ${h.usuario_nome}` : ""}
                                {h.observacao ? `: ${h.observacao}` : ""}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Como funciona: linguagem do dia a dia, sem jargão */}
      <div style={{ marginTop: 24, padding: "14px 16px", border: `1px dashed ${T.border}`, fontSize: 10, letterSpacing: "0.08em", color: T.textMuted, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
        <Receipt size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          A gestão lança suas despesas de obra aqui. Depois de <b>aprovado</b>, o financeiro faz o pagamento e o lançamento vira <b>pago</b> com o comprovante anexado. Item <b>glosado</b> é despesa cortada da conta, com o motivo escrito.
        </div>
      </div>

      {/* Visor de tela cheia do comprovante (imagem ou PDF), dentro do app */}
      {visor && <VisorComprovante url={visor.url} nome={visor.nome} onFechar={() => setVisor(null)} />}
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

/* Visor de tela cheia DENTRO do app: no celular, abrir aba nova tira o
 * instalador do app e ele não sabe voltar (mesma regra do visor de pranchas).
 * Imagem entra direto; PDF entra num quadro embutido. */
function VisorComprovante({ url, nome, onFechar }: { url: string; nome: string; onFechar: () => void }) {
  const ehPdf = /\.pdf(\?|$)/i.test(url) || /\.pdf$/i.test(nome);

  // Botão voltar do celular fecha o visor em vez de sair da tela
  useEffect(() => {
    window.history.pushState({ visorComprovante: true }, "");
    window.addEventListener("popstate", onFechar);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onFechar);
      document.body.style.overflow = antes;
      if ((window.history.state as { visorComprovante?: boolean } | null)?.visorComprovante) {
        window.history.back();
      }
    };
  }, [onFechar]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", borderBottom: "1px solid #222", flexShrink: 0 }}>
        <p style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#fff", fontWeight: 600, wordBreak: "break-word" }}>{nome}</p>
        <button type="button" onClick={onFechar} style={{
          padding: "9px 14px", border: "1px solid #444", background: "#1a1a1a",
          color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", flexShrink: 0,
        }}>
          FECHAR
        </button>
      </div>
      {ehPdf ? (
        <iframe src={url} title={nome} style={{ flex: 1, border: "none", background: "#fff" }} />
      ) : (
        <div style={{ flex: 1, overflow: "auto", display: "flex", background: "#111" }}>
          <img src={url} alt={nome} style={{ width: "100%", margin: "auto", display: "block" }} />
        </div>
      )}
    </div>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
