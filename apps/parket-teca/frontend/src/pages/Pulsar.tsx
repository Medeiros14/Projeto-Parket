import { useEffect, useState, useMemo } from "react";
import { T, fonts, setorColor, useIsMobile } from "../theme";
import { api } from "../api";

type Insight = {
  id: string;
  slug: string;
  titulo: string;
  corpo: string;
  severidade: "info" | "warn" | "crit";
  setor: string | null;
  node_ids: string[];
  payload: any;
  created_at: string;
};

const SEV_COLOR: Record<string, string> = {
  crit: T.danger,
  warn: T.warn,
  info: T.textSecondary,
};

export default function Pulsar() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [lastSweep, setLastSweep] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "crit" | "warn" | "info">("all");
  const isMobile = useIsMobile();

  const load = () => {
    setLoading(true);
    api.insights()
      .then((r) => setItems(r as Insight[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sweep = async () => {
    setSweeping(true);
    try {
      const r = await api.insightsSweep();
      setLastSweep(`${r.generated} sinapses (${r.inserted} novas, ${r.auto_dismissed} silenciadas)`);
      load();
    } catch (e: any) {
      setLastSweep(`falhou: ${e.message || e}`);
    } finally {
      setSweeping(false);
    }
  };

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await api.insightsDismiss(id); } catch { load(); }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.severidade === filter);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const g: Record<string, Insight[]> = {};
    for (const i of filtered) {
      const k = i.setor || "geral";
      (g[k] ??= []).push(i);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { crit: 0, warn: 0, info: 0 };
    items.forEach((i) => { c[i.severidade] = (c[i.severidade] || 0) + 1; });
    return c;
  }, [items]);

  return (
    <div style={{ padding: isMobile ? "16px 16px 80px" : "24px 32px", height: "100%", overflowY: "auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "flex-start",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 12 : 0,
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", color: T.textPrimary }}>
            PULSAR
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 4 }}>
            sinapses ativas do núcleo
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastSweep && (
            <span style={{ fontFamily: fonts.inter, fontSize: 9, color: T.textMuted, letterSpacing: "0.08em" }}>
              {lastSweep}
            </span>
          )}
          <button
            onClick={sweep}
            disabled={sweeping}
            style={{
              background: "transparent",
              color: T.textPrimary,
              border: `1px solid ${T.border}`,
              padding: "6px 14px",
              fontFamily: fonts.inter,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: sweeping ? "wait" : "pointer",
              opacity: sweeping ? 0.5 : 1,
            }}
          >
            {sweeping ? "pulsando…" : "pulsar agora"}
          </button>
        </div>
      </div>

      {/* Barra de filtros por severidade */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `1px solid ${T.border}` }}>
        {(["all", "crit", "warn", "info"] as const).map((k) => {
          const label = k === "all" ? `TODAS · ${items.length}` : `${k.toUpperCase()} · ${(counts as any)[k] || 0}`;
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                background: active ? T.cardHover : "transparent",
                color: active ? T.textPrimary : T.textSecondary,
                border: "none",
                borderBottom: active ? `1px solid ${T.textPrimary}` : "1px solid transparent",
                padding: "10px 16px",
                fontFamily: fonts.inter,
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontFamily: fonts.inter, fontSize: 11 }}>
          consultando o pulsar…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: "center",
          background: T.cardBg, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.18em", color: T.textPrimary }}>
            NÚCLEO EM SILÊNCIO
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary, marginTop: 8, letterSpacing: "0.06em" }}>
            {filter === "all"
              ? "Nenhum insight ativo — clique em pulsar agora."
              : `Nenhum insight ${filter.toUpperCase()} no momento.`}
          </div>
        </div>
      )}

      {grouped.map(([setor, list]) => (
        <div key={setor} style={{ marginBottom: 32 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            paddingBottom: 6, borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{
              background: setorColor[setor] || T.textSecondary, color: T.bg,
              padding: "3px 8px", fontFamily: fonts.inter, fontSize: 8,
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>{setor}</span>
            <span style={{ fontFamily: fonts.inter, fontSize: 9, color: T.textMuted, letterSpacing: "0.12em" }}>
              {list.length} sinapse{list.length > 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 2 }}>
            {list.map((i) => (
              <div key={i.id} style={{
                position: "relative",
                padding: 20, background: T.cardBg,
                border: `1px solid ${SEV_COLOR[i.severidade] || T.border}`,
                borderLeftWidth: 3,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{
                    fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.18em",
                    color: SEV_COLOR[i.severidade] || T.textMuted, textTransform: "uppercase",
                  }}>{i.severidade}</span>
                  <button
                    onClick={() => dismiss(i.id)}
                    title="Silenciar"
                    style={{
                      background: "transparent", color: T.textMuted, border: "none",
                      padding: 0, fontSize: 14, cursor: "pointer", lineHeight: 1,
                    }}
                  >×</button>
                </div>
                <div style={{
                  fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.10em",
                  color: T.textPrimary, marginBottom: 8, lineHeight: 1.35,
                }}>{i.titulo.toUpperCase()}</div>
                <div style={{
                  fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary,
                  lineHeight: 1.6, letterSpacing: "0.02em",
                }}>{i.corpo}</div>
                {i.node_ids?.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {i.node_ids.slice(0, 4).map((nid) => (
                      <span key={nid} style={{
                        fontFamily: fonts.inter, fontSize: 8, color: T.textMuted,
                        letterSpacing: "0.08em", padding: "2px 6px",
                        border: `1px solid ${T.border}`,
                      }}>{nid.length > 32 ? nid.slice(0, 32) + "…" : nid}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
