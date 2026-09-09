import { useEffect, useMemo, useState } from "react";
import { api, type Board, type ProjetistaListItem } from "../api";
import { fonts } from "../theme";

export const TIPOS_DELEGACAO = [
  "Piso", "Forro", "Deck", "Marcenaria", "Escada", "Paineis", "Outros",
];

/* Modal do "+ Atribuir" da Gestão de Equipe.
   Multi-responsáveis (Will 26/08): uma obra pode ter Vinicius fazendo Piso
   e Suelen fazendo Marcenaria ao mesmo tempo. Cada linha tem SEUS PRÓPRIOS
   tipos/tamanho/prioridade/prazo — a proposta cabe partilhada entre eles.
   Grava via PATCH /cards/{id}/projetista (formato novo `{responsaveis: [...]}`),
   substituindo a lista inteira do card. Não fecha em click-fora (regra da casa). */
type LinhaResp = {
  projetista_id: string;
  tipos: string[];
  tamanho: string;
  prioridade: string;
  prazo: string;
};

const LINHA_VAZIA: LinhaResp = {
  projetista_id: "", tipos: [], tamanho: "", prioridade: "normal", prazo: "",
};

export default function AtribuirModal({ t, board, projetistas, onClose, onDone, cardIdInicial }: {
  t: any;
  board: Board | null;
  projetistas: ProjetistaListItem[];
  onClose: () => void;
  onDone: () => void;
  // Pré-seleciona uma obra ao abrir (usado quando o botão vem da lista
  // "Sem delegar" — a gestora já sabe qual obra é, não precisa procurar).
  cardIdInicial?: string;
}) {
  const [cardId, setCardId] = useState<string>("");
  const [linhas, setLinhas] = useState<LinhaResp[]>([{ ...LINHA_VAZIA }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const cards = useMemo(() =>
    [...(board?.cards || [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")), [board]);

  // Se veio pré-selecionada, dispara o mesmo escolherCard() que o dropdown
  // (herda responsáveis existentes, se houver).
  useEffect(() => {
    if (cardIdInicial && cards.length > 0) {
      escolherCard(cardIdInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdInicial, cards.length]);

  function escolherCard(id: string) {
    setCardId(id);
    setErro("");
    const c = cards.find(x => x.id === id);
    if (!c) return;
    // Se o card já tem responsáveis, pré-preenche a lista inteira.
    // Se não tem ninguém ainda, começa com uma linha vazia pra escolher.
    const resp = Array.isArray(c.responsaveis) ? c.responsaveis : [];
    if (resp.length > 0) {
      setLinhas(resp.map(r => ({
        projetista_id: r.projetista_id,
        tipos: Array.isArray(r.tipos) ? r.tipos : [],
        tamanho: r.tamanho || "",
        prioridade: r.prioridade || "normal",
        prazo: r.prazo || "",
      })));
    } else {
      setLinhas([{ ...LINHA_VAZIA }]);
    }
  }

  function updateLinha(i: number, patch: Partial<LinhaResp>) {
    setLinhas(prev => prev.map((l, k) => k === i ? { ...l, ...patch } : l));
  }
  function toggleTipoLinha(i: number, tp: string) {
    updateLinha(i, {
      tipos: linhas[i].tipos.includes(tp)
        ? linhas[i].tipos.filter(x => x !== tp)
        : [...linhas[i].tipos, tp],
    });
  }
  function addLinha() {
    setLinhas(prev => [...prev, { ...LINHA_VAZIA }]);
  }
  function removeLinha(i: number) {
    setLinhas(prev => prev.filter((_, k) => k !== i));
  }

  async function salvar() {
    if (!cardId) return;
    // Ignora linhas sem projetista escolhido (não é erro — o user pode ter
    // clicado "adicionar" e depois desistido daquela linha).
    const validas = linhas.filter(l => l.projetista_id);
    // Impede a mesma pessoa em 2 linhas do mesmo card (a chave PK do banco
    // é (card_id, projetista_id) — o segundo upsert só sobrescreveria o 1º).
    const ids = validas.map(l => l.projetista_id);
    if (new Set(ids).size !== ids.length) {
      setErro("Cada pessoa só pode aparecer uma vez por obra.");
      return;
    }
    setSalvando(true); setErro("");
    try {
      await api.delegarCardMulti(cardId, validas.map(l => ({
        projetista_id: l.projetista_id,
        tipos: l.tipos,
        tamanho: l.tamanho || null,
        prioridade: l.prioridade || "normal",
        prazo: l.prazo || null,
      })));
      onDone();
    } catch (e: any) {
      setErro(e?.message || "erro ao atribuir");
      setSalvando(false);
    }
  }

  const lbl: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
    textTransform: "uppercase", color: t.textTertiary, fontWeight: 500,
    display: "block", marginBottom: 8,
  };
  const campo = (preenchido: boolean): React.CSSProperties => ({
    width: "100%", boxSizing: "border-box", padding: "9px 12px",
    background: t.card1, border: `1px solid ${preenchido ? t.accent : t.border1}`,
    color: t.textPrimary, fontSize: 12, outline: "none",
    cursor: salvando ? "default" : "pointer",
  });

  // Pra evitar oferecer no dropdown alguém que já foi escolhido em outra
  // linha (senão o user cria uma "duplicata" que a gente só vai bloquear no
  // salvar). A pessoa selecionada da linha atual continua listada nela.
  function projetistasDisp(iAtual: number): ProjetistaListItem[] {
    const jaUsados = new Set(linhas
      .filter((l, k) => k !== iAtual && l.projetista_id)
      .map(l => l.projetista_id));
    return projetistas.filter(p => !jaUsados.has(p.id));
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: 640, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
        background: t.bg, border: `1px solid ${t.border2}`,
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)", padding: 24,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 18,
        }}>
          <h2 style={{
            fontFamily: fonts.cinzel, fontSize: 14, fontWeight: 500, margin: 0,
            letterSpacing: "0.16em", textTransform: "uppercase", color: t.textPrimary,
          }}>
            Atribuir Projeto
          </h2>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", fontSize: 15, padding: 2, lineHeight: 1,
          }}>{"✕"}</button>
        </div>

        <label style={lbl}>Projeto</label>
        <select value={cardId} disabled={salvando}
          onChange={e => escolherCard(e.target.value)}
          style={{ ...campo(!!cardId), marginBottom: 20 }}>
          <option value="">Selecionar projeto…</option>
          {cards.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <label style={lbl}>Responsáveis</label>
        {/* Uma linha por pessoa. Cada linha carrega tipos/tamanho/prioridade/prazo
            próprios — a mesma obra pode ter Piso pra sexta pro Vinicius e
            Marcenaria pra segunda pra Suelen. */}
        {linhas.map((linha, i) => (
          <div key={i} style={{
            border: `1px solid ${t.border1}`, padding: 14, marginBottom: 12,
            background: t.card1,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...lbl, marginBottom: 4 }}>Projetista</label>
                <select value={linha.projetista_id} disabled={salvando}
                  onChange={e => updateLinha(i, { projetista_id: e.target.value })}
                  style={campo(!!linha.projetista_id)}>
                  <option value="">Selecionar…</option>
                  {projetistasDisp(i).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.especialidade ? ` · ${p.especialidade}` : ""}{p.papel === "gestora" ? " ★" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {linhas.length > 1 && (
                <button type="button" disabled={salvando}
                  onClick={() => removeLinha(i)}
                  title="Tirar essa pessoa do projeto"
                  style={{
                    background: "transparent", border: `1px solid ${t.border1}`,
                    color: t.textTertiary, fontSize: 11, padding: "8px 12px",
                    cursor: "pointer", fontFamily: fonts.cinzel,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                  }}>
                  Remover
                </button>
              )}
            </div>

            <label style={{ ...lbl, marginBottom: 4 }}>Tipo (marca o que essa pessoa vai fazer)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {TIPOS_DELEGACAO.map(tp => {
                const ativo = linha.tipos.includes(tp);
                return (
                  <button key={tp} type="button" disabled={salvando}
                    onClick={() => toggleTipoLinha(i, tp)}
                    style={{
                      background: ativo ? `${t.accent}22` : "transparent",
                      color: ativo ? t.accent : t.textSecondary,
                      border: `1px solid ${ativo ? t.accent : t.border1}`,
                      borderRadius: 2, padding: "6px 12px", fontSize: 11,
                      fontWeight: 600, cursor: "pointer",
                    }}>
                    {ativo ? "✓ " : ""}{tp}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Tamanho</label>
                <select value={linha.tamanho} disabled={salvando}
                  onChange={e => updateLinha(i, { tamanho: e.target.value })}
                  style={campo(!!linha.tamanho)}>
                  <option value="">—</option>
                  <option value="pequeno">Pequeno</option>
                  <option value="medio">Médio</option>
                  <option value="grande">Grande</option>
                </select>
              </div>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Prioridade</label>
                <select value={linha.prioridade} disabled={salvando}
                  onChange={e => updateLinha(i, { prioridade: e.target.value })}
                  style={campo(true)}>
                  <option value="normal">Normal</option>
                  <option value="urgente">Urgente</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Prazo</label>
                <input type="date" value={linha.prazo} disabled={salvando}
                  onChange={e => updateLinha(i, { prazo: e.target.value })}
                  style={{
                    ...campo(!!linha.prazo), cursor: "auto",
                    colorScheme: t.bg === "#050505" ? "dark" : "light",
                  }} />
              </div>
            </div>
          </div>
        ))}

        <button type="button" disabled={salvando} onClick={addLinha}
          style={{
            background: "transparent", border: `1px dashed ${t.border1}`,
            color: t.textSecondary, padding: "10px 16px", cursor: "pointer",
            fontSize: 11, fontFamily: fonts.cinzel, letterSpacing: "0.16em",
            textTransform: "uppercase", width: "100%", marginBottom: 16,
          }}>
          + Adicionar responsável
        </button>

        {erro && (
          <div style={{ fontSize: 11, color: "#EF4444", marginBottom: 12 }}>{erro}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={salvar} disabled={salvando || !cardId} style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", background: t.accent,
            border: `1px solid ${t.accent}`, color: "#111",
            padding: "8px 14px", fontWeight: 600,
            cursor: salvando || !cardId ? "default" : "pointer",
            opacity: salvando || !cardId ? 0.5 : 1,
          }}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button onClick={onClose} disabled={salvando} style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", background: "transparent",
            border: `1px solid ${t.border1}`, color: t.textSecondary,
            padding: "8px 14px", fontWeight: 600, cursor: "pointer",
          }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
