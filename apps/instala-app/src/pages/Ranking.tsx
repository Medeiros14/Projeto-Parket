import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";

type Equipe = {
  id: string;
  nome: string;
  categoria: string | null;
  pct_ok: number | null;
  total_ok: number | null;
  obras_distintas: number | null;
  dias_verificados: number | null;
};

// Score simples: obras entregues pesa mais, % OK vira multiplicador de qualidade.
function scoreOf(e: Equipe): number {
  const obras = Number(e.obras_distintas ?? 0);
  const ok = Number(e.total_ok ?? 0);
  const pct = Number(e.pct_ok ?? 0);
  return obras * 100 + ok * 10 + Math.round(pct);
}

export function Ranking({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [rows, setRows] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);

  const minhaCategoria = prestador?.categoria || null;

  const fetchRanking = useCallback(async () => {
    if (!minhaCategoria) return;
    setLoading(true);
    // Só compara com equipes da mesma categoria (Forro/Painel × Forro/Painel, etc)
    const { data } = await sb.from("vw_equipes_com_historico")
      .select("id,nome,categoria,pct_ok,total_ok,obras_distintas,dias_verificados")
      .eq("ativo", true)
      .eq("categoria", minhaCategoria);
    const ranked = ((data as Equipe[]) ?? [])
      .map((e) => ({ ...e, _score: scoreOf(e) }))
      .sort((a, b) => (b as any)._score - (a as any)._score);
    setRows(ranked);
    setLoading(false);
  }, [minhaCategoria]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const meuId = prestador?.id;
  const minhaPos = rows.findIndex((r) => r.id === meuId);

  return (
    <Screen
      slug={slug}
      titulo="Ranking"
      voltar={`/${slug}/mais`}
      subtitulo={`${minhaCategoria || "sem categoria"} · ${minhaPos >= 0 ? `você em ${minhaPos + 1}º de ${rows.length}` : `${rows.length} equipes`}`}
      action={
        <button onClick={fetchRanking} title="Atualizar" style={iconBtn(T)}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      }
    >
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ height: 68, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          Ainda não há dados de ranking.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((e, i) => {
            const pos = i + 1;
            const isMe = e.id === meuId;
            const medalha = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : null;
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: isMe ? T.textPrimary : T.cardBg,
                color: isMe ? T.bg : T.textPrimary,
                border: `1px solid ${isMe ? T.textPrimary : T.border}`,
              }}>
                <div style={{
                  minWidth: 34, textAlign: "center",
                  fontFamily: "'Cinzel', serif", fontSize: pos <= 3 ? 20 : 15, fontWeight: 500,
                  color: isMe ? T.bg : (pos <= 3 ? T.textPrimary : T.textMuted),
                }}>
                  {medalha ?? `${pos}º`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.nome}
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", opacity: isMe ? 0.75 : 0.6, textTransform: "uppercase" }}>
                    {e.categoria || "-"}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 10, letterSpacing: "0.05em", opacity: isMe ? 0.85 : 0.7 }}>
                  <div><b style={{ fontSize: 14, letterSpacing: 0 }}>{e.obras_distintas ?? 0}</b> obras</div>
                  <div>{e.pct_ok ?? 0}% OK</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, padding: "14px 16px", border: `1px dashed ${T.border}`, fontSize: 10, letterSpacing: "0.08em", color: T.textMuted, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
        <Trophy size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          RANKING PELA SOMA: <b>obras entregues × 100</b> + <b>checks OK × 10</b> + <b>% OK</b>.
          Quanto mais obras + qualidade nas verificações, mais alto na tabela.
        </div>
      </div>

      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
