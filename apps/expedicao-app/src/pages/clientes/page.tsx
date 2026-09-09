import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from
"@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Plus, Search, Users, Pencil, Phone, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { searchGestaoProjetos, type GestaoProjeto } from "@/shim/api/gestao.ts";

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada"
};

const freightColors: Record<string, string> = {
  interno: "bg-primary/10 text-primary",
  terceiro: "bg-accent/10 text-accent-foreground",
  retirada: "bg-muted text-muted-foreground"
};

function ClientForm({ client, onClose }: {client?: Doc<"clients">;onClose: () => void;}) {
  const createClient = useMutation(api.clients.createClient);
  const updateClient = useMutation(api.clients.updateClient);

  const [form, setForm] = useState({
    name: client?.name ?? "",
    document: client?.document ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    addressNumber: client?.addressNumber ?? "",
    complement: client?.complement ?? "",
    neighborhood: client?.neighborhood ?? "",
    city: client?.city ?? "",
    state: client?.state ?? "",
    zipCode: client?.zipCode ?? "",
    freightType: client?.freightType ?? "interno",
    freightValue: client?.freightValue?.toString() ?? "",
    notes: client?.notes ?? ""
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const [gestaoQ, setGestaoQ] = useState("");
  const [gestaoResults, setGestaoResults] = useState<GestaoProjeto[]>([]);
  const [gestaoLoading, setGestaoLoading] = useState(false);

  const buscarGestao = async () => {
    if (!gestaoQ.trim()) return;
    setGestaoLoading(true);
    try {
      setGestaoResults(await searchGestaoProjetos(gestaoQ.trim()));
    } catch {
      toast.error("Falha ao consultar o Gestão");
    } finally {
      setGestaoLoading(false);
    }
  };

  const aplicarGestao = (p: GestaoProjeto) => {
    setForm((f) => ({
      ...f,
      name: p.cliente || f.name,
      document: p.cnpj_cpf ?? f.document,
      address: p.endereco ?? f.address,
      notes: [f.notes, `Obra Gestão${p.numero_proposta ? ` · proposta ${p.numero_proposta}` : ""}${p.obra_code ? ` · ${p.obra_code}` : ""} (card ${p.card_id ?? p.id})`]
        .filter(Boolean).join("\n"),
    }));
    setGestaoResults([]);
    setGestaoQ("");
    toast.success(`Dados de "${p.cliente}" importados do Gestão`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {toast.error("Nome é obrigatório");return;}
    try {
      const payload = {
        name: form.name,
        document: form.document || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        addressNumber: form.addressNumber || undefined,
        complement: form.complement || undefined,
        neighborhood: form.neighborhood || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        freightType: form.freightType as "interno" | "terceiro" | "retirada",
        freightValue: form.freightValue ? parseFloat(form.freightValue) : undefined,
        notes: form.notes || undefined
      };
      if (client) {
        await updateClient({ id: client._id, ...payload });
        toast.success("Cliente atualizado!");
      } else {
        await createClient(payload);
        toast.success("Cliente cadastrado!");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar cliente");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-3">
        {!client &&
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Importar do Gestão (obras)</p>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar cliente / proposta no Gestão..."
              value={gestaoQ}
              onChange={(e) => setGestaoQ(e.target.value)}
              onKeyDown={(e) => {if (e.key === "Enter") {e.preventDefault();buscarGestao();}}} />
            <Button type="button" variant="secondary" onClick={buscarGestao} disabled={gestaoLoading}>
              {gestaoLoading ? "..." : "Buscar"}
            </Button>
          </div>
          {gestaoResults.length > 0 &&
          <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
            {gestaoResults.map((p) =>
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted cursor-pointer"
              onClick={() => aplicarGestao(p)}>
              <span className="font-medium">{p.cliente}</span>
              <span className="text-xs text-muted-foreground block truncate">
                {[p.numero_proposta && `Proposta ${p.numero_proposta}`, p.endereco].filter(Boolean).join(" · ") || p.status}
              </span>
            </button>
            )}
          </div>
          }
        </div>
        }
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Básicos</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Nome / Razão Social *</Label>
            <Input placeholder="João da Silva" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CPF / CNPJ</Label>
            <Input placeholder="000.000.000-00" value={form.document} onChange={(e) => set("document", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>E-mail</Label>
            <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Endereço</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Logradouro</Label>
            <Input placeholder="Rua, Avenida..." value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Número</Label>
            <Input placeholder="123" value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Complemento</Label>
            <Input placeholder="Apto, Bloco..." value={form.complement} onChange={(e) => set("complement", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Bairro</Label>
            <Input placeholder="Centro" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CEP</Label>
            <Input placeholder="00000-000" value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cidade</Label>
            <Input placeholder="São Paulo" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Input placeholder="SP" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </div>
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Frete</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo de Frete</Label>
            <Select value={form.freightType} onValueChange={(v) => set("freightType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interno">Frete Interno</SelectItem>
                <SelectItem value="terceiro">Frete Terceiro</SelectItem>
                <SelectItem value="retirada">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor do Frete (R$)</Label>
            <Input type="number" step="0.01" placeholder="0,00" value={form.freightValue} onChange={(e) => set("freightValue", e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Observações</Label>
          <Textarea placeholder="Informações adicionais..." value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{client ? "Salvar" : "Cadastrar"}</Button>
      </div>
    </form>);

}

export default function ClientsPage() {
  const clients = useQuery(api.clients.listClients, { includeInactive: true });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"clients"> | undefined>(undefined);

  const filtered = clients?.filter(
    (c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search) ||
    (c.document ?? "").includes(search)
  ) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients?.length ?? 0} cliente(s) cadastrado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => {setOpen(v);if (!v) setEditing(undefined);}}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer bg-black">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Cadastrar Cliente"}</DialogTitle>
            </DialogHeader>
            <ClientForm key={editing?._id ?? "new"} client={editing} onClose={() => {setOpen(false);setEditing(undefined);}} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, telefone ou documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {clients === undefined ?
      <div className="grid gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div> :
      filtered.length === 0 ?
      <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Nenhum cliente encontrado</EmptyTitle>
            <EmptyDescription>Cadastre seu primeiro cliente clicando em "Novo Cliente"</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </EmptyContent>
        </Empty> :

      <div className="grid gap-3">
          {filtered.map((c) =>
        <Card key={c._id} className="hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3 w-full min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {/* Name + actions row */}
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <p className="font-semibold text-sm truncate flex-1 min-w-0">{c.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={c.active ? "default" : "secondary"} className="text-xs">{c.active ? "Ativo" : "Inativo"}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer h-7 w-7 p-0"
                          onClick={() => {setEditing(c);setOpen(true);}}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Info row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {c.phone &&
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.phone}</span>
                        </span>
                      }
                      {c.city &&
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.city}{c.state ? `/${c.state}` : ""}</span>
                        </span>
                      }
                      <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${freightColors[c.freightType]}`}>
                        <Truck className="w-3 h-3 shrink-0" />
                        <span className="truncate">{freightLabels[c.freightType]}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
        )}
        </div>
      }
    </div>);

}