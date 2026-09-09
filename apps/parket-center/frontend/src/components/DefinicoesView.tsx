/** Definições do Projeto — navegação por SERVIÇO (PISO/DECK/FORRO/PAINEL).
 *  Cada serviço abre duas seções: Obrigatórias (marcadas [#] no Guia 1) e
 *  Complementares (aditivos e refinamentos). A resposta vale pra todos os
 *  ambientes daquele serviço no mapa — o Wood aplica no anteprojeto.
 *  Ata tratada (meta.definicoes.secoes) tem prioridade. Respostas persistem
 *  em meta.definicoes.respostas com chave "SERVIÇO|Pergunta". */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Download, FileText, Lightbulb, X } from "lucide-react";
import type { CenterData, Definicoes, DefinicaoArquivo, DefinicaoResposta, DefinicaoSecao, ItemObra } from "../api";
import { api, fmtData, fmtDataHora } from "../api";
import { type ColorScheme, serif } from "../theme";
import { useMobile } from "../useMobile";
import { VALIDADOR_KEY } from "./ChecklistObras";
import {
  DEF_PISO, DEF_DECK, DEF_FORRO, DEF_PAINEL,
  REGRAS, AVISOS, defsDoServico, servicoDoItem, derivarPaginacao, ehDerivada,
  type DefinicaoDef, type OpcaoDef, type Escolhas, type Camada, type Servico, type SugestaoCruzada,
} from "./definicoesCatalogo";

const TEC = "/definicoes/tec/";
const SERVICOS_ORDEM: Servico[] = ["PISO", "DECK", "FORRO", "PAINEL"];
const SERVICO_LABEL: Record<Servico, string> = {
  PISO: "Piso", DECK: "Deck", FORRO: "Forro", PAINEL: "Painéis",
};

function folhasDe(defs: DefinicaoDef[]): { img: string; alt: string }[] {
  const vistos = new Set<string>();
  const fs: { img: string; alt: string }[] = [];
  defs.flatMap(d => d.opcoes || []).forEach(o => {
    if (!o.img || vistos.has(o.img)) return;
    vistos.add(o.img);
    fs.push({ img: o.img, alt: `${o.id} ${o.nome}` });
  });
  return fs;
}
const FOLHAS: Record<Servico, { img: string; alt: string }[]> = {
  PISO: folhasDe(DEF_PISO), DECK: folhasDe(DEF_DECK),
  FORRO: folhasDe(DEF_FORRO), PAINEL: folhasDe(DEF_PAINEL),
};

const EASE = "cubic-bezier(.22,.61,.36,1)";
const ANIM = `
.dfv-sec{border:1px solid var(--dfv-linha);margin:0 0 10px}
.dfv-sech{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 18px;color:var(--dfv-tinta)}
.dfv-sech::-webkit-details-marker{display:none}
.dfv-sech::marker{content:""}
.dfv-sect{font-size:11px;letter-spacing:.12em;text-transform:uppercase;line-height:1.5}
.dfv-tagqt{flex:none;font-size:10px;line-height:1;letter-spacing:.08em;padding:3px 7px;border:1px solid var(--dfv-madeira);color:var(--dfv-madeira)}
.dfv-tagqt.off{border-color:var(--dfv-linha);color:var(--dfv-apagado);text-transform:uppercase}
.dfv-chev{flex:none;margin-left:auto;color:var(--dfv-apagado);transition:transform .3s ${EASE}}
.dfv-sec[open]>.dfv-sech .dfv-chev{transform:rotate(180deg)}
.dfv-secbody{padding:0 14px 14px;display:grid;gap:8px}
.dfv-pergunta{margin:0;padding:0 0 2px;font-size:11.5px;color:var(--dfv-apagado);line-height:1.55}
.dfv-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dfv-card{all:unset;box-sizing:border-box;display:block;cursor:pointer;border:1px solid var(--dfv-linha);overflow:hidden;transition:border-color .3s ${EASE},box-shadow .3s ${EASE}}
.dfv-card:hover{border-color:var(--dfv-apagado)}
.dfv-card.on{border-color:var(--dfv-madeira);box-shadow:inset 0 0 0 1px var(--dfv-madeira)}
.dfv-card:focus-visible{outline:1px solid var(--dfv-madeira);outline-offset:2px}
.dfv-cardimg{display:block;aspect-ratio:1/1;overflow:hidden}
.dfv-cardimg img{display:block;width:100%;height:100%;object-fit:contain}
.dfv-cardinfo{display:grid;gap:3px;padding:10px 12px;border-top:1px solid var(--dfv-linha)}
.dfv-cardpreco{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dfv-apagado)}
.dfv-cardpreco.vago{opacity:.75}
.dfv-cardrow{display:flex;align-items:center;gap:8px}
.dfv-cardnome{flex:1;min-width:0;font-size:12px;line-height:1.35;color:var(--dfv-tinta)}
.dfv-pin{flex:none;width:13px;height:13px;box-sizing:border-box;border:1px solid var(--dfv-apagado);display:grid;place-items:center;color:transparent;transition:background .3s ${EASE},border-color .3s ${EASE},color .3s ${EASE}}
.on .dfv-pin{background:var(--dfv-madeira);border-color:var(--dfv-madeira);color:var(--dfv-sobre)}
.dfv-oprow{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;cursor:pointer;border:1px solid var(--dfv-linha);padding:11px 12px;transition:border-color .3s ${EASE},box-shadow .3s ${EASE}}
.dfv-oprow:hover{border-color:var(--dfv-apagado)}
.dfv-oprow.on{border-color:var(--dfv-madeira);box-shadow:inset 0 0 0 1px var(--dfv-madeira)}
.dfv-oprow:focus-visible{outline:1px solid var(--dfv-madeira);outline-offset:2px}
.dfv-alterar{all:unset;cursor:pointer;flex:none;font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-family:inherit;color:var(--dfv-madeira);border-bottom:1px solid color-mix(in srgb, var(--dfv-madeira) 40%, transparent);transition:border-color .3s ${EASE}}
.dfv-alterar:hover{border-bottom-color:var(--dfv-madeira)}
.dfv-folha{position:absolute;inset:0;opacity:0;transition:opacity 0s linear .38s}
.dfv-folha.on{opacity:1;transition:opacity .38s ${EASE} 0s}
.dfv-servchip{all:unset;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--dfv-linha);color:var(--dfv-apagado);transition:border-color .2s ${EASE},color .2s ${EASE},background .2s ${EASE}}
.dfv-servchip:hover{border-color:var(--dfv-madeira);color:var(--dfv-tinta)}
.dfv-servchip.on{background:var(--dfv-madeira);color:var(--dfv-sobre);border-color:var(--dfv-madeira)}
.dfv-sugbanner{display:flex;gap:10px;padding:10px 12px;border:1px solid color-mix(in srgb, var(--dfv-madeira) 40%, transparent);background:color-mix(in srgb, var(--dfv-madeira) 8%, transparent);margin:0 0 10px}
@media (prefers-reduced-motion:reduce){.dfv-folha,.dfv-folha.on,.dfv-chev{transition:none}}
`;

function nomeValidador(): string {
  try { return localStorage.getItem(VALIDADOR_KEY) || ""; } catch { return ""; }
}

/* ── leitura das escolhas persistidas ────────────────────────────────── */
function normNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
function acharOpcaoPorNome(def: DefinicaoDef, raw: string): string | undefined {
  const opcoes = def.opcoes || [];
  const exato = opcoes.find(o => o.nome === raw);
  if (exato) return exato.id;
  const n = normNome(raw);
  const iguais = opcoes.find(o => normNome(o.nome) === n);
  if (iguais) return iguais.id;
  // Tolerante: catálogo mudou (ex: "Cordão" → "Cordão de madeira"). Casa se
  // o nome persistido é prefixo/substring de uma opção atual — só se for
  // match único, senão vira ambíguo (fica sem seleção).
  const cont = opcoes.filter(o => normNome(o.nome).includes(n) || n.includes(normNome(o.nome)));
  return cont.length === 1 ? cont[0].id : undefined;
}
function parseEscolha(def: DefinicaoDef, raw: string | undefined): string | string[] | undefined {
  if (!raw) return undefined;
  if (def.tipo === "texto-longo") return raw;
  const recusa = def.recusa || "Não";
  if (raw === recusa || raw === "Não" || raw === "Não sobe") return "nao";
  if (def.tipo === "multi") {
    const ids = raw.split(" · ")
      .map(nome => acharOpcaoPorNome(def, nome.trim()))
      .filter((x): x is string => !!x);
    return ids.length ? ids : undefined;
  }
  return acharOpcaoPorNome(def, raw);
}

function escolhasDoServico(defs: DefinicaoDef[], resp: (pergunta: string) => string | undefined): Escolhas {
  const e: Escolhas = {};
  defs.forEach(d => { e[d.id] = parseEscolha(d, resp(d.nome)); });
  return e;
}

function defsBloqueadas(e: Escolhas): Map<string, string> {
  const m = new Map<string, string>();
  REGRAS.forEach(r => { if (r.quando(e)) m.set(r.bloqueia, r.motivo); });
  return m;
}

function resumoEscolha(def: DefinicaoDef, e: string | string[] | undefined): string {
  if (e === undefined) return "";
  if (e === "nao") {
    const r = def.recusa || "Não";
    return r.startsWith("Não quero") ? "Não" : r;
  }
  if (def.tipo === "texto-longo") return "anotado";
  if (Array.isArray(e)) {
    return e.map(id => def.opcoes?.find(o => o.id === id)?.nome).filter(Boolean).join(", ");
  }
  return def.opcoes?.find(o => o.id === e)?.nome || "";
}

/* ── UI base ─────────────────────────────────────────────────────────── */
function EstadoBadge({ ok, c, isDark }: { ok: boolean; c: ColorScheme; isDark: boolean }) {
  return (
    <span style={{
      fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
      padding: "4px 9px", whiteSpace: "nowrap", flexShrink: 0,
      background: ok ? (isDark ? "rgba(244,241,234,0.05)" : "#F2F0EC")
                     : (isDark ? "rgba(185,130,42,0.10)" : "#FFF5E0"),
      color: ok ? c.textSecondary : (isDark ? "#C8922A" : "#8A6010"),
    }}>
      {ok ? "Definido" : "A definir"}
    </span>
  );
}

/* ── pilha de camadas ────────────────────────────────────────────────── */
function PilhaCamadas({ camada, nota, c }: { camada?: Camada; nota: string; c: ColorScheme }) {
  const on = (k: Camada) => camada === k;
  const traco = (k: Camada): React.CSSProperties => ({
    stroke: on(k) ? c.accent : c.textTertiary, strokeWidth: 0.6, fill: "none",
    transition: `stroke .6s ${EASE}`,
  });
  const corpo = (k: Camada): React.CSSProperties => ({
    fill: on(k) ? c.accent : c.textPrimary, opacity: on(k) ? 0.5 : 0.1,
    transition: `opacity .6s ${EASE}, fill .6s ${EASE}`,
  });
  return (
    <figure style={{ margin: 0, display: "grid", gap: 8 }}>
      <svg viewBox="0 0 240 118" role="img" style={{ width: "100%", maxWidth: 340, height: "auto", display: "block", overflow: "visible" }}>
        <g>
          <rect style={corpo("assoalho")} x={4} y={44} width={108} height={12} />
          <rect style={traco("assoalho")} x={4} y={44} width={108} height={12} />
        </g>
        <g>
          <rect style={{ fill: c.textPrimary, opacity: 0.1 }} x={4} y={61} width={108} height={45} />
          <rect style={{ stroke: c.textTertiary, strokeWidth: 0.6, fill: "none" }} x={4} y={61} width={108} height={45} />
        </g>
        <g style={{ opacity: on("entre") ? 1 : 0, transition: `opacity .6s ${EASE}` }}>
          <rect style={corpo("entre")} x={4} y={61} width={108} height={11} />
          <rect style={traco("entre")} x={4} y={61} width={108} height={11} />
        </g>
      </svg>
      <figcaption style={{ fontSize: 10, color: c.textTertiary, lineHeight: 1.6 }}>{nota}</figcaption>
    </figure>
  );
}

/* ── campo extra ─────────────────────────────────────────────────────── */
function CampoExtra({ campo, valor, c, isDark, onSalvar }: {
  campo: NonNullable<DefinicaoDef["campos"]>[number]; valor: string;
  c: ColorScheme; isDark: boolean; onSalvar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(244,241,234,0.03)" : "#FBFAF7",
    border: `1px solid ${c.border2}`, borderRadius: 0, color: c.textPrimary,
    fontSize: 12, padding: "7px 10px", fontFamily: "inherit", outline: "none",
    width: campo.tipo === "medida" ? 90 : 190,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                     color: c.textTertiary, minWidth: 84 }}>{campo.rotulo}</span>
      {campo.tipo === "opcao-curta" ? (
        (campo.valores || []).map(v => (
          <button key={v} type="button" onClick={() => onSalvar(v)}
            style={{
              cursor: "pointer", padding: "6px 11px", fontSize: 11, fontFamily: "inherit",
              background: valor === v ? c.accent : "none",
              color: valor === v ? "#0B0B0B" : c.textSecondary,
              border: valor === v ? "none" : `1px solid ${c.border2}`,
            }}>{v}</button>
        ))
      ) : (
        <>
          <input value={texto} onChange={e => setTexto(e.target.value)}
            onBlur={() => { if (texto.trim() !== valor) onSalvar(texto.trim()); }}
            placeholder={campo.placeholder || (campo.sugestoes || []).join(" / ")}
            inputMode={campo.tipo === "medida" ? "decimal" : undefined}
            style={inputStyle} />
          {campo.unidade && <span style={{ fontSize: 11, color: c.textTertiary }}>{campo.unidade}</span>}
        </>
      )}
    </div>
  );
}

/* ── editor de cotas (integração WoodPlanner/Draw) ───────────────────── */
/* A opção escolhida pode resolver pra um ou mais detalhes técnicos do Wood
 * (mesma cadeia de resolução do anteprojeto). Quando o detalhe tem cotas
 * numéricas editáveis, o cliente ajusta as medidas AQUI e o desenho é
 * re-renderizado ao vivo pelo backend do Draw. As medidas salvas propagam
 * pro anteprojeto e pro WoodPlanner como "detalhe do cliente" (Will 26/08).
 * Campos nomeados por LETRAS (A, B, C...) — o mapeamento fino de quais
 * cotas podem ser editadas vive no center_cotas_config.json do Draw. */

// O Draw devolve URLs com prefixo /api/; no Center o nginx expõe o backend
// do Draw em /draw-api/ (mesma rede overlay do swarm). Reescreve o prefixo.
const drawUrl = (u: string) => u.replace(/^\/api\//, "/draw-api/");

type CotaDef = { tid: string; valor: string; letra: string };
type DetalheCotas = {
  categoria: string; id: string; label: string;
  preview_url: string; render_url: string; cotas: CotaDef[];
};

// Cache por opção: o catálogo é estático na sessão, então cada opção só
// consulta o Draw uma vez (abrir/fechar accordion não repete o POST).
const cotasCache = new Map<string, DetalheCotas[]>();

async function buscarDetalhesCotas(servico: Servico, opcaoIds: string[]): Promise<DetalheCotas[]> {
  const faltam = opcaoIds.filter(id => !cotasCache.has(`${servico}|${id}`));
  if (faltam.length > 0) {
    const r = await fetch("/draw-api/wood/detalhes/center-cotas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: faltam.map(id => ({ servico, opcao_id: id })) }),
    });
    if (!r.ok) throw new Error(`center-cotas ${r.status}`);
    const j = await r.json();
    for (const item of (j.itens || [])) {
      cotasCache.set(`${servico}|${item.opcao_id}`, item.detalhes || []);
    }
  }
  // Agrega na ordem das opções escolhidas, dedup por categoria/id e só
  // devolve detalhes que têm pelo menos uma cota editável.
  const vistos = new Set<string>();
  const out: DetalheCotas[] = [];
  for (const id of opcaoIds) {
    for (const d of (cotasCache.get(`${servico}|${id}`) || [])) {
      const k = `${d.categoria}/${d.id}`;
      if (vistos.has(k) || (d.cotas || []).length === 0) continue;
      vistos.add(k);
      out.push(d);
    }
  }
  return out;
}

/* Campos A/B/C de UM detalhe. Sem desenho próprio: o preview vai pra
 * prancha MAXIMIZADA via onPreview (Will 26/08: nada de card duplicado
 * na coluna de definições; o lado direito da tela é o lugar dos ajustes).
 * Digitou → debounce 350ms → POST /render com overrides → o desenho
 * grande troca pro PNG novo. Apagar (ou voltar ao valor original)
 * restaura o preview padrão e limpa o override persistido. */
function CotasFieldsDetalhe({ detalhe, inicial, ativo, mostraLabel, c, isDark, onAtivar, onPreview, onSalvar }: {
  detalhe: DetalheCotas; inicial: Record<string, string>;
  ativo: boolean; mostraLabel: boolean;
  c: ColorScheme; isDark: boolean;
  onAtivar: () => void;
  onPreview: (p: { src: string; rodando: boolean } | null) => void;
  onSalvar: (overrides: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    detalhe.cotas.forEach(ct => { v[ct.tid] = inicial[ct.tid] ?? ct.valor; });
    return v;
  });
  const [src, setSrc] = useState(() => drawUrl(detalhe.preview_url));
  const [rodando, setRodando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const blobRef = useRef<string | undefined>(undefined);
  const seqRef = useRef(0); // descarta respostas fora de ordem

  // Espelha o desenho DESTE detalhe na prancha maximizada (só o ativo,
  // quando a definição resolve pra mais de um detalhe cotado).
  useEffect(() => {
    if (ativo) onPreview({ src, rodando });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, src, rodando]);

  // Só vira override o que difere do valor original do desenho.
  function overridesLimpos(v: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    detalhe.cotas.forEach(ct => {
      const t = (v[ct.tid] ?? "").trim();
      if (t && t !== ct.valor) out[ct.tid] = t;
    });
    return out;
  }

  async function renderiza(ovr: Record<string, string>) {
    const seq = ++seqRef.current;
    setRodando(true);
    try {
      const r = await fetch(drawUrl(detalhe.render_url), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: ovr, max_width: 1000, format: "png" }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      if (seq !== seqRef.current) return; // já veio render mais novo
      const url = URL.createObjectURL(blob);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = url;
      setSrc(url);
    } catch { /* mantém o desenho anterior; a medida salva vale mesmo assim */ }
    finally { if (seq === seqRef.current) setRodando(false); }
  }

  // Override já persistido de sessão anterior: mostra o desenho editado
  // logo na primeira carga (sem salvar de novo).
  useEffect(() => {
    const ovr = overridesLimpos(vals);
    if (Object.keys(ovr).length > 0) renderiza(ovr);
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(tid: string, valor: string) {
    const v = { ...vals, [tid]: valor };
    setVals(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const ovr = overridesLimpos(v);
      onSalvar(ovr);
      if (Object.keys(ovr).length === 0) {
        // voltou tudo ao original: preview padrão do bucket
        seqRef.current++;
        if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = undefined; }
        setSrc(drawUrl(detalhe.preview_url));
        setRodando(false);
      } else {
        renderiza(ovr);
      }
    }, 350);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {mostraLabel && (
        /* Nome do detalhe só quando a definição resolve pra mais de um
         * desenho cotado (senão o nome já está na prancha acima). */
        <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                       color: c.textPrimary }}>
          {detalhe.label}
        </span>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {detalhe.cotas.map(ct => {
          const editada = (vals[ct.tid] ?? "").trim() !== ct.valor && (vals[ct.tid] ?? "").trim() !== "";
          return (
            <label key={ct.tid} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 20, height: 20, boxSizing: "border-box", flex: "none",
                display: "grid", placeItems: "center", fontSize: 10,
                border: `1px solid ${editada ? c.accent : c.border2}`,
                color: editada ? c.accent : c.textSecondary,
              }}>{ct.letra}</span>
              <input value={vals[ct.tid] ?? ""} inputMode="decimal"
                onChange={e => onChange(ct.tid, e.target.value)}
                onFocus={onAtivar}
                placeholder={ct.valor}
                style={{
                  width: 66, background: isDark ? "rgba(244,241,234,0.03)" : "#FBFAF7",
                  border: `1px solid ${editada ? c.accent : c.border2}`, borderRadius: 0,
                  color: c.textPrimary, fontSize: 12, padding: "6px 8px",
                  fontFamily: "inherit", outline: "none",
                }} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* Painel de ajustes do modo focus: aparece logo ABAIXO da prancha
 * maximizada quando a opção escolhida resolve pra detalhe com cotas
 * editáveis. A prancha grande em si vira o preview vivo do Draw (via
 * onPreview) — Will 26/08: os ajustes moram no lado direito da tela,
 * junto da visualização maximizada. Persistência: UMA resposta JSON por
 * definição na chave "SERVICO|Def — Cotas", overrides por detalhe
 * (mesma cadeia que o anteprojeto e o WoodPlanner leem). */
function CotasFocus({ servico, def, opcaoIds, respostas, c, isDark, salvaSilencioso, onPreview }: {
  servico: Servico; def: DefinicaoDef; opcaoIds: string[];
  respostas: Record<string, DefinicaoResposta>;
  c: ColorScheme; isDark: boolean;
  salvaSilencioso: (secao: string, pergunta: string, resposta: string) => void;
  onPreview: (p: { src: string; rodando: boolean } | null) => void;
}) {
  // null = ainda consultando o Draw (não renderiza nada pra não piscar)
  const [detalhes, setDetalhes] = useState<DetalheCotas[] | null>(null);
  useEffect(() => {
    let vivo = true;
    buscarDetalhesCotas(servico, opcaoIds)
      .then(ds => {
        if (!vivo) return;
        setDetalhes(ds);
        if (ds.length === 0) onPreview(null); // sem cota: prancha do catálogo
      })
      .catch(() => { if (vivo) { setDetalhes([]); onPreview(null); } });
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, def.id, opcaoIds.join("|")]);

  // Fechou o focus / trocou de definição: prancha volta pro catálogo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onPreview(null), []);

  const chaveCotas = `${def.nome} — Cotas`;
  // Overrides persistidos: lidos UMA vez na montagem; daí em diante o
  // estado vive no ref (o save atualiza `respostas` upstream, mas re-ler
  // aqui criaria loop de re-render a cada tecla).
  const [inicial] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const raw = respostas[`${servico}|${chaveCotas}`]?.resposta;
      return raw ? (JSON.parse(raw).overrides_por_detalhe || {}) : {};
    } catch { return {}; }
  });
  const ovrRef = useRef<Record<string, Record<string, string>>>({ ...inicial });

  function salvaOverrides(detKey: string, ovr: Record<string, string>) {
    if (Object.keys(ovr).length > 0) ovrRef.current[detKey] = ovr;
    else delete ovrRef.current[detKey];
    const payload = Object.keys(ovrRef.current).length > 0
      ? JSON.stringify({ overrides_por_detalhe: ovrRef.current }) : "";
    salvaSilencioso(servico, chaveCotas, payload);
  }

  if (!detalhes || detalhes.length === 0) return null;

  // SÓ o detalhe da opção clicada/maximizada (Will 26/08: sem empilhar,
  // sem seletor — opcaoIds já chega com uma opção só, vindo do pv.o do
  // pai). `key` remonta ao trocar de opção e o `inicial` vem de ovrRef
  // (edits desta sessão) pra nada sumir ao alternar entre opções.
  const at = detalhes[0];
  const atKey = `${at.categoria}/${at.id}`;

  return (
    <div style={{ display: "grid", gap: 12, padding: "14px 2px 0" }}>
      <span style={{ fontSize: 9.5, color: c.textTertiary }}>
        Ajuste as medidas abaixo: o desenho acima atualiza na hora.
      </span>
      <CotasFieldsDetalhe key={atKey} detalhe={at}
        inicial={ovrRef.current[atKey] || {}}
        ativo={true} mostraLabel={false}
        c={c} isDark={isDark}
        onAtivar={() => {}} onPreview={onPreview}
        onSalvar={ovr => salvaOverrides(atKey, ovr)} />
      <span style={{ fontSize: 9.5, color: c.textTertiary, lineHeight: 1.5 }}>
        Valores na mesma unidade do desenho. Para voltar ao padrão, apague o campo.
      </span>
    </div>
  );
}

/* Coluna de definições: SÓ os campos manuais do catálogo, e apenas
 * quando a opção NÃO resolve pra detalhe cotado do Wood. Quando resolve,
 * quem assume é o CotasFocus embaixo da prancha maximizada (Will 26/08:
 * nada de editor/visualização duplicada na coluna de definições). */
function CamposSeSemCotas({ servico, def, opcaoIds, respostas, c, isDark, salvaSilencioso }: {
  servico: Servico; def: DefinicaoDef; opcaoIds: string[];
  respostas: Record<string, DefinicaoResposta>;
  c: ColorScheme; isDark: boolean;
  salvaSilencioso: (secao: string, pergunta: string, resposta: string) => void;
}) {
  // null = ainda consultando o Draw (não renderiza nada pra não piscar)
  const [temCotas, setTemCotas] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    buscarDetalhesCotas(servico, opcaoIds)
      .then(ds => { if (vivo) setTemCotas(ds.length > 0); })
      .catch(() => { if (vivo) setTemCotas(false); }); // Draw fora do ar: campos manuais
    return () => { vivo = false; };
  }, [servico, def.id, opcaoIds.join("|")]);

  if (temCotas !== false || !def.campos) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
      {def.campos.map(campo => {
        const perguntaCampo = `${def.nome} — ${campo.rotulo}`;
        return (
          <CampoExtra key={`${servico}-${def.id}-${campo.id}`} campo={campo}
            valor={respostas[`${servico}|${perguntaCampo}`]?.resposta || ""}
            c={c} isDark={isDark}
            onSalvar={v => salvaSilencioso(servico, perguntaCampo, v)} />
        );
      })}
    </div>
  );
}

/* ── pergunta por texto (categorias sem serviço estruturado) ─────────── */
function TextoPergunta({ pergunta, salvo, c, isDark, onSalvar, placeholder }: {
  pergunta: string; salvo: DefinicaoResposta | undefined; placeholder?: string;
  c: ColorScheme; isDark: boolean; onSalvar: (resposta: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState(salvo?.resposta ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const dirty = texto.trim() !== (salvo?.resposta || "").trim();

  async function salvar() {
    setSalvando(true); setErro(false);
    try { await onSalvar(texto.trim()); } catch { setErro(true); }
    finally { setSalvando(false); }
  }

  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${c.border1}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.textPrimary, lineHeight: 1.5, flex: "1 1 300px" }}>
          {pergunta}
        </div>
        <EstadoBadge ok={!!salvo?.resposta} c={c} isDark={isDark} />
      </div>
      <textarea value={texto} onChange={e => setTexto(e.target.value)}
        placeholder={placeholder || "Escreva aqui a definição…"}
        rows={Math.max(2, Math.ceil((texto.length || 1) / 90))}
        style={{
          width: "100%", boxSizing: "border-box", marginTop: 10,
          background: isDark ? "rgba(244,241,234,0.03)" : "#FBFAF7",
          border: `1px solid ${c.border2}`, borderRadius: 0,
          color: c.textPrimary, fontSize: 13, lineHeight: 1.6,
          padding: "10px 12px", resize: "vertical", fontFamily: "inherit", outline: "none",
        }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 10, color: erro ? (isDark ? "#9B4A5A" : "#7A2030") : c.textTertiary }}>
          {erro ? "Falha ao salvar — tente novamente."
            : salvo?.resposta
              ? `Respondido${salvo.por ? ` por ${salvo.por}` : ""}${salvo.em ? ` · ${fmtDataHora(salvo.em)}` : ""}`
              : ""}
        </div>
        {dirty && (
          <button onClick={salvar} disabled={salvando} style={{
            background: c.accent, border: "none", color: "#0B0B0B",
            cursor: salvando ? "wait" : "pointer", padding: "7px 13px",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            opacity: salvando ? 0.6 : 1, fontFamily: "inherit",
          }}>
            <Check size={11} strokeWidth={2} /> {salvando ? "Salvando…" : "Salvar resposta"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── ata tratada (legado) ────────────────────────────────────────────── */
function SecoesAta({ secoes, respostas, c, isDark, salvar }: {
  secoes: DefinicaoSecao[]; respostas: Record<string, DefinicaoResposta>;
  c: ColorScheme; isDark: boolean;
  salvar: (secao: string, pergunta: string, resposta: string) => Promise<void>;
}) {
  return (
    <>
      {secoes.map(sec => (
        <div key={sec.titulo} style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: serif, fontSize: 22, fontWeight: 400, color: c.textPrimary,
            paddingBottom: 8, borderBottom: `1px solid ${c.border1}`, marginBottom: 4,
          }}>
            {sec.titulo}
          </div>
          {sec.itens.map((item, i) => {
            const chave = `${sec.titulo}|${item.pergunta}`;
            const salvo = respostas[chave] || (item.resposta ? { resposta: item.resposta } : undefined);
            return (
              <TextoPergunta key={`${chave}-${i}`} pergunta={item.pergunta} salvo={salvo}
                c={c} isDark={isDark}
                onSalvar={r => salvar(sec.titulo, item.pergunta, r)} />
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ── sugestões cruzadas: coleta e banner ─────────────────────────────── */
type SugAtiva = SugestaoCruzada & { origem: { servico: Servico; def: string; opcao: string } };

function ativas(servico: Servico, escolhas: Escolhas, defs: DefinicaoDef[]): SugAtiva[] {
  const out: SugAtiva[] = [];
  for (const def of defs) {
    if (!def.sugestoesCruzadas) continue;
    const e = escolhas[def.id];
    if (!e || e === "nao") continue;
    const escolhidos = Array.isArray(e) ? e : [e];
    for (const sug of def.sugestoesCruzadas) {
      const gatilho = sug.quandoOpcao == null
        ? escolhidos
        : (Array.isArray(sug.quandoOpcao) ? sug.quandoOpcao : [sug.quandoOpcao]);
      const casou = escolhidos.find(id => (Array.isArray(gatilho) ? gatilho.includes(id) : true));
      if (!casou) continue;
      out.push({ ...sug, origem: { servico, def: def.id, opcao: casou } });
    }
  }
  return out;
}

function BannerSugestoes({ sugs, c }: { sugs: SugAtiva[]; c: ColorScheme }) {
  if (sugs.length === 0) return null;
  return (
    <div style={{ marginTop: 6, marginBottom: 12 }}>
      {sugs.map((s, i) => (
        <div key={i} className="dfv-sugbanner">
          <Lightbulb size={14} strokeWidth={1.5} style={{ flex: "none", color: c.accent, marginTop: 2 }} />
          <div style={{ fontSize: 11.5, color: c.textSecondary, lineHeight: 1.55 }}>
            <b style={{ color: c.textPrimary }}>Sugestão de {SERVICO_LABEL[s.servico]}:</b>{" "}
            {s.motivo}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── painel de UM serviço (Obrigatórias / Complementares) ────────────────── */
type Preview = { def: DefinicaoDef; o: OpcaoDef | null; recusa?: boolean };

function PainelServico({ servico, defs, folhas, itensDoServico, respostas, escolhas, bloq, avisosAtivos, sugsAtivas, c, isDark, mob, salvaSilencioso }: {
  servico: Servico; defs: DefinicaoDef[]; folhas: { img: string; alt: string }[];
  itensDoServico: ItemObra[];
  respostas: Record<string, DefinicaoResposta>;
  escolhas: Escolhas; bloq: Map<string, string>;
  avisosAtivos: { texto: string }[]; sugsAtivas: SugAtiva[];
  c: ColorScheme; isDark: boolean; mob: boolean;
  salvaSilencioso: (secao: string, pergunta: string, resposta: string) => void;
}) {
  /* Derivadas: paginação vem do produto vendido (chevron/espinha/versailles/
   * tabeira/wood+marble → esse; senão Reta). Single-detail obrigatória (1
   * opção) já vem marcada — é só a prancha pra aparecer no projeto. Auto-
   * salvam na primeira carga se ainda não houver resposta. */
  const opcaoDerivada = (def: DefinicaoDef): OpcaoDef | undefined => {
    if (def.id === "paginacao" && servico === "PISO") {
      const blob = itensDoServico
        .map(it => [(it.meta as any)?.categoria_original, it.meta?.produto_header,
                    it.categoria, it.descritivo].filter(Boolean).join(" "))
        .join(" ");
      const id = derivarPaginacao(blob);
      return def.opcoes?.find(o => o.id === id);
    }
    if ((def.opcoes?.length ?? 0) === 1) return def.opcoes?.[0];
    return undefined;
  };
  useEffect(() => {
    for (const def of defs) {
      if (!ehDerivada(def)) continue;
      if (escolhas[def.id] !== undefined) continue;
      const o = opcaoDerivada(def);
      if (o) salvaSilencioso(servico, def.nome, o.nome);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico]);

  const [ativaId, setAtivaId] = useState(defs[0]?.id || "");
  const [pv, setPv] = useState<Preview>(() => ({ def: defs[0], o: defs[0]?.opcoes?.[0] || null }));
  /* modo focus: mostra prancha ampliada da última opção clicada. Default
   * (modoFocus=false) mostra grid 4-col com tudo que já foi escolhido.
   * O painel fica ABERTO até o cliente fechar no X do topo (Will 26/08 —
   * antes havia auto-reset de 4s, que impedia olhar o desenho com calma). */
  const [modoFocus, setModoFocus] = useState(false);
  function acionaFocus() { setModoFocus(true); }
  const [abertas, setAbertas] = useState<Set<string>>(() => {
    // padrão: abre a primeira seção obrigatória com resposta pendente
    const primeiraPendente = defs.find(d => d.categoria === "obrigatorio" && escolhas[d.id] === undefined);
    return new Set(primeiraPendente ? [primeiraPendente.id] : []);
  });
  const secRefs = useRef<Record<string, HTMLDetailsElement | null>>({});
  const zRef = useRef<Record<string, number>>({});

  function abrir(def: DefinicaoDef) {
    setAtivaId(def.id);
    acionaFocus();
    const e = escolhas[def.id];
    if (e === "nao") { setPv({ def, o: null, recusa: true }); return; }
    const selId = Array.isArray(e) ? e[e.length - 1] : e;
    const o = def.opcoes?.find(x => x.id === selId) || def.opcoes?.[0] || null;
    setPv({ def, o });
  }

  function escolher(def: DefinicaoDef, o: OpcaoDef) {
    setPv({ def, o });
    acionaFocus();
    if (def.tipo === "multi") {
      const e = escolhas[def.id];
      const selecionados = Array.isArray(e) ? e : [];
      const prox = selecionados.includes(o.id)
        ? selecionados.filter(x => x !== o.id)
        : [...selecionados, o.id];
      const nomes = prox
        .map(id => def.opcoes?.find(x => x.id === id)?.nome)
        .filter(Boolean).join(" · ");
      salvaSilencioso(servico, def.nome, nomes);
    } else {
      salvaSilencioso(servico, def.nome, o.nome);
    }
  }

  const selecionadosDe = (def: DefinicaoDef): string[] => {
    const e = escolhas[def.id];
    return Array.isArray(e) ? e : e && e !== "nao" ? [e] : [];
  };

  function recusar(def: DefinicaoDef) {
    const label = def.recusa || "Não";
    setAtivaId(def.id);
    acionaFocus();
    setPv({ def, o: null, recusa: true });
    salvaSilencioso(servico, def.nome, label);
  }

  function clicaCard(def: DefinicaoDef, o: OpcaoDef) {
    setAtivaId(def.id);
    if (def.tipo !== "multi" && selecionadosDe(def).includes(o.id)) {
      setPv({ def, o });
      salvaSilencioso(servico, def.nome, "");
      return;
    }
    escolher(def, o);
  }

  const fundoPrancha = isDark ? c.card2 : "#FAF8F4";

  /* Preview vivo do detalhe cotado: quando a definição ativa resolve pra
   * desenho com cotas editáveis, a prancha MAXIMIZADA mostra o render do
   * Draw (atualiza a cada medida digitada) por cima da folha do catálogo.
   * Setado pelo CotasFocus; null = prancha do catálogo normal. */
  const [detPreview, setDetPreview] = useState<{ src: string; rodando: boolean } | null>(null);

  /* Renderiza uma lista de definições (usado tanto na aba Obrigatórias
   * quanto na Complementares). */
  function listarDefs(lista: DefinicaoDef[]) {
    return lista.map(def => {
      const bloqueada = bloq.has(def.id);
      const sel = selecionadosDe(def);
      const recusada = escolhas[def.id] === "nao";
      const multi = def.tipo === "multi";
      const temRecusa = def.tipo === "sim-nao" || !!def.recusa;
      const derivada = ehDerivada(def);
      return (
        <details key={def.id} className="dfv-sec"
          ref={el => { secRefs.current[def.id] = el; }}
          open={abertas.has(def.id)}
          style={{ background: c.card1, opacity: bloqueada ? 0.65 : 1 }}
          onToggle={e => {
            const aberto = (e.target as HTMLDetailsElement).open;
            setAbertas(prev => {
              if (aberto === prev.has(def.id)) return prev;
              const n = new Set(prev);
              if (aberto) { n.add(def.id); abrir(def); } else n.delete(def.id);
              return n;
            });
          }}>
          <summary className="dfv-sech">
            <span className="dfv-sect">{def.nome}</span>
            {bloqueada
              ? <span style={{ fontSize: 10, fontStyle: "italic", color: c.textTertiary }}>não se aplica</span>
              : recusada
                ? <span className="dfv-tagqt off">não incluir</span>
                : (!derivada && sel.length > 0) && (
                    <span className="dfv-tagqt">{multi ? `${sel.length} SELEC.` : "1 SELEÇÃO"}</span>
                  )}
            <ChevronDown className="dfv-chev" size={16} strokeWidth={1.8} />
          </summary>
          <div className="dfv-secbody">
            {bloqueada && bloq.get(def.id) && (
              <p className="dfv-pergunta">{bloq.get(def.id)}</p>
            )}
            {def.tipo === "texto-longo" ? (
              <TextoPergunta pergunta={def.pergunta || def.nome}
                salvo={respostas[`${servico}|${def.nome}`]}
                placeholder={def.placeholder}
                c={c} isDark={isDark}
                onSalvar={r => Promise.resolve(salvaSilencioso(servico, def.nome, r))} />
            ) : (
              <div className="dfv-cards" style={bloqueada ? { pointerEvents: "none" } : undefined}>
                {(derivada
                    ? [opcaoDerivada(def)].filter((x): x is OpcaoDef => !!x)
                    : (def.opcoes || [])
                  ).map(o => {
                  const on = derivada || (!bloqueada && sel.includes(o.id));
                  return (
                    <button key={o.id} type="button"
                      className={"dfv-card" + (on ? " on" : "")} aria-pressed={on}
                      disabled={bloqueada}
                      onClick={() => {
                        // Derivada/single: só maximiza a folha (já vem selecionada
                        // automaticamente). Toggle/escolha normal segue no clicaCard.
                        if (derivada) { setAtivaId(def.id); setPv({ def, o }); acionaFocus(); }
                        else clicaCard(def, o);
                      }}>
                      {o.img && !o.emDesenvolvimento && (
                        <span className="dfv-cardimg" style={{ background: fundoPrancha }}>
                          <img src={`${TEC}${o.img}.webp`} alt={o.nome} loading="lazy" decoding="async" />
                        </span>
                      )}
                      {o.emDesenvolvimento && (
                        // Placeholder pra definição válida sem prancha ainda desenhada.
                        // O card continua clicável — a seleção do cliente segue normal,
                        // só o desenho técnico ficará indisponível até o Will subir o PDF.
                        <span className="dfv-cardimg" style={{
                          background: fundoPrancha,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 16,
                        }}>
                          <span style={{
                            fontSize: 10, letterSpacing: "0.08em",
                            textTransform: "uppercase", color: c.textTertiary,
                            textAlign: "center", lineHeight: 1.4,
                          }}>
                            Detalhe em desenvolvimento
                          </span>
                        </span>
                      )}
                      <span className="dfv-cardinfo" style={o.img ? undefined : { borderTop: "none" }}>
                        <span className={"dfv-cardpreco" + (def.aditivo ? " vago" : "")}>
                          {def.aditivo ? "Preço a definir" : "Incluído no contrato"}
                        </span>
                        <span className="dfv-cardrow">
                          <span className="dfv-cardnome">{o.nome}</span>
                          <span className="dfv-pin" aria-hidden="true">
                            {multi && <Check size={10} strokeWidth={3} />}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {temRecusa && !bloqueada && !derivada && def.tipo !== "texto-longo" && (
              <button type="button" className={"dfv-oprow" + (recusada ? " on" : "")}
                aria-pressed={recusada} onClick={() => recusar(def)}>
                <span className="dfv-pin" aria-hidden="true" />
                <span className="dfv-cardnome">
                  {def.recusa || "Não incluir"}
                </span>
              </button>
            )}
            {sel.length > 0 && !bloqueada && def.tipo !== "texto-longo" && (
              /* Campos manuais do catálogo — só quando a opção NÃO tem
               * detalhe cotado (cotas moram no painel maximizado). */
              <CamposSeSemCotas servico={servico} def={def} opcaoIds={sel}
                respostas={respostas} c={c} isDark={isDark}
                salvaSilencioso={salvaSilencioso} />
            )}
          </div>
        </details>
      );
    });
  }

  const obrig = defs.filter(d => d.categoria === "obrigatorio");
  const essen = defs.filter(d => d.categoria === "essencial" || !d.categoria);

  const secoes = (
    <div aria-label={`Definições de ${SERVICO_LABEL[servico]}`}>
      <BannerSugestoes sugs={sugsAtivas} c={c} />

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
          color: c.textPrimary, padding: "6px 0 10px",
        }}>
          Obrigatórias
          <span style={{ marginLeft: 8, color: c.textTertiary, fontSize: 9 }}>
            {obrig.filter(d => escolhas[d.id] !== undefined).length}/{obrig.length}
          </span>
        </div>
        {listarDefs(obrig)}
      </div>

      {essen.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
            color: c.textPrimary, padding: "6px 0 10px",
          }}>
            Complementares
            <span style={{ marginLeft: 8, color: c.textTertiary, fontSize: 9 }}>
              {essen.filter(d => escolhas[d.id] !== undefined).length}/{essen.length}
            </span>
          </div>
          {listarDefs(essen)}
        </div>
      )}
    </div>
  );

  /* ── escopo ─────────────────────────────────────────────────────── */
  /* Mostra sempre os obrigatórios (mesmo sem resposta) + só os essenciais
   * que o cliente escolheu. Bloqueadas somem do resumo. */
  const defsResumo = defs.filter(d =>
    !bloq.has(d.id) &&
    (d.categoria === "obrigatorio" || escolhas[d.id] !== undefined),
  );
  const obrigTotal = defs.filter(d => d.categoria === "obrigatorio" && !bloq.has(d.id)).length;
  const obrigFeitos = defs.filter(d =>
    d.categoria === "obrigatorio" && !bloq.has(d.id) && escolhas[d.id] !== undefined,
  ).length;
  const escopo = (
    <aside aria-label={`Resumo de ${SERVICO_LABEL[servico]}`}
           style={{ border: `1px solid ${c.border1}`, background: c.card1, padding: "16px 18px" }}>
      <div style={{ paddingBottom: 10, borderBottom: `1px solid ${c.border1}`,
                    display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textPrimary }}>
          {SERVICO_LABEL[servico]}
        </span>
        <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                       color: c.textTertiary, marginLeft: "auto" }}>
          {obrigFeitos}/{obrigTotal} obrigatórias
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {defsResumo.map((def, i) => {
          const bloqueada = bloq.has(def.id);
          const sel = selecionadosDe(def);
          const primeira = def.opcoes?.find(o => sel.includes(o.id));
          const previa = primeira || def.opcoes?.find(o => o.img);
          const opacidade = primeira ? 1 : bloqueada ? 0.3 : 0.45;
          const resumo = bloqueada ? "—" : resumoEscolha(def, escolhas[def.id]);
          return (
            <div key={def.id} style={{
              display: "flex", gap: 12, alignItems: "center", padding: "10px 0",
              borderBottom: i < defsResumo.length - 1 ? `1px solid ${c.border1}` : undefined,
            }}>
              {previa?.img
                ? <img src={`${TEC}${previa.img}.webp`} alt="" loading="lazy" decoding="async"
                       style={{ width: 48, height: 30, objectFit: "cover", flex: "none",
                                border: `1px solid ${c.border1}`, background: fundoPrancha,
                                boxSizing: "border-box", opacity: opacidade }} />
                : <span style={{ width: 48, height: 30, flex: "none", boxSizing: "border-box",
                                 border: `1px solid ${c.border1}`, background: fundoPrancha }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: "0.14em",
                               textTransform: "uppercase", color: c.textTertiary, marginBottom: 2 }}>
                  {def.nome}
                  {def.categoria === "obrigatorio" && (
                    <span style={{ marginLeft: 6, color: c.accent }}>*</span>
                  )}
                </span>
                <span style={{
                  display: "block", fontSize: 11.5, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: resumo && resumo !== "—" ? c.textPrimary : c.textTertiary,
                }}>
                  {resumo || "a definir"}
                </span>
              </span>
              {!bloqueada && (
                <button type="button" className="dfv-alterar" onClick={() => {
                  setAbertas(prev => prev.has(def.id) ? prev : new Set(prev).add(def.id));
                  abrir(def);
                  try { secRefs.current[def.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }
                  catch { /* noop */ }
                }}>Alterar</button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );

  /* ── prancha ──────────────────────────────────────────────────────── */
  const ativaFolha = pv.o?.img || "__ph__";
  const zmap = zRef.current;
  const zTop = Object.values(zmap).reduce((m, v) => Math.max(m, v), 0);
  if (zmap[ativaFolha] === undefined || zmap[ativaFolha] < zTop) zmap[ativaFolha] = zTop + 1;

  /* Grid 4-col: uma miniatura por opção escolhida (não a última, todas).
   * Auto-selecionadas (derivadas) também aparecem — é o painel de retorno
   * do serviço quando o cliente não está interagindo. */
  const tilesEscolhidos = defs.flatMap(def => {
    if (bloq.has(def.id)) return [];
    const sel = selecionadosDe(def);
    return sel
      .map(id => def.opcoes?.find(o => o.id === id))
      .filter((o): o is OpcaoDef => !!o && !!o.img)
      .map(o => ({ def, o }));
  });

  const larguraStyle: React.CSSProperties = {
    margin: "0 auto", width: "100%",
    maxWidth: mob ? "100%" : "clamp(320px, 42vw, 980px)",
  };

  /* Modo grid: cartas flutuantes, sem moldura, alinhadas no topo (topo do
   * primeiro accordion à esquerda). */
  const gridPranchas = (
    <div style={larguraStyle}>
      {tilesEscolhidos.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      color: c.textTertiary, fontSize: 12, fontFamily: serif,
                      textAlign: "center", padding: "40px 24px" }}>
          Nenhuma definição escolhida ainda — clique nos cards ao lado.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8,
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {tilesEscolhidos.map(({ def, o }, i) => (
            <figure key={`${def.id}-${o.id}-${i}`} style={{ margin: 0, background: "#fff",
                       border: `1px solid ${c.border1}`, display: "flex",
                       flexDirection: "column", overflow: "hidden" }}>
              <div style={{ aspectRatio: "1/1", overflow: "hidden" }}>
                <img src={`${TEC}${o.img}.webp`} alt={o.nome} loading="lazy" decoding="async"
                     style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <figcaption style={{ padding: "6px 8px 8px",
                                    borderTop: `1px solid ${c.border1}` }}>
                <div style={{ fontSize: 8.5, letterSpacing: "0.12em",
                              textTransform: "uppercase", color: c.textTertiary,
                              marginBottom: 2, overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {def.nome}
                </div>
                <div style={{ fontSize: 11, color: c.textPrimary, lineHeight: 1.3,
                              overflow: "hidden", textOverflow: "ellipsis",
                              display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical" }}>
                  {o.nome}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );

  /* Modo focus: prancha grande com moldura + centralizada verticalmente.
   * O X no topo direito é a ÚNICA forma de sair — sem auto-close. */
  const pranchaAmpliada = (
    <figure style={{ ...larguraStyle, position: "relative", overflow: "hidden",
                     aspectRatio: "1/1", background: "transparent" }}>
      <button type="button" aria-label="Fechar visualização"
        onClick={() => setModoFocus(false)}
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 99999,
          width: 30, height: 30, boxSizing: "border-box", cursor: "pointer",
          display: "grid", placeItems: "center", padding: 0,
          background: c.card1, border: `1px solid ${c.border1}`,
          color: c.textSecondary, fontFamily: "inherit",
        }}>
        <X size={15} strokeWidth={1.8} />
      </button>
      {folhas.map((f, i) => (
        <div key={f.img} className={"dfv-folha" + (f.img === ativaFolha ? " on" : "")}
             style={{ zIndex: zmap[f.img] || 0, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <img src={`${TEC}${f.img}.webp`} alt={f.alt} decoding="async"
            loading={i === 0 ? undefined : "lazy"}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ))}
      <div className={"dfv-folha" + (ativaFolha === "__ph__" ? " on" : "")}
           style={{
             zIndex: zmap["__ph__"] || 0, background: fundoPrancha,
             display: "flex", flexDirection: "column", alignItems: "center",
             justifyContent: "center", gap: 8, padding: 20, boxSizing: "border-box",
           }}>
        <span style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary }}>
          {pv.def?.nome}
        </span>
        <span style={{ fontFamily: serif, fontSize: 19, color: c.textSecondary, textAlign: "center", lineHeight: 1.35 }}>
          {pv.recusa
            ? (pv.def?.recusa || "Não")
            : pv.o ? pv.o.nome : pv.def?.nome}
        </span>
      </div>
      {/* Detalhe cotado: cobre a folha do catálogo com o render vivo do
        * Draw enquanto o cliente ajusta as medidas embaixo (Will 26/08). */}
      {detPreview && (
        <div className="dfv-folha on" style={{
          zIndex: 9998, background: fundoPrancha,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img src={detPreview.src} alt={pv.o?.nome || pv.def?.nome || "Detalhe"} decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "contain",
                     opacity: detPreview.rodando ? 0.55 : 1,
                     transition: `opacity .2s ${EASE}` }} />
        </div>
      )}
    </figure>
  );

  /* Campos A/B/C sob a prancha maximizada: SÓ da opção clicada (pv.o),
   * que é a que está maximizada na tela — nunca de todas as marcadas
   * (Will 26/08: nada de vários detalhes misturados nem seletor). Gate:
   * a opção clicada ainda precisa estar selecionada (clicar de novo numa
   * opção single desmarca e os campos somem junto). */
  const selAtiva = pv.def && !bloq.has(pv.def.id) ? selecionadosDe(pv.def) : [];
  const opcaoFoco = pv.o && selAtiva.includes(pv.o.id) ? [pv.o.id] : [];
  const cotasFocusEl = (pv.def && !pv.recusa && pv.def.tipo !== "texto-longo" && opcaoFoco.length > 0) ? (
    <div style={larguraStyle}>
      <CotasFocus key={`${servico}-${pv.def.id}`} servico={servico} def={pv.def}
        opcaoIds={opcaoFoco} respostas={respostas} c={c} isDark={isDark}
        salvaSilencioso={salvaSilencioso} onPreview={setDetPreview} />
    </div>
  ) : null;

  const vis = folhas.length === 0 ? null : (
    mob ? (modoFocus ? <>{pranchaAmpliada}{cotasFocusEl}</> : gridPranchas)
    : modoFocus ? (
      /* focus: sticky centralizada na viewport; campos de cota (quando o
       * detalhe é editável) entram logo abaixo da prancha. margin:auto no
       * wrapper centra quando cabe e permite rolar quando não cabe. */
      <div style={{
        position: "sticky", top: 0, height: "100vh", boxSizing: "border-box",
        padding: "16px 0", display: "flex", flexDirection: "column",
        alignItems: "center", overflowY: "auto",
      }}>
        <div style={{ margin: "auto", width: "100%" }}>
          {pranchaAmpliada}
          {cotasFocusEl}
        </div>
      </div>
    ) : (
      /* grid: sticky no topo, alinhado com a 1ª caixa de definição — o
       * padding-top pula o header "Obrigatórias" da coluna esquerda */
      <div style={{ position: "sticky", top: 0, paddingTop: 32 }}>
        {gridPranchas}
      </div>
    )
  );

  if (mob) {
    return (
      <div style={{ marginTop: 16 }}>
        {vis && (
          <div style={{ position: "sticky", top: 64, zIndex: 40, background: c.bg, padding: "8px 0 12px" }}>
            {vis}
          </div>
        )}
        <div style={{ display: "grid", gap: 22 }}>
          <div style={{ minWidth: 0 }}>{secoes}</div>
          <div style={{ minWidth: 0 }}>{escopo}</div>
        </div>
      </div>
    );
  }

  if (!vis) {
    return (
      <div style={{ display: "grid", gap: 22, marginTop: 20,
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.6fr)" }}>
        <div style={{ minWidth: 0 }}>{secoes}</div>
        <div style={{ minWidth: 0 }}>{escopo}</div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid", alignItems: "start",
      gridTemplateColumns: "minmax(0, 0.76fr) minmax(0, 1fr)",
      gridTemplateAreas: '"sel vis" "esc vis"',
      gap: "22px 30px", marginTop: 20,
    }}>
      <div style={{ gridArea: "vis", minWidth: 0, alignSelf: "stretch" }}>{vis}</div>
      <div style={{ gridArea: "sel", minWidth: 0 }}>{secoes}</div>
      <div style={{ gridArea: "esc", minWidth: 0 }}>{escopo}</div>
    </div>
  );
}

/* ── vista principal ─────────────────────────────────────────────────── */
export function DefinicoesView({ data, c, isDark, token }: {
  data: CenterData; c: ColorScheme; isDark: boolean; token: string;
}) {
  const etapa12 = data.etapas.find(e => e.numero === 12);
  const defs: Definicoes = (etapa12?.meta?.definicoes as Definicoes) || {};
  const [arquivos] = useState<DefinicaoArquivo[]>(defs.arquivos || []);
  const [respostas, setRespostas] = useState<Record<string, DefinicaoResposta>>(defs.respostas || {});
  const [erro, setErro] = useState("");
  const mob = useMobile(900);

  const itens = useMemo(
    () => data.itens.filter(i => i.status !== "cancelado" && !(i.meta as any)?.aux_kind),
    [data.itens]);

  /* Serviços presentes no contrato — cada um aparece só se houver ≥1 item */
  const servicosPresentes = useMemo<Servico[]>(() => {
    const set = new Set<Servico>();
    for (const it of itens) {
      const s = servicoDoItem(it.meta?.categoria_raiz || it.categoria || "");
      if (s) set.add(s);
    }
    return SERVICOS_ORDEM.filter(s => set.has(s));
  }, [itens]);

  const [servicoAtivo, setServicoAtivo] = useState<Servico | null>(null);
  useEffect(() => {
    if (servicoAtivo && servicosPresentes.includes(servicoAtivo)) return;
    setServicoAtivo(servicosPresentes[0] || null);
  }, [servicosPresentes.join("|")]);

  const temAta = (defs.secoes?.length ?? 0) > 0;
  const temConteudo = temAta || itens.length > 0 || (defs.ata_url ?? "") !== "" || arquivos.length > 0;

  async function salvar(secao: string, pergunta: string, resposta: string) {
    const r = await api.definicoesResposta(token, { secao, pergunta, resposta, nome: nomeValidador() });
    setRespostas(prev => ({ ...prev, [r.chave]: r.resposta }));
  }
  function salvaSilencioso(secao: string, pergunta: string, resposta: string) {
    salvar(secao, pergunta, resposta).catch(() => setErro("Falha ao salvar — verifique a conexão."));
  }

  function respDo(secao: string) {
    return (pergunta: string) => {
      const r = respostas[`${secao}|${pergunta}`]?.resposta;
      return r === "" ? undefined : r;
    };
  }

  /* progresso por serviço pra chip contador */
  function progressoServico(s: Servico): { feitos: number; total: number } {
    const ds = defsDoServico(s);
    const resp = respDo(s);
    const escolhas = escolhasDoServico(ds, resp);
    const bloq = defsBloqueadas(escolhas);
    const visiveis = ds.filter(d => !bloq.has(d.id));
    return { total: visiveis.length, feitos: visiveis.filter(d => escolhas[d.id] !== undefined).length };
  }

  const btn = (destaque?: boolean): React.CSSProperties => ({
    background: "none",
    border: `1px solid ${destaque ? c.accent : c.border2}`,
    color: destaque ? c.accent : c.textSecondary,
    cursor: "pointer", padding: "8px 14px", display: "inline-flex",
    alignItems: "center", gap: 7, fontSize: 10, letterSpacing: "0.1em",
    textTransform: "uppercase", fontFamily: "inherit",
  });

  /* Painel do serviço ativo */
  function painelAtivo() {
    if (!servicoAtivo) return null;
    const ds = defsDoServico(servicoAtivo);
    const resp = respDo(servicoAtivo);
    const escolhas = escolhasDoServico(ds, resp);
    const bloq = defsBloqueadas(escolhas);
    const avisosAtivos = servicoAtivo === "PISO" ? AVISOS.filter(a => a.quando(escolhas)) : [];
    const itensDoServ = itens.filter(it =>
      servicoDoItem(it.meta?.categoria_raiz || it.categoria || "") === servicoAtivo);
    /* sugestões cruzadas: coleto TUDO que outros serviços presentes gatilharam,
     * mas mostro só as que apontam pro serviço ativo */
    const todasSugs: SugAtiva[] = [];
    for (const s of servicosPresentes) {
      const dsOutro = defsDoServico(s);
      const escOutro = escolhasDoServico(dsOutro, respDo(s));
      todasSugs.push(...ativas(s, escOutro, dsOutro));
    }
    const paraEsse = todasSugs.filter(s => s.servico === servicoAtivo);
    return (
      <PainelServico key={servicoAtivo}
        servico={servicoAtivo} defs={ds} folhas={FOLHAS[servicoAtivo]}
        itensDoServico={itensDoServ}
        respostas={respostas} escolhas={escolhas} bloq={bloq}
        avisosAtivos={avisosAtivos} sugsAtivas={paraEsse}
        c={c} isDark={isDark} mob={mob}
        salvaSilencioso={salvaSilencioso} />
    );
  }

  return (
    <div style={{
      marginBottom: 30,
      ["--dfv-tinta" as string]: c.textPrimary,
      ["--dfv-apagado" as string]: c.textSecondary,
      ["--dfv-madeira" as string]: c.accent,
      ["--dfv-linha" as string]: c.border1,
      ["--dfv-sobre" as string]: isDark ? "#0B0B0B" : "#FFFFFF",
    } as React.CSSProperties}>
      <style>{ANIM}</style>
      {/* Cabeçalho */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 18,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: c.textTertiary }}>
            {temAta
              ? `${defs.tipo || "Reunião"}${defs.data ? ` · ${fmtData(defs.data)}` : ""}`
              : "Definições do projeto — uma resposta por serviço vale para todos os ambientes daquele serviço"}
          </div>
          {(defs.participantes?.length ?? 0) > 0 && (
            <div style={{ fontSize: 11, color: c.textSecondary, marginTop: 6, lineHeight: 1.6 }}>
              Participantes: {defs.participantes!.join(", ")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {defs.ata_url && (
            <button style={btn()} onClick={() => window.open(defs.ata_url, "_blank")}>
              <Download size={11} strokeWidth={1.5} /> Ata da Reunião
            </button>
          )}
        </div>
      </div>
      {erro && (
        <div style={{ fontSize: 11, color: isDark ? "#9B4A5A" : "#7A2030", marginBottom: 14 }}>{erro}</div>
      )}

      {arquivos.length > 0 && (
        <div style={{ border: `1px solid ${c.border1}`, marginBottom: 26 }}>
          {arquivos.map((a, i) => (
            <div key={`${a.url}-${i}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "12px 16px", borderTop: i > 0 ? `1px solid ${c.border1}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <FileText size={14} strokeWidth={1.5} color={c.textTertiary} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: c.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.nome_arquivo}
                  </div>
                  <div style={{ fontSize: 10, color: c.textTertiary, marginTop: 2 }}>
                    {a.por ? `Enviado por ${a.por} · ` : ""}{a.em ? fmtDataHora(a.em) : ""}
                  </div>
                </div>
              </div>
              <button style={btn()} onClick={() => window.open(a.url, "_blank")}>
                <Download size={11} strokeWidth={1.5} /> Baixar
              </button>
            </div>
          ))}
        </div>
      )}

      {temAta ? (
        <SecoesAta secoes={defs.secoes!} respostas={respostas} c={c} isDark={isDark} salvar={salvar} />
      ) : itens.length > 0 ? (
        <>
          {/* trilho de serviços */}
          {servicosPresentes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {servicosPresentes.map(s => {
                const on = servicoAtivo === s;
                const p = progressoServico(s);
                const pronto = p.total > 0 && p.feitos === p.total;
                return (
                  <button key={s} type="button" className={"dfv-servchip" + (on ? " on" : "")}
                    onClick={() => setServicoAtivo(s)}>
                    {SERVICO_LABEL[s]}
                    <span style={{
                      marginLeft: 8, fontSize: 9, opacity: on ? 0.9 : 0.7,
                      color: on ? "inherit" : pronto ? c.accent : c.textTertiary,
                    }}>
                      {pronto ? "✓" : `${p.feitos}/${p.total}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* painel do serviço ativo — se não há PISO/DECK/FORRO/PAINEL no contrato,
              o trilho fica vazio e nada aparece */}
          {servicoAtivo && painelAtivo()}
        </>
      ) : !temConteudo && (
        <div style={{
          padding: "40px 24px", border: `1px dashed ${c.border2}`,
          textAlign: "center", color: c.textTertiary, fontSize: 12, lineHeight: 1.7,
        }}>
          As definições do projeto serão publicadas aqui após a reunião com a
          equipe Parket. Você também pode enviar arquivos pelo botão acima.
        </div>
      )}
    </div>
  );
}
