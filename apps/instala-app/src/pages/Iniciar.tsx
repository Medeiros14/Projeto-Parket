import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle2, MapPin, ChevronRight, Play } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";
import type { ObraDoDia } from "../app/components/ObraCard";
import { EnderecoAcoes } from "../app/components/EnderecoAcoes";
import { confirmar } from "../lib/confirmar";

/** Cards com termo PENDENTE deste prestador.
 *  O QUE: so os card_ids, pra redirecionar o check-in de obra nao ativada
 *  pra /obra/:id, onde o AtivarObraGate abre o wizard de ativacao (F4).
 *  A ativacao em si (itens + codigo WhatsApp) NAO mora mais aqui: fluxo
 *  novo do Will 01/09 vive em AtivarObra.tsx na rota da obra.
 *  Vinculo canonico (Will 02/09): equipes_parket.prestador_id = prestador.id,
 *  MESMA chave da vw_instala_minhas_obras do gestao. Nada de casar por nome
 *  (fragil: renomear a equipe quebrava o elo). */
async function fetchCardsComTermoPendente(prestadorId?: string): Promise<Set<string>> {
  if (!prestadorId) return new Set();
  const { data: equipes } = await sb.from("equipes_parket").select("id").eq("prestador_id", prestadorId);
  const equipeIds = (equipes || []).map((e: any) => e.id);
  if (equipeIds.length === 0) return new Set();
  const { data: termos } = await sb.from("prestador_termos")
    .select("card_id").in("equipe_id", equipeIds).eq("status", "pendente");
  return new Set(((termos || []) as any[]).map((t) => t.card_id));
}

const FONT_BODY = "'Inter', sans-serif";

// Compara texto ignorando acento e caixa: "sao" acha "SÃO".
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Quantas obras da empresa aparecem por vez na lista do fiscal.
const PAGINA_TODAS = 30;

export function Iniciar({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const nav = useNavigate();
  const [rows, setRows] = useState<ObraDoDia[]>([]);
  // Obras com ativacao pendente: check-in nelas redireciona pro wizard
  const [pendentesAtivacao, setPendentesAtivacao] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Obras da empresa (vinculo 'aberto'), busca e paginacao da lista do fiscal.
  const [todas, setTodas] = useState<ObraDoDia[]>([]);
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA_TODAS);

  // Só quem tem a flag (os fiscais) enxerga e inicia obra que não é dele.
  const podeVerTodas = prestador?.ve_todas_obras === true;

  const fetchObras = useCallback(async () => {
    if (!prestador?.id) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data }, { data: dataTodas }, termosData] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("*")
        // Lista do dia dele: so obra atribuida.
        .eq("prestador_id", prestador.id)
        .eq("vinculo", "atribuido")
        .lte("data_prevista_inicio", today)
        .order("data_prevista_inicio", { ascending: true })
        .limit(50),
      // Fiscal inicia o acompanhamento de qualquer obra em execucao, mesmo sem
      // estar atribuido a ela. O corte pela coluna Acompanhamento de Obras
      // (operacional) evita trazer o funil inteiro: contrato novo, projeto
      // executivo e finalizado nao sao obra onde ele entra.
      podeVerTodas
        ? sb.from("vw_instala_minhas_obras")
            .select("*")
            .eq("prestador_id", prestador.id)
            .eq("vinculo", "aberto")
            .eq("card_column", "acompanhamento")
            .order("cliente_nome")
            .limit(3000)
        : Promise.resolve({ data: [] as ObraDoDia[] }),
      fetchCardsComTermoPendente(prestador.id),
    ]);
    setRows((data as ObraDoDia[]) ?? []);
    setTodas((dataTodas as ObraDoDia[]) ?? []);
    setVisiveis(PAGINA_TODAS);
    setPendentesAtivacao(termosData);
    setLoading(false);
  }, [prestador?.id, podeVerTodas]);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  async function iniciarObra(cardId: string) {
    if (!prestador) return;
    // Obra nao ativada: manda pra pagina da obra, onde o AtivarObraGate
    // abre o wizard (itens + codigo). Check-in so depois de ativar.
    if (pendentesAtivacao.has(cardId)) { nav(`/obra/${cardId}`); return; }
    setBusyCard(cardId); setErr(null);
    try {
      // GPS negado (code 1): oferece registrar SEM localização em vez de travar
      // o prestador — instala_checkins.lat/lng aceitam NULL (conferido 04/09).
      let coords: { lat: number | null; lng: number | null; accuracy: number | null };
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
        );
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (ge: any) {
        if (ge?.code === 1 && await confirmar(
          "O aparelho está sem acesso à localização. Registrar a chegada sem localização?",
          "Registrar sem localização", "#FBBF24",
        )) {
          coords = { lat: null, lng: null, accuracy: null };
        } else {
          throw new Error(ge?.code === 1
            ? "Permita o acesso à localização pra registrar a chegada."
            : "Não conseguimos sua localização. Verifique o GPS e tente de novo.");
        }
      }
      const { error } = await sb.rpc("fn_instala_checkin", {
        p_prestador_id: prestador.id,
        p_card_id: cardId,
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_accuracy: coords.accuracy,
        p_foto_url: null,
      });
      if (error) throw error;
      await fetchObras();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao registrar a chegada");
    } finally {
      setBusyCard(null);
    }
  }

  // Obra fica no INICIAR até acabar de VERDADE (progress = 100%). Finalizar
  // dia não tira daqui — só volta a listar como "PRONTAS" no dia seguinte.
  const emCurso = rows.filter((o) => (o.progress_atual ?? 0) < 100);
  const emAndamento = emCurso.filter((o) => o.presenca_status === "presente");
  const finalizadasHoje = emCurso.filter((o) => o.presenca_status === "finalizado");
  const pendentes = emCurso.filter((o) => o.presenca_status !== "presente" && o.presenca_status !== "finalizado");

  // Filtro em memoria da lista da empresa: cliente, codigo, cidade ou endereco.
  const termo = norm(busca.trim());
  const filtradas = termo.length === 0
    ? todas
    : todas.filter((o) =>
        norm(o.cliente_nome).includes(termo) ||
        norm(o.obra_code).includes(termo) ||
        norm(o.cidade).includes(termo) ||
        norm(o.endereco).includes(termo));

  // O card da empresa usa a mesma marcacao de chegada da lista de cima.
  const variantePorPresenca = (o: ObraDoDia) =>
    o.presenca_status === "presente" ? "em-andamento"
      : o.presenca_status === "finalizado" ? "dia-finalizado"
      : "pronta";

  return (
    <Screen
      slug={slug}
      titulo="Iniciar Obra"
      subtitulo="Registre a chegada com sua localização"
      action={
        <button onClick={fetchObras} title="Atualizar" style={iconBtn(T)}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      }
    >
      {err && (
        <div style={{ marginBottom: 14, padding: "12px 14px", background: "#b3421a", color: "#fff", fontSize: 12 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2].map((i) => <div key={i} style={{ height: 120, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
                EM ANDAMENTO · {emAndamento.length}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {emAndamento.map((o) => (
                  <ObraIniciarCard
                    key={o.atribuicao_id}
                    obra={o}
                    T={T}
                    prestadorCategoria={prestador?.categoria}
                    variant="em-andamento"
                    onOpen={() => nav(`/obra/${o.card_id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {finalizadasHoje.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
                DIA FINALIZADO · {finalizadasHoje.length} · CONTINUA AMANHÃ
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {finalizadasHoje.map((o) => (
                  <ObraIniciarCard
                    key={o.atribuicao_id}
                    obra={o}
                    T={T}
                    prestadorCategoria={prestador?.categoria}
                    variant="dia-finalizado"
                    onOpen={() => nav(`/obra/${o.card_id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
              PRONTAS PRA INICIAR · {pendentes.length}
            </p>
            {pendentes.length === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12, letterSpacing: "0.05em" }}>
                {rows.length === 0
                  ? "Nenhuma obra pra hoje."
                  : (<><Play size={14} style={{ display: "inline", marginRight: 6 }} /> Todas as obras já iniciadas. Bom trabalho.</>)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendentes.map((o) => (
                  <ObraIniciarCard
                    key={o.atribuicao_id}
                    obra={o}
                    T={T}
                    prestadorCategoria={prestador?.categoria}
                    variant="pronta"
                    busy={busyCard === o.card_id}
                    ativacaoPendente={pendentesAtivacao.has(o.card_id)}
                    onIniciar={() => iniciarObra(o.card_id)}
                    onOpen={() => nav(`/obra/${o.card_id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Obras da empresa em execucao: so pro fiscal, que inicia o
              acompanhamento de qualquer uma, mesmo sem estar atribuido. */}
          {podeVerTodas && (
            <section style={{ marginTop: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
                ACOMPANHAMENTO DE OBRAS · {filtradas.length}
              </p>
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setVisiveis(PAGINA_TODAS); }}
                placeholder="Filtrar por cliente, código, cidade ou endereço"
                style={{
                  width: "100%", padding: "12px 14px", background: T.statBg,
                  border: `1px solid ${T.border}`, color: T.textPrimary,
                  fontFamily: FONT_BODY, fontSize: 13, outline: "none", marginBottom: 12,
                }}
              />
              {filtradas.length === 0 ? (
                <div style={{ padding: "24px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                  Nenhuma obra encontrada com esse termo.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtradas.slice(0, visiveis).map((o) => (
                    <ObraIniciarCard
                      key={o.atribuicao_id}
                      obra={o}
                      T={T}
                      prestadorCategoria={prestador?.categoria}
                      variant={variantePorPresenca(o)}
                      busy={busyCard === o.card_id}
                      ativacaoPendente={pendentesAtivacao.has(o.card_id)}
                      onIniciar={() => iniciarObra(o.card_id)}
                      // Sem ?ver=1: aqui ele entra pra trabalhar, nao pra consultar.
                      onOpen={() => nav(`/obra/${o.card_id}`)}
                    />
                  ))}
                </div>
              )}
              {visiveis < filtradas.length && (
                <button
                  onClick={() => setVisiveis((v) => v + PAGINA_TODAS)}
                  style={{
                    width: "100%", marginTop: 12, padding: "12px 14px", background: T.statBg,
                    border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                    fontFamily: FONT_BODY, fontSize: 11, letterSpacing: "0.16em",
                  }}
                >
                  VER MAIS {Math.min(PAGINA_TODAS, filtradas.length - visiveis)} DE {filtradas.length - visiveis}
                </button>
              )}
            </section>
          )}
        </>
      )}
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

function ObraIniciarCard({
  obra, T, prestadorCategoria, variant, busy, ativacaoPendente, onIniciar, onOpen,
}: {
  obra: ObraDoDia; T: any; prestadorCategoria?: string | null;
  variant: "pronta" | "em-andamento" | "dia-finalizado";
  busy?: boolean;
  // Obra ainda nao ativada (termo pendente): badge amarelo avisando ANTES
  // do toque, em vez do redirect silencioso pro wizard surpreender.
  ativacaoPendente?: boolean;
  onIniciar?: () => void;
  onOpen: () => void;
}) {
  const data = new Date(obra.data_prevista_inicio + "T00:00:00");
  const dataStr = data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const funcao = obra.observacao || prestadorCategoria || null;

  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.border}`,
      padding: "16px 18px", fontFamily: FONT_BODY, color: T.textPrimary,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div onClick={onOpen} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
            {dataStr}{obra.hora_prevista_inicio && <> · {obra.hora_prevista_inicio.slice(0, 5)}</>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {obra.cliente_nome}
          </div>
          {funcao && (
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, marginBottom: 4, textTransform: "uppercase" }}>{funcao}</div>
          )}
          {(obra.endereco || obra.cidade) && (
            <div style={{ fontSize: 11, color: T.textSecondary, display: "flex", gap: 6 }}>
              <MapPin size={10} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{obra.endereco || obra.cidade}</span>
            </div>
          )}
          {/* Ações Maps/WhatsApp/Copiar quando há endereço de verdade (não só cidade) */}
          {obra.endereco && <EnderecoAcoes endereco={obra.endereco} T={T} />}
        </div>
        <ChevronRight size={16} style={{ color: T.textMuted, flexShrink: 0 }} />
      </div>

      {/* Ativacao pendente: aviso amarelo + o botao vira ATIVAR OBRA (o
          onIniciar ja redireciona pro wizard quando o termo esta pendente). */}
      {ativacaoPendente && (
        <div style={{
          padding: "10px 14px", background: "#FBBF240d", border: "1px solid #FBBF2466",
          fontSize: 11, color: "#b45309", lineHeight: 1.5,
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.14em", fontWeight: 700 }}>
            ATIVAR OBRA:
          </span>{" "}
          falta assinar os itens e confirmar o código. Toque em ATIVAR pra fazer isso agora.
        </div>
      )}

      {variant === "pronta" && onIniciar && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onIniciar}
            disabled={busy}
            style={{
              padding: "8px 14px", background: T.textPrimary, color: T.bg, border: "none",
              cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center",
              gap: 7, fontSize: 10, letterSpacing: "0.2em", opacity: busy ? 0.6 : 1,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <Play size={12} />
            {busy ? "PEGANDO LOCALIZAÇÃO…" : ativacaoPendente ? "ATIVAR OBRA" : "INICIAR"}
          </button>
        </div>
      )}

      {variant === "em-andamento" && (
        <div style={{
          padding: "10px 14px", background: T.statBg, border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.1em", color: T.textSecondary,
        }}>
          <CheckCircle2 size={14} style={{ color: "#4a7c59" }} />
          CHEGADA REGISTRADA · TOQUE PRA CONTINUAR
        </div>
      )}

      {variant === "dia-finalizado" && (
        <div style={{
          padding: "10px 14px", background: T.statBg, border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.1em", color: T.textSecondary,
        }}>
          <CheckCircle2 size={14} style={{ color: "#4a7c59" }} />
          DIA FINALIZADO · CONTINUA AMANHÃ (BATE CHEGADA NOVA)
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

