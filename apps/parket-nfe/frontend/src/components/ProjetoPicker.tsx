import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, CheckCircle2 } from "lucide-react";
import type { ClienteGrupo } from "../lib/api";

/** Picker de projeto com busca por digitação.
 *  Substitui <select> nativo pra 555 projetos serem navegáveis.
 *  Filtra por nome do cliente + endereço + obra_code, case-insensitive.
 *
 *  Props:
 *    value: id do projeto selecionado (ou "")
 *    onChange: callback com novo id
 *    clientes: lista agrupada vinda de listProjetos()
 *    placeholder: opcional
 */
export function ProjetoPicker({ value, onChange, clientes, placeholder }: {
  value: string;
  onChange: (id: string) => void;
  clientes: ClienteGrupo[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Achata clientes+projetos numa lista flat pra filtrar rápido
  const flat = useMemo(() => {
    const rows: Array<{ id: string; cliente: string; endereco: string | null; obra_code: string | null; searchable: string }> = [];
    for (const c of clientes) {
      for (const p of c.projetos) {
        rows.push({
          id: p.id,
          cliente: c.cliente,
          endereco: p.endereco,
          obra_code: p.obra_code,
          searchable: `${c.cliente} ${p.endereco || ""} ${p.obra_code || ""}`.toLowerCase(),
        });
      }
    }
    return rows;
  }, [clientes]);

  const selected = flat.find((r) => r.id === value);

  // Filtra por todos os termos (AND) — permite digitar "colla porto alegre" e achar
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat.slice(0, 100);
    const terms = q.split(/\s+/);
    return flat.filter((r) => terms.every((t) => r.searchable.includes(t))).slice(0, 100);
  }, [query, flat]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Foca o input ao abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function selecionar(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger: mostra selecionado ou placeholder */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-hb-bg border border-hb-border rounded px-2 py-2 text-xs text-left flex items-center gap-2 hover:border-hb-borderHover focus:border-hb-accent outline-none"
      >
        <Search size={12} className="text-hb-textDim shrink-0" />
        {selected ? (
          <span className="flex-1 min-w-0 truncate text-hb-text">
            <span className="font-semibold">{selected.cliente}</span>
            {selected.endereco ? (
              <span className="text-hb-textDim"> · {selected.endereco.substring(0, 60)}</span>
            ) : null}
            {selected.obra_code ? <span className="text-hb-accent ml-1">[{selected.obra_code}]</span> : null}
          </span>
        ) : (
          <span className="flex-1 text-hb-textDim">{placeholder || "Buscar cliente ou endereço..."}</span>
        )}
        {selected && (
          <span onClick={limpar} className="text-hb-textDim hover:text-hb-red shrink-0" title="Limpar">
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-hb-panel border border-hb-borderHover rounded shadow-2xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-hb-border shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite pra buscar..."
              className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs text-hb-text outline-none focus:border-hb-accent"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                // Enter seleciona o primeiro resultado se houver
                if (e.key === "Enter" && filtered.length > 0) {
                  e.preventDefault();
                  selecionar(filtered[0].id);
                }
              }}
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-hb-textDim italic text-center">
                Nenhum projeto encontrado
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selecionar(r.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-hb-panelLight border-b border-hb-border/30 flex items-start gap-2 ${
                    r.id === value ? "bg-hb-accent/10" : ""
                  }`}
                >
                  {r.id === value && <CheckCircle2 size={12} className="text-hb-green shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-hb-text truncate">{r.cliente}</div>
                    {(r.endereco || r.obra_code) && (
                      <div className="text-hb-textDim truncate text-[11px] mt-0.5">
                        {r.endereco || ""}
                        {r.obra_code ? <span className="text-hb-accent ml-1">[{r.obra_code}]</span> : null}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          {query && (
            <div className="px-3 py-1.5 text-[10px] text-hb-textMuted border-t border-hb-border shrink-0">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}{filtered.length === 100 ? " (mostrando 100 primeiros — refine a busca)" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
