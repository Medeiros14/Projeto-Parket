/** Modal detalhado do laudo — reusado em:
 *  - Fiscal.tsx / Gestão de Laudos (row clicável)
 *  - Projeto.tsx / Laudos & Vistorias (row clicável)
 *
 *  Mostra TUDO que o fiscal preencheu:
 *  - Cabeçalho (cliente, obra, endereço, tipo, status, fiscal, datas)
 *  - Descritivos (sistema, material)
 *  - Medição de obra
 *  - Serviços inclusos
 *  - Cada checklist_* como seção expansível (só renderiza se tiver conteúdo)
 *  - Observações
 *  - Grid de fotos
 *  - Botão "Gerar PDF" → abre verifica.parket.works/laudo.html?id=<uuid> em nova aba
 */
import React, { useEffect, useRef, useState } from "react";
import {
  api, type LaudoDetalhado, type Foto, type RelatorioDados,
  type LaudoItemProjeto, type LaudoProjetoInfo,
} from "../api";
import { fonts, useTokens } from "../theme";
import { gerarLaudoPdf, gerarTermoPdf } from "../lib/laudo-pdf";
import { midiaThumb } from "../lib/midia";

const PDF_BASE = "https://verifica.parket.works/laudo.html";

const CHECKLIST_LABELS: Record<string, string> = {
  checklist_piso:          "Checklist · PISO",
  checklist_deck:          "Checklist · DECK",
  checklist_forro:         "Checklist · FORRO",
  checklist_painel:        "Checklist · PAINEL",
  checklist_escada:        "Checklist · ESCADA",
  checklist_porta:         "Checklist · PORTA",
  checklist_bancos:        "Checklist · BANCOS",
  checklist_liberacao:     "Checklist · LIBERAÇÃO",
  checklist_equipe:        "Checklist · EQUIPE",
  checklist_produtividade: "Checklist · PRODUTIVIDADE",
  checklist_reparo:        "Checklist · REPARO",
  checklist_entrega:       "Checklist · ENTREGA",
  checklist_extra:         "Checklist · EXTRA",
};

// Sub-blocos do checklist_extra (mesmo esquema do verifica/laudo.html)
const EXTRA_LABELS: Record<string, string> = {
  qualidade: "Qualidade da Entrega",
  tipo:      "Tipo de Reparo",
  materiais: "Materiais",
};

function labelChecklist(key: string): string {
  return CHECKLIST_LABELS[key] || `Checklist · ${key.replace(/^checklist_/, "").toUpperCase()}`;
}

// Detecta se um objeto é um "checklist de perguntas" (values têm {valor,obs})
// vs. um objeto que agrupa sub-blocos (values são também objetos aninhados).
function isPerguntasChecklist(o: any): boolean {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const vals = Object.values(o);
  if (vals.length === 0) return false;
  // Heurística: pelo menos 1 valor é primitivo OU objeto com {valor,resposta,r,obs}
  return vals.some(v =>
    v === null ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    (v && typeof v === "object" && ("valor" in v || "resposta" in v || "r" in v || "obs" in v || "observacao" in v))
  );
}

const TIPO_LABEL: Record<string, string> = {
  "1vistoria":      "1ª Vistoria",
  "2vistoria":      "2ª Vistoria",
  "acompanhamento": "Acompanhamento",
  "entrega":        "Entrega",
  "reparo":         "Reparo",
  "termo":          "Termo de Responsabilidade",
  "fotografico":    "Relatório Fotográfico",
};

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtD(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function corStatus(s: string, t: any): string {
  const st = (s || "").toLowerCase();
  if (st === "concluido") return t.accent;
  if (st === "em_andamento") return "#C7A45B";
  if (st === "agendado") return "#8CA9B8";
  if (st === "cancelado") return "#5F5D58";
  return "#B85B4C";
}

export function LaudoDetalheModal({ laudoId, onClose }: {
  laudoId: string;
  onClose: () => void;
}) {
  const t = useTokens();
  const [laudo, setLaudo] = useState<LaudoDetalhado | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<LaudoProjetoInfo | null>(null);
  const [itens, setItens] = useState<LaudoItemProjeto[]>([]);
  const [dados, setDados] = useState<RelatorioDados>({});
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [linkAss, setLinkAss] = useState<"idle" | "gerando" | "copiado" | "erro">("idle");
  const [lapidando, setLapidando] = useState(false);
  const [autoSaveResumoMsg, setAutoSaveResumoMsg] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [gerandoResumoGestor, setGerandoResumoGestor] = useState(false);
  const [resumoGestorErro, setResumoGestorErro] = useState<string | null>(null);
  // Última versão do resumo pro cliente que já foi persistida.
  // Usado pelo auto-save pra não disparar PATCH quando o texto não mudou
  // (evita salvar-por-salvar após load ou após o próprio lapidar-com-IA).
  const lastSavedResumoRef = useRef<string>("");
  const resumoSaveInFlight = useRef(false);

  const gerarResumoGestor = async (force: boolean) => {
    setGerandoResumoGestor(true);
    setResumoGestorErro(null);
    try {
      const { resumo_gestor } = await api.laudoResumoGestor(laudoId, force);
      setDados(d => ({ ...d, resumo_gestor }));
    } catch (e: any) {
      setResumoGestorErro(e?.message || String(e));
    } finally {
      setGerandoResumoGestor(false);
    }
  };

  const lapidarComIA = async () => {
    if (!laudo) return;
    setLapidando(true);
    try {
      const { lapidado } = await api.laudoLapidar(laudo.id);
      setDados(d => ({ ...d, lapidado }));
    } catch (e: any) {
      alert(`Erro ao lapidar com IA: ${e?.message || e}`);
    } finally {
      setLapidando(false);
    }
  };

  const gerarLinkAssinatura = async () => {
    if (!laudo) return;
    setLinkAss("gerando");
    try {
      const { url } = await api.laudoLinkAssinatura(laudo.id);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copie o link de assinatura:", url);
      }
      setLinkAss("copiado");
      setTimeout(() => setLinkAss("idle"), 3500);
    } catch {
      setLinkAss("erro");
      setTimeout(() => setLinkAss("idle"), 3500);
    }
  };

  useEffect(() => {
    setLoading(true);
    api.laudoDetalhe(laudoId).then(r => {
      setLaudo(r.laudo);
      setFotos(r.fotos);
      setProjeto(r.projeto || null);
      setItens(r.itens || []);
      const rd = r.laudo.relatorio_dados || {};
      setDados(rd);
      // Snapshot do resumo pro cliente salvo — evita auto-save no load inicial.
      lastSavedResumoRef.current = rd.lapidado?.resumo || "";
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [laudoId]);

  // Auto-save do "Resumo pro cliente" — debounce 800ms após parar de digitar.
  // Salva `dados` inteiro (mesmo endpoint do lapidar/salvar). Só dispara
  // quando o texto muda em relação à última versão persistida.
  useEffect(() => {
    if (loading) return;
    const atual = dados.lapidado?.resumo || "";
    if (atual === lastSavedResumoRef.current) return;
    const timer = setTimeout(async () => {
      if (resumoSaveInFlight.current) return;
      resumoSaveInFlight.current = true;
      setAutoSaveResumoMsg("salvando");
      try {
        const novo = await api.laudoPatch(laudoId, { relatorio_dados: dados });
        setLaudo(l => (l ? { ...l, ...novo } : l));
        lastSavedResumoRef.current = atual;
        setAutoSaveResumoMsg("salvo");
        setTimeout(() => setAutoSaveResumoMsg(""), 1800);
      } catch (e: any) {
        setAutoSaveResumoMsg("erro");
        console.error("auto-save resumo cliente falhou:", e);
      } finally {
        resumoSaveInFlight.current = false;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dados, loading, laudoId]);

  const salvarRelatorio = async () => {
    setSalvando(true);
    try {
      const novo = await api.laudoPatch(laudoId, { relatorio_dados: dados });
      setLaudo(l => (l ? { ...l, ...novo } : l));
      setEditando(false);
    } catch (e: any) {
      alert(`Erro ao salvar relatório: ${e?.message || e}`);
    } finally {
      setSalvando(false);
    }
  };

  const baixarPdf = async () => {
    if (!laudo) return;
    setGerandoPdf(true);
    try {
      // Merge do state local (mais fresco — inclui auto-save ainda pendente)
      // com o laudo. `dados` sempre reflete o que o usuário vê no modal.
      await gerarLaudoPdf({ laudo: { ...laudo, relatorio_dados: dados }, fotos });
    } catch (e: any) {
      alert(`Erro ao gerar PDF: ${e?.message || e}`);
    } finally {
      setGerandoPdf(false);
    }
  };

  const pdfUrl = `${PDF_BASE}?id=${encodeURIComponent(laudoId)}`;

  return (
    <div onClick={editando ? undefined : onClose} style={{
      position: "fixed", inset: 0, background: (t as any).overlay || "rgba(0,0,0,0.6)",
      display: "grid", placeItems: "center", zIndex: 200, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(900px, 96vw)", maxHeight: "94vh",
        background: t.bg, border: `1px solid ${t.border2}`,
        display: "grid", gridTemplateRows: "auto 1fr auto", overflow: "hidden",
        fontFamily: fonts.inter,
      }}>
        {/* HEADER */}
        <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${t.border1}` }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary, marginBottom: 4 }}>
            Laudo técnico · public.fiscal_laudos
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", color: t.textPrimary }}>
                {laudo?.cliente || laudo?.obra || (loading ? "Carregando…" : "—")}
              </div>
              {laudo?.endereco && (
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, letterSpacing: "0.04em" }}>
                  {laudo.endereco}
                </div>
              )}
            </div>
            {laudo && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: corStatus(laudo.status, t) }}>
                  {TIPO_LABEL[laudo.tipo] || laudo.tipo} · {laudo.status}
                </div>
                <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 4, letterSpacing: "0.04em" }}>
                  {laudo.fiscal_nome || "—"} · {fmtD(laudo.data_vistoria || laudo.data_agendamento || laudo.created_at)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        <div style={{ overflow: "auto", padding: "18px 24px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary }}>
              carregando…
            </div>
          ) : !laudo ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 11, color: t.textTertiary }}>
              Laudo não encontrado.
            </div>
          ) : (
            <>
              {/* Resumo executivo pro gestor — gerado por IA e cacheado.
                  Diferente do "Resumo pro cliente" (lapidado): jargão OK,
                  foco em pendências. Regenera quando o laudo é editado. */}
              <ResumoGestorBloco
                t={t}
                dados={dados}
                laudoUpdatedAt={laudo.updated_at}
                gerar={gerarResumoGestor}
                gerando={gerandoResumoGestor}
                erro={resumoGestorErro}
              />

              {/* Descritivos + medição */}
              <SectionGrid t={t}>
                <MetaKV t={t} label="Descritivo do sistema"  v={laudo.descritivo_sistema} />
                <MetaKV t={t} label="Descritivo do material" v={laudo.descritivo_material} />
                <MetaKV t={t} label="Sistema de instalação"  v={laudo.sistema_instalacao} />
                <MetaKV t={t} label="Setor"                  v={laudo.setor} />
                <MetaKV t={t} label="Medição da obra"        v={laudo.medicao_obra} />
                <MetaKV t={t} label="Metragem por área"      v={laudo.metragem_areas} />
              </SectionGrid>

              {/* Ocorrências (aparece em destaque quando há) */}
              {laudo.ocorrencias && (
                <>
                  <SectionTitle t={t}>Ocorrências</SectionTitle>
                  <div style={{
                    fontSize: 12, color: t.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    padding: 14, background: "rgba(199,98,91,0.08)",
                    border: `1px solid #C7625B`, marginBottom: 20,
                  }}>
                    {laudo.ocorrencias}
                  </div>
                </>
              )}

              {/* Materiais / insumos em falta */}
              {(laudo.materiais_falta || laudo.insumos_falta) && (
                <>
                  <SectionTitle t={t}>Materiais &amp; insumos em falta</SectionTitle>
                  <SectionGrid t={t}>
                    <MetaKV t={t} label="Materiais em falta" v={laudo.materiais_falta} />
                    <MetaKV t={t} label="Insumos em falta"   v={laudo.insumos_falta} />
                  </SectionGrid>
                </>
              )}

              {/* Estrutura & reparo (só renderiza se algum campo tem conteúdo) */}
              {(laudo.tipo_laje || laudo.reforco_necessario || laudo.obs_andaime
                || laudo.descritivo_reparo || laudo.obs_solucao
                || laudo.insumos_necessarios) && (
                <>
                  <SectionTitle t={t}>Estrutura &amp; reparo</SectionTitle>
                  <SectionGrid t={t}>
                    <MetaKV t={t} label="Tipo de laje"        v={laudo.tipo_laje} />
                    <MetaKV t={t} label="Reforço necessário"  v={laudo.reforco_necessario} />
                    <MetaKV t={t} label="Obs. andaime"        v={laudo.obs_andaime} />
                    <MetaKV t={t} label="Descritivo do reparo" v={laudo.descritivo_reparo} />
                    <MetaKV t={t} label="Obs. solução"        v={laudo.obs_solucao} />
                    <MetaKV t={t} label="Insumos necessários" v={laudo.insumos_necessarios} />
                  </SectionGrid>
                </>
              )}

              {/* Assinatura do fiscal + GPS de início */}
              {(laudo.assinado_em || laudo.assinatura_fiscal_url
                || laudo.iniciado_em || laudo.iniciado_lat) && (
                <>
                  <SectionTitle t={t}>Vistoria &amp; assinatura do fiscal</SectionTitle>
                  <div style={{
                    display: "grid", gridTemplateColumns: laudo.assinatura_fiscal_url ? "1fr 220px" : "1fr",
                    gap: 14, alignItems: "start", marginBottom: 20,
                  }}>
                    <SectionGrid t={t}>
                      <MetaKV t={t} label="Iniciado em"  v={laudo.iniciado_em ? fmtDT(laudo.iniciado_em) : null} />
                      <MetaKV t={t} label="Assinado em"  v={laudo.assinado_em ? fmtDT(laudo.assinado_em) : null} />
                      <MetaKV t={t} label="Assinado por" v={laudo.assinado_por} />
                      {laudo.iniciado_lat && laudo.iniciado_lng && (
                        <MetaKV t={t} label="GPS início" v={
                          <a href={`https://www.google.com/maps?q=${laudo.iniciado_lat},${laudo.iniciado_lng}`}
                            target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "none" }}>
                            {laudo.iniciado_lat.toFixed(5)}, {laudo.iniciado_lng.toFixed(5)} · abrir no Maps →
                          </a>
                        } />
                      )}
                    </SectionGrid>
                    {laudo.assinatura_fiscal_url && (
                      <div style={{
                        border: `1px solid ${t.border1}`, padding: 8, background: "#FFFFFF",
                        textAlign: "center",
                      }}>
                        <div style={{
                          fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                          textTransform: "uppercase", color: t.textTertiary, marginBottom: 6,
                        }}>Assinatura fiscal</div>
                        <img src={laudo.assinatura_fiscal_url} alt="Assinatura do fiscal"
                          style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain" }} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Relatório modelo Parket (dados dos PDFs da pasta de obra) */}
              <RelatorioParketSection
                t={t}
                laudo={laudo}
                dados={dados}
                setDados={setDados}
                itens={itens}
                projeto={projeto}
                editando={editando}
                setEditando={setEditando}
                salvando={salvando}
                onSalvar={salvarRelatorio}
              />

              {laudo.servicos_inclusos && laudo.servicos_inclusos.length > 0 && (
                <>
                  <SectionTitle t={t}>Serviços inclusos</SectionTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 20 }}>
                    {laudo.servicos_inclusos.map((s, i) => (
                      <span key={i} style={{
                        fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                        textTransform: "uppercase", color: t.accent,
                        border: `1px solid ${t.borderHover}`, padding: "3px 8px",
                      }}>{s}</span>
                    ))}
                  </div>
                </>
              )}

              {laudo.observacoes && (
                <>
                  <SectionTitle t={t}>Observações</SectionTitle>
                  <div style={{
                    fontSize: 12, color: t.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    padding: 14, background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 20,
                  }}>
                    {laudo.observacoes}
                  </div>
                </>
              )}

              {/* Resumo técnico pro cliente — lapidado pela IA (persona engenheiro).
                  As anotações brutas do fiscal são informação interna e ficam intactas;
                  este é o texto que o cliente lê na página de assinatura. */}
              <SectionTitle t={t}>Resumo pro cliente · lapidado por IA</SectionTitle>
              <div style={{ padding: 14, background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: t.textTertiary, marginBottom: 8, lineHeight: 1.5 }}>
                  As anotações do fiscal ficam internas — este texto é o que o cliente lê e assina.
                  {dados.lapidado?.em ? ` Lapidado em ${fmtDT(dados.lapidado.em)}.` : ""}
                </div>
                <textarea
                  value={dados.lapidado?.resumo || ""}
                  onChange={e => setDados(d => ({ ...d, lapidado: { ...(d.lapidado || {}), resumo: e.target.value } }))}
                  placeholder="Clique em “Lapidar com IA” pra gerar o resumo técnico com identidade de engenheiro a partir das anotações do fiscal…"
                  rows={7}
                  style={{
                    width: "100%", boxSizing: "border-box", background: t.bg, color: t.textPrimary,
                    border: `1px solid ${t.border1}`, padding: 10, fontSize: 12.5, lineHeight: 1.6,
                    fontFamily: "inherit", resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end", alignItems: "center" }}>
                  {autoSaveResumoMsg && (
                    <span style={{
                      fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                      color: autoSaveResumoMsg === "erro" ? "#C7625B"
                        : autoSaveResumoMsg === "salvo" ? "#7BA394" : t.textTertiary,
                    }}>
                      {autoSaveResumoMsg === "salvando" ? "salvando…"
                        : autoSaveResumoMsg === "salvo" ? "✓ salvo"
                        : "! erro"}
                    </span>
                  )}
                  <button onClick={lapidarComIA} disabled={lapidando} style={{
                    background: "transparent", color: t.accent, border: `1px solid ${t.accent}`,
                    padding: "7px 14px", fontFamily: fonts.cinzel, fontSize: 9,
                    letterSpacing: "0.22em", textTransform: "uppercase",
                    cursor: lapidando ? "wait" : "pointer", opacity: lapidando ? 0.6 : 1,
                  }}>{lapidando ? "Lapidando…" : dados.lapidado?.resumo ? "✦ Lapidar de novo" : "✦ Lapidar com IA"}</button>
                </div>
              </div>

              {/* Checklists (só mostra os que têm conteúdo — descobertos dinamicamente).
                  checklist_extra pode ter sub-blocos (qualidade/tipo/materiais) —
                  expande cada um como um bloco próprio, mesmo esquema do verifica. */}
              {Object.keys(laudo)
                .filter(k => k.startsWith("checklist_"))
                .sort((a, b) => {
                  const oa = CHECKLIST_LABELS[a] ? 0 : 1;
                  const ob = CHECKLIST_LABELS[b] ? 0 : 1;
                  return oa - ob || a.localeCompare(b);
                })
                .flatMap(key => {
                  const raw = (laudo as any)[key];
                  if (!raw || (typeof raw === "object" && Object.keys(raw).length === 0)) return [];
                  // checklist_extra tem sub-blocos aninhados — expande cada um.
                  if (key === "checklist_extra" && !isPerguntasChecklist(raw)) {
                    return Object.entries(raw as Record<string, any>)
                      .filter(([, sub]) => sub && typeof sub === "object" && Object.keys(sub).length > 0)
                      .map(([subKey, sub]) => (
                        <ChecklistBlock key={`${key}.${subKey}`}
                          label={`Checklist · ${(EXTRA_LABELS[subKey] || subKey).toUpperCase()}`}
                          data={sub} t={t} />
                      ));
                  }
                  return [<ChecklistBlock key={key} label={labelChecklist(key)} data={raw} t={t} />];
                })}

              {/* Fotos */}
              {fotos.length > 0 && (
                <>
                  <SectionTitle t={t}>Registro fotográfico · {fotos.length}</SectionTitle>
                  <GridFotos fotos={fotos} t={t} />
                </>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: "12px 24px", borderTop: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
            {laudo && `ID · ${laudo.id.slice(0, 8)}…`}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={onClose} style={{
              background: "transparent", color: t.textSecondary,
              border: `1px solid ${t.border1}`, padding: "8px 14px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", cursor: "pointer",
            }}>Fechar</button>
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{
              background: "transparent", color: t.textSecondary,
              border: `1px solid ${t.border1}`, padding: "8px 14px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", cursor: "pointer", textDecoration: "none",
            }}>Laudo verifica →</a>
            {laudo && (
              <button onClick={gerarLinkAssinatura} disabled={linkAss === "gerando"} style={{
                background: "transparent",
                color: linkAss === "copiado" ? t.accent : linkAss === "erro" ? "#B85B4C" : t.textPrimary,
                border: `1px solid ${linkAss === "copiado" ? t.accent : t.borderHover}`,
                padding: "8px 14px", fontFamily: fonts.cinzel, fontSize: 9,
                letterSpacing: "0.22em", textTransform: "uppercase",
                cursor: linkAss === "gerando" ? "wait" : "pointer",
              }}>
                {linkAss === "gerando" ? "Gerando…"
                  : linkAss === "copiado" ? "✓ Link copiado"
                  : linkAss === "erro" ? "Erro — tentar de novo"
                  : "Link de assinatura"}
              </button>
            )}
            {laudo && (
              <button onClick={() => gerarTermoPdf({ laudo: { ...laudo, relatorio_dados: dados } })} style={{
                background: "transparent", color: t.textPrimary,
                border: `1px solid ${t.borderHover}`, padding: "8px 14px",
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
                textTransform: "uppercase", cursor: "pointer",
              }}>Termo (PDF)</button>
            )}
            <button onClick={baixarPdf} disabled={gerandoPdf || !laudo} style={{
              background: t.accent, color: t.bg, border: "none",
              padding: "9px 18px", fontFamily: fonts.cinzel, fontSize: 10,
              letterSpacing: "0.22em", textTransform: "uppercase",
              cursor: gerandoPdf ? "wait" : "pointer", opacity: gerandoPdf ? 0.6 : 1,
            }}>{gerandoPdf ? "Gerando…" : "Relatório (PDF)"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Relatório modelo Parket (relatorio_dados) ───────────
// Espelha os PDFs da pasta de obra (Fase 4): 9.1 Relatório Técnico,
// 9.2 Termo, 9.4 Acompanhamento. Editável + fonte do PDF nativo.

function fmtQtd(q: number, un: string): string {
  const n = Number(q) || 0;
  if ((un || "").toLowerCase() === "un") return `${String(Math.round(n)).padStart(2, "0")} UN`;
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${un || "m²"}`;
}

function inputS(t: any): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", background: t.bg,
    border: `1px solid ${t.border1}`, color: t.textPrimary,
    padding: "7px 9px", fontSize: 12, fontFamily: fonts.inter, outline: "none",
  };
}

function miniBtn(t: any, primario = false): React.CSSProperties {
  return {
    background: primario ? t.accent : "transparent",
    color: primario ? t.bg : t.textSecondary,
    border: primario ? "none" : `1px solid ${t.border1}`,
    padding: "6px 12px", fontFamily: fonts.cinzel, fontSize: 8.5,
    letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
  };
}

function RelatorioParketSection({ t, laudo, dados, setDados, itens, projeto, editando, setEditando, salvando, onSalvar }: {
  t: any;
  laudo: LaudoDetalhado;
  dados: RelatorioDados;
  setDados: React.Dispatch<React.SetStateAction<RelatorioDados>>;
  itens: LaudoItemProjeto[];
  projeto: LaudoProjetoInfo | null;
  editando: boolean;
  setEditando: (v: boolean) => void;
  salvando: boolean;
  onSalvar: () => void;
}) {
  const [novaEntrada, setNovaEntrada] = useState("");
  const [autorEntrada, setAutorEntrada] = useState(laudo.fiscal_nome || "");

  const set = (patch: Partial<RelatorioDados>) => setDados(d => ({ ...d, ...patch }));
  const setTermo = (patch: Partial<NonNullable<RelatorioDados["termo"]>>) =>
    setDados(d => ({ ...d, termo: { ...(d.termo || {}), ...patch } }));

  const importarItens = () => {
    if (!itens.length) { alert("Projeto sem itens vinculados."); return; }
    set({
      medicao_itens: itens.map(it => ({
        item: it.codigo || "",
        descricao: `${(it.produto_header || it.descritivo || "").toUpperCase()}${it.ambiente ? ` — ${it.ambiente.toUpperCase()}` : ""}`,
        qtd: fmtQtd(it.quantidade, it.unidade),
      })),
    });
  };

  const addEntrada = () => {
    const texto = novaEntrada.trim();
    if (!texto) return;
    setDados(d => ({
      ...d,
      entradas: [...(d.entradas || []), {
        autor: autorEntrada.trim() || "Fiscal",
        data: new Date().toISOString(),
        texto,
      }],
    }));
    setNovaEntrada("");
  };

  const medicao = dados.medicao_itens || [];
  const entradas = dados.entradas || [];
  const servicos = dados.servico_contratado || [];
  const vazio = !dados.vendedor && !dados.descricao_produto && !medicao.length &&
    !entradas.length && !servicos.length && !dados.relatorio_numero && !(dados.termo?.condicao);

  const th: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
    color: "#F4F1EA", background: "#4D4D4D", padding: "5px 8px", textAlign: "left",
  };
  const td: React.CSSProperties = {
    fontSize: 11, color: t.textPrimary, padding: "5px 8px",
    borderBottom: `1px solid ${t.border1}`, verticalAlign: "top",
  };

  return (
    <div style={{ margin: "4px 0 20px", border: `1px solid ${t.borderHover}` }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", background: t.card2, borderBottom: `1px solid ${t.border1}`,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary }}>
          Relatório · modelo Parket
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {editando ? (
            <>
              <button onClick={() => setEditando(false)} style={miniBtn(t)}>Cancelar</button>
              <button onClick={onSalvar} disabled={salvando} style={{ ...miniBtn(t, true), opacity: salvando ? 0.6 : 1 }}>
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditando(true)} style={miniBtn(t)}>Editar</button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 14px 16px", background: t.card1 }}>
        {!editando && vazio && (
          <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            relatório ainda não preenchido — clique em editar
          </div>
        )}

        {/* Cabeçalho do relatório */}
        {editando ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Campo2 t={t} label="Vendedor">
              <input style={inputS(t)} value={dados.vendedor || ""} placeholder={projeto?.vendedor || ""}
                onChange={e => set({ vendedor: e.target.value })} />
            </Campo2>
            <Campo2 t={t} label="Responsável">
              <input style={inputS(t)} value={dados.responsavel || ""}
                onChange={e => set({ responsavel: e.target.value })} />
            </Campo2>
            <Campo2 t={t} label="Relatório Nº">
              <input style={inputS(t)} type="number" value={dados.relatorio_numero ?? ""}
                onChange={e => set({ relatorio_numero: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </Campo2>
            <Campo2 t={t} label="Data do relatório">
              <input style={inputS(t)} type="date" value={dados.relatorio_data || ""}
                onChange={e => set({ relatorio_data: e.target.value })} />
            </Campo2>
          </div>
        ) : !vazio && (
          <SectionGrid t={t}>
            <MetaKV t={t} label="Vendedor" v={dados.vendedor} />
            <MetaKV t={t} label="Responsável" v={dados.responsavel} />
            <MetaKV t={t} label="Relatório Nº" v={dados.relatorio_numero != null ? `${dados.relatorio_numero}${dados.relatorio_data ? ` — ${new Date(dados.relatorio_data + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}` : null} />
            <MetaKV t={t} label="Descrição do produto" v={dados.descricao_produto} />
          </SectionGrid>
        )}

        {editando && (
          <Campo2 t={t} label="Descrição do produto">
            <textarea style={{ ...inputS(t), minHeight: 44, resize: "vertical" }} value={dados.descricao_produto || ""}
              onChange={e => set({ descricao_produto: e.target.value })} />
          </Campo2>
        )}

        {/* Serviço contratado */}
        {(editando || servicos.length > 0) && (
          <>
            <SectionTitle t={t}>Descrição do serviço contratado</SectionTitle>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <thead><tr>
                <th style={th}>Descrição</th>
                <th style={{ ...th, width: 90 }}>Quantidade</th>
                <th style={{ ...th, width: 100 }}>Previsão de início</th>
                <th style={{ ...th, width: 90 }}>Liberação</th>
                {editando && <th style={{ ...th, width: 30 }} />}
              </tr></thead>
              <tbody>
                {servicos.map((s, i) => (
                  <tr key={i}>
                    {editando ? (
                      <>
                        <td style={td}><input style={inputS(t)} value={s.descricao}
                          onChange={e => set({ servico_contratado: servicos.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x) })} /></td>
                        <td style={td}><input style={inputS(t)} value={s.quantidade}
                          onChange={e => set({ servico_contratado: servicos.map((x, j) => j === i ? { ...x, quantidade: e.target.value } : x) })} /></td>
                        <td style={td}><input style={inputS(t)} value={s.previsao_inicio || ""}
                          onChange={e => set({ servico_contratado: servicos.map((x, j) => j === i ? { ...x, previsao_inicio: e.target.value } : x) })} /></td>
                        <td style={td}><input style={inputS(t)} value={s.liberacao || ""}
                          onChange={e => set({ servico_contratado: servicos.map((x, j) => j === i ? { ...x, liberacao: e.target.value } : x) })} /></td>
                        <td style={td}><button style={{ ...miniBtn(t), padding: "4px 8px" }}
                          onClick={() => set({ servico_contratado: servicos.filter((_, j) => j !== i) })}>×</button></td>
                      </>
                    ) : (
                      <>
                        <td style={td}>{s.descricao}</td>
                        <td style={td}>{s.quantidade}</td>
                        <td style={td}>{s.previsao_inicio || "—"}</td>
                        <td style={td}>{s.liberacao || "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {editando && (
              <button style={{ ...miniBtn(t), marginBottom: 14 }}
                onClick={() => set({ servico_contratado: [...servicos, { descricao: "", quantidade: "" }] })}>
                + serviço
              </button>
            )}
          </>
        )}

        {/* Medição em obra */}
        {(editando || medicao.length > 0) && (
          <>
            <SectionTitle t={t}>Medição em obra (a preencher pelo fiscal)</SectionTitle>
            {editando && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button style={miniBtn(t)} onClick={importarItens}>
                  ⇩ Importar itens do projeto {itens.length ? `(${itens.length})` : ""}
                </button>
                <button style={miniBtn(t)}
                  onClick={() => set({ medicao_itens: [...medicao, { item: "", descricao: "", qtd: "" }] })}>
                  + linha
                </button>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
              <thead><tr>
                <th style={{ ...th, width: 60 }}>Item</th>
                <th style={th}>Descrição do item contratado</th>
                <th style={{ ...th, width: 90 }}>Qtd / m²</th>
                {editando && <th style={{ ...th, width: 30 }} />}
              </tr></thead>
              <tbody>
                {medicao.map((m, i) => (
                  <tr key={i}>
                    {editando ? (
                      <>
                        <td style={td}><input style={inputS(t)} value={m.item}
                          onChange={e => set({ medicao_itens: medicao.map((x, j) => j === i ? { ...x, item: e.target.value } : x) })} /></td>
                        <td style={td}><input style={inputS(t)} value={m.descricao}
                          onChange={e => set({ medicao_itens: medicao.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x) })} /></td>
                        <td style={td}><input style={inputS(t)} value={m.qtd}
                          onChange={e => set({ medicao_itens: medicao.map((x, j) => j === i ? { ...x, qtd: e.target.value } : x) })} /></td>
                        <td style={td}><button style={{ ...miniBtn(t), padding: "4px 8px" }}
                          onClick={() => set({ medicao_itens: medicao.filter((_, j) => j !== i) })}>×</button></td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{m.item || "—"}</td>
                        <td style={td}>{m.descricao}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{m.qtd}</td>
                      </>
                    )}
                  </tr>
                ))}
                {medicao.length === 0 && (
                  <tr><td style={{ ...td, color: t.textTertiary }} colSpan={editando ? 4 : 3}>sem itens</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Entradas de relatório (9.4) */}
        {(editando || entradas.length > 0) && (
          <>
            <SectionTitle t={t}>Relatório de acompanhamento</SectionTitle>
            {entradas.map((e, i) => (
              <div key={i} style={{ padding: "10px 12px", background: t.bg, border: `1px solid ${t.border1}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textPrimary }}>
                    {e.autor}{" "}
                    <span style={{ fontWeight: 400, color: t.textTertiary, fontSize: 10 }}>
                      {e.data ? new Date(e.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </span>
                  {editando && (
                    <button style={{ ...miniBtn(t), padding: "2px 8px" }}
                      onClick={() => setDados(d => ({ ...d, entradas: (d.entradas || []).filter((_, j) => j !== i) }))}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{e.texto}</div>
              </div>
            ))}
            {editando && (
              <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <input style={inputS(t)} placeholder="Autor (fiscal)" value={autorEntrada}
                  onChange={e => setAutorEntrada(e.target.value)} />
                <textarea style={{ ...inputS(t), minHeight: 70, resize: "vertical" }}
                  placeholder="Nova entrada do relatório…" value={novaEntrada}
                  onChange={e => setNovaEntrada(e.target.value)} />
                <div><button style={miniBtn(t, true)} onClick={addEntrada}>+ adicionar entrada</button></div>
              </div>
            )}
          </>
        )}

        {/* Termo de ciência e responsabilidade (9.2) */}
        {(editando || dados.termo?.condicao || laudo.tipo === "termo") && (
          <>
            <SectionTitle t={t}>Termo de ciência · condição constatada</SectionTitle>
            {editando ? (
              <>
                <textarea style={{ ...inputS(t), minHeight: 60, resize: "vertical", marginBottom: 8 }}
                  placeholder="Condição constatada na vistoria técnica…"
                  value={dados.termo?.condicao || ""}
                  onChange={e => setTermo({ condicao: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
                  <Campo2 t={t} label="Responsável pela obra">
                    <input style={inputS(t)} value={dados.termo?.resp_obra || ""} onChange={e => setTermo({ resp_obra: e.target.value })} />
                  </Campo2>
                  <Campo2 t={t} label="CPF">
                    <input style={inputS(t)} value={dados.termo?.resp_cpf || ""} onChange={e => setTermo({ resp_cpf: e.target.value })} />
                  </Campo2>
                  <Campo2 t={t} label="Data">
                    <input style={inputS(t)} value={dados.termo?.resp_data || ""} onChange={e => setTermo({ resp_data: e.target.value })} />
                  </Campo2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                  <Campo2 t={t} label="Técnico responsável (Parket)">
                    <input style={inputS(t)} value={dados.termo?.tecnico || ""} onChange={e => setTermo({ tecnico: e.target.value })} />
                  </Campo2>
                  <Campo2 t={t} label="CPF">
                    <input style={inputS(t)} value={dados.termo?.tecnico_cpf || ""} onChange={e => setTermo({ tecnico_cpf: e.target.value })} />
                  </Campo2>
                  <Campo2 t={t} label="Data">
                    <input style={inputS(t)} value={dados.termo?.tecnico_data || ""} onChange={e => setTermo({ tecnico_data: e.target.value })} />
                  </Campo2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                  <AssinaturaPad t={t} label="Assinatura · Responsável pela obra"
                    value={dados.termo?.resp_ass}
                    onChange={v => setTermo({ resp_ass: v })} />
                  <AssinaturaPad t={t} label="Assinatura · Técnico Parket"
                    value={dados.termo?.tecnico_ass}
                    onChange={v => setTermo({ tecnico_ass: v })} />
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.55, whiteSpace: "pre-wrap", padding: 12, background: t.bg, border: `1px solid ${t.border1}` }}>
                  {dados.termo?.condicao}
                </div>
                {(dados.termo?.resp_ass || dados.termo?.tecnico_ass) && (
                  <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                    {dados.termo?.resp_ass && (
                      <div>
                        <img src={dados.termo.resp_ass} alt="assinatura responsável" style={{ width: 220, height: 76, objectFit: "contain", background: "#fff", border: `1px solid ${t.border1}`, borderRadius: 4 }} />
                        <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 3, letterSpacing: "0.08em" }}>
                          {dados.termo?.resp_obra || "Responsável pela obra"}
                        </div>
                      </div>
                    )}
                    {dados.termo?.tecnico_ass && (
                      <div>
                        <img src={dados.termo.tecnico_ass} alt="assinatura técnico" style={{ width: 220, height: 76, objectFit: "contain", background: "#fff", border: `1px solid ${t.border1}`, borderRadius: 4 }} />
                        <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 3, letterSpacing: "0.08em" }}>
                          {dados.termo?.tecnico || "Técnico Parket"}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Pad de assinatura digital — desenha com mouse/touch, salva data URI PNG. */
export function AssinaturaPad({ value, onChange, label, t }: {
  value?: string; onChange: (v: string | undefined) => void; label: string; t: any;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const dirty = React.useRef(false);
  const [assinando, setAssinando] = React.useState(!value);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const down = (e: React.PointerEvent) => {
    const c = canvasRef.current; if (!c) return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#14140f";
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    dirty.current = true;
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const limpar = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(undefined);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary, marginBottom: 4 }}>
        {label}
      </div>
      {!assinando && value ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <img src={value} alt="assinatura" style={{
            width: 260, height: 90, objectFit: "contain",
            background: "#fff", border: `1px solid ${t.border1}`, borderRadius: 4,
          }} />
          <button style={miniBtn(t)} onClick={() => { setAssinando(true); onChange(undefined); }}>Refazer</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <canvas ref={canvasRef} width={520} height={180}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            style={{
              width: 260, height: 90, background: "#fff",
              border: `1px dashed ${t.border2 || t.border1}`, borderRadius: 4,
              cursor: "crosshair", touchAction: "none",
            }} />
          <button style={miniBtn(t)} onClick={limpar}>Limpar</button>
        </div>
      )}
    </div>
  );
}

function Campo2({ t, label, children }: { t: any; label: string; children: any }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Helpers de layout ───────────────────────────────────

function ResumoGestorBloco({ t, dados, laudoUpdatedAt, gerar, gerando, erro }: {
  t: any;
  dados: RelatorioDados;
  laudoUpdatedAt?: string | null;
  gerar: (force: boolean) => Promise<void>;
  gerando: boolean;
  erro: string | null;
}) {
  const rg = dados.resumo_gestor;
  const temResumo = !!(rg?.resumo);
  // Cache está "velho" se o laudo foi editado depois do resumo.
  const desatualizado = !!(temResumo && rg?.em && laudoUpdatedAt && rg.em < laudoUpdatedAt);

  return (
    <div style={{
      marginBottom: 20, padding: 14,
      background: temResumo ? t.card1 : "transparent",
      border: `1px solid ${temResumo ? t.borderHover : t.border1}`,
      borderLeft: `3px solid ${t.accent}`,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: temResumo ? 10 : 0, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.24em",
          textTransform: "uppercase", color: t.textPrimary,
        }}>
          ✦ Resumo executivo · IA
          {desatualizado && (
            <span style={{ color: "#C7A45B", marginLeft: 8, fontSize: 8 }}>
              (laudo foi editado — regerar)
            </span>
          )}
        </div>
        <button onClick={() => gerar(temResumo)} disabled={gerando} style={{
          background: temResumo ? "transparent" : t.accent,
          color: temResumo ? t.accent : t.bg,
          border: `1px solid ${t.accent}`,
          padding: "6px 12px", fontFamily: fonts.cinzel, fontSize: 9,
          letterSpacing: "0.20em", textTransform: "uppercase",
          cursor: gerando ? "wait" : "pointer", opacity: gerando ? 0.6 : 1,
        }}>
          {gerando ? "Gerando…" : temResumo ? "↻ Regerar" : "Gerar resumo"}
        </button>
      </div>

      {erro && (
        <div style={{
          fontSize: 10, color: "#C7625B", marginTop: 8, lineHeight: 1.5,
        }}>Erro: {erro}</div>
      )}

      {temResumo && (
        <>
          <div style={{
            fontSize: 12.5, color: t.textPrimary, lineHeight: 1.65, marginTop: 4,
            whiteSpace: "pre-wrap",
          }}>
            {rg!.resumo}
          </div>
          {rg?.pendencias && rg.pendencias.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
                textTransform: "uppercase", color: t.textTertiary, marginBottom: 6,
              }}>Pendências · {rg.pendencias.length}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {rg.pendencias.map((p, i) => (
                  <li key={i} style={{
                    fontSize: 12, color: t.textPrimary, lineHeight: 1.55, marginBottom: 3,
                  }}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{
            fontSize: 9, color: t.textTertiary, marginTop: 10,
            letterSpacing: "0.08em",
          }}>
            {rg?.em ? `Gerado em ${new Date(rg.em).toLocaleString("pt-BR")}` : ""}
            {rg?.modelo ? ` · ${rg.modelo}` : ""}
          </div>
        </>
      )}

      {!temResumo && !gerando && !erro && (
        <div style={{
          fontSize: 10, color: t.textTertiary, marginTop: 8, lineHeight: 1.5,
        }}>
          Briefing rápido do gestor: estado da obra + pendências acionáveis,
          extraído das anotações do fiscal.
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, t }: { children: any; t: any }) {
  return (
    <div style={{
      fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
      textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
      margin: "20px 0 10px",
    }}>{children}</div>
  );
}

function SectionGrid({ children, t }: { children: any; t: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>{children}</div>
  );
}

function MetaKV({ label, v, t }: { label: string; v: any; t: any }) {
  const isEmpty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  const isReactNode = React.isValidElement(v);
  const display: React.ReactNode = isEmpty
    ? "—"
    : isReactNode
      ? v
      : Array.isArray(v)
        ? v.join(", ")
        : String(v);
  return (
    <div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: isEmpty ? t.textTertiary : t.textPrimary, marginTop: 4, letterSpacing: "0.02em", lineHeight: 1.5 }}>
        {display}
      </div>
    </div>
  );
}

// ─── Renderização de checklist JSONB genérico ────────────
// Formatos suportados:
//   Array de { pergunta, resposta, observacao }  → tabela
//   Object { <chave>: { resposta, obs } | <string> | <bool> } → chave:valor
//   Object { itens: [...] } → itens
//   Qualquer outro → JSON pretty

function ChecklistBlock({ label, data, t }: { label: string; data: any; t: any }) {
  const [aberto, setAberto] = useState(false);

  const entries = normalizarChecklist(data);
  const count = entries.length;

  return (
    <div style={{ marginBottom: 12, border: `1px solid ${t.border1}` }}>
      <button onClick={() => setAberto(a => !a)} style={{
        width: "100%", padding: "10px 14px", background: aberto ? t.card2 : t.card1,
        border: "none", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "space-between", fontFamily: fonts.cinzel,
        fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
        color: t.textPrimary, textAlign: "left",
      }}>
        <span>{label} · <span style={{ color: t.textTertiary }}>{count} {count === 1 ? "item" : "itens"}</span></span>
        <span style={{ color: t.textTertiary, fontSize: 12 }}>{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && (
        <div style={{ padding: "12px 14px 16px", background: t.card1, borderTop: `1px solid ${t.border1}` }}>
          {entries.length === 0 ? (
            <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              sem dados preenchidos
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {entries.map((e, i) => (
                <ChecklistRow key={i} e={e} t={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ChecklistEntry = { pergunta: string; resposta: string; observacao?: string };

function normalizarChecklist(data: any): ChecklistEntry[] {
  if (!data) return [];
  const out: ChecklistEntry[] = [];

  // Array direto
  if (Array.isArray(data)) {
    for (const it of data) {
      if (it && typeof it === "object") {
        out.push({
          pergunta:   String(it.pergunta || it.q || it.item || it.label || it.nome || ""),
          resposta:   fmtResposta(it.resposta ?? it.r ?? it.valor ?? it.ans ?? it),
          observacao: it.observacao || it.obs || it.observacoes || it.comentario || undefined,
        });
      } else {
        out.push({ pergunta: String(it), resposta: "", observacao: undefined });
      }
    }
    return out.filter(x => x.pergunta || x.resposta);
  }

  // Objeto { chave: valor | { resposta, obs } }
  if (typeof data === "object") {
    // Se tem `itens: [...]`, recurse
    if (Array.isArray(data.itens)) return normalizarChecklist(data.itens);
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "object" && !Array.isArray(v)) {
        const obj: any = v;
        out.push({
          pergunta:   k,
          resposta:   fmtResposta(obj.resposta ?? obj.valor ?? obj.r ?? obj),
          observacao: obj.observacao || obj.obs || obj.comentario || undefined,
        });
      } else {
        out.push({ pergunta: k, resposta: fmtResposta(v), observacao: undefined });
      }
    }
    return out;
  }

  return [];
}

function fmtResposta(v: any): string {
  if (v === true)  return "SIM";
  if (v === false) return "NÃO";
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ChecklistRow({ e, t }: { e: ChecklistEntry; t: any }) {
  const rLower = (e.resposta || "").toLowerCase();
  const cor =
    rLower === "sim" || rLower === "ok" || rLower === "true" ? t.accent :
    rLower === "não" || rLower === "nao" || rLower === "false" ? "#B85B4C" :
    rLower === "n/a" || rLower === "na" ? "#5F5D58" :
    t.textSecondary;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 90px", gap: 10,
      padding: "8px 12px", background: t.bg,
      border: `1px solid ${t.border1}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: t.textPrimary, letterSpacing: "0.02em", lineHeight: 1.4 }}>
          {e.pergunta || "—"}
        </div>
        {e.observacao && (
          <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 4, letterSpacing: "0.02em", lineHeight: 1.4 }}>
            {e.observacao}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
        color: cor, textAlign: "right", whiteSpace: "nowrap",
      }}>
        {e.resposta || "—"}
      </div>
    </div>
  );
}

function GridFotos({ fotos, t }: { fotos: Foto[]; t: any }) {
  // Agrupa por serviço (mesmo esquema do verifica/laudo.html renderFotos).
  const grupos = new Map<string, Foto[]>();
  for (const f of fotos) {
    const s = (f.servico || "outros").toString();
    if (!grupos.has(s)) grupos.set(s, []);
    grupos.get(s)!.push(f);
  }
  const gruposArr = Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ marginBottom: 10 }}>
      {gruposArr.map(([servico, arr]) => (
        <div key={servico} style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8,
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em",
            textTransform: "uppercase", color: t.textPrimary,
          }}>
            <span style={{ width: 6, height: 6, background: t.accent, display: "inline-block" }} />
            {servico}
            <span style={{ color: t.textTertiary, fontSize: 9, letterSpacing: "0.14em" }}>
              ({arr.length})
            </span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6,
          }}>
            {arr.map(f => {
              const isVideo = (f.tipo || "").toLowerCase() === "video" || /\.(mp4|mov|webm)$/i.test(f.url);
              const legenda = f.descricao || f.ambiente || "";
              return (
                <div key={f.id} style={{
                  background: t.card2, border: `1px solid ${t.border1}`, overflow: "hidden",
                }}>
                  <a href={f.url} target="_blank" rel="noreferrer"
                    title={legenda || servico}
                    style={{
                      display: "block", aspectRatio: "4/3", textDecoration: "none",
                    }}>
                    {isVideo ? (
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        height: "100%", background: t.card2,
                      }}>
                        <div style={{
                          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em",
                          color: t.textSecondary, textTransform: "uppercase",
                        }}>▶ Vídeo</div>
                      </div>
                    ) : (
                      <img src={midiaThumb(f.url)} alt={legenda} loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                  </a>
                  {legenda && (
                    <div style={{
                      padding: "5px 7px", fontSize: 10, color: t.textSecondary,
                      lineHeight: 1.35,
                      borderTop: `1px solid ${t.border1}`,
                      wordBreak: "break-word",
                    }}>
                      {legenda}
                      {f.ambiente && f.descricao && f.ambiente !== f.descricao && (
                        <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                          {f.ambiente}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
