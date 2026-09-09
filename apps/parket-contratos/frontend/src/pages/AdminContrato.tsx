import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTokens, fonts } from "../theme";
import { carregarClausulaAtiva, listarClausulas, salvarNovaVersao, ativarVersao, type Clausula } from "../lib/clausulas";
import { gerarHTMLContrato } from "../lib/contratoGenerator";
import type { AppUser } from "../lib/auth";

// Sample data pro preview — só cliente/CPF/endereço são interpolados no corpo.
const SAMPLE_INPUT: any = {
  card: { id: "preview", title: "Cliente Exemplo Ltda", responsavel: "Vendedor", details: {} },
  sim: {
    id: "preview", numero: "10000", cliente: "CLIENTE EXEMPLO LTDA",
    cnpj_cpf: "12.345.678/0001-90", endereco: "Rua Exemplo, 123, Bairro Central, Curitiba/PR",
    obra_code: "OBR-EX", vendedor: "Vendedor", validade_dias: 15, desconto_perc: 0,
    frete_valor: 0, created_at: new Date().toISOString(),
  },
  itens: [
    { id: "1", categoria: "PISO", descritivo: "Exemplo de item", valor: 10000, ordem: 1 },
  ],
  contratoCliente: {
    nome: "CLIENTE EXEMPLO LTDA", cpf_cnpj: "12.345.678/0001-90",
    rua: "Rua Exemplo", numero: "123", bairro: "Bairro Central", cidade: "Curitiba", uf: "PR",
  },
};

export default function AdminContrato({ user }: { user: AppUser }) {
  const T = useTokens();
  const [ativa, setAtiva]         = useState<Clausula | null>(null);
  const [historico, setHistorico] = useState<Clausula[]>([]);
  const [corpo, setCorpo]         = useState<string>("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const [a, h] = await Promise.all([carregarClausulaAtiva(), listarClausulas()]);
    setAtiva(a); setHistorico(h);
    setCorpo(a?.corpo_html || "");
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const dirty = ativa ? corpo.trim() !== (ativa.corpo_html || "").trim() : corpo.trim().length > 0;

  const previewHtml = useMemo(() => {
    if (!corpo) return "";
    try {
      return gerarHTMLContrato({ ...SAMPLE_INPUT, corpoContrato: corpo });
    } catch (e) { console.error(e); return ""; }
  }, [corpo]);

  async function onSalvar() {
    if (!user.canEditFinanceiro) { alert("Sem permissão pra editar"); return; }
    if (!corpo.trim()) { alert("Corpo vazio"); return; }
    if (!confirm(`Salvar como versão ${((historico[0]?.versao) || 0) + 1} e ativar?`)) return;
    setSaving(true);
    try {
      await salvarNovaVersao(corpo, user.email);
      setToast("Nova versão salva e ativada.");
      await refresh();
    } catch (e: any) { alert(e.message || "Erro"); }
    finally { setSaving(false); }
  }

  async function onAtivar(id: string) {
    if (!user.canEditFinanceiro) { alert("Sem permissão"); return; }
    if (!confirm("Ativar essa versão? A atual será desativada.")) return;
    try { await ativarVersao(id); setToast("Versão ativada."); await refresh(); }
    catch (e: any) { alert(e.message || "Erro"); }
  }

  const ph = { paddingInline: 6, paddingBlock: 4, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: T.textMuted, fontFamily: fonts.inter };
  const btn = (bg: string, fg: string) => ({
    background: bg, color: fg, border: `1px solid ${T.border}`, padding: "8px 14px",
    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const,
    cursor: "pointer", transition: "opacity .15s",
  });

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.textPrimary, fontFamily: fonts.inter }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.cardBg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" style={{ ...ph, textDecoration: "none" }}>← Voltar</Link>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 16, letterSpacing: "0.22em" }}>EDITOR DE CONTRATO</div>
          {ativa && <span style={{ ...ph, color: T.textSecondary }}>Ativa: v{ativa.versao} · {new Date(ativa.updated_at).toLocaleString("pt-BR")}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {toast && <span style={{ ...ph, color: "#2d7d46" }}>{toast}</span>}
          <button
            disabled={!dirty || saving || !user.canEditFinanceiro}
            style={{ ...btn(dirty && !saving ? T.textPrimary : T.border, dirty && !saving ? T.bg : T.textMuted), opacity: dirty && !saving ? 1 : 0.5 }}
            onClick={onSalvar}
          >{saving ? "Salvando…" : "Salvar nova versão"}</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, color: T.textSecondary }}>Carregando…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16, height: "calc(100vh / var(--pkz, 1) - 61px)" }}>
          {/* Coluna esquerda: editor + histórico */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={ph}>Corpo do contrato · HTML</span>
              <span style={{ ...ph, color: T.textSecondary }}>Placeholders: {"{{CLIENTE}}"} · {"{{CPF}}"} · {"{{ENDERECO}}"}</span>
            </div>
            <textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              disabled={!user.canEditFinanceiro}
              spellCheck={false}
              style={{
                flex: 1, minHeight: 0, resize: "none",
                fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12,
                lineHeight: 1.5, padding: 12, background: T.cardBg, color: T.textPrimary,
                border: `1px solid ${T.border}`, outline: "none",
              }}
            />
            <div>
              <div style={{ ...ph, marginBottom: 6 }}>Histórico</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {historico.map((h) => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: T.cardBg, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                      <span style={{ fontFamily: fonts.cinzel, letterSpacing: "0.14em" }}>v{h.versao}</span>
                      {h.ativa && <span style={{ ...ph, color: "#2d7d46" }}>ativa</span>}
                      <span style={{ color: T.textSecondary }}>{new Date(h.updated_at).toLocaleString("pt-BR")}</span>
                      <span style={{ color: T.textMuted }}>{h.updated_by || "—"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={btn(T.cardBg, T.textPrimary)} onClick={() => setCorpo(h.corpo_html)}>Carregar</button>
                      {!h.ativa && user.canEditFinanceiro && (
                        <button style={btn(T.cardBg, T.textPrimary)} onClick={() => onAtivar(h.id)}>Ativar</button>
                      )}
                    </div>
                  </div>
                ))}
                {historico.length === 0 && <div style={{ ...ph, padding: 12 }}>Sem versões salvas.</div>}
              </div>
            </div>
          </div>

          {/* Coluna direita: preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
            <span style={ph}>Preview com dados de exemplo</span>
            {previewHtml ? (
              <iframe
                key={corpo.length}
                srcDoc={previewHtml}
                style={{ flex: 1, minHeight: 0, background: "#fff", border: `1px solid ${T.border}` }}
                title="preview-contrato"
              />
            ) : (
              <div style={{ flex: 1, display: "grid", placeItems: "center", background: T.cardBg, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 12 }}>
                Preview vazio.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
