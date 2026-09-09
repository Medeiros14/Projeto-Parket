/**
 * CondominioInput — input com autocomplete dos condomínios já cadastrados.
 *
 * Usa `<datalist>` nativo do browser pra mostrar a lista enquanto digita.
 * Se o user digitar um condomínio que não existe, salva normalmente —
 * `api.condominiosListAdd()` injeta no cache pra aparecer já no próximo open.
 *
 * Salva:
 *  - onBlur (clica fora)
 *  - Enter (precione Enter sem precisar tirar o focus)
 *
 * Mostra feedback "✓ salvo" temporário (1.5s) depois de cada save.
 *
 * Reutilizado em: NovoLeadModal, SolicitarOrcamentoModal, CardDetail (EditField),
 * e qualquer outro lugar que peça condomínio.
 */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { api } from "../lib/api";

let LIST_PROMISE: Promise<string[]> | null = null;

export function CondominioInput({
  value, onChange, onBlur, placeholder, className, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [opts, setOpts] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const lastSavedValueRef = useRef(value);

  useEffect(() => {
    if (!LIST_PROMISE) LIST_PROMISE = api.condominiosList();
    let alive = true;
    LIST_PROMISE.then((list) => { if (alive) setOpts(list); });
    return () => { alive = false; };
  }, []);

  // Se value externo mudou (parent atualizou após save), considera como "salvo"
  useEffect(() => {
    if (value !== lastSavedValueRef.current) {
      lastSavedValueRef.current = value;
      // Pisca o feedback "salvo" por 1.5s
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1500);
      // Se for um valor novo, adiciona no cache pra próximo open
      if (value && value.trim().length > 1) {
        api.condominiosListAdd(value.trim());
        // Re-puxa a lista local pra refletir nas opções
        api.condominiosList().then(setOpts).catch(() => {});
      }
      return () => clearTimeout(t);
    }
  }, [value]);

  // ID único pra associar input ↔ datalist (várias instâncias na mesma página)
  const listId = "condo-list-global";

  const commitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onBlur?.();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={commitOnEnter}
        placeholder={placeholder || "Digite e Enter — sugere existentes"}
        list={listId}
        autoFocus={autoFocus}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {opts.map((c) => <option key={c} value={c} />)}
      </datalist>
      {saved && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[9px] text-hb-green pointer-events-none animate-pulse">
          <Check size={10} /> salvo
        </span>
      )}
    </div>
  );
}
