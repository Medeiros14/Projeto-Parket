import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog.tsx";
import { toast } from "sonner";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Circle } from
"lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type DiaRow = {
  _id: string;
  data: string;
  cliente?: string;
  descricao?: string;
  prioridade: string;
  realizada: boolean;
  solicitadoPor?: string;
};
type SemanaRow = DiaRow & {diaSemana?: string;isFeriado: boolean;local?: string;};
type PendRow = {
  _id: string;
  origem: string;
  cliente?: string;
  descricao?: string;
  observacao?: string;
  statusCor: string;
};

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORIGENS = ["ARVO", "MUNDIAL/FORT"];

function hoje(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return addDays(iso, 1 - dow);
}
function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function diaSemanaDe(iso: string): string {
  return DIAS_SEMANA[new Date(iso + "T12:00:00Z").getUTCDay()];
}

function PrioridadeBadge({ p }: {p: string;}) {
  const cls =
  p === "Alta" ?
  "bg-red-500/15 text-red-400 border-red-500/30" :
  p === "Feriado" ?
  "bg-blue-500/15 text-blue-400 border-blue-500/30" :
  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return <Badge variant="outline" className={cls}>{p}</Badge>;
}

// ─── Item de entrega (dia/semana) ─────────────────────────────────────────────
function EntregaItem({
  row,
  extra,
  onToggle,
  onEdit,
  onDelete



}: {row: DiaRow;extra?: React.ReactNode;onToggle: () => void;onEdit: () => void;onDelete: () => void;}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20">
      <button onClick={onToggle} className="mt-0.5 cursor-pointer shrink-0" title={row.realizada ? "Desmarcar" : "Marcar realizada"}>
        {row.realizada ?
        <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-400" />
          </span> :

        <Circle className="w-5 h-5 text-muted-foreground/40" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${row.realizada ? "line-through text-muted-foreground" : ""}`}>
          {row.cliente || "—"}
        </p>
        {row.descricao && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{row.descricao}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <PrioridadeBadge p={row.prioridade} />
          {row.solicitadoPor &&
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Solicitado por: {row.solicitadoPor}
            </span>
          }
          {extra}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-destructive/50 hover:text-destructive cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>);

}

// ─── Formulário dia/semana ────────────────────────────────────────────────────
type FormState = {
  data: string;
  cliente: string;
  descricao: string;
  prioridade: string;
  solicitadoPor: string;
  local: string;
};
const emptyForm = (data: string): FormState => ({
  data,
  cliente: "",
  descricao: "",
  prioridade: "Média",
  solicitadoPor: "",
  local: ""
});

function EntregaDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  onSave,
  comLocal




}: {open: boolean;onOpenChange: (v: boolean) => void;title: string;form: FormState;setForm: (f: FormState) => void;onSave: () => void;comLocal?: boolean;}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Data</label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</label>
            <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Descrição / Status</label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Entrega de material" />
          </div>
          {comLocal &&
          <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Local</label>
              <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Ex: SÃO PAULO-SP" />
            </div>
          }
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Prioridade</label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Feriado">Feriado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Solicitado por</label>
              <Input value={form.solicitadoPor} onChange={(e) => setForm({ ...form, solicitadoPor: e.target.value })} placeholder="Ex: CONFIRMAÇÃO DA SEMANA" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}

// ─── Aba Dia ──────────────────────────────────────────────────────────────────
function AbaDia() {
  const [data, setData] = useState(hoje());
  const rows = useQuery(api.agenda.listByDate, { data }) as DiaRow[] | undefined;
  const createDia = useMutation(api.agenda.createDia);
  const updateDia = useMutation(api.agenda.updateDia);
  const removeDia = useMutation(api.agenda.removeDia);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(data));

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm(data));
    setDialogOpen(true);
  };
  const openEdit = (r: DiaRow) => {
    setEditId(r._id);
    setForm({ ...emptyForm(r.data), cliente: r.cliente ?? "", descricao: r.descricao ?? "", prioridade: r.prioridade, solicitadoPor: r.solicitadoPor ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    const payload = { data: form.data, cliente: form.cliente || null, descricao: form.descricao || null, prioridade: form.prioridade, solicitadoPor: form.solicitadoPor || null };
    try {
      if (editId) {
        await updateDia({ id: editId, ...payload });
        toast.success("Entrega atualizada!");
      } else {
        await createDia(payload);
        toast.success("Entrega adicionada!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar entrega");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setData(addDays(data, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <Input type="date" className="w-40" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
          <Button variant="outline" size="icon" onClick={() => setData(addDays(data, 1))}><ChevronRight className="w-4 h-4" /></Button>
          {data !== hoje() && <Button variant="ghost" onClick={() => setData(hoje())}>Hoje</Button>}
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nova Entrega</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-serif font-medium uppercase tracking-[0.10em]">
              {diaSemanaDe(data)} — {fmt(data)}
            </p>
            {rows && <Badge variant="secondary">{rows.length} entregas</Badge>}
          </div>
          {rows === undefined ?
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div> :
          rows.length === 0 ?
          <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma entrega neste dia.</p> :

          rows.map((r) =>
          <EntregaItem
            key={r._id}
            row={r}
            onToggle={() => updateDia({ id: r._id, realizada: !r.realizada })}
            onEdit={() => openEdit(r)}
            onDelete={async () => {
              if (!confirm("Excluir esta entrega?")) return;
              await removeDia({ id: r._id });
            }} />

          )
          }
        </CardContent>
      </Card>

      <EntregaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editId ? "Editar Entrega do Dia" : "Nova Entrega do Dia"}
        form={form}
        setForm={setForm}
        onSave={save} />

    </div>);

}

// ─── Aba Semana ───────────────────────────────────────────────────────────────
function AbaSemana() {
  const [monday, setMonday] = useState(mondayOf(hoje()));
  const saturday = addDays(monday, 5);
  const rows = useQuery(api.agenda.listByWeek, { startDate: monday, endDate: saturday }) as SemanaRow[] | undefined;
  const createSemana = useMutation(api.agenda.createSemana);
  const updateSemana = useMutation(api.agenda.updateSemana);
  const removeSemana = useMutation(api.agenda.removeSemana);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(monday));

  const porDia = useMemo(() => {
    const map = new Map<string, SemanaRow[]>();
    for (let i = 0; i < 6; i++) map.set(addDays(monday, i), []);
    for (const r of rows ?? []) {
      if (!map.has(r.data)) map.set(r.data, []);
      map.get(r.data)!.push(r);
    }
    return map;
  }, [rows, monday]);

  const openNew = (data: string) => {
    setEditId(null);
    setForm(emptyForm(data));
    setDialogOpen(true);
  };
  const openEdit = (r: SemanaRow) => {
    setEditId(r._id);
    setForm({ data: r.data, cliente: r.cliente ?? "", descricao: r.descricao ?? "", prioridade: r.prioridade, solicitadoPor: r.solicitadoPor ?? "", local: r.local ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    const payload = {
      data: form.data,
      diaSemana: diaSemanaDe(form.data),
      cliente: form.cliente || null,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      solicitadoPor: form.solicitadoPor || null,
      local: form.local || null,
      isFeriado: form.prioridade === "Feriado"
    };
    try {
      if (editId) {
        await updateSemana({ id: editId, ...payload });
        toast.success("Agendamento atualizado!");
      } else {
        await createSemana(payload);
        toast.success("Agendamento criado!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar agendamento");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft className="w-4 h-4" /></Button>
        <p className="text-sm font-serif uppercase tracking-[0.10em] px-2">
          {fmt(monday)} — {fmt(saturday)}
        </p>
        <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, 7))}><ChevronRight className="w-4 h-4" /></Button>
        {monday !== mondayOf(hoje()) && <Button variant="ghost" onClick={() => setMonday(mondayOf(hoje()))}>Semana atual</Button>}
      </div>

      {rows === undefined ?
      <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div> :

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...porDia.entries()].map(([data, items]) =>
        <Card key={data} className={data === hoje() ? "border-primary/50" : ""}>
              <CardContent className="p-0">
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-serif font-medium uppercase tracking-[0.12em]">
                    {diaSemanaDe(data)} <span className="text-muted-foreground ml-1">{fmt(data)}</span>
                  </p>
                  <button onClick={() => openNew(data)} className="p-1 text-muted-foreground hover:text-primary cursor-pointer">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {items.length === 0 ?
            <p className="text-center py-6 text-muted-foreground/60 text-xs">Sem agendamentos</p> :

            items.map((r) =>
            <EntregaItem
              key={r._id}
              row={r}
              extra={r.local ? <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.local}</span> : undefined}
              onToggle={() => updateSemana({ id: r._id, realizada: !r.realizada })}
              onEdit={() => openEdit(r)}
              onDelete={async () => {
                if (!confirm("Excluir este agendamento?")) return;
                await removeSemana({ id: r._id });
              }} />

            )
            }
              </CardContent>
            </Card>
        )}
        </div>
      }

      <EntregaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editId ? "Editar Agendamento" : "Novo Agendamento"}
        form={form}
        setForm={setForm}
        onSave={save}
        comLocal />

    </div>);

}

// ─── Aba Pendências ───────────────────────────────────────────────────────────
const COR_DOT: Record<string, string> = {
  verde: "bg-green-500",
  amarelo: "bg-yellow-400",
  branco: "bg-white/70 border border-border"
};

function AbaPendencias() {
  const rows = useQuery(api.agenda.listPendentes, {}) as PendRow[] | undefined;
  const createPendente = useMutation(api.agenda.createPendente);
  const updatePendente = useMutation(api.agenda.updatePendente);
  const removePendente = useMutation(api.agenda.removePendente);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ origem: ORIGENS[0], cliente: "", descricao: "", observacao: "", statusCor: "branco" });

  const openNew = (origem: string) => {
    setEditId(null);
    setForm({ origem, cliente: "", descricao: "", observacao: "", statusCor: "branco" });
    setDialogOpen(true);
  };
  const openEdit = (r: PendRow) => {
    setEditId(r._id);
    setForm({ origem: r.origem, cliente: r.cliente ?? "", descricao: r.descricao ?? "", observacao: r.observacao ?? "", statusCor: r.statusCor });
    setDialogOpen(true);
  };
  const save = async () => {
    const payload = { origem: form.origem, cliente: form.cliente || null, descricao: form.descricao || null, observacao: form.observacao || null, statusCor: form.statusCor };
    try {
      if (editId) await updatePendente({ id: editId, ...payload });else
      await createPendente(payload);
      toast.success("Salvo!");
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ORIGENS.map((origem) => {
        const items = (rows ?? []).filter((r) => r.origem === origem);
        return (
          <Card key={origem}>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-serif font-medium uppercase tracking-[0.12em]">{origem}</p>
                <Button variant="outline" size="sm" onClick={() => openNew(origem)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Nova
                </Button>
              </div>
              {rows === undefined ?
              <div className="p-4 space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
              items.length === 0 ?
              <p className="text-center py-8 text-muted-foreground/60 text-sm">Sem tentativas pendentes.</p> :

              items.map((r) =>
              <div key={r._id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20">
                    <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${COR_DOT[r.statusCor] ?? COR_DOT.branco}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{r.cliente || "—"}</p>
                      {r.descricao && <p className="text-xs text-muted-foreground mt-0.5">{r.descricao}</p>}
                      {r.observacao && r.observacao !== r.descricao &&
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{r.observacao}</p>
                  }
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                    onClick={async () => {
                      if (!confirm("Excluir esta pendência?")) return;
                      await removePendente({ id: r._id });
                    }}
                    className="p-1.5 text-destructive/50 hover:text-destructive cursor-pointer">

                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              )
              }
            </CardContent>
          </Card>);

      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Tentativa de Entrega" : "Nova Tentativa de Entrega"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Origem</label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</label>
              <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Descrição / Status</label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Observação</label>
              <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Cor do Status</label>
              <Select value={form.statusCor} onValueChange={(v) => setForm({ ...form, statusCor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="branco">Branco (aguardando)</SelectItem>
                  <SelectItem value="amarelo">Amarelo (em contato)</SelectItem>
                  <SelectItem value="verde">Verde (confirmado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 font-serif uppercase tracking-[0.08em]">
          <CalendarCheck className="w-6 h-6 text-primary" />
          Agenda do Dia
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Entregas do dia, agenda semanal e tentativas de entrega.
        </p>
      </div>

      <Tabs defaultValue="dia">
        <TabsList>
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
        </TabsList>
        <TabsContent value="dia" className="mt-4"><AbaDia /></TabsContent>
        <TabsContent value="semana" className="mt-4"><AbaSemana /></TabsContent>
        <TabsContent value="pendencias" className="mt-4"><AbaPendencias /></TabsContent>
      </Tabs>
    </div>);

}
