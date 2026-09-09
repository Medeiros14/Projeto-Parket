import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, AlertCircle, UserMinus, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useFetch, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtCPF, initials } from "@/lib/format";

export function DesligamentosPage() {
  const c = useFetch(() => api.colaboradores(), []);
  const ctr = useFetch(() => api.contratos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const [search, setSearch] = useState("");
  const [reverting, setReverting] = useState<string | null>(null);

  const empresaMap = useMemo(() => {
    const m: Record<string, string> = {};
    (empresas.data || []).forEach((e) => { m[e.id] = e.nome_fantasia || e.razao_social; });
    return m;
  }, [empresas.data]);

  // contrato desligado mais recente por colaborador
  const desligadosByColab = useMemo(() => {
    const m: Record<string, any> = {};
    (ctr.data || []).forEach((c) => {
      if (c.status === "desligado") {
        if (!m[c.colaborador_id] || (c.data_demissao || "") > (m[c.colaborador_id].data_demissao || "")) {
          m[c.colaborador_id] = c;
        }
      }
    });
    return m;
  }, [ctr.data]);

  const lista = useMemo(() => {
    const ids = Object.keys(desligadosByColab);
    let arr = (c.data || []).filter((x) => ids.includes(x.id));
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((x) =>
        (x.nome || "").toLowerCase().includes(s) ||
        (x.cpf || "").includes(s),
      );
    }
    return arr.sort((a, b) => {
      const da = desligadosByColab[a.id]?.data_demissao || "";
      const db = desligadosByColab[b.id]?.data_demissao || "";
      return db.localeCompare(da);
    });
  }, [c.data, desligadosByColab, search]);

  const reverter = async (colabId: string, contratoId: string) => {
    if (!window.confirm("Reverter desligamento? O contrato volta para ATIVO e a data de demissão será limpa.")) return;
    setReverting(colabId);
    try {
      const { error: e1 } = await supabase.from("contratos")
        .update({ status: "ativo", data_demissao: null })
        .eq("id", contratoId);
      if (e1) throw new Error(e1.message);
      await supabase.from("desligamentos").delete().eq("contrato_id", contratoId);
      ctr.reload();
    } catch (e: any) {
      alert("Erro ao reverter: " + (e?.message || e));
    } finally {
      setReverting(null);
    }
  };

  const loading = c.loading || ctr.loading || empresas.loading;
  const fmtDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Desligamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? "Carregando…" : `${lista.length} colaboradores desligados`}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      )}

      {!loading && lista.length === 0 && (
        <Card className="p-12 text-center">
          <UserMinus size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhum colaborador desligado</div>
          <div className="text-sm text-muted-foreground">
            {search ? "Tente outra busca." : "Quando algum colaborador for desligado, aparecerá aqui."}
          </div>
        </Card>
      )}

      {!loading && lista.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lista.map((x) => {
            const ctrItem = desligadosByColab[x.id];
            const empresaNm = ctrItem ? empresaMap[ctrItem.empresa_id] : "";
            return (
              <Card key={x.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                    {initials(x.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/colaboradores/${x.id}`} className="font-semibold text-sm truncate hover:underline block">
                      {x.nome}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {x.cpf ? fmtCPF(x.cpf) : "CPF —"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="destructive" className="text-[10px]">desligado</Badge>
                      <span>{fmtDate(ctrItem?.data_demissao)}</span>
                    </div>
                    {empresaNm && (
                      <div className="text-[11px] text-muted-foreground mt-1 truncate">{empresaNm}</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reverting === x.id}
                    onClick={() => reverter(x.id, ctrItem.id)}
                    className="text-xs"
                  >
                    {reverting === x.id ? <Loader2 size={11} className="animate-spin mr-1" /> : <RotateCcw size={11} className="mr-1" />}
                    Reverter
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
