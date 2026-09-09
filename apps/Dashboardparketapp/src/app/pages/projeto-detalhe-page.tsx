/* ═══ PROJETO DETALHE — Página completa do projeto (360°) ═══ */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import type { DbCard, ChatMessage, GateStep } from "../hooks/useKanbanCards";
import { acceptHandoff, returnHandoff } from "../hooks/useKanbanCards";
import { abrirPropostaParaImpressao } from "../lib/propostaGenerator";
import type { SimulacaoProjeto, SimulacaoItem } from "../hooks/useOrcamento";
import { useHandoffs } from "../hooks/useHandoffs";
import { useCardMovements } from "../hooks/useCardMovements";
import {
  ArrowLeft, Edit3, Save, X, CheckCircle2, Clock, AlertTriangle, MessageSquare,
  FileText, DollarSign, Users, Package, GitBranch, Bot, Paperclip,
  ExternalLink, Send, Plus, Trash2, ChevronRight, MapPin, Phone,
  MessageCircle, Calendar, User, Loader2, Check, RotateCcw,
  TrendingUp, TrendingDown, Building2, Wrench, ClipboardList, History, Bell,
  Calculator, Printer, FolderOpen, Upload, Camera, Zap, ChevronDown, ChevronLeft,
  RefreshCw, Eye, Search,
} from "lucide-react";
import { useAlertas, type Alerta } from "../hooks/useAlertas";
import { useEquipesParket, type EquipeMembro } from "../hooks/useEquipesParket";
import type { CronogramaPdfInput, CronogramaItem, CronogramaAlerta, CronogramaMedia } from "../lib/cronograma-pdf";

/* ─── Cores ─── */
const ACCENT = "#D4A853";
const GREEN = "#10B981";
const RED = "#EF4444";
const BLUE = "#3B82F6";
const YELLOW = "#F59E0B";
const PURPLE = "#8B5CF6";
const ORANGE = "#F97316";
const TEAL = "#14B8A6";
const GOLD = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.35)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const CARD_BG = "rgba(255,255,255,0.02)";
const BORDER = "rgba(255,255,255,0.06)";
const BG = "#0A0A0A";

/* ─── Tipos extras armazenados em details JSONB ─── */
interface ProjetoDetails {
  arquiteto?: string;
  vendedor?: string;
  marcenaria?: boolean;
  medicao?: string;
  contato_responsavel?: string;
  grupo_whatsapp?: string;
  endereco?: string;
  estado?: string;
  previsao_inicio?: string;
  prazo_contratual?: string;
  prazo_dias_uteis?: number;
  area_m2?: number;
  cronograma_pmo?: {
    itens: Array<{ servico: string; quantidade: number; unidade: string; rendimento: number; dias_uteis: number }>;
    total_dias_uteis: number;
    calculado_por?: string;
    observacao?: string;
    area_confirmada?: boolean;
    previsao_inicio?: string;
  };
  fiscal_responsavel?: string;
  primeira_vistoria?: boolean;
  icamento?: "sim" | "nao" | "a confirmar";
  material_entregue?: boolean;
  segunda_vistoria?: boolean;
  projeto_entregue?: boolean;
  servicos?: string[];
  status_projeto?: "a iniciar" | "em andamento" | "concluido";
  gate_atual?: string;
  observacoes?: string;
  materiais?: Array<{ item: string; qtd: string; unidade: string; status: string; valor?: string }>;
  equipe?: Array<{ nome: string; funcao: string; desde?: string; contato?: string }>;
  equipe_obras?: { nome: string; lider: string; contato?: string; data_entrada?: string; data_saida?: string; observacao?: string };
  documentos?: Array<{ nome: string; tipo: string; url: string; data?: string }>;
  ia_analysis?: { pontos_ok: string[]; pontos_atencao: string[]; atualizado_em?: string; resumo?: string };
  agendamentos?: Array<{
    id: string;
    setor: string;
    tipo: string;
    data: string;
    hora?: string;
    responsavel?: string;
    status: "agendado" | "realizado" | "cancelado";
    observacao?: string;
  }>;
  relatorios?: Array<{
    id: string;
    setor: string;
    tipo: string;
    data: string;
    responsavel?: string;
    resultado: "aprovado" | "reprovado" | "pendencias";
    descricao?: string;
    checklist_vistoria?: Array<{ item: string; ok: boolean; obs?: string }>;
  }>;
  /* ── Campos adicionados do golden ── */
  drive_folder_id?: string;
  drive_folder_url?: string;
  drive_folder_created_at?: string;
  media_gallery?: Array<{
    id: string;
    url: string;
    type: "foto" | "video";
    caption?: string;
    description?: string;
    categoria?: string;
    produtos?: string[];
    ambiente?: string;
    date?: string;
  }>;
  prestadores?: Array<{
    id: string;
    nome: string;
    telefone?: string;
    categoria: string;
    data_entrada?: string;
    observacao?: string;
  }>;
  levantamento_itens?: {
    servicos: Array<{
      servico: string;
      quantidade?: number;
      unidade?: string;
      ambiente?: string;
      observacao?: string;
    }>;
  };
  previsao_entrega_manual?: string;
  alertas_cronograma?: CronogramaAlerta[];
  /* Campos comerciais / CRM */
  celular?: string;
  telefone_comercial?: string;
  telefone_residencial?: string;
  email?: string;
  outro_email?: string;
  contato_principal?: string;
  cidade?: string;
  metragem_estimada?: string;
  produto_interesse?: string;
  faixa_investimento?: string;
  relacao_obra?: string;
  arquitetura?: string;
  endereco_obra?: string;
  valor_orcamento_enviado?: string;
  status_lead?: string;
  funil_vendas?: string;
  data_proposta?: string;
  data_criada?: string;
  proxima_tarefa?: string;
  proxima_consulta?: string;
  modificado_por?: string;
  resumo_qualificacao?: string;
  overview_ia?: string;
  orc_tipo_produto?: string;
  orc_metragem_real?: string;
  orc_ambientes?: string;
  orc_material?: string;
  orc_espessura?: string;
  orc_paginacao?: string;
  orc_valor_material?: string;
  orc_valor_mao_obra?: string;
  orc_valor_total?: string;
  orc_prazo_entrega?: string;
  orc_fornecedor?: string;
  orc_observacoes?: string;
}

/* ─── Helpers ─── */
/** Normaliza campo servicos que pode vir como string (CSV) ou string[] (form) */
function toArr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return v.split(/[,+]/).map(s => s.trim()).filter(Boolean);
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="rounded-full px-2.5 py-1" style={{ fontSize: "0.55rem", fontWeight: 600, color, background: bg }}>
      {label}
    </span>
  );
}

function BoolBadge({ value, labelTrue = "Sim", labelFalse = "Não" }: { value?: boolean; labelTrue?: string; labelFalse?: string }) {
  if (value === undefined) return <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>—</span>;
  return value
    ? <Badge label={labelTrue} color={GREEN} bg="rgba(16,185,129,0.12)" />
    : <Badge label={labelFalse} color={RED} bg="rgba(239,68,68,0.1)" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ fontSize: "0.72rem", color: "white" }}>{children}</div>
    </div>
  );
}

function EditInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 outline-none"
      style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
    />
  );
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 outline-none"
      style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

/* ─── Helpers de upload para Supabase Storage ─── */
async function uploadToStorage(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) { console.error("Upload error", error); return null; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ─── Ambientes e categorias de mídia ─── */
const AMBIENTES_MEDIA = [
  "Sala", "Quarto", "Cozinha", "Banheiro", "Lavabo", "Varanda", "Sacada",
  "Closet", "Escritório", "Hall", "Área de Lazer", "Área de Serviço",
  "Garagem", "Área Externa", "Terraço", "Suíte",
];
const CATEGORIAS_MEDIA = ["Antes", "Depois", "Vistoria", "Entrega", "Geral"];

/* ─── TABS ─── */
const TABS = [
  { id: "overview", label: "Visão Geral", icon: Building2 },
  { id: "gates", label: "Gates & Fluxo", icon: GitBranch },
  { id: "checklist", label: "Checklist", icon: ClipboardList },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "orcamentos", label: "Propostas", icon: FileText },
  { id: "materiais", label: "Levantamento", icon: Package },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "handoffs", label: "Handoffs", icon: ArrowLeft },
  { id: "cronograma", label: "Acompanhamento de Obra", icon: TrendingUp },
  { id: "agendamentos", label: "Agendamentos", icon: Calendar },
  { id: "relatorios", label: "Relatórios", icon: ClipboardList },
  { id: "setores", label: "Por Setor", icon: TrendingUp },
  { id: "historico", label: "Histórico", icon: History },
  { id: "contratos", label: "Contratos", icon: FileText },
  { id: "documentos", label: "Documentos", icon: Paperclip },
  { id: "drive", label: "Drive", icon: FolderOpen },
  { id: "comercial", label: "Dados Comercial", icon: User },
  { id: "whatsapp_cliente", label: "WhatsApp Cliente", icon: MessageCircle },
  { id: "chat", label: "Chat Interno", icon: MessageSquare },
  { id: "ia", label: "Análise IA", icon: Bot },
  { id: "alertas", label: "Alertas", icon: Bell },
] as const;

type TabId = typeof TABS[number]["id"];

/* ════════════════════════════════════════════════════════════
   SEÇÕES
   ════════════════════════════════════════════════════════════ */

/* ── Visão Geral ── */
function TabOverview({ card, details, editing, onDetailsChange }: {
  card: DbCard; details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const statusColor = details.status_projeto === "concluido" ? GREEN : details.status_projeto === "em andamento" ? BLUE : YELLOW;
  const icamentoColor = details.icamento === "sim" ? GREEN : details.icamento === "nao" ? RED : YELLOW;

  return (
    <div className="space-y-5">
      {/* Identificação */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Identificação</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código da Obra">
            {editing
              ? <EditInput value={card.obra ?? ""} onChange={() => {}} placeholder="PKT-XXX" />
              : <span style={{ color: ACCENT, fontWeight: 600 }}>{card.obra ?? "—"}</span>}
          </Field>
          <Field label="Cliente / Projeto">
            {editing
              ? <EditInput value={card.title} onChange={() => {}} placeholder="Nome do cliente" />
              : card.title}
          </Field>
          <Field label="Arquiteto Responsável">
            {editing
              ? <EditInput value={details.arquiteto ?? ""} onChange={v => onDetailsChange({ arquiteto: v })} placeholder="Nome do arquiteto" />
              : details.arquiteto ?? "—"}
          </Field>
          <Field label="Vendedor">
            {editing
              ? <EditInput value={details.vendedor ?? ""} onChange={v => onDetailsChange({ vendedor: v })} placeholder="Nome do vendedor" />
              : details.vendedor ?? "—"}
          </Field>
          <Field label="Serviços">
            {editing
              ? <EditInput value={toArr(details.servicos).join(", ")} onChange={v => onDetailsChange({ servicos: v.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Ex: Parquet, Deck, Marcenaria" />
              : toArr(details.servicos).length > 0
                ? <div className="flex flex-wrap gap-1">{toArr(details.servicos).map(s => <Badge key={s} label={s} color={ACCENT} bg="rgba(212,168,83,0.1)" />)}</div>
                : "—"}
          </Field>
          <Field label="Marcenaria">
            {editing
              ? <EditSelect value={String(details.marcenaria ?? "")} onChange={v => onDetailsChange({ marcenaria: v === "true" })} options={[{ value: "", label: "—" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />
              : <BoolBadge value={details.marcenaria} />}
          </Field>
        </div>
      </SectionCard>

      {/* Localização & Contato */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Localização & Contato</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Endereço">
            {editing
              ? <EditInput value={details.endereco ?? ""} onChange={v => onDetailsChange({ endereco: v })} placeholder="Rua, número, bairro" />
              : <span className="flex items-center gap-1"><MapPin size={10} style={{ color: ACCENT }} />{details.endereco ?? "—"}</span>}
          </Field>
          <Field label="Estado">
            {editing
              ? <EditSelect value={details.estado ?? ""} onChange={v => onDetailsChange({ estado: v })} options={[
                { value: "", label: "—" }, { value: "SP", label: "SP" }, { value: "RJ", label: "RJ" },
                { value: "DF", label: "DF" }, { value: "MG", label: "MG" }, { value: "BA", label: "BA" },
                { value: "MT", label: "MT" }, { value: "GO", label: "GO" }, { value: "RS", label: "RS" },
                { value: "PR", label: "PR" }, { value: "PY", label: "PY" },
              ]} />
              : details.estado ?? "—"}
          </Field>
          <Field label="Contato Responsável pela Obra">
            {editing
              ? <EditInput value={details.contato_responsavel ?? ""} onChange={v => onDetailsChange({ contato_responsavel: v })} placeholder="+55 11 99999-9999" />
              : <span className="flex items-center gap-1"><Phone size={10} style={{ color: ACCENT }} />{details.contato_responsavel ?? "—"}</span>}
          </Field>
          <Field label="Grupo WhatsApp">
            {editing
              ? <EditInput value={details.grupo_whatsapp ?? ""} onChange={v => onDetailsChange({ grupo_whatsapp: v })} placeholder="Link do grupo" />
              : details.grupo_whatsapp
                ? <a href={details.grupo_whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: GREEN }}>
                    <MessageCircle size={10} />Abrir grupo
                  </a>
                : "—"}
          </Field>
        </div>
      </SectionCard>

      {/* Datas & Status */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Datas & Status</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Previsão de Início">
            {editing
              ? <EditInput type="date" value={details.previsao_inicio ?? ""} onChange={v => onDetailsChange({ previsao_inicio: v })} />
              : details.previsao_inicio
                ? <span className="flex items-center gap-1"><Calendar size={10} style={{ color: ACCENT }} />{details.previsao_inicio}</span>
                : "—"}
          </Field>
          <Field label="Prazo em Dias Úteis">
            {editing
              ? <EditInput type="number" value={details.prazo_dias_uteis != null ? String(details.prazo_dias_uteis) : ""} onChange={v => onDetailsChange({ prazo_dias_uteis: v ? Number(v) : undefined })} placeholder="Ex: 15" />
              : (() => {
                  const du = details.prazo_dias_uteis;
                  const ini = details.previsao_inicio;
                  if (!du) return "—";
                  if (!ini) return <span style={{ color: ACCENT }}>{du} d.u.</span>;
                  // calcula entrega em dias úteis
                  const d = new Date(ini + "T12:00:00");
                  let added = 0;
                  while (added < du) {
                    d.setDate(d.getDate() + 1);
                    const dow = d.getDay();
                    if (dow !== 0 && dow !== 6) added++;
                  }
                  const hoje = new Date(); hoje.setHours(0,0,0,0);
                  d.setHours(0,0,0,0);
                  const atrasado = d < hoje;
                  let restantes = 0;
                  const tmp = new Date(hoje);
                  while (tmp < d) { tmp.setDate(tmp.getDate()+1); if(tmp.getDay()!==0&&tmp.getDay()!==6) restantes++; }
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span style={{ fontSize: "0.7rem", color: atrasado ? RED : GREEN, fontWeight: 600 }}>
                        Entrega: {d.toLocaleDateString("pt-BR")}
                      </span>
                      <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>
                        {du} d.u. · {atrasado ? "⚠ Vencido" : `${restantes} d.u. restantes`}
                      </span>
                    </div>
                  );
                })()}
          </Field>
          <Field label="Prazo Contratual">
            {editing
              ? <EditInput type="date" value={details.prazo_contratual ?? ""} onChange={v => onDetailsChange({ prazo_contratual: v })} />
              : details.prazo_contratual
                ? <span className="flex items-center gap-1"><Clock size={10} style={{ color: YELLOW }} />{details.prazo_contratual}</span>
                : "—"}
          </Field>
          <Field label="Medição">
            {editing
              ? <EditInput value={details.medicao ?? ""} onChange={v => onDetailsChange({ medicao: v })} placeholder="Data ou pendente" />
              : details.medicao ?? "—"}
          </Field>
          <Field label="Status do Projeto">
            {editing
              ? <EditSelect value={details.status_projeto ?? ""} onChange={v => onDetailsChange({ status_projeto: v as any })} options={[
                { value: "", label: "—" }, { value: "a iniciar", label: "A Iniciar" },
                { value: "em andamento", label: "Em Andamento" }, { value: "concluido", label: "Concluído" },
              ]} />
              : details.status_projeto
                ? <Badge label={details.status_projeto} color={statusColor} bg={`${statusColor}15`} />
                : "—"}
          </Field>
          <Field label="Gate Atual (Setor com o projeto)">
            {editing
              ? <EditInput value={details.gate_atual ?? ""} onChange={v => onDetailsChange({ gate_atual: v })} placeholder="Ex: Projetos, Compras..." />
              : details.gate_atual
                ? <Badge label={details.gate_atual} color={GOLD} bg="rgba(212,168,83,0.12)" />
                : card.gate !== undefined ? <Badge label={`Gate ${card.gate}`} color={GOLD} bg="rgba(212,168,83,0.12)" /> : "—"}
          </Field>
          <Field label="Gate (Número)">
            <Badge label={`Gate ${card.gate ?? "—"}`} color={GOLD} bg="rgba(212,168,83,0.1)" />
          </Field>
        </div>
      </SectionCard>

      {/* Fiscal & Entregas */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Fiscal & Entregas</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fiscal Responsável">
            {editing
              ? <EditInput value={details.fiscal_responsavel ?? ""} onChange={v => onDetailsChange({ fiscal_responsavel: v })} placeholder="Nome do fiscal" />
              : details.fiscal_responsavel ?? "—"}
          </Field>
          <Field label="Içamento">
            {editing
              ? <EditSelect value={details.icamento ?? ""} onChange={v => onDetailsChange({ icamento: v as any })} options={[
                { value: "", label: "—" }, { value: "sim", label: "Sim" },
                { value: "nao", label: "Não" }, { value: "a confirmar", label: "A Confirmar" },
              ]} />
              : details.icamento
                ? <Badge label={details.icamento} color={icamentoColor} bg={`${icamentoColor}15`} />
                : "—"}
          </Field>
          <Field label="1ª Vistoria Realizada">
            {editing
              ? <EditSelect value={String(details.primeira_vistoria ?? "")} onChange={v => onDetailsChange({ primeira_vistoria: v === "true" })} options={[{ value: "", label: "—" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />
              : <BoolBadge value={details.primeira_vistoria} />}
          </Field>
          <Field label="Material Entregue">
            {editing
              ? <EditSelect value={String(details.material_entregue ?? "")} onChange={v => onDetailsChange({ material_entregue: v === "true" })} options={[{ value: "", label: "—" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />
              : <BoolBadge value={details.material_entregue} />}
          </Field>
          <Field label="2ª Vistoria Realizada">
            {editing
              ? <EditSelect value={String(details.segunda_vistoria ?? "")} onChange={v => onDetailsChange({ segunda_vistoria: v === "true" })} options={[{ value: "", label: "—" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />
              : <BoolBadge value={details.segunda_vistoria} />}
          </Field>
          <Field label="Projeto Entregue">
            {editing
              ? <EditSelect value={String(details.projeto_entregue ?? "")} onChange={v => onDetailsChange({ projeto_entregue: v === "true" })} options={[{ value: "", label: "—" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />
              : <BoolBadge value={details.projeto_entregue} />}
          </Field>
        </div>
      </SectionCard>

      {/* Observações */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Observações</p>
        {editing
          ? <textarea
              value={details.observacoes ?? ""}
              onChange={e => onDetailsChange({ observacoes: e.target.value })}
              placeholder="Observações gerais sobre o projeto..."
              rows={4}
              className="w-full rounded-lg px-3 py-2 outline-none resize-none"
              style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
            />
          : <p style={{ fontSize: "0.72rem", color: TEXT_MED, lineHeight: 1.7 }}>{details.observacoes || "Sem observações."}</p>}
      </SectionCard>
    </div>
  );
}

/* ── Gates & Fluxo ── */
function TabGates({ card, editing }: { card: DbCard; editing: boolean }) {
  const gates: GateStep[] = card.gates_data ?? [
    { gate: 1, label: "Comercial — Contrato assinado", status: "done", responsible: "Comercial" },
    { gate: 2, label: "Projetos — Projeto executivo aprovado", status: "current", responsible: "Projetos" },
    { gate: 3, label: "Compras — BOM e POs emitidas", status: "pending", responsible: "Compras" },
    { gate: 4, label: "Logística — Material entregue na obra", status: "pending", responsible: "Logística" },
    { gate: 5, label: "Obras — Execução concluída", status: "pending", responsible: "Obras" },
    { gate: 6, label: "Fiscal — Vistorias realizadas", status: "pending", responsible: "Fiscal" },
    { gate: 7, label: "Financeiro — Medição e cobrança", status: "pending", responsible: "Financeiro" },
  ];
  const gateColor = (s: GateStep["status"]) =>
    s === "done" ? GREEN : s === "current" ? BLUE : s === "blocked" ? RED : TEXT_DIM;
  return (
    <div className="space-y-5">
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Fluxo de Gates por Setor</p>
        <div className="space-y-3">
          {gates.map((g, i) => {
            const c = gateColor(g.status);
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${c}20`, border: `1px solid ${c}40` }}>
                  {g.status === "done" ? <Check size={14} style={{ color: c }} />
                    : g.status === "current" ? <CircleDot size={14} style={{ color: c }} />
                    : g.status === "blocked" ? <AlertTriangle size={14} style={{ color: c }} />
                    : <span style={{ fontSize: "0.6rem", color: c, fontWeight: 700 }}>{g.gate}</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize: "0.72rem", color: g.status === "pending" ? TEXT_MED : "white", fontWeight: g.status === "current" ? 600 : 400 }}>{g.label}</p>
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${c}15`, color: c }}>{g.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {g.responsible && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{g.responsible}</span>}
                    {g.date && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{g.date}</span>}
                  </div>
                </div>
                {i < gates.length - 1 && (
                  <div className="absolute" style={{ left: "2.55rem", marginTop: "2rem", width: "1px", height: "1.5rem", background: `${c}20` }} />
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Progresso Geral</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{
              width: `${Math.round((gates.filter(g => g.status === "done").length / gates.length) * 100)}%`,
              background: `linear-gradient(90deg, ${GREEN}, ${TEAL})`
            }} />
          </div>
          <span style={{ fontSize: "0.65rem", color: GREEN, fontWeight: 600 }}>
            {Math.round((gates.filter(g => g.status === "done").length / gates.length) * 100)}%
          </span>
        </div>
        <p className="mt-2" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>
          {gates.filter(g => g.status === "done").length} de {gates.length} gates concluídos
        </p>
      </SectionCard>
    </div>
  );
}

// Circular dot icon
function CircleDot({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

/* ── Checklist por Setor ── */
function TabChecklist({ card }: { card: DbCard }) {
  const items = card.checklist_items ?? [];
  const [local, setLocal] = useState(items.map(i => ({ ...i })));
  const total = local.length;
  const done = local.filter(i => i.done).length;

  const toggle = async (idx: number) => {
    const updated = local.map((item, i) => i === idx ? { ...item, done: !item.done } : item);
    setLocal(updated);
    await supabase.from("kanban_cards").update({ checklist_items: updated }).eq("id", card.id);
  };

  if (local.length === 0) return (
    <SectionCard>
      <p style={{ fontSize: "0.72rem", color: TEXT_DIM, textAlign: "center", padding: "2rem 0" }}>
        Nenhum item de checklist cadastrado para este projeto.
      </p>
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Checklist do Projeto</p>
          <span style={{ fontSize: "0.65rem", color: done === total ? GREEN : ACCENT, fontWeight: 600 }}>{done}/{total}</span>
        </div>
        <div className="w-full h-1.5 rounded-full mb-4" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%`, background: GREEN }} />
        </div>
        <div className="space-y-2">
          {local.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors" onClick={() => toggle(i)}>
              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{
                background: item.done ? `${GREEN}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${item.done ? GREEN : BORDER}`,
              }}>
                {item.done && <Check size={10} style={{ color: GREEN }} />}
              </div>
              <span style={{ fontSize: "0.7rem", color: item.done ? TEXT_DIM : TEXT_MED, textDecoration: item.done ? "line-through" : "none" }}>
                {item.item}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Financeiro ── */
function TabFinanceiro({ card }: { card: DbCard }) {
  const fin = card.financeiro_data;
  if (!fin) return (
    <SectionCard>
      <p style={{ fontSize: "0.72rem", color: TEXT_DIM, textAlign: "center", padding: "2rem 0" }}>
        Nenhum dado financeiro registrado para este projeto.
      </p>
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Valor do Contrato", value: fin.valorContrato, color: ACCENT },
          { label: "Orçado", value: fin.orcado, color: BLUE },
          { label: "Realizado", value: fin.realizado, color: PURPLE },
          { label: "Margem Orçada", value: fin.margemOrc, color: GREEN },
          { label: "Margem Real", value: fin.margemReal, color: fin.margemReal && fin.margemOrc && parseFloat(fin.margemReal) < parseFloat(fin.margemOrc) ? RED : GREEN },
        ].map(m => (
          <SectionCard key={m.label} className="text-center">
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>{m.label}</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: m.color }}>{m.value ?? "—"}</p>
          </SectionCard>
        ))}
      </div>

      {/* Parcelas */}
      {fin.parcelas && fin.parcelas.length > 0 && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Parcelas & Vencimentos</p>
          <div className="space-y-2">
            {fin.parcelas.map(p => {
              const sc = p.status === "pago" ? GREEN : p.status === "vencido" ? RED : YELLOW;
              return (
                <div key={p.num} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 600, color: ACCENT, width: 24 }}>#{p.num}</span>
                  <span style={{ fontSize: "0.72rem", color: "white", fontWeight: 500 }}>{p.valor}</span>
                  <span className="flex-1" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{p.venc}</span>
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{p.status}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Custos */}
      {fin.custos && fin.custos.length > 0 && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Distribuição de Custos</p>
          <div className="space-y-3">
            {fin.custos.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span style={{ fontSize: "0.65rem", color: TEXT_MED, width: 120 }}>{c.cat}</span>
                <div className="flex-1 h-5 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-full rounded flex items-center px-2" style={{ width: `${Math.min(c.perc, 100)}%`, background: "rgba(212,168,83,0.15)", minWidth: 40 }}>
                    <span style={{ fontSize: "0.5rem", color: ACCENT, fontWeight: 600 }}>{c.perc}%</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.65rem", color: ACCENT, fontWeight: 600, width: 60, textAlign: "right" }}>{c.valor}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ── Orçamentos (Simulações vinculadas) ── */
const SIM_STATUS_OPTIONS = [
  { value: "rascunho",  label: "Rascunho",  color: YELLOW },
  { value: "enviada",   label: "Enviada",   color: BLUE },
  { value: "aprovada",  label: "Aprovado",  color: GREEN },
  { value: "revisao",   label: "Revisão",   color: ORANGE },
  { value: "ganhado",   label: "Ganhado",   color: TEAL },
  { value: "perdida",   label: "Perdido",   color: RED },
];

function simStatusColor(s: string) { return SIM_STATUS_OPTIONS.find(o => o.value === s)?.color ?? YELLOW; }
function simStatusLabel(s: string) { return SIM_STATUS_OPTIONS.find(o => o.value === s)?.label ?? s; }

function TabOrcamentos({ card }: { card: DbCard }) {
  const [simulacoes, setSimulacoes] = useState<SimulacaoProjeto[]>([]);
  const [itensMap, setItensMap] = useState<Record<string, SimulacaoItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("simulacao_projetos")
      .select("*")
      .eq("obra_id", card.id)
      .order("created_at", { ascending: false });
    setSimulacoes((data as SimulacaoProjeto[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [card.id]);

  async function carregarItens(simId: string) {
    if (itensMap[simId]) return itensMap[simId];
    const { data } = await supabase
      .from("simulacao_itens").select("*").eq("simulacao_id", simId).order("ordem");
    const itens = (data as SimulacaoItem[]) ?? [];
    setItensMap(prev => ({ ...prev, [simId]: itens }));
    return itens;
  }

  async function registrarMovimento(sim: SimulacaoProjeto, fromCol: string, toCol: string, notes: string) {
    await supabase.from("card_movements").insert({
      card_id: card.id, gate: 0,
      from_dept: "Orçamento", from_column: fromCol,
      to_dept: "Orçamento", to_column: toCol,
      moved_by: "Orçamento", notes,
    });
  }

  async function handleGerar(sim: SimulacaoProjeto) {
    setGerandoId(sim.id);
    const itens = await carregarItens(sim.id);
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const totalFinal = total - total * (sim.desconto_perc / 100);
    abrirPropostaParaImpressao(sim, itens);
    await registrarMovimento(sim, sim.status, "proposta_gerada",
      `Proposta${sim.numero ? " #" + sim.numero : ""} gerada — ${sim.cliente} | Total: ${totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    setGerandoId(null);
  }

  async function handleAtualizarStatus(sim: SimulacaoProjeto, novoStatus: string) {
    await supabase.from("simulacao_projetos").update({ status: novoStatus }).eq("id", sim.id);
    await registrarMovimento(sim, sim.status, novoStatus,
      `Proposta${sim.numero ? " #" + sim.numero : ""} — status: "${simStatusLabel(sim.status)}" → "${simStatusLabel(novoStatus)}" | ${sim.cliente}`);
    setSimulacoes(prev => prev.map(s => s.id === sim.id ? { ...s, status: novoStatus as any } : s));
    setStatusOpen(null);
  }

  if (loading) return (
    <SectionCard>
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
        <span style={{ fontSize: "0.72rem", color: TEXT_DIM }}>Carregando propostas...</span>
      </div>
    </SectionCard>
  );

  if (simulacoes.length === 0) return (
    <SectionCard>
      <div className="flex flex-col items-center gap-3 py-10">
        <FileText size={28} style={{ color: TEXT_DIM }} />
        <p style={{ fontSize: "0.72rem", color: TEXT_DIM, textAlign: "center" }}>
          Nenhuma proposta vinculada a este projeto ainda.
        </p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>
          Acesse <strong style={{ color: ACCENT }}>Orçamento → Simulação</strong>, crie uma simulação e selecione este projeto.
        </p>
      </div>
    </SectionCard>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>
          Propostas comerciais
        </p>
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${ACCENT}15`, color: ACCENT }}>
          {simulacoes.length} {simulacoes.length === 1 ? "proposta" : "propostas"}
        </span>
      </div>
      {simulacoes.map(sim => {
        const sc = simStatusColor(sim.status);
        const itens = itensMap[sim.id] ?? [];
        const total = itens.reduce((s, i) => s + i.valor, 0);
        const totalFinal = total > 0 ? total - total * (sim.desconto_perc / 100) : null;
        return (
          <div key={sim.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            {/* Linha principal */}
            <div className="flex items-start gap-3 flex-wrap">
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {sim.numero && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: ACCENT }}>Proposta #{sim.numero}</span>}
                  <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{sim.obra_code}</span>
                  {/* Badge de status clicável */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setStatusOpen(statusOpen === sim.id ? null : sim.id)}
                      style={{
                        fontSize: "0.45rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                        background: `${sc}18`, color: sc, border: `1px solid ${sc}40`,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}
                    >
                      {simStatusLabel(sim.status)} ▾
                    </button>
                    {statusOpen === sim.id && (
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
                          background: "#1a1a1a", border: `1px solid rgba(255,255,255,0.1)`,
                          borderRadius: 10, padding: 4, minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        }}
                        onMouseLeave={() => setStatusOpen(null)}
                      >
                        {SIM_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleAtualizarStatus(sim, opt.value)}
                            style={{
                              display: "flex", alignItems: "center", gap: 7, width: "100%",
                              padding: "6px 9px", borderRadius: 7, border: "none",
                              background: sim.status === opt.value ? `${opt.color}18` : "transparent",
                              color: sim.status === opt.value ? opt.color : TEXT_MED,
                              cursor: "pointer", fontSize: "0.6rem",
                              fontWeight: sim.status === opt.value ? 700 : 400,
                              textAlign: "left",
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: opt.color, display: "inline-block", flexShrink: 0 }} />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "white" }}>{sim.cliente || "—"}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {sim.vendedor && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Vend: <span style={{ color: TEXT_MED }}>{sim.vendedor}</span></span>}
                  {sim.arquiteto && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Arq: <span style={{ color: TEXT_MED }}>{sim.arquiteto}</span></span>}
                  {sim.desconto_perc > 0 && <span style={{ fontSize: "0.55rem", color: ORANGE }}>{sim.desconto_perc}% desc</span>}
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{new Date(sim.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {sim.forma_pagamento && (
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4 }}>Pagamento: <span style={{ color: TEXT_MED }}>{sim.forma_pagamento}</span></p>
                )}
              </div>

              {/* Totais + ações */}
              <div className="flex flex-col gap-1.5 items-end">
                {totalFinal !== null && (
                  <div style={{ textAlign: "right", marginBottom: 4 }}>
                    <div style={{ fontSize: "0.5rem", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: GREEN }}>
                      {totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    {itens.length > 0 && <div style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</div>}
                  </div>
                )}
                <button
                  onClick={() => handleGerar(sim)}
                  disabled={gerandoId === sim.id}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all"
                  style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, color: ACCENT, fontSize: "0.6rem", fontWeight: 600, whiteSpace: "nowrap" }}
                  onMouseEnter={() => !itensMap[sim.id] && carregarItens(sim.id)}
                >
                  {gerandoId === sim.id ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                  Gerar PDF
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Materiais ── */
function TabMateriais({ card, details, editing, onDetailsChange }: {
  card: DbCard; details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const mats = details.materiais ?? [];
  const [newMat, setNewMat] = useState({ item: "", qtd: "", unidade: "m²", status: "pendente", valor: "" });
  const [adding, setAdding] = useState(false);

  const add = () => {
    if (!newMat.item) return;
    onDetailsChange({ materiais: [...mats, { ...newMat }] });
    setNewMat({ item: "", qtd: "", unidade: "m²", status: "pendente", valor: "" });
    setAdding(false);
  };

  const remove = (i: number) => onDetailsChange({ materiais: mats.filter((_, idx) => idx !== i) });

  const statusColor = (s: string) => s === "entregue" ? GREEN : s === "em transito" ? BLUE : s === "comprado" ? PURPLE : YELLOW;

  /* Solicitações de compras vinculadas */
  const solicits = ((card.details as Record<string, unknown>)?.solicitacoes_compras as Array<Record<string, unknown>>) ?? [];
  const solicStatusColor = (s: string) => s === "aceito" ? GREEN : s === "rejeitado" ? RED : YELLOW;
  const solicStatusLabel = (s: string) => s === "aceito" ? "Aceito" : s === "rejeitado" ? "Rejeitado" : "Pendente";

  // Levantamento de itens
  const levantamento = details.levantamento_itens ?? { servicos: [] };
  const [levServicos, setLevServicos] = useState(levantamento.servicos);
  const [addingServico, setAddingServico] = useState(false);
  const [newServico, setNewServico] = useState({ servico: "", quantidade: 0, unidade: "m²", ambiente: "", observacao: "" });

  const addServico = () => {
    if (!newServico.servico) return;
    const updated = [...levServicos, { ...newServico }];
    setLevServicos(updated);
    onDetailsChange({ levantamento_itens: { servicos: updated } });
    setNewServico({ servico: "", quantidade: 0, unidade: "m²", ambiente: "", observacao: "" });
    setAddingServico(false);
  };

  const removeServico = (i: number) => {
    const updated = levServicos.filter((_, idx) => idx !== i);
    setLevServicos(updated);
    onDetailsChange({ levantamento_itens: { servicos: updated } });
  };

  return (
    <div className="space-y-4">
      {/* Levantamento de Itens */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Levantamento de Itens</p>
          {editing && (
            <button onClick={() => setAddingServico(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
              <Plus size={10} />+ Serviço
            </button>
          )}
        </div>

        {addingServico && (
          <div className="rounded-xl p-3 mb-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-2 gap-2">
              <EditInput value={newServico.servico} onChange={v => setNewServico(s => ({ ...s, servico: v }))} placeholder="Selecionar serviço..." />
              <EditInput type="number" value={String(newServico.quantidade || "")} onChange={v => setNewServico(s => ({ ...s, quantidade: Number(v) || 0 }))} placeholder="Quantidade" />
              <EditSelect value={newServico.unidade} onChange={v => setNewServico(s => ({ ...s, unidade: v }))} options={[
                { value: "m²", label: "m²" }, { value: "m", label: "m linear" }, { value: "un", label: "unidade" }, { value: "pç", label: "peça" },
              ]} />
              <EditInput value={newServico.ambiente} onChange={v => setNewServico(s => ({ ...s, ambiente: v }))} placeholder="Ambiente" />
            </div>
            <div className="flex gap-2">
              <button onClick={addServico} className="flex-1 rounded-lg py-1.5" style={{ fontSize: "0.6rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>Salvar</button>
              <button onClick={() => setAddingServico(false)} className="rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {levServicos.length === 0 ? (
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: "1rem 0" }}>
            Nenhum serviço levantado. {editing ? 'Clique em "+ Serviço" para adicionar.' : ""}
          </p>
        ) : (
          <div className="space-y-2">
            {levServicos.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <div className="flex-1">
                  <p style={{ fontSize: "0.7rem", color: "white", fontWeight: 500 }}>{s.servico}</p>
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
                    {s.quantidade} {s.unidade}{s.ambiente ? ` · ${s.ambiente}` : ""}
                  </p>
                  {s.observacao && <p style={{ fontSize: "0.55rem", color: TEXT_MED }}>{s.observacao}</p>}
                </div>
                {editing && <button onClick={() => removeServico(i)} style={{ color: RED, cursor: "pointer" }}><Trash2 size={11} /></button>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Solicitações de compras */}
      {solicits.length > 0 && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>
            Solicitações de Compras ({solicits.length})
          </p>
          <div className="space-y-3">
            {solicits.map((s, i) => {
              const mats = (s.materiais as Array<{ tipo: string; quantidade?: string; justificativa?: string }>) ?? [];
              const sc = solicStatusColor(s.status as string);
              const sl = solicStatusLabel(s.status as string);
              const dataSolic = s.data ? new Date(s.data as string).toLocaleDateString("pt-BR") : "";
              const prazo = s.prazo ? new Date(s.prazo as string).toLocaleDateString("pt-BR") : "";
              return (
                <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.07)` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "white" }}>Solicitação #{i + 1}</p>
                      <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>
                        Por <span style={{ color: ACCENT }}>{s.solicitante as string}</span>
                        {dataSolic && ` · ${dataSolic}`}
                        {prazo && ` · Prazo: ${prazo}`}
                      </p>
                    </div>
                    <span className="rounded-full px-2.5 py-1" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${sc}15`, color: sc, border: `1px solid ${sc}30` }}>{sl}</span>
                  </div>
                  {mats.length > 0 && (
                    <div className="space-y-1.5">
                      {mats.map((m, j) => (
                        <div key={j} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <Package size={10} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span style={{ fontSize: "0.65rem", color: "white", fontWeight: 500 }}>{m.tipo}</span>
                              {m.quantidade && <span style={{ fontSize: "0.55rem", color: ACCENT }}>{m.quantidade}</span>}
                            </div>
                            {m.justificativa && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>{m.justificativa}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(s.motivo as string) && s.status === "rejeitado" && (
                    <p style={{ fontSize: "0.58rem", color: RED, marginTop: 8, padding: "6px 10px", background: "rgba(239,68,68,0.06)", borderRadius: 6 }}>
                      Motivo da rejeição: {s.motivo as string}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Lista de Materiais</p>
          {editing && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
              <Plus size={10} />Adicionar
            </button>
          )}
        </div>

        {adding && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-2 gap-3">
              <EditInput value={newMat.item} onChange={v => setNewMat(s => ({ ...s, item: v }))} placeholder="Descrição do material" />
              <EditInput value={newMat.qtd} onChange={v => setNewMat(s => ({ ...s, qtd: v }))} placeholder="Quantidade" />
              <EditSelect value={newMat.unidade} onChange={v => setNewMat(s => ({ ...s, unidade: v }))} options={[
                { value: "m²", label: "m²" }, { value: "m³", label: "m³" }, { value: "un", label: "un" },
                { value: "kg", label: "kg" }, { value: "cx", label: "caixa" }, { value: "pç", label: "peça" },
              ]} />
              <EditSelect value={newMat.status} onChange={v => setNewMat(s => ({ ...s, status: v }))} options={[
                { value: "pendente", label: "Pendente" }, { value: "comprado", label: "Comprado" },
                { value: "em transito", label: "Em Trânsito" }, { value: "entregue", label: "Entregue" },
              ]} />
              <EditInput value={newMat.valor} onChange={v => setNewMat(s => ({ ...s, valor: v }))} placeholder="Valor (ex: R$ 1.200)" />
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex-1 rounded-lg py-2" style={{ fontSize: "0.65rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>Salvar Material</button>
              <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {mats.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1.5rem 0" }}>Nenhum material cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {mats.map((m, i) => {
              const sc = statusColor(m.status);
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <Package size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.7rem", color: "white", flex: 1 }}>{m.item}</span>
                  <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{m.qtd} {m.unidade}</span>
                  {m.valor && <span style={{ fontSize: "0.65rem", color: ACCENT, fontWeight: 600 }}>{m.valor}</span>}
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{m.status}</span>
                  {editing && <button onClick={() => remove(i)} style={{ color: RED, cursor: "pointer" }}><Trash2 size={12} /></button>}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Equipe ── */
function TabEquipe({ card, details, editing, onDetailsChange }: {
  card: DbCard; details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const equipe = details.equipe ?? [];
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState({ nome: "", funcao: "", desde: "", contato: "" });

  const add = () => {
    if (!newMember.nome) return;
    onDetailsChange({ equipe: [...equipe, { ...newMember }] });
    setNewMember({ nome: "", funcao: "", desde: "", contato: "" });
    setAdding(false);
  };

  const remove = (i: number) => onDetailsChange({ equipe: equipe.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Equipe Alocada</p>
          {editing && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
              <Plus size={10} />Adicionar
            </button>
          )}
        </div>

        {adding && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-2 gap-3">
              <EditInput value={newMember.nome} onChange={v => setNewMember(s => ({ ...s, nome: v }))} placeholder="Nome" />
              <EditInput value={newMember.funcao} onChange={v => setNewMember(s => ({ ...s, funcao: v }))} placeholder="Função / Cargo" />
              <EditInput value={newMember.contato} onChange={v => setNewMember(s => ({ ...s, contato: v }))} placeholder="Contato" />
              <EditInput type="date" value={newMember.desde} onChange={v => setNewMember(s => ({ ...s, desde: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex-1 rounded-lg py-2" style={{ fontSize: "0.65rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>Salvar</button>
              <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {equipe.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1.5rem 0" }}>Nenhum membro cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {equipe.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}20`, fontSize: "0.6rem", fontWeight: 700, color: ACCENT }}>
                  {m.nome.charAt(0)}
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: "0.72rem", color: "white", fontWeight: 500 }}>{m.nome}</p>
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{m.funcao}{m.desde ? ` — desde ${m.desde}` : ""}</p>
                </div>
                {m.contato && <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{m.contato}</span>}
                {editing && <button onClick={() => remove(i)} style={{ color: RED, cursor: "pointer" }}><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Equipe de Obras / Campo */}
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ORANGE }}>Equipe de Obras (Campo)</p>
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <EditInput value={details.equipe_obras?.nome ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, nome: v, lider: details.equipe_obras?.lider ?? "" } })} placeholder="Nome da equipe (ex: Equipe Alpha)" />
            <EditInput value={details.equipe_obras?.lider ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, lider: v, nome: details.equipe_obras?.nome ?? "" } })} placeholder="Líder da equipe" />
            <EditInput value={details.equipe_obras?.contato ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, contato: v, nome: details.equipe_obras?.nome ?? "", lider: details.equipe_obras?.lider ?? "" } })} placeholder="Contato / WhatsApp" />
            <EditInput type="date" value={details.equipe_obras?.data_entrada ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, data_entrada: v, nome: details.equipe_obras?.nome ?? "", lider: details.equipe_obras?.lider ?? "" } })} />
            <EditInput value={details.equipe_obras?.data_saida ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, data_saida: v, nome: details.equipe_obras?.nome ?? "", lider: details.equipe_obras?.lider ?? "" } })} placeholder="Data prevista de saída" />
            <EditInput value={details.equipe_obras?.observacao ?? ""} onChange={v => onDetailsChange({ equipe_obras: { ...details.equipe_obras, observacao: v, nome: details.equipe_obras?.nome ?? "", lider: details.equipe_obras?.lider ?? "" } })} placeholder="Observação" />
          </div>
        ) : details.equipe_obras?.nome ? (
          <div className="flex items-center gap-4 p-3 rounded-lg" style={{ background: `${ORANGE}08`, border: `1px solid ${ORANGE}20` }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${ORANGE}20`, fontSize: "0.65rem", fontWeight: 700, color: ORANGE }}>
              {details.equipe_obras.nome.charAt(0)}
            </div>
            <div className="flex-1">
              <p style={{ fontSize: "0.75rem", color: "white", fontWeight: 600 }}>{details.equipe_obras.nome}</p>
              <p style={{ fontSize: "0.62rem", color: TEXT_DIM }}>Líder: {details.equipe_obras.lider}{details.equipe_obras.contato ? ` · ${details.equipe_obras.contato}` : ""}</p>
              {details.equipe_obras.data_entrada && <p style={{ fontSize: "0.58rem", color: TEXT_DIM }}>Entrada: {details.equipe_obras.data_entrada}{details.equipe_obras.data_saida ? ` · Saída prev.: ${details.equipe_obras.data_saida}` : ""}</p>}
              {details.equipe_obras.observacao && <p style={{ fontSize: "0.6rem", color: TEXT_MED, marginTop: 2 }}>{details.equipe_obras.observacao}</p>}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1rem 0" }}>Nenhuma equipe de campo alocada.</p>
        )}
      </SectionCard>

      {/* Prestadores / Equipes de Campo */}
      <PrestadoresSection card={card} details={details} editing={editing} onDetailsChange={onDetailsChange} />

      {/* RACI */}
      {card.raci_data && card.raci_data.length > 0 && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Responsabilidades por Etapa (RACI)</p>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["Atividade", "R (Executa)", "A (Aprova)", "C (Consulta)", "I (Informado)"].map(h => (
                    <th key={h} className="text-left pb-2" style={{ fontSize: "0.5rem", color: TEXT_DIM, paddingRight: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.raci_data.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                    <td className="py-2" style={{ fontSize: "0.65rem", color: "white", paddingRight: 12 }}>{r.atividade}</td>
                    <td className="py-2" style={{ fontSize: "0.65rem", color: GREEN, paddingRight: 12 }}>{r.r}</td>
                    <td className="py-2" style={{ fontSize: "0.65rem", color: BLUE, paddingRight: 12 }}>{r.a}</td>
                    <td className="py-2" style={{ fontSize: "0.65rem", color: YELLOW, paddingRight: 12 }}>{r.c}</td>
                    <td className="py-2" style={{ fontSize: "0.65rem", color: TEXT_MED, paddingRight: 12 }}>{r.i}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ── Handoffs histórico ── */
function TabHandoffs({ card }: { card: DbCard }) {
  const { handoffs, loading } = useHandoffs();
  const obraHandoffs = handoffs.filter(h => h.obra === card.obra || h.item?.includes(card.obra ?? "") || h.item?.includes(card.title));

  const localHandoffs: Array<{ from: string; to: string; item: string; status: string; date: string }> = card.handoffs_data?.map(h => ({
    from: h.from, to: h.to, item: h.item, status: h.status, date: h.date,
  })) ?? [];

  const allHandoffs = [
    ...obraHandoffs.map(h => ({ from: h.dept_from, to: h.dept_to, item: h.item, status: h.status, date: h.created_at?.split("T")[0] ?? "" })),
    ...localHandoffs,
  ];

  const statusColor = (s: string) => s === "aceito" || s === "done" ? GREEN : s === "pendente" || s === "current" ? YELLOW : s === "vencido" ? RED : TEXT_DIM;

  if (loading) return <SectionCard><div className="flex items-center gap-2 justify-center py-8"><Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} /><span style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Carregando...</span></div></SectionCard>;

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Histórico de Handoffs</p>
        {allHandoffs.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1.5rem 0" }}>Nenhum handoff registrado.</p>
        ) : (
          <div className="space-y-2">
            {allHandoffs.map((h, i) => {
              const sc = statusColor(h.status);
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: sc }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{h.from}</span>
                      <ChevronRight size={10} style={{ color: ACCENT }} />
                      <span style={{ fontSize: "0.65rem", color: "white", fontWeight: 600 }}>{h.to}</span>
                      <span className="ml-auto rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{h.status}</span>
                    </div>
                    <p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{h.item}</p>
                    {h.date && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>{h.date}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Histórico de Movimentações ── */
const DEPT_LABELS: Record<string, string> = {
  comercial: "Comercial", projetos: "Projetos", compras: "Compras",
  producao: "Produção", logistica: "Logística", obras: "Obras",
  atendimento: "Atendimento", fiscal: "Fiscal", produtividade: "PMO",
  financeiro: "Financeiro", orcamento: "Orçamento", rh: "RH", marketing: "Marketing",
};

function TabHistorico({ card }: { card: DbCard }) {
  const { movements, loading, tableExists } = useCardMovements(card.id);
  const deptLabel = (d: string) => DEPT_LABELS[d] ?? d;

  if (loading) return (
    <SectionCard>
      <div className="flex items-center gap-2 justify-center py-8">
        <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
        <span style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Carregando histórico...</span>
      </div>
    </SectionCard>
  );

  if (!tableExists) return (
    <SectionCard>
      <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Histórico de Movimentações</p>
      <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
        <p style={{ fontSize: "0.7rem", color: "#F59E0B", marginBottom: 6 }}>Tabela card_movements ainda não criada.</p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Execute a migração SQL no Supabase para ativar o histórico de movimentações.</p>
      </div>
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Histórico de Movimentações</p>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{movements.length} eventos</span>
        </div>
        {movements.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1.5rem 0" }}>
            Nenhuma movimentação registrada ainda.
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-[6px] top-3 bottom-3 w-px" style={{ background: `${BORDER}` }} />
            <div className="space-y-4">
              {movements.map((m, i) => {
                const isLast = i === movements.length - 1;
                const d = new Date(m.moved_at);
                const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                const dotColor = isLast ? ACCENT : GREEN;
                return (
                  <div key={m.id} className="flex items-start gap-4 pl-6 relative">
                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full flex items-center justify-center"
                      style={{ background: `${dotColor}20`, border: `1.5px solid ${dotColor}` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                    </div>
                    <div className="flex-1 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${ACCENT}18`, color: ACCENT }}>
                          Gate {m.gate}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: TEXT_MED, fontWeight: 500 }}>{deptLabel(m.from_dept)}</span>
                        <ChevronRight size={11} style={{ color: ACCENT }} />
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "white" }}>{deptLabel(m.to_dept)}</span>
                      </div>
                      <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 6 }}>
                        {m.from_column} → <span style={{ color: TEXT_MED }}>{m.to_column}</span>
                      </p>
                      <div className="flex items-center gap-3">
                        {m.moved_by && (
                          <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
                            Por <span style={{ color: TEXT_MED, fontWeight: 500 }}>{m.moved_by}</span>
                          </span>
                        )}
                        <span className="ml-auto" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{dateStr} · {timeStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Documentos ── */
function TabDocumentos({ details, editing, onDetailsChange }: {
  details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const docs = details.documentos ?? [];
  const [adding, setAdding] = useState(false);
  const [newDoc, setNewDoc] = useState({ nome: "", tipo: "outro", url: "", data: "" });

  const add = () => {
    if (!newDoc.nome || !newDoc.url) return;
    onDetailsChange({ documentos: [...docs, { ...newDoc }] });
    setNewDoc({ nome: "", tipo: "outro", url: "", data: "" });
    setAdding(false);
  };

  const remove = (i: number) => onDetailsChange({ documentos: docs.filter((_, idx) => idx !== i) });

  const tipoColor = (t: string) => t === "proposta" ? BLUE : t === "projeto" ? PURPLE : t === "contrato" ? GREEN : ACCENT;
  const tipoIcon = (t: string) => t === "proposta" ? DollarSign : t === "projeto" ? Wrench : FileText;

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Anexos & Documentos</p>
          {editing && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
              <Plus size={10} />Adicionar
            </button>
          )}
        </div>

        {adding && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-2 gap-3">
              <EditInput value={newDoc.nome} onChange={v => setNewDoc(s => ({ ...s, nome: v }))} placeholder="Nome do documento" />
              <EditSelect value={newDoc.tipo} onChange={v => setNewDoc(s => ({ ...s, tipo: v }))} options={[
                { value: "proposta", label: "Proposta" }, { value: "projeto", label: "Projeto Técnico" },
                { value: "contrato", label: "Contrato" }, { value: "medicao", label: "Medição" },
                { value: "nf", label: "Nota Fiscal" }, { value: "outro", label: "Outro" },
              ]} />
              <div className="col-span-2"><EditInput value={newDoc.url} onChange={v => setNewDoc(s => ({ ...s, url: v }))} placeholder="Link do Drive ou URL" /></div>
              <EditInput type="date" value={newDoc.data} onChange={v => setNewDoc(s => ({ ...s, data: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex-1 rounded-lg py-2" style={{ fontSize: "0.65rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>Salvar Documento</button>
              <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {docs.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1.5rem 0" }}>Nenhum documento anexado.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d, i) => {
              const tc = tipoColor(d.tipo);
              const Icon = tipoIcon(d.tipo);
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${tc}15` }}>
                    <Icon size={14} style={{ color: tc }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: "0.7rem", color: "white" }}>{d.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge label={d.tipo} color={tc} bg={`${tc}12`} />
                      {d.data && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{d.data}</span>}
                    </div>
                  </div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2.5 py-1.5 flex items-center gap-1" style={{ fontSize: "0.55rem", background: "rgba(255,255,255,0.04)", color: TEXT_MED, border: `1px solid ${BORDER}` }}>
                    <ExternalLink size={10} />Abrir
                  </a>
                  {editing && <button onClick={() => remove(i)} style={{ color: RED, cursor: "pointer" }}><Trash2 size={12} /></button>}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Chat Interno ── */
function TabChat({ card }: { card: DbCard }) {
  const [messages, setMessages] = useState<ChatMessage[]>(card.chat_messages ?? []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    setSending(true);
    const msg: ChatMessage = {
      id: Date.now(),
      user: "Você",
      msg: input.trim(),
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      avatar: "VC",
    };
    const updated = [...messages, msg];
    setMessages(updated);
    setInput("");
    await supabase.from("kanban_cards").update({ chat_messages: updated }).eq("id", card.id);
    setSending(false);
  };

  return (
    <div className="flex flex-col gap-4" style={{ height: "70vh" }}>
      <SectionCard className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <p className="tracking-[0.15em] uppercase mb-4 flex-shrink-0" style={{ fontSize: "0.5rem", color: ACCENT }}>Chat Interno da Equipe</p>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ minHeight: 0 }}>
          {messages.length === 0 ? (
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "2rem 0" }}>
              Sem mensagens. Inicie a conversa.
            </p>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.user === "Você" ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}20`, fontSize: "0.45rem", fontWeight: 700, color: ACCENT }}>
                {m.avatar}
              </div>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${m.user === "Você" ? "rounded-tr-sm" : "rounded-tl-sm"}`} style={{ background: m.user === "Você" ? `${ACCENT}15` : "rgba(255,255,255,0.04)", border: `1px solid ${m.user === "Você" ? `${ACCENT}30` : BORDER}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: "0.5rem", fontWeight: 600, color: ACCENT }}>{m.user}</span>
                  <span style={{ fontSize: "0.45rem", color: TEXT_DIM }}>{m.time}</span>
                </div>
                <p style={{ fontSize: "0.7rem", color: TEXT_MED, lineHeight: 1.5 }}>{m.msg}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 mt-4 flex-shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Mensagem para a equipe..."
            className="flex-1 rounded-lg px-3 py-2 outline-none"
            style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
          />
          <button onClick={send} disabled={sending} className="rounded-lg px-4 py-2 flex items-center gap-1.5" style={{ background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: sending ? "default" : "pointer" }}>
            <Send size={12} />
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Contratos ── */
const AI_BACKEND = "https://agente.parket.works/api/contracts";

interface ContratoRecord {
  id: string;
  card_id: string;
  filename: string;
  file_type: string;
  file_size?: number;
  storage_path?: string;
  ai_summary?: string;
  ai_details?: {
    resumo?: string;
    cliente?: string;
    contratada?: string;
    data_assinatura?: string;
    data_inicio_prevista?: string;
    data_entrega_prevista?: string;
    prazo_dias?: number;
    valor_total?: string;
    condicoes_pagamento?: string;
    metragem_m2?: number;
    endereco_obra?: string;
    materiais?: Array<{ item: string; especificacao?: string; quantidade?: string }>;
    servicos?: string[];
    garantia?: string;
    multas_penalidades?: string;
    observacoes_importantes?: string[];
    pontos_atencao?: string[];
  };
  created_at: string;
  analyzed_at?: string;
}

/* ════════════════════════════════════════════════════════════
   TAB: ALERTAS DO PROJETO
   ════════════════════════════════════════════════════════════ */
function TabAlertas({ card }: { card: DbCard }) {
  const { alertas, createAlerta, resolveAlerta, addComment } = useAlertas();
  const cardAlertas = alertas.filter(a => a.obra_id === card.id || a.obra_id === card.obra);

  const [form, setForm] = React.useState({ severity: "warning" as Alerta["severity"], message: "" });
  const [saving, setSaving] = React.useState(false);
  const [comment, setComment] = React.useState<Record<string, string>>({});

  const SEV_COLORS: Record<string, string> = {
    critical: RED, warning: YELLOW, info: BLUE,
  };
  const SEV_LABELS: Record<string, string> = {
    critical: "Crítico", warning: "Atenção", info: "Info",
  };

  const handleCreate = async () => {
    if (!form.message.trim()) return;
    setSaving(true);
    try {
      await createAlerta({
        severity: form.severity,
        rule: "manual",
        message: form.message.trim(),
        dept: card.dept_id ?? "geral",
        obra_id: card.id,
      });
      setForm(f => ({ ...f, message: "" }));
    } finally { setSaving(false); }
  };

  const handleComment = async (id: string) => {
    const msg = comment[id]?.trim();
    if (!msg) return;
    await addComment(id, "Usuário", msg);
    setComment(c => ({ ...c, [id]: "" }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>
          Alertas do Projeto
        </h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>
          {cardAlertas.length === 0 ? "Nenhum alerta ativo" : `${cardAlertas.length} alerta${cardAlertas.length > 1 ? "s" : ""} ativo${cardAlertas.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Criar novo alerta */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Novo Alerta</p>
        <div className="flex gap-2">
          {(["critical", "warning", "info"] as const).map(s => (
            <button key={s} onClick={() => setForm(f => ({ ...f, severity: s }))}
              className="rounded-lg px-3 py-1.5 transition-all"
              style={{
                fontSize: "0.55rem", fontWeight: 600,
                background: form.severity === s ? `${SEV_COLORS[s]}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${form.severity === s ? SEV_COLORS[s] + "60" : BORDER}`,
                color: form.severity === s ? SEV_COLORS[s] : TEXT_DIM,
              }}>
              {SEV_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Descreva o alerta..."
            className="flex-1 rounded-lg px-3 py-2 text-white outline-none"
            style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
          />
          <button
            onClick={handleCreate}
            disabled={saving || !form.message.trim()}
            className="rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all disabled:opacity-40"
            style={{ fontSize: "0.65rem", fontWeight: 600, background: `${SEV_COLORS[form.severity]}20`, border: `1px solid ${SEV_COLORS[form.severity]}40`, color: SEV_COLORS[form.severity] }}>
            <Plus size={12} /> {saving ? "..." : "Adicionar"}
          </button>
        </div>
      </div>

      {/* Lista de alertas */}
      {cardAlertas.length === 0 ? (
        <div className="rounded-xl p-8 flex flex-col items-center gap-2" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <CheckCircle2 size={24} style={{ color: GREEN, opacity: 0.5 }} />
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum alerta ativo para este projeto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cardAlertas.map(a => {
            const c = SEV_COLORS[a.severity];
            return (
              <div key={a.id} className="rounded-xl p-4 space-y-3" style={{ background: `${c}06`, border: `1px solid ${c}25` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <AlertTriangle size={14} style={{ color: c, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full px-2 py-px" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${c}20`, color: c }}>
                          {SEV_LABELS[a.severity]}
                        </span>
                        <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>
                          {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)" }}>{a.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => resolveAlerta(a.id, "Usuário")}
                    className="rounded-lg px-3 py-1.5 flex items-center gap-1 transition-all hover:opacity-80 shrink-0"
                    style={{ fontSize: "0.5rem", fontWeight: 600, background: `${GREEN}15`, border: `1px solid ${GREEN}30`, color: GREEN }}>
                    <Check size={10} /> Resolver
                  </button>
                </div>

                {/* Comentários */}
                {(a.comments ?? []).length > 0 && (
                  <div className="space-y-1 pt-2 border-t" style={{ borderColor: `${c}20` }}>
                    {(a.comments ?? []).map(cm => (
                      <div key={cm.id} className="flex gap-2">
                        <span style={{ fontSize: "0.55rem", color: c, fontWeight: 600 }}>{cm.user}:</span>
                        <span style={{ fontSize: "0.55rem", color: TEXT_MED }}>{cm.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    value={comment[a.id] ?? ""}
                    onChange={e => setComment(c => ({ ...c, [a.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleComment(a.id)}
                    placeholder="Comentar..."
                    className="flex-1 rounded-md px-2 py-1 outline-none"
                    style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: "white" }}
                  />
                  <button onClick={() => handleComment(a.id)}
                    className="rounded-md px-2 py-1"
                    style={{ fontSize: "0.55rem", background: "rgba(255,255,255,0.06)", color: TEXT_DIM }}>
                    <Send size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabContratos({ card }: { card: DbCard }) {
  const [contratos, setContratos] = useState<ContratoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContratoRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fetchContratos = useCallback(async () => {
    try {
      const r = await fetch(`${AI_BACKEND}/${card.id}`);
      if (r.ok) setContratos(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [card.id]);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("card_id", card.id);
      fd.append("file", file);
      const r = await fetch(`${AI_BACKEND}/analyze`, { method: "POST", body: fd });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Erro ${r.status}`);
      }
      const novo: ContratoRecord = await r.json();
      setContratos(prev => [novo, ...prev]);
      setSelected(novo);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erro ao analisar contrato");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este contrato?")) return;
    try {
      await fetch(`${AI_BACKEND}/${id}`, { method: "DELETE" });
      setContratos(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* ignore */ }
  };

  const handleDownload = async (c: ContratoRecord) => {
    setDownloadingId(c.id);
    try {
      const r = await fetch(`${AI_BACKEND}/${card.id}/storage-url/${c.id}`);
      if (!r.ok) throw new Error("Arquivo não disponível");
      const { url } = await r.json();
      window.open(url, "_blank");
    } catch {
      alert("Não foi possível baixar o arquivo.");
    } finally { setDownloadingId(null); }
  };

  const det = selected?.ai_details;
  const fmt = (n?: number | null) => n != null ? `${n.toLocaleString("pt-BR")} m²` : null;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: ACCENT }} />
            <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Contratos do Projeto</p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ fontSize: "0.6rem", fontWeight: 600, background: uploading ? "rgba(255,255,255,0.04)" : `${ACCENT}15`, color: uploading ? TEXT_DIM : ACCENT, border: `1px solid ${uploading ? BORDER : ACCENT + "30"}`, cursor: uploading ? "default" : "pointer" }}
            >
              {uploading ? <><Loader2 size={11} className="animate-spin" />Analisando...</> : <><Plus size={11} />Anexar Contrato</>}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={12} style={{ color: RED, flexShrink: 0 }} />
            <span style={{ fontSize: "0.65rem", color: RED }}>{uploadError}</span>
          </div>
        )}

        {uploading && (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(212,168,83,0.04)", border: `1px solid ${ACCENT}20` }}>
            <Bot size={28} style={{ color: GOLD, margin: "0 auto 10px" }} />
            <p style={{ fontSize: "0.72rem", color: "white", marginBottom: 4 }}>Analisando contrato com IA...</p>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Extraindo datas, materiais, valores e cláusulas importantes</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: TEXT_DIM, margin: "0 auto" }} /></div>
        ) : contratos.length === 0 && !uploading ? (
          <div className="text-center py-8">
            <FileText size={32} style={{ color: TEXT_DIM, margin: "0 auto 10px" }} />
            <p style={{ fontSize: "0.72rem", color: TEXT_DIM, marginBottom: 12 }}>Nenhum contrato anexado.</p>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Anexe um PDF ou imagem do contrato para a IA extrair todas as informações importantes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contratos.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(selected?.id === c.id ? null : c)}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                style={{ background: selected?.id === c.id ? `${ACCENT}10` : "rgba(255,255,255,0.02)", border: `1px solid ${selected?.id === c.id ? ACCENT + "30" : BORDER}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}15` }}>
                  <FileText size={14} style={{ color: ACCENT }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "0.7rem", color: "white", fontWeight: 500 }} className="truncate">{c.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {c.ai_details?.valor_total && <Badge label={c.ai_details.valor_total} color={GREEN} bg={`${GREEN}12`} />}
                    {c.ai_details?.metragem_m2 && <Badge label={fmt(c.ai_details.metragem_m2)!} color={BLUE} bg={`${BLUE}12`} />}
                    {c.ai_details?.data_entrega_prevista && <Badge label={`Entrega: ${c.ai_details.data_entrega_prevista}`} color={YELLOW} bg={`${YELLOW}12`} />}
                    <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.storage_path && (
                    <button
                      onClick={ev => { ev.stopPropagation(); handleDownload(c); }}
                      className="rounded-lg px-2 py-1 flex items-center gap-1"
                      style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.04)", color: TEXT_MED, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                    >
                      {downloadingId === c.id ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />}
                      Abrir
                    </button>
                  )}
                  <button onClick={ev => { ev.stopPropagation(); handleDelete(c.id); }} style={{ color: RED, cursor: "pointer", padding: 4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Análise do contrato selecionado */}
      {selected && det && (
        <div className="space-y-4">
          {/* Resumo */}
          {det.resumo && (
            <SectionCard>
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} style={{ color: GOLD }} />
                <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: GOLD }}>Resumo do Contrato — IA</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(212,168,83,0.04)", border: `1px solid ${GOLD}20` }}>
                <p style={{ fontSize: "0.72rem", color: "white", lineHeight: 1.8 }}>{det.resumo}</p>
              </div>
            </SectionCard>
          )}

          {/* Dados principais */}
          <SectionCard>
            <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Dados Principais</p>
            <div className="grid grid-cols-2 gap-4">
              {det.cliente && <Field label="Cliente / Contratante"><span style={{ color: "white" }}>{det.cliente}</span></Field>}
              {det.contratada && <Field label="Contratada"><span style={{ color: "white" }}>{det.contratada}</span></Field>}
              {det.data_assinatura && <Field label="Data de Assinatura"><Badge label={det.data_assinatura} color={BLUE} bg={`${BLUE}12`} /></Field>}
              {det.data_inicio_prevista && <Field label="Início Previsto"><Badge label={det.data_inicio_prevista} color={TEAL} bg={`${TEAL}12`} /></Field>}
              {det.data_entrega_prevista && <Field label="Entrega Prevista"><Badge label={det.data_entrega_prevista} color={YELLOW} bg={`${YELLOW}12`} /></Field>}
              {det.prazo_dias != null && <Field label="Prazo (dias)"><span style={{ color: "white" }}>{det.prazo_dias} dias</span></Field>}
              {det.valor_total && <Field label="Valor Total"><span style={{ color: GREEN, fontWeight: 600 }}>{det.valor_total}</span></Field>}
              {det.metragem_m2 != null && <Field label="Metragem Total"><span style={{ color: BLUE, fontWeight: 600 }}>{fmt(det.metragem_m2)}</span></Field>}
              {det.endereco_obra && <Field label="Endereço da Obra"><span style={{ color: TEXT_MED }}>{det.endereco_obra}</span></Field>}
              {det.condicoes_pagamento && <Field label="Condições de Pagamento"><span style={{ color: TEXT_MED }}>{det.condicoes_pagamento}</span></Field>}
              {det.garantia && <Field label="Garantia"><span style={{ color: TEXT_MED }}>{det.garantia}</span></Field>}
            </div>
          </SectionCard>

          {/* Materiais */}
          {det.materiais && det.materiais.length > 0 && (
            <SectionCard>
              <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Materiais Especificados</p>
              <div className="space-y-2">
                {det.materiais.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                    <Package size={12} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <p style={{ fontSize: "0.7rem", color: "white", fontWeight: 500 }}>{m.item}</p>
                      {m.especificacao && <p style={{ fontSize: "0.6rem", color: TEXT_MED }}>{m.especificacao}</p>}
                    </div>
                    {m.quantidade && <Badge label={m.quantidade} color={TEAL} bg={`${TEAL}12`} />}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Serviços + Observações + Atenção */}
          <div className="grid grid-cols-2 gap-4">
            {toArr(det.servicos).length > 0 && (
              <SectionCard>
                <p className="tracking-[0.15em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Serviços Contratados</p>
                <div className="space-y-1.5">
                  {toArr(det.servicos).map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check size={10} style={{ color: GREEN, flexShrink: 0, marginTop: 3 }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{s}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            {det.pontos_atencao && det.pontos_atencao.length > 0 && (
              <SectionCard>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={12} style={{ color: YELLOW }} />
                  <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: YELLOW }}>Pontos de Atenção</p>
                </div>
                <div className="space-y-1.5">
                  {det.pontos_atencao.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={10} style={{ color: YELLOW, flexShrink: 0, marginTop: 3 }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{p}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {det.observacoes_importantes && det.observacoes_importantes.length > 0 && (
            <SectionCard>
              <p className="tracking-[0.15em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Cláusulas & Observações Relevantes</p>
              <div className="space-y-2">
                {det.observacoes_importantes.map((o, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <ChevronRight size={10} style={{ color: ACCENT, flexShrink: 0, marginTop: 3 }} />
                    <p style={{ fontSize: "0.65rem", color: TEXT_MED, lineHeight: 1.6 }}>{o}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {det.multas_penalidades && (
            <SectionCard>
              <p className="tracking-[0.15em] uppercase mb-2" style={{ fontSize: "0.5rem", color: RED }}>Multas & Penalidades</p>
              <p style={{ fontSize: "0.7rem", color: TEXT_MED, lineHeight: 1.6 }}>{det.multas_penalidades}</p>
            </SectionCard>
          )}

          {selected.analyzed_at && (
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textAlign: "right" }}>
              Analisado em {new Date(selected.analyzed_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Cronograma PMO ── */
function TabCronograma({ card, onDetailsChange }: {
  card: DbCard;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const det = (card.details as ProjetoDetails) ?? {};
  const crono = det.cronograma_pmo;
  const [area, setArea] = React.useState<string>(det.area_m2 != null ? String(det.area_m2) : "");
  const [previsaoInicio, setPrevisaoInicio] = React.useState(det.previsao_inicio ?? "");
  const [entregaManual, setEntregaManual] = React.useState(det.previsao_entrega_manual ?? "");
  const [calculando, setCalculando] = React.useState(false);
  const [resultado, setResultado] = React.useState<typeof crono | null>(crono ?? null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = React.useState(false);
  const [alertas, setAlertas] = React.useState<CronogramaAlerta[]>(det.alertas_cronograma ?? []);
  const [showAddAlerta, setShowAddAlerta] = React.useState(false);
  const [alertaForm, setAlertaForm] = React.useState<{ tipo: CronogramaAlerta["tipo"]; motivo: string }>({ tipo: "pendencia_obra", motivo: "" });

  const handleGerarPdf = async () => {
    if (!resultado) return;
    setGerandoPdf(true);
    try {
      const { gerarCronogramaPdf } = await import("../lib/cronograma-pdf");
      const details = (card.details as Record<string, any>) ?? {};
      const mediaGallery: Array<{ url: string; type?: string; description?: string; categoria?: string; produtos?: string[]; ambiente?: string; caption?: string; date?: string }> = details.media_gallery ?? [];
      await gerarCronogramaPdf({
        cliente: details.cliente || card.title,
        vendedor: details.vendedor || card.responsavel || "",
        responsavel: details.responsavel_obra || card.responsavel || "",
        endereco: details.endereco || "",
        equipe: details.equipe_nome || details.equipe_obras?.lider || "",
        descricao_produto: details.descricao_produto || card.subtitle || "",
        obra: card.obra,
        itens: resultado.itens.map((it) => ({
          servico: it.servico,
          quantidade: it.quantidade,
          unidade: it.unidade,
          instalado: (it as any).instalado ?? 0,
          pendente: (it as any).pendente ?? it.quantidade,
          dias_uteis: it.dias_uteis,
          rendimento: it.rendimento,
          status: (it as any).status ?? "pendente",
          observacao: (it as any).observacao,
        })),
        alertas: [],
        previsao_inicio: resultado.previsao_inicio || details.previsao_inicio,
        data_entrega: details.prazo_contratual,
        medias: mediaGallery.map((m) => ({
          url: m.url,
          type: (m.type as any) ?? "image",
          description: m.description,
          categoria: m.categoria,
          produtos: m.produtos,
          ambiente: m.ambiente,
          caption: m.caption,
          date: m.date,
        })),
      });
    } catch (e) {
      console.error("Erro ao gerar PDF cronograma:", e);
    }
    setGerandoPdf(false);
  };

  const calcular = async () => {
    setCalculando(true);
    setErro(null);
    if (area) onDetailsChange({ area_m2: Number(area) });
    try {
      const r = await fetch("https://agente.parket.works/api/pmo/auto-calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id, dept_id: "produtividade" }),
      });
      const data = await r.json();
      if (data.ok) {
        setResultado(data.cronograma);
        onDetailsChange({
          prazo_dias_uteis: data.total_dias_uteis,
          cronograma_pmo: data.cronograma,
          area_m2: area ? Number(area) : undefined,
          previsao_inicio: previsaoInicio || undefined,
          previsao_entrega_manual: entregaManual || undefined,
        });
      } else {
        setErro(data.error ?? "Erro ao calcular");
      }
    } catch (e) {
      setErro("Falha de comunicação com o Agente PMO");
    }
    setCalculando(false);
  };

  const addAlerta = async () => {
    if (!alertaForm.motivo.trim()) return;
    const novo: CronogramaAlerta = {
      tipo: alertaForm.tipo,
      motivo: alertaForm.motivo.trim(),
      data: new Date().toISOString().split("T")[0],
      status: "aberto",
    };
    const updated = [...alertas, novo];
    setAlertas(updated);
    onDetailsChange({ alertas_cronograma: updated });
    setAlertaForm({ tipo: "pendencia_obra", motivo: "" });
    setShowAddAlerta(false);
    // Persist
    const merged = { ...card.details ?? {}, alertas_cronograma: updated };
    await supabase.from("kanban_cards").update({ details: merged }).eq("id", card.id);
  };

  const resolveAlerta = async (idx: number) => {
    const updated = alertas.map((a, i) => i === idx ? { ...a, status: "resolvido" as const } : a);
    setAlertas(updated);
    onDetailsChange({ alertas_cronograma: updated });
    const merged = { ...card.details ?? {}, alertas_cronograma: updated };
    await supabase.from("kanban_cards").update({ details: merged }).eq("id", card.id);
  };

  const statusColor = (du: number) => du <= 3 ? RED : du <= 7 ? YELLOW : GREEN;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Cronograma PMO</h2>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Prazo calculado em dias úteis pela tabela de rendimento padrão Parket</p>
        </div>
        {resultado && (
          <div className="text-right">
            <p style={{ fontSize: "1.4rem", fontWeight: 700, color: GREEN, lineHeight: 1 }}>{resultado.total_dias_uteis}</p>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>dias úteis totais</p>
          </div>
        )}
      </div>

      {/* Input área + botão calcular */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.6rem", fontWeight: 600, color: ACCENT }}>CONFIGURAÇÃO DO CÁLCULO</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Área total do projeto (m²)</label>
            <input
              type="number"
              value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="Ex: 45.5"
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
            />
          </div>
          <button
            onClick={calcular}
            disabled={calculando}
            className="flex items-center gap-2 rounded-lg px-4 py-2"
            style={{
              fontSize: "0.65rem", fontWeight: 600, cursor: calculando ? "default" : "pointer",
              background: calculando ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)",
              color: GREEN, border: `1px solid rgba(16,185,129,0.3)`,
            }}
          >
            {calculando ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
            {calculando ? "Calculando..." : "Calcular com IA"}
          </button>
        </div>
        <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>
          O Agente PMO irá identificar automaticamente os serviços baseado no tipo e informações do projeto,
          calcular os dias úteis usando a tabela de rendimento padrão e notificar o grupo WhatsApp.
        </p>
        {erro && <p style={{ fontSize: "0.6rem", color: RED }}>{erro}</p>}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Breakdown por Serviço</p>
            <div className="flex items-center gap-2">
              {!resultado.area_confirmada && (
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(245,158,11,0.12)", color: YELLOW, border: "1px solid rgba(245,158,11,0.25)" }}>
                  ⚠ Área estimada
                </span>
              )}
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>via {resultado.calculado_por}</span>
              <button
                onClick={handleGerarPdf}
                disabled={gerandoPdf}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{
                  fontSize: "0.55rem", fontWeight: 600, cursor: gerandoPdf ? "default" : "pointer",
                  background: "rgba(239,68,68,0.08)", color: RED,
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                {gerandoPdf ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                Gerar PDF
              </button>
            </div>
          </div>
          {resultado.itens.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.68rem", fontWeight: 500 }}>{item.servico}</p>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{item.quantidade} {item.unidade} ÷ {item.rendimento}/dia</p>
              </div>
              <span className="rounded-full px-2.5 py-1" style={{ fontSize: "0.55rem", fontWeight: 600, background: `${statusColor(item.dias_uteis)}15`, color: statusColor(item.dias_uteis) }}>
                {item.dias_uteis} d.u.
              </span>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid rgba(16,185,129,0.2)`, background: "rgba(16,185,129,0.03)" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 600, color: GREEN }}>Total</p>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: GREEN }}>{resultado.total_dias_uteis} dias úteis</p>
          </div>
          {resultado.observacao && (
            <div className="px-4 py-2" style={{ borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)" }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>💬 {resultado.observacao}</p>
            </div>
          )}
        </div>
      )}

      {/* Previsão de Início e Entrega Manual */}
      {resultado && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.6rem", fontWeight: 600, color: ACCENT }}>CRONOGRAMA FINAL</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Previsão de Início</label>
              <input
                type="date"
                value={previsaoInicio}
                onChange={e => {
                  setPrevisaoInicio(e.target.value);
                  onDetailsChange({ previsao_inicio: e.target.value });
                }}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Data de Entrega (manual)</label>
              <input
                type="date"
                value={entregaManual}
                onChange={e => {
                  setEntregaManual(e.target.value);
                  onDetailsChange({ previsao_entrega_manual: e.target.value });
                }}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
              />
              {entregaManual && (
                <button
                  onClick={() => { setEntregaManual(""); onDetailsChange({ previsao_entrega_manual: undefined }); }}
                  style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 4, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Voltar ao cálculo automático
                </button>
              )}
            </div>
          </div>
          {previsaoInicio && resultado.total_dias_uteis > 0 && (
            <div className="rounded-lg p-3 mt-2" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <p style={{ fontSize: "0.6rem", color: GREEN, fontWeight: 600 }}>
                {entregaManual
                  ? `Entrega manual: ${new Date(entregaManual + "T12:00:00").toLocaleDateString("pt-BR")}`
                  : (() => {
                      const d = new Date(previsaoInicio + "T12:00:00");
                      let added = 0;
                      while (added < resultado.total_dias_uteis) {
                        d.setDate(d.getDate() + 1);
                        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
                      }
                      return `Entrega calculada: ${d.toLocaleDateString("pt-BR")} (${resultado.total_dias_uteis} d.u.)`;
                    })()
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Alertas / Fichas de Atraso */}
      {resultado && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 600, color: RED }}>ALERTAS</p>
            <button
              onClick={() => setShowAddAlerta(!showAddAlerta)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
              style={{ fontSize: "0.55rem", background: "rgba(239,68,68,0.08)", color: RED, border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Plus size={10} /> Registrar Atraso
            </button>
          </div>

          {showAddAlerta && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
              <div className="flex gap-2">
                <select
                  value={alertaForm.tipo}
                  onChange={e => setAlertaForm(f => ({ ...f, tipo: e.target.value as CronogramaAlerta["tipo"] }))}
                  className="rounded-lg px-2 py-1.5 outline-none"
                  style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
                >
                  <option value="pendencia_obra">Pendência de Obra (Cliente)</option>
                  <option value="atraso_parket">Atraso da Parket</option>
                  <option value="outros">Outros</option>
                </select>
                <input
                  value={alertaForm.motivo}
                  onChange={e => setAlertaForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Motivo do atraso..."
                  className="flex-1 rounded-lg px-3 py-1.5 outline-none"
                  style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addAlerta} className="rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", background: `${RED}15`, color: RED, border: `1px solid ${RED}30` }}>Registrar</button>
                <button onClick={() => setShowAddAlerta(false)} className="rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>Cancelar</button>
              </div>
            </div>
          )}

          {alertas.length === 0 ? (
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Nenhum alerta registrado.</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => {
                const tipoLabel = a.tipo === "pendencia_obra" ? "Pendência de Obra" : a.tipo === "atraso_parket" ? "Atraso Parket" : "Outros";
                const tipoColor = a.tipo === "pendencia_obra" ? YELLOW : a.tipo === "atraso_parket" ? RED : BLUE;
                const resolved = a.status === "resolvido";
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: resolved ? "rgba(255,255,255,0.01)" : `${tipoColor}06`, border: `1px solid ${resolved ? BORDER : tipoColor + "20"}`, opacity: resolved ? 0.5 : 1 }}>
                    <AlertTriangle size={12} style={{ color: tipoColor, flexShrink: 0 }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge label={tipoLabel} color={tipoColor} bg={`${tipoColor}12`} />
                        <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{a.data}</span>
                      </div>
                      <p style={{ fontSize: "0.65rem", color: TEXT_MED, marginTop: 2 }}>{a.motivo}</p>
                    </div>
                    {!resolved && (
                      <button onClick={() => resolveAlerta(i)} className="rounded-lg px-2 py-1" style={{ fontSize: "0.5rem", color: GREEN, background: `${GREEN}10`, border: `1px solid ${GREEN}20` }}>
                        Resolver
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Registro Fotográfico */}
      {resultado && <MediaGallery card={card} onDetailsChange={onDetailsChange} />}

      {!resultado && !calculando && (
        <div className="rounded-xl p-8 text-center" style={{ border: `1px dashed ${BORDER}` }}>
          <TrendingUp size={24} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Nenhum cronograma calculado ainda.</p>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4 }}>
            Informe a área e clique em "Auto-Calcular".
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Agendamentos ── */
type AgendEntry = NonNullable<ProjetoDetails["agendamentos"]>[number];

function TabAgendamentos({ card, siblingCards, onDetailsChange }: {
  card: DbCard;
  siblingCards: DbCard[];
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const myDet = (card.details as ProjetoDetails) ?? {};
  const [local, setLocal] = useState<AgendEntry[]>(myDet.agendamentos ?? []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<AgendEntry, "id">>({
    setor: card.dept_id, tipo: "vistoria", data: "", hora: "", responsavel: "", status: "agendado", observacao: "",
  });

  // Aggregate from sibling cards
  const siblingAgendamentos: (AgendEntry & { sourceTitle: string })[] = [];
  for (const s of siblingCards) {
    const det = (s.details as ProjetoDetails) ?? {};
    for (const a of det.agendamentos ?? []) {
      siblingAgendamentos.push({ ...a, sourceTitle: `${s.dept_id.toUpperCase()} — ${s.title}` });
    }
  }
  const allAgendamentos = [
    ...local.map(a => ({ ...a, sourceTitle: "Este card" })),
    ...siblingAgendamentos,
  ].sort((a, b) => a.data.localeCompare(b.data));

  const statusColor = (s: string) =>
    s === "realizado" ? GREEN : s === "cancelado" ? RED : YELLOW;

  const save = async () => {
    if (!form.data) return;
    setSaving(true);
    const novo: AgendEntry = { ...form, id: Date.now().toString() };
    const updated = [...local, novo];
    setLocal(updated);
    onDetailsChange({ agendamentos: updated });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, agendamentos: updated } }).eq("id", card.id);
    setForm({ setor: card.dept_id, tipo: "vistoria", data: "", hora: "", responsavel: "", status: "agendado", observacao: "" });
    setAdding(false);
    setSaving(false);
  };

  const toggleStatus = async (id: string) => {
    const next = local.map(a => a.id !== id ? a : {
      ...a,
      status: a.status === "agendado" ? "realizado" as const : a.status === "realizado" ? "cancelado" as const : "agendado" as const,
    });
    setLocal(next);
    onDetailsChange({ agendamentos: next });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, agendamentos: next } }).eq("id", card.id);
  };

  const remove = async (id: string) => {
    const next = local.filter(a => a.id !== id);
    setLocal(next);
    onDetailsChange({ agendamentos: next });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, agendamentos: next } }).eq("id", card.id);
  };

  const TIPOS = ["1ª vistoria", "2ª vistoria", "reunião", "entrega de material", "medição", "outro"];

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: ACCENT }} />
            <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>
              Agendamentos do Projeto
              {siblingAgendamentos.length > 0 && <span style={{ color: TEXT_DIM, textTransform: "none", letterSpacing: 0 }}> · todos os setores</span>}
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
            style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
            <Plus size={10} />Agendar
          </button>
        </div>

        {adding && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-3 gap-3">
              <EditSelect value={form.tipo} onChange={v => setForm(s => ({ ...s, tipo: v }))} options={TIPOS.map(t => ({ value: t, label: t }))} />
              <EditInput type="date" value={form.data} onChange={v => setForm(s => ({ ...s, data: v }))} />
              <EditInput value={form.hora ?? ""} onChange={v => setForm(s => ({ ...s, hora: v }))} placeholder="Hora (ex: 14:00)" />
              <EditInput value={form.responsavel ?? ""} onChange={v => setForm(s => ({ ...s, responsavel: v }))} placeholder="Responsável" />
              <EditSelect value={form.setor} onChange={v => setForm(s => ({ ...s, setor: v }))} options={[
                { value: "fiscal", label: "Fiscal" }, { value: "produtividade", label: "PMO" },
                { value: "obras", label: "Obras" }, { value: "comercial", label: "Comercial" },
                { value: "financeiro", label: "Financeiro" }, { value: "projetos", label: "Projetos" },
              ]} />
              <EditSelect value={form.status} onChange={v => setForm(s => ({ ...s, status: v as AgendEntry["status"] }))} options={[
                { value: "agendado", label: "Agendado" }, { value: "realizado", label: "Realizado" }, { value: "cancelado", label: "Cancelado" },
              ]} />
              <div className="col-span-3">
                <EditInput value={form.observacao ?? ""} onChange={v => setForm(s => ({ ...s, observacao: v }))} placeholder="Observação..." />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.data} className="flex-1 rounded-lg py-2"
                style={{ fontSize: "0.65rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                {saving ? "Salvando..." : "Salvar Agendamento"}
              </button>
              <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2"
                style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {allAgendamentos.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={28} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum agendamento registrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allAgendamentos.map((a, i) => {
              const sc = statusColor(a.status);
              const isOwn = a.sourceTitle === "Este card";
              return (
                <div key={`${a.id}-${i}`} className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: isOwn ? "rgba(255,255,255,0.03)" : "rgba(59,130,246,0.04)", border: `1px solid ${isOwn ? BORDER : BLUE + "20"}` }}>
                  <button onClick={() => isOwn && toggleStatus(a.id)} title={isOwn ? "Clique para alterar status" : ""}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${sc}15`, border: `1px solid ${sc}40`, cursor: isOwn ? "pointer" : "default" }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: sc }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={a.tipo} color={ACCENT} bg={`${ACCENT}10`} />
                      <Badge label={a.setor.toUpperCase()} color={BLUE} bg={`${BLUE}10`} />
                      <Badge label={a.status} color={sc} bg={`${sc}10`} />
                      {!isOwn && <Badge label={a.sourceTitle} color={TEXT_DIM} bg="rgba(255,255,255,0.04)" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1" style={{ fontSize: "0.65rem", color: "white", fontWeight: 600 }}>
                        <Calendar size={9} style={{ color: ACCENT }} />{a.data}{a.hora ? ` às ${a.hora}` : ""}
                      </span>
                      {a.responsavel && <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Por: {a.responsavel}</span>}
                    </div>
                    {a.observacao && <p style={{ fontSize: "0.6rem", color: TEXT_MED, marginTop: 4 }}>{a.observacao}</p>}
                  </div>
                  {isOwn && (
                    <button onClick={() => remove(a.id)} style={{ color: RED, cursor: "pointer", padding: 2 }}><Trash2 size={11} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Relatórios por Setor ── */
type RelatorioEntry = NonNullable<ProjetoDetails["relatorios"]>[number];

const CHECKLIST_VISTORIA_PADRAO = [
  "Piso instalado conforme projeto",
  "Acabamentos e rodapés aplicados",
  "Rejuntes e vedações realizados",
  "Limpeza pós-obra executada",
  "Material sem danos visíveis",
  "Nivelamento adequado",
  "Iluminação e ventilação verificadas",
];

function TabRelatorios({ card, siblingCards, onDetailsChange }: {
  card: DbCard;
  siblingCards: DbCard[];
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const myDet = (card.details as ProjetoDetails) ?? {};
  const [local, setLocal] = useState<RelatorioEntry[]>(myDet.relatorios ?? []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RelatorioEntry, "id">>({
    setor: card.dept_id, tipo: "vistoria", data: "", responsavel: "",
    resultado: "aprovado", descricao: "",
    checklist_vistoria: CHECKLIST_VISTORIA_PADRAO.map(item => ({ item, ok: false })),
  });

  const siblingRelatorios: (RelatorioEntry & { sourceTitle: string })[] = [];
  for (const s of siblingCards) {
    const det = (s.details as ProjetoDetails) ?? {};
    for (const r of det.relatorios ?? []) {
      siblingRelatorios.push({ ...r, sourceTitle: `${s.dept_id.toUpperCase()}` });
    }
  }
  const allRelatorios = [
    ...local.map(r => ({ ...r, sourceTitle: "self" as const })),
    ...siblingRelatorios,
  ].sort((a, b) => b.data.localeCompare(a.data));

  const resultColor = (r: string) => r === "aprovado" ? GREEN : r === "reprovado" ? RED : YELLOW;

  const save = async () => {
    if (!form.data) return;
    setSaving(true);
    const novo: RelatorioEntry = { ...form, id: Date.now().toString() };
    const updated = [...local, novo];
    setLocal(updated);
    onDetailsChange({ relatorios: updated });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, relatorios: updated } }).eq("id", card.id);
    setAdding(false);
    setSaving(false);
  };

  const toggleCheck = async (relId: string, idx: number) => {
    const next = local.map(r => r.id !== relId ? r : {
      ...r,
      checklist_vistoria: r.checklist_vistoria?.map((c, i) => i === idx ? { ...c, ok: !c.ok } : c),
    });
    setLocal(next);
    onDetailsChange({ relatorios: next });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, relatorios: next } }).eq("id", card.id);
  };

  const remove = async (id: string) => {
    const next = local.filter(r => r.id !== id);
    setLocal(next);
    onDetailsChange({ relatorios: next });
    const currentDet = (card.details as Record<string, unknown>) ?? {};
    await supabase.from("kanban_cards").update({ details: { ...currentDet, relatorios: next } }).eq("id", card.id);
  };

  const TIPOS_REL = ["1ª vistoria", "2ª vistoria", "inspeção", "entrega", "reunião", "outro"];

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} style={{ color: ACCENT }} />
            <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Relatórios de Vistoria & Inspeção</p>
          </div>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
            style={{ fontSize: "0.6rem", background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
            <Plus size={10} />Novo Relatório
          </button>
        </div>

        {adding && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-3 gap-3">
              <EditSelect value={form.tipo} onChange={v => setForm(s => ({ ...s, tipo: v }))} options={TIPOS_REL.map(t => ({ value: t, label: t }))} />
              <EditInput type="date" value={form.data} onChange={v => setForm(s => ({ ...s, data: v }))} />
              <EditInput value={form.responsavel ?? ""} onChange={v => setForm(s => ({ ...s, responsavel: v }))} placeholder="Fiscal responsável" />
              <EditSelect value={form.setor} onChange={v => setForm(s => ({ ...s, setor: v }))} options={[
                { value: "fiscal", label: "Fiscal" }, { value: "produtividade", label: "PMO" },
                { value: "obras", label: "Obras" }, { value: "financeiro", label: "Financeiro" },
              ]} />
              <EditSelect value={form.resultado} onChange={v => setForm(s => ({ ...s, resultado: v as RelatorioEntry["resultado"] }))} options={[
                { value: "aprovado", label: "Aprovado" }, { value: "reprovado", label: "Reprovado" }, { value: "pendencias", label: "Com Pendências" },
              ]} />
            </div>
            <textarea value={form.descricao ?? ""} onChange={e => setForm(s => ({ ...s, descricao: e.target.value }))}
              placeholder="Descrição da vistoria, observações, conclusões..."
              rows={3} className="w-full rounded-lg px-3 py-2 outline-none resize-none"
              style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }} />
            <div>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Checklist de Vistoria</p>
              <div className="space-y-1.5">
                {form.checklist_vistoria?.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setForm(s => ({ ...s, checklist_vistoria: s.checklist_vistoria?.map((x, j) => j === i ? { ...x, ok: !x.ok } : x) }))}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: c.ok ? `${GREEN}20` : "rgba(255,255,255,0.04)", border: `1px solid ${c.ok ? GREEN : BORDER}` }}>
                      {c.ok && <Check size={8} style={{ color: GREEN }} />}
                    </div>
                    <span style={{ fontSize: "0.65rem", color: c.ok ? TEXT_MED : TEXT_DIM, textDecoration: c.ok ? "line-through" : "none" }}>{c.item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.data} className="flex-1 rounded-lg py-2"
                style={{ fontSize: "0.65rem", background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                {saving ? "Salvando..." : "Salvar Relatório"}
              </button>
              <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2"
                style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>Cancelar</button>
            </div>
          </div>
        )}

        {allRelatorios.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList size={28} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum relatório registrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allRelatorios.map((r, i) => {
              const rc = resultColor(r.resultado);
              const isOwn = r.sourceTitle === "self";
              const done = r.checklist_vistoria?.filter(c => c.ok).length ?? 0;
              const total = r.checklist_vistoria?.length ?? 0;
              const isExpanded = expanded === r.id;
              return (
                <div key={`${r.id}-${i}`} className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${isOwn ? BORDER : BLUE + "25"}` }}>
                  <button onClick={() => setExpanded(isExpanded ? null : r.id)} className="w-full flex items-start gap-3 p-3.5 text-left"
                    style={{ background: isOwn ? "rgba(255,255,255,0.02)" : "rgba(59,130,246,0.04)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${rc}15`, border: `1px solid ${rc}25` }}>
                      <ClipboardList size={13} style={{ color: rc }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge label={r.tipo} color={ACCENT} bg={`${ACCENT}10`} />
                        <Badge label={r.setor.toUpperCase()} color={BLUE} bg={`${BLUE}10`} />
                        <Badge label={r.resultado} color={rc} bg={`${rc}10`} />
                        {!isOwn && <Badge label={r.sourceTitle} color={TEXT_DIM} bg="rgba(255,255,255,0.04)" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: "0.65rem", color: "white", fontWeight: 600 }}>{r.data}</span>
                        {r.responsavel && <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>por {r.responsavel}</span>}
                        {total > 0 && <span style={{ fontSize: "0.55rem", color: done === total ? GREEN : TEXT_DIM, marginLeft: "auto" }}>{done}/{total} ✓</span>}
                      </div>
                    </div>
                    <ChevronRight size={12} style={{ color: TEXT_DIM, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                      {r.descricao && (
                        <div className="pt-3">
                          <p style={{ fontSize: "0.5rem", color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Descrição</p>
                          <p style={{ fontSize: "0.68rem", color: TEXT_MED, lineHeight: 1.7 }}>{r.descricao}</p>
                        </div>
                      )}
                      {total > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase" }}>Checklist de Vistoria</p>
                            <div className="h-1 rounded-full flex-1 mx-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: GREEN }} />
                            </div>
                            <span style={{ fontSize: "0.55rem", color: done === total ? GREEN : TEXT_DIM }}>{done}/{total}</span>
                          </div>
                          <div className="space-y-1.5">
                            {r.checklist_vistoria!.map((c, idx) => (
                              <div key={idx} className={`flex items-center gap-2 ${isOwn ? "cursor-pointer" : ""}`}
                                onClick={() => isOwn && toggleCheck(r.id, idx)}>
                                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                  style={{ background: c.ok ? `${GREEN}20` : "rgba(255,255,255,0.04)", border: `1px solid ${c.ok ? GREEN : BORDER}` }}>
                                  {c.ok && <Check size={8} style={{ color: GREEN }} />}
                                </div>
                                <span style={{ fontSize: "0.65rem", color: c.ok ? TEXT_MED : TEXT_DIM, textDecoration: c.ok ? "line-through" : "none" }}>{c.item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isOwn && (
                        <div className="flex justify-end pt-1">
                          <button onClick={() => remove(r.id)} className="flex items-center gap-1 rounded-lg px-3 py-1.5"
                            style={{ fontSize: "0.55rem", background: "rgba(239,68,68,0.08)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                            <Trash2 size={10} />Remover
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Por Setor ── */
const DEPT_LABELS_LOCAL: Record<string, string> = {
  comercial: "Comercial", projetos: "Projetos", compras: "Compras",
  producao: "Produção", logistica: "Logística", obras: "Obras",
  atendimento: "Atendimento", fiscal: "Fiscal", produtividade: "PMO",
  financeiro: "Financeiro", orcamento: "Orçamento",
};

const DEPT_ICONS: Record<string, React.FC<{size: number; style?: React.CSSProperties}>> = {
  fiscal: ({ size, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></svg>,
  produtividade: () => <TrendingUp size={14} />,
  obras: () => <Building2 size={14} />,
  financeiro: () => <DollarSign size={14} />,
};

function TabSetores({ card, siblingCards }: { card: DbCard; siblingCards: DbCard[] }) {
  const allCards = [card, ...siblingCards];
  const byDept = allCards.reduce((acc, c) => {
    const d = c.dept_id;
    if (!acc[d]) acc[d] = [];
    acc[d].push(c);
    return acc;
  }, {} as Record<string, DbCard[]>);

  if (Object.keys(byDept).length === 0) {
    return <SectionCard><p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "2rem 0" }}>Sem dados de outros setores.</p></SectionCard>;
  }

  const COLUMN_LABEL: Record<string, string> = {
    "backlog": "Backlog", "agend-1vistoria": "Agend. 1ª Vistoria", "1vistoria": "1ª Vistoria",
    "aguard-cliente": "Aguardando Cliente", "agend-2vistoria": "Agend. 2ª Vistoria", "2vistoria": "2ª Vistoria",
    "handoff-pmo": "Passagem de Bastão → PMO", "acompanhamento": "Acompanhamento",
    "novo-projeto": "Novo Projeto", "ativo": "Monitoramento de Obras", "reparo": "Reparo",
    "entrada": "Entrada", "em-andamento": "Em Andamento", "concluido": "Concluído",
    "revisao": "Em Revisão", "pre-crono": "Pré-Cronograma", "crono-final": "Cronograma Final",
    "cotacao": "Em Cotação", "aguarda-aprovacao": "Interface Financeira",
    "emissao-pedido": "Emissão do Pedido", "em-transito": "Em Trânsito",
    "recebimento-auditoria": "Recebido e Conferido", "amostras": "Amostras",
    "pagamento": "Pagamento / Retenção", "aceite": "Termo de Aceite", "encerrado": "Encerrado",
  };

  return (
    <div className="space-y-3">
      <SectionCard>
        <p className="tracking-[0.15em] uppercase mb-5" style={{ fontSize: "0.5rem", color: ACCENT }}>Status do Projeto em Cada Setor</p>
        <div className="space-y-4">
          {Object.entries(byDept).map(([dept, cards]) => {
            const Icon = DEPT_ICONS[dept] ?? Building2;
            return (
              <div key={dept}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
                    <Icon size={14} style={{ color: ACCENT }} />
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>{DEPT_LABELS_LOCAL[dept] ?? dept}</span>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>· {cards.length} card(s)</span>
                </div>
                <div className="pl-9 space-y-2">
                  {cards.map(c => {
                    const det = (c.details as ProjetoDetails) ?? {};
                    const colLabel = COLUMN_LABEL[c.column_id] ?? c.column_id;
                    const handoffStatus = (c.details as Record<string, unknown>)?.handoff_status as string | undefined;
                    const colColor = handoffStatus === "pending_acceptance" ? YELLOW :
                      c.column_id === "concluido" ? GREEN :
                      c.column_id.includes("handoff") ? ORANGE : BLUE;
                    const agendamentos = det.agendamentos ?? [];
                    const relatorios = det.relatorios ?? [];
                    const proxAgend = agendamentos.filter(a => a.status === "agendado").sort((a, b) => a.data.localeCompare(b.data))[0];
                    return (
                      <div key={c.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge label={colLabel} color={colColor} bg={`${colColor}12`} />
                          {handoffStatus === "pending_acceptance" && <Badge label="⏳ Aguardando Aceite" color={YELLOW} bg={`${YELLOW}10`} />}
                          {c.responsavel && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>resp: {c.responsavel}</span>}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          {agendamentos.length > 0 && (
                            <span style={{ fontSize: "0.58rem", color: TEXT_MED }}>
                              📅 {agendamentos.length} agendamento(s){proxAgend ? ` · próx: ${proxAgend.data}` : ""}
                            </span>
                          )}
                          {relatorios.length > 0 && (
                            <span style={{ fontSize: "0.58rem", color: TEXT_MED }}>
                              📋 {relatorios.length} relatório(s)
                            </span>
                          )}
                          {c.checklist_items && c.checklist_items.length > 0 && (
                            <span style={{ fontSize: "0.58rem", color: c.checklist_items.every(x => x.done) ? GREEN : TEXT_MED }}>
                              ✓ checklist: {c.checklist_items.filter(x => x.done).length}/{c.checklist_items.length}
                            </span>
                          )}
                          {c.progress != null && (
                            <span style={{ fontSize: "0.58rem", color: TEXT_MED }}>⚡ {c.progress}% concluído</span>
                          )}
                        </div>
                        {proxAgend && (
                          <div className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", display: "inline-flex" }}>
                            <Calendar size={9} style={{ color: YELLOW }} />
                            <span style={{ fontSize: "0.58rem", color: YELLOW }}>
                              Próximo: {proxAgend.tipo} em {proxAgend.data}{proxAgend.hora ? ` às ${proxAgend.hora}` : ""}
                              {proxAgend.responsavel ? ` — ${proxAgend.responsavel}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Análise IA ── */
function TabIA({ details, editing, onDetailsChange }: {
  details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const ia = details.ia_analysis;
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    const mock: ProjetoDetails["ia_analysis"] = {
      resumo: "Projeto dentro do prazo com atenção necessária na aprovação de projeto e gestão de recebíveis.",
      pontos_ok: [
        "Contrato assinado e valor definido",
        "Equipe alocada e disponível",
        "Materiais em processo de compra",
        "Comunicação ativa com o cliente",
      ],
      pontos_atencao: [
        "Projeto executivo ainda pendente de aprovação — risco de atraso no Gate 2",
        "Primeira vistoria não realizada — agendar com urgência",
        "Içamento a confirmar — pode impactar logística",
        "Nenhuma parcela marcada como paga",
      ],
      atualizado_em: new Date().toLocaleString("pt-BR"),
    };
    onDetailsChange({ ia_analysis: mock });
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center gap-2 mb-4">
          <Bot size={16} style={{ color: GOLD }} />
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Análise do Agente IA</p>
          <button onClick={generate} disabled={generating} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ fontSize: "0.55rem", background: "rgba(212,168,83,0.1)", color: GOLD, border: `1px solid ${GOLD}30`, cursor: generating ? "default" : "pointer" }}>
            {generating ? <><Loader2 size={10} className="animate-spin" />Analisando...</> : <><RotateCcw size={10} />Atualizar análise</>}
          </button>
        </div>

        {!ia ? (
          <div className="text-center py-8">
            <Bot size={32} style={{ color: TEXT_DIM, margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.72rem", color: TEXT_DIM, marginBottom: 12 }}>Nenhuma análise gerada ainda.</p>
            <button onClick={generate} className="rounded-lg px-4 py-2" style={{ fontSize: "0.65rem", background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
              Gerar Análise IA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ia.resumo && (
              <div className="rounded-xl p-4" style={{ background: "rgba(212,168,83,0.05)", border: "1px solid rgba(212,168,83,0.15)" }}>
                <p style={{ fontSize: "0.72rem", color: "white", lineHeight: 1.7 }}>{ia.resumo}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} style={{ color: GREEN }} />
                  <span style={{ fontSize: "0.6rem", fontWeight: 600, color: GREEN }}>Sob controle</span>
                </div>
                <div className="space-y-2">
                  {ia.pontos_ok.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check size={10} style={{ color: GREEN, flexShrink: 0, marginTop: 3 }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_MED, lineHeight: 1.5 }}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} style={{ color: RED }} />
                  <span style={{ fontSize: "0.6rem", fontWeight: 600, color: RED }}>Pontos de atenção</span>
                </div>
                <div className="space-y-2">
                  {ia.pontos_atencao.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={10} style={{ color: RED, flexShrink: 0, marginTop: 3 }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_MED, lineHeight: 1.5 }}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {ia.atualizado_em && (
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, textAlign: "right" }}>Análise atualizada em {ia.atualizado_em}</p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Google Drive ── */
function TabDrive({ card, onDetailsChange }: {
  card: DbCard;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const det = (card.details as ProjetoDetails) ?? {};
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const vinculateFromLink = async () => {
    if (!linkInput.trim()) return;
    setSaving(true);
    // Extract folder ID from Drive link
    const match = linkInput.match(/[-\w]{25,}/);
    const folderId = match ? match[0] : linkInput.trim();
    const updates: Partial<ProjetoDetails> = {
      drive_folder_id: folderId,
      drive_folder_url: linkInput.trim().startsWith("http") ? linkInput.trim() : `https://drive.google.com/drive/folders/${folderId}`,
      drive_folder_created_at: new Date().toISOString(),
    };
    onDetailsChange(updates);
    const merged = { ...card.details ?? {}, ...updates };
    await supabase.from("kanban_cards").update({ details: merged }).eq("id", card.id);
    setSaving(false);
    setShowLinkInput(false);
    setLinkInput("");
  };

  const removeFolder = async () => {
    if (!confirm("Desvincular pasta do Drive?")) return;
    const updates: Partial<ProjetoDetails> = {
      drive_folder_id: undefined,
      drive_folder_url: undefined,
      drive_folder_created_at: undefined,
    };
    onDetailsChange(updates);
    const { drive_folder_id, drive_folder_url, drive_folder_created_at, ...rest } = (card.details as ProjetoDetails) ?? {};
    await supabase.from("kanban_cards").update({ details: rest }).eq("id", card.id);
  };

  if (det.drive_folder_id) {
    return (
      <div className="space-y-4">
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen size={15} style={{ color: "#4285F4" }} />
              <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>Google Drive</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={det.drive_folder_url ?? `https://drive.google.com/drive/folders/${det.drive_folder_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{ fontSize: "0.6rem", fontWeight: 600, color: "#4285F4", background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.25)", textDecoration: "none" }}
              >
                <ExternalLink size={11} /> Abrir no Drive
              </a>
              <button onClick={removeFolder} className="rounded-lg px-2 py-1.5" style={{ fontSize: "0.55rem", color: RED, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "rgba(66,133,244,0.04)", border: "1px solid rgba(66,133,244,0.15)" }}>
            <p style={{ fontSize: "0.65rem", color: "white", fontWeight: 500 }}>Pasta vinculada</p>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4 }}>ID: {det.drive_folder_id}</p>
            {det.drive_folder_created_at && (
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>
                Vinculada em {new Date(det.drive_folder_created_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <div style={{ padding: "32px", textAlign: "center" }}>
          <FolderOpen size={28} style={{ color: "#4285F4", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "0.65rem", color: TEXT_MED, marginBottom: 16 }}>
            Vincule a pasta do Google Drive deste projeto para acesso rápido aos arquivos.
          </p>
          {!showLinkInput ? (
            <button
              onClick={() => setShowLinkInput(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 mx-auto"
              style={{ fontSize: "0.65rem", fontWeight: 600, color: "#4285F4", background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.25)" }}
            >
              <FolderOpen size={13} />
              Vincular pasta existente do Drive
            </button>
          ) : (
            <div className="flex gap-2 items-center" style={{ maxWidth: 500, margin: "0 auto" }}>
              <input
                autoFocus
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && vinculateFromLink()}
                placeholder="Cole o link da pasta do Drive..."
                className="flex-1 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
              />
              <button
                onClick={vinculateFromLink}
                disabled={saving || !linkInput.trim()}
                className="flex items-center gap-1 rounded-lg px-3 py-2"
                style={{ fontSize: "0.6rem", fontWeight: 600, color: GREEN, background: `${GREEN}15`, border: `1px solid ${GREEN}30` }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Vincular
              </button>
              <button onClick={() => { setShowLinkInput(false); setLinkInput(""); }} className="rounded-lg px-2 py-2" style={{ color: TEXT_DIM }}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Dados Comerciais (CRM) ── */
function TabComercial({ card, details }: { card: DbCard; details: ProjetoDetails }) {
  const d = details;
  const hasContato = d.celular || d.telefone_comercial || d.telefone_residencial || d.email || d.contato_principal;
  const hasProjeto = d.cidade || d.metragem_estimada || d.produto_interesse || d.faixa_investimento || d.endereco_obra || d.valor_orcamento_enviado;
  const hasFunil = d.vendedor || d.status_lead || d.funil_vendas || d.data_proposta;
  const hasQualificacao = d.resumo_qualificacao || d.overview_ia;
  const hasOrcamento = d.orc_tipo_produto || d.orc_metragem_real || d.orc_valor_total;

  function CField({ label, value }: { label: string; value?: string | null }) {
    return (
      <div className="flex flex-col gap-1">
        <span style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: value ? "rgba(255,255,255,0.8)" : TEXT_DIM }}>{value || "—"}</span>
      </div>
    );
  }

  if (!hasContato && !hasProjeto && !hasFunil && !hasQualificacao && !hasOrcamento) {
    return (
      <SectionCard>
        <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "2rem 0" }}>
          Nenhum dado comercial registrado. Os dados aparecem quando o CRM preenche as informações do lead.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {hasContato && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Contato do Cliente</p>
          <div className="grid grid-cols-2 gap-4">
            <CField label="Nome / Contato Principal" value={d.contato_principal || card.title} />
            <CField label="Celular" value={d.celular} />
            <CField label="Telefone Comercial" value={d.telefone_comercial} />
            <CField label="Telefone Residencial" value={d.telefone_residencial} />
            <CField label="Email" value={d.email} />
            <div style={{ gridColumn: "1 / -1" }}>
              <CField label="Outro Email" value={d.outro_email} />
            </div>
          </div>
        </SectionCard>
      )}

      {hasProjeto && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Dados do Projeto (Comercial)</p>
          <div className="grid grid-cols-2 gap-4">
            <CField label="Cidade" value={d.cidade} />
            <CField label="Metragem Estimada" value={d.metragem_estimada} />
            <CField label="Produto de Interesse" value={d.produto_interesse} />
            <CField label="Faixa de Investimento" value={d.faixa_investimento} />
            <CField label="Relação com a Obra" value={d.relacao_obra} />
            <CField label="Arquitetura" value={d.arquitetura} />
            <div style={{ gridColumn: "1 / -1" }}>
              <CField label="Endereço da Obra" value={d.endereco_obra} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <CField label="Valor Orçamento Enviado" value={d.valor_orcamento_enviado || (card as Record<string, unknown>).value as string} />
            </div>
          </div>
        </SectionCard>
      )}

      {hasFunil && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Funil Comercial</p>
          <div className="grid grid-cols-2 gap-4">
            <CField label="Vendedor" value={d.vendedor || card.responsavel} />
            <CField label="Status do Lead" value={d.status_lead} />
            <CField label="Funil de Vendas" value={d.funil_vendas} />
            <CField label="Data da Proposta" value={d.data_proposta} />
            <CField label="Data de Criação" value={d.data_criada} />
            <CField label="Próxima Tarefa" value={d.proxima_tarefa} />
            <CField label="Próxima Consulta" value={d.proxima_consulta} />
            <CField label="Modificado por" value={d.modificado_por} />
          </div>
        </SectionCard>
      )}

      {hasQualificacao && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Qualificação do Lead</p>
          {d.resumo_qualificacao && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Resumo de Qualificação</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.resumo_qualificacao}</p>
            </div>
          )}
          {d.overview_ia && (
            <div>
              <p style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overview IA</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.overview_ia}</p>
            </div>
          )}
        </SectionCard>
      )}

      {hasOrcamento && (
        <SectionCard>
          <p className="tracking-[0.15em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Orçamento</p>
          <div className="grid grid-cols-2 gap-4">
            <CField label="Tipo de Produto / Linha" value={d.orc_tipo_produto} />
            <CField label="Metragem Real (confirmada)" value={d.orc_metragem_real} />
            <CField label="Ambientes" value={d.orc_ambientes} />
            <CField label="Material Especificado" value={d.orc_material} />
            <CField label="Espessura / Acabamento" value={d.orc_espessura} />
            <CField label="Paginação / Padrão" value={d.orc_paginacao} />
            <CField label="Valor Material (R$)" value={d.orc_valor_material} />
            <CField label="Valor Mão de Obra (R$)" value={d.orc_valor_mao_obra} />
            <CField label="Valor Total Orçamento" value={d.orc_valor_total} />
            <CField label="Prazo de Entrega" value={d.orc_prazo_entrega} />
            <CField label="Fornecedor Sugerido" value={d.orc_fornecedor} />
            {d.orc_observacoes && (
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Observações do Orçamentista</p>
                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.orc_observacoes}</p>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ── WhatsApp Cliente ── */
function TabWhatsAppCliente({ card }: { card: DbCard }) {
  const det = (card.details as ProjetoDetails) ?? {};
  const phone = det.celular || det.telefone_comercial || det.contato_responsavel || null;
  const contactName = det.contato_principal || card.title;

  if (!phone) {
    return (
      <SectionCard>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: "32px 0" }}>
          Nenhum telefone do cliente registrado. Preencha o campo "Celular" nos dados comerciais.
        </p>
      </SectionCard>
    );
  }

  // Normalize phone number
  const cleanPhone = phone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone}`;

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle size={15} style={{ color: GREEN }} />
          <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT }}>WhatsApp Cliente</p>
        </div>
        <div className="rounded-xl p-6 text-center" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: `${GREEN}20`, fontSize: "1.2rem", fontWeight: 700, color: GREEN }}>
            {contactName.charAt(0)}
          </div>
          <p style={{ fontSize: "0.8rem", color: "white", fontWeight: 600, marginBottom: 4 }}>{contactName}</p>
          <p style={{ fontSize: "0.65rem", color: TEXT_MED, marginBottom: 16 }}>{phone}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5"
            style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", background: GREEN, textDecoration: "none" }}
          >
            <MessageCircle size={14} />
            Abrir conversa no WhatsApp
          </a>
        </div>
        {det.grupo_whatsapp && (
          <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 6 }}>Grupo WhatsApp do projeto</p>
            <a
              href={det.grupo_whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              style={{ fontSize: "0.65rem", color: GREEN, textDecoration: "none" }}
            >
              <Users size={12} /> Abrir grupo
            </a>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Registro Fotográfico ── */
function MediaGallery({ card, onDetailsChange }: {
  card: DbCard;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const det = (card.details as ProjetoDetails) ?? {};
  const [items, setItems] = useState(det.media_gallery ?? []);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCat, setSelectedCat] = useState("Geral");
  const [selectedAmbiente, setSelectedAmbiente] = useState("");
  const [description, setDescription] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveGallery = async (updated: typeof items) => {
    setItems(updated);
    onDetailsChange({ media_gallery: updated });
    const merged = { ...card.details ?? {}, media_gallery: updated };
    await supabase.from("kanban_cards").update({ details: merged }).eq("id", card.id);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return;
    setUploading(true);
    const newItems: typeof items = [];
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${card.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await uploadToStorage("obra-media", path, file);
      if (url) {
        newItems.push({
          id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url,
          type: isVideo ? "video" : "foto",
          caption: file.name.replace(/\.[^.]+$/, ""),
          description,
          categoria: selectedCat,
          produtos: [],
          ambiente: selectedAmbiente,
          date: new Date().toISOString(),
        });
      }
    }
    if (newItems.length) await saveGallery([...items, ...newItems]);
    setUploading(false);
    setShowUpload(false);
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeItem = async (id: string) => {
    await saveGallery(items.filter(i => i.id !== id));
  };

  const getGroupKey = (item: typeof items[number]) => {
    const parts: string[] = [];
    if (item.ambiente) parts.push(item.ambiente);
    if (item.produtos?.length) parts.push(item.produtos.join(", "));
    else if (item.categoria && item.categoria !== "Geral") parts.push(item.categoria);
    return parts.length > 0 ? parts.join(" — ") : "Geral";
  };

  const groups = [...new Set(items.map(getGroupKey))];

  const catColors: Record<string, string> = {
    Piso: GREEN, Forro: BLUE, Deck: ORANGE, Painel: PURPLE, Porta: ACCENT,
    Escada: "#EC4899", Marcenaria: TEAL, Geral: ACCENT, Antes: "#6B7280",
    Depois: GREEN, Vistoria: YELLOW, Entrega: GREEN, "Rodapé": "#6B7280",
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.12em", color: ACCENT, textTransform: "uppercase" }}>Registro Fotográfico</span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: 8 }}>
            {items.length} arquivo{items.length !== 1 ? "s" : ""} · {groups.length} categoria{groups.length !== 1 ? "s" : ""}
          </span>
        </div>
        <label style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7,
          fontSize: "0.6rem", fontWeight: 600, cursor: uploading ? "wait" : "pointer",
          background: "rgba(59,130,246,0.1)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)",
        }}>
          {uploading ? "Enviando..." : "Adicionar Fotos / Vídeos"}
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleFiles} hidden />
        </label>
      </div>

      {groups.length > 0 ? groups.map(group => {
        const groupItems = items.filter(i => getGroupKey(i) === group);
        const isOpen = openCategory === group || openCategory === null;
        const catColor = catColors[groupItems[0]?.categoria ?? ""] ?? ACCENT;

        return (
          <div key={group} className="mb-3">
            <button
              onClick={() => setOpenCategory(openCategory === group ? null : group)}
              className="flex items-center gap-2 w-full mb-2"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: `${catColor}30`, border: `1.5px solid ${catColor}` }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: catColor }}>{group}</span>
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>({groupItems.length})</span>
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: "auto" }}>{isOpen ? "\u25BE" : "\u25B8"}</span>
            </button>
            {isOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {groupItems.map(item => (
                  <div key={item.id} className="rounded-lg overflow-hidden relative group" style={{ border: `1px solid ${BORDER}`, background: CARD_BG }}>
                    {item.type === "video" ? (
                      <video src={item.url} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                    ) : (
                      <img src={item.url} alt={item.caption} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                    )}
                    <div style={{ padding: "6px 8px" }}>
                      {item.caption && <p style={{ fontSize: "0.55rem", color: TEXT_MED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.caption}</p>}
                      {item.date && <p style={{ fontSize: "0.45rem", color: TEXT_DIM }}>{new Date(item.date).toLocaleDateString("pt-BR")}</p>}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                    >
                      <Trash2 size={10} style={{ color: RED }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }) : (
        <div className="rounded-xl p-6 text-center" style={{ border: `1px dashed ${BORDER}` }}>
          <Camera size={24} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Adicione registros fotográficos da obra</p>
        </div>
      )}
    </div>
  );
}

/* ── Prestadores / Equipes de Campo (sub-componente para TabEquipe) ── */
function PrestadoresSection({ card, details, editing, onDetailsChange }: {
  card: DbCard; details: ProjetoDetails; editing: boolean;
  onDetailsChange: (d: Partial<ProjetoDetails>) => void;
}) {
  const prestadores = details.prestadores ?? [];
  const { porCategoria, loading: loadingEquipes, membros } = useEquipesParket();
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const addPrestador = (m: EquipeMembro) => {
    if (prestadores.some(p => p.id === m.id)) return;
    onDetailsChange({
      prestadores: [...prestadores, { id: m.id, nome: m.nome, telefone: m.telefone || undefined, categoria: m.categoria }],
    });
  };

  const removePrestador = (id: string) => {
    onDetailsChange({ prestadores: prestadores.filter(p => p.id !== id) });
  };

  const updatePrestador = (id: string, changes: Partial<typeof prestadores[number]>) => {
    onDetailsChange({ prestadores: prestadores.map(p => p.id === id ? { ...p, ...changes } : p) });
  };

  // Group by category
  const byCategory = new Map<string, typeof prestadores>();
  for (const p of prestadores) {
    const arr = byCategory.get(p.categoria) || [];
    arr.push(p);
    byCategory.set(p.categoria, arr);
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-4">
        <p className="tracking-[0.15em] uppercase" style={{ fontSize: "0.5rem", color: ORANGE }}>Prestadores / Equipes de Campo</p>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{prestadores.length} alocado(s)</span>
          {editing && (
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
              style={{ fontSize: "0.6rem", background: `${ORANGE}15`, color: ORANGE, border: `1px solid ${ORANGE}30` }}
            >
              <Plus size={10} /> Adicionar Prestador
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, maxHeight: 300, overflowY: "auto" }}>
          <input
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou categoria..."
            className="w-full px-3 py-1.5 rounded-lg text-sm bg-black/40 text-white outline-none"
            style={{ border: `1px solid ${BORDER}`, fontSize: "0.65rem" }}
          />
          {loadingEquipes ? (
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: 8 }}>Carregando...</p>
          ) : (
            porCategoria
              .filter(cat => cat.membros.some(m => m.ativo && (!searchTerm || m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || m.categoria.toLowerCase().includes(searchTerm.toLowerCase()))))
              .map(cat => (
                <div key={cat.categoria}>
                  <p style={{ fontSize: "0.5rem", color: ACCENT, fontWeight: 700, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.1em" }}>{cat.categoria}</p>
                  {cat.membros
                    .filter(m => m.ativo && (!searchTerm || m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || m.categoria.toLowerCase().includes(searchTerm.toLowerCase())))
                    .map(m => {
                      const already = prestadores.some(p => p.id === m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => !already && addPrestador(m)}
                          disabled={already}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left"
                          style={{ opacity: already ? 0.4 : 1 }}
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ORANGE, fontSize: "0.45rem", fontWeight: 700, color: "black" }}>
                            {m.nome.charAt(0)}
                          </div>
                          <span style={{ fontSize: "0.65rem", color: "white" }}>Eq. {m.nome}</span>
                          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>-- {m.categoria}</span>
                          {m.telefone && <span style={{ fontSize: "0.55rem", color: TEXT_DIM, marginLeft: "auto" }}>{m.telefone}</span>}
                          {already && <Check size={10} style={{ color: GREEN, marginLeft: "auto" }} />}
                        </button>
                      );
                    })}
                </div>
              ))
          )}
          <button onClick={() => setShowPicker(false)} className="w-full rounded-lg py-1.5 mt-1" style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            Fechar
          </button>
        </div>
      )}

      {prestadores.length === 0 ? (
        <p style={{ fontSize: "0.7rem", color: TEXT_DIM, textAlign: "center", padding: "1rem 0" }}>Nenhum prestador alocado neste projeto.</p>
      ) : (
        <div className="space-y-2">
          {[...byCategory.entries()].map(([cat, members]) => (
            <div key={cat}>
              <p style={{ fontSize: "0.48rem", color: ORANGE, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{cat}</p>
              {members.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg mb-1" style={{ background: `${ORANGE}06`, border: `1px solid ${ORANGE}15` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${ORANGE}20`, fontSize: "0.55rem", fontWeight: 700, color: ORANGE }}>
                    {p.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "0.7rem", color: "white", fontWeight: 500 }}>
                      Eq. {p.nome} <span style={{ fontSize: "0.58rem", color: TEXT_DIM, fontWeight: 400 }}>-- {p.categoria}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {p.telefone && (
                        <a
                          href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1 hover:text-green-400"
                          style={{ fontSize: "0.58rem", color: TEXT_DIM }}
                        >
                          <Phone size={9} /> {p.telefone}
                        </a>
                      )}
                      {p.data_entrada && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Desde: {p.data_entrada}</span>}
                    </div>
                    {p.observacao && <p style={{ fontSize: "0.58rem", color: TEXT_MED, marginTop: 1 }}>{p.observacao}</p>}
                  </div>
                  {editing && (
                    <div className="flex gap-1 flex-shrink-0">
                      <input
                        type="date"
                        value={p.data_entrada || ""}
                        onChange={e => updatePrestador(p.id, { data_entrada: e.target.value })}
                        className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-white border border-white/10 outline-none"
                        style={{ fontSize: "0.5rem", width: 100 }}
                      />
                      <button onClick={() => removePrestador(p.id)} style={{ color: RED, cursor: "pointer", padding: 2 }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ════════════════════════════════════════════════════════════ */
export function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<DbCard | null>(null);
  const [details, setDetails] = useState<ProjetoDetails>({});
  const [siblingCards, setSiblingCards] = useState<DbCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const { alertas: allAlertas } = useAlertas();
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [handoffActing, setHandoffActing] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [acceptObs, setAcceptObs] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("kanban_cards").select("*").eq("id", id).single();
    if (data) {
      const c = data as DbCard;
      setCard(c);
      setDetails(c.details as ProjetoDetails ?? {});
      // Load sibling cards from all other depts with same obra
      if (c.obra) {
        const { data: siblings } = await supabase
          .from("kanban_cards")
          .select("*")
          .eq("obra", c.obra)
          .neq("id", c.id);
        setSiblingCards((siblings ?? []) as DbCard[]);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for live updates on this card and siblings
  useEffect(() => {
    if (!card?.obra) return;
    const channel = supabase
      .channel(`projeto-detalhe-${card.obra}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: `obra=eq.${card.obra}` }, (payload) => {
        if (payload.new && (payload.new as DbCard).id !== card.id) {
          setSiblingCards(prev => prev.map(s => s.id === (payload.new as DbCard).id ? payload.new as DbCard : s));
        } else if (payload.new && (payload.new as DbCard).id === card.id) {
          const updated = payload.new as DbCard;
          setCard(updated);
          setDetails(updated.details as ProjetoDetails ?? {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [card?.obra, card?.id]);

  const handleDetailsChange = useCallback((partial: Partial<ProjetoDetails>) => {
    setDetails(prev => ({ ...prev, ...partial }));
  }, []);

  const save = async () => {
    if (!card) return;
    setSaving(true);
    await supabase.from("kanban_cards").update({ details }).eq("id", card.id);
    setSaving(false);
    setEditing(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const cancelEdit = () => {
    if (card) setDetails(card.details as ProjetoDetails ?? {});
    setEditing(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} />
        <span style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Carregando projeto...</span>
      </div>
    </div>
  );

  if (!card) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="text-center">
        <p style={{ color: TEXT_DIM, fontSize: "0.8rem" }}>Projeto não encontrado.</p>
        <button onClick={() => navigate(-1)} className="mt-4 rounded-lg px-4 py-2" style={{ fontSize: "0.65rem", background: `${ACCENT}15`, color: ACCENT }}>Voltar</button>
      </div>
    </div>
  );

  const statusColor = details.status_projeto === "concluido" ? GREEN : details.status_projeto === "em andamento" ? BLUE : YELLOW;
  const cardDet = card.details as Record<string, unknown> | undefined;
  const isPendingAcceptance = cardDet?.handoff_status === "pending_acceptance";
  const handoffFromDept = cardDet?.handoff_from_dept as string | undefined;

  const handleAccept = async () => {
    setHandoffActing(true);
    await acceptHandoff(card.id, "Usuário", acceptObs.trim() || undefined);
    await load();
    setHandoffActing(false);
    setAcceptObs("");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) return;
    setHandoffActing(true);
    await returnHandoff(card.id, returnReason.trim(), "Usuário");
    setHandoffActing(false);
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 sticky top-0 z-40" style={{ background: "rgba(10,10,10,0.95)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-4 px-6 py-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all" style={{ fontSize: "0.6rem", color: TEXT_MED, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
            <ArrowLeft size={12} />Voltar
          </button>

          <div className="flex items-center gap-3 flex-1">
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: ACCENT }}>{card.obra ?? card.id.slice(0, 8)}</span>
            <h1 className="text-white truncate" style={{ fontSize: "0.9rem", fontWeight: 600 }}>{card.title}</h1>
            {card.subtitle && <span style={{ fontSize: "0.7rem", color: TEXT_DIM }}>{card.subtitle}</span>}
          </div>

          <div className="flex items-center gap-2">
            {card.gate !== undefined && (
              <Badge label={`Gate ${card.gate}`} color={GOLD} bg="rgba(212,168,83,0.12)" />
            )}
            {details.status_projeto && (
              <Badge label={details.status_projeto} color={statusColor} bg={`${statusColor}15`} />
            )}
            {card.priority === "alta" && (
              <Badge label="PRIORIDADE ALTA" color={RED} bg="rgba(239,68,68,0.1)" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                  <X size={12} />Cancelar
                </button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-1.5" style={{ fontSize: "0.6rem", fontWeight: 600, color: "white", background: saving ? "rgba(16,185,129,0.4)" : GREEN, border: "none", cursor: saving ? "default" : "pointer" }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", fontWeight: 500, color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}>
                <Edit3 size={12} />Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Banner de Validação de Recebimento ── */}
      {isPendingAcceptance && (
        <div className="flex-shrink-0 px-6 py-4" style={{ background: "rgba(245,158,11,0.06)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
          {!showReturnForm ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: YELLOW }} />
                <div className="flex-1">
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: YELLOW }}>
                    Handoff pendente — aguardando validação de recebimento
                    {handoffFromDept && <span style={{ fontWeight: 400, color: TEXT_MED }}> · enviado por <strong>{handoffFromDept.toUpperCase()}</strong></span>}
                  </p>
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>
                    Revise as informações do projeto. Ao aceitar ou recusar, o setor de origem será notificado automaticamente pelo agente de IA no WhatsApp.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  value={acceptObs}
                  onChange={e => setAcceptObs(e.target.value)}
                  placeholder="Observação ao aceitar (opcional) — será enviada no WhatsApp..."
                  className="flex-1 rounded-lg px-3 py-2 outline-none"
                  style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
                />
                <button
                  onClick={handleAccept}
                  disabled={handoffActing}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 transition-all flex-shrink-0"
                  style={{ fontSize: "0.65rem", fontWeight: 600, background: "rgba(16,185,129,0.15)", color: GREEN, border: "1px solid rgba(16,185,129,0.3)", cursor: handoffActing ? "default" : "pointer" }}
                >
                  {handoffActing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aceitar Handoff
                </button>
                <button
                  onClick={() => setShowReturnForm(true)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 transition-all flex-shrink-0"
                  style={{ fontSize: "0.65rem", fontWeight: 600, background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }}
                >
                  <AlertTriangle size={12} />
                  Recusar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <AlertTriangle size={16} style={{ color: RED, flexShrink: 0, marginTop: 3 }} />
              <div className="flex-1">
                <p style={{ fontSize: "0.7rem", fontWeight: 600, color: RED, marginBottom: 8 }}>
                  Informe o motivo da devolução
                </p>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="Descreva o que precisa ser revisado ou corrigido pelo setor anterior..."
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 outline-none resize-none"
                  style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.3)", color: "white" }}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-6">
                <button
                  onClick={handleReturn}
                  disabled={!returnReason.trim() || handoffActing}
                  className="flex items-center gap-2 rounded-lg px-4 py-2"
                  style={{ fontSize: "0.65rem", fontWeight: 600, background: returnReason.trim() ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", color: returnReason.trim() ? RED : TEXT_DIM, border: `1px solid ${returnReason.trim() ? "rgba(239,68,68,0.3)" : BORDER}`, cursor: returnReason.trim() ? "pointer" : "default" }}
                >
                  {handoffActing ? <Loader2 size={12} className="animate-spin" /> : null}
                  Confirmar Devolução
                </button>
                <button
                  onClick={() => { setShowReturnForm(false); setReturnReason(""); }}
                  className="rounded-lg px-3 py-2"
                  style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Body: Sidebar + Conteúdo ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de navegação */}
        <div className="flex-shrink-0 overflow-y-auto py-4" style={{ width: 200, borderRight: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const alertBadge = tab.id === "alertas" && card
              ? allAlertas.filter(a => a.obra_id === card.id || a.obra_id === card.obra).length
              : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-all text-left"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? ACCENT : TEXT_DIM,
                  background: active ? `${ACCENT}08` : "transparent",
                  borderRight: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                }}
              >
                <Icon size={13} />
                <span className="flex-1">{tab.label}</span>
                {alertBadge > 0 && (
                  <span className="rounded-full w-4 h-4 flex items-center justify-center shrink-0" style={{ fontSize: "0.4rem", fontWeight: 700, background: `${RED}25`, color: RED }}>
                    {alertBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da tab */}
        <div className="flex-1 overflow-y-auto p-6">
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {activeTab === "overview" && <TabOverview card={card} details={details} editing={editing} onDetailsChange={handleDetailsChange} />}
            {activeTab === "gates" && <TabGates card={card} editing={editing} />}
            {activeTab === "checklist" && <TabChecklist card={card} />}
            {activeTab === "financeiro" && <TabFinanceiro card={card} />}
            {activeTab === "orcamentos" && <TabOrcamentos card={card} />}
            {activeTab === "materiais" && <TabMateriais card={card} details={details} editing={editing} onDetailsChange={handleDetailsChange} />}
            {activeTab === "equipe" && <TabEquipe card={card} details={details} editing={editing} onDetailsChange={handleDetailsChange} />}
            {activeTab === "handoffs"  && <TabHandoffs card={card} />}
            {activeTab === "cronograma" && <TabCronograma card={card} onDetailsChange={handleDetailsChange} />}
            {activeTab === "agendamentos" && <TabAgendamentos card={card} siblingCards={siblingCards} onDetailsChange={handleDetailsChange} />}
            {activeTab === "relatorios" && <TabRelatorios card={card} siblingCards={siblingCards} onDetailsChange={handleDetailsChange} />}
            {activeTab === "setores" && <TabSetores card={card} siblingCards={siblingCards} />}
            {activeTab === "historico" && <TabHistorico card={card} />}
            {activeTab === "contratos" && <TabContratos card={card} />}
            {activeTab === "documentos" && <TabDocumentos details={details} editing={editing} onDetailsChange={handleDetailsChange} />}
            {activeTab === "drive" && <TabDrive card={card} onDetailsChange={handleDetailsChange} />}
            {activeTab === "comercial" && <TabComercial card={card} details={details} />}
            {activeTab === "whatsapp_cliente" && <TabWhatsAppCliente card={card} />}
            {activeTab === "chat" && <TabChat card={card} />}
            {activeTab === "ia" && <TabIA details={details} editing={editing} onDetailsChange={handleDetailsChange} />}
            {activeTab === "alertas" && <TabAlertas card={card} />}
          </div>
        </div>
      </div>

      {/* ── Toast de salvo ── */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: `${GREEN}15`, border: `1px solid ${GREEN}30`, backdropFilter: "blur(12px)" }}>
          <Check size={14} style={{ color: GREEN }} />
          <span style={{ fontSize: "0.65rem", fontWeight: 500, color: GREEN }}>Projeto salvo com sucesso!</span>
        </div>
      )}
    </div>
  );
}
