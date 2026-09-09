import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { api, useFetch } from "../lib/api";
import { useSelectedEmpresa } from "../lib/store";

export function EmpresaSelector() {
  const [empresaId, setEmpresaId] = useSelectedEmpresa();
  const { data: empresas } = useFetch(() => api.empresas(), []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = empresas?.find((e) => e.id === empresaId) || null;
  const dotColor = current?.cor || "#B8AA9A";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-parket-panel border border-parket-border hover:bg-parket-panelLight transition text-[11px]"
      >
        <span
          className="w-2.5 h-2.5 rounded-full inline-block"
          style={{ backgroundColor: dotColor }}
        />
        <Building2 size={13} className="text-parket-textDim" />
        <span className="font-semibold truncate max-w-[180px]">
          {current ? (current.nome_fantasia || current.razao_social) : "Todas as empresas"}
        </span>
        <ChevronDown size={12} className="text-parket-textDim" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-72 bg-parket-panel border border-parket-border rounded-lg shadow-2xl z-50 overflow-hidden">
          <button
            onClick={() => { setEmpresaId(null); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-parket-panelLight border-b border-parket-border/50"
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-parket-accent" />
            <span className="flex-1 text-left font-semibold">Todas as empresas</span>
            {empresaId == null && <Check size={12} className="text-parket-accent" />}
          </button>
          {empresas?.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEmpresaId(e.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-parket-panelLight"
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: e.cor }} />
              <span className="flex-1 text-left">
                <div className="font-semibold truncate">{e.nome_fantasia || e.razao_social}</div>
                <div className="text-[9px] text-parket-textDim">{e.cnpj}</div>
              </span>
              {empresaId === e.id && <Check size={12} className="text-parket-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
