/** Dados e Excel — exports CSV, auditoria e backup/restauração JSON. */
import { useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { FileSpreadsheet, FileClock, Download, Upload, AlertTriangle } from "lucide-react";
import { sb } from "../lib/supabase";
import { tbl } from "../lib/filial";
import { exportCSV } from "../lib/suprimentos";
import Dialogo from "../components/Dialogo";

// Nomes internos do backup (fixos, sem sufixo de filial) - mapeados na hora do IO.
const NOMES = ["funcionarios", "itens", "termos", "movimentacoes"] as const;
type Nome = typeof NOMES[number];

export default function Dados() {
  const { t } = useTheme();
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [restaurando, setRestaurando] = useState<{ backup: any; resumo: string } | null>(null);

  const statusLabel: Record<string, string> = {
    estoque: "Estoque", uso: "Em uso", manutencao: "Manutenção", baixado: "Baixado",
  };

  async function exportInventario() {
    setMsg("Gerando inventário…");
    const [{ data: itens }, { data: funcs }] = await Promise.all([
      sb.from(tbl("itens")).select("*").order("descricao"),
      sb.from(tbl("funcionarios")).select("*"),
    ]);
    const nomes = Object.fromEntries(((funcs as any[]) || []).map((f) => [f.id, f.nome]));
    exportCSV(
      `inventario_suprimentos_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Descrição", "Marca", "Nº de série", "Valor estimado", "Novo", "Status", "Funcionário", "Termo", "Motivo manutenção", "Motivo baixa"],
      ((itens as any[]) || []).map((i) => [
        i.descricao, i.marca || "", i.serie || "", String(i.valor ?? 0).replace(".", ","),
        i.novo ? "SIM" : "", statusLabel[i.status] || i.status, i.funcionario_id ? nomes[i.funcionario_id] || "" : "",
        i.termo || "", i.manut_motivo || "", i.baixa_motivo || "",
      ])
    );
    setMsg("Inventário exportado.");
  }

  async function exportMovimentacoes() {
    setMsg("Gerando auditoria…");
    const { data } = await sb.from(tbl("movimentacoes")).select("*").order("data", { ascending: false }).order("id");
    exportCSV(
      `auditoria_suprimentos_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Tipo", "Item", "Nº de série", "Funcionário", "Termo", "Detalhes", "Usuário"],
      ((data as any[]) || []).map((m) => [
        new Date(m.data).toLocaleString("pt-BR"), m.tipo, m.item_descricao || "", m.item_serie || "",
        m.funcionario_nome || "", m.termo || "", m.detalhes ? JSON.stringify(m.detalhes) : "", m.usuario || "",
      ])
    );
    setMsg("Auditoria exportada.");
  }

  async function baixarBackup() {
    setMsg("Montando backup…");
    const [itens, funcs, movs, termos] = await Promise.all([
      sb.from(tbl("itens")).select("*"),
      sb.from(tbl("funcionarios")).select("*"),
      sb.from(tbl("movimentacoes")).select("*"),
      sb.from(tbl("termos")).select("*"),
    ]);
    // Backup usa chaves neutras ("itens"/"funcionarios"/etc) pra ser portável entre filiais.
    const backup = {
      gerado_em: new Date().toISOString(),
      itens: itens.data || [],
      funcionarios: funcs.data || [],
      movimentacoes: movs.data || [],
      termos: termos.data || [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup_suprimentos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Backup baixado.");
  }

  async function abrirRestauracao(f: File) {
    try {
      const backup = JSON.parse(await f.text());
      // Aceita backups antigos (chaves suprimentos_*) e novos (chaves neutras).
      const resumo = NOMES.map((n) => {
        const rows = backup[n] || backup[`suprimentos_${n}`] || [];
        return `${rows.length} ${n}`;
      }).join(", ");
      setRestaurando({ backup, resumo });
    } catch (e: any) {
      setMsg("Falha ao ler o arquivo: " + (e?.message || e));
    }
  }

  async function restaurarBackup(backup: any) {
    setMsg("Restaurando…");
    try {
      for (const n of NOMES) {
        const rows = backup[n] || backup[`suprimentos_${n}`] || [];
        const alvo = tbl(n as Nome);
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await sb.from(alvo).upsert(rows.slice(i, i + 500));
          if (error) throw new Error(`${alvo}: ${error.message}`);
        }
      }
      setMsg("Backup restaurado com sucesso.");
    } catch (e: any) {
      setMsg("Falha na restauração: " + (e?.message || e));
    }
  }

  const card: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: 20 };
  const btn = (cor: string, texto: string): React.CSSProperties => ({
    background: "transparent", border: `1px solid ${cor}`, color: texto,
    padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 10,
  });

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Dados e Excel</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>Relatórios pra análise no Excel + backup completo</div>
      </header>

      {msg && <div style={{ fontSize: 12, color: t.info }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: t.textPrimary }}>Exportar relatórios</h2>
          <p style={{ fontSize: 11.5, color: t.textMuted, margin: "0 0 14px" }}>
            Planilhas CSV com a posição atual e o histórico de auditoria.
          </p>
          <button onClick={exportInventario} style={btn(t.borderStrong, t.textPrimary)}>
            <FileSpreadsheet size={14} /> Inventário atual (com valores e séries) — .CSV
          </button>
          <button onClick={exportMovimentacoes} style={btn(t.borderStrong, t.textPrimary)}>
            <FileClock size={14} /> Auditoria de movimentações (log) — .CSV
          </button>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: t.textPrimary }}>Backup / Restauração</h2>
          <p style={{ fontSize: 11.5, color: t.textMuted, margin: "0 0 14px" }}>
            A base vive no banco Parket. Use o backup pra cópia extra ou migração.
          </p>
          <button onClick={baixarBackup} style={btn(t.info, t.info)}>
            <Download size={14} /> Baixar backup completo — .JSON
          </button>
          <button onClick={() => fileRef.current?.click()} style={btn(t.borderStrong, t.textPrimary)}>
            <Upload size={14} /> Restaurar a partir de backup — .JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) abrirRestauracao(f); e.target.value = ""; }} />
          <p style={{ fontSize: 10.5, color: t.textMuted, display: "flex", gap: 6, alignItems: "center", margin: "6px 0 0" }}>
            <AlertTriangle size={11} /> A restauração sobrescreve registros com o mesmo ID.
          </p>
        </div>
      </div>

      {restaurando && (
        <Dialogo titulo="Restaurar backup" cor={t.info} confirmLabel="Restaurar"
                 mensagem={`Restaurar backup de ${restaurando.backup.gerado_em || "?"} (${restaurando.resumo})? Registros com mesmo ID serão sobrescritos.`}
                 onConfirm={() => restaurarBackup(restaurando.backup)}
                 onClose={() => setRestaurando(null)} />
      )}
    </div>
  );
}
