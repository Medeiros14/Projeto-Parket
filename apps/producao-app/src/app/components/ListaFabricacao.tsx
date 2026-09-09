/** Lista de fabricação de uma OP — itens porta/marcenaria minimizados (expande no clique).
 *  Materiais em blocos MATÉRIA PRIMA / FERRAGENS / INSUMOS (modelo Excel de portas).
 *  etapa 2 (PRENSA E SEPARAÇÃO): conferência do kit por material → libera item pra produção.
 *  etapa 3+ (PRODUÇÃO): status por item (CONSTRUÇÃO → ACABAMENTO → CQ → EMBALAGEM).
 *  Com onChange vira editável: qtd/unidade/nome por insumo + adicionar/remover.
 *  onQuick = persistência imediata (status/conferido) sem exigir justificativa. */
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Plus, X, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { ItemFabricacao, InsumoFab, STATUS_ITEM_PRODUCAO, TIPOS_INSUMO, tipoFab, kitCompleto, estadoLiberacaoItem, nomeProdutoFab } from "../lib/producao";

/** Normaliza pra bater material do insumo com nome do estoque (mesma regra do conferirEstoque). */
const normNome = (s: string) =>
  String(s || "").toUpperCase().replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

export default function ListaFabricacao({ itens, maxHeight, onChange, etapa, onQuick, estoqueSaldo }: {
  itens: ItemFabricacao[];
  maxHeight?: number | string;
  onChange?: (itens: ItemFabricacao[]) => void;
  etapa?: string;
  onQuick?: (itens: ItemFabricacao[]) => void;
  /** Mapa nome_normalizado → saldo disponível no depósito (marcenaria-curitiba).
   *  Quando presente, marca insumos como "auto-conferido" se saldo ≥ qtd — o KIT
   *  vira sozinho conforme o Ronaldo dá entrada no almoxarifado. */
  estoqueSaldo?: Map<string, number>;
}) {
  const { t } = useTheme();
  const editavel = !!onChange;
  const [abertos, setAbertos] = useState<Record<number, boolean>>({});
  const emPrensa = !!etapa?.startsWith("2.");
  const emProducao = !!etapa && ["3.", "4."].some((p) => etapa.startsWith(p));
  const autoConferido = (ins: InsumoFab) => {
    if (!estoqueSaldo) return false;
    const saldo = estoqueSaldo.get(normNome(ins.nome)) ?? 0;
    const need = Number(ins.qtd) || 0;
    return need > 0 && saldo >= need;
  };
  const conferido = (ins: InsumoFab) => !!ins.conferido || autoConferido(ins);

  const patchItem = (i: number, patch: Partial<ItemFabricacao>, quick = false) => {
    const novos = itens.map((it, idx) => (idx !== i ? it : { ...it, ...patch }));
    (quick && onQuick ? onQuick : onChange)?.(novos);
  };
  const patchInsumo = (i: number, ins: InsumoFab, patch: Partial<InsumoFab>, quick = false) => {
    const novos = itens.map((it, idx) => idx !== i ? it : {
      ...it, insumos: (it.insumos || []).map((x) => (x !== ins ? x : { ...x, ...patch })),
    });
    (quick && onQuick ? onQuick : onChange)?.(novos);
  };
  const removerInsumo = (i: number, ins: InsumoFab) =>
    onChange!(itens.map((it, idx) => idx !== i ? it : {
      ...it, insumos: (it.insumos || []).filter((x) => x !== ins),
    }));
  // manual: true marca o insumo como nascido aqui no PCP — o watcher preserva
  // esses ao ressincronizar a lista com o Valor (sync_insumos_valoria).
  const addInsumo = (i: number, tipo: string) =>
    onChange!(itens.map((it, idx) => idx !== i ? it : {
      ...it, insumos: [...(it.insumos || []), { nome: "", unidade: "un", qtd: 1, tipo, manual: true }],
    }));

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "4px 6px", fontSize: 10.5, borderRadius: 0, outline: "none",
  };
  const chip: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
    padding: "2px 6px", border: `1px solid ${t.border}`, color: t.textSecondary, whiteSpace: "nowrap",
  };

  // A OP já mandou alguma rodada pro Ronaldo? Antes da primeira rodada NADA foi
  // enviado ainda, então marcar item por item seria alarme falso na lista inteira.
  // O aviso "NÃO ENVIADO PRA COMPRAS" só faz sentido depois que uma parte foi
  // liberada e outra ficou segurada (Will 04/09: "se isso acontecer marca no item").
  const houveRodadaCompra = itens.some((it) => it.compras_enviado_em);

  return (
    <div style={{ border: `1px solid ${t.border}`, ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}) }}>
      {itens.map((it, i) => {
        const aberto = !!abertos[i];
        // Nome do produto como foi vendido (Will 04/09): marcenaria mostra o
        // descritivo do móvel, painel/forro mostram o produto, porta é PORTA.
        const nome = nomeProdutoFab(it);
        const medidas = it.categoria === "porta" && it.porta?.largura_cm && it.porta?.altura_cm
          ? `${it.porta.largura_cm}×${it.porta.altura_cm} cm`
          : it.dimensao && it.dimensao !== "—" ? it.dimensao : null;
        const insumos = it.insumos || [];
        // Materiais de instalação em obra: informativos, fora do KIT da fábrica.
        const insumosInst = it.insumos_instalacao || [];
        const nConf = insumos.filter(conferido).length;
        const kitOk = insumos.length > 0 && insumos.every(conferido);
        const qtdPortas = it.categoria === "porta" ? (it.qtd || 1) : null;
        return (
          <div key={i} style={{ borderBottom: i < itens.length - 1 ? `1px solid ${t.border}` : "none" }}>
            {/* Cabeçalho minimizado — sempre visível em todas as etapas */}
            <div onClick={() => setAbertos((a) => ({ ...a, [i]: !aberto }))}
                 style={{ padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {aberto ? <ChevronDown size={12} style={{ color: t.textMuted, flexShrink: 0 }} />
                      : <ChevronRight size={12} style={{ color: t.textMuted, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textPrimary }}>
                  {it.numero && <span style={{ color: t.accent }}>{it.numero} </span>}
                  {nome}
                  <span style={{ fontWeight: 400, color: t.textMuted }}>
                    {it.ambiente ? ` — ${it.ambiente}` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 1 }}>
                  {[qtdPortas ? `${qtdPortas} PORTA${qtdPortas > 1 ? "S" : ""}` : null, medidas,
                    it.porta?.qtd_folhas ? `${it.porta.qtd_folhas} folha(s)` : null,
                    it.metragem ? `${it.metragem.toLocaleString("pt-BR")} m²` : null,
                    it.porta?.codigo].filter(Boolean).join(" · ")}
                </div>
                {/* Descritivo da porta já no fechado (Will 04/09): é ele que diz
                    ferragem, batente e puxador, e a fábrica precisa disso antes
                    de abrir o item. Nas outras categorias o descritivo já É o
                    nome do produto na linha de cima, então repetir só polui. */}
                {it.categoria === "porta" && it.descritivo && (
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>
                    {it.descritivo.toUpperCase()}
                  </div>
                )}
              </div>
              {/* Chip de liberação com 4 estados (Will 03/09). Antes o parcial só
                  era visível em PORTA e o "✓ Liberar" do Projetos (conferido, sem
                  ordem de produzir) caía em AGUARDA PROJETOS sem explicar nada. */}
              {(() => {
                const lb = estadoLiberacaoItem(it);
                const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
                const quando = it.liberado_para_producao_em || it.liberado_projetos_em || "?";
                const via = it.liberado_para_producao_por ? ` (via ${it.liberado_para_producao_por})` : "";
                if (lb.estado === "aguardando")
                  return (
                    <span title="Setor de Projetos ainda não liberou este item"
                          style={{ ...chip, color: t.warning, borderColor: t.warning }}>
                      AGUARDA PROJETOS
                    </span>
                  );
                if (lb.estado === "conferido")
                  return (
                    <span title={`Projetos conferiu o item em ${quando}${via}, mas ainda NÃO liberou pra produção. No Projetos: botão "Liberar pra Produção".`}
                          style={{ ...chip, color: t.info, borderColor: t.info }}>
                      CONFERIDO{lb.quem ? ` · ${lb.quem}` : ""}
                    </span>
                  );
                const frac = lb.liberada != null && lb.base != null
                  ? ` ${num(lb.liberada)}/${num(lb.base)} ${lb.unidade}` : "";
                if (lb.estado === "parcial")
                  return (
                    <span title={`Liberação PARCIAL do Projetos em ${quando}${via}. Produzir só ${num(lb.liberada || 0)} de ${num(lb.base || 0)} ${lb.unidade}; o restante volta quando Projetos usar "Ajustar produção".`}
                          style={{ ...chip, color: t.warning, borderColor: t.warning }}>
                      PROJETOS PARCIAL{frac}{lb.quem ? ` · ${lb.quem}` : ""}
                    </span>
                  );
                return (
                  <span title={`Liberado pra produção pelo Projetos em ${quando}${it.liberado_para_producao_autor ? " autorizado por " + it.liberado_para_producao_autor : ""}${via}`}
                        style={{ ...chip, color: t.success, borderColor: t.success }}>
                    PROJETOS OK{lb.quem ? ` · ${lb.quem}` : ""}
                  </span>
                );
              })()}
              {it.status_producao && (
                <span style={{ ...chip, color: t.info, borderColor: t.info }}>{it.status_producao}</span>
              )}
              {insumos.length > 0 && (
                kitOk
                  ? <span style={{ ...chip, color: t.success, borderColor: t.success }} title={estoqueSaldo ? "Todos os materiais têm saldo no Almoxarifado" : ""}>KIT OK</span>
                  : <span style={{ ...chip, color: nConf > 0 ? t.warning : t.textMuted, borderColor: nConf > 0 ? t.warning : t.border }}
                          title={estoqueSaldo ? "Auto pelo saldo do Almoxarifado Curitiba" : ""}>KIT {nConf}/{insumos.length}</span>
              )}
              {/* Rodada de compra do item (Will 04/09): quando o PCP manda só as
                  portas, a marcenaria fica aqui avisando que a lista dela não foi
                  pro Ronaldo. Só aparece em item com kit de fabricação e só depois
                  da primeira rodada da OP: sem nenhum envio, o aviso não separa
                  nada e só polui a lista toda de laranja. */}
              {insumos.length > 0 && houveRodadaCompra && (
                it.compras_enviado_em
                  ? <span style={{ ...chip, color: t.success, borderColor: t.success }}
                          title={`Lista de materiais deste item enviada pra Compras em ${new Date(it.compras_enviado_em).toLocaleString("pt-BR")}${it.compras_envio_id ? " (" + it.compras_envio_id + ")" : ""}`}>
                      COMPRAS {new Date(it.compras_enviado_em).toLocaleDateString("pt-BR")}
                    </span>
                  : <span style={{ ...chip, color: t.warning, borderColor: t.warning }}
                          title="A lista de materiais deste item ainda não foi pra Compras. Marque o item em 'O que vai pra Compras nesta rodada', confira o estoque e envie.">
                      NÃO ENVIADO PRA COMPRAS
                    </span>
              )}
            </div>

            {aberto && (
              <div style={{ padding: "0 10px 10px 30px" }}>
                {it.obs_producao && (
                  <div style={{
                    fontSize: 10.5, color: t.textPrimary, whiteSpace: "pre-wrap",
                    background: "rgba(20,184,166,0.08)", border: "1px dashed rgba(20,184,166,0.55)",
                    padding: "6px 9px", marginBottom: 6, lineHeight: 1.4,
                  }}>
                    <b style={{ fontSize: 9.5, color: "#0F766E", letterSpacing: "0.05em" }}>
                      {/* Rótulo prefere o autor da liberação (nome digitado);
                          cai pro email do login quando não há autor. */}
                      OBS DO PROJETOS
                      {(it.liberado_para_producao_autor || it.liberado_para_producao_por)
                        ? ` (${it.liberado_para_producao_autor || it.liberado_para_producao_por})` : ""}:
                    </b>{" "}
                    {it.obs_producao}
                  </div>
                )}
                {it.descritivo && (
                  <div style={{ fontSize: 10.5, color: t.textMuted, whiteSpace: "pre-wrap" }}>{it.descritivo}</div>
                )}

                {/* Status do ITEM na produção */}
                {emProducao && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4 }}>
                      STATUS DO ITEM
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {STATUS_ITEM_PRODUCAO.map((s) => {
                        const ativo = it.status_producao === s;
                        return (
                          <button key={s} type="button"
                                  onClick={() => patchItem(i, { status_producao: ativo ? null : s }, true)}
                                  style={{
                                    ...chip, cursor: "pointer",
                                    background: ativo ? t.accent : "transparent",
                                    color: ativo ? t.bg : t.textSecondary,
                                    borderColor: ativo ? t.accent : t.border,
                                  }}>{s}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Kit liberado (etapa prensa) */}
                {emPrensa && insumos.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: "6px 9px", fontSize: 10.5, fontWeight: 600,
                    border: `1px solid ${kitOk ? t.success : t.warning}`,
                    color: kitOk ? t.success : t.warning,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
                    {kitOk
                      ? "KIT COMPLETO — item liberado pra produção."
                      : `Confira o kit de fabricação: ${nConf}/${insumos.length} materiais conferidos.`}
                  </div>
                )}

                {(editavel || insumos.length > 0) && (
                  <div style={{ marginTop: 8, borderLeft: `2px solid ${t.accent}`, paddingLeft: 8 }}>
                    {TIPOS_INSUMO.map(({ id: tipoId, label }) => {
                      const doTipo = insumos.filter((x) => tipoFab(x.tipo) === tipoId);
                      if (!doTipo.length && !editavel) return null;
                      return (
                        <div key={tipoId} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: t.textSecondary }}>
                            {label}
                          </div>
                          {doTipo.map((ins, j) => {
                            const auto = autoConferido(ins);
                            const ok = conferido(ins);
                            return (
                            <div key={j} style={{ display: "flex", gap: 5, marginTop: 4, alignItems: "center" }}>
                              {emPrensa && (
                                <input type="checkbox" checked={ok} disabled={auto}
                                       title={auto ? "Conferido automático (tem saldo no Almoxarifado)" : "Material conferido no kit"}
                                       onChange={(e) => patchInsumo(i, ins, { conferido: e.target.checked }, true)}
                                       style={{ accentColor: t.success, cursor: auto ? "not-allowed" : "pointer", flexShrink: 0 }} />
                              )}
                              {editavel ? (
                                <>
                                  <input value={ins.qtd ?? ""} placeholder="qtd"
                                         onChange={(e) => patchInsumo(i, ins, { qtd: e.target.value })}
                                         style={{ ...inp, width: 56, textAlign: "right" }} />
                                  <input value={ins.unidade ?? ""} placeholder="un"
                                         onChange={(e) => patchInsumo(i, ins, { unidade: e.target.value })}
                                         style={{ ...inp, width: 56 }} />
                                  <input value={ins.nome} placeholder="Material…"
                                         onChange={(e) => patchInsumo(i, ins, { nome: e.target.value })}
                                         style={{ ...inp, flex: 1, ...(ok ? { borderColor: t.success } : {}) }} />
                                  {auto && <span style={{ ...chip, color: t.success, borderColor: t.success }} title="Estoque cobre">AUTO</span>}
                                  <button type="button" title="Remover material" onClick={() => removerInsumo(i, ins)} style={{
                                    background: "transparent", border: `1px solid ${t.border}`, color: t.danger,
                                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  }}><X size={10} /></button>
                                </>
                              ) : (
                                <div style={{ fontSize: 10.5, color: ok ? t.success : t.textPrimary, display: "flex", alignItems: "center", gap: 5 }}>
                                  {ins.qtd != null && ins.qtd !== "" ? `${ins.qtd} ${ins.unidade || "un"} — ` : ""}{ins.nome}
                                  {auto && <span style={{ ...chip, color: t.success, borderColor: t.success }} title="Estoque cobre">AUTO</span>}
                                </div>
                              )}
                            </div>
                            );
                          })}
                          {editavel && (
                            <button type="button" onClick={() => addInsumo(i, tipoId)} style={{
                              marginTop: 5, background: "transparent", border: `1px dashed ${t.border}`,
                              color: t.textSecondary, padding: "2px 7px", fontSize: 9, fontWeight: 700,
                              letterSpacing: "0.05em", cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}><Plus size={8} /> {label}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Material de instalação em obra — vem da lista de instalação da
                    proposta e acompanha o Valor. Só leitura e separado do kit de
                    fabricação: não entra na conferência do KIT nem no pedido de
                    compra da fábrica. */}
                {insumosInst.length > 0 && (
                  <div style={{ marginTop: 8, borderLeft: `2px dashed ${t.border}`, paddingLeft: 8 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: t.textSecondary }}>
                      MATERIAL DE INSTALAÇÃO (OBRA)
                    </div>
                    {insumosInst.map((ins, j) => (
                      <div key={j} style={{ fontSize: 10.5, color: t.textPrimary, marginTop: 4 }}>
                        {ins.qtd != null && ins.qtd !== "" ? `${ins.qtd} ${ins.unidade || "un"} — ` : ""}{ins.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
