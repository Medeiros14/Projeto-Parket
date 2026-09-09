import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { supabase } from "@/lib/supabase.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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
  Truck,
  Plus,
  Pencil,
  Trash2,
  Search,
  FileText,
  Paperclip,
  Image as ImageIcon,
  X,
  User,
  Phone } from
"lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────────────────
type FreteRow = {
  _id: string;
  _creationTime: number;
  numero: string;
  status: string;
  clienteNome?: string;
  clienteEmail?: string;
  clienteInfo?: string;
  descricao?: string;
  observacoes?: string;
  dataSaida?: string;
  dataEntrega?: string;
  origemCidade?: string;
  origemEstado?: string;
  destinoCidade?: string;
  destinoEstado?: string;
  motoristaNome?: string;
  motoristaCpf?: string;
  motoristaTelefone?: string;
  motoristaChavePix?: string;
  motoristaBanco?: string;
  motoristaAgencia?: string;
  motoristaConta?: string;
  motoristaTipoConta?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  valorTotal?: number;
  percentualAdiantamento1?: number;
  valorAdiantamento1?: number;
  adiantamento1Pago: boolean;
  valorAdiantamento2?: number;
  adiantamento2Pago: boolean;
  valorSaldo?: number;
  saldoPago: boolean;
  fotoUrl?: string;
  canhotosUrls?: string[];
};

type MotoristaRow = {
  _id: string;
  nome: string;
  cpf?: string;
  telefone?: string;
  chavePix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  observacoes?: string;
  ativo: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function brl(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
function num(s: string): number | null {
  if (!s.trim()) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

async function uploadArquivo(file: File): Promise<string> {
  const ext = EXT[file.type] ?? "bin";
  const path = `fretes/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("expedicao").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("expedicao").getPublicUrl(path);
  return data.publicUrl;
}

function StatusBadge({ s }: {s: string;}) {
  const cls =
  s === "ativo" ?
  "bg-green-500/15 text-green-400 border-green-500/30" :
  s === "concluido" ?
  "bg-blue-500/15 text-blue-400 border-blue-500/30" :
  "bg-red-500/15 text-red-400 border-red-500/30";
  const label = s === "ativo" ? "Ativo" : s === "concluido" ? "Concluído" : "Cancelado";
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function PagoChip({ label, pago }: {label: string;pago: boolean;}) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
      pago ?
      "bg-green-500/15 text-green-400 border-green-500/30" :
      "bg-muted text-muted-foreground border-border"}`
      }>
      {label} {pago ? "pago" : "pendente"}
    </span>);

}

// ─── PDF da Carta de Frete ────────────────────────────────────────────────────
async function logoToBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo-parket-pdf.png");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function gerarCartaPdf(f: FreteRow): Promise<void> {
  const doc = new jsPDF();
  let y = 10;

  const logoB64 = await logoToBase64();
  if (logoB64) {
    const fmt = logoB64.startsWith("data:image/png") ? "PNG" : "JPEG";
    const tmpImg = new window.Image();
    tmpImg.src = logoB64;
    await new Promise<void>((res) => {tmpImg.onload = () => res();tmpImg.onerror = () => res();});
    const logoH = 14;
    const logoW = tmpImg.width > 0 ? tmpImg.width / tmpImg.height * logoH : 40;
    doc.addImage(logoB64, fmt, 14, 8, logoW, logoH);
    y = 30;
  } else {
    y = 16;
  }

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`CARTA DE FRETE — ${f.numero}`, 14, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `Status: ${f.status === "ativo" ? "Ativo" : f.status === "concluido" ? "Concluído" : "Cancelado"}  •  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    14,
    y + 5
  );
  doc.setTextColor(0);
  y += 10;

  const bloco = (titulo: string, linhas: [string, string][]) => {
    const body = linhas.filter(([, v]) => v && v !== "—");
    if (body.length === 0) return;
    autoTable(doc, {
      startY: y,
      head: [[{ content: titulo, colSpan: 2 }]],
      body,
      theme: "grid",
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" } },
      styles: { overflow: "linebreak" },
      margin: { left: 14, right: 14 }
    });
    y = (doc as unknown as {lastAutoTable: {finalY: number;};}).lastAutoTable.finalY + 5;
  };

  bloco("DADOS DO FRETE", [
  ["Cliente", f.clienteNome ?? "—"],
  ["E-mail", f.clienteEmail ?? "—"],
  ["Informações", f.clienteInfo ?? "—"],
  ["Origem", [f.origemCidade, f.origemEstado].filter(Boolean).join(" / ") || "—"],
  ["Destino", [f.destinoCidade, f.destinoEstado].filter(Boolean).join(" / ") || "—"],
  ["Data de saída", fmtData(f.dataSaida)],
  ["Data de entrega", fmtData(f.dataEntrega)],
  ["Descrição da carga", f.descricao ?? "—"],
  ["Observações", f.observacoes ?? "—"]]
  );

  bloco("MOTORISTA", [
  ["Nome", f.motoristaNome ?? "—"],
  ["CPF", f.motoristaCpf ?? "—"],
  ["Telefone", f.motoristaTelefone ?? "—"],
  ["Veículo", f.veiculoModelo ?? "—"],
  ["Placa", f.veiculoPlaca ?? "—"]]
  );

  const pagoTxt = (p: boolean) => p ? " (PAGO)" : " (PENDENTE)";
  bloco("PAGAMENTO", [
  ["Valor total", brl(f.valorTotal)],
  [
  `Adiantamento 1${f.percentualAdiantamento1 ? ` (${f.percentualAdiantamento1}%)` : ""}`,
  f.valorAdiantamento1 != null ? brl(f.valorAdiantamento1) + pagoTxt(f.adiantamento1Pago) : "—"],

  [
  "Adiantamento 2",
  f.valorAdiantamento2 != null ? brl(f.valorAdiantamento2) + pagoTxt(f.adiantamento2Pago) : "—"],

  ["Saldo", f.valorSaldo != null ? brl(f.valorSaldo) + pagoTxt(f.saldoPago) : "—"],
  ["Chave PIX", f.motoristaChavePix ?? "—"],
  ["Banco", f.motoristaBanco ?? "—"],
  ["Agência", f.motoristaAgencia ?? "—"],
  ["Conta", f.motoristaConta ?? "—"],
  ["Tipo de conta", f.motoristaTipoConta ?? "—"]]
  );

  doc.save(`carta-frete-${f.numero}.pdf`);
}

// ─── Formulário de frete ──────────────────────────────────────────────────────
type FreteForm = {
  status: string;
  clienteNome: string;
  clienteEmail: string;
  clienteInfo: string;
  descricao: string;
  observacoes: string;
  dataSaida: string;
  dataEntrega: string;
  origemCidade: string;
  origemEstado: string;
  destinoCidade: string;
  destinoEstado: string;
  motoristaNome: string;
  motoristaCpf: string;
  motoristaTelefone: string;
  motoristaChavePix: string;
  motoristaBanco: string;
  motoristaAgencia: string;
  motoristaConta: string;
  motoristaTipoConta: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  valorTotal: string;
  percentualAdiantamento1: string;
  valorAdiantamento1: string;
  adiantamento1Pago: boolean;
  valorAdiantamento2: string;
  adiantamento2Pago: boolean;
  valorSaldo: string;
  saldoPago: boolean;
  fotoUrl: string;
  canhotosUrls: string[];
};

const emptyFrete = (): FreteForm => ({
  status: "ativo",
  clienteNome: "",
  clienteEmail: "",
  clienteInfo: "",
  descricao: "",
  observacoes: "",
  dataSaida: "",
  dataEntrega: "",
  origemCidade: "",
  origemEstado: "",
  destinoCidade: "",
  destinoEstado: "",
  motoristaNome: "",
  motoristaCpf: "",
  motoristaTelefone: "",
  motoristaChavePix: "",
  motoristaBanco: "",
  motoristaAgencia: "",
  motoristaConta: "",
  motoristaTipoConta: "",
  veiculoModelo: "",
  veiculoPlaca: "",
  valorTotal: "",
  percentualAdiantamento1: "",
  valorAdiantamento1: "",
  adiantamento1Pago: false,
  valorAdiantamento2: "",
  adiantamento2Pago: false,
  valorSaldo: "",
  saldoPago: false,
  fotoUrl: "",
  canhotosUrls: []
});

function freteToForm(f: FreteRow): FreteForm {
  return {
    ...emptyFrete(),
    status: f.status,
    clienteNome: f.clienteNome ?? "",
    clienteEmail: f.clienteEmail ?? "",
    clienteInfo: f.clienteInfo ?? "",
    descricao: f.descricao ?? "",
    observacoes: f.observacoes ?? "",
    dataSaida: f.dataSaida ?? "",
    dataEntrega: f.dataEntrega ?? "",
    origemCidade: f.origemCidade ?? "",
    origemEstado: f.origemEstado ?? "",
    destinoCidade: f.destinoCidade ?? "",
    destinoEstado: f.destinoEstado ?? "",
    motoristaNome: f.motoristaNome ?? "",
    motoristaCpf: f.motoristaCpf ?? "",
    motoristaTelefone: f.motoristaTelefone ?? "",
    motoristaChavePix: f.motoristaChavePix ?? "",
    motoristaBanco: f.motoristaBanco ?? "",
    motoristaAgencia: f.motoristaAgencia ?? "",
    motoristaConta: f.motoristaConta ?? "",
    motoristaTipoConta: f.motoristaTipoConta ?? "",
    veiculoModelo: f.veiculoModelo ?? "",
    veiculoPlaca: f.veiculoPlaca ?? "",
    valorTotal: f.valorTotal != null ? String(f.valorTotal) : "",
    percentualAdiantamento1: f.percentualAdiantamento1 != null ? String(f.percentualAdiantamento1) : "",
    valorAdiantamento1: f.valorAdiantamento1 != null ? String(f.valorAdiantamento1) : "",
    adiantamento1Pago: f.adiantamento1Pago,
    valorAdiantamento2: f.valorAdiantamento2 != null ? String(f.valorAdiantamento2) : "",
    adiantamento2Pago: f.adiantamento2Pago,
    valorSaldo: f.valorSaldo != null ? String(f.valorSaldo) : "",
    saldoPago: f.saldoPago,
    fotoUrl: f.fotoUrl ?? "",
    canhotosUrls: f.canhotosUrls ?? []
  };
}

function Campo({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>);

}

function SecaoTitulo({ children }: {children: React.ReactNode;}) {
  return (
    <p className="text-xs font-serif font-medium uppercase tracking-[0.12em] text-primary border-b border-border pb-1 pt-2">
      {children}
    </p>);

}

function FreteDialog({
  open,
  onOpenChange,
  editando,
  form,
  setForm,
  motoristas,
  onSave,
  saving



}: {open: boolean;onOpenChange: (v: boolean) => void;editando: boolean;form: FreteForm;setForm: (f: FreteForm) => void;motoristas: MotoristaRow[];onSave: () => void;saving: boolean;}) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const canhotoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<FreteForm>) => setForm({ ...form, ...patch });

  // total/percentual mudam → recalcula adiant.1 e saldo
  const recalc = (patch: Partial<FreteForm>) => {
    const next = { ...form, ...patch };
    const total = num(next.valorTotal) ?? 0;
    const pct = num(next.percentualAdiantamento1);
    let a1 = num(next.valorAdiantamento1) ?? 0;
    if (pct != null && ("valorTotal" in patch || "percentualAdiantamento1" in patch)) {
      a1 = Math.round(total * pct) / 100;
      next.valorAdiantamento1 = a1 ? String(a1) : "";
    }
    const a2 = num(next.valorAdiantamento2) ?? 0;
    const saldo = Math.round((total - a1 - a2) * 100) / 100;
    next.valorSaldo = total ? String(saldo) : "";
    setForm(next);
  };

  const escolherMotorista = (id: string) => {
    const m = motoristas.find((x) => x._id === id);
    if (!m) return;
    set({
      motoristaNome: m.nome,
      motoristaCpf: m.cpf ?? "",
      motoristaTelefone: m.telefone ?? "",
      motoristaChavePix: m.chavePix ?? "",
      motoristaBanco: m.banco ?? "",
      motoristaAgencia: m.agencia ?? "",
      motoristaConta: m.conta ?? "",
      motoristaTipoConta: m.tipoConta ?? "",
      veiculoModelo: m.veiculoModelo ?? "",
      veiculoPlaca: m.veiculoPlaca ?? ""
    });
  };

  const uploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      set({ fotoUrl: await uploadArquivo(file) });
      toast.success("Foto anexada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      if (fotoRef.current) fotoRef.current.value = "";
    }
  };

  const uploadCanhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadArquivo(f));
      set({ canhotosUrls: [...form.canhotosUrls, ...urls] });
      toast.success(`${urls.length} canhoto(s) anexado(s)!`);
    } catch {
      toast.error("Erro ao enviar canhoto");
    } finally {
      setUploading(false);
      if (canhotoRef.current) canhotoRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif uppercase tracking-[0.08em]">
            {editando ? "Editar Frete" : "Novo Frete"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <SecaoTitulo>Cliente</SecaoTitulo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome do cliente">
              <Input value={form.clienteNome} onChange={(e) => set({ clienteNome: e.target.value })} placeholder="Nome do cliente" />
            </Campo>
            <Campo label="E-mail">
              <Input type="email" value={form.clienteEmail} onChange={(e) => set({ clienteEmail: e.target.value })} placeholder="email@cliente.com" />
            </Campo>
          </div>
          <Campo label="Informações do cliente">
            <Input value={form.clienteInfo} onChange={(e) => set({ clienteInfo: e.target.value })} placeholder="Telefone, contato, etc." />
          </Campo>

          <SecaoTitulo>Rota</SecaoTitulo>
          <div className="grid grid-cols-[1fr_70px_1fr_70px] gap-3">
            <Campo label="Origem — cidade">
              <Input value={form.origemCidade} onChange={(e) => set({ origemCidade: e.target.value })} placeholder="Cidade" />
            </Campo>
            <Campo label="UF">
              <Input value={form.origemEstado} maxLength={2} onChange={(e) => set({ origemEstado: e.target.value.toUpperCase() })} placeholder="PR" />
            </Campo>
            <Campo label="Destino — cidade">
              <Input value={form.destinoCidade} onChange={(e) => set({ destinoCidade: e.target.value })} placeholder="Cidade" />
            </Campo>
            <Campo label="UF">
              <Input value={form.destinoEstado} maxLength={2} onChange={(e) => set({ destinoEstado: e.target.value.toUpperCase() })} placeholder="SP" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Data de saída">
              <Input type="date" value={form.dataSaida} onChange={(e) => set({ dataSaida: e.target.value })} />
            </Campo>
            <Campo label="Data de entrega">
              <Input type="date" value={form.dataEntrega} onChange={(e) => set({ dataEntrega: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Descrição da carga">
            <Textarea value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex: 30 caixas de assoalho..." />
          </Campo>
          <Campo label="Observações">
            <Textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Observações gerais" />
          </Campo>

          <SecaoTitulo>Motorista</SecaoTitulo>
          {motoristas.length > 0 &&
          <Campo label="Selecionar motorista cadastrado">
              <Select onValueChange={escolherMotorista}>
                <SelectTrigger><SelectValue placeholder="Preencher com motorista cadastrado..." /></SelectTrigger>
                <SelectContent>
                  {motoristas.map((m) =>
                <SelectItem key={m._id} value={m._id}>
                      {m.nome}{m.veiculoPlaca ? ` — ${m.veiculoPlaca}` : ""}
                    </SelectItem>
                )}
                </SelectContent>
              </Select>
            </Campo>
          }
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome">
              <Input value={form.motoristaNome} onChange={(e) => set({ motoristaNome: e.target.value })} placeholder="Nome do motorista" />
            </Campo>
            <Campo label="CPF">
              <Input value={form.motoristaCpf} onChange={(e) => set({ motoristaCpf: e.target.value })} placeholder="000.000.000-00" />
            </Campo>
            <Campo label="Telefone">
              <Input value={form.motoristaTelefone} onChange={(e) => set({ motoristaTelefone: e.target.value })} placeholder="(00) 00000-0000" />
            </Campo>
            <Campo label="Chave PIX">
              <Input value={form.motoristaChavePix} onChange={(e) => set({ motoristaChavePix: e.target.value })} placeholder="Chave PIX" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Campo label="Banco">
              <Input value={form.motoristaBanco} onChange={(e) => set({ motoristaBanco: e.target.value })} />
            </Campo>
            <Campo label="Agência">
              <Input value={form.motoristaAgencia} onChange={(e) => set({ motoristaAgencia: e.target.value })} />
            </Campo>
            <Campo label="Conta">
              <Input value={form.motoristaConta} onChange={(e) => set({ motoristaConta: e.target.value })} />
            </Campo>
            <Campo label="Tipo de conta">
              <Input value={form.motoristaTipoConta} onChange={(e) => set({ motoristaTipoConta: e.target.value })} placeholder="Corrente" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Veículo">
              <Input value={form.veiculoModelo} onChange={(e) => set({ veiculoModelo: e.target.value })} placeholder="Modelo do veículo" />
            </Campo>
            <Campo label="Placa">
              <Input value={form.veiculoPlaca} onChange={(e) => set({ veiculoPlaca: e.target.value.toUpperCase() })} placeholder="ABC-1234" />
            </Campo>
          </div>

          <SecaoTitulo>Pagamento</SecaoTitulo>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Campo label="Valor total (R$)">
              <Input type="number" step="0.01" value={form.valorTotal} onChange={(e) => recalc({ valorTotal: e.target.value })} />
            </Campo>
            <Campo label="% Adiant. 1">
              <Input type="number" step="1" value={form.percentualAdiantamento1} onChange={(e) => recalc({ percentualAdiantamento1: e.target.value })} />
            </Campo>
            <Campo label="Adiant. 1 (R$)">
              <Input type="number" step="0.01" value={form.valorAdiantamento1} onChange={(e) => recalc({ valorAdiantamento1: e.target.value })} />
            </Campo>
            <Campo label="Adiant. 2 (R$)">
              <Input type="number" step="0.01" value={form.valorAdiantamento2} onChange={(e) => recalc({ valorAdiantamento2: e.target.value })} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <Campo label="Saldo (R$)">
              <Input type="number" step="0.01" value={form.valorSaldo} onChange={(e) => set({ valorSaldo: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
              <Checkbox checked={form.adiantamento1Pago} onCheckedChange={(v) => set({ adiantamento1Pago: v === true })} />
              Adiant. 1 pago
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
              <Checkbox checked={form.adiantamento2Pago} onCheckedChange={(v) => set({ adiantamento2Pago: v === true })} />
              Adiant. 2 pago
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
              <Checkbox checked={form.saldoPago} onCheckedChange={(v) => set({ saldoPago: v === true })} />
              Saldo pago
            </label>
          </div>
          {editando &&
          <Campo label="Status">
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          }

          <SecaoTitulo>Anexos</SecaoTitulo>
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => fotoRef.current?.click()}>
              <ImageIcon className="w-4 h-4" />
              {form.fotoUrl ? "Trocar foto" : "Anexar foto"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => canhotoRef.current?.click()}>
              <Paperclip className="w-4 h-4" />
              Adicionar canhoto(s)
            </Button>
            {uploading && <span className="text-xs text-muted-foreground">Enviando...</span>}
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={uploadFoto} />
            <input ref={canhotoRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={uploadCanhotos} />
          </div>
          {(form.fotoUrl || form.canhotosUrls.length > 0) &&
          <div className="flex gap-2 flex-wrap">
              {form.fotoUrl &&
            <div className="relative">
                  <a href={form.fotoUrl} target="_blank" rel="noopener noreferrer">
                    <img src={form.fotoUrl} alt="Foto" className="w-16 h-16 object-cover rounded border border-border" />
                  </a>
                  <button
                type="button"
                onClick={() => set({ fotoUrl: "" })}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
            }
              {form.canhotosUrls.map((u, i) =>
            <div key={u} className="relative">
                  <a href={u} target="_blank" rel="noopener noreferrer">
                    {u.endsWith(".pdf") ?
                <span className="w-16 h-16 flex items-center justify-center rounded border border-border bg-muted">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </span> :

                <img src={u} alt={`Canhoto ${i + 1}`} className="w-16 h-16 object-cover rounded border border-border" />
                }
                  </a>
                  <button
                type="button"
                onClick={() => set({ canhotosUrls: form.canhotosUrls.filter((x) => x !== u) })}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
            )}
            </div>
          }
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}

// ─── Aba Fretes ───────────────────────────────────────────────────────────────
function AbaFretes() {
  const fretes = useQuery(api.fretes.list, {}) as FreteRow[] | undefined;
  const motoristas = useQuery(api.fretes.listMotoristas, {}) as MotoristaRow[] | undefined;
  const createFrete = useMutation(api.fretes.create);
  const updateFrete = useMutation(api.fretes.update);
  const removeFrete = useMutation(api.fretes.remove);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativo");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FreteForm>(emptyFrete());
  const [saving, setSaving] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    let list = fretes ?? [];
    if (filtro !== "todos") list = list.filter((f) => f.status === filtro);
    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter((f) =>
      [f.numero, f.clienteNome, f.motoristaNome, f.origemCidade, f.destinoCidade].
      some((v) => v?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [fretes, filtro, busca]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyFrete());
    setDialogOpen(true);
  };
  const openEdit = (f: FreteRow) => {
    setEditId(f._id);
    setForm(freteToForm(f));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.clienteNome.trim() && !form.motoristaNome.trim()) {
      toast.error("Informe ao menos cliente ou motorista");
      return;
    }
    const payload = {
      status: form.status,
      clienteNome: form.clienteNome || null,
      clienteEmail: form.clienteEmail || null,
      clienteInfo: form.clienteInfo || null,
      descricao: form.descricao || null,
      observacoes: form.observacoes || null,
      dataSaida: form.dataSaida || null,
      dataEntrega: form.dataEntrega || null,
      origemCidade: form.origemCidade || null,
      origemEstado: form.origemEstado || null,
      destinoCidade: form.destinoCidade || null,
      destinoEstado: form.destinoEstado || null,
      motoristaNome: form.motoristaNome || null,
      motoristaCpf: form.motoristaCpf || null,
      motoristaTelefone: form.motoristaTelefone || null,
      motoristaChavePix: form.motoristaChavePix || null,
      motoristaBanco: form.motoristaBanco || null,
      motoristaAgencia: form.motoristaAgencia || null,
      motoristaConta: form.motoristaConta || null,
      motoristaTipoConta: form.motoristaTipoConta || null,
      veiculoModelo: form.veiculoModelo || null,
      veiculoPlaca: form.veiculoPlaca || null,
      valorTotal: num(form.valorTotal),
      percentualAdiantamento1: num(form.percentualAdiantamento1),
      valorAdiantamento1: num(form.valorAdiantamento1),
      adiantamento1Pago: form.adiantamento1Pago,
      valorAdiantamento2: num(form.valorAdiantamento2),
      adiantamento2Pago: form.adiantamento2Pago,
      valorSaldo: num(form.valorSaldo),
      saldoPago: form.saldoPago,
      fotoUrl: form.fotoUrl || null,
      canhotosUrls: form.canhotosUrls
    };
    setSaving(true);
    try {
      if (editId) {
        await updateFrete({ id: editId, ...payload });
        toast.success("Frete atualizado!");
      } else {
        const res = await createFrete(payload) as {numero: string;};
        toast.success(`Frete ${res.numero} criado!`);
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar frete");
    } finally {
      setSaving(false);
    }
  };

  const del = async (f: FreteRow) => {
    if (!confirm(`Excluir o frete ${f.numero}?`)) return;
    try {
      await removeFrete({ id: f._id });
      toast.success("Frete excluído.");
    } catch {
      toast.error("Erro ao excluir frete");
    }
  };

  const pdf = async (f: FreteRow) => {
    setGerandoPdf(f._id);
    try {
      await gerarCartaPdf(f);
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setGerandoPdf(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nº, cliente, motorista..." />
          </div>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Novo Frete
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {fretes === undefined ?
          <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div> :
          filtrados.length === 0 ?
          <div className="text-center py-16 text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum frete encontrado.</p>
              <p className="text-sm mt-1">Clique em "Novo Frete" para começar.</p>
            </div> :

          filtrados.map((f) =>
          <div key={f._id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-semibold">{f.numero}</span>
                    <StatusBadge s={f.status} />
                    <span className="text-sm font-medium truncate">{f.clienteNome || "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[f.origemCidade, f.origemEstado].filter(Boolean).join("/") || "—"}
                    {" → "}
                    {[f.destinoCidade, f.destinoEstado].filter(Boolean).join("/") || "—"}
                    {"  •  Saída: "}{fmtData(f.dataSaida)}
                    {"  •  Entrega: "}{fmtData(f.dataEntrega)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-muted-foreground">
                    {f.motoristaNome &&
                <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{f.motoristaNome}
                      </span>
                }
                    {f.motoristaTelefone &&
                <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />{f.motoristaTelefone}
                      </span>
                }
                    <PagoChip label="Adiant. 1" pago={f.adiantamento1Pago} />
                    {f.valorAdiantamento2 != null && f.valorAdiantamento2 > 0 &&
                <PagoChip label="Adiant. 2" pago={f.adiantamento2Pago} />
                }
                    <PagoChip label="Saldo" pago={f.saldoPago} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-semibold">{brl(f.valorTotal)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar carta de frete (PDF)" disabled={gerandoPdf === f._id} onClick={() => pdf(f)}>
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(f)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" title="Excluir" onClick={() => del(f)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
          )
          }
        </CardContent>
      </Card>

      <FreteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editando={!!editId}
        form={form}
        setForm={setForm}
        motoristas={(motoristas ?? []).filter((m) => m.ativo)}
        onSave={save}
        saving={saving} />

    </div>);

}

// ─── Aba Motoristas ───────────────────────────────────────────────────────────
type MotoristaForm = {
  nome: string;
  cpf: string;
  telefone: string;
  chavePix: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  observacoes: string;
  ativo: boolean;
};
const emptyMotorista = (): MotoristaForm => ({
  nome: "",
  cpf: "",
  telefone: "",
  chavePix: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "",
  veiculoModelo: "",
  veiculoPlaca: "",
  observacoes: "",
  ativo: true
});

function AbaMotoristas() {
  const motoristas = useQuery(api.fretes.listMotoristas, {}) as MotoristaRow[] | undefined;
  const createMotorista = useMutation(api.fretes.createMotorista);
  const updateMotorista = useMutation(api.fretes.updateMotorista);
  const removeMotorista = useMutation(api.fretes.removeMotorista);

  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MotoristaForm>(emptyMotorista());

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = motoristas ?? [];
    if (q) list = list.filter((m) => [m.nome, m.veiculoPlaca, m.telefone].some((v) => v?.toLowerCase().includes(q)));
    return list;
  }, [motoristas, busca]);

  const set = (patch: Partial<MotoristaForm>) => setForm({ ...form, ...patch });

  const openNew = () => {
    setEditId(null);
    setForm(emptyMotorista());
    setDialogOpen(true);
  };
  const openEdit = (m: MotoristaRow) => {
    setEditId(m._id);
    setForm({
      nome: m.nome,
      cpf: m.cpf ?? "",
      telefone: m.telefone ?? "",
      chavePix: m.chavePix ?? "",
      banco: m.banco ?? "",
      agencia: m.agencia ?? "",
      conta: m.conta ?? "",
      tipoConta: m.tipoConta ?? "",
      veiculoModelo: m.veiculoModelo ?? "",
      veiculoPlaca: m.veiculoPlaca ?? "",
      observacoes: m.observacoes ?? "",
      ativo: m.ativo
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do motorista");
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      chavePix: form.chavePix || null,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      tipoConta: form.tipoConta || null,
      veiculoModelo: form.veiculoModelo || null,
      veiculoPlaca: form.veiculoPlaca || null,
      observacoes: form.observacoes || null,
      ativo: form.ativo
    };
    try {
      if (editId) {
        await updateMotorista({ id: editId, ...payload });
        toast.success("Motorista atualizado!");
      } else {
        await createMotorista(payload);
        toast.success("Motorista cadastrado!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar motorista");
    }
  };

  const del = async (m: MotoristaRow) => {
    if (!confirm(`Excluir o motorista ${m.nome}?`)) return;
    try {
      await removeMotorista({ id: m._id });
      toast.success("Motorista excluído.");
    } catch {
      toast.error("Erro ao excluir motorista");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar motorista..." />
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Novo Motorista
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {motoristas === undefined ?
          <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div> :
          filtrados.length === 0 ?
          <div className="text-center py-16 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum motorista cadastrado.</p>
            </div> :

          filtrados.map((m) =>
          <div key={m._id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{m.nome}</span>
                    {!m.ativo &&
                <Badge variant="outline" className="bg-muted text-muted-foreground">Inativo</Badge>
                }
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[
                m.telefone,
                m.cpf && `CPF: ${m.cpf}`,
                m.veiculoModelo,
                m.veiculoPlaca].
                filter(Boolean).join("  •  ") || "—"}
                  </p>
                  {m.chavePix &&
              <p className="text-xs text-muted-foreground mt-0.5">PIX: {m.chavePix}</p>
              }
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(m)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" title="Excluir" onClick={() => del(m)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
          )
          }
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif uppercase tracking-[0.08em]">
              {editId ? "Editar Motorista" : "Novo Motorista"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Campo label="Nome">
              <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome completo" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="CPF">
                <Input value={form.cpf} onChange={(e) => set({ cpf: e.target.value })} placeholder="000.000.000-00" />
              </Campo>
              <Campo label="Telefone">
                <Input value={form.telefone} onChange={(e) => set({ telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </Campo>
            </div>
            <Campo label="Chave PIX">
              <Input value={form.chavePix} onChange={(e) => set({ chavePix: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Campo label="Banco">
                <Input value={form.banco} onChange={(e) => set({ banco: e.target.value })} />
              </Campo>
              <Campo label="Agência">
                <Input value={form.agencia} onChange={(e) => set({ agencia: e.target.value })} />
              </Campo>
              <Campo label="Conta">
                <Input value={form.conta} onChange={(e) => set({ conta: e.target.value })} />
              </Campo>
              <Campo label="Tipo de conta">
                <Input value={form.tipoConta} onChange={(e) => set({ tipoConta: e.target.value })} placeholder="Corrente" />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Veículo">
                <Input value={form.veiculoModelo} onChange={(e) => set({ veiculoModelo: e.target.value })} placeholder="Modelo do veículo" />
              </Campo>
              <Campo label="Placa">
                <Input value={form.veiculoPlaca} onChange={(e) => set({ veiculoPlaca: e.target.value.toUpperCase() })} placeholder="ABC-1234" />
              </Campo>
            </div>
            <Campo label="Observações">
              <Textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.ativo} onCheckedChange={(v) => set({ ativo: v === true })} />
              Motorista ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function FretesPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 font-serif uppercase tracking-[0.08em]">
          <Truck className="w-6 h-6 text-primary" />
          Carta de Frete
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fretes, motoristas e geração da carta de frete em PDF.
        </p>
      </div>

      <Tabs defaultValue="fretes">
        <TabsList>
          <TabsTrigger value="fretes">Fretes</TabsTrigger>
          <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
        </TabsList>
        <TabsContent value="fretes" className="mt-4">
          <AbaFretes />
        </TabsContent>
        <TabsContent value="motoristas" className="mt-4">
          <AbaMotoristas />
        </TabsContent>
      </Tabs>
    </div>);

}
