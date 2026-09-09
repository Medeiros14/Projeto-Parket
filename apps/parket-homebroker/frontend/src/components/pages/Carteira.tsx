/**
 * Carteira — gestão de relacionamento do vendedor com parceiros (arquitetos,
 * engenheiros, gerenciadoras). Cada vendedor tem sua própria; admin vê todas.
 *
 * Estrutura:
 *  • Grid de cards de parceiros agrupados por tipo
 *  • Botão "+ Adicionar parceiro"
 *  • Card click → abre detalhe (info, coordenadores, atividades/pontos de contato)
 *  • Banner topo: próximos aniversários (parceiro + coordenadores) em 14d
 */
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase, Loader2, Plus, Search, Mail, Phone, Instagram, Cake, Building2,
  RefreshCw, Filter, Users, Trash2, X, Calendar, Tag as TagIcon, MessageSquare, CheckSquare,
  FileText, CheckCircle2, XCircle, Clock, ExternalLink, MapPin, UserPlus, MessageCircle,
  CheckSquare as CheckSqIcon, ListTodo, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, type CarteiraParceiro, type CarteiraCoordenador, type CarteiraAtividade, type CarteiraParceiroTipo, type HistoricoOrcamentoRow, type AgendaTarefa } from "../../lib/api";
import type { AppUser } from "../../lib/auth";
import { fmtRelative, fmtBRLCompact, initials } from "../../lib/format";

const TIPO_META: Record<CarteiraParceiroTipo, { label: string; color: string; bg: string }> = {
  arquiteto:    { label: "Arquiteto",    color: "rgb(var(--hb-text))", bg: "rgba(214,201,180,0.20)" },
  engenheiro:   { label: "Engenheiro",   color: "rgb(var(--hb-text))", bg: "rgba(69,87,99,0.25)" },
  gerenciadora: { label: "Gerenciadora", color: "rgb(var(--hb-text))", bg: "rgba(212,168,83,0.20)" },
  outro:        { label: "Outro",        color: "rgb(var(--hb-text))", bg: "rgba(145,156,157,0.20)" },
};

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const CATEGORIAS_DISPONIVEIS = [
  "Carteira de clientes",
  "Gestão de relacionamento",
  "Contato",
  "Instagram",
  "Amostra",
  "Coordenadores",
  "Estruturação de relacionamento",
] as const;

const ATIVIDADE_TIPOS: { key: string; label: string; icon: string }[] = [
  { key: "contato_telefone", label: "Telefone",     icon: "📞" },
  { key: "visita",           label: "Visita",       icon: "🤝" },
  { key: "amostra",          label: "Amostra",      icon: "📦" },
  { key: "instagram",        label: "Instagram",    icon: "📷" },
  { key: "almoco",           label: "Almoço",       icon: "🍽️" },
  { key: "reuniao",          label: "Reunião",      icon: "💼" },
  { key: "aniversario",      label: "Aniversário",  icon: "🎂" },
  { key: "outro",            label: "Outro",        icon: "•" },
];

function aniversarioProximo(dataStr: string | null, dias = 14): { proximo: boolean; emDias: number | null } {
  if (!dataStr) return { proximo: false, emDias: null };
  const m = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { proximo: false, emDias: null };
  const [, , mes, dia] = m;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ano = hoje.getFullYear();
  let alvo = new Date(ano, parseInt(mes, 10) - 1, parseInt(dia, 10));
  if (alvo < hoje) alvo = new Date(ano + 1, parseInt(mes, 10) - 1, parseInt(dia, 10));
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  return { proximo: diff <= dias, emDias: diff };
}

export function CarteiraPage({ appUser }: { appUser: AppUser }) {
  const isAdmin = appUser.role === "admin" || appUser.role === "superadmin";
  const onlyMine = !isAdmin;

  const [parceiros, setParceiros] = useState<CarteiraParceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<CarteiraParceiroTipo | "">("");
  const [ufFilter, setUfFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.carteiraParceiros(onlyMine ? appUser.id : undefined);
      setParceiros(r);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar carteira.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [appUser.id, onlyMine]);

  const filtered = useMemo(() => {
    let arr = parceiros;
    if (tipoFilter) arr = arr.filter((p) => p.tipo === tipoFilter);
    if (ufFilter)   arr = arr.filter((p) => (p.estado || "").toUpperCase() === ufFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((p) =>
        p.nome.toLowerCase().includes(s) ||
        (p.empresa || "").toLowerCase().includes(s) ||
        (p.email || "").toLowerCase().includes(s) ||
        (p.telefone || "").toLowerCase().includes(s) ||
        (p.cidade || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [parceiros, tipoFilter, ufFilter, search]);

  // UFs presentes nos parceiros — só lista as que aparecem (filtro útil só pro que existe)
  const ufsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    parceiros.forEach((p) => { if (p.estado) set.add(p.estado.toUpperCase()); });
    return Array.from(set).sort();
  }, [parceiros]);

  // Próximos aniversários (parceiros + estimado coordenadores)
  const proximosAniv = useMemo(() => {
    return parceiros
      .map((p) => ({ p, ...aniversarioProximo(p.aniversario, 14) }))
      .filter((x) => x.proximo && x.emDias !== null && x.emDias >= 0)
      .sort((a, b) => (a.emDias || 0) - (b.emDias || 0));
  }, [parceiros]);

  const countsPorTipo = useMemo(() => {
    const c: Record<string, number> = { arquiteto: 0, engenheiro: 0, gerenciadora: 0, outro: 0 };
    parceiros.forEach((p) => { c[p.tipo] = (c[p.tipo] || 0) + 1; });
    return c;
  }, [parceiros]);

  const parceiroDetalhe = parceiros.find((p) => p.id === detalheId) || null;

  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando carteira…
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2.5 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
              <Briefcase size={14} /> Carteira
            </div>
            <div className="text-[10px] text-hb-textDim mt-0.5">
              {onlyMine
                ? "Seus parceiros — arquitetos, engenheiros e gerenciadoras que abrem oportunidades"
                : "Todos os parceiros do time (admin)"}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] tabular text-hb-textDim">
            <div><span className="text-hb-textDim">total</span> <span className="text-hb-text font-bold">{parceiros.length}</span></div>
            {(["arquiteto","engenheiro","gerenciadora"] as const).map((t) => (
              <div key={t}>
                <span style={{ color: TIPO_META[t].color }}>{countsPorTipo[t] || 0}</span> {TIPO_META[t].label.toLowerCase()}s
              </div>
            ))}
            {proximosAniv.length > 0 && (
              <div className="text-hb-amber font-bold inline-flex items-center gap-1" title="Aniversários nos próximos 14 dias">
                <Cake size={10} /> {proximosAniv.length}
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="relative max-w-md flex-1 min-w-[200px]">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, empresa, e-mail, telefone, cidade…"
              className="w-full bg-hb-bg border border-hb-border rounded pl-7 pr-3 py-1.5 text-xs outline-none focus:border-hb-accent" />
          </div>
          <div className="flex border border-hb-border">
            <FilterBtn active={tipoFilter === ""} onClick={() => setTipoFilter("")} label="Todos" />
            {(["arquiteto","engenheiro","gerenciadora","outro"] as const).map((t) => (
              <FilterBtn key={t} active={tipoFilter === t} onClick={() => setTipoFilter(t)}
                label={`${TIPO_META[t].label} (${countsPorTipo[t] || 0})`} color={TIPO_META[t].color} divider />
            ))}
          </div>
          {ufsDisponiveis.length > 0 && (
            <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)}
              className="bg-hb-bg border border-hb-border px-2 py-1.5 text-[10px] text-hb-text uppercase tracking-[0.10em]"
              title="Filtrar por UF">
              <option value="">Todas UFs</option>
              {ufsDisponiveis.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          )}
          <button onClick={reload} title="Recarregar" className="text-hb-textDim hover:text-hb-text p-1">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setNovoOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg hover:opacity-90 transition"
            style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
            <Plus size={11} /> Adicionar parceiro
          </button>
        </div>

        {/* Banner de aniversários */}
        {proximosAniv.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-hb-amber/10 border border-hb-amber/30 text-[10px] text-hb-amber flex-wrap">
            <Cake size={10} /> <b>Próximos aniversários:</b>
            {proximosAniv.slice(0, 8).map(({ p, emDias }) => (
              <button key={p.id} onClick={() => setDetalheId(p.id)}
                className="px-1.5 py-0.5 bg-hb-amber/15 border border-hb-amber/40 hover:bg-hb-amber/25 transition">
                {p.nome.split(" ")[0]} · <b>{emDias === 0 ? "hoje" : emDias === 1 ? "amanhã" : `em ${emDias}d`}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de parceiros */}
      <div className="flex-1 overflow-auto p-4">
        {error && <div className="text-[11px] text-hb-red mb-3">{error}</div>}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-hb-textDim text-sm">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            {parceiros.length === 0 ? (
              <>Sua carteira está vazia. Clique <b>"Adicionar parceiro"</b> pra começar.</>
            ) : (
              <>Nenhum parceiro nesse filtro.</>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map((p) => (
              <ParceiroCard key={p.id} p={p} onClick={() => setDetalheId(p.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {novoOpen && (
        <NovoParceiroModal appUser={appUser}
          onClose={() => setNovoOpen(false)}
          onSaved={async () => { setNovoOpen(false); await reload(); }} />
      )}
      {parceiroDetalhe && (
        <DetalheParceiroModal appUser={appUser} parceiro={parceiroDetalhe}
          onClose={() => setDetalheId(null)}
          onChanged={reload} />
      )}
    </div>
  );
}

/* ───────────────── helpers ───────────────── */

function FilterBtn({ active, onClick, label, color, divider }: {
  active: boolean; onClick: () => void; label: string; color?: string; divider?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1 text-[9px] uppercase transition ${divider ? "border-l border-hb-border" : ""} ${
        active ? "bg-hb-accent/15 text-hb-accent" : "text-hb-textDim hover:text-hb-text"
      }`}
      style={{ letterSpacing: "0.14em", color: active && color ? color : undefined }}>
      {label}
    </button>
  );
}

function ParceiroCard({ p, onClick }: { p: CarteiraParceiro; onClick: () => void }) {
  const tm = TIPO_META[p.tipo];
  const aniv = aniversarioProximo(p.aniversario, 14);
  return (
    <button onClick={onClick}
      className="text-left bg-hb-panel border border-hb-border hover:border-hb-accent/60 transition p-3 flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-[10px] font-bold shrink-0"
          style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.color}40` }}>
          {initials(p.nome)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-hb-text truncate">{p.nome}</div>
          {p.empresa && <div className="text-[10px] text-hb-textDim truncate">{p.empresa}</div>}
        </div>
        <span className="text-[8px] uppercase border px-1.5 py-0.5 shrink-0"
          style={{ color: tm.color, borderColor: tm.color + "50", background: tm.bg, letterSpacing: "0.14em" }}>
          {tm.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-hb-textDim mt-1">
        {p.telefone && <span className="inline-flex items-center gap-0.5"><Phone size={9} /> {p.telefone}</span>}
        {p.email && <span className="inline-flex items-center gap-0.5 truncate"><Mail size={9} /> {p.email}</span>}
        {p.instagram && <span className="inline-flex items-center gap-0.5"><Instagram size={9} /> {p.instagram.replace(/^@/, "")}</span>}
        {(p.cidade || p.estado) && (
          <span className="inline-flex items-center gap-0.5"><MapPin size={9} /> {[p.cidade, p.estado].filter(Boolean).join("/")}</span>
        )}
        {aniv.proximo && (
          <span className="inline-flex items-center gap-0.5 text-hb-amber font-bold" title="Aniversário próximo">
            <Cake size={9} /> {aniv.emDias === 0 ? "hoje" : aniv.emDias === 1 ? "amanhã" : `${aniv.emDias}d`}
          </span>
        )}
      </div>
      {p.categorias.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {p.categorias.slice(0, 4).map((c) => (
            <span key={c} className="text-[8px] uppercase border border-hb-border bg-hb-bg/50 px-1 py-0.5 text-hb-textDim"
              style={{ letterSpacing: "0.10em" }}>{c}</span>
          ))}
          {p.categorias.length > 4 && <span className="text-[8px] text-hb-textDim">+{p.categorias.length - 4}</span>}
        </div>
      )}
    </button>
  );
}

/* ───────────────── Modal: Novo Parceiro ───────────────── */
function NovoParceiroModal({ appUser, onClose, onSaved }: {
  appUser: AppUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<CarteiraParceiroTipo>("arquiteto");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  // Ponto de contato opcional (cria 1 coordenador junto na hora do save)
  const [pcNome, setPcNome] = useState("");
  const [pcPapel, setPcPapel] = useState("");
  const [pcEmail, setPcEmail] = useState("");
  const [pcTelefone, setPcTelefone] = useState("");
  const [pcWhatsapp, setPcWhatsapp] = useState("");
  const [pcAniversario, setPcAniversario] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const podeSalvar = nome.trim().length > 1 && !saving;

  const toggleCat = (c: string) =>
    setCategorias((arr) => arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);

  const salvar = async () => {
    if (!podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      const parceiroNovo = await api.criarParceiro({
        vendedor_id: appUser.id,
        tipo, nome: nome.trim(),
        empresa: empresa.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        instagram: instagram.trim() || null,
        aniversario: aniversario || null,
        cidade: cidade.trim() || null,
        estado: estado || null,
        categorias,
        observacoes: observacoes.trim() || null,
      });
      // Cria ponto de contato inicial se o nome tiver sido preenchido (resto opcional)
      if (pcNome.trim().length > 1) {
        try {
          await api.criarCoordenador({
            parceiro_id: parceiroNovo.id,
            nome: pcNome.trim(),
            papel: pcPapel.trim() || null,
            email: pcEmail.trim() || null,
            telefone: pcTelefone.trim() || null,
            whatsapp: pcWhatsapp.trim() || null,
            instagram: null,
            aniversario: pcAniversario || null,
            observacoes: null,
          });
        } catch (e) {
          console.warn("[criarParceiro] coordenador inicial falhou:", e);
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-lg max-h-[92vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-hb-border">
          <div className="flex items-center gap-2">
            <span className="block w-[3px] h-[14px] bg-hb-accent" />
            <h2 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              Adicionar Parceiro
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <Field label="Tipo *" icon={<Filter size={9} />}>
            <div className="flex gap-1">
              {(["arquiteto","engenheiro","gerenciadora","outro"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`flex-1 px-2 py-1.5 text-[10px] uppercase border transition ${
                    tipo === t ? "bg-hb-accent/15 border-hb-accent text-hb-accent" : "border-hb-border text-hb-textDim hover:text-hb-text"
                  }`}
                  style={{ letterSpacing: "0.14em" }}>
                  {TIPO_META[t].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nome *" icon={<Users size={9} />}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus
              placeholder="Ex.: Marcelo Rosseti" className="hb-cart-input" />
          </Field>
          <Field label="Empresa / Escritório" icon={<Building2 size={9} />}>
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex.: Mahanaim Arquitetura" className="hb-cart-input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone" icon={<Phone size={9} />}>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999" className="hb-cart-input" inputMode="tel" />
            </Field>
            <Field label="E-mail" icon={<Mail size={9} />}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                placeholder="email@dominio.com" className="hb-cart-input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instagram" icon={<Instagram size={9} />}>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="@nome_arquitetura" className="hb-cart-input" />
            </Field>
            <Field label="Aniversário" icon={<Cake size={9} />}>
              <input type="date" value={aniversario} onChange={(e) => setAniversario(e.target.value)}
                className="hb-cart-input tabular" />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label="Cidade" icon={<MapPin size={9} />}>
              <input value={cidade} onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: São Paulo" className="hb-cart-input" />
            </Field>
            <Field label="UF" icon={<MapPin size={9} />}>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}
                className="hb-cart-input tabular">
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Categorias / Estratégias" icon={<TagIcon size={9} />}>
            <div className="flex flex-wrap gap-1">
              {CATEGORIAS_DISPONIVEIS.map((c) => {
                const on = categorias.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCat(c)}
                    className={`px-2 py-1 text-[9px] uppercase border transition ${
                      on ? "bg-hb-accent/15 border-hb-accent/60 text-hb-accent" : "border-hb-border text-hb-textDim hover:text-hb-text"
                    }`}
                    style={{ letterSpacing: "0.12em" }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>
          {/* Ponto de contato inicial — cria 1 coordenador junto. Tudo opcional. */}
          <div className="border border-hb-border bg-hb-bg/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[9px] uppercase text-hb-textDim" style={{ letterSpacing: "0.14em" }}>
              <UserPlus size={9} /> Ponto de contato (opcional)
            </div>
            <Field label="Nome" icon={<Users size={9} />}>
              <input value={pcNome} onChange={(e) => setPcNome(e.target.value)}
                placeholder="Ex.: Ana Silva" className="hb-cart-input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posição" icon={<Briefcase size={9} />}>
                <input value={pcPapel} onChange={(e) => setPcPapel(e.target.value)}
                  placeholder="Ex.: Coordenadora de obra" className="hb-cart-input" />
              </Field>
              <Field label="Aniversário" icon={<Cake size={9} />}>
                <input type="date" value={pcAniversario} onChange={(e) => setPcAniversario(e.target.value)}
                  className="hb-cart-input tabular" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone" icon={<Phone size={9} />}>
                <input value={pcTelefone} onChange={(e) => setPcTelefone(e.target.value)}
                  placeholder="(11) 99999-9999" className="hb-cart-input" inputMode="tel" />
              </Field>
              <Field label="WhatsApp" icon={<MessageCircle size={9} />}>
                <input value={pcWhatsapp} onChange={(e) => setPcWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999" className="hb-cart-input" inputMode="tel" />
              </Field>
            </div>
            <Field label="E-mail" icon={<Mail size={9} />}>
              <input value={pcEmail} onChange={(e) => setPcEmail(e.target.value)} type="email"
                placeholder="email@dominio.com" className="hb-cart-input" />
            </Field>
          </div>

          <Field label="Observações" icon={<MessageSquare size={9} />}>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Preferências, histórico, contexto…" rows={3} className="hb-cart-input resize-none" />
          </Field>
          {error && <div className="text-[10px] text-hb-red">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
          <button onClick={onClose} className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text" style={{ letterSpacing: "0.14em" }}>Cancelar</button>
          <button onClick={salvar} disabled={!podeSalvar}
            className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
            style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
            {saving ? "Salvando" : "Adicionar"}
          </button>
        </div>
      </div>
      <CarteiraInputStyle />
    </div>
  );
}

/* ───────────────── Modal: Detalhe Parceiro ───────────────── */
function DetalheParceiroModal({ appUser, parceiro, onClose, onChanged }: {
  appUser: AppUser;
  parceiro: CarteiraParceiro;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tm = TIPO_META[parceiro.tipo];
  const [coords, setCoords] = useState<CarteiraCoordenador[]>([]);
  const [atividades, setAtividades] = useState<CarteiraAtividade[]>([]);
  const [orcamentos, setOrcamentos] = useState<HistoricoOrcamentoRow[]>([]);
  const [tarefas, setTarefas] = useState<AgendaTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCoordOpen, setAddCoordOpen] = useState(false);
  const [addAtivOpen, setAddAtivOpen] = useState(false);

  const reloadAll = async () => {
    setLoading(true);
    const [c, a, o, t] = await Promise.all([
      api.coordenadoresDoParceiro(parceiro.id),
      api.atividadesDoParceiro(parceiro.id, 100),
      api.historicoOrcamentosParceiro({ nome: parceiro.nome, empresa: parceiro.empresa }).catch(() => []),
      api.tarefasDoParceiro(parceiro.id).catch(() => []),
    ]);
    setCoords(c);
    setAtividades(a);
    setOrcamentos(o);
    setTarefas(t);
    setLoading(false);
  };

  useEffect(() => { reloadAll(); /* eslint-disable-next-line */ }, [parceiro.id]);

  const removerCoord = async (id: string) => {
    if (!confirm("Remover este coordenador?")) return;
    await api.removerCoordenador(id);
    reloadAll();
  };
  const removerAtividade = async (id: string) => {
    if (!confirm("Remover esta atividade?")) return;
    await api.removerAtividade(id);
    reloadAll();
  };
  const toggleAtiv = async (a: CarteiraAtividade) => {
    await api.toggleAtividadeFeita(a.id, !a.feito_em);
    reloadAll();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-3xl max-h-[92vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-hb-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[11px] font-bold shrink-0"
              style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.color}50` }}>
              {initials(parceiro.nome)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-display text-hb-text" style={{ letterSpacing: "0.12em" }}>
                  {parceiro.nome}
                </h2>
                <span className="text-[8px] uppercase border px-1.5 py-0.5"
                  style={{ color: tm.color, borderColor: tm.color + "50", background: tm.bg, letterSpacing: "0.14em" }}>
                  {tm.label}
                </span>
              </div>
              {parceiro.empresa && <div className="text-[11px] text-hb-textDim">{parceiro.empresa}</div>}
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-hb-textDim">
                {parceiro.telefone && <a href={`tel:${parceiro.telefone}`} className="inline-flex items-center gap-1 hover:text-hb-accent"><Phone size={9} /> {parceiro.telefone}</a>}
                {parceiro.email && <a href={`mailto:${parceiro.email}`} className="inline-flex items-center gap-1 hover:text-hb-accent"><Mail size={9} /> {parceiro.email}</a>}
                {parceiro.instagram && (
                  <a href={`https://instagram.com/${parceiro.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-hb-accent"><Instagram size={9} /> {parceiro.instagram}</a>
                )}
                {parceiro.aniversario && (
                  <span className="inline-flex items-center gap-1"><Cake size={9} /> {parceiro.aniversario.split("-").reverse().join("/")}</span>
                )}
                {(parceiro.cidade || parceiro.estado) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={9} /> {[parceiro.cidade, parceiro.estado].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {parceiro.observacoes && (
            <div className="text-[11px] text-hb-textDim border-l-2 border-hb-cream/40 pl-2 italic">
              {parceiro.observacoes}
            </div>
          )}

          {parceiro.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {parceiro.categorias.map((c) => (
                <span key={c} className="text-[9px] uppercase border border-hb-cream/30 bg-hb-cream/10 px-1.5 py-0.5 text-hb-cream" style={{ letterSpacing: "0.12em" }}>
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* COORDENADORES */}
          <section>
            <SectionHeader title="Coordenadores" icon={<Users size={10} />}
              action={<button onClick={() => setAddCoordOpen(true)}
                className="text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent px-2 py-0.5 inline-flex items-center gap-1"
                style={{ letterSpacing: "0.14em" }}>
                <Plus size={9} /> Adicionar
              </button>} />
            {loading ? <Loader2 size={12} className="animate-spin text-hb-textDim" /> : coords.length === 0 ? (
              <div className="text-[10px] text-hb-textDim italic">Sem coordenadores cadastrados.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {coords.map((c) => {
                  const aniv = aniversarioProximo(c.aniversario, 14);
                  return (
                    <div key={c.id} className="border border-hb-border bg-hb-bg/40 p-2 text-[10px] group relative">
                      <button onClick={() => removerCoord(c.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-red transition" title="Remover">
                        <Trash2 size={10} />
                      </button>
                      <div className="font-semibold text-hb-text text-[11px]">{c.nome}</div>
                      {c.papel && <div className="text-hb-textDim text-[9px] uppercase" style={{ letterSpacing: "0.12em" }}>{c.papel}</div>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-hb-textDim">
                        {c.telefone && <span className="inline-flex items-center gap-0.5"><Phone size={8} /> {c.telefone}</span>}
                        {c.whatsapp && <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-hb-green"><MessageCircle size={8} /> {c.whatsapp}</a>}
                        {c.email && <span className="inline-flex items-center gap-0.5 truncate"><Mail size={8} /> {c.email}</span>}
                        {c.instagram && <span className="inline-flex items-center gap-0.5"><Instagram size={8} /> {c.instagram.replace(/^@/, "")}</span>}
                        {c.aniversario && (
                          <span className={`inline-flex items-center gap-0.5 ${aniv.proximo ? "text-hb-amber font-bold" : ""}`}>
                            <Cake size={8} /> {c.aniversario.split("-").reverse().slice(0,2).join("/")}{aniv.proximo ? ` · ${aniv.emDias === 0 ? "hoje" : aniv.emDias === 1 ? "amanhã" : `${aniv.emDias}d`}` : ""}
                          </span>
                        )}
                      </div>
                      {c.observacoes && <div className="text-[9px] text-hb-textDim italic mt-1 line-clamp-2">{c.observacoes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ATIVIDADES / PONTOS DE CONTATO */}
          <section>
            <SectionHeader title={`Pontos de contato (${atividades.length})`} icon={<Calendar size={10} />}
              action={<button onClick={() => setAddAtivOpen(true)}
                className="text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent px-2 py-0.5 inline-flex items-center gap-1"
                style={{ letterSpacing: "0.14em" }}>
                <Plus size={9} /> Registrar
              </button>} />
            {atividades.length === 0 ? (
              <div className="text-[10px] text-hb-textDim italic">Nenhum ponto de contato ainda.</div>
            ) : (
              <ol className="space-y-1">
                {atividades.map((a) => {
                  const t = ATIVIDADE_TIPOS.find((x) => x.key === a.tipo);
                  const feita = !!a.feito_em;
                  return (
                    <li key={a.id} className={`flex items-start gap-2 px-2 py-1.5 border border-hb-border bg-hb-bg/40 group ${feita ? "opacity-70" : ""}`}>
                      <button onClick={() => toggleAtiv(a)}
                        className={`mt-0.5 w-4 h-4 border shrink-0 inline-flex items-center justify-center ${
                          feita ? "bg-hb-green/20 border-hb-green text-hb-green" : "border-hb-border hover:border-hb-accent"
                        }`}
                        title={feita ? "Marcar pendente" : "Marcar feita"}>
                        {feita && <CheckSquare size={9} />}
                      </button>
                      <div className="text-[14px] leading-none mt-px shrink-0">{t?.icon || "•"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-hb-text">
                          <span className={`uppercase tracking-wider font-bold text-[9px] mr-1 ${feita ? "line-through" : ""}`}>{t?.label || a.tipo}</span>
                          {a.descricao && <span className={feita ? "line-through" : ""}>· {a.descricao}</span>}
                        </div>
                        <div className="text-[9px] text-hb-textDim mt-0.5 tabular">
                          {a.data.split("-").reverse().join("/")}
                          {feita && a.feito_em && ` · feito ${fmtRelative(a.feito_em)}`}
                        </div>
                      </div>
                      <button onClick={() => removerAtividade(a.id)}
                        className="opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-red transition" title="Remover">
                        <Trash2 size={10} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* TAREFAS — sincronizadas com Agendamentos */}
          <TarefasSection parceiro={parceiro} tarefas={tarefas} loading={loading}
            appUser={appUser} onChanged={reloadAll} />

          {/* HISTÓRICO DE ORÇAMENTOS */}
          <HistoricoOrcamentosSection orcamentos={orcamentos} loading={loading} />
        </div>
      </div>

      {addCoordOpen && (
        <AddCoordenadorModal parceiroId={parceiro.id}
          onClose={() => setAddCoordOpen(false)}
          onSaved={() => { setAddCoordOpen(false); reloadAll(); }} />
      )}
      {addAtivOpen && (
        <AddAtividadeModal parceiroId={parceiro.id} vendedorId={appUser.id}
          onClose={() => setAddAtivOpen(false)}
          onSaved={() => { setAddAtivOpen(false); reloadAll(); }} />
      )}
      <CarteiraInputStyle />
    </div>
  );
}

/* ───────────────── Seção: Tarefas (sync com Agendamentos) ───────────────── */
const PRIORIDADES_TAREFA: { key: AgendaTarefa["prioridade"]; label: string; color: string; bg: string }[] = [
  { key: "baixa", label: "Baixa",  color: "text-hb-textDim", bg: "bg-hb-textDim/10" },
  { key: "media", label: "Média",  color: "text-hb-accent",  bg: "bg-hb-accent/10" },
  { key: "alta",  label: "Alta",   color: "text-hb-red",     bg: "bg-hb-red/10" },
];

function TarefasSection({ parceiro, tarefas, loading, appUser, onChanged }: {
  parceiro: CarteiraParceiro; tarefas: AgendaTarefa[]; loading: boolean;
  appUser: AppUser; onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [prioridade, setPrioridade] = useState<AgendaTarefa["prioridade"]>("media");
  const [saving, setSaving] = useState(false);

  const pendentes = tarefas.filter((t) => t.status === "pendente");
  const feitas    = tarefas.filter((t) => t.status === "feita");
  const hojeISO   = new Date().toISOString().slice(0, 10);
  const atrasadas = pendentes.filter((t) => t.data && t.data < hojeISO).length;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      await api.criarTarefa({
        user_id: appUser.id,
        user_nome: appUser.nome || appUser.username,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data: data || null,
        hora: hora || null,
        prioridade,
        parceiro_id: parceiro.id,
      });
      setTitulo(""); setDescricao(""); setData(""); setHora(""); setPrioridade("media");
      setShowForm(false);
      onChanged();
    } catch (err: any) {
      alert("Falha ao criar tarefa: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: AgendaTarefa) {
    try { await api.toggleTarefa(t.id, t.status !== "feita"); onChanged(); }
    catch (e: any) { alert("Falha: " + (e?.message || e)); }
  }
  async function remover(id: string) {
    if (!confirm("Apagar essa tarefa?")) return;
    try { await api.removerTarefa(id); onChanged(); }
    catch (e: any) { alert("Falha: " + (e?.message || e)); }
  }

  return (
    <section>
      <SectionHeader title={`Tarefas (${pendentes.length} pendentes${feitas.length ? ` · ${feitas.length} feitas` : ""})`} icon={<ListTodo size={10} />}
        action={<button onClick={() => setShowForm((v) => !v)}
          className="text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent px-2 py-0.5 inline-flex items-center gap-1"
          style={{ letterSpacing: "0.14em" }}>
          <Plus size={9} /> {showForm ? "Cancelar" : "Atribuir"}
        </button>} />

      {atrasadas > 0 && (
        <div className="text-[10px] text-hb-red bg-hb-red/10 border border-hb-red/30 px-2 py-1 inline-flex items-center gap-1.5 mb-2">
          <AlertTriangle size={10} /> {atrasadas} tarefa{atrasadas > 1 ? "s" : ""} atrasada{atrasadas > 1 ? "s" : ""}
        </div>
      )}

      {showForm && (
        <form onSubmit={salvar} className="border border-hb-border bg-hb-bg/40 p-3 space-y-2 mb-2">
          <Field label="Título *" icon={<CheckSqIcon size={9} />}>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus
              placeholder="Ex.: Visitar escritório, mandar amostra…"
              className="hb-cart-input" />
          </Field>
          <Field label="Descrição" icon={<MessageSquare size={9} />}>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2}
              placeholder="Detalhes da tarefa…"
              className="hb-cart-input resize-none" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Data" icon={<Calendar size={9} />}>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="hb-cart-input tabular" />
            </Field>
            <Field label="Hora" icon={<Clock size={9} />}>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                className="hb-cart-input tabular" />
            </Field>
            <Field label="Prioridade" icon={<AlertTriangle size={9} />}>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as any)}
                className="hb-cart-input">
                {PRIORIDADES_TAREFA.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-[10px] px-2 py-1 text-hb-textDim hover:text-hb-text">Cancelar</button>
            <button type="submit" disabled={saving || !titulo.trim()}
              className="text-[10px] px-3 py-1 bg-hb-accent text-hb-bg font-semibold uppercase tracking-[0.14em] disabled:opacity-40 inline-flex items-center gap-1.5">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              {saving ? "Salvando…" : "Criar tarefa"}
            </button>
          </div>
        </form>
      )}

      {loading && tarefas.length === 0 ? (
        <Loader2 size={12} className="animate-spin text-hb-textDim" />
      ) : tarefas.length === 0 ? (
        <div className="text-[10px] text-hb-textDim italic">
          Nenhuma tarefa atribuída a esse parceiro. Use "Atribuir" pra criar — vai aparecer também em Agendamentos.
        </div>
      ) : (
        <ol className="space-y-1">
          {[...pendentes, ...feitas].map((t) => <TarefaItem key={t.id} t={t} onToggle={() => toggle(t)} onRemove={() => remover(t.id)} />)}
        </ol>
      )}
    </section>
  );
}

function TarefaItem({ t, onToggle, onRemove }: { t: AgendaTarefa; onToggle: () => void; onRemove: () => void }) {
  const feita = t.status === "feita";
  const prio = PRIORIDADES_TAREFA.find((p) => p.key === t.prioridade);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const atrasada = !feita && t.data && t.data < hojeISO;
  return (
    <li className={`flex items-start gap-2 px-2 py-1.5 border border-hb-border bg-hb-bg/40 group ${feita ? "opacity-60" : ""}`}>
      <button onClick={onToggle}
        className={`mt-0.5 w-4 h-4 border shrink-0 inline-flex items-center justify-center ${
          feita ? "bg-hb-green/20 border-hb-green text-hb-green" : "border-hb-border hover:border-hb-accent"
        }`}
        title={feita ? "Reabrir tarefa" : "Marcar como feita"}>
        {feita && <CheckSqIcon size={9} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-semibold text-hb-text ${feita ? "line-through" : ""}`}>{t.titulo}</span>
          {prio && (
            <span className={`text-[8px] uppercase tracking-[0.12em] font-bold px-1 py-0.5 ${prio.color} ${prio.bg}`}>
              {prio.label}
            </span>
          )}
        </div>
        {t.descricao && <div className="text-[10px] text-hb-textDim mt-0.5 whitespace-pre-wrap">{t.descricao}</div>}
        <div className="text-[9px] text-hb-textDim mt-0.5 flex items-center gap-2 tabular">
          {t.data && (
            <span className={atrasada ? "text-hb-red font-bold" : ""}>
              <Calendar size={8} className="inline" /> {t.data.split("-").reverse().join("/")}
              {t.hora && ` · ${t.hora.slice(0, 5)}`}
              {atrasada && " (atrasada)"}
            </span>
          )}
          {feita && t.completed_at && <span className="text-hb-green">✓ {fmtRelative(t.completed_at)}</span>}
          {t.user_nome && <span>por {t.user_nome}</span>}
        </div>
      </div>
      <button onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-red transition shrink-0"
        title="Apagar">
        <Trash2 size={10} />
      </button>
    </li>
  );
}

/* ───────────────── Seção: Histórico de Orçamentos ───────────────── */
function HistoricoOrcamentosSection({ orcamentos, loading }: { orcamentos: HistoricoOrcamentoRow[]; loading: boolean }) {
  const counts = useMemo(() => {
    const c = { aprovado: 0, rejeitado: 0, andamento: 0, valor: 0, valorAprovado: 0 };
    orcamentos.forEach((o) => {
      c[o.situacao] += 1;
      c.valor += o.valor_total;
      if (o.situacao === "aprovado") c.valorAprovado += o.valor_total;
    });
    return c;
  }, [orcamentos]);

  // agrupa por cliente (escritório/projeto) — usuário pediu "para cada um dos escritórios"
  const porCliente = useMemo(() => {
    const map = new Map<string, HistoricoOrcamentoRow[]>();
    for (const o of orcamentos) {
      const k = (o.cliente || "—").trim();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [orcamentos]);

  return (
    <section>
      <SectionHeader title={`Histórico de orçamentos (${orcamentos.length})`} icon={<FileText size={10} />} />

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <KpiOrc label="Aprovados"   value={counts.aprovado}  color="text-hb-green"  icon={<CheckCircle2 size={9} />} />
        <KpiOrc label="Rejeitados"  value={counts.rejeitado} color="text-hb-red"    icon={<XCircle size={9} />} />
        <KpiOrc label="Em andamento" value={counts.andamento} color="text-hb-amber"  icon={<Clock size={9} />} />
      </div>
      {counts.valor > 0 && (
        <div className="text-[9px] text-hb-textDim mb-2 tabular">
          Total ofertado <span className="text-hb-text font-bold">{fmtBRLCompact(counts.valor)}</span>
          {counts.valorAprovado > 0 && (
            <> · aprovado <span className="text-hb-green font-bold">{fmtBRLCompact(counts.valorAprovado)}</span></>
          )}
        </div>
      )}

      {loading ? (
        <Loader2 size={12} className="animate-spin text-hb-textDim" />
      ) : orcamentos.length === 0 ? (
        <div className="text-[10px] text-hb-textDim italic">
          Nenhum orçamento gerado pra esse parceiro ainda (match por nome em <span className="font-mono">simulacao_projetos.arquiteto</span>).
        </div>
      ) : (
        <div className="space-y-2">
          {porCliente.map(([cliente, items]) => (
            <div key={cliente} className="border border-hb-border bg-hb-bg/40">
              <div className="px-2 py-1 border-b border-hb-border flex items-center justify-between">
                <div className="text-[10px] font-bold text-hb-text truncate" title={cliente}>{cliente}</div>
                <div className="text-[9px] text-hb-textDim tabular shrink-0 flex items-center gap-2">
                  <span>{items.length} {items.length === 1 ? "proposta" : "propostas"}</span>
                  <span>·</span>
                  <span>{fmtBRLCompact(items.reduce((s, x) => s + x.valor_total, 0))}</span>
                </div>
              </div>
              <ul className="divide-y divide-hb-border">
                {items.map((o) => <OrcLinha key={o.simulacao_id} o={o} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function KpiOrc({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className="border border-hb-border bg-hb-statBg px-2 py-1.5">
      <div className={`text-lg font-bold tabular flex items-center gap-1 ${color}`}>{icon}{value}</div>
      <div className="text-[8px] uppercase tracking-[0.14em] text-hb-textDim mt-0.5">{label}</div>
    </div>
  );
}

function OrcLinha({ o }: { o: HistoricoOrcamentoRow }) {
  const meta = SITUACAO_META[o.situacao];
  const Icon = meta.icon;
  return (
    <li className="px-2 py-1.5 flex items-start gap-2 text-[10px] hover:bg-hb-panelLight transition">
      <Icon size={11} className={`${meta.color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-hb-text">#{o.numero || o.simulacao_id.slice(0, 8)}</span>
          <span className={`uppercase tracking-[0.12em] font-bold text-[8px] px-1 py-0.5 ${meta.color} ${meta.bg}`}>
            {meta.label}
          </span>
          {o.vendedor && <span className="text-[9px] text-hb-textDim">vendedor: {o.vendedor}</span>}
        </div>
        {o.forma_pagamento && (
          <div className="text-[9px] text-hb-textDim mt-0.5">{o.forma_pagamento}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="tabular text-hb-text font-semibold">{fmtBRLCompact(o.valor_total)}</div>
        {o.criado_at && <div className="text-[9px] text-hb-textDim">{fmtRelative(o.criado_at)}</div>}
      </div>
      {o.card_comercial_id && (
        <Link to={`/card/${o.card_comercial_id}`}
          className="text-hb-textDim hover:text-hb-accent shrink-0 mt-0.5"
          title="Abrir card comercial">
          <ExternalLink size={10} />
        </Link>
      )}
    </li>
  );
}

const SITUACAO_META: Record<HistoricoOrcamentoRow["situacao"], { label: string; color: string; bg: string; icon: any }> = {
  aprovado:  { label: "Aprovado",     color: "text-hb-green",  bg: "bg-hb-green/10",  icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado",    color: "text-hb-red",    bg: "bg-hb-red/10",    icon: XCircle },
  andamento: { label: "Em andamento", color: "text-hb-amber",  bg: "bg-hb-amber/10",  icon: Clock },
};

/* ───────────────── Sub-modal: Coordenador ───────────────── */
function AddCoordenadorModal({ parceiroId, onClose, onSaved }: { parceiroId: string; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      await api.criarCoordenador({
        parceiro_id: parceiroId,
        nome: nome.trim(),
        papel: papel.trim() || null,
        telefone: telefone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        instagram: instagram.trim() || null,
        aniversario: aniversario || null,
        observacoes: observacoes.trim() || null,
      });
      onSaved();
    } catch (e: any) {
      alert("Erro: " + e?.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-md flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-hb-border flex items-center justify-between">
          <h3 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>Adicionar Coordenador</h3>
          <button onClick={onClose}><X size={14} className="text-hb-textDim hover:text-hb-text" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Nome *"><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className="hb-cart-input" placeholder="Ex.: Ana Silva" /></Field>
          <Field label="Papel"><input value={papel} onChange={(e) => setPapel(e.target.value)} className="hb-cart-input" placeholder="Coordenadora, Assistente, etc" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="hb-cart-input" inputMode="tel" /></Field>
            <Field label="WhatsApp"><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="hb-cart-input" inputMode="tel" placeholder="(11) 99999-9999" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} className="hb-cart-input" type="email" /></Field>
            <Field label="Aniversário"><input type="date" value={aniversario} onChange={(e) => setAniversario(e.target.value)} className="hb-cart-input tabular" /></Field>
          </div>
          <Field label="Instagram"><input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="hb-cart-input" /></Field>
          <Field label="Observações"><textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="hb-cart-input resize-none" /></Field>
        </div>
        <div className="px-5 py-3 border-t border-hb-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim" style={{ letterSpacing: "0.14em" }}>Cancelar</button>
          <button onClick={salvar} disabled={saving || !nome.trim()} className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40" style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
            {saving ? <Loader2 size={10} className="animate-spin inline" /> : "Adicionar"}
          </button>
        </div>
      </div>
      <CarteiraInputStyle />
    </div>
  );
}

/* ───────────────── Sub-modal: Atividade / Ponto de Contato ───────────────── */
function AddAtividadeModal({ parceiroId, vendedorId, onClose, onSaved }: { parceiroId: string; vendedorId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<string>("contato_telefone");
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [feita, setFeita] = useState(true);
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      await api.criarAtividade({
        parceiro_id: parceiroId, vendedor_id: vendedorId,
        tipo, data, descricao: descricao.trim() || null,
        feito_em: feita ? new Date().toISOString() : null,
      });
      onSaved();
    } catch (e: any) {
      alert("Erro: " + e?.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-md flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-hb-border flex items-center justify-between">
          <h3 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>Registrar ponto de contato</h3>
          <button onClick={onClose}><X size={14} className="text-hb-textDim hover:text-hb-text" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Tipo *">
            <div className="grid grid-cols-4 gap-1">
              {ATIVIDADE_TIPOS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTipo(t.key)}
                  className={`px-1 py-1.5 text-[9px] uppercase border transition flex flex-col items-center gap-0.5 ${
                    tipo === t.key ? "bg-hb-accent/15 border-hb-accent text-hb-accent" : "border-hb-border text-hb-textDim hover:text-hb-text"
                  }`}
                  style={{ letterSpacing: "0.10em" }}>
                  <span className="text-[14px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className="hb-cart-input tabular" /></Field>
            <Field label="Status">
              <div className="flex gap-1 mt-1">
                <button onClick={() => setFeita(true)}
                  className={`flex-1 px-2 py-1.5 text-[10px] uppercase border ${feita ? "bg-hb-green/15 border-hb-green/60 text-hb-green" : "border-hb-border text-hb-textDim"}`}
                  style={{ letterSpacing: "0.14em" }}>Feito</button>
                <button onClick={() => setFeita(false)}
                  className={`flex-1 px-2 py-1.5 text-[10px] uppercase border ${!feita ? "bg-hb-amber/15 border-hb-amber/60 text-hb-amber" : "border-hb-border text-hb-textDim"}`}
                  style={{ letterSpacing: "0.14em" }}>Agendar</button>
              </div>
            </Field>
          </div>
          <Field label="Descrição / Observações">
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto da conversa, materiais enviados, próximos passos…" className="hb-cart-input resize-none" />
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-hb-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim" style={{ letterSpacing: "0.14em" }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40" style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
            {saving ? <Loader2 size={10} className="animate-spin inline" /> : "Registrar"}
          </button>
        </div>
      </div>
      <CarteiraInputStyle />
    </div>
  );
}

/* ───────────────── Helpers visuais ───────────────── */
function SectionHeader({ title, icon, action }: { title: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="block w-[3px] h-[10px] bg-hb-cream/40" />
        <span className="text-[10px] uppercase text-hb-cream inline-flex items-center gap-1" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
          {icon} {title}
        </span>
      </div>
      {action}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
        {icon} {label}
      </div>
      {children}
    </label>
  );
}

function CarteiraInputStyle() {
  return (
    <style>{`
      .hb-cart-input {
        width: 100%;
        background: rgb(var(--hb-bg) / 1);
        border: 1px solid rgb(var(--hb-border) / 1);
        padding: 6px 9px;
        font-size: 11px;
        color: rgb(var(--hb-text) / 1);
        outline: none;
        transition: border-color .15s;
      }
      .hb-cart-input::placeholder { color: rgb(var(--hb-textDim) / 0.7); }
      .hb-cart-input:focus { border-color: rgb(var(--hb-accent) / 1); }
    `}</style>
  );
}
