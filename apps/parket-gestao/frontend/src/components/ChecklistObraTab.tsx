/** Checklist para Início de Obras (etapa 3) — preenchido pelo fiscal no gestão.
 *  Mesmas perguntas do form de 1ª vistoria do app fiscal, por serviço contratado.
 *  Respostas salvas em gestao.projeto_etapas.meta.checklist e exibidas na
 *  Central do Cliente (center.parket.works, etapa 3). */
import { useEffect, useMemo, useState } from "react";
import { api, type Etapa, type Item } from "../api";
import { fonts } from "../theme";

const CK_INICIO_OBRAS: Record<string, string[]> = {
  piso: ["Encontra-se nivelado e sem ondulações", "Encontra-se liso", "Apresenta arenoso", "Apresenta buracos ou calombos", "Pisos frios finalizados", "A espessura deixada para o nosso piso está de acordo com o nível dos pisos frios", "Baguetes finalizadas", "Tem espaço para dilatação do rodapé invertido", "Soleiras finalizadas", "Hidráulica está finalizada", "Elétrica está finalizada", "Gesso finalizado", "Massa corrida finalizada", "Primeira demão de tinta finalizada", "Portas instaladas", "Janelas instaladas", "Vidros e esquadrias instalados", "Realizada medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Umidade no contrapiso", "Área liberada para instalação?"],
  deck: ["Hidráulica está finalizada", "Elétrica está finalizada", "Pisos frios finalizados", "Alçapões no contrapiso", "Espessura deixada para nosso material acabado está de acordo", "Estrutura metálica finalizada (caso tenha)", "Tem encontro com piscinas/spas", "Tem escada na área de instalação do deck", "Vidros e esquadrias instalados", "Realizada a medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Área liberada para instalação?"],
  forro: ["Laje finalizada", "A laje tem alguma especificação", "Área de instalação do forro tem encontro com outros tipos de forros", "Vai ter cortineiro/sanca", "Vai ter beiral", "Estrutura do beiral finalizada", "Paredes finalizadas", "Portas instaladas", "Janelas instaladas", "Vidros e esquadrias instalados", "Hidráulica está finalizada", "Elétrica está finalizada", "Realizada a medição final", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Existe necessidade de andaime e escada", "Umidade na laje", "Área liberada para instalação?", "Projeto confere com a obra"],
  painel: ["Parede estruturada", "Parede requadrada", "Parede sem buracos", "Parede masseada", "Existe encontro com outros materiais", "Rodapé finalizado", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Existe necessidade de andaime e escada", "Caso forro e piso não sejam Parket: Forro finalizado", "Caso forro e piso não sejam Parket: Piso finalizado", "Realizada a medição final"],
  porta: ["Vão estruturado", "Vão requadrado", "Vão acabado e masseado", "Existe necessidade de andaime e escada", "Caçamba disponível", "Área de instalação livre de objetos e pessoas", "Caso forro e piso não sejam Parket: Forro finalizado", "Caso forro e piso não sejam Parket: Piso finalizado", "Realizada a medição final"],
  escada: ["Escada requadrada e em prumo", "Sem calombos", "Sem porosidade", "Nivelado", "Escada em ferro", "Medidas conferem com projeto", "Realizada a medição final", "Área de instalação livre de objetos e pessoas", "Caçamba disponível", "Existe necessidade de andaime e escada"],
};

const SERVICO_LABEL: Record<string, string> = {
  piso: "Piso", deck: "Deck", forro: "Forro", painel: "Painel",
  porta: "Porta", escada: "Escada", bancos: "Bancos",
};

const CATEGORIA_SERVICO: Record<string, string> = {
  PISO: "piso", DECK: "deck", FORRO: "forro", PAINEL: "painel",
  PORTA: "porta", ESCADA: "escada", BANCO: "bancos", BANCOS: "bancos",
};

const VALORES = [
  { v: "sim", label: "SIM" },
  { v: "nao", label: "NÃO" },
  { v: "na", label: "N/A" },
] as const;

type Resposta = { valor?: string | null; obs?: string };
type Checklist = Record<string, Record<string, Resposta>>;

export function ChecklistObraTab({ projetoId, etapa, onPatch, t }: {
  projetoId: string;
  etapa: Etapa | undefined;
  onPatch: (patch: any) => Promise<void> | void;
  t: any;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [ck, setCk] = useState<Checklist>(etapa?.meta?.checklist || {});
  const [fiscal, setFiscal] = useState<string>(etapa?.meta?.checklist_por || "");
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(etapa?.meta?.checklist_em || null);

  useEffect(() => { api.itens(projetoId).then(setItens).catch(() => setItens([])); }, [projetoId]);
  useEffect(() => {
    setCk(etapa?.meta?.checklist || {});
    setFiscal(etapa?.meta?.checklist_por || "");
    setSalvoEm(etapa?.meta?.checklist_em || null);
  }, [etapa]);

  const servicos = useMemo(() => {
    const set = new Set(
      itens
        .filter(i => i.status !== "cancelado")
        .map(i => CATEGORIA_SERVICO[String(i.meta?.categoria_raiz || i.categoria || "").toUpperCase()])
        .filter(Boolean),
    );
    for (const k of Object.keys(ck)) set.add(k);
    return Object.keys(CK_INICIO_OBRAS).filter(s => set.has(s));
  }, [itens, ck]);

  const setResp = (servico: string, pergunta: string, patch: Resposta) =>
    setCk(prev => ({
      ...prev,
      [servico]: {
        ...(prev[servico] || {}),
        [pergunta]: { ...(prev[servico]?.[pergunta] || {}), ...patch },
      },
    }));

  const contadores = useMemo(() => {
    let total = 0, feitos = 0;
    for (const s of servicos) {
      for (const q of CK_INICIO_OBRAS[s] || []) {
        total++;
        if (ck[s]?.[q]?.valor) feitos++;
      }
    }
    return { total, feitos };
  }, [servicos, ck]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const status = contadores.feitos === 0 ? "pendente"
        : contadores.feitos < contadores.total ? "em_andamento" : "concluida";
      await onPatch({
        status,
        meta: { checklist: ck, checklist_por: fiscal || null, checklist_em: agora },
      });
      setSalvoEm(agora);
    } finally {
      setSalvando(false);
    }
  };

  if (!servicos.length) {
    return (
      <div style={{ padding: 40, color: t.textTertiary, fontSize: 11, overflow: "auto" }}>
        Nenhum serviço contratado identificado (piso, deck, forro, painel, porta ou escada) — sem checklist a preencher.
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", padding: "20px 32px 60px" }}>
      {/* BARRA de status + fiscal + salvar */}
      <div style={{
        display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap",
        padding: "14px 16px", background: t.card2, border: `1px solid ${t.border1}`, marginBottom: 20,
      }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.18em", color: t.textPrimary, textTransform: "uppercase" }}>
            Checklist para Início de Obras
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 4 }}>
            {contadores.feitos}/{contadores.total} verificações respondidas
            {salvoEm ? ` · salvo em ${new Date(salvoEm).toLocaleString("pt-BR")}` : " · ainda não salvo"}
            {" · visível pro cliente na Central (etapa 3)"}
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 8, letterSpacing: "0.18em", color: t.textTertiary, textTransform: "uppercase", marginBottom: 4 }}>
            Fiscal responsável
          </label>
          <input
            value={fiscal} onChange={e => setFiscal(e.target.value)} placeholder="nome do fiscal"
            style={{
              padding: "7px 10px", background: t.card1, border: `1px solid ${t.border1}`,
              color: t.textPrimary, outline: "none", fontFamily: fonts.inter, fontSize: 11, width: 200,
            }}
          />
        </div>
        <button
          onClick={salvar} disabled={salvando}
          style={{
            padding: "9px 22px", background: t.accent, color: "#050505", border: "none",
            cursor: salvando ? "wait" : "pointer", fontFamily: fonts.inter,
            fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", opacity: salvando ? 0.6 : 1,
          }}
        >{salvando ? "Salvando…" : "Salvar checklist"}</button>
      </div>

      {servicos.map(s => {
        const perguntas = CK_INICIO_OBRAS[s] || [];
        const feitos = perguntas.filter(q => ck[s]?.[q]?.valor).length;
        return (
          <div key={s} style={{ marginBottom: 26, border: `1px solid ${t.border1}` }}>
            <div style={{
              padding: "9px 14px", background: t.card2, borderBottom: `1px solid ${t.border1}`,
              fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              color: feitos ? t.accent : t.textTertiary,
            }}>
              {SERVICO_LABEL[s] || s} · {feitos}/{perguntas.length}
            </div>
            {perguntas.map(q => {
              const r = ck[s]?.[q] || {};
              return (
                <div key={q} style={{
                  display: "grid", gridTemplateColumns: "1fr auto 220px", gap: 10,
                  alignItems: "center", padding: "8px 14px", borderBottom: `1px solid ${t.border1}`,
                }}>
                  <div style={{ fontSize: 11.5, color: t.textPrimary, lineHeight: 1.45 }}>{q}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {VALORES.map(({ v, label }) => {
                      const ativo = r.valor === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setResp(s, q, { valor: ativo ? null : v })}
                          style={{
                            padding: "5px 12px", cursor: "pointer",
                            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.16em",
                            background: ativo ? t.accent : t.card1,
                            color: ativo ? "#050505" : t.textSecondary,
                            border: `1px solid ${ativo ? t.accent : t.border1}`,
                          }}
                        >{label}</button>
                      );
                    })}
                  </div>
                  <input
                    value={r.obs || ""} onChange={e => setResp(s, q, { obs: e.target.value })}
                    placeholder="obs"
                    style={{
                      padding: "6px 8px", background: t.card1, border: `1px solid ${t.border1}`,
                      color: t.textSecondary, outline: "none", fontFamily: fonts.inter, fontSize: 10,
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
