import { useEffect, useMemo, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, type SolicitacaoCompra, type Projeto as P } from "../api";
import { btnAccent, inputStyle } from "./Obras";
import { ListaSolicitacoes, SolicitarComprasModal } from "./SolicitacoesCompras";

/* ═══════════════════════════════════════════════════════════════════
   COMPRAS — visão geral das solicitações de todos os projetos +
   nova solicitação (escolhendo o projeto). Cards vão pro kanban de
   compras.parket.works.
   ═══════════════════════════════════════════════════════════════════ */

export default function Compras() {
  const t = useTokens();
  const [lista, setLista] = useState<SolicitacaoCompra[]>([]);
  const [projetos, setProjetos] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  // "Minhas solicitações" igual ao Space: identidade seedada do login
  // (gestao_user_nome, gravado pelo lib/auth.ts), editável; match por substring.
  const [eu, setEu] = useState(() =>
    localStorage.getItem("gestao_compras_eu") || localStorage.getItem("gestao_user_nome") || "");
  const [soMinhas, setSoMinhas] = useState(
    () => localStorage.getItem("gestao_compras_so_minhas") !== "0");
  const [qObra, setQObra] = useState("");

  const setEuP = (v: string) => {
    setEu(v);
    try { localStorage.setItem("gestao_compras_eu", v); } catch {}
  };
  const toggleMinhas = () => {
    setSoMinhas(v => {
      try { localStorage.setItem("gestao_compras_so_minhas", v ? "0" : "1"); } catch {}
      return !v;
    });
  };

  const filtrada = useMemo(() => {
    const norm = (v: unknown) => String(v || "").toLowerCase().trim();
    const k = norm(eu);
    const q = norm(qObra);
    return lista.filter(s => {
      if (soMinhas && k) {
        const v = norm(s.solicitante);
        if (!v || (v !== k && !v.includes(k) && !k.includes(v))) return false;
      }
      if (q) {
        const alvo = [s.cliente, s.obra, s.titulo, s.obra_code].map(norm).join(" ");
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [lista, soMinhas, eu, qObra]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.solicitacoesComprasAll().catch(() => [] as SolicitacaoCompra[]),
      api.projetos().catch(() => [] as P[]),
    ]).then(([l, p]) => { setLista(l); setProjetos(p); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const flash = (m: string) => { setFlashMsg(m); setTimeout(() => setFlashMsg(""), 5000); };

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1100 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, gap: 8, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 16, letterSpacing: "0.24em",
            textTransform: "uppercase", color: t.textPrimary, fontWeight: 500,
          }}>
            Solicitações de Compras{filtrada.length > 0 ? ` (${filtrada.length})` : ""}
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.06em", marginTop: 4 }}>
            {soMinhas && eu.trim()
              ? `Solicitações de ${eu.trim()} no kanban de compras`
              : "Todas as solicitações do kanban de compras — inclusive as feitas pelo Space de acompanhamento"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {flashMsg && <span style={{ fontSize: 10, color: t.accent, letterSpacing: "0.06em" }}>{flashMsg}</span>}
          <span style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.06em" }}>
            {filtrada.length} de {lista.length}
          </span>
          <input value={qObra} onChange={e => setQObra(e.target.value)} placeholder="Buscar por obra"
            title="Buscar por nome do cliente / obra / título"
            style={{ ...inputStyle(t), width: 180 }} />
          <input value={eu} onChange={e => setEuP(e.target.value)} placeholder="Seu nome"
            title="Seu nome, pra filtrar as suas solicitações"
            style={{ ...inputStyle(t), width: 130 }} />
          <button onClick={toggleMinhas} title="Mostrar só as solicitações feitas por você"
            style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap",
              background: soMinhas ? `${t.accent}22` : "transparent",
              border: `1px solid ${soMinhas ? t.accent : t.border2}`,
              color: soMinhas ? t.accent : t.textTertiary,
            }}>
            {soMinhas ? "✓ Só minhas" : "Só minhas"}
          </button>
          <button onClick={() => setModal(true)} style={btnAccent(t)}>+ Solicitar compras</button>
        </div>
      </div>

      {loading ? (
        <div style={{
          padding: 40, textAlign: "center", fontFamily: fonts.cinzel, fontSize: 10,
          letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary,
        }}>
          Carregando…
        </div>
      ) : (
        <ListaSolicitacoes lista={filtrada} t={t} mostrarProjeto />
      )}

      {modal && (
        <SolicitarComprasModal t={t} projetos={projetos} usuario={eu}
          onClose={() => setModal(false)}
          onCriada={(s) => {
            setModal(false); setLista(prev => [s, ...prev]);
            if (!eu.trim() && s.solicitante) setEuP(s.solicitante);
            flash("Solicitação enviada pro kanban de compras.");
          }} />
      )}
    </div>
  );
}
