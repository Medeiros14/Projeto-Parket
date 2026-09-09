/**
 * Ticker — barra rolante no topo do home broker estilo XP/B3.
 * Cada item mostra: símbolo + valor + variação (alta/baixa).
 */
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmtIntCompact, fmtBRLCompact } from "../lib/format";

export type TickerItem = {
  symbol: string;     // ex: "LEADS", "QUAL", "GANHO", "TKT"
  label?: string;     // tooltip / nome longo
  value: number;
  format?: "int" | "money" | "pct";
  delta?: number;     // variação vs período anterior
  deltaPct?: number;
  color?: "green" | "red" | "gold" | "amber" | "blue"; // destaque visual
};

function fmtVal(v: number, fmt: TickerItem["format"]) {
  if (fmt === "money") return fmtBRLCompact(v);
  if (fmt === "pct") return v.toFixed(1) + "%";
  return fmtIntCompact(v);
}

export function Ticker({ items, prefix }: { items: TickerItem[]; prefix?: string }) {
  // duplica os itens pra animação infinita sem corte
  const loop = [...items, ...items];
  return (
    <div className="h-9 bg-hb-panel border-b border-hb-border overflow-hidden relative flex items-stretch">
      {/* Prefixo fixo (não rola) — tipo "Últimas 24hs" */}
      {prefix && (
        <div className="shrink-0 bg-hb-gold/15 border-r border-hb-gold/30 px-4 flex items-center gap-1.5 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-hb-gold animate-blink" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-hb-gold">{prefix}</span>
        </div>
      )}
      {/* Items rolando */}
      <div className="relative flex-1 overflow-hidden">
        <div className="flex items-center gap-8 animate-ticker whitespace-nowrap absolute left-0 top-0 h-full px-4">
          {loop.map((it, i) => {
            const up = (it.delta ?? 0) > 0;
            const down = (it.delta ?? 0) < 0;
            const deltaColor = up ? "text-hb-green" : down ? "text-hb-red" : "text-hb-textDim";
            const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
            // Cor de destaque do item (override do dourado padrão)
            const symbolColor = it.color === "green" ? "text-hb-green"
              : it.color === "red"   ? "text-hb-red"
              : it.color === "amber" ? "text-hb-amber"
              : it.color === "blue"  ? "text-hb-blue"
              : "text-hb-gold";
            const valueColor = it.color === "green" ? "text-hb-green"
              : it.color === "red"   ? "text-hb-red"
              : "text-hb-text";
            return (
              <div key={i} className="flex items-center gap-2 text-xs tabular" title={it.label || it.symbol}>
                <span className={`font-bold tracking-wide ${symbolColor}`}>{it.symbol}</span>
                <span className={`font-semibold ${valueColor}`}>{fmtVal(it.value, it.format)}</span>
                {(it.delta != null) && (
                  <span className={`flex items-center gap-0.5 font-medium ${deltaColor}`}>
                    <Icon size={10} />
                    {it.deltaPct != null
                      ? (it.deltaPct > 0 ? "+" : "") + it.deltaPct.toFixed(1) + "%"
                      : (it.delta > 0 ? "+" : "") + fmtIntCompact(Math.abs(it.delta))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
