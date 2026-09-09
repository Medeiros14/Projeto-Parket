/** Controle da Prensa (producao_prensa) — mesma tabela do PCP legado. */
import SetorTabela, { ColDef } from "../components/SetorTabela";
import { fetchPrensa } from "../lib/producao";

const COLS: ColDef[] = [
  { key: "inicio", label: "Início", tipo: "date" },
  { key: "entrega", label: "Entrega", tipo: "date" },
  { key: "cliente", label: "Cliente" },
  { key: "uf", label: "UF" },
  { key: "item", label: "Item" },
  { key: "lamina_natural", label: "Lâmina Natural" },
  { key: "status", label: "Status", tipo: "select", opcoes: ["EM ANDAMENTO", "PARALISADO", "FINALIZADO"] },
  { key: "observacao", label: "Observação", tipo: "textarea" },
];

export default function Prensa() {
  return (
    <SetorTabela
      titulo="Prensa"
      subtitulo="Controle de prensagem de lâminas"
      tabela="producao_prensa"
      cols={COLS}
      fetch={fetchPrensa}
    />
  );
}
