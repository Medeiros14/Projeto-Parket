import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeTokens } from "./gestao/theme";

/* Projeto da obra numa seção só, com seletor de qual documento abrir.
   MAPA = páginas publicadas pelo Status, mapa ao vivo do Draw e PDF do card.
   PROJETO EXECUTIVO = agregador docs-unificados do gestão (executivo + anexos
   do board Projetos / Valor / Gestão / Produção) na vista de campo, que nunca
   traz proposta nem contrato porque o app de campo não vê valores.
   Tudo abre DENTRO do app, no visor de tela cheia daqui de baixo. */

const GESTAO_API = "https://gestao.parket.works";

export type MapaPagina = { n: number; url: string; label: string | null };

type Doc = { name: string; url: string; mime?: string | null; origem?: string };
type Payload = {
  mapa?: { print?: unknown; pdf?: { url: string; name?: string } | null };
  grupos?: { origem: string; titulo: string; docs: Doc[] }[];
};

const ORIGEM_LABEL: Record<string, string> = {
  valor: "VALOR", projetos: "PROJETOS", executivo: "EXECUTIVO",
  gestao: "GESTÃO", producao: "PRODUÇÃO",
};

/* Decide se o documento entra desenhado na tela ou dentro de um quadro.
   Usa o mime quando o agregador manda e cai na extensão do nome quando não manda. */
const RE_IMAGEM = /\.(png|jpe?g|webp|gif|bmp)$/i;
const ehImagem = (d: Doc) => (d.mime || "").startsWith("image/") || RE_IMAGEM.test(d.name || "");

/* Uma prancha é qualquer coisa que o instalador abre em tela cheia: página do
   mapa, desenho do executivo, PDF ou o mapa ao vivo do Draw. */
type Prancha = { url: string; nome: string; tag: string | null; tipo: "imagem" | "quadro" };

/* Visor de tela cheia DENTRO do app. Nada abre em aba nova, porque no celular
   o instalador sai do app, perde o passo da obra e não sabe voltar.
   Imagem: toque dá zoom e o arraste passa pra próxima prancha.
   PDF e mapa ao vivo: entram num quadro embutido na mesma tela. */
function VisorPranchas({ lista, indice, onIr, onFechar }: {
  lista: Prancha[];
  indice: number;
  onIr: (i: number) => void;
  onFechar: () => void;
}) {
  const atual = lista[indice];
  const [zoom, setZoom] = useState(1);
  const toque = useRef<{ x: number; y: number } | null>(null);

  // Zoom volta ao normal ao trocar de prancha, senão a próxima abre cortada
  useEffect(() => { setZoom(1); }, [indice]);

  // Botão voltar do celular fecha o visor em vez de sair da obra
  useEffect(() => {
    window.history.pushState({ visorPrancha: true }, "");
    window.addEventListener("popstate", onFechar);
    return () => {
      window.removeEventListener("popstate", onFechar);
      // Fechou pelo X: desfaz a entrada extra que empurramos no histórico
      if ((window.history.state as { visorPrancha?: boolean } | null)?.visorPrancha) {
        window.history.back();
      }
    };
  }, [onFechar]);

  // Teclado do tablet/desktop: Esc fecha, setas passam de prancha
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft" && indice > 0) onIr(indice - 1);
      if (e.key === "ArrowRight" && indice < lista.length - 1) onIr(indice + 1);
    };
    window.addEventListener("keydown", tecla);
    // Trava o rolar da página de trás enquanto o visor está aberto
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [indice, lista.length, onIr, onFechar]);

  /* Arraste horizontal troca de prancha. Só vale sem zoom, senão o gesto de
     arrastar a imagem ampliada viraria troca de página sem querer. */
  const inicioToque = (e: React.TouchEvent) => {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
  };
  const fimToque = (e: React.TouchEvent) => {
    if (!toque.current || zoom !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.current.x;
    const dy = t.clientY - toque.current.y;
    toque.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 60) return;
    if (dx < 0 && indice < lista.length - 1) onIr(indice + 1);
    if (dx > 0 && indice > 0) onIr(indice - 1);
  };

  const btnNav = (rotulo: string, alvo: number, desligado: boolean) => (
    <button type="button" disabled={desligado} onClick={() => onIr(alvo)} style={{
      flex: 1, padding: "13px 8px", border: "1px solid #333",
      background: "#111", color: desligado ? "#555" : "#fff",
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
      cursor: desligado ? "default" : "pointer",
    }}>
      {rotulo}
    </button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "#0a0a0a",
      display: "flex", flexDirection: "column",
    }}>
      {/* Barra de cima: nome do arquivo, setor e o X de fechar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 12px",
        borderBottom: "1px solid #222", flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11.5, color: "#fff", fontWeight: 600, wordBreak: "break-word" }}>
            {atual.nome}
          </p>
          <p style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "#888", marginTop: 3 }}>
            {atual.tag ? `${atual.tag} · ` : ""}{indice + 1} de {lista.length}
          </p>
        </div>
        <button type="button" onClick={onFechar} style={{
          padding: "9px 14px", border: "1px solid #444", background: "#1a1a1a",
          color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer", flexShrink: 0,
        }}>
          FECHAR
        </button>
      </div>

      {/* Corpo: imagem com zoom por toque, ou quadro embutido pra PDF e mapa ao vivo */}
      {atual.tipo === "imagem" ? (
        <div
          onTouchStart={inicioToque}
          onTouchEnd={fimToque}
          style={{ flex: 1, overflow: "auto", display: "flex", background: "#111" }}
        >
          {/* margin auto centraliza sem prender o topo quando a imagem passa da tela */}
          <img
            src={atual.url}
            alt={atual.nome}
            onClick={() => setZoom(z => (z === 1 ? 2.6 : 1))}
            style={{
              width: `${zoom * 100}%`, margin: "auto", display: "block",
              flexShrink: 0, cursor: zoom === 1 ? "zoom-in" : "zoom-out",
            }}
          />
        </div>
      ) : (
        <iframe
          src={atual.url}
          title={atual.nome}
          style={{ flex: 1, width: "100%", border: 0, background: "#fff" }}
        />
      )}

      {/* Rodapé: passar de prancha sem depender do arraste (luva, tela suja, dedo molhado) */}
      {lista.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #222", flexShrink: 0 }}>
          {btnNav("ANTERIOR", indice - 1, indice === 0)}
          {btnNav("PRÓXIMA", indice + 1, indice === lista.length - 1)}
        </div>
      )}

      {atual.tipo === "imagem" && (
        <p style={{ fontSize: 9, color: "#777", textAlign: "center", padding: "0 10px 10px" }}>
          Toque no desenho pra ampliar. Arraste pro lado pra passar de prancha.
        </p>
      )}
    </div>
  );
}

type Props = {
  cardId: string;
  T: ThemeTokens;
  mapaPaginas: MapaPagina[];
  mapaLiveId: string | null;
  mapaPdf: { url: string; name?: string } | null;
};

export function ProjetoObra({ cardId, T, mapaPaginas, mapaLiveId, mapaPdf }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [aba, setAba] = useState<"mapa" | "executivo" | null>(null);
  const [visor, setVisor] = useState<{ lista: Prancha[]; i: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    setData(null);
    fetch(`${GESTAO_API}/api/docs-unificados/${encodeURIComponent(cardId)}?vista=campo`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (vivo) setData(j); })
      .catch(() => { if (vivo) setData(null); });
    return () => { vivo = false; };
  }, [cardId]);

  const grupos = useMemo(() => (data?.grupos || []).filter(g => g.docs?.length), [data]);
  const totalDocs = grupos.reduce((n, g) => n + g.docs.length, 0);

  // PDF do agregador só entra quando o card não tem mapa próprio, senão duplica
  const pdfFallback = mapaPdf ? null : (data?.mapa?.pdf || null);
  const temMapa = mapaPaginas.length > 0 || !!mapaLiveId || !!mapaPdf || !!pdfFallback;
  const qtdMapa = mapaPaginas.length || (temMapa ? 1 : 0);

  /* Pranchas do MAPA na ordem em que aparecem na tela: páginas publicadas,
     depois o mapa ao vivo do Draw, depois o PDF. */
  const pranchasMapa = useMemo(() => {
    const l: Prancha[] = mapaPaginas.map(pg => ({
      url: pg.url, nome: pg.label || `Página ${pg.n}`, tag: "MAPA", tipo: "imagem" as const,
    }));
    if (mapaLiveId) {
      l.push({
        url: `https://draw.parket.works/status/viewer/${mapaLiveId}`,
        nome: "Mapa ao vivo", tag: "MAPA", tipo: "quadro",
      });
    }
    const pdf = mapaPdf || pdfFallback;
    if (pdf) l.push({ url: pdf.url, nome: pdf.name || "Mapa da obra em PDF", tag: "MAPA", tipo: "quadro" });
    return l;
  }, [mapaPaginas, mapaLiveId, mapaPdf, pdfFallback]);

  // Pranchas do EXECUTIVO numa lista só, pra passar de uma pra outra sem sair do visor
  const pranchasExec = useMemo(() => {
    const l: Prancha[] = [];
    for (const g of grupos) {
      for (const d of g.docs) {
        const origem = d.origem || g.origem;
        l.push({
          url: d.url, nome: d.name,
          tag: ORIGEM_LABEL[origem] || origem.toUpperCase(),
          tipo: ehImagem(d) ? "imagem" : "quadro",
        });
      }
    }
    return l;
  }, [grupos]);

  const fecharVisor = useCallback(() => setVisor(null), []);
  const irPrancha = useCallback((i: number) => {
    setVisor(v => (v && i >= 0 && i < v.lista.length ? { ...v, i } : v));
  }, []);

  // Primeira aba disponível vira a inicial; o clique do usuário manda depois
  useEffect(() => {
    if (aba) return;
    if (temMapa) setAba("mapa");
    else if (totalDocs > 0) setAba("executivo");
  }, [aba, temMapa, totalDocs]);

  if (!temMapa && totalDocs === 0) return null;

  const botao = (chave: "mapa" | "executivo", rotulo: string, qtd: number) => {
    const ativo = aba === chave;
    return (
      <button type="button" onClick={() => setAba(chave)} style={{
        flex: 1, padding: "11px 8px", cursor: "pointer",
        border: `1px solid ${ativo ? T.textPrimary : T.border}`,
        background: ativo ? T.textPrimary : T.cardBg,
        color: ativo ? T.cardBg : T.textPrimary,
        fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
      }}>
        {rotulo} · {qtd}
      </button>
    );
  };

  /* Botão de abrir usado por PDF e pelo mapa ao vivo: mesma altura e mesma
     moldura de antes, só que agora abre no visor em vez de em aba nova. */
  const botaoAbrir = (rotulo: string, tag: string | null, lista: Prancha[], i: number, margemTopo: number) => (
    <button type="button" onClick={() => setVisor({ lista, i })} style={{
      display: "flex", gap: 8, alignItems: "center", width: "100%",
      padding: "12px 10px", marginTop: margemTopo, cursor: "pointer",
      border: `1px solid ${T.border}`, background: T.cardBg, color: T.textPrimary,
      fontSize: 12, fontWeight: 600, textAlign: "left",
    }}>
      <span style={{ flex: 1, wordBreak: "break-word" }}>{rotulo}</span>
      {tag && (
        <span style={{ fontSize: 8, letterSpacing: "0.14em", color: T.textMuted, flexShrink: 0 }}>
          {tag}
        </span>
      )}
    </button>
  );

  /* Miniatura de desenho: moldura branca, imagem inteira e legenda embaixo.
     É o mesmo desenho que o visor abre, só que na largura da tela. */
  const miniatura = (p: Prancha, lista: Prancha[], i: number, mostrarTag: boolean) => (
    <button type="button" onClick={() => setVisor({ lista, i })} style={{
      display: "block", width: "100%", padding: 0, cursor: "pointer",
      border: `1px solid ${T.border}`, background: "#fff", textAlign: "left",
    }}>
      <img src={p.url} alt={p.nome} loading="lazy" style={{ width: "100%", display: "block" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", background: "#f5f5f5" }}>
        <span style={{ flex: 1, fontSize: 10, color: "#333", wordBreak: "break-word" }}>{p.nome}</span>
        {mostrarTag && p.tag && (
          <span style={{ fontSize: 8, letterSpacing: "0.14em", color: "#777", flexShrink: 0 }}>{p.tag}</span>
        )}
      </div>
    </button>
  );

  return (
    <section style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
        PROJETO DA OBRA
      </p>

      {/* Seletor: só aparece quando existem os dois, senão vira ruído */}
      {temMapa && totalDocs > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {botao("mapa", "MAPA", qtdMapa)}
          {botao("executivo", "PROJETO EXECUTIVO", totalDocs)}
        </div>
      )}

      {/* Aba MAPA: páginas publicadas + mapa ao vivo + PDF, tudo no visor */}
      {aba === "mapa" && (
        <>
          {mapaPaginas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mapaPaginas.map((_, i) => miniatura(pranchasMapa[i], pranchasMapa, i, false))}
              <p style={{ fontSize: 10, color: T.textMuted, textAlign: "center" }}>
                Toque no mapa pra abrir em tela cheia.
              </p>
            </div>
          )}
          {/* Mapa ao vivo entra logo depois das páginas na lista de pranchas */}
          {mapaLiveId && botaoAbrir(
            "Abrir mapa ao vivo", null, pranchasMapa, mapaPaginas.length,
            mapaPaginas.length > 0 ? 10 : 0,
          )}
          {(mapaPdf || pdfFallback) && botaoAbrir(
            "Abrir mapa da obra em PDF", null, pranchasMapa, pranchasMapa.length - 1,
            mapaPaginas.length > 0 || mapaLiveId ? 10 : 0,
          )}
        </>
      )}

      {/* Aba PROJETO EXECUTIVO: abre igual o MAPA, desenho a desenho.
          Imagem entra renderizada na largura toda e o toque abre no visor,
          onde dá pra passar de uma prancha pra outra sem voltar pra lista. */}
      {aba === "executivo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grupos.map(g => (
            <div key={g.origem} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Nome do setor só quando existe mais de um grupo, senão vira ruído */}
              {grupos.length > 1 && (
                <p style={{ fontSize: 8.5, letterSpacing: "0.18em", color: T.textSecondary }}>
                  {g.titulo.toUpperCase()} · {g.docs.length}
                </p>
              )}
              {g.docs.map(d => {
                const i = pranchasExec.findIndex(p => p.url === d.url);
                const p = pranchasExec[i];
                return (
                  <div key={d.url}>
                    {p.tipo === "imagem"
                      ? miniatura(p, pranchasExec, i, true)
                      : botaoAbrir(`Abrir ${p.nome}`, p.tag, pranchasExec, i, 0)}
                  </div>
                );
              })}
            </div>
          ))}
          <p style={{ fontSize: 9.5, color: T.textMuted, textAlign: "center" }}>
            Arquivos do Valor, Projetos, Gestão e Produção: o card é único em todos os setores.
          </p>
        </div>
      )}

      {visor && (
        <VisorPranchas
          lista={visor.lista}
          indice={visor.i}
          onIr={irPrancha}
          onFechar={fecharVisor}
        />
      )}
    </section>
  );
}
