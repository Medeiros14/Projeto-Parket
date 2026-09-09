/**
 * Simulador de Orçamento — Parket
 * Redesigned: lista de simulações salvas + editor vinculado a obras
 */
import React from "react";
import { CARD_BG, BORDER, ACCENT, TEXT_DIM, TEXT_MED, YELLOW, GREEN, BLUE, PURPLE, ORANGE, RED } from "../components/dept-layout";
import { Calculator, ChevronRight, ChevronLeft, Plus, Trash2, Download, CheckCircle2, Package, RefreshCw, FileDown, ArrowLeft, Search } from "lucide-react";
import { useTabelaPrecos, TabelaPreco } from "./orcamento-tabela-admin-tab";
import { abrirPropostaParaImpressao } from "../lib/propostaGenerator";
import { useOrcamento, SimulacaoProjeto } from "../hooks/useOrcamento";
import { supabase } from "../lib/supabase";
import type { DbCard } from "../hooks/useKanbanCards";

// ─── TABELAS DE PREÇOS ──────────────────────────────────────────────────────

const CORES_TAUARI = [
  "Naturalle","Mont Blanc","Marrone","Capuccino","Baby Grey",
  "Grigio Nero","Light Brown","Milano","Smoked","Giz",
  "Snow","Armani","Nevado","Italy Brown","Batman",
];
const CORES_CARVALHO = [
  "Naturalle","Mont Blanc","Marrone","Capuccino","Baby Grey",
  "Grigio Nero","Light Brown","Milano","Smoked","Giz",
  "Snow","Armani","Nevado","Italy Brown","Batman",
];

// Preços indexados por [especie][dimensao] = R$/m²
type PrecoMap = Record<string, Record<string, number>>;

// Dimensões de Pisos
const DIM_PISOS_NAC = [
  { id: "15/3x100",  label: "Régua 15/3 × 100mm",           obs: "" },
  { id: "15/3x150",  label: "Régua 15/3 × 150mm",           obs: "" },
  { id: "15/3x190",  label: "Régua 15/3 × 190mm",           obs: "" },
  { id: "15/3x190var", label: "Régua 15/3 × 190 × comp. variável", obs: "" },
  { id: "19/4x300",  label: "Régua 19/4 × 300mm",           obs: "" },
  { id: "ep120",     label: "Espinha de Peixe 1/6 × 120mm", obs: "+20% perda" },
  { id: "ep190",     label: "Espinha de Peixe 1/6 × 190mm", obs: "+20% perda" },
  { id: "chev125",   label: "Chevron 15/3 × 125 × 740mm",   obs: "+20% quebra" },
  { id: "chev190",   label: "Chevron 15/3 × 190 × 740mm",   obs: "+20% quebra" },
];

const DIM_PISOS_IMP = [
  { id: "15/3x125",  label: "Régua 15/3 × 125 × 1200mm",   obs: "" },
  { id: "15/3x190",  label: "Régua 15/3 × 190 × 1900mm",   obs: "" },
  { id: "20/6x30",   label: "Régua 20/6 × 30cm × 4000mm",  obs: "" },
  { id: "20/6x400",  label: "Régua 20/6 × 400 × 5000mm",   obs: "" },
  { id: "ep120",     label: "Espinha de Peixe 1/6 × 120mm", obs: "+20% perda" },
  { id: "ep190",     label: "Espinha de Peixe 1/6 × 190mm", obs: "+20% perda" },
  { id: "chev125",   label: "Chevron 15/3 × 125 × 740mm",   obs: "+20% quebra" },
  { id: "chev190",   label: "Chevron 15/3 × 190 × 740mm",   obs: "+20% quebra" },
];

const DIM_FORRO_NAC = [
  { id: "15/3x100", label: "Régua 15/3 × 100mm", obs: "" },
  { id: "15/3x150", label: "Régua 15/3 × 150mm", obs: "" },
  { id: "15/3x190", label: "Régua 15/3 × 190mm", obs: "" },
  { id: "15/3x190var", label: "Régua 15/3 × 190 × comp. variável", obs: "" },
  { id: "19/4x300", label: "Régua 19/4 × 300mm", obs: "" },
];

const DIM_FORRO_IMP = [
  { id: "15/3x125", label: "Régua 15/3 × 125 × 1200mm", obs: "" },
  { id: "15/3x190", label: "Régua 15/3 × 190 × 1900mm", obs: "" },
  { id: "15/3x190var", label: "Régua 15/3 × 190 × comp. variável", obs: "" },
  { id: "20/6x30",  label: "Régua 20/6 × 30cm × 4000mm", obs: "" },
  { id: "20/6x400", label: "Régua 20/6 × 400 × 5000mm", obs: "" },
];

const DIM_PAINEIS_IMP = [
  { id: "15/3x125", label: "Régua 15/3 × 125 × 1200mm", obs: "" },
  { id: "15/3x190", label: "Régua 15/3 × 190 × 1900mm", obs: "" },
  { id: "15/3x190var", label: "Régua 15/3 × 190 × comp. variável", obs: "" },
  { id: "20/6x30",  label: "Régua 20/6 × 30cm × 4000mm", obs: "" },
  { id: "20/6x400", label: "Régua 20/6 × 400 × 5000mm", obs: "" },
];

// ── Pisos Nacionais ──
const PISOS_NAC_PRECOS: PrecoMap = {
  tauari:    { "15/3x100": 850,  "15/3x150": 940,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2450, ep120: 1050, ep190: 1200, chev125: 1380, chev190: 1480 },
  sucupira:  { "15/3x100": 850,  "15/3x150": 940,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2450, ep120: 1050, ep190: 1200, chev125: 1380, chev190: 1480 },
  perobinha: { "15/3x100": 850,  "15/3x150": 940,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2450, ep120: 1050, ep190: 1200, chev125: 1380, chev190: 1480 },
  cumaru:    { "15/3x100": 850,  "15/3x150": 985,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2450, ep120: 1050, ep190: 1200, chev125: 1380, chev190: 1480 },
  catuaba:   { "15/3x100": 850,  "15/3x150": 985,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2450, ep120: 1050, ep190: 1200, chev125: 1380, chev190: 1480 },
  loro:      { "15/3x100": 1050, "15/3x150": 985,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2700, ep120: 1350, ep190: 1420, chev125: 1580, chev190: 1650 },
  peroba:    { "15/3x100": 1050, "15/3x150": 985,  "15/3x190": 1050, "15/3x190var": 1050, "19/4x300": 2700, ep120: 1350, ep190: 1420, chev125: 1580, chev190: 1650 },
};

// ── Pisos Importados ──
const PISOS_IMP_PRECOS: PrecoMap = {
  carvalho:  { "15/3x125": 1180, "15/3x190": 1380, "20/6x30": 2850, "20/6x400": 4200, ep120: 1380, ep190: 1450, chev125: 1450, chev190: 1550 },
  nogueira:  { "15/3x125": 1350, "15/3x190": 1590, "20/6x30": 3500, "20/6x400": 4800, ep120: 1590, ep190: 1650, chev125: 1650, chev190: 1720 },
};

// ── Forros Nacionais ──
const FORRO_NAC_PRECOS: PrecoMap = {
  tauari:    { "15/3x100": 1250, "15/3x150": 1340, "15/3x190": 1460, "15/3x190var": 1460, "19/4x300": 4350 },
  sucupira:  { "15/3x100": 1250, "15/3x150": 1340, "15/3x190": 1460, "15/3x190var": 1460, "19/4x300": 4350 },
  perobinha: { "15/3x100": 1250, "15/3x150": 1340, "15/3x190": 1460, "15/3x190var": 1460, "19/4x300": 4350 },
  cumaru:    { "15/3x100": 1250, "15/3x150": 1340, "15/3x190": 1460, "15/3x190var": 1460, "19/4x300": 4350 },
  catuaba:   { "15/3x100": 1250, "15/3x150": 1340, "15/3x190": 1460, "15/3x190var": 1460, "19/4x300": 4350 },
  loro:      { "15/3x100": 1050, "15/3x150": 1180, "15/3x190": 1350, "15/3x190var": 1350, "19/4x300": 4350 },
  peroba:    { "15/3x100": 1050, "15/3x150": 1180, "15/3x190": 1350, "15/3x190var": 1350, "19/4x300": 4350 },
};

// ── Forros Importados ──
const FORRO_IMP_PRECOS: PrecoMap = {
  carvalho:  { "15/3x125": 1550, "15/3x190": 1750, "15/3x190var": 1750, "20/6x30": 4100, "20/6x400": 5060 },
  nogueira:  { "15/3x125": 1800, "15/3x190": 1630, "15/3x190var": 1630, "20/6x30": 4100, "20/6x400": 5060 },
};

// ── Forro Ripado ── (preço único por espécie)
const FORRO_RIPADO_PRECOS: Record<string, number> = {
  catuaba:         1420,
  cabreuva_branca: 1420,
  loro:            1680,
  tauari:          1420,
  freijo:          1680,
  cumaru:          1480,
  sucupira:        1420,
  tauari_custom:   1480,
  peroba:          1680,
};

// ── Forro Toblerone ── (preço único para todas as espécies)
const FORRO_TOBLERONE_PRECOS: Record<string, number> = {
  cumaru:          2480,
  catuaba:         2480,
  cabreuva_branca: 2480,
  cabreuva_dourada:2480,
  tauari:          2480,
  peroba:          2480,
  loro:            2480,
  tauari_custom:   2480,
};

// ── Paineis Nacionais ── (mesmo arquivo que Pisos Nacionais)
const PAINEIS_NAC_PRECOS = PISOS_NAC_PRECOS;

// ── Paineis Importados ──
const PAINEIS_IMP_PRECOS: PrecoMap = {
  carvalho: { "15/3x125": 1480, "15/3x190": 1680, "15/3x190var": 1680, "20/6x30": 3100, "20/6x400": 4450 },
  nogueira: { "15/3x125": 1600, "15/3x190": 1840, "15/3x190var": 1840, "20/6x30": 3750, "20/6x400": 5050 },
};

// ── Decks ── (por produto único = espécie + largura)
interface DeckItem { id: string; nome: string; dimensao: string; preco: number }
const DECKS: DeckItem[] = [
  { id:"cumaru_5",   nome:"Deck Cumaru",         dimensao:"2,5 × 5cm",       preco:1480 },
  { id:"cumaru_10",  nome:"Deck Cumaru",         dimensao:"2,5 × 10cm",      preco:1300 },
  { id:"catuaba_5",  nome:"Deck Catuaba",        dimensao:"2,5 × 5cm",       preco:1480 },
  { id:"catuaba_10", nome:"Deck Catuaba",        dimensao:"2,5 × 10cm",      preco:1300 },
  { id:"loro_5",     nome:"Deck Loro Pardo",     dimensao:"2,5 × 5cm",       preco:1680 },
  { id:"loro_10",    nome:"Deck Loro Pardo",     dimensao:"2,5 × 10cm",      preco:1580 },
  { id:"balsamo_5",  nome:"Deck Bálsamo",        dimensao:"2,5 × 5cm",       preco:1420 },
  { id:"balsamo_10", nome:"Deck Bálsamo",        dimensao:"2,5 × 10cm",      preco:1280 },
  { id:"sucupira_5", nome:"Deck Sucupira",       dimensao:"2,5 × 5cm",       preco:1480 },
  { id:"sucupira_10",nome:"Deck Sucupira",       dimensao:"2,5 × 10cm",      preco:1300 },
  { id:"peroba_5",   nome:"Deck Peroba do Campo",dimensao:"2,5 × 5cm",       preco:1480 },
  { id:"peroba_10",  nome:"Deck Peroba do Campo",dimensao:"2,5 × 10cm",      preco:1300 },
  { id:"bambu_10",   nome:"Deck Bambu Alta Den.",dimensao:"2,5 × 10cm",      preco:1480 },
  { id:"arvo_arm",   nome:"Deck Arvo Armani BPC",dimensao:"2 × 15 × 290cm",  preco:1300 },
  { id:"arvo_mar",   nome:"Deck Arvo Marroni BPC",dimensao:"2 × 15 × 220cm", preco:1300 },
];

// ─── TIPOS ──────────────────────────────────────────────────────────────────

type Tipo = "piso" | "deck" | "forro" | "painel" | "porta" | "marcenaria";
type Origem = "nacional" | "importado";
type SubtipoForro = "regua" | "ripado" | "toblerone";

/** Preço default por m² de marcenaria personalizada (editável pelo usuário). */
const MARC_PERS_DEFAULT_PRECO = 5200;

interface Selecoes {
  tipo: Tipo | null;
  origem: Origem | null;
  subtipoForro: SubtipoForro | null;
  especieId: string | null;
  cor: string | null;
  dimensaoId: string | null;
  deckId: string | null;
  tipoPorta: string | null;
  subtipoPorta: string | null;
  metragem: number;
  // ── Marcenaria personalizada ──
  descricaoPersonalizada: string | null;
  precoPorMetro: number | null;
  ferragensIds: string[];
}

const SEL_INICIAL: Selecoes = { tipoPorta: null, subtipoPorta: null,
  tipo: null, origem: null, subtipoForro: null,
  especieId: null, cor: null, dimensaoId: null,
  deckId: null, metragem: 0,
  descricaoPersonalizada: null, precoPorMetro: null, ferragensIds: [],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getPrecoUnitario(sel: Selecoes): number | null {
  const { tipo, origem, subtipoForro, especieId, dimensaoId, deckId } = sel;
  if (!tipo) return null;

  // Marcenaria personalizada: preço por m² é editável pelo usuário (default R$ 5200)
  if (tipo === "marcenaria") {
    return sel.precoPorMetro != null && sel.precoPorMetro > 0
      ? sel.precoPorMetro
      : MARC_PERS_DEFAULT_PRECO;
  }

  if (tipo === "deck") {
    if (!deckId) return null;
    return DECKS.find(d => d.id === deckId)?.preco ?? null;
  }

  if (tipo === "piso") {
    if (!especieId || !dimensaoId) return null;
    if (origem === "nacional") return PISOS_NAC_PRECOS[especieId]?.[dimensaoId] ?? null;
    if (origem === "importado") return PISOS_IMP_PRECOS[especieId]?.[dimensaoId] ?? null;
  }

  if (tipo === "forro") {
    if (subtipoForro === "regua") {
      if (!especieId || !dimensaoId) return null;
      if (origem === "nacional") return FORRO_NAC_PRECOS[especieId]?.[dimensaoId] ?? null;
      if (origem === "importado") return FORRO_IMP_PRECOS[especieId]?.[dimensaoId] ?? null;
    }
    if (subtipoForro === "ripado") {
      if (!especieId) return null;
      return FORRO_RIPADO_PRECOS[especieId] ?? null;
    }
    if (subtipoForro === "toblerone") {
      if (!especieId) return null;
      return FORRO_TOBLERONE_PRECOS[especieId] ?? null;
    }
  }

  if (tipo === "painel") {
    if (!especieId || !dimensaoId) return null;
    if (origem === "nacional") return PAINEIS_NAC_PRECOS[especieId]?.[dimensaoId] ?? null;
    if (origem === "importado") return PAINEIS_IMP_PRECOS[especieId]?.[dimensaoId] ?? null;
  }

  return null;
}

function buildDescricao(sel: Selecoes, dimensoes?: { id: string; label: string; obs?: string }[], deckList?: DeckItem[]): string {
  const partes: string[] = [];

  if (sel.tipo === "marcenaria") {
    partes.push("Marcenaria Personalizada");
    if (sel.descricaoPersonalizada && sel.descricaoPersonalizada.trim()) {
      partes.push(`— ${sel.descricaoPersonalizada.trim()}`);
    }
    if (sel.especieId) {
      const especieLabels: Record<string, string> = {
        tauari: "Tauari", sucupira: "Sucupira Negra", perobinha: "Perobinha Mica",
        cumaru: "Cumaru", catuaba: "Catuaba", loro: "Loro Pardo", peroba: "Peroba do Campo",
        carvalho: "Carvalho Europeu", nogueira: "Nogueira Walnut",
        cabreuva_branca: "Cabreuva Branca", cabreuva_dourada: "Cabreuva Dourada",
        freijo: "Freijó", tauari_custom: "Tauari Customizado",
      };
      partes.push(`/ ${especieLabels[sel.especieId] ?? sel.especieId}`);
    }
    if (sel.cor) partes.push(sel.cor);
    return partes.join(" ");
  }

  if (sel.tipo === "deck") {
    const list = deckList ?? DECKS;
    const d = list.find(x => x.id === sel.deckId);
    if (d) {
      // Deck tem nome próprio: "Deck Loro Pardo", nunca misturar com Piso/Forro
      const nome = d.nome.toLowerCase().startsWith("deck") ? d.nome : `Deck ${d.nome}`;
      partes.push(`${nome} (${d.dimensao})`);
    }
    return partes.join(" — ");
  }

  // Cada categoria tem seu prefixo rígido — PISO é piso, FORRO é forro, PAINEL é painel
  const tipoLabel: Record<string, string> = {
    piso: "Piso", forro: "Forro", painel: "Painel", porta: "Porta",
  };
  partes.push(tipoLabel[sel.tipo ?? ""] ?? "");

  // Subtipo de forro (Ripado / Toblerone) — Régua não precisa de subtipo extra
  if (sel.tipo === "forro" && sel.subtipoForro === "ripado") partes.push("Ripado");
  if (sel.tipo === "forro" && sel.subtipoForro === "toblerone") partes.push("Toblerone");

  const especieLabels: Record<string,string> = {
    tauari:"Tauari", sucupira:"Sucupira Negra", perobinha:"Perobinha Mica",
    cumaru:"Cumaru", catuaba:"Catuaba", loro:"Loro Pardo", peroba:"Peroba do Campo",
    carvalho:"Carvalho Europeu", nogueira:"Nogueira Walnut",
    cabreuva_branca:"Cabreuva Branca", cabreuva_dourada:"Cabreuva Dourada",
    freijo:"Freijó", tauari_custom:"Tauari Customizado",
  };
  if (sel.especieId) partes.push(especieLabels[sel.especieId] ?? sel.especieId);
  if (sel.cor) partes.push(sel.cor);

  // Incluir dimensão/régua selecionada
  if (sel.dimensaoId && dimensoes) {
    const dim = dimensoes.find(d => d.id === sel.dimensaoId);
    if (dim) {
      partes.push(`— ${dim.label}`);
      if (dim.obs) partes.push(`(${dim.obs})`);
    }
  }

  return partes.join(" ");
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusColor(status: string): string {
  switch (status) {
    case "aprovada": return GREEN;
    case "ganhado":  return "#22c55e";
    case "enviada":  return BLUE;
    case "revisao":  return "#f59e0b";
    case "perdida":  return RED;
    default:         return YELLOW;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "aprovada": return "Aprovado";
    case "ganhado":  return "Ganhado";
    case "enviada":  return "Enviada";
    case "revisao":  return "Revisão";
    case "perdida":  return "Perdido";
    default:         return "Rascunho";
  }
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "aprovada", label: "Aprovado", color: GREEN },
  { value: "revisao",  label: "Revisão",  color: "#f59e0b" },
  { value: "ganhado",  label: "Ganhado",  color: "#22c55e" },
  { value: "perdida",  label: "Perdido",  color: RED },
  { value: "rascunho", label: "Rascunho", color: YELLOW },
];

// ─── CATÁLOGO DE RECORTES DE FORRO ──────────────────────────────────────────

interface RecorteCatalogItem {
  id: string;
  nome: string;
  u: "UNI" | "MTL" | "M2";
  p: number;
  v?: number; // flag "validar preço"
}

const RECORTES_FORRO: RecorteCatalogItem[] = [
  { id: "rec_lum",     nome: "Recorte para Luminária",                   u: "UNI", p: 60 },
  { id: "rec_led",     nome: "Recorte para LED linear",                  u: "MTL", p: 85 },
  { id: "rec_gre_ar",  nome: "Recorte para grelha de ar condicionado",   u: "UNI", p: 650 },
  { id: "rec_gre_fri", nome: "Grelha frisada",                           u: "UNI", p: 650 },
  { id: "rec_ref_pen", nome: "Reforço para pendente",                    u: "UNI", p: 320,  v: 1 },
  { id: "rec_sanca",   nome: "Sanca iluminada",                          u: "MTL", p: 980 },
  { id: "rec_bando_p", nome: "Bandô 15cm a 30cm",                        u: "MTL", p: 890 },
  { id: "rec_bando_g", nome: "Bandô 30cm a 40cm",                        u: "MTL", p: 1080 },
  { id: "rec_cort",    nome: "Cortineiro",                               u: "MTL", p: 980 },
  { id: "rec_alc_s",   nome: "Alçapão simples (até 60x60cm)",            u: "UNI", p: 750 },
  { id: "rec_alc_g",   nome: "Alçapão grande (a partir de 80x80cm)",     u: "UNI", p: 1280, v: 1 },
  { id: "rec_cx_fri",  nome: "Caixa de som frisada",                     u: "UNI", p: 175 },
  { id: "rec_cx_acu",  nome: "Caixa de som com revestimento acústico",   u: "UNI", p: 238 },
  { id: "rec_flap_tv", nome: "Flap TV",                                  u: "UNI", p: 1620, v: 1 },
  { id: "rec_tab_s",   nome: "Tabica simples",                           u: "MTL", p: 50 },
  { id: "rec_tab_ar",  nome: "Tabica com retorno de ar",                 u: "MTL", p: 80 },
];

interface RecorteSel {
  id: string;
  nome: string;
  unidade: string;
  qtd: number;
  precoUnit: number;
  v?: number;
  custom?: number;
  pacote?: number;
}

// ─── LÓGICA DE STEPS ─────────────────────────────────────────────────────────

function nextStep(current: number, sel: Selecoes): number {
  if (current === 1 && sel.tipo === "deck") return 2; // deck → metragem
  if (current === 2 && sel.tipo === "forro" && sel.subtipoForro !== "regua") return 3; // ripado/toblerone → confirmar
  if (current === 3 && sel.tipo === "forro" && sel.subtipoForro !== "regua") return 4; // confirmar → metragem
  return current + 1;
}

function isMetragemStep(step: number, sel: Selecoes): boolean {
  // Marcenaria personalizada: step 3 (descrição → espécie → metragem+preço)
  if (sel.tipo === "marcenaria" && step === 3) return true;
  if (sel.tipo === "deck" && step === 2) return true;
  if (sel.tipo === "forro" && sel.subtipoForro !== "regua" && step === 4) return true;
  if (sel.tipo === "porta") {
    const sub = sel.subtipoPorta;
    if (sub === "lamina" || sub === "laca" || sub === "ripado_macico") return step === 4; // sem dimensão
    return step === 5; // assoalho: com dimensão
  }
  if (step === 4) return true;
  return false;
}

/** Detecta se o step atual é o de recortes (somente para forro, step 5) */
function isRecStep(step: number, sel: Selecoes): boolean {
  return sel.tipo === "forro" && step === 5;
}

/** Detecta se o step atual é o último (metragem para não-forro, recortes para forro) */
function isLastStep(step: number, sel: Selecoes): boolean {
  if (sel.tipo === "forro") return isRecStep(step, sel);
  return isMetragemStep(step, sel);
}

// ─── SUBCOMPONENTES ──────────────────────────────────────────────────────────

function StepBlock({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, marginBottom: 14 }}>{titulo}</div>
      {children}
    </div>
  );
}

function CardOption({ emoji, label, desc, selected, onClick }: {
  emoji: string; label: string; desc?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "rgba(234,179,8,0.12)" : "#0d1117",
        border: `2px solid ${selected ? YELLOW : BORDER}`,
        borderRadius: 10, padding: "14px 12px", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 24 }}>{emoji}</span>
      <span style={{ color: selected ? YELLOW : "#fff", fontWeight: 600, fontSize: 13 }}>{label}</span>
      {desc && <span style={{ color: TEXT_DIM, fontSize: 10, textAlign: "center" }}>{desc}</span>}
    </button>
  );
}

function RowOption({ label, desc, selected, onClick }: {
  label: string; desc?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "rgba(234,179,8,0.08)" : "#0d1117",
        border: `1px solid ${selected ? YELLOW : BORDER}`,
        borderRadius: 8, padding: "10px 14px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        transition: "all 0.15s", width: "100%",
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${selected ? YELLOW : BORDER}`,
        background: selected ? YELLOW : "transparent",
        flexShrink: 0,
      }} />
      <div>
        <div style={{ color: selected ? YELLOW : "#fff", fontSize: 13, fontWeight: selected ? 600 : 400 }}>{label}</div>
        {desc && <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 1 }}>{desc}</div>}
      </div>
      {selected && <CheckCircle2 size={14} color={YELLOW} style={{ marginLeft: "auto" }} />}
    </button>
  );
}

// ─── RECORTES STEP UI ─────────────��─────────────────────────────────────────

function RecortesStepUI({
  ambienteNome, metragemAmb, recortesSel, setRecortesSel,
}: {
  ambienteNome: string;
  metragemAmb: number;
  recortesSel: RecorteSel[];
  setRecortesSel: React.Dispatch<React.SetStateAction<RecorteSel[]>>;
}) {
  return (
    <StepBlock titulo="Recortes deste ambiente (opcional)">
      {/* Ambiente info */}
      <div style={{
        background: "#0d1117", borderRadius: 10, padding: 14,
        border: `1px solid ${BORDER}`, marginBottom: 16, fontSize: 13, color: TEXT_DIM,
      }}>
        Ambiente: <span style={{ color: "#fff", fontWeight: 600 }}>{(ambienteNome || "").trim() || "(sem nome)"}</span>
        {" "}&middot; Metragem: <span style={{ color: "#fff", fontWeight: 600 }}>
          {(metragemAmb || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}m&sup2;
        </span>
      </div>
      <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 10 }}>
        Marque os itens que esse ambiente tem. Se não tiver nenhum, pode avançar direto.
      </div>

      {/* Catalog items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {RECORTES_FORRO.map(rc => {
          const sel = recortesSel.find(x => x.id === rc.id);
          return (
            <div
              key={rc.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${sel ? GREEN : BORDER}`,
                background: sel ? "#0c1a12" : "#0d1117",
                cursor: sel ? "default" : "pointer",
                transition: "all 0.12s",
              }}
              onClick={() => {
                if (!sel) setRecortesSel(w => [...w, { id: rc.id, nome: rc.nome, unidade: rc.u, qtd: 1, precoUnit: rc.p, v: rc.v || 0 }]);
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>
                  {rc.nome}
                  {rc.v ? <span style={{ color: "#f59e0b", marginLeft: 6, fontSize: 11 }}> ⚠ validar preço</span> : null}
                </div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>
                  {formatBRL(rc.p)} / {rc.u}
                </div>
              </div>
              {sel && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={ev => ev.stopPropagation()}>
                  <input
                    type="number"
                    value={sel.qtd}
                    min={0}
                    step={rc.u === "UNI" ? 1 : 0.5}
                    onChange={ev => {
                      const v = parseFloat(String(ev.target.value).replace(",", ".")) || 0;
                      setRecortesSel(w => w.map(x => x.id === rc.id ? { ...x, qtd: v } : x));
                    }}
                    style={{
                      width: 60, background: "#0d1117", border: `1px solid ${BORDER}`,
                      borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 12, textAlign: "center",
                    }}
                  />
                  <span style={{ color: TEXT_DIM, fontSize: 11, minWidth: 28 }}>{sel.unidade}</span>
                  <input
                    type="number"
                    value={sel.precoUnit}
                    onChange={ev => {
                      const v = parseFloat(String(ev.target.value).replace(",", ".")) || 0;
                      setRecortesSel(w => w.map(x => x.id === rc.id ? { ...x, precoUnit: v } : x));
                    }}
                    style={{
                      width: 80, background: "#0d1117", border: `1px solid ${BORDER}`,
                      borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 12, textAlign: "right",
                    }}
                  />
                  <div style={{ minWidth: 96, textAlign: "right", color: GREEN, fontSize: 13, fontWeight: 600 }}>
                    {formatBRL((sel.qtd || 0) * (sel.precoUnit || 0))}
                  </div>
                  <button
                    onClick={() => setRecortesSel(w => w.filter(x => x.id !== rc.id))}
                    style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, fontSize: 16, lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom recorte + Pacote buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            const nm = prompt("Nome do recorte:");
            if (!nm) return;
            const un = (prompt("Unidade (UNI, MTL ou M2):", "UNI") || "UNI").toUpperCase();
            const qt = parseFloat((prompt("Quantidade:", "1") || "").replace(",", ".")) || 0;
            const pr = parseFloat((prompt("Preço unitário (R$):", "") || "").replace(",", ".")) || 0;
            if (qt <= 0 || pr <= 0) return;
            setRecortesSel(w => [...w, { id: "rec_custom_" + Date.now(), nome: nm, unidade: un, qtd: qt, precoUnit: pr, custom: 1 }]);
          }}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 8,
            border: `1px dashed ${BORDER}`, background: "transparent",
            color: TEXT_MED, cursor: "pointer", fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Plus size={14} /> Recorte customizado
        </button>
        <button
          onClick={() => {
            const desc = prompt("Descrição (opcional):", "Pacote de extras de forro") || "Pacote de extras";
            const val = parseFloat((prompt("Valor total (R$):", "") || "").replace(",", ".")) || 0;
            if (val <= 0) return;
            setRecortesSel(w => [...w, { id: "rec_pac_" + Date.now(), nome: desc, unidade: "PAC", qtd: 1, precoUnit: val, pacote: 1 }]);
          }}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 8,
            border: `1px dashed ${BORDER}`, background: "transparent",
            color: TEXT_MED, cursor: "pointer", fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Plus size={14} /> Pacote fechado
        </button>
      </div>

      {/* Summary */}
      {recortesSel.length > 0 && (
        <div style={{
          background: "#0c1a14", borderRadius: 10, padding: 12,
          border: "1px solid #264031",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: TEXT_DIM, fontSize: 12 }}>
            {recortesSel.length} item{recortesSel.length === 1 ? "" : "s"} neste ambiente
          </span>
          <span style={{ color: GREEN, fontWeight: 700, fontSize: 16 }}>
            {formatBRL(recortesSel.reduce((s, r) => s + (r.qtd || 0) * (r.precoUnit || 0), 0))}
          </span>
        </div>
      )}
    </StepBlock>
  );
}

// ─── MODAL: NOVA SIMULAÇÃO ────���────────────────────────────────────────────

interface NovaSimulacaoModalProps {
  cards: DbCard[];
  onClose: () => void;
  onConfirm: (data: {
    numero: string; cliente: string; cnpj_cpf: string; endereco: string;
    obra_code: string; vendedor: string; validade_dias: number; obra_id?: string;
    arquiteto?: string; forma_pagamento?: string;
  }) => Promise<void>;
}

function NovaSimulacaoModal({ cards, onClose, onConfirm }: NovaSimulacaoModalProps) {
  const [busca, setBusca] = React.useState("");
  const [cardSel, setCardSel] = React.useState<DbCard | null>(null);
  const [form, setForm] = React.useState({
    numero: "",
    vendedor: "",
    validade_dias: "15",
    cnpj_cpf: "",
    arquiteto: "",
    forma_pagamento: "",
  });
  const [salvando, setSalvando] = React.useState(false);

  const cardsFiltrados = cards.filter(c =>
    (c.obra ?? "").toLowerCase().includes(busca.toLowerCase()) ||
    c.title.toLowerCase().includes(busca.toLowerCase()) ||
    (c.subtitle ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  async function handleConfirm() {
    if (!cardSel) return;
    setSalvando(true);
    await onConfirm({
      numero: form.numero,
      cliente: cardSel.title,
      cnpj_cpf: form.cnpj_cpf,
      endereco: cardSel.subtitle ?? (cardSel.details as any)?.endereco ?? "",
      obra_code: cardSel.obra ?? cardSel.id,
      vendedor: form.vendedor,
      validade_dias: parseInt(form.validade_dias) || 15,
      obra_id: cardSel.id,
      arquiteto: form.arquiteto,
      forma_pagamento: form.forma_pagamento,
    });
    setSalvando(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: "#0e0e0e", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Nova Simulação</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, padding: "4px 10px", color: TEXT_DIM, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {/* Busca de Projeto */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
            Selecionar Projeto *
          </label>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} color={TEXT_DIM} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              placeholder="Buscar por código, cliente ou responsável..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${cardSel ? YELLOW : BORDER}`, borderRadius: 8, padding: "8px 12px 8px 36px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Lista de projetos (kanban cards) */}
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {cardsFiltrados.slice(0, 20).map(c => (
              <button
                key={c.id}
                onClick={() => setCardSel(c)}
                style={{
                  background: cardSel?.id === c.id ? "rgba(234,179,8,0.10)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${cardSel?.id === c.id ? YELLOW : BORDER}`,
                  borderRadius: 8, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: cardSel?.id === c.id ? YELLOW : "#fff", fontWeight: 600, fontSize: 13 }}>{c.obra ?? c.id.slice(0, 8)}</span>
                  <span style={{ color: TEXT_DIM, fontSize: 11 }}>{c.column_id}</span>
                </div>
                <div style={{ color: TEXT_MED, fontSize: 12, marginTop: 2 }}>{c.title}</div>
                {c.subtitle && <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 1 }}>{c.subtitle}</div>}
              </button>
            ))}
            {cardsFiltrados.length === 0 && (
              <div style={{ color: TEXT_DIM, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nenhum projeto encontrado</div>
            )}
          </div>
        </div>

        {/* Campos adicionais */}
        {cardSel && (
          <>
            <div style={{ background: "rgba(234,179,8,0.06)", border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ color: YELLOW, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Projeto selecionado</div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{cardSel.obra ?? cardSel.id.slice(0,8)} — {cardSel.title}</div>
              {cardSel.subtitle && <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>{cardSel.subtitle}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Nº da Proposta", key: "numero", placeholder: "Ex: 255" },
                { label: "Validade (dias)", key: "validade_dias", placeholder: "15" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</label>
                  <input
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Vendedor</label>
              <input
                placeholder="Ex: Gustavo Oliveira"
                value={form.vendedor}
                onChange={e => setForm(f => ({ ...f, vendedor: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>CNPJ / CPF</label>
              <input
                placeholder="Ex: 37.620.884/0001-97"
                value={form.cnpj_cpf}
                onChange={e => setForm(f => ({ ...f, cnpj_cpf: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Arquiteto / Responsável</label>
              <input
                placeholder="Ex: Arq. Daniel Bastos"
                value={form.arquiteto}
                onChange={e => setForm(f => ({ ...f, arquiteto: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Condições de Pagamento</label>
              <textarea
                placeholder="Ex: Entrada R$400.000,00 + saldo em 20x de R$77.500,00"
                value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                rows={3}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
          </>
        )}

        <button
          disabled={!cardSel || salvando}
          onClick={handleConfirm}
          style={{
            width: "100%", marginTop: 20, padding: "11px 0", borderRadius: 8, border: "none",
            background: cardSel && !salvando ? YELLOW : BORDER,
            color: cardSel && !salvando ? "#000" : TEXT_DIM,
            cursor: cardSel && !salvando ? "pointer" : "default",
            fontSize: 13, fontWeight: 700,
          }}
        >
          {salvando ? "Criando..." : "Criar Simulação"}
        </button>
      </div>
    </div>
  );
}

// ─── VIEW LISTA ───────────────────────────────────────────────────────────────

interface ListaProps {
  simulacoes: SimulacaoProjeto[];
  itensDaSimulacao: (id: string) => any[];
  totalSimulacao: (id: string) => number;
  onEditar: (s: SimulacaoProjeto) => void;
  onGerarProposta: (s: SimulacaoProjeto) => void;
  onDeletar: (id: string) => void;
  onNova: () => void;
  onAtualizarStatus: (id: string, status: string) => Promise<void>;
}

function ListaSimulacoes({ simulacoes, itensDaSimulacao, totalSimulacao, onEditar, onGerarProposta, onDeletar, onNova, onAtualizarStatus }: ListaProps) {
  const [statusOpen, setStatusOpen] = React.useState<string | null>(null);
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Simulações de Orçamento</div>
          <div style={{ color: TEXT_DIM, fontSize: 12, marginTop: 2 }}>{simulacoes.length} simulação(ões) salva(s)</div>
        </div>
        <button
          onClick={onNova}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: YELLOW, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}
        >
          <Plus size={15} /> Nova Simulação
        </button>
      </div>

      {/* Lista */}
      {simulacoes.length === 0 ? (
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <Calculator size={40} color={BORDER} style={{ marginBottom: 12 }} />
          <div style={{ color: TEXT_MED, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma simulação ainda</div>
          <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 20 }}>Crie uma nova simulação vinculada a um projeto para começar</div>
          <button
            onClick={onNova}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: YELLOW, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            <Plus size={15} /> Nova Simulação
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {simulacoes.map(sim => {
            const itens = itensDaSimulacao(sim.id);
            const total = totalSimulacao(sim.id);
            const totalFinal = total - total * (sim.desconto_perc / 100);
            return (
              <div
                key={sim.id}
                style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ color: YELLOW, fontWeight: 700, fontSize: 14 }}>{sim.obra_code}</span>
                      {sim.numero && <span style={{ color: TEXT_DIM, fontSize: 12 }}>Proposta #{sim.numero}</span>}

                      {/* Badge clicável de status */}
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setStatusOpen(statusOpen === sim.id ? null : sim.id)}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: `${statusColor(sim.status)}22`, color: statusColor(sim.status),
                            textTransform: "uppercase", letterSpacing: "0.08em",
                            border: `1px solid ${statusColor(sim.status)}44`,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          {statusLabel(sim.status)} ▾
                        </button>

                        {/* Dropdown de opções */}
                        {statusOpen === sim.id && (
                          <div
                            style={{
                              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                              background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 10,
                              padding: 4, minWidth: 140, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                            }}
                            onMouseLeave={() => setStatusOpen(null)}
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={async () => {
                                  await onAtualizarStatus(sim.id, opt.value);
                                  setStatusOpen(null);
                                }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  width: "100%", padding: "7px 10px", borderRadius: 7, border: "none",
                                  background: sim.status === opt.value ? `${opt.color}22` : "transparent",
                                  color: sim.status === opt.value ? opt.color : TEXT_MED,
                                  cursor: "pointer", fontSize: 12, fontWeight: sim.status === opt.value ? 700 : 400,
                                  textAlign: "left",
                                }}
                              >
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, display: "inline-block", flexShrink: 0 }} />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{sim.cliente}</div>
                    <div style={{ color: TEXT_DIM, fontSize: 12 }}>{sim.endereco}</div>
                    {sim.vendedor && <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Vendedor: {sim.vendedor}</div>}
                  </div>

                  {/* Métricas */}
                  <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: TEXT_DIM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Itens</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{itens.length}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: TEXT_DIM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</div>
                      <div style={{ color: GREEN, fontWeight: 700, fontSize: 15 }}>{formatBRL(totalFinal)}</div>
                      {sim.desconto_perc > 0 && <div style={{ color: TEXT_DIM, fontSize: 10 }}>({sim.desconto_perc}% desc)</div>}
                    </div>
                    <div style={{ color: TEXT_DIM, fontSize: 11 }}>
                      {new Date(sim.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => onEditar(sim)}
                      style={{
                        padding: "7px 14px", borderRadius: 8, border: `1px solid ${BORDER}`,
                        background: "transparent", color: TEXT_MED, cursor: "pointer", fontSize: 12,
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onGerarProposta(sim)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 8, border: "none",
                        background: YELLOW, color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <FileDown size={13} /> Gerar Proposta
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Excluir esta simulação e todos os seus itens?")) onDeletar(sim.id);
                      }}
                      style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", padding: "7px 10px", color: TEXT_DIM }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── VIEW EDITOR ──────────────────────────────────────────────────────────────

interface EditorProps {
  simulacao: SimulacaoProjeto;
  itensDaSimulacao: (id: string) => any[];
  totalSimulacao: (id: string) => number;
  totalComDesconto: (id: string, perc: number) => number;
  adicionarItem: (data: { simulacao_id: string; categoria: string; descritivo: string; valor: number }) => Promise<void>;
  removerItem: (id: string) => Promise<void>;
  updateSimulacaoDesconto: (id: string, perc: number) => Promise<void>;
  updateSimulacaoPagamento: (id: string, forma_pagamento: string) => Promise<void>;
  registrarPropostaGerada: (id: string) => Promise<void>;
  dbRows: TabelaPreco[];
  onVoltar: () => void;
}

function EditorSimulacao({
  simulacao, itensDaSimulacao, totalSimulacao, totalComDesconto,
  adicionarItem, removerItem, updateSimulacaoDesconto, updateSimulacaoPagamento, registrarPropostaGerada,
  dbRows, onVoltar,
}: EditorProps) {
  const [step, setStep] = React.useState(0);
  const [sel, setSel] = React.useState<Selecoes>(SEL_INICIAL);
  const [metragemStr, setMetragemStr] = React.useState("");
  const [obsStr, setObsStr] = React.useState("");
  const [descontoPerc, setDescontoPerc] = React.useState(simulacao.desconto_perc);
  const [propostaModal, setPropostaModal] = React.useState(false);
  const [recortesSel, setRecortesSel] = React.useState<RecorteSel[]>([]);
  const [formaPagLocal, setFormaPagLocal] = React.useState(simulacao.forma_pagamento || "");
  // Sync quando simulacao muda externamente (ex: editado no card kanban)
  React.useEffect(() => {
    setFormaPagLocal(simulacao.forma_pagamento || "");
  }, [simulacao.forma_pagamento]);

  const itens = itensDaSimulacao(simulacao.id);
  const grandTotal = totalSimulacao(simulacao.id);
  const descontoValor = grandTotal * (descontoPerc / 100);
  const totalFinal = grandTotal - descontoValor;

  // Preço do banco tem prioridade; fallback para tabela hardcoded
  function getPrecoDb(s: Selecoes): number | null {
    if (dbRows.length === 0) return getPrecoUnitario(s);
    const ativos = dbRows.filter(r => r.ativo);
    if (s.tipo === "deck" && s.deckId) {
      const r = ativos.find(r => r.categoria === "deck" && r.dimensao_id === s.deckId!.split("_").pop());
      if (!r) {
        const [esp, dim] = s.deckId!.split("_") as [string, string];
        const match = ativos.find(r => r.categoria === "deck" && r.especie_id === esp && r.dimensao_id === dim);
        return match?.preco ?? null;
      }
      return r?.preco ?? null;
    }
    const match = ativos.find(r =>
      r.categoria === s.tipo &&
      (s.tipo === "porta" ? r.tipo_porta === s.tipoPorta : s.tipo === "deck" || r.origem === s.origem) &&
      (s.tipo !== "forro" || r.subtipo === (s.subtipoForro === "regua" ? "regua" : s.subtipoForro)) &&
      r.especie_id === s.especieId &&
      r.dimensao_id === s.dimensaoId
    );
    return match?.preco ?? getPrecoUnitario(s);
  }

  function getEspeciesDb() {
    // Marcenaria personalizada: usa lista fixa (não há categoria "marcenaria" na tabela_precos)
    if (sel.tipo === "marcenaria") return getEspecies();
    if (dbRows.length === 0) return getEspecies();
    const ativos = dbRows.filter(r => r.ativo && r.categoria === sel.tipo);
    let filtered = ativos;
    if (sel.tipo === "porta") {
      filtered = filtered.filter(r => r.tipo_porta === sel.tipoPorta);
      if (sel.subtipoPorta) filtered = filtered.filter(r => r.subtipo === sel.subtipoPorta);
    } else if (sel.tipo !== "deck") {
      filtered = filtered.filter(r => r.origem === sel.origem);
    }
    if (sel.tipo === "forro") {
      const sub = sel.subtipoForro === "regua" ? "regua" : sel.subtipoForro;
      filtered = filtered.filter(r => r.subtipo === sub);
    }
    const seen = new Set<string>();
    const result: { id: string; nome: string; cores: string[] }[] = [];
    for (const r of filtered) {
      if (!seen.has(r.especie_id)) {
        seen.add(r.especie_id);
        result.push({ id: r.especie_id, nome: r.especie_nome, cores: r.cores ?? [] });
      }
    }
    return result;
  }

  function getDimensoesDb() {
    if (dbRows.length === 0) return getDimensoes();
    const ativos = dbRows.filter(r =>
      r.ativo &&
      r.categoria === sel.tipo &&
      (sel.tipo === "porta" ? (r.tipo_porta === sel.tipoPorta && (!sel.subtipoPorta || r.subtipo === sel.subtipoPorta)) : sel.tipo === "deck" || r.origem === sel.origem) &&
      (sel.tipo !== "forro" || r.subtipo === (sel.subtipoForro === "regua" ? "regua" : sel.subtipoForro)) &&
      r.especie_id === sel.especieId &&
      r.dimensao_id != null
    );
    return ativos.map(r => ({
      id: r.dimensao_id!,
      label: r.dimensao_label ?? r.dimensao_id!,
      obs: r.dimensao_obs ?? "",
    }));
  }

  function getDecksDb() {
    if (dbRows.length === 0) return DECKS;
    const ativos = dbRows.filter(r => r.ativo && r.categoria === "deck");
    return ativos.map(r => {
      // Garantir que o nome sempre começa com "Deck" (DB pode ter só o nome da espécie)
      const rawNome = r.especie_nome ?? "";
      const nome = rawNome.toLowerCase().startsWith("deck") ? rawNome : `Deck ${rawNome}`;
      return {
        id: `${r.especie_id}_${r.dimensao_id}`,
        nome,
        dimensao: r.dimensao_label ?? r.dimensao_id ?? "",
        preco: r.preco,
      };
    });
  }

  function getEspecies() {
    const { tipo, origem, subtipoForro } = sel;
    // Marcenaria personalizada: lista todas as espécies (nacionais + importadas)
    if (tipo === "marcenaria") return [
      { id: "carvalho",          nome: "Carvalho Europeu",     cores: CORES_CARVALHO },
      { id: "tauari",            nome: "Tauari",                cores: CORES_TAUARI },
      { id: "nogueira",          nome: "Nogueira Walnut" },
      { id: "freijo",            nome: "Freijó" },
      { id: "cumaru",            nome: "Cumaru" },
      { id: "sucupira",          nome: "Sucupira Negra" },
      { id: "perobinha",         nome: "Perobinha Mica" },
      { id: "catuaba",           nome: "Catuaba" },
      { id: "loro",              nome: "Loro Pardo" },
      { id: "peroba",            nome: "Peroba do Campo" },
      { id: "cabreuva_branca",   nome: "Cabreuva Branca" },
      { id: "cabreuva_dourada",  nome: "Cabreuva Dourada" },
      { id: "tauari_custom",     nome: "Tauari Customizado" },
    ];
    if (tipo === "forro" && subtipoForro === "ripado") return [
      { id: "catuaba", nome: "Catuaba" },
      { id: "cabreuva_branca", nome: "Cabreuva Branca" },
      { id: "loro", nome: "Loro Pardo" },
      { id: "tauari", nome: "Tauari" },
      { id: "freijo", nome: "Freijó" },
      { id: "cumaru", nome: "Cumaru" },
      { id: "sucupira", nome: "Sucupira" },
      { id: "tauari_custom", nome: "Tauari Customizado" },
      { id: "peroba", nome: "Peroba do Campo" },
    ];
    if (tipo === "forro" && subtipoForro === "toblerone") return [
      { id: "cumaru", nome: "Cumaru" },
      { id: "catuaba", nome: "Catuaba" },
      { id: "cabreuva_branca", nome: "Cabreuva Branca" },
      { id: "cabreuva_dourada", nome: "Cabreuva Dourada" },
      { id: "tauari", nome: "Tauari" },
      { id: "peroba", nome: "Peroba" },
      { id: "loro", nome: "Loro Pardo" },
      { id: "tauari_custom", nome: "Tauari Customizado" },
    ];
    if (origem === "importado") return [
      { id: "carvalho", nome: "Carvalho Europeu", cores: CORES_CARVALHO },
      { id: "nogueira", nome: "Nogueira Walnut" },
    ];
    return [
      { id: "tauari",    nome: "Tauari",         cores: CORES_TAUARI },
      { id: "sucupira",  nome: "Sucupira Negra" },
      { id: "perobinha", nome: "Perobinha Mica" },
      { id: "cumaru",    nome: "Cumaru" },
      { id: "catuaba",   nome: "Catuaba" },
      { id: "loro",      nome: "Loro Pardo" },
      { id: "peroba",    nome: "Peroba do Campo" },
    ];
  }

  function getDimensoes() {
    const { tipo, origem, subtipoForro } = sel;
    if (tipo === "piso") return origem === "nacional" ? DIM_PISOS_NAC : DIM_PISOS_IMP;
    if (tipo === "forro" && subtipoForro === "regua") return origem === "nacional" ? DIM_FORRO_NAC : DIM_FORRO_IMP;
    if (tipo === "painel") return origem === "nacional" ? DIM_PISOS_NAC : DIM_PAINEIS_IMP;
    return [];
  }

  const preco = getPrecoDb(sel);
  const metragem = parseFloat(metragemStr.replace(",", ".")) || 0;
  const total = preco != null && metragem > 0 ? preco * metragem : 0;

  const especies = getEspeciesDb();
  const especieSelecionada = especies.find(e => e.id === sel.especieId) as any;
  const coresDisponiveis: string[] = especieSelecionada?.cores ?? [];
  const decksDb = getDecksDb();
  const dimensoesDb = getDimensoesDb();

  function reset() {
    setSel(SEL_INICIAL);
    setMetragemStr("");
    setObsStr("");
    setStep(0);
    setRecortesSel([]);
  }

  async function handleAdicionarItem() {
    if (preco == null || metragem <= 0) return;
    // MARCFIX19 port (camada 1): snapshot dos recortes ANTES de qualquer setState
    // pra prevenir race condition de closure (recortesSel pode estar stale se user
    // marca recorte e clica Adicionar antes do React re-renderizar).
    const _recSnap = [...(recortesSel ?? [])];
    const valorTotal = preco * metragem;
    const descBase = buildDescricao(sel, dimensoesDb, decksDb);
    let descComArea = `${descBase}\n${metragem.toLocaleString("pt-BR")} m² × ${formatBRL(preco)}/m²`;
    if (obsStr.trim()) descComArea += `\nObs: ${obsStr.trim()}`;
    const cat = (sel.tipo ?? "ITEM").toUpperCase();
    await adicionarItem({
      simulacao_id: simulacao.id,
      categoria: cat,
      descritivo: descComArea,
      valor: valorTotal,
    });

    // Se é forro e tem recortes selecionados, salvar item de recortes
    // Usa _recSnap em vez de recortesSel pra evitar closure stale
    if (sel.tipo === "forro" && _recSnap.length > 0) {
      // Verificar se já existe um item RECORTES para esta simulação
      const recExist = (itens ?? []).find((it: any) => /^RECORTES/i.test(it.descritivo));
      let recMap: Record<string, { nome: string; u: string; p: number; qtd: number; custom: number; pacote: number }> = {};

      // Se já existe, parsear o mapa existente para acumular
      if (recExist && recExist.descritivo) {
        const mR = recExist.descritivo.match(/__RECDATA__:(\{[\s\S]*?\})(?=\n|$)/);
        if (mR) {
          try { recMap = JSON.parse(mR[1]); } catch {}
        }
      }

      // Adicionar / acumular recortes selecionados (usa snapshot)
      for (const rr of _recSnap) {
        const kk = rr.id;
        if (recMap[kk] && !rr.custom && !rr.pacote) {
          recMap[kk].qtd = (recMap[kk].qtd || 0) + (rr.qtd || 0);
        } else {
          recMap[kk] = {
            nome: rr.nome, u: rr.unidade, p: rr.precoUnit,
            qtd: rr.qtd, custom: rr.custom ? 1 : 0, pacote: rr.pacote ? 1 : 0,
          };
        }
      }

      const recText = Object.values(recMap).map(rr => {
        if (rr.pacote) return `${rr.nome} (${formatBRL(rr.p)})`;
        const qq = rr.u === "UNI"
          ? String(Math.round(rr.qtd || 0)).padStart(2, "0")
          : (rr.qtd || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        return `${qq} ${rr.nome}`;
      }).join(" e ") + ".";

      const recTot = Object.values(recMap).reduce((s, rr) => s + (rr.qtd || 0) * (rr.p || 0), 0);
      const recDesc = `RECORTES\n${recText}\n__RECDATA__:${JSON.stringify(recMap)}`;

      if (recExist) {
        await supabase.from("simulacao_itens")
          .update({ valor: recTot, descritivo: recDesc })
          .eq("id", recExist.id);
      } else {
        await adicionarItem({
          simulacao_id: simulacao.id,
          categoria: cat,
          descritivo: recDesc,
          valor: recTot,
        });
      }
    }

    // MARCFIX19 port (camada 3): SQL FALLBACK — verifica se o save de RECORTES
    // de fato persistiu. Se snapshot tinha recortes mas o banco não tem registro
    // RECORTES pra essa simulação, insere via SQL direto. Defensa contra qualquer
    // race que ainda escape do snapshot.
    if (sel.tipo === "forro" && _recSnap.length > 0) {
      try {
        const { data: existsRec } = await supabase
          .from("simulacao_itens")
          .select("id")
          .eq("simulacao_id", simulacao.id)
          .ilike("descritivo", "RECORTES%")
          .limit(1);
        if (!existsRec || existsRec.length === 0) {
          console.warn("[FALLBACK-REC] handleAdicionarItem não persistiu RECORTES — inserindo via SQL fallback");
          const fbMap: Record<string, { nome: string; u: string; p: number; qtd: number; custom: number; pacote: number }> = {};
          for (const rr of _recSnap) {
            fbMap[rr.id] = {
              nome: rr.nome, u: rr.unidade, p: rr.precoUnit,
              qtd: rr.qtd, custom: rr.custom ? 1 : 0, pacote: rr.pacote ? 1 : 0,
            };
          }
          const fbText = Object.values(fbMap).map(rr => {
            if (rr.pacote) return `${rr.nome} (${formatBRL(rr.p)})`;
            const qq = rr.u === "UNI"
              ? String(Math.round(rr.qtd || 0)).padStart(2, "0")
              : (rr.qtd || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
            return `${qq} ${rr.nome}`;
          }).join(" e ") + ".";
          const fbTot = Object.values(fbMap).reduce((s, rr) => s + (rr.qtd || 0) * (rr.p || 0), 0);
          await supabase.from("simulacao_itens").insert({
            simulacao_id: simulacao.id,
            categoria: cat,
            descritivo: `RECORTES\n${fbText}\n__RECDATA__:${JSON.stringify(fbMap)}`,
            valor: fbTot,
          });
        }
      } catch (e) {
        console.error("[FALLBACK-REC] erro:", e);
      }
    }

    // Manter seleções (tipo, origem, espécie, dimensão) e voltar ao step de metragem
    // para facilitar lançar múltiplas áreas do mesmo material
    setMetragemStr("");
    setObsStr("");
    setRecortesSel([]);
    // Voltar ao step da metragem (último step antes de confirmar)
    const lastStep = sel.tipo === "deck" ? 2 : sel.tipo === "porta" ? 3 : (sel.subtipoForro === "ripado" || sel.subtipoForro === "toblerone") ? 3 : 5;
    setStep(lastStep);
  }

  function canNext(): boolean {
    if (step === 0) return !!sel.tipo;
    if (step === 1) {
      if (sel.tipo === "marcenaria") return !!(sel.descricaoPersonalizada && sel.descricaoPersonalizada.trim());
      if (sel.tipo === "deck") return !!sel.deckId;
      if (sel.tipo === "porta") return !!sel.tipoPorta;
      if (sel.tipo === "forro") return !!sel.origem && !!sel.subtipoForro;
      return !!sel.origem;
    }
    if (step === 2) {
      if (sel.tipo === "marcenaria") return !!sel.especieId;
      if (sel.tipo === "porta") return !!sel.subtipoPorta;
      return !!sel.especieId;
    }
    if (step === 3) return !!sel.especieId;
    // For metragem steps, check metragem > 0
    if (isMetragemStep(step, sel)) return metragem > 0;
    if (step === 4) return !!sel.dimensaoId;
    if (step === 5) return metragem > 0;
    return false;
  }

  function totalSteps(): number {
    if (!sel.tipo) return 6;
    if (sel.tipo === "marcenaria") return 4; // descrição → espécie → metragem+preço
    if (sel.tipo === "deck") return 3;
    if (sel.tipo === "porta") {
      const sub = sel.subtipoPorta;
      if (sub === "lamina" || sub === "laca" || sub === "ripado_macico") return 5; // sem dimensão
      return 6; // com dimensão (assoalho)
    }
    // Forro: metragem + recortes (step 5)
    if (sel.tipo === "forro" && (sel.subtipoForro === "ripado" || sel.subtipoForro === "toblerone")) return 6;
    if (sel.tipo === "forro") return 6;
    return 5;
  }

  async function handleDescontoBlur() {
    if (descontoPerc !== simulacao.desconto_perc) {
      await updateSimulacaoDesconto(simulacao.id, descontoPerc);
    }
  }

  return (
    <>
      {/* Back button + header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onVoltar}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: TEXT_MED, fontSize: 13, padding: 0, marginBottom: 12,
          }}
        >
          <ArrowLeft size={16} /> Simulações
        </button>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span style={{ color: YELLOW, fontWeight: 700, fontSize: 15 }}>{simulacao.obra_code}</span>
              {simulacao.numero && <span style={{ color: TEXT_DIM, fontSize: 12, marginLeft: 8 }}>Proposta #{simulacao.numero}</span>}
            </div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{simulacao.cliente}</div>
            <div style={{ color: TEXT_DIM, fontSize: 12 }}>{simulacao.endereco}</div>
            <span style={{
              marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: `${statusColor(simulacao.status)}22`, color: statusColor(simulacao.status),
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {statusLabel(simulacao.status)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* ── PAINEL DO SIMULADOR ── */}
        <div style={{ flex: "1 1 480px", minWidth: 340 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Calculator size={20} color={YELLOW} />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Adicionar Item</span>
            </div>

            {/* Barra de progresso */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {Array.from({ length: totalSteps() }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? YELLOW : BORDER,
                  transition: "background 0.2s",
                }} />
              ))}
            </div>

            {/* ── STEP 0: Tipo de Produto ── */}
            {step === 0 && (
              <StepBlock titulo="Qual tipo de produto?">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { id: "piso",       emoji: "🪵", label: "Piso" },
                    { id: "deck",       emoji: "🌿", label: "Deck" },
                    { id: "forro",      emoji: "🏠", label: "Forro" },
                    { id: "painel",     emoji: "🖼️",  label: "Painel" },
                    { id: "porta",      emoji: "🚪", label: "Porta" },
                    { id: "marcenaria", emoji: "🛠",  label: "Marcenaria" },
                  ].map(op => (
                    <CardOption
                      key={op.id}
                      emoji={op.emoji}
                      label={op.label}
                      selected={sel.tipo === op.id}
                      onClick={() => setSel({ ...SEL_INICIAL, tipo: op.id as Tipo })}
                    />
                  ))}
                </div>
              </StepBlock>
            )}

            {/* ── STEP 1: Porta → tipo de porta ── */}
            {step === 1 && sel.tipo === "porta" && (
              <StepBlock titulo="Qual o tipo da porta?">
                {(() => {
                  const tiposPorta = Array.from(new Set(
                    dbRows.filter(r => r.ativo && r.categoria === "porta" && r.tipo_porta).map(r => r.tipo_porta!)
                  )).sort();
                  return tiposPorta.length === 0 ? (
                    <div style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic" }}>Nenhum tipo de porta cadastrado</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {tiposPorta.map(tp => (
                        <CardOption key={tp} emoji="🚪" label={tp}
                          selected={sel.tipoPorta === tp}
                          onClick={() => setSel(s => ({ ...s, tipoPorta: tp, especieId: null, cor: null, dimensaoId: null }))}
                        />
                      ))}
                    </div>
                  );
                })()}
              </StepBlock>
            )}

            {/* ── STEP 1 (marcenaria): Descrição personalizada ── */}
            {step === 1 && sel.tipo === "marcenaria" && (
              <StepBlock titulo="Descreva o item personalizado">
                <textarea
                  placeholder={"Ex: Closet em U para suíte master com 4 portas pivotantes, cabideiros, gavetas internas e prateleiras…"}
                  value={sel.descricaoPersonalizada ?? ""}
                  onChange={e => setSel(s => ({ ...s, descricaoPersonalizada: e.target.value }))}
                  rows={6}
                  autoFocus
                  style={{
                    width: "100%", background: "#0d1117", border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 13,
                    resize: "vertical", boxSizing: "border-box", lineHeight: 1.5,
                  }}
                />
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 8 }}>
                  Descreva o que vai ser executado — esse texto entra na descrição do item no orçamento.
                </div>
              </StepBlock>
            )}

            {/* ── STEP 1: Origem / Deck produto ── */}
            {step === 1 && sel.tipo !== "deck" && sel.tipo !== "porta" && sel.tipo !== "marcenaria" && (
              <StepBlock titulo={sel.tipo === "forro" ? "Qual tipo de forro?" : "Qual a origem do material?"}>
                {sel.tipo === "forro" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { ori: "nacional" as Origem, sub: "regua" as SubtipoForro,     label: "Nacional — Régua",     desc: "Tauari, Cumaru, Loro Pardo e outros" },
                      { ori: "nacional" as Origem, sub: "ripado" as SubtipoForro,    label: "Nacional — Ripado",    desc: "1,8 × 3,5cm, perfil reto" },
                      { ori: "nacional" as Origem, sub: "toblerone" as SubtipoForro, label: "Nacional — Toblerone", desc: "Perfil triangular decorativo" },
                      { ori: "importado" as Origem,sub: "regua" as SubtipoForro,     label: "Importado — Régua",    desc: "Carvalho Europeu e Nogueira Walnut" },
                    ].map(op => (
                      <RowOption
                        key={`${op.ori}-${op.sub}`}
                        label={op.label}
                        desc={op.desc}
                        selected={sel.origem === op.ori && sel.subtipoForro === op.sub}
                        onClick={() => setSel(s => ({ ...s, origem: op.ori, subtipoForro: op.sub, especieId: null, cor: null, dimensaoId: null }))}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <CardOption emoji="🌳" label="Nacional" desc="Tauari, Cumaru, Loro Pardo..." selected={sel.origem === "nacional"} onClick={() => setSel(s => ({ ...s, origem: "nacional", especieId: null, cor: null, dimensaoId: null }))} />
                    <CardOption emoji="🌍" label="Importado" desc="Carvalho Europeu, Nogueira..." selected={sel.origem === "importado"} onClick={() => setSel(s => ({ ...s, origem: "importado", especieId: null, cor: null, dimensaoId: null }))} />
                  </div>
                )}
              </StepBlock>
            )}

            {/* ── STEP 1 para Deck ── */}
            {step === 1 && sel.tipo === "deck" && (
              <StepBlock titulo="Qual deck?">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {decksDb.map(d => (
                    <RowOption
                      key={d.id}
                      label={`${d.nome}`}
                      desc={`${d.dimensao} — ${formatBRL(d.preco)}/m²`}
                      selected={sel.deckId === d.id}
                      onClick={() => setSel(s => ({ ...s, deckId: d.id }))}
                    />
                  ))}
                </div>
              </StepBlock>
            )}

            {/* ── STEP 2: Porta → Tipo de Acabamento ── */}
            {step === 2 && sel.tipo === "porta" && (
              <StepBlock titulo="Qual o tipo de acabamento?">
                {(() => {
                  const subtipos = Array.from(new Set(
                    dbRows.filter(r => r.ativo && r.categoria === "porta" && r.tipo_porta === sel.tipoPorta && r.subtipo).map(r => r.subtipo!)
                  )).sort();
                  const LABELS: Record<string, { label: string; desc: string; emoji: string }> = {
                    assoalho: { label: "Assoalho (Madeira Maciça)", desc: "Tauari, Cumaru, Loro Pardo, Carvalho e outros", emoji: "🪵" },
                    lamina: { label: "Lâmina Natural", desc: "Carvalho, Nogueira, Cumaru, Tauari e outros", emoji: "🎋" },
                    ripado_macico: { label: "Ripado / Muxarabi / Toblerone", desc: "Perfil decorativo em madeira maciça", emoji: "📐" },
                    laca: { label: "Laca", desc: "Acabamento em laca (cor sólida)", emoji: "🎨" },
                  };
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {subtipos.map(sub => {
                        const info = LABELS[sub] || { label: sub, desc: "", emoji: "🚪" };
                        return (
                          <RowOption key={sub} label={info.label} desc={info.desc}
                            selected={sel.subtipoPorta === sub}
                            onClick={() => setSel(s => ({ ...s, subtipoPorta: sub, especieId: null, cor: null, dimensaoId: null }))}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </StepBlock>
            )}

            {/* ── STEP 2 (outros) / STEP 3 (porta): Espécie ── */}
            {((step === 2 && sel.tipo !== "deck" && sel.tipo !== "porta") || (step === 3 && sel.tipo === "porta")) && (
              <StepBlock titulo="Qual a espécie da madeira?">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {especies.map(e => (
                    <RowOption
                      key={e.id}
                      label={e.nome}
                      desc={(e as any).cores ? `${(e as any).cores.length} acabamentos disponíveis` : undefined}
                      selected={sel.especieId === e.id}
                      onClick={() => setSel(s => ({ ...s, especieId: e.id, cor: null, dimensaoId: null }))}
                    />
                  ))}
                </div>
                {sel.especieId && coresDisponiveis.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: TEXT_DIM, fontSize: 12, marginBottom: 8 }}>Acabamento / Cor</div>
                    <select
                      value={sel.cor ?? ""}
                      onChange={e => setSel(s => ({ ...s, cor: e.target.value || null }))}
                      style={{ width: "100%", background: "#1a1a2e", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                    >
                      <option value="">Selecione o acabamento</option>
                      {coresDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 6 }}>
                      O acabamento não altera o preço
                    </div>
                  </div>
                )}
              </StepBlock>
            )}

            {/* ── STEP 3 (outros) / STEP 4 (porta): Dimensão ── */}
            {((step === 3 && sel.tipo !== "deck" && sel.tipo !== "porta" && !(sel.tipo === "forro" && sel.subtipoForro !== "regua")) || (step === 4 && sel.tipo === "porta" && sel.subtipoPorta === "assoalho")) && (
              <StepBlock titulo="Qual a dimensão / formato?">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {dimensoesDb.map((d: any) => {
                    const precoEsp = getPrecoDb({ ...sel, dimensaoId: d.id });
                    return (
                      <RowOption
                        key={d.id}
                        label={d.label}
                        desc={precoEsp ? `${formatBRL(precoEsp)}/m²${d.obs ? ` · ${d.obs}` : ""}` : d.obs}
                        selected={sel.dimensaoId === d.id}
                        onClick={() => setSel(s => ({ ...s, dimensaoId: d.id }))}
                      />
                    );
                  })}
                </div>
              </StepBlock>
            )}

            {/* ── STEP 3: Para Ripado/Toblerone (pula dimensão) ── */}
            {step === 3 && sel.tipo === "forro" && sel.subtipoForro !== "regua" && (
              <StepBlock titulo="Confirmar espécie">
                <div style={{ background: "#0d1117", borderRadius: 10, padding: 16, border: `1px solid ${BORDER}` }}>
                  <div style={{ color: TEXT_DIM, fontSize: 12, marginBottom: 4 }}>Produto selecionado</div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{buildDescricao(sel, dimensoesDb)}</div>
                  {preco && <div style={{ color: YELLOW, fontSize: 13, marginTop: 6 }}>{formatBRL(preco)}/m²</div>}
                </div>
              </StepBlock>
            )}

            {/* ── STEP FINAL: Metragem ── */}
            {isMetragemStep(step, sel) && (
              <StepBlock titulo="Qual a metragem? (m²)">
                <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>Produto selecionado</div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{buildDescricao(sel, dimensoesDb)}</div>
                  {preco && <div style={{ color: YELLOW, fontSize: 13, marginTop: 4 }}>{formatBRL(preco)}/m²</div>}
                </div>
                {/* ── Marcenaria personalizada: preço por m² editável ── */}
                {sel.tipo === "marcenaria" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 6 }}>Preço por m² (R$)</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ color: TEXT_DIM, fontSize: 13 }}>R$</span>
                      <input
                        type="number"
                        placeholder={String(MARC_PERS_DEFAULT_PRECO)}
                        value={sel.precoPorMetro != null ? String(sel.precoPorMetro) : ""}
                        onChange={e => {
                          const v = parseFloat(e.target.value.replace(",", "."));
                          setSel(s => ({ ...s, precoPorMetro: isNaN(v) ? null : v }));
                        }}
                        min={0}
                        step={50}
                        style={{
                          flex: 1, background: "#0d1117", border: `1px solid ${BORDER}`,
                          borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14,
                        }}
                      />
                      <span style={{ color: TEXT_DIM, fontSize: 13 }}>/m²</span>
                    </div>
                    <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 6 }}>
                      Default: {formatBRL(MARC_PERS_DEFAULT_PRECO)}/m². Editável conforme negociação.
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="number"
                    placeholder="Ex: 45,5"
                    value={metragemStr}
                    onChange={e => setMetragemStr(e.target.value)}
                    min={0}
                    step={0.5}
                    style={{
                      flex: 1, background: "#0d1117", border: `1px solid ${BORDER}`,
                      borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14,
                    }}
                    autoFocus={sel.tipo !== "marcenaria"}
                  />
                  <span style={{ color: TEXT_DIM, fontSize: 13 }}>m²</span>
                </div>
                <textarea
                  placeholder="Observações (medidas, especificações, etc.)"
                  value={obsStr}
                  onChange={e => setObsStr(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%", marginTop: 10, background: "#0d1117", border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 12,
                    resize: "vertical", boxSizing: "border-box",
                  }}
                />
                {total > 0 && (
                  <div style={{ marginTop: 16, background: "#1a2a1a", borderRadius: 10, padding: 14, border: `1px solid #2d5a2d` }}>
                    <div style={{ color: TEXT_DIM, fontSize: 11 }}>Total estimado</div>
                    <div style={{ color: GREEN, fontWeight: 700, fontSize: 22, marginTop: 4 }}>
                      {formatBRL(total)}
                    </div>
                    <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>
                      {formatBRL(preco!)}/m² × {metragem.toLocaleString("pt-BR")} m²
                    </div>
                  </div>
                )}
              </StepBlock>
            )}

            {/* ── STEP 5 (forro): Recortes ── */}
            {isRecStep(step, sel) && (
              <RecortesStepUI
                ambienteNome={obsStr}
                metragemAmb={metragem}
                recortesSel={recortesSel}
                setRecortesSel={setRecortesSel}
              />
            )}

            {/* ── NAVEGAÇÃO ── */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 16px", borderRadius: 8, border: `1px solid ${BORDER}`,
                    background: "transparent", color: TEXT_MED, cursor: "pointer", fontSize: 13,
                  }}
                >
                  <ChevronLeft size={15} /> Voltar
                </button>
              )}
              <div style={{ flex: 1 }} />
              {isLastStep(step, sel) ? (
                <button
                  onClick={handleAdicionarItem}
                  disabled={total <= 0}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8, border: "none",
                    background: total > 0 ? GREEN : BORDER,
                    color: total > 0 ? "#fff" : TEXT_DIM,
                    cursor: total > 0 ? "pointer" : "default", fontSize: 13, fontWeight: 600,
                  }}
                >
                  <Plus size={15} /> Adicionar ao Orçamento
                </button>
              ) : (
                <button
                  onClick={() => setStep(s => nextStep(s, sel))}
                  disabled={!canNext()}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8, border: "none",
                    background: canNext() ? YELLOW : BORDER,
                    color: canNext() ? "#000" : TEXT_DIM,
                    cursor: canNext() ? "pointer" : "default", fontSize: 13, fontWeight: 600,
                  }}
                >
                  Continuar <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── PAINEL DO ORÇAMENTO ── */}
        <div style={{ flex: "1 1 340px", minWidth: 300 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Package size={18} color={BLUE} />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Orçamento</span>
              <span style={{ color: TEXT_DIM, fontSize: 12, marginLeft: "auto" }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
            </div>

            {itens.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_DIM, fontSize: 13 }}>
                <Calculator size={32} color={BORDER} style={{ marginBottom: 8 }} />
                <div>Adicione itens usando o simulador</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {itens.map((item: any) => {
                    // valor é o total do item; inferimos preço unitario pela divisão se possível
                    return (
                      <div key={item.id} style={{
                        background: "#0d1117", borderRadius: 10, padding: 12,
                        border: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 10,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: TEXT_DIM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{item.categoria}</div>
                          <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{item.descritivo}</div>
                          <div style={{ color: GREEN, fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                            {formatBRL(item.valor)}
                          </div>
                        </div>
                        <button
                          onClick={() => removerItem(item.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: TEXT_DIM }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Desconto % */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, background: "#0d1117", borderRadius: 8, padding: "10px 14px", border: `1px solid ${BORDER}` }}>
                  <span style={{ color: TEXT_DIM, fontSize: 12, flex: 1 }}>Desconto (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={descontoPerc || ""}
                    placeholder="0"
                    onChange={e => setDescontoPerc(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    onBlur={handleDescontoBlur}
                    style={{ width: 64, background: "transparent", border: "none", color: YELLOW, fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none" }}
                  />
                  <span style={{ color: YELLOW, fontSize: 13, fontWeight: 700 }}>%</span>
                </div>

                {/* Total Geral */}
                <div style={{ background: "#1a2a1a", borderRadius: 10, padding: 14, border: `1px solid #2d5a2d`, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: descontoPerc > 0 ? 8 : 0 }}>
                    <div>
                      <div style={{ color: TEXT_DIM, fontSize: 11 }}>Total Bruto</div>
                      <div style={{ color: TEXT_DIM, fontSize: 11 }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</div>
                    </div>
                    <div style={{ color: descontoPerc > 0 ? TEXT_DIM : GREEN, fontWeight: 700, fontSize: descontoPerc > 0 ? 16 : 22 }}>
                      {formatBRL(grandTotal)}
                    </div>
                  </div>
                  {descontoPerc > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: RED, fontSize: 11 }}>Desconto ({descontoPerc.toFixed(1)}%)</span>
                        <span style={{ color: RED, fontSize: 13, fontWeight: 600 }}>− {formatBRL(descontoValor)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid #2d5a2d`, paddingTop: 8 }}>
                        <span style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>Total Final</span>
                        <span style={{ color: GREEN, fontWeight: 700, fontSize: 22 }}>{formatBRL(totalFinal)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => setPropostaModal(true)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 0", borderRadius: 8, border: "none",
                      background: YELLOW, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <FileDown size={15} /> Gerar Proposta PDF
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Limpar todos os itens desta simulação?")) {
                        itens.forEach((it: any) => removerItem(it.id));
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 0", borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: "transparent", color: TEXT_DIM, cursor: "pointer", fontSize: 12,
                    }}
                  >
                    <Trash2 size={14} /> Limpar tudo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL GERAR PROPOSTA ── */}
      {propostaModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onMouseDown={() => setPropostaModal(false)}
        >
          <div
            style={{ background: "#0e0e0e", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Gerar Proposta PDF</span>
              <button onClick={() => setPropostaModal(false)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, padding: "4px 8px", color: TEXT_DIM, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            {/* Mostra dados da simulação (somente leitura) */}
            <div style={{ background: "rgba(234,179,8,0.06)", border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Código", value: simulacao.obra_code },
                  { label: "Nº Proposta", value: simulacao.numero || "—" },
                  { label: "Cliente", value: simulacao.cliente },
                  { label: "Vendedor", value: simulacao.vendedor || "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ color: TEXT_DIM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 500, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ color: TEXT_DIM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Endereço</div>
                <div style={{ color: "#fff", fontSize: 12, marginTop: 2 }}>{simulacao.endereco}</div>
              </div>
            </div>

            {/* Condição de Pagamento — editável */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                Condições de Pagamento
              </label>
              <textarea
                value={formaPagLocal}
                onChange={e => setFormaPagLocal(e.target.value)}
                placeholder="Ex: Entrada R$400.000,00 + saldo em 20x de R$77.500,00"
                rows={3}
                onBlur={() => {
                  if (formaPagLocal !== (simulacao.forma_pagamento || "")) {
                    updateSimulacaoPagamento(simulacao.id, formaPagLocal);
                  }
                }}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff",
                  outline: "none", boxSizing: "border-box", resize: "vertical",
                }}
              />
            </div>

            <button
              onClick={() => {
                const itensParaProposta = itens.map((it: any, i: number) => ({
                  id: String(i),
                  categoria: it.categoria || it.descritivo.split(" ")[0]?.toUpperCase() || "ITEM",
                  descritivo: it.descritivo,
                  valor: it.valor,
                  ordem: it.ordem ?? i,
                }));
                abrirPropostaParaImpressao(
                  {
                    numero: simulacao.numero,
                    cliente: simulacao.cliente,
                    cnpj_cpf: simulacao.cnpj_cpf,
                    endereco: simulacao.endereco,
                    obra_code: simulacao.obra_code,
                    vendedor: simulacao.vendedor,
                    validade_dias: simulacao.validade_dias,
                    desconto_perc: descontoPerc,
                    created_at: simulacao.created_at,
                    arquiteto: simulacao.arquiteto,
                    forma_pagamento: formaPagLocal,
                  },
                  itensParaProposta
                );
                registrarPropostaGerada(simulacao.id);
                setPropostaModal(false);
              }}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
                background: YELLOW, color: "#000", cursor: "pointer",
                fontSize: 13, fontWeight: 700, marginTop: 8,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <FileDown size={14} />
              Gerar PDF
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────

export function SimuladorOrcamentoTab() {
  const { rows: dbRows } = useTabelaPrecos();
  const {
    simulacoes, itensDaSimulacao, totalSimulacao, totalComDesconto,
    criarSimulacao, adicionarItem, removerItem, updateSimulacaoDesconto, updateSimulacaoPagamento, updateSimulacaoStatus, deletarSimulacao,
    registrarPropostaGerada,
  } = useOrcamento();
  const [kanbanCards, setKanbanCards] = React.useState<DbCard[]>([]);
  React.useEffect(() => {
    supabase.from("kanban_cards").select("id,obra,title,subtitle,column_id,details").order("obra").then(({ data }) => {
      setKanbanCards((data ?? []) as DbCard[]);
    });
  }, []);

  const [view, setView] = React.useState<"lista" | "editor">("lista");
  const [simulacaoAtiva, setSimulacaoAtiva] = React.useState<SimulacaoProjeto | null>(null);
  const [novaModal, setNovaModal] = React.useState(false);
  const [propostaRapidaModal, setPropostaRapidaModal] = React.useState<SimulacaoProjeto | null>(null);

  async function handleCriarSimulacao(data: Parameters<typeof criarSimulacao>[0]) {
    const nova = await criarSimulacao(data);
    if (nova) {
      setSimulacaoAtiva(nova);
      setView("editor");
    }
    setNovaModal(false);
  }

  function handleEditar(sim: SimulacaoProjeto) {
    setSimulacaoAtiva(sim);
    setView("editor");
  }

  function handleVoltar() {
    setSimulacaoAtiva(null);
    setView("lista");
  }

  return (
    <>
      {view === "lista" && (
        <ListaSimulacoes
          simulacoes={simulacoes}
          itensDaSimulacao={itensDaSimulacao}
          totalSimulacao={totalSimulacao}
          onEditar={handleEditar}
          onGerarProposta={(sim) => setPropostaRapidaModal(sim)}
          onDeletar={deletarSimulacao}
          onNova={() => setNovaModal(true)}
          onAtualizarStatus={updateSimulacaoStatus}
        />
      )}

      {view === "editor" && simulacaoAtiva && (
        <EditorSimulacao
          simulacao={simulacaoAtiva}
          itensDaSimulacao={itensDaSimulacao}
          totalSimulacao={totalSimulacao}
          totalComDesconto={totalComDesconto}
          adicionarItem={adicionarItem}
          removerItem={removerItem}
          updateSimulacaoDesconto={updateSimulacaoDesconto}
          updateSimulacaoPagamento={updateSimulacaoPagamento}
          registrarPropostaGerada={registrarPropostaGerada}
          dbRows={dbRows}
          onVoltar={handleVoltar}
        />
      )}

      {/* Modal Nova Simulação */}
      {novaModal && (
        <NovaSimulacaoModal
          cards={kanbanCards}
          onClose={() => setNovaModal(false)}
          onConfirm={handleCriarSimulacao}
        />
      )}

      {/* Modal proposta rápida da lista */}
      {propostaRapidaModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onMouseDown={() => setPropostaRapidaModal(null)}
        >
          <div
            style={{ background: "#0e0e0e", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Gerar Proposta</span>
              <button onClick={() => setPropostaRapidaModal(null)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, padding: "4px 8px", color: TEXT_DIM, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div style={{ color: TEXT_MED, fontSize: 13, marginBottom: 20 }}>
              Gerar proposta PDF para <strong style={{ color: "#fff" }}>{propostaRapidaModal.cliente}</strong> — {propostaRapidaModal.obra_code}?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPropostaRapidaModal(null)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_MED, cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const sim = propostaRapidaModal;
                  const itens = itensDaSimulacao(sim.id);
                  const itensParaProposta = itens.map((it: any, i: number) => ({
                    id: String(i),
                    categoria: it.categoria || "ITEM",
                    descritivo: it.descritivo,
                    valor: it.valor,
                    ordem: it.ordem ?? i,
                  }));
                  abrirPropostaParaImpressao(
                    {
                      numero: sim.numero,
                      cliente: sim.cliente,
                      cnpj_cpf: sim.cnpj_cpf,
                      endereco: sim.endereco,
                      obra_code: sim.obra_code,
                      vendedor: sim.vendedor,
                      validade_dias: sim.validade_dias,
                      desconto_perc: sim.desconto_perc,
                      created_at: sim.created_at,
                      arquiteto: sim.arquiteto,
                      forma_pagamento: sim.forma_pagamento,
                    },
                    itensParaProposta
                  );
                  registrarPropostaGerada(sim.id);
                  setPropostaRapidaModal(null);
                }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0", borderRadius: 8, border: "none",
                  background: YELLOW, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
                }}
              >
                <FileDown size={14} /> Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
