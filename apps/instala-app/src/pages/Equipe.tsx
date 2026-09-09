import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Phone, RefreshCw, X } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { confirmar } from "../lib/confirmar";
import { Screen } from "../app/components/Screen";

type Membro = { id: string; equipe: string; nome: string; telefone: string | null; funcao: string | null };

const FUNCOES_SUGERIDAS = ["Ajudante", "Oficial", "Meio-oficial", "Mestre", "Aprendiz"];

export function Equipe({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [novo, setNovo] = useState({ nome: "", telefone: "", funcao: "" });
  const [saving, setSaving] = useState(false);

  // Só a equipe do líder logado — não mistura outras equipes da mesma categoria
  const chaveEquipe = prestador?.nome || "";

  const fetchMembros = useCallback(async () => {
    if (!chaveEquipe) return;
    setLoading(true);
    const { data } = await sb.from("equipes_membros")
      .select("id,equipe,nome,telefone,funcao")
      .eq("equipe", chaveEquipe)
      .order("nome", { ascending: true });
    setMembros((data as Membro[]) ?? []);
    setLoading(false);
  }, [chaveEquipe]);

  useEffect(() => { fetchMembros(); }, [fetchMembros]);

  async function adicionar() {
    if (!novo.nome.trim() || !chaveEquipe) return;
    setSaving(true);
    await sb.from("equipes_membros").insert({
      equipe: chaveEquipe,
      nome: novo.nome.trim(),
      telefone: novo.telefone.trim() || null,
      funcao: novo.funcao.trim() || null,
    });
    setNovo({ nome: "", telefone: "", funcao: "" });
    setShowAdd(false);
    setSaving(false);
    fetchMembros();
  }

  async function remover(id: string) {
    if (!(await confirmar("Remover este integrante?", "Sim, remover", "#ef4444"))) return;
    await sb.from("equipes_membros").delete().eq("id", id);
    fetchMembros();
  }

  return (
    <Screen
      slug={slug}
      titulo="Minha equipe"
      subtitulo={`${chaveEquipe} · ${membros.length} ${membros.length === 1 ? "integrante" : "integrantes"}`}
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchMembros} title="Atualizar" style={iconBtn(T)}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
          <button onClick={() => setShowAdd(true)} title="Adicionar" style={{ ...iconBtn(T), background: T.textPrimary, color: T.bg, border: `1px solid ${T.textPrimary}` }}>
            <Plus size={14} />
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 62, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : membros.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12, lineHeight: 1.5 }}>
          Você ainda não cadastrou seu time.
          <br /><br />Toque em <b style={{ color: T.textSecondary }}>+</b> pra adicionar (ajudante, oficial, mestre…).
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {membros.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", background: T.cardBg, border: `1px solid ${T.border}`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: T.textPrimary, color: T.bg,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 500, flexShrink: 0,
              }}>
                {m.nome[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: T.textPrimary, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.nome}
                </div>
                {m.funcao && (
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", marginBottom: 2 }}>
                    {m.funcao}
                  </div>
                )}
                {m.telefone && (
                  <a href={`tel:${m.telefone}`} style={{ fontSize: 11, color: T.textSecondary, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                    <Phone size={10} /> {m.telefone}
                  </a>
                )}
              </div>
              <button onClick={() => remover(m.id)} title="Remover" style={{
                background: "transparent", border: "none", color: T.textMuted, padding: 8, cursor: "pointer",
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}>
          <div style={{
            width: "100%", maxWidth: 480, background: T.bg, borderTop: `3px solid ${T.textPrimary}`,
            padding: "24px 22px calc(24px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: "0.06em" }}>Novo ajudante</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "none", color: T.textSecondary, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>NOME</span>
              <input autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={inputSt(T)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>FUNÇÃO</span>
              <input
                list="funcoes-sugeridas"
                value={novo.funcao}
                onChange={(e) => setNovo({ ...novo, funcao: e.target.value })}
                placeholder="Ex.: Ajudante, Oficial, Mestre…"
                style={inputSt(T)}
              />
              <datalist id="funcoes-sugeridas">
                {FUNCOES_SUGERIDAS.map((f) => <option key={f} value={f} />)}
              </datalist>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {FUNCOES_SUGERIDAS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNovo({ ...novo, funcao: f })}
                    style={{
                      padding: "5px 10px", fontSize: 10, letterSpacing: "0.1em",
                      background: novo.funcao === f ? T.textPrimary : "transparent",
                      color: novo.funcao === f ? T.bg : T.textSecondary,
                      border: `1px solid ${T.border}`, cursor: "pointer",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>TELEFONE (OPCIONAL)</span>
              <input type="tel" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} style={inputSt(T)} />
            </label>
            <button onClick={adicionar} disabled={!novo.nome.trim() || saving} style={{
              marginTop: 8, padding: "14px", background: T.textPrimary, color: T.bg, border: "none",
              fontSize: 11, letterSpacing: "0.2em", cursor: novo.nome.trim() ? "pointer" : "not-allowed",
              opacity: novo.nome.trim() && !saving ? 1 : 0.5,
            }}>
              {saving ? "SALVANDO…" : "ADICIONAR"}
            </button>
          </div>
        </div>
      )}

      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});

const inputSt = (T: any): React.CSSProperties => ({
  padding: "12px 14px", background: T.inputBg, border: `1px solid ${T.border}`,
  color: T.textPrimary, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none",
});
