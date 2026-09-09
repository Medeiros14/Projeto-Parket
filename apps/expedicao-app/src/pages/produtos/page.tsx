import { useEffect, useMemo, useState } from "react";
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
import { Plus, Search, Package, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog.tsx";
import { toast } from "sonner";
import { fetchComprasSaldos, matchSaldo, type ComprasSaldo } from "@/shim/api/comprasEstoque.ts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

const unitLabels: Record<string, string> = {
  m2: "m²",
  cx: "Caixa",
  ml: "Metro Linear",
  un: "Unidade"
};

function ProductForm({
  product,
  onClose



}: {product?: Doc<"products">;onClose: () => void;}) {
  const categories = useQuery(api.products.listCategories, {});
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);

  const [form, setForm] = useState({
    name: product?.name ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? "",
    unit: product?.unit ?? "m2",
    m2PerBox: product?.m2PerBox?.toString() ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    minStock: product?.minStock?.toString() ?? ""
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.unit) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        categoryId: form.categoryId ? form.categoryId as Id<"categories"> : undefined,
        unit: form.unit as "m2" | "cx" | "ml" | "un",
        m2PerBox: form.m2PerBox ? parseFloat(form.m2PerBox) : undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        minStock: form.minStock ? parseFloat(form.minStock) : undefined
      };
      if (product) {
        await updateProduct({ id: product._id, ...payload });
        toast.success("Produto atualizado!");
      } else {
        await createProduct(payload);
        toast.success("Produto cadastrado!");
      }
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar produto");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Nome *</Label>
          <Input placeholder="Ex: Porcelanato 60x60" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Código *</Label>
          <Input placeholder="Ex: PRC-001" value={form.code} onChange={(e) => set("code", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Unidade *</Label>
          <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="m2">m² (Metro Quadrado)</SelectItem>
              <SelectItem value="cx">Caixa</SelectItem>
              <SelectItem value="ml">Metro Linear</SelectItem>
              <SelectItem value="un">Unidade</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.unit === "cx" &&
        <div className="space-y-1">
            <Label>m² por Caixa</Label>
            <Input type="number" step="0.01" placeholder="Ex: 1.62" value={form.m2PerBox} onChange={(e) => set("m2PerBox", e.target.value)} />
          </div>
        }
        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select value={form.categoryId || "none"} onValueChange={(v) => set("categoryId", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories?.map((c) =>
              <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Preço de Custo (R$)</Label>
          <Input type="number" step="0.01" placeholder="0,00" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Estoque Mínimo</Label>
          <Input type="number" step="0.01" placeholder="0" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Descrição</Label>
          <Textarea placeholder="Informações adicionais..." value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{product ? "Salvar" : "Cadastrar"}</Button>
      </div>
    </form>);

}

export default function ProductsPage() {
  const products = useQuery(api.products.listProducts, {});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"products"> | undefined>(undefined);
  const deleteProduct = useMutation(api.products.deleteProduct);

  const [comprasSaldos, setComprasSaldos] = useState<ComprasSaldo[]>([]);
  useEffect(() => {
    fetchComprasSaldos().then(setComprasSaldos).catch(() => {});
  }, []);
  const saldoDe = useMemo(() => {
    const cache = new Map<string, ComprasSaldo | null>();
    return (code: string, name: string) => {
      const k = `${code}|${name}`;
      if (!cache.has(k)) cache.set(k, matchSaldo(comprasSaldos, code, name));
      return cache.get(k) ?? null;
    };
  }, [comprasSaldos]);

  const filtered = products?.filter(
    (p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{products?.length ?? 0} produto(s) cadastrado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => {setOpen(v);if (!v) setEditing(undefined);}}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer bg-black">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Produto" : "Cadastrar Produto"}</DialogTitle>
            </DialogHeader>
            <ProductForm key={editing?._id ?? "new"} product={editing} onClose={() => {setOpen(false);setEditing(undefined);}} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {products === undefined ?
      <div className="grid gap-3">
          {[1, 2, 3].map((i) =>
        <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        )}
        </div> :
      filtered.length === 0 ?
      <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Package /></EmptyMedia>
            <EmptyTitle>Nenhum produto encontrado</EmptyTitle>
            <EmptyDescription>Cadastre seu primeiro produto clicando em "Novo Produto"</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </EmptyContent>
        </Empty> :

      <div className="grid gap-3">
          {filtered.map((p) => {
          const isLow = p.minStock != null && p.currentStock <= p.minStock;
          const compras = saldoDe(p.code, p.name);
          return (
            <Card key={p._id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 w-full min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {/* Name row */}
                      <div className="flex items-center gap-1.5 w-full min-w-0">
                        <p className="font-semibold text-sm truncate flex-1 min-w-0">{p.name}</p>
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        <Badge variant={p.active ? "default" : "secondary"} className="text-xs shrink-0">{p.active ? "Ativo" : "Inativo"}</Badge>
                      </div>
                      {/* Code + stock row */}
                      <div className="flex items-center gap-2 mt-0.5 min-w-0">
                        <p className="text-xs text-muted-foreground shrink-0">{p.code}</p>
                        <span className={`text-xs font-bold truncate ${isLow ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.currentStock} {unitLabels[p.unit] ?? p.unit}
                          {p.unit === "cx" && p.m2PerBox ? ` · ${(p.currentStock * p.m2PerBox).toFixed(2)} m²` : ""}
                        </span>
                        {compras &&
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground shrink-0" title={`ERP Compras · ${compras.descricao}`}>
                          Compras: {compras.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {compras.unidade ?? ""}
                        </span>
                        }
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer shrink-0 h-7 w-7 p-0"
                      onClick={() => {setEditing(p);setOpen(true);}}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O produto <strong>{p.name}</strong> será removido do catálogo.
                            Pedidos e movimentações anteriores que contêm este produto não serão afetados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="cursor-pointer bg-destructive hover:bg-destructive/90"
                            onClick={async () => {
                              await deleteProduct({ id: p._id });
                              toast.success("Produto apagado com sucesso");
                            }}>
                            Apagar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>);

        })}
        </div>
      }
    </div>);

}