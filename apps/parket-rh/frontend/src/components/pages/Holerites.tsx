/**
 * Holerites — upload de lote + split por CPF + portal de consulta.
 *
 * Fluxo RH:
 *   1. Upload PDF lote (ex: 137 páginas, 1 por funcionário)
 *   2. Backend extrai CPF de cada página, busca contrato, separa
 *   3. Cada colaborador acessa /colaboradores/:id → aba Holerites
 *
 * Páginas que não foram identificadas ficam no log do lote pro RH revisar.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Receipt, Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Calendar, Eye, Download, ChevronRight, RefreshCw, Building,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useFetch, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";

type Lote = {
  id: string;
  competencia_id: string | null;
  storage_path: string;
  total_paginas: number;
  total_distribuidos: number;
  total_falha: number;
  status: string;
  created_at: string;
  log_processamento?: any;
  competencia?: { competencia: string; tipo: string };
};

export function HoleritesPage() {
  const [tab, setTab] = useState<"upload" | "lotes">("upload");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/holerites/lotes");
      const j = await r.json();
      const items = j.items || [];
      // Resolve competencias
      const compIds = Array.from(new Set(items.map((l: any) => l.competencia_id).filter(Boolean)));
      if (compIds.length > 0) {
        const { data: comps } = await supabase.from("competencias")
          .select("id, competencia, tipo").in("id", compIds);
        const cmap = new Map((comps || []).map((c: any) => [c.id, c]));
        items.forEach((l: any) => l.competencia = cmap.get(l.competencia_id));
      }
      setLotes(items);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt size={22} /> Holerites
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faça upload de PDFs em lote — sistema separa por CPF e distribui pra cada colaborador automaticamente.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { key: "upload", label: "Novo upload", icon: Upload },
          { key: "lotes", label: `Lotes processados (${lotes.length})`, icon: FileText },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "upload" && <UploadTab onDone={reload} />}
      {tab === "lotes" && <LotesTab lotes={lotes} loading={loading} onReload={reload} />}
    </div>
  );
}

function UploadTab({ onDone }: { onDone: () => void }) {
  const empresas = useFetch(() => api.empresas(), []);
  const [file, setFile] = useState<File | null>(null);
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tipo, setTipo] = useState<string>("mensal");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) { setErr("Selecione um PDF"); return; }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { setErr("Competência inválida (use AAAA-MM)"); return; }
    setUploading(true); setErr(null); setResult(null);
    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("competencia", competencia);
    fd.append("tipo", tipo);
    if (empresaId) fd.append("empresa_id", empresaId);
    if (titulo) fd.append("titulo", titulo);
    try {
      const r = await fetch("/api/holerites/upload-lote", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.detail || `HTTP ${r.status}`); }
      else { setResult(j); onDone(); }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setUploading(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Upload size={16} /> Upload de holerites em lote
        </h2>
        <div className="text-xs text-muted-foreground">
          Suba 1 PDF com várias páginas — sistema separa cada página por CPF e gera 1 holerite por colaborador.
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium mb-1 block">Competência *</label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <div className="text-[10px] text-muted-foreground mt-1">Formato: AAAA-MM (ex: 2026-05)</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                <option value="mensal">Mensal</option>
                <option value="13o_1">13º (1ª parcela)</option>
                <option value="13o_2">13º (2ª parcela)</option>
                <option value="ferias">Férias</option>
                <option value="rescisao">Rescisão</option>
                <option value="ppr">PPR</option>
                <option value="adiantamento">Adiantamento</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Empresa (opcional)</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
                className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                <option value="">Todas</option>
                {(empresas.data || []).map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Título do lote (opcional)</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Folha mai/26 — todos" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">PDF (até 50MB)</label>
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs bg-input border border-border rounded-md p-2" />
            {file && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>

          {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 border border-red-500/40 rounded">{err}</div>}

          <Button onClick={submit} disabled={!file || uploading} className="w-full">
            {uploading && <Loader2 size={12} className="animate-spin" />}
            <Upload size={12} /> {uploading ? "Processando…" : "Enviar e distribuir"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          {result ? <CheckCircle2 size={16} className="text-emerald-400" /> : <FileText size={16} />} Resultado
        </h2>
        {!result && (
          <div className="text-xs text-muted-foreground p-6 text-center">
            O resumo aparece aqui após o upload.
          </div>
        )}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Box label="Páginas" valor={result.total_paginas} />
              <Box label="Distribuídos" valor={result.distribuidos} color="text-emerald-400" />
              <Box label="Falhas" valor={result.falhas} color="text-amber-400" />
            </div>
            {(result.sucessos || []).length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">✓ Distribuídos</div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto text-xs">
                  {result.sucessos.map((s: any, i: number) => (
                    <div key={i} className="px-2 py-1 bg-emerald-500/10 rounded">
                      pág {s.pagina}: <span className="font-semibold">{s.nome}</span> ({s.cpf})
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(result.falhas_detalhe || []).length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1">⚠ Não identificados</div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto text-xs">
                  {result.falhas_detalhe.map((f: any, i: number) => (
                    <div key={i} className="px-2 py-1 bg-amber-500/10 rounded">
                      pág {f.pagina}: {f.motivo}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Box({ label, valor, color }: { label: string; valor: number; color?: string }) {
  return (
    <div className="bg-secondary/40 p-3 rounded text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color || ""}`}>{(valor || 0).toLocaleString("pt-BR")}</div>
    </div>
  );
}

function LotesTab({ lotes, loading, onReload }: { lotes: Lote[]; loading: boolean; onReload: () => void }) {
  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 size={14} className="inline animate-spin" /> Carregando…</div>;
  if (lotes.length === 0) return (
    <Card className="p-12 text-center">
      <Receipt size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1.5">Nenhum lote processado ainda</div>
      <p className="text-xs text-muted-foreground">Use a aba "Novo upload" pra subir o primeiro PDF.</p>
    </Card>
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onReload}><RefreshCw size={11} /> Recarregar</Button>
      </div>
      {lotes.map((l) => {
        const pct = l.total_paginas > 0 ? Math.round((l.total_distribuidos / l.total_paginas) * 100) : 0;
        return (
          <Card key={l.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Receipt size={14} className="text-muted-foreground" />
                  <div className="text-sm font-semibold">
                    {l.competencia?.competencia ? `${l.competencia.competencia} (${l.competencia.tipo})` : "Lote sem competência"}
                  </div>
                  <Badge variant={l.status === "concluido" ? "success" : l.status === "falhou" ? "outline" : "warning"} className="text-[10px]">
                    {l.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(l.created_at)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                  <span className="text-muted-foreground">{l.total_paginas} pág</span>
                  <span className="text-emerald-400">✓ {l.total_distribuidos} distribuídos</span>
                  {l.total_falha > 0 && <span className="text-amber-400">⚠ {l.total_falha} falhas</span>}
                </div>
                <div className="mt-2 h-1 bg-secondary rounded overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
            {l.log_processamento && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver log completo</summary>
                <pre className="mt-2 p-2 bg-secondary/40 rounded text-[10px] overflow-x-auto max-h-64">
                  {JSON.stringify(l.log_processamento, null, 2)}
                </pre>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}
