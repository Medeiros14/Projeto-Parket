/** Produção / Marcenaria (producao_marcenaria) — mesma tabela do PCP legado. */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import SetorTabela, { ColDef } from "../components/SetorTabela";
import ListaFabricacao from "../components/ListaFabricacao";
import { useTheme } from "../hooks/useTheme";
import { Ordem, fetchOrdens, fetchMarcenaria, fmtData, contagemPorCategoria } from "../lib/producao";

const COLS: ColDef[] = [
  { key: "prioridade", label: "Prioridade" },
  { key: "inicio", label: "Início", tipo: "date" },
  { key: "entrega", label: "Entrega", tipo: "date" },
  { key: "cliente", label: "Cliente" },
  { key: "uf", label: "UF" },
  { key: "item", label: "Item" },
  { key: "acabamento", label: "Acabamento" },
  { key: "equipe", label: "Equipe" },
  { key: "status", label: "Status", tipo: "select", opcoes: ["EM ANDAMENTO", "PARALISADO", "FINALIZADO"] },
  { key: "observacao", label: "Observação", tipo: "textarea" },
];

export default function Marcenaria() {
  return (
    <>
      <OPsFabricacao />
      <SetorTabela
        titulo="Produção"
        subtitulo="Controle da marcenaria"
        tabela="producao_marcenaria"
        cols={COLS}
        fetch={fetchMarcenaria}
      />
    </>
  );
}

/** Listas de fabricação das OPs ativas — mesma lista que o modal do Kanban mostra. */
function OPsFabricacao() {
  const { t } = useTheme();
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    fetchOrdens().then((os) =>
      setOrdens(os.filter((o) => (o.itens?.length ?? 0) > 0 && o.etapa !== "7. FINALIZADO"))
    ).catch(() => setOrdens([]));
  }, []);

  if (!ordens.length) return null;

  return (
    <div style={{ padding: "24px 28px 0", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textMuted }}>
        Listas de fabricação — OPs ativas ({ordens.length})
      </div>
      {ordens.map((o) => {
        const open = aberta === o.id;
        const porCat = contagemPorCategoria(o.itens);
        return (
          <div key={o.id} style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
            <button type="button" onClick={() => setAberta(open ? null : o.id)} style={{
              width: "100%", background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            }}>
              {open ? <ChevronDown size={13} style={{ color: t.textMuted, flexShrink: 0 }} />
                    : <ChevronRight size={13} style={{ color: t.textMuted, flexShrink: 0 }} />}
              <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{o.id}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: t.textPrimary, flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{o.cliente_projeto}</span>
              <span style={{ fontSize: 10, color: t.textSecondary, flexShrink: 0 }}>
                {/* Resumo por categoria da proposta, sem rotular painel/forro de marcenaria. */}
                {porCat.map((c) => c.label.toLowerCase()).join(" · ")}
              </span>
              <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <CalendarDays size={10} /> {fmtData(o.prazo_entrega) !== "—" ? fmtData(o.prazo_entrega) : "Sem prazo"}
              </span>
            </button>
            {open && (
              <div style={{ padding: "0 12px 12px" }}>
                <ListaFabricacao itens={o.itens!} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
