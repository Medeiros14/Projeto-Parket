import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useFetch, api } from "@/lib/api";
import { fmtCPF, fmtTel, initials } from "@/lib/format";

export function ColaboradoresPage() {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("");
  const [ufFilter, setUfFilter] = useState<string>("");
  const [params] = useSearchParams();
  const filter = params.get("filter");
  const c = useFetch(() => api.colaboradores(), []);
  const ctr = useFetch(() => api.contratos(), []);
  const empresas = useFetch(() => api.empresas(), []);

  const empresaMap = useMemo(() => {
    const m: Record<string, string> = {};
    (empresas.data || []).forEach((e) => {
      m[e.id] = e.nome_fantasia || e.razao_social;
    });
    return m;
  }, [empresas.data]);

  // colab_id -> empresa_id (do contrato ativo, ou primeiro)
  const colabEmpresa = useMemo(() => {
    const m: Record<string, string> = {};
    (ctr.data || []).forEach((c) => {
      if (!m[c.colaborador_id] || c.status === "ativo") m[c.colaborador_id] = c.empresa_id;
    });
    return m;
  }, [ctr.data]);

  // colab_ids cujo contrato MAIS RECENTE está desligado → some da lista de ativos.
  // (continuam acessíveis em /desligamentos)
  const desligadosIds = useMemo(() => {
    const latest: Record<string, { status: string; d: string }> = {};
    (ctr.data || []).forEach((c) => {
      const d = c.data_demissao || c.data_admissao || "";
      const cur = latest[c.colaborador_id];
      if (!cur || d > cur.d) latest[c.colaborador_id] = { status: c.status, d };
    });
    const ids = new Set<string>();
    Object.entries(latest).forEach(([cid, v]) => { if (v.status === "desligado") ids.add(cid); });
    return ids;
  }, [ctr.data]);

  // Normaliza qualquer string de UF (sigla ou nome completo) pra sigla 2 letras
  const UF_BY_NAME: Record<string, string> = {
    "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM", "BAHIA": "BA",
    "CEARA": "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", "GOIAS": "GO",
    "MARANHAO": "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG",
    "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR", "PERNAMBUCO": "PE", "PIAUI": "PI",
    "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS",
    "RONDONIA": "RO", "RORAIMA": "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP",
    "SERGIPE": "SE", "TOCANTINS": "TO",
  };
  const normalizeUf = (raw: string | null | undefined): string => {
    if (!raw) return "";
    const s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (s.length === 2) return s;
    return UF_BY_NAME[s] || "";
  };

  const lista = useMemo(() => {
    let arr = (c.data || []).filter((x) => !desligadosIds.has(x.id));
    if (filter === "incompletos") arr = arr.filter((x) => x.status_dados === "incompleto");
    if (empresaFilter) arr = arr.filter((x) => colabEmpresa[x.id] === empresaFilter);
    if (ufFilter) arr = arr.filter((x) => normalizeUf(x.endereco_uf) === ufFilter);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((x) =>
        (x.nome || "").toLowerCase().includes(s) ||
        (x.cpf || "").includes(s) ||
        (x.email_pessoal || "").toLowerCase().includes(s) ||
        (x.email_profissional || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [c.data, filter, search, empresaFilter, ufFilter, colabEmpresa, desligadosIds]);

  // Contagem por empresa pra mostrar nos botões de filtro
  const countByEmpresa = useMemo(() => {
    const m: Record<string, number> = {};
    (c.data || []).forEach((x) => {
      const eid = colabEmpresa[x.id];
      if (eid) m[eid] = (m[eid] || 0) + 1;
    });
    return m;
  }, [c.data, colabEmpresa]);

  // UFs encontrados nos colaboradores + contagem (ordenado: mais frequentes primeiro)
  const ufList = useMemo(() => {
    const m: Record<string, number> = {};
    (c.data || []).forEach((x) => {
      const uf = normalizeUf(x.endereco_uf);
      if (uf) m[uf] = (m[uf] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [c.data]);
  const semUf = useMemo(
    () => (c.data || []).filter((x) => !normalizeUf(x.endereco_uf)).length,
    [c.data],
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {c.data ? `${c.data.length} pessoas cadastradas` : "Carregando…"}
            {filter === "incompletos" && (
              <Badge variant="warning" className="ml-2">filtro: cadastro incompleto</Badge>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          onClick={() => setEmpresaFilter("")}
          className={`text-xs px-3 py-1.5 rounded border transition ${
            !empresaFilter
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-secondary"
          }`}
        >
          Todas ({c.data?.length || 0})
        </button>
        {(empresas.data || []).map((e) => (
          <button
            key={e.id}
            onClick={() => setEmpresaFilter(e.id)}
            className={`text-xs px-3 py-1.5 rounded border transition ${
              empresaFilter === e.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary"
            }`}
          >
            {e.nome_fantasia || e.razao_social} ({countByEmpresa[e.id] || 0})
          </button>
        ))}
      </div>

      {ufList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Estado:</span>
          <button
            onClick={() => setUfFilter("")}
            className={`text-xs px-3 py-1.5 rounded border transition ${
              !ufFilter
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary"
            }`}
          >
            Todos ({c.data?.length || 0})
          </button>
          {ufList.map(([uf, n]) => (
            <button
              key={uf}
              onClick={() => setUfFilter(uf)}
              className={`text-xs px-3 py-1.5 rounded border transition ${
                ufFilter === uf
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {uf} ({n})
            </button>
          ))}
          {semUf > 0 && (
            <span className="text-[11px] text-muted-foreground">· {semUf} sem UF</span>
          )}
        </div>
      )}

      {(c.loading || ctr.loading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando colaboradores…
        </div>
      )}
      {c.error && <Card className="p-4 text-sm text-red-400">Erro: {c.error}</Card>}

      {!c.loading && !ctr.loading && lista.length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhum colaborador encontrado</div>
          <div className="text-sm text-muted-foreground">
            {search || empresaFilter || ufFilter ? "Tente outra busca ou filtro." : "Use o módulo de Admissões pra cadastrar a primeira pessoa."}
          </div>
        </Card>
      )}

      {lista.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lista.map((x) => {
            const eid = colabEmpresa[x.id];
            return (
              <Link key={x.id} to={`/colaboradores/${x.id}`}>
                <Card className="p-4 hover:bg-secondary/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                      {initials(x.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{x.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {x.email_profissional || x.email_pessoal || "sem email"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {x.cpf ? fmtCPF(x.cpf) : <span className="text-amber-400">CPF pendente</span>}
                        {x.celular && <> · {fmtTel(x.celular)}</>}
                      </div>
                      {eid && (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {empresaMap[eid] || "—"}
                        </Badge>
                      )}
                    </div>
                    <StatusBadge s={x.status_dados} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  if (s === "completo") return <Badge variant="success">OK</Badge>;
  if (s === "pendente_validacao") return <Badge variant="warning">Validar</Badge>;
  return <Badge variant="warning">Incompleto</Badge>;
}
