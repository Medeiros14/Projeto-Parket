/** Itens Contratados — mesmos itens do gestão exibidos no cronograma,
 *  embutido na etapa 1 do painel de documentos (foco no contrato). */
import type { CenterData, ItemObra } from "../api";
import { fmtNum } from "../api";
import { type ColorScheme } from "../theme";

const COLS = [
  { key: "item", label: "ITEM", width: "56px" },
  { key: "name", label: "AMBIENTE", width: "1.2fr" },
  { key: "desc", label: "PRODUTO / SERVIÇO", width: "1.6fr" },
  { key: "qtd", label: "QTD CONTRATADA", width: "130px" },
];
const gridColumns = COLS.map(c => c.width).join(" ");

export function codigoItem(it: ItemObra): string {
  if (it.meta?.codigo) return it.meta.codigo!;
  const m = (it.descritivo || "").match(/^(\d+(?:\.\d+)?)/);
  return m ? m[1] : String(it.ordem / 10 || it.ordem);
}

const STATUS_ITEM_LABEL: Record<string, string> = {
  pendente: "Pendente", preparando: "Preparando", em_execucao: "Em execução",
  instalado: "Instalado", entregue: "Entregue", com_ressalva: "Com ressalva",
};

// PORTA/REVESTIMENTO importados em "un" → converte pra m² parseando "L×A" do
// descritivo (Will 28/07: exibição em m² em todos os cascatados). Porta = 2 faces.
function parseDimsMxM(...textos: (string | undefined | null)[]): { l: number; h: number } | null {
  for (const t of textos) {
    if (!t) continue;
    const m = t.match(/(\d+[,.]?\d*)\s*[×xX]\s*(\d+[,.]?\d*)/);
    if (!m) continue;
    let l = parseFloat(m[1].replace(",", "."));
    let h = parseFloat(m[2].replace(",", "."));
    if (!isFinite(l) || !isFinite(h) || l <= 0 || h <= 0) continue;
    if (l > 10) l /= 100; if (h > 10) h /= 100;  // cm → m
    return { l, h };
  }
  return null;
}

function qtdContratada(it: ItemObra): { qtd: number; unidade: string } {
  const un = (it.unidade || "").toLowerCase();
  const cat = (it.meta?.categoria_raiz || it.categoria || "").toUpperCase();
  const qtdRaw = Number(it.quantidade) || 0;
  if ((cat === "PORTA" || cat === "REVESTIMENTO") && !un.startsWith("m")) {
    const extra = (it.meta as any)?.descricao_extra as string | undefined;
    const dims = parseDimsMxM(extra, it.descritivo);
    if (dims) {
      // Cascatados (Novita etc): 1 linha = 1 porta física; qtd em "un" vem
      // com valor default da migração (5/10) e não representa nº de peças.
      // Fórmula = L × H × 2 faces (porta) ou L × H (revestimento).
      const faces = cat === "PORTA" ? 2 : 1;
      return { qtd: dims.l * dims.h * faces, unidade: "m²" };
    }
  }
  return { qtd: qtdRaw, unidade: it.unidade || "" };
}

function Row({ it, c }: { it: ItemObra; c: ColorScheme }) {
  const q = qtdContratada(it);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: gridColumns, padding: "15px 0",
      borderBottom: `1px solid ${c.border1}`, alignItems: "center",
    }}>
      <div style={{ padding: "0 10px", fontSize: 11, color: c.textTertiary }}>{codigoItem(it)}</div>
      <div style={{ padding: "0 10px", fontSize: 13, color: c.textPrimary }}>
        {it.ambiente || "—"}
      </div>
      <div style={{ padding: "0 10px", fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>
        {(it.descritivo || "").replace(/^\d+(\.\d+)?\s*·\s*/, "") || it.categoria || "—"}
      </div>
      <div style={{ padding: "0 10px", fontSize: 13, color: c.textSecondary }}>
        {fmtNum(q.qtd)} {q.unidade}
      </div>
    </div>
  );
}

export function ItensContratados({ data, c, isDark }: { data: CenterData; c: ColorScheme; isDark: boolean }) {
  // Só produto vendido — insumos e instalação são aux e não aparecem na lista
  // Contratada (Will 24/07: sair igual está no orçamento, 1.1, 1.2, ...).
  const itens = data.itens.filter(i => i.status !== "cancelado" && !(i.meta as any)?.aux_kind);
  if (!itens.length) return null;
  const accentColor = isDark ? "#C8B68A" : "#8A6F3D";
  const pendColor = isDark ? "#5F5D58" : "#9D9790";

  const grupos = Array.from(new Set(itens.map(i => i.categoria || "GERAL")));

  return (
    <div className="pkt-scroll-x" style={{ marginBottom: 30 }}>
      <div>
      <div style={{ display: "grid", gridTemplateColumns: gridColumns, padding: "8px 0", borderBottom: `1px solid ${c.border1}` }}>
        {COLS.map(col => (
          <div key={col.key} style={{
            fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
            color: c.textTertiary, padding: "0 10px",
          }}>{col.label}</div>
        ))}
      </div>

      {grupos.map(g => {
        const doGrupo = itens.filter(i => (i.categoria || "GERAL") === g);
        const ativos = doGrupo.some(i => i.status !== "pendente" && !!STATUS_ITEM_LABEL[i.status]);
        const qs = doGrupo.map(qtdContratada);
        const total = qs.reduce((s, x) => s + x.qtd, 0);
        const unidadeTotal = qs.every(x => (x.unidade || "").toLowerCase().startsWith("m"))
          ? (qs[0]?.unidade || "m²") : "";
        return (
          <div key={g}>
            <div style={{
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: ativos ? accentColor : pendColor, padding: "10px 10px",
              background: ativos
                ? (isDark ? "rgba(200,182,138,0.04)" : "#FDF8EC")
                : (isDark ? "rgba(95,93,88,0.05)" : "#F0EDEA"),
              borderBottom: `1px solid ${c.border1}`, marginTop: 4,
            }}>
              {g} · {fmtNum(total)}{unidadeTotal ? ` ${unidadeTotal}` : ` · ${doGrupo.length} itens`}
            </div>
            {doGrupo.map(it => <Row key={it.id} it={it} c={c} />)}
          </div>
        );
      })}
      </div>
    </div>
  );
}
