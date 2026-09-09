import { useMemo, useState } from "react";
import { Loader2, UserCog, ExternalLink, Pencil, Calendar, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api, useFetch, type Funcionario, type PlanoConta } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button, Input, Select } from "../ui/Form";
import { Modal } from "../ui/Modal";
import { FuncionarioForm } from "../forms/FuncionarioForm";
import { toast } from "../../lib/toast";

const VINCULO_COLORS: Record<string, { fg: string; bg: string }> = {
  CLT: { fg: "#34D399", bg: "#022C22" },
  PJ: { fg: "#60A5FA", bg: "#1E3A8A" },
  MEI: { fg: "#A78BFA", bg: "#2E1065" },
  estagio: { fg: "#FCD34D", bg: "#422006" },
  freelance: { fg: "#FBBF24", bg: "#78350F" },
  socio: { fg: "#F87171", bg: "#3F1D1D" },
};

export function FuncionariosPage() {
  const [empresaId] = useSelectedEmpresa();
  const fn = useFetch(() => api.funcionarios(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const planos = useFetch(() => api.planoContas(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroVinculo, setFiltroVinculo] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [folhaOpen, setFolhaOpen] = useState(false);
  // Ordenação clicável das colunas (estilo Windows/Mac Finder)
  type SortKey = "nome" | "vinculo" | "cargo" | "empresa" | "salario" | "total" | "status";
  const [sortBy, setSortBy] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Defaults inteligentes: números/status começam desc (maior primeiro),
      // textos começam asc (A→Z).
      setSortDir(key === "salario" || key === "total" || key === "status" ? "desc" : "asc");
    }
  };

  const lista = useMemo(() => {
    if (!fn.data) return null;
    const q = busca.trim().toLowerCase();
    const filtered = fn.data
      // Filtro global da topbar (selected empresa) tem precedência se setado
      .filter((f) => empresaId == null || f.empresa_id === empresaId)
      // Filtro local da página (dropdown abaixo)
      .filter((f) => filtroEmpresa === "todas" || f.empresa_id === filtroEmpresa)
      .filter((f) => filtroVinculo === "todos" || f.vinculo === filtroVinculo)
      .filter((f) => !q || f.nome.toLowerCase().includes(q) || (f.cargo || "").toLowerCase().includes(q));
    // Ordenação clicável (asc/desc)
    const empresaMap = new Map(empresas.data?.map((e) => [e.id, e.nome_fantasia || e.razao_social || ""]) || []);
    const valueFor = (f: Funcionario): string | number => {
      switch (sortBy) {
        case "nome": return (f.nome || "").toLowerCase();
        case "vinculo": return f.vinculo || "";
        case "cargo": return ((f.cargo || "") + " " + (f.setor || "")).toLowerCase();
        case "empresa": return (empresaMap.get(f.empresa_id) || "").toLowerCase();
        case "salario": return Number(f.salario_base || 0);
        case "total": return Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
            + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0);
        case "status": return f.ativo ? 1 : 0;
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const va = valueFor(a);
      const vb = valueFor(b);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [fn.data, empresas.data, empresaId, filtroEmpresa, busca, filtroVinculo, sortBy, sortDir]);

  // Contagem por empresa pra mostrar no dropdown ("PARKET (46)")
  const empresaCounts = useMemo(() => {
    if (!fn.data || !empresas.data) return {};
    const counts: Record<string, number> = {};
    for (const f of fn.data) {
      if (f.empresa_id) counts[f.empresa_id] = (counts[f.empresa_id] || 0) + 1;
    }
    return counts;
  }, [fn.data, empresas.data]);

  const stats = useMemo(() => {
    if (!lista) return null;
    const ativos = lista.filter((f) => f.ativo);
    const folha = ativos.reduce(
      (s, f) => s + Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
        + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0),
      0,
    );
    return { total: lista.length, ativos: ativos.length, folha };
  }, [lista]);

  if (fn.loading) return <div className="p-8 flex items-center gap-2 text-xs text-parket-textDim"><Loader2 size={14} className="animate-spin"/> Carregando…</div>;
  if (fn.error) return <div className="p-8 text-xs text-red-400">Erro: {fn.error}</div>;
  if (!lista || !stats) return null;

  const empresaNome = (id: string) => empresas.data?.find((e) => e.id === id)?.nome_fantasia
    || empresas.data?.find((e) => e.id === id)?.razao_social || "—";

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserCog size={18} className="text-parket-accent" /> Funcionários & Folha
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Cadastro de colaboradores · geração de folha mensal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFolhaOpen(true)}>
            <Calendar size={12} /> Gerar folha do mês
          </Button>
          <Button onClick={() => window.open("https://rh.parket.works/admissao", "_blank")}>
            <ExternalLink size={12} /> Admitir no RH
          </Button>
        </div>
      </div>
      <div className="mb-4 px-3 py-2 rounded bg-parket-bgDeep border border-parket-borderDim text-xs text-parket-textDim flex items-center gap-2">
        <span className="text-parket-accent">●</span>
        Dados sincronizados ao vivo com <strong className="text-parket-text">rh.parket.works</strong>.
        Salário, cargo, benefícios e dados bancários podem ser editados nos dois lados.
        Pra admitir novos funcionários, use o onboarding completo do RH.
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat label="Funcionários cadastrados" value={String(stats.total)} />
        <Stat label="Ativos" value={String(stats.ativos)} accent />
        <Stat label="Folha mensal estimada" value={fmtBRL(stats.folha)} accent />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input className="pl-7" placeholder="Buscar por nome, cargo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className="min-w-44">
          <option value="todas">Todas as empresas ({fn.data?.length || 0})</option>
          {empresas.data?.map((e) => {
            const n = empresaCounts[e.id] || 0;
            if (n === 0) return null;
            return (
              <option key={e.id} value={e.id}>
                {e.nome_fantasia || e.razao_social} ({n})
              </option>
            );
          })}
        </Select>
        {["todos", ...Object.keys(VINCULO_COLORS)].map((v) => (
          <button
            key={v}
            onClick={() => setFiltroVinculo(v)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition ${
              filtroVinculo === v
                ? "bg-parket-accent text-parket-bg"
                : "bg-parket-panel border border-parket-border text-parket-textDim hover:text-parket-text"
            }`}
          >{v}</button>
        ))}
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight">
            <tr>
              <SortTh sortKey="nome" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Nome</SortTh>
              <SortTh sortKey="vinculo" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Vínculo</SortTh>
              <SortTh sortKey="cargo" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Cargo / Setor</SortTh>
              <SortTh sortKey="empresa" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Empresa</SortTh>
              <SortTh sortKey="salario" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} className="text-right">Salário base</SortTh>
              <SortTh sortKey="total" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} className="text-right">Total mensal</SortTh>
              <SortTh sortKey="status" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Status</SortTh>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => {
              const c = VINCULO_COLORS[f.vinculo] || VINCULO_COLORS.CLT;
              const total = Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
                + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0);
              return (
                <tr
                  key={f.id}
                  onClick={() => { setEditing(f); setOpen(true); }}
                  className="border-t border-parket-border hover:bg-parket-panelLight cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium">{f.nome}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                      {f.vinculo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-parket-text/80">
                    {f.cargo || "—"}
                    {f.setor && <span className="text-parket-textDim"> · {f.setor}</span>}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{empresaNome(f.empresa_id)}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(Number(f.salario_base || 0))}</td>
                  <td className="px-3 py-2 text-right text-parket-accent font-semibold">{fmtBRL(total)}</td>
                  <td className="px-3 py-2">
                    {f.ativo ? (
                      <span className="text-[10px] text-emerald-300">● Ativo</span>
                    ) : (
                      <span className="text-[10px] text-parket-textDim">○ Desligado</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(f); setOpen(true); }} className="text-parket-textDim hover:text-parket-accent">
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-parket-textDim">Nenhum funcionário cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <FuncionarioForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => fn.reload()}
        initial={editing}
      />

      <GerarFolhaModal
        open={folhaOpen}
        onClose={() => setFolhaOpen(false)}
        funcionarios={lista.filter((f) => f.ativo)}
        planos={planos.data || []}
        onGenerated={() => { setFolhaOpen(false); toast.success("Folha lançada"); }}
      />
    </div>
  );
}

const Th = ({ children, className = "" }: { children: any; className?: string }) => (
  <th className={`text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold ${className}`}>{children}</th>
);

function SortTh<K extends string>({
  children, className = "", sortKey, sortBy, sortDir, onClick,
}: {
  children: any; className?: string;
  sortKey: K; sortBy: K; sortDir: "asc" | "desc"; onClick: (k: K) => void;
}) {
  const active = sortBy === sortKey;
  const isRight = className.includes("text-right");
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-3 py-2 text-[10px] uppercase tracking-wider font-semibold ${active ? "text-parket-accent" : "text-parket-textDim"} ${isRight ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-parket-text transition select-none ${isRight ? "flex-row-reverse" : ""}`}
        title={active ? `Ordenado ${sortDir === "asc" ? "↑ crescente" : "↓ decrescente"} — clique pra inverter` : "Clique pra ordenar"}
      >
        <span>{children}</span>
        <Icon size={10} className={active ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">{label}</div>
    <div className={`text-xl font-bold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);

function GerarFolhaModal({
  open, onClose, funcionarios, planos, onGenerated,
}: {
  open: boolean; onClose: () => void;
  funcionarios: Funcionario[]; planos: PlanoConta[];
  onGenerated: () => void;
}) {
  const today = new Date();
  const [mes, setMes] = useState<string>(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [contaSalario, setContaSalario] = useState<string>("a4000002-0000-0000-0000-000000000002"); // 4.02 Salários
  const [contaProlabore, setContaProlabore] = useState<string>("a4000003-0000-0000-0000-000000000003"); // 4.03 Pró-labore
  const [busy, setBusy] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());

  const total = funcionarios
    .filter((f) => !skip.has(f.id))
    .reduce((s, f) =>
      s + Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
      + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0),
      0);

  const submit = async () => {
    if (!mes) return toast.error("Informe o mês");
    setBusy(true);
    try {
      const [year, month] = mes.split("-").map(Number);
      const dataComp = `${mes}-01`;
      let count = 0;
      for (const f of funcionarios) {
        if (skip.has(f.id)) continue;
        const total = Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
          + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0);
        if (total <= 0) continue;
        const dia = Math.min(f.dia_pagamento || 5, 28);
        const venc = `${mes}-${String(dia).padStart(2, "0")}`;
        const pcId = f.vinculo === "socio" ? contaProlabore : contaSalario;
        await api.insert("lancamentos", {
          empresa_id: f.empresa_id,
          plano_conta_id: pcId,
          tipo: "saida",
          status: "previsto",
          descricao: `Folha ${mes} — ${f.nome}${f.cargo ? ` (${f.cargo})` : ""}`,
          data_competencia: dataComp,
          data_vencimento: venc,
          valor: total,
          forma_pagamento: f.pix ? "pix" : "transferencia",
          observacoes: `Folha gerada ${new Date().toISOString().slice(0, 10)} · funcionario_id=${f.id}`,
          parcela_atual: 1,
          parcela_total: 1,
        });
        count++;
      }
      void year; void month;
      toast.success(`${count} lançamentos criados em "Contas a pagar"`);
      onGenerated();
    } catch (e: any) {
      toast.error(`Falha: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  const planosDespesa = planos.filter((p) => p.tipo === "despesa" && p.analitica);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar folha mensal"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={busy}>Gerar {funcionarios.length - skip.size} lançamentos</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs text-amber-200">
          Cria 1 lançamento "a pagar" por funcionário ativo no mês escolhido.
          Status inicial = <strong>previsto</strong>. Você marca como pago quando efetivar.
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold block mb-1">Mês de competência</label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold block mb-1">Plano: salário (CLT/PJ/MEI)</label>
            <Select value={contaSalario} onChange={(e) => setContaSalario(e.target.value)}>
              {planosDespesa.map((p) => <option key={p.id} value={p.id}>{p.codigo} {p.nome}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold block mb-1">Plano: pró-labore (sócio)</label>
            <Select value={contaProlabore} onChange={(e) => setContaProlabore(e.target.value)}>
              {planosDespesa.map((p) => <option key={p.id} value={p.id}>{p.codigo} {p.nome}</option>)}
            </Select>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
          Funcionários incluídos ({funcionarios.length - skip.size} de {funcionarios.length})
        </div>
        <div className="border border-parket-border rounded max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-parket-panelLight sticky top-0">
              <tr>
                <Th>Incluir</Th>
                <Th>Nome</Th>
                <Th>Vínculo</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => {
                const total = Number(f.salario_base || 0) + Number(f.vale_transporte || 0)
                  + Number(f.vale_refeicao || 0) + Number(f.plano_saude || 0) + Number(f.outros_beneficios || 0);
                const incl = !skip.has(f.id);
                return (
                  <tr key={f.id} className="border-t border-parket-border">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={incl}
                        onChange={(e) => {
                          setSkip((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.delete(f.id); else n.add(f.id);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">{f.nome}</td>
                    <td className="px-3 py-1.5 text-parket-textDim">{f.vinculo}</td>
                    <td className="px-3 py-1.5 text-right">{fmtBRL(total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-parket-border bg-parket-panelLight font-semibold">
                <td colSpan={3} className="px-3 py-2">Total folha</td>
                <td className="px-3 py-2 text-right text-parket-accent">{fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}
