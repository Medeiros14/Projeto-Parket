import { useCallback, useEffect, useState } from "react";
import { CalendarRange, ChevronRight } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";

/* Cronograma da obra DENTRO do app (item do MENU): o instalador escolhe a
   obra e a página da Central do Cliente (center.parket.works/<token>/cronograma)
   abre num quadro de tela cheia. É a MESMA visão de etapas e datas que o
   cliente acompanha, e nada abre em aba nova (regra do app de campo). */

const GESTAO_API = "https://gestao.parket.works";
const FONT_BODY = "'Inter', sans-serif";

type Obra = { card_id: string; obra_code: string | null; cliente_nome: string; cidade: string | null };

// obra_code com UUID de card (import antigo) não é código de gente: esconde (mesma regra do Hoje)
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codigoLegivel = (c: string | null) => {
  const s = (c ?? "").trim();
  return !s || RE_UUID.test(s) ? null : s;
};

// Busca sem acento e sem caixa: digita "sao" e acha "São Paulo"
const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* Visor de tela cheia com o cronograma embutido. Botão voltar do celular
   fecha o visor em vez de sair da tela (mesmo truque do visor de pranchas). */
function VisorCronograma({ url, titulo, onFechar }: { url: string; titulo: string; onFechar: () => void }) {
  useEffect(() => {
    window.history.pushState({ visorCronograma: true }, "");
    window.addEventListener("popstate", onFechar);
    // Trava o rolar da lista de trás enquanto o visor está aberto
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onFechar);
      document.body.style.overflow = antes;
      // Fechou pelo botão FECHAR: desfaz a entrada extra que empurramos no histórico
      if ((window.history.state as { visorCronograma?: boolean } | null)?.visorCronograma) {
        window.history.back();
      }
    };
  }, [onFechar]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", borderBottom: "1px solid #222", flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11.5, color: "#fff", fontWeight: 600, wordBreak: "break-word" }}>{titulo}</p>
          <p style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "#888", marginTop: 3 }}>CRONOGRAMA DA OBRA</p>
        </div>
        <button type="button" onClick={onFechar} style={{
          padding: "9px 14px", border: "1px solid #444", background: "#1a1a1a",
          color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer", flexShrink: 0,
        }}>
          FECHAR
        </button>
      </div>
      <iframe src={url} title={titulo} style={{ flex: 1, width: "100%", border: 0, background: "#fff" }} />
    </div>
  );
}

export function Cronograma({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; msg: string } | null>(null);
  const [visor, setVisor] = useState<{ url: string; titulo: string } | null>(null);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    const { data } = await sb.from("vw_instala_minhas_obras")
      .select("card_id,obra_code,cliente_nome,cidade")
      .eq("prestador_id", prestador.id)
      .order("cliente_nome")
      .limit(2000);
    // A view devolve uma linha por atribuição: dedup por card pra obra aparecer 1x
    const seen = new Set<string>();
    const os: Obra[] = [];
    for (const o of (data as Obra[]) ?? []) {
      if (!seen.has(o.card_id)) { seen.add(o.card_id); os.push(o); }
    }
    setObras(os);
    setLoading(false);
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  /* Toque na obra: pede pro gestão o link da Central (o token nasce na primeira
     vez) e abre o cronograma no visor. Sem projeto no gestão = sem cronograma. */
  async function abrir(o: Obra) {
    if (abrindo) return;
    setAbrindo(o.card_id);
    setErro(null);
    try {
      const r = await fetch(`${GESTAO_API}/api/instala/cronograma-link/${encodeURIComponent(o.card_id)}`);
      if (r.status === 404) {
        setErro({ id: o.card_id, msg: "Essa obra ainda não tem cronograma montado no gestão." });
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setVisor({ url: j.url, titulo: o.cliente_nome });
    } catch {
      setErro({ id: o.card_id, msg: "Não deu pra carregar agora. Confira a internet e tente de novo." });
    } finally {
      setAbrindo(null);
    }
  }

  const termo = norm(busca.trim());
  const filtradas = termo.length === 0
    ? obras
    : obras.filter(o =>
        norm(o.cliente_nome).includes(termo) ||
        norm(o.obra_code).includes(termo) ||
        norm(o.cidade).includes(termo));

  return (
    <Screen slug={slug} titulo="Cronograma" subtitulo="etapas e datas" voltar={`/${slug}/mais`}>
      <p style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.5, marginBottom: 14, fontFamily: FONT_BODY }}>
        Toque na obra pra ver as etapas e datas. É a mesma visão que o cliente acompanha na Central.
      </p>

      {/* Filtro só quando a lista cresce (fiscal enxerga muitas obras) */}
      {obras.length > 8 && (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por cliente, código ou cidade"
          style={{
            width: "100%", padding: "12px 14px", background: T.statBg,
            border: `1px solid ${T.border}`, color: T.textPrimary,
            fontFamily: FONT_BODY, fontSize: 13, outline: "none", marginBottom: 12,
          }}
        />
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 64, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          {obras.length === 0 ? "Nenhuma obra vinculada a você ainda." : "Nenhuma obra encontrada com esse termo."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtradas.map(o => {
            const codigo = codigoLegivel(o.obra_code);
            return (
              <div key={o.card_id}>
                <button type="button" onClick={() => abrir(o)} style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                  padding: "14px 16px", cursor: "pointer",
                  background: T.cardBg, border: `1px solid ${T.border}`, color: T.textPrimary,
                  opacity: abrindo && abrindo !== o.card_id ? 0.5 : 1,
                }}>
                  <span style={{
                    width: 38, height: 38, flexShrink: 0, borderRadius: 999,
                    background: T.statBg, border: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CalendarRange size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {codigo && (
                      <span style={{ display: "block", fontSize: 9.5, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", marginBottom: 2 }}>
                        {codigo}
                      </span>
                    )}
                    <span style={{ display: "block", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.cliente_nome}
                    </span>
                    {o.cidade && (
                      <span style={{ display: "block", fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>{o.cidade}</span>
                    )}
                  </span>
                  {abrindo === o.card_id ? (
                    <span style={{ fontSize: 9, letterSpacing: "0.14em", color: T.textMuted, flexShrink: 0 }}>ABRINDO…</span>
                  ) : (
                    <ChevronRight size={16} style={{ color: T.textMuted, flexShrink: 0 }} />
                  )}
                </button>
                {erro?.id === o.card_id && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6, lineHeight: 1.4 }}>{erro.msg}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {visor && (
        <VisorCronograma url={visor.url} titulo={visor.titulo} onFechar={() => setVisor(null)} />
      )}
    </Screen>
  );
}
