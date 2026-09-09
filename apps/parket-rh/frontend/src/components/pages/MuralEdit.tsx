/**
 * MuralEdit — RH edita conteúdo do mural (HTML), liga/desliga, vê lista
 * de quem assinou. Disparo WhatsApp via Agente RH virá depois.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Save, Eye, ExternalLink, Trash2, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtCPF } from "@/lib/format";

type Mural = {
  id: string; slug: string; titulo: string; conteudo_html: string;
  ativo: boolean; exige_assinatura: boolean;
};

type Acesso = {
  id: string; nome_informado: string | null; cpf_informado: string | null;
  status: string; assinado_em: string | null; created_at: string; token: string | null;
};

export function MuralEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const [mural, setMural] = useState<Mural | null>(null);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [tab, setTab] = useState<"conteudo" | "acessos" | "status">("conteudo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form local
  const [titulo, setTitulo] = useState("");
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [ativo, setAtivo] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data: m } = await supabase.from("murais").select("*").eq("slug", slug!).maybeSingle();
    if (m) {
      setMural(m as Mural);
      setTitulo(m.titulo);
      setConteudoHtml(m.conteudo_html);
      setAtivo(m.ativo);
      const { data: a } = await supabase.from("documentos_emitidos")
        .select("id, nome_informado, cpf_informado, status, assinado_em, created_at, token")
        .eq("mural_id", m.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setAcessos((a || []) as Acesso[]);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [slug]);

  const save = async () => {
    if (!mural) return;
    setSaving(true); setErr(null);
    const { error } = await supabase.from("murais").update({
      titulo, conteudo_html: conteudoHtml, ativo, updated_at: new Date().toISOString(),
    }).eq("id", mural.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    reload();
  };

  const stats = useMemo(() => {
    const assinados = acessos.filter((a) => a.status === "assinado").length;
    return { total: acessos.length, assinados, pendentes: acessos.length - assinados };
  }, [acessos]);

  if (loading) {
    return <div className="flex items-center gap-2 p-12 justify-center text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" /> Carregando…
    </div>;
  }
  if (!mural) {
    return <div className="p-8 text-sm text-muted-foreground">Mural não encontrado.</div>;
  }

  const link = `${window.location.origin}/mural/${mural.slug}`;

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/murais" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Voltar pra Murais
        </Link>
        <div className="flex items-center gap-2">
          <a href={link} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink size={12} /> {link}
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{mural.slug}</div>
          <h1 className="text-2xl font-bold">{titulo || mural.titulo}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{stats.assinados} assinados</span>
          <span className="text-amber-400">{stats.pendentes} pendentes</span>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("conteudo")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "conteudo" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Conteúdo
        </button>
        <button onClick={() => setTab("acessos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "acessos" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Acessos ({stats.total})
        </button>
        <button onClick={() => setTab("status")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "status" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Status dos enviados
        </button>
      </div>

      {tab === "status" && mural && <StatusEnviados slug={mural.slug} />}

      {tab === "conteudo" && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Título exibido pro colaborador</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center justify-between">
                <span>Conteúdo (HTML)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Suporta tags HTML: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt;, etc.
                </span>
              </label>
              <textarea value={conteudoHtml} onChange={(e) => setConteudoHtml(e.target.value)}
                rows={28} spellCheck={false}
                className="w-full bg-input border border-border rounded-md text-[11px] p-3 outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <span>Ativo (link público acessível)</span>
              </label>
              {err && <div className="text-xs text-red-400">{err}</div>}
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Salvar
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-white text-black overflow-y-auto" style={{ maxHeight: "75vh" }}>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1">
              <Eye size={12} /> Preview
            </div>
            <h2 className="text-xl font-bold mb-3">{titulo}</h2>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: conteudoHtml }} />
          </Card>
        </div>
      )}

      {tab === "acessos" && (
        <div className="space-y-2">
          {acessos.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Ninguém acessou o mural ainda.
            </Card>
          ) : acessos.map((a) => (
            <Card key={a.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">{a.nome_informado || "—"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {a.cpf_informado && `CPF ${fmtCPF(a.cpf_informado)} · `}
                  Acessou em {fmtDate(a.created_at)}
                  {a.assinado_em && <span className="text-emerald-400"> · Assinou em {fmtDate(a.assinado_em)}</span>}
                </div>
              </div>
              {a.status === "assinado" ? (
                <Badge variant="success" className="text-[10px]"><CheckCircle2 size={10} className="mr-1" /> Assinado</Badge>
              ) : (
                <Badge variant="warning" className="text-[10px]"><Clock size={10} className="mr-1" /> Pendente</Badge>
              )}
              <DeleteAcessoBtn id={a.id} onDeleted={reload} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteAcessoBtn({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button onClick={async () => {
      if (!confirm("Remover esse registro?")) return;
      setBusy(true);
      const { error } = await supabase.from("documentos_emitidos").delete().eq("id", id);
      setBusy(false);
      if (error) { alert(error.message); return; }
      onDeleted();
    }} className="text-muted-foreground hover:text-red-400 transition" disabled={busy}>
      <Trash2 size={14} />
    </button>
  );
}


// ────────────────────────────────────────────────────────────────────
// StatusEnviados — quem recebeu o link via WhatsApp e: não abriu /
// abriu sem assinar / assinou.
// ────────────────────────────────────────────────────────────────────

interface StatusItem {
  colaborador_id: string;
  nome: string | null;
  celular: string | null;
  sent_at: string;
  opened_at: string | null;
  signed_at: string | null;
}

interface StatusResponse {
  total_enviados: number;
  nao_abriram: StatusItem[];
  abriram_nao_assinaram: StatusItem[];
  assinaram: StatusItem[];
}

function StatusEnviados({ slug }: { slug: string }) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`https://agente.parket.works/api/rh-whatsapp/mural-status/${slug}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">
        ⚠ {error}
      </div>
    );
  }
  if (!data || data.total_enviados === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="font-semibold mb-1">Nenhum envio registrado</div>
        <div className="text-sm text-muted-foreground">Use o botão "Em massa" no modelo "Mural RH" pra disparar.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total enviados</div>
          <div className="text-2xl font-bold mt-1">{data.total_enviados}</div>
        </Card>
        <Card className="p-3 border-red-500/40">
          <div className="text-[10px] text-red-400 uppercase tracking-wider">Não abriram</div>
          <div className="text-2xl font-bold mt-1 text-red-400">{data.nao_abriram.length}</div>
        </Card>
        <Card className="p-3 border-yellow-500/40">
          <div className="text-[10px] text-yellow-400 uppercase tracking-wider">Abriram, não assinaram</div>
          <div className="text-2xl font-bold mt-1 text-yellow-400">{data.abriram_nao_assinaram.length}</div>
        </Card>
        <Card className="p-3 border-green-500/40">
          <div className="text-[10px] text-green-400 uppercase tracking-wider">Assinaram</div>
          <div className="text-2xl font-bold mt-1 text-green-400">{data.assinaram.length}</div>
        </Card>
      </div>

      {/* Não abriram (foco do user) */}
      {data.nao_abriram.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs font-semibold text-red-400 uppercase tracking-wider">
            ❌ Não abriram ainda ({data.nao_abriram.length})
          </div>
          <StatusTable items={data.nao_abriram} colCelular />
        </Card>
      )}

      {data.abriram_nao_assinaram.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-xs font-semibold text-yellow-400 uppercase tracking-wider">
            ⏳ Abriram mas ainda não assinaram ({data.abriram_nao_assinaram.length})
          </div>
          <StatusTable items={data.abriram_nao_assinaram} colOpened />
        </Card>
      )}

      {data.assinaram.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 bg-green-500/10 border-b border-green-500/30 text-xs font-semibold text-green-400 uppercase tracking-wider">
            ✓ Assinaram ({data.assinaram.length})
          </div>
          <StatusTable items={data.assinaram} colSigned />
        </Card>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground transition">↻ Atualizar</button>
      </div>
    </div>
  );
}

function StatusTable({ items, colCelular, colOpened, colSigned }: {
  items: StatusItem[];
  colCelular?: boolean;
  colOpened?: boolean;
  colSigned?: boolean;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-secondary/30 text-muted-foreground">
        <tr>
          <th className="text-left px-3 py-2 font-semibold">Colaborador</th>
          <th className="text-left px-3 py-2 font-semibold">Enviado</th>
          {colCelular && <th className="text-left px-3 py-2 font-semibold">Celular</th>}
          {colOpened && <th className="text-left px-3 py-2 font-semibold">Abriu em</th>}
          {colSigned && <th className="text-left px-3 py-2 font-semibold">Assinou em</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.colaborador_id} className="border-t border-border">
            <td className="px-3 py-2">
              <Link to={`/colaboradores/${it.colaborador_id}`} className="hover:text-foreground underline">
                {it.nome || it.colaborador_id.slice(0, 8)}
              </Link>
            </td>
            <td className="px-3 py-2 text-muted-foreground">{new Date(it.sent_at).toLocaleString("pt-BR")}</td>
            {colCelular && <td className="px-3 py-2 text-muted-foreground">{it.celular || "—"}</td>}
            {colOpened && it.opened_at && <td className="px-3 py-2 text-muted-foreground">{new Date(it.opened_at).toLocaleString("pt-BR")}</td>}
            {colSigned && it.signed_at && <td className="px-3 py-2 text-muted-foreground">{new Date(it.signed_at).toLocaleString("pt-BR")}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
