/** Checklist para Início de Obras — mesmas perguntas do doc de checklist
 *  do fiscal (1ª vistoria), por serviço contratado.
 *  Validação pelo lado do CLIENTE (cliente/engenheiro/arquiteto/gestor),
 *  no mesmo esquema do verifica.parket.works: check Feito/Pendente + observação
 *  por item, foto opcional (câmera ou galeria). A assinatura só é liberada
 *  quando todos os itens tiverem status marcado. */
import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, PenLine } from "lucide-react";
import type { CenterData, ChecklistRevisao, ChecklistTermo } from "../api";
import { api, fmtData, fmtDataHora } from "../api";
import { type ColorScheme, serif } from "../theme";
import { laudoPorTipo } from "../derive";

// Catálogo de perguntas da 1ª vistoria — espelho do form do fiscal (verifica.parket.works)
const CK_1VISTORIA: Record<string, string[]> = {
  piso: ["Encontra-se nivelado e sem ondulações", "Encontra-se liso", "Apresenta arenoso", "Apresenta buracos ou calombos", "Pisos frios finalizados", "A espessura deixada para o nosso piso está de acordo com o nível dos pisos frios", "Baguetes finalizadas", "Tem espaço para dilatação do rodapé invertido", "Soleiras finalizadas", "Hidráulica está finalizada", "Elétrica está finalizada", "Gesso finalizado", "Massa corrida finalizada", "Primeira demão de tinta finalizada", "Portas instaladas", "Janelas instaladas", "Vidros e esquadrias instalados", "Realizada medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Umidade no contrapiso", "Área liberada para instalação?"],
  deck: ["Hidráulica está finalizada", "Elétrica está finalizada", "Pisos frios finalizados", "Alçapões no contrapiso", "Espessura deixada para nosso material acabado está de acordo", "Estrutura metálica finalizada (caso tenha)", "Tem encontro com piscinas/spas", "Tem escada na área de instalação do deck", "Vidros e esquadrias instalados", "Realizada a medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Área liberada para instalação?"],
  forro: ["Laje finalizada", "A laje tem alguma especificação", "Área de instalação do forro tem encontro com outros tipos de forros", "Vai ter cortineiro/sanca", "Vai ter beiral", "Estrutura do beiral finalizada", "Paredes finalizadas", "Portas instaladas", "Janelas instaladas", "Vidros e esquadrias instalados", "Hidráulica está finalizada", "Elétrica está finalizada", "Realizada a medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Existe necessidade de andaime e escada", "Umidade na laje", "Área liberada para instalação?", "Projeto confere com a obra"],
  painel: ["Parede estruturada", "Parede requadrada", "Parede sem buracos", "Parede masseada", "Existe encontro com outros materiais", "Rodapé finalizado", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Existe necessidade de andaime e escada", "Caso forro e piso não sejam Parket: Forro finalizado", "Caso forro e piso não sejam Parket: Piso finalizado", "Realizada a medição final"],
  porta: ["Vão estruturado", "Vão requadrado", "Vão acabado e masseado", "Existe necessidade de andaime e escada", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Caso forro e piso não sejam Parket: Forro finalizado", "Caso forro e piso não sejam Parket: Piso finalizado", "Realizada a medição final"],
  escada: ["Escada requadrada e em prumo", "Sem calombos", "Sem porosidade", "Nivelado", "Escada em ferro", "Medidas conferem com projeto", "Realizada a medição final", "Área de instalação livre de objetos e pessoas", "Caçamba disponível", "Existe necessidade de andaime e escada"],
};

const FORRO_EXTRA: { key: "tipo_laje" | "reforco_necessario" | "insumos_necessarios"; label: string }[] = [
  { key: "tipo_laje", label: "Qual o tipo de laje?" },
  { key: "reforco_necessario", label: "Será necessário algum reforço?" },
  { key: "insumos_necessarios", label: "Quais insumos serão necessários?" },
];

const SERVICO_LABEL: Record<string, string> = {
  piso: "Piso", deck: "Deck", forro: "Forro", painel: "Painel",
  porta: "Porta", escada: "Escada", bancos: "Bancos", liberacao: "Liberação",
};

const CATEGORIA_SERVICO: Record<string, string> = {
  PISO: "piso", DECK: "deck", FORRO: "forro", PAINEL: "painel",
  PORTA: "porta", ESCADA: "escada", BANCO: "bancos", BANCOS: "bancos",
};

const PAPEIS: [string, string][] = [
  ["cliente", "Cliente"], ["engenheiro", "Engenheiro"],
  ["arquiteto", "Arquiteto"], ["gestor", "Gestor da obra"],
];
const PAPEL_LABEL = Object.fromEntries(PAPEIS);

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", em_execucao: "Em execução", concluido: "Concluído",
  feito: "Concluído", // compat com validações antigas
};

export const VALIDADOR_KEY = "parket-center-validador";

// Respostas do fiscal chegam com acentos normalizados ("Cacamba disponivel")
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

type Resposta = { obs?: string; valor?: string | null };

function badgeStyle(valor: string | null | undefined, c: ColorScheme, isDark: boolean) {
  if (valor === "sim") return { bg: isDark ? "rgba(200,182,138,0.09)" : "#FDF8EC", color: c.accent, label: "Sim" };
  if (valor === "nao") return { bg: isDark ? "rgba(120,50,60,0.10)" : "#FEF0F2", color: isDark ? "#9B4A5A" : "#7A2030", label: "Não" };
  if (valor === "na") return { bg: isDark ? "rgba(244,241,234,0.05)" : "#F2F0EC", color: c.textSecondary, label: "N/A" };
  return { bg: "transparent", color: c.textTertiary, label: "Pendente" };
}

export function ChecklistObras({ data, c, isDark, token }: {
  data: CenterData; c: ColorScheme; isDark: boolean; token: string;
}) {
  const laudo = laudoPorTipo(data, "1vistoria");
  // Fonte principal: checklist preenchido pelo fiscal no gestão (etapa 3).
  // Fallback: checklists do laudo de 1ª vistoria.
  const etapa3 = data.etapas.find(e => e.numero === 3);
  const doGestao = (etapa3?.meta?.checklist || {}) as Record<string, Record<string, Resposta>>;
  const temGestao = Object.keys(doGestao).length > 0;
  const checklists = temGestao ? doGestao : ((laudo?.conteudo?.checklists || {}) as Record<string, Record<string, Resposta>>);

  // Validação do cliente (meta.checklist_cliente) + estado otimista local
  const cc = (etapa3?.meta?.checklist_cliente || {}) as { itens?: Record<string, ChecklistRevisao>; termos?: Record<string, ChecklistTermo> };
  const [revisoes, setRevisoes] = useState<Record<string, ChecklistRevisao>>(() => ({ ...(cc.itens || {}) }));
  const [termos, setTermos] = useState<Record<string, ChecklistTermo>>(() => ({ ...(cc.termos || {}) }));
  const [validador, setValidador] = useState<{ nome: string; papel: string }>(() => {
    try { return JSON.parse(localStorage.getItem(VALIDADOR_KEY) || "") || { nome: "", papel: "" }; }
    catch { return { nome: "", papel: "" }; }
  });
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aceites, setAceites] = useState<Record<string, boolean>>({});
  const [termoObs, setTermoObs] = useState<Record<string, string>>({});
  const [assinando, setAssinando] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const chaveAlvo = useRef<{ chave: string; servico: string; pergunta: string } | null>(null);

  const setVal = (v: { nome: string; papel: string }) => {
    setValidador(v);
    try { localStorage.setItem(VALIDADOR_KEY, JSON.stringify(v)); } catch {}
  };

  // Identidade de quem valida: nome do login (salvo pelo LoginView) com
  // fallback pro nome do cliente do projeto; papel default "cliente".
  const ident = () => ({
    nome: (validador.nome || data.projeto.cliente || "").trim().slice(0, 120),
    papel: validador.papel || "cliente",
  });

  const contratados = new Set(
    data.itens
      .filter(i => i.status !== "cancelado")
      .map(i => CATEGORIA_SERVICO[((i.meta?.categoria_raiz || i.categoria || "") as string).toUpperCase()])
      .filter(Boolean),
  );
  for (const k of Object.keys(checklists)) contratados.add(k);

  const servicos = Object.keys(CK_1VISTORIA).filter(s => contratados.has(s))
    .concat([...contratados].filter(s => !CK_1VISTORIA[s]));
  if (!servicos.length) return null;

  let total = 0;
  const secoes = servicos.map(s => {
    const respostas = new Map(Object.entries(checklists[s] || {}).map(([q, r]) => [norm(q), r]));
    const perguntas = CK_1VISTORIA[s] || Object.keys(checklists[s] || {});
    const rows = perguntas.map(q => {
      const r = respostas.get(norm(q));
      total++;
      return { pergunta: q, chave: `${s}|${q}`, valor: r?.valor ?? null, obs: (r?.obs || "").trim() };
    });
    return { servico: s, rows };
  });

  const todasRows = secoes.flatMap(sec => sec.rows);
  const comStatus = todasRows.filter(r => revisoes[r.chave]?.status);
  const pendentesMarcados = todasRows.filter(r => revisoes[r.chave]?.status === "pendente");
  const emExecucao = todasRows.filter(r => revisoes[r.chave]?.status === "em_execucao");

  const salvar = async (servico: string, pergunta: string, chave: string,
                        campos: { status?: string; obs?: string; previsao?: string; file?: File }) => {
    if (enviando) return;
    setErro(""); setEnviando(chave);
    try {
      const id = ident();
      const form = new FormData();
      if (campos.file) form.append("file", campos.file);
      form.append("servico", servico);
      form.append("pergunta", pergunta);
      form.append("nome", id.nome);
      form.append("papel", id.papel);
      if (campos.status) form.append("status", campos.status);
      if (campos.obs) form.append("obs", campos.obs);
      if (campos.previsao) form.append("previsao", campos.previsao);
      const r = await api.checklistItem(token, form);
      setRevisoes(prev => ({ ...prev, [r.chave]: r.item }));
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(null);
    }
  };

  const pedirFoto = (servico: string, pergunta: string, chave: string, origem: "cam" | "gal") => {
    chaveAlvo.current = { chave, servico, pergunta };
    (origem === "cam" ? camRef : galRef).current?.click();
  };

  const onFoto = async (f: File | null, ref: React.RefObject<HTMLInputElement | null>) => {
    const alvo = chaveAlvo.current;
    if (!f || !alvo) return;
    await salvar(alvo.servico, alvo.pergunta, alvo.chave, { file: f });
    if (ref.current) ref.current.value = "";
  };

  const assinarTermo = async (servico: string, itensPendentes: string[]) => {
    if (assinando || !aceites[servico]) return;
    setErro("");
    if (!validador.nome.trim() || !validador.papel) {
      setErro("Preencha nome e papel de quem assina.");
      return;
    }
    setAssinando(servico);
    try {
      const r = await api.checklistTermo(token, {
        servico, nome: validador.nome.trim(), papel: validador.papel,
        obs: (termoObs[servico] || "").trim() || undefined,
        itens_pendentes: itensPendentes, aceite: true,
      });
      setTermos(prev => ({ ...prev, [servico]: r.termo }));
    } catch {
      setErro("Não foi possível assinar. Tente novamente.");
    } finally {
      setAssinando(null);
    }
  };

  const inp: React.CSSProperties = {
    background: "transparent", border: `1px solid ${c.border2}`, color: c.textPrimary,
    fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit",
  };
  const btn: React.CSSProperties = {
    background: "none", border: `1px solid ${c.border2}`, color: c.textTertiary,
    padding: "6px 12px", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
  };
  const amber = isDark ? "#C99A6B" : "#A96A2F";
  const red = isDark ? "#9B4A5A" : "#7A2030";

  return (
    <div style={{ marginBottom: 30 }}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
             onChange={e => onFoto(e.target.files?.[0] || null, camRef)} />
      <input ref={galRef} type="file" accept="image/*" style={{ display: "none" }}
             onChange={e => onFoto(e.target.files?.[0] || null, galRef)} />

      {(() => {
        const stats = [
          { label: "SERVIÇOS", value: String(servicos.length), sub: servicos.map(s => SERVICO_LABEL[s] || s).join(" · ") },
          { label: "ITENS DO CHECKLIST", value: String(total), sub: "verificações técnicas pré-obra" },
          { label: "REVISADOS", value: `${comStatus.length}/${total}`, sub: comStatus.length ? "itens com status marcado" : "marque o status de cada item" },
          { label: "PENDENTES", value: String(pendentesMarcados.length), sub: emExecucao.length ? `+ ${emExecucao.length} em execução` : pendentesMarcados.length ? "itens marcados como pendentes" : "nenhum item pendente" },
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", border: `1px solid ${c.border1}`, marginBottom: 26 }}>
            {stats.map(s => (
              <div key={s.label} style={{ padding: "18px 20px", borderRight: `1px solid ${c.border1}`, marginRight: -1 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: c.textPrimary, lineHeight: 1.1, marginBottom: 4 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: c.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {erro && (
        <div style={{ fontSize: 11, color: "#C07A4A", marginBottom: 14, letterSpacing: "0.03em" }}>{erro}</div>
      )}

      {secoes.map(({ servico, rows }) => {
        const feitos = rows.filter(r => revisoes[r.chave]?.status).length;
        return (
          <div key={servico} style={{ marginBottom: 26 }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: feitos ? c.accent : c.textTertiary, padding: "10px 10px",
              background: feitos
                ? (isDark ? "rgba(200,182,138,0.04)" : "#FDF8EC")
                : (isDark ? "rgba(95,93,88,0.05)" : "#F0EDEA"),
              borderBottom: `1px solid ${c.border1}`,
            }}>
              Checklist · {SERVICO_LABEL[servico] || servico} · {feitos}/{rows.length} validados
            </div>
            {rows.map(r => {
              const rev = revisoes[r.chave];
              const st = rev?.status === "feito" ? "concluido" : rev?.status;
              const b = badgeStyle(r.valor, c, isDark);
              const busy = enviando === r.chave;
              const obsVal = obsDraft[r.chave] ?? rev?.obs ?? "";
              const salvarObs = () => {
                const v = obsVal.trim();
                if (v && v !== (rev?.obs || "")) salvar(servico, r.pergunta, r.chave, { obs: v });
              };
              return (
                <div key={r.pergunta} style={{ padding: "12px 10px", borderBottom: `1px solid ${c.border1}`, opacity: busy ? 0.65 : 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: c.textSecondary, lineHeight: 1.5 }}>{r.pergunta}</div>
                      {r.obs && (
                        <div style={{ fontSize: 11, color: c.textTertiary, fontStyle: "italic", marginTop: 3 }}>{r.obs}</div>
                      )}
                    </div>
                    {r.valor && (
                      <span style={{
                        fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                        padding: "4px 10px", background: b.bg, color: b.color, whiteSpace: "nowrap",
                      }}>{b.label}</span>
                    )}
                  </div>

                  {/* Validação do cliente: check + obs + foto (câmera/galeria) */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                    <button onClick={() => salvar(servico, r.pergunta, r.chave, { status: "pendente" })} style={{
                      ...btn,
                      ...(st === "pendente" ? {
                        border: `1px solid ${red}`, color: red,
                        background: isDark ? "rgba(120,50,60,0.10)" : "#FEF0F2",
                      } : {}),
                    }}>Pendente</button>
                    <button onClick={() => salvar(servico, r.pergunta, r.chave, { status: "em_execucao" })} style={{
                      ...btn,
                      ...(st === "em_execucao" ? {
                        border: `1px solid ${amber}`, color: amber,
                        background: isDark ? "rgba(201,154,107,0.09)" : "#FBF3E9",
                      } : {}),
                    }}>Em execução</button>
                    {st === "em_execucao" && (
                      <input type="date" title="Data de previsão"
                             style={{ ...inp, fontSize: 11, padding: "5px 8px", colorScheme: isDark ? "dark" : "light" }}
                             value={rev?.previsao || ""}
                             onChange={e => e.target.value && salvar(servico, r.pergunta, r.chave, { previsao: e.target.value })} />
                    )}
                    <button onClick={() => salvar(servico, r.pergunta, r.chave, { status: "concluido" })} style={{
                      ...btn,
                      ...(st === "concluido" ? {
                        border: `1px solid ${c.accent}`, color: c.accent,
                        background: isDark ? "rgba(200,182,138,0.09)" : "#FDF8EC",
                      } : {}),
                    }}>✓ Concluído</button>
                    <input style={{ ...inp, flex: "1 1 170px", fontSize: 11, padding: "6px 10px" }}
                           placeholder="Observação (opcional)" value={obsVal}
                           onChange={e => setObsDraft(prev => ({ ...prev, [r.chave]: e.target.value }))}
                           onBlur={salvarObs}
                           onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    <button onClick={() => pedirFoto(servico, r.pergunta, r.chave, "cam")}
                            style={{ ...btn, border: `1px dashed ${c.border2}` }} title="Tirar foto agora">
                      <Camera size={11} strokeWidth={1.5} /> Tirar foto
                    </button>
                    <button onClick={() => pedirFoto(servico, r.pergunta, r.chave, "gal")}
                            style={{ ...btn, border: `1px dashed ${c.border2}` }} title="Escolher foto da galeria">
                      <ImageIcon size={11} strokeWidth={1.5} /> Galeria
                    </button>
                    {rev?.foto_url && (
                      <a href={rev.foto_url} target="_blank" rel="noreferrer" title="Ver foto da validação">
                        <img src={rev.foto_url} alt="" loading="lazy" style={{
                          width: 34, height: 34, objectFit: "cover", display: "block",
                          border: `1px solid ${c.border2}`,
                        }} />
                      </a>
                    )}
                  </div>
                  {st && (
                    <div style={{ fontSize: 10, color: st === "concluido" ? c.accent : st === "em_execucao" ? amber : red, marginTop: 6 }}>
                      {STATUS_LABEL[st] || st}
                      {st === "em_execucao" && rev?.previsao ? ` · previsão ${fmtData(rev.previsao)}` : ""}
                      {" "}· validado por {rev!.por} ({PAPEL_LABEL[rev!.papel] || rev!.papel}) em {fmtDataHora(rev!.em)}
                    </div>
                  )}
                </div>
              );
            })}
            {servico === "forro" && FORRO_EXTRA.some(f => laudo?.conteudo?.[f.key]) && (
              <div style={{ padding: "12px 10px", borderBottom: `1px solid ${c.border1}` }}>
                {FORRO_EXTRA.filter(f => laudo?.conteudo?.[f.key]).map(f => (
                  <div key={f.key} style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6 }}>
                    <span style={{ color: c.textTertiary }}>{f.label}</span> {String(laudo!.conteudo![f.key])}
                  </div>
                ))}
              </div>
            )}

            {/* ── Assinatura de conclusão POR SERVIÇO ── */}
            {(() => {
              const label = SERVICO_LABEL[servico] || servico;
              const termoSec = termos[servico];
              const pend = rows.filter(r => revisoes[r.chave]?.status === "pendente");
              const exec = rows.filter(r => revisoes[r.chave]?.status === "em_execucao");
              const naoConc = pend.concat(exec);
              const faltamSec = rows.length - feitos;
              if (termoSec) {
                return (
                  <div style={{ border: `1px solid ${c.border1}`, background: c.card1, padding: "18px 20px", marginTop: 14 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.accent, marginBottom: 8 }}>
                      Conclusão de checklist assinada · {label}
                    </div>
                    <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65 }}>
                      {termoSec.itens_pendentes.length ? (
                        <>{termoSec.nome} ({PAPEL_LABEL[termoSec.papel] || termoSec.papel}) enviou a validação assumindo a
                        responsabilidade por seguir com a obra com {termoSec.itens_pendentes.length} {termoSec.itens_pendentes.length === 1 ? "item não concluído" : "itens não concluídos"} do
                        checklist de {label} em {fmtDataHora(termoSec.assinado_em)}.</>
                      ) : (
                        <>{termoSec.nome} ({PAPEL_LABEL[termoSec.papel] || termoSec.papel}) validou todos os itens do
                        checklist de {label} e enviou em {fmtDataHora(termoSec.assinado_em)}.</>
                      )}
                      {termoSec.obs && (
                        <div style={{ fontSize: 11, color: c.textTertiary, fontStyle: "italic", marginTop: 6 }}>“{termoSec.obs}”</div>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ border: `1px solid ${c.border1}`, background: c.card1, padding: "18px 20px", marginTop: 14 }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
                    Assinatura de conclusão de checklist · {label}
                  </div>
                  {faltamSec > 0 ? (
                    <div style={{ fontSize: 12, color: c.textTertiary, lineHeight: 1.65 }}>
                      O envio é liberado quando todos os itens de {label} estiverem marcados como
                      Pendente, Em execução ou Concluído — {faltamSec === 1 ? "falta 1 item" : `faltam ${faltamSec} itens`}.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65, marginBottom: 14 }}>
                        {naoConc.length
                          ? `${naoConc.length === 1 ? "1 item ainda não está concluído" : `${naoConc.length} itens ainda não estão concluídos`} (${pend.length} pendente${pend.length === 1 ? "" : "s"}${exec.length ? `, ${exec.length} em execução` : ""}). Para seguir com o início da obra mesmo assim, confirme a declaração abaixo e envie a validação.`
                          : `Todos os itens de ${label} foram marcados como concluídos. Confirme a declaração abaixo e envie a validação.`}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <input style={{ ...inp, flex: "1 1 200px" }} placeholder="Nome completo de quem valida"
                               value={validador.nome} onChange={e => setVal({ ...validador, nome: e.target.value })} />
                        <select style={{ ...inp, flex: "0 1 180px", background: c.card1 }}
                                value={validador.papel} onChange={e => setVal({ ...validador, papel: e.target.value })}>
                          <option value="">Papel na obra…</option>
                          {PAPEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <textarea style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 54, marginBottom: 14 }}
                                placeholder="Observações sobre este checklist (opcional)"
                                value={termoObs[servico] || ""}
                                onChange={e => setTermoObs(prev => ({ ...prev, [servico]: e.target.value }))} />
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 14 }}>
                        <input type="checkbox" checked={!!aceites[servico]}
                               onChange={e => setAceites(prev => ({ ...prev, [servico]: e.target.checked }))}
                               style={{ marginTop: 2, accentColor: c.accent }} />
                        <span style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6 }}>
                          {naoConc.length
                            ? `Declaro que estou ciente dos itens do checklist de ${label} ainda não concluídos e, na condição de responsável pela obra, assumo a responsabilidade por eventuais impactos decorrentes do início da instalação nessas condições.`
                            : `Declaro que validei todos os itens do checklist de ${label} e confirmo que a obra está liberada para o início da instalação.`}
                        </span>
                      </label>
                      <button onClick={() => assinarTermo(servico, naoConc.map(p => p.chave))}
                              disabled={!aceites[servico] || !!assinando} style={{
                        background: c.accent, color: "#0B0B0B", border: "none",
                        padding: "11px 18px", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                        cursor: assinando === servico ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                        opacity: !aceites[servico] || assinando ? 0.55 : 1,
                      }}>
                        <PenLine size={12} strokeWidth={1.5} />
                        {assinando === servico ? "Enviando…" : "Enviar"}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
