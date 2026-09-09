import { useCallback, useEffect, useMemo, useState } from "react";
import { useTokens, fonts } from "../theme";
import { fetchBoard, moveCard, KANBAN_COLUMNS, type BoardRow, type KanbanColumnSlug } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../lib/auth";
import Header from "../components/Header";
import { CardTile } from "../components/CardTile";

export default function Board({ user }: { user: AppUser }) {
  const T = useTokens();
  const [rows, setRows]       = useState<BoardRow[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol]   = useState<KanbanColumnSlug | null>(null);
  const [q, setQ]               = useState("");

  const reload = useCallback(async () => {
    try { setRows(await fetchBoard()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Realtime — atualiza board quando cards/contratos mudam
  useEffect(() => {
    const ch = supabase.channel("contratos-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: "dept_id=eq.financeiro" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "contratos_docusign" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const c = (r.simulacao?.meta as any)?.contrato_cliente || {};
      const hay = [r.card.title, r.simulacao?.cliente, r.card.responsavel, c.nome, c.cpf_cnpj, c.email, c.cidade]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q]);

  const byCol = useMemo(() => {
    const m = new Map<string, BoardRow[]>();
    KANBAN_COLUMNS.forEach((c) => m.set(c.slug, []));
    (filtered || []).forEach((r) => {
      const arr = m.get(r.card.column_id || "") || [];
      arr.push(r);
      m.set(r.card.column_id || "", arr);
    });
    return m;
  }, [filtered]);

  const stats = useMemo(() => {
    const total     = rows?.length || 0;
    const assinados = rows?.filter((r) => r.contrato?.status === "assinado").length || 0;
    return { total, assinados };
  }, [rows]);

  const onDrop = async (slug: KanbanColumnSlug) => {
    const cid = dragging;
    setDragging(null); setOverCol(null);
    if (!cid) return;
    const row = rows?.find((r) => r.card.id === cid);
    if (!row || row.card.column_id === slug) return;
    setRows((r) => r?.map((x) => x.card.id === cid ? { ...x, card: { ...x.card, column_id: slug } } : x) || null);
    try { await moveCard(cid, slug); } catch (e: any) { alert("Erro ao mover: " + e.message); reload(); }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: fonts.inter }}>
      <Header user={user} stats={stats} />

      <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", gap: 16 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="BUSCAR CLIENTE, CPF, VENDEDOR…"
          style={{
            width: 340, background: T.inputBg, border: `1px solid ${T.border}`,
            color: T.textPrimary, padding: "10px 14px",
            fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
            outline: "none", fontFamily: fonts.inter,
          }}
        />
        {rows === null && <span style={{ color: T.textMuted, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>carregando…</span>}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, 1fr)`,
        gap: 12, padding: "0 24px 24px", alignItems: "start", minHeight: "calc(100vh - 140px)",
      }}>
        {KANBAN_COLUMNS.map((col) => {
          const cards = byCol.get(col.slug) || [];
          const isOver = overCol === col.slug;
          return (
            <div key={col.slug}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.slug); }}
              onDragLeave={() => setOverCol((v) => v === col.slug ? null : v)}
              onDrop={() => onDrop(col.slug)}
              style={{
                background: isOver ? T.cardHover : T.colBg,
                border: `1px solid ${isOver ? T.borderStrong : T.border}`,
                padding: 12, minHeight: 400,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", color: T.textPrimary, textTransform: "uppercase" }}>
                    {col.title}
                  </div>
                  <div style={{ fontSize: 8, letterSpacing: "0.16em", color: T.textMuted, textTransform: "uppercase", marginTop: 2, maxWidth: 240, lineHeight: 1.4 }}>
                    {col.descr}
                  </div>
                </div>
                <span style={{ fontFamily: fonts.cinzel, fontSize: 14, color: T.textSecondary }}>{cards.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((r) => (
                  <CardTile
                    key={r.card.id}
                    row={r}
                    dragging={dragging === r.card.id}
                    onDragStart={() => setDragging(r.card.id)}
                    onDragEnd={() => { setDragging(null); setOverCol(null); }}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", fontSize: 9, color: T.textMuted, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
