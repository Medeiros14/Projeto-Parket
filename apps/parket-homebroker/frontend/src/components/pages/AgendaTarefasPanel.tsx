/**
 * AgendaTarefasPanel — painel lateral de tarefas pessoais estilo Google Tasks.
 * Cada vendedor/SDR adiciona suas próprias tarefas. RLS garante isolamento.
 * Visual SO Parket: cantos retos, Cinzel uppercase tracking, paleta hb-*.
 */
import { useMemo, useState } from "react";
import { Plus, Check, Trash2, Loader2, Calendar, Clock, Flag, X, ChevronDown, ChevronUp, ListTodo, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type AgendaTarefa } from "../../lib/api";
import type { AppUser } from "../../lib/auth";

type GroupKey = "atrasadas" | "hoje" | "amanha" | "semana" | "futuro" | "sem-data";
const GROUP_ORDER: GroupKey[] = ["atrasadas", "hoje", "amanha", "semana", "futuro", "sem-data"];
const GROUP_LABEL: Record<GroupKey, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Esta semana",
  futuro: "Futuro",
  "sem-data": "Sem data",
};
const GROUP_COLOR: Record<GroupKey, string> = {
  atrasadas: "text-hb-red border-hb-red/40",
  hoje: "text-hb-accent border-hb-accent/40",
  amanha: "text-hb-gold border-hb-gold/40",
  semana: "text-hb-text border-hb-border",
  futuro: "text-hb-textDim border-hb-border",
  "sem-data": "text-hb-textDim border-hb-border",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((da - db) / 86400000);
}
function groupOf(data: string | null, hojeYmd: string): GroupKey {
  if (!data) return "sem-data";
  const d = diffDays(data, hojeYmd);
  if (d < 0) return "atrasadas";
  if (d === 0) return "hoje";
  if (d === 1) return "amanha";
  if (d <= 7) return "semana";
  return "futuro";
}

export function AgendaTarefasPanel({
  appUser, tarefas, loading, error, reload, onEditTarefa, onClose,
}: {
  appUser: AppUser;
  tarefas: AgendaTarefa[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  onEditTarefa: (t: AgendaTarefa) => void;
  onClose?: () => void;
}) {
  const [showFeitas, setShowFeitas] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<GroupKey>>(new Set());

  const hojeYmd = ymd(new Date());

  const grupos = useMemo(() => {
    const map: Record<GroupKey, AgendaTarefa[]> = {
      atrasadas: [], hoje: [], amanha: [], semana: [], futuro: [], "sem-data": [],
    };
    tarefas
      .filter((t) => showFeitas || t.status !== "feita")
      .forEach((t) => {
        // Tarefas feitas vão pro grupo da data delas (ou "sem-data") mas com style apagado
        map[groupOf(t.data, hojeYmd)].push(t);
      });
    return map;
  }, [tarefas, hojeYmd, showFeitas]);

  const toggleGroup = (g: GroupKey) => {
    setCollapsedGroups((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g); else n.add(g);
      return n;
    });
  };

  const totalPendentes = tarefas.filter((t) => t.status === "pendente").length;
  const totalAtrasadas = grupos.atrasadas.filter((t) => t.status !== "feita").length;

  return (
    <div className="flex flex-col h-full bg-hb-panel border-l border-hb-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hb-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="block w-[3px] h-[14px] bg-hb-accent shrink-0" />
          <h2 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
            Minhas Tarefas
          </h2>
          {totalPendentes > 0 && (
            <span className="ml-1 text-[9px] text-hb-textDim tabular">({totalPendentes})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFeitas((v) => !v)}
            title={showFeitas ? "Ocultar tarefas concluídas" : "Mostrar tarefas concluídas"}
            className={`px-1.5 py-0.5 text-[9px] uppercase border transition ${
              showFeitas ? "border-hb-accent/40 text-hb-accent bg-hb-accent/10" : "border-hb-border text-hb-textDim hover:text-hb-text"
            }`}
            style={{ letterSpacing: "0.12em" }}
          >
            <Check size={9} className="inline -mt-0.5" /> Feitas
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text" title="Fechar painel">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Quick add input */}
      <div className="px-3 py-2 border-b border-hb-border">
        <button
          onClick={() => setNovoOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] uppercase border border-dashed border-hb-border text-hb-textDim hover:text-hb-accent hover:border-hb-accent/60 transition"
          style={{ letterSpacing: "0.14em" }}
        >
          <Plus size={11} /> Adicionar tarefa
        </button>
      </div>

      {/* Alerta de atrasadas */}
      {totalAtrasadas > 0 && (
        <div className="px-3 py-1.5 bg-hb-red/10 border-b border-hb-red/30 text-[10px] text-hb-red flex items-center gap-1.5">
          <Flag size={10} /> {totalAtrasadas} tarefa{totalAtrasadas > 1 ? "s" : ""} atrasada{totalAtrasadas > 1 ? "s" : ""}
        </div>
      )}

      {/* Lista de grupos */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-hb-textDim text-xs">
            <Loader2 size={14} className="animate-spin inline mr-1" /> Carregando…
          </div>
        )}
        {error && (
          <div className="p-3 text-[10px] text-hb-red">{error}</div>
        )}
        {!loading && tarefas.length === 0 && (
          <div className="p-6 text-center text-hb-textDim text-[11px]">
            <ListTodo size={28} className="mx-auto mb-2 opacity-30" />
            Nenhuma tarefa ainda.<br />
            <span className="text-[9px] opacity-70">Clique em "Adicionar tarefa" pra começar.</span>
          </div>
        )}
        {!loading && tarefas.length > 0 && GROUP_ORDER.map((g) => {
          const items = grupos[g];
          if (items.length === 0) return null;
          const collapsed = collapsedGroups.has(g);
          return (
            <div key={g} className="border-b border-hb-border">
              <button
                onClick={() => toggleGroup(g)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[9px] uppercase border-l-2 ${GROUP_COLOR[g]} hover:bg-hb-panelLight/40 transition`}
                style={{ letterSpacing: "0.18em", fontWeight: 600 }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {GROUP_LABEL[g]}
                  <span className="opacity-60 tabular normal-case" style={{ letterSpacing: "0.02em" }}>({items.length})</span>
                </span>
                {collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
              </button>
              {!collapsed && (
                <div className="py-1">
                  {items.map((t) => (
                    <TarefaRow
                      key={t.id}
                      tarefa={t}
                      onToggle={async () => {
                        await api.toggleTarefa(t.id, t.status !== "feita");
                        reload();
                      }}
                      onClick={() => onEditTarefa(t)}
                      onRemove={async () => {
                        if (!confirm("Remover esta tarefa?")) return;
                        await api.removerTarefa(t.id);
                        reload();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal nova tarefa (criação) — edição é gerenciada pelo parent */}
      {novoOpen && (
        <TarefaModal
          appUser={appUser}
          tarefa={null}
          onClose={() => setNovoOpen(false)}
          onSaved={() => { setNovoOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

export { TarefaModal };

function TarefaRow({ tarefa, onToggle, onClick, onRemove }: {
  tarefa: AgendaTarefa;
  onToggle: () => void;
  onClick: () => void;
  onRemove: () => void;
}) {
  const feita = tarefa.status === "feita";
  const prioColor = tarefa.prioridade === "alta" ? "text-hb-red" :
                    tarefa.prioridade === "baixa" ? "text-hb-textDim" : "text-hb-amber";
  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 hover:bg-hb-panelLight/40 group transition ${feita ? "opacity-50" : ""}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={feita ? "Marcar como pendente" : "Marcar como concluída"}
        className={`mt-0.5 w-4 h-4 border shrink-0 inline-flex items-center justify-center transition ${
          feita ? "bg-hb-green/20 border-hb-green text-hb-green" : "border-hb-border hover:border-hb-accent"
        }`}
      >
        {feita && <Check size={9} />}
      </button>
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <div className={`text-[11px] text-hb-text leading-tight ${feita ? "line-through" : ""}`}>
          {tarefa.titulo}
        </div>
        {(tarefa.hora || tarefa.descricao || tarefa.prioridade !== "media" || tarefa.parceiro) && (
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-hb-textDim">
            {tarefa.hora && (
              <span className="inline-flex items-center gap-0.5 tabular">
                <Clock size={9} /> {tarefa.hora.slice(0, 5)}
              </span>
            )}
            {tarefa.prioridade !== "media" && (
              <span className={`inline-flex items-center gap-0.5 ${prioColor} uppercase`} style={{ letterSpacing: "0.12em" }}>
                <Flag size={9} /> {tarefa.prioridade}
              </span>
            )}
            {tarefa.descricao && (
              <span className="truncate opacity-70">{tarefa.descricao}</span>
            )}
          </div>
        )}
        {tarefa.parceiro && (
          <Link to="../carteira"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1 text-[9px] uppercase text-hb-cream hover:text-hb-accent border border-hb-cream/30 bg-hb-cream/5 px-1 py-0.5"
            style={{ letterSpacing: "0.12em" }}
            title="Abrir Carteira">
            <Users size={8} /> {tarefa.parceiro.nome}
          </Link>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-hb-textDim hover:text-hb-red transition"
        title="Remover tarefa"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function TarefaModal({ appUser, tarefa, cardId, cardTitle, parceiroId, parceiroNome, onClose, onSaved }: {
  appUser: AppUser;
  tarefa: AgendaTarefa | null;
  /** Pré-popula vínculo com card comercial (criação) — usado quando aberto do CardDetail. */
  cardId?: string;
  /** Nome do cliente do card — exibido no banner de vínculo. */
  cardTitle?: string;
  /** Pré-popula vínculo com parceiro da carteira (criação). */
  parceiroId?: string;
  /** Nome do parceiro — exibido no banner. */
  parceiroNome?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editMode = !!tarefa;
  const [titulo, setTitulo] = useState(tarefa?.titulo || "");
  const [descricao, setDescricao] = useState(tarefa?.descricao || "");
  const [data, setData] = useState(tarefa?.data || "");
  const [hora, setHora] = useState(tarefa?.hora ? tarefa.hora.slice(0, 5) : "");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">(tarefa?.prioridade || "media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const podeSalvar = titulo.trim().length > 0 && !saving;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      if (editMode && tarefa) {
        await api.atualizarTarefa(tarefa.id, {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          data: data || null,
          hora: hora ? `${hora}:00` : null,
          prioridade,
        });
      } else {
        await api.criarTarefa({
          user_id: appUser.id,
          user_nome: appUser.nome || appUser.email,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          data: data || null,
          hora: hora ? `${hora}:00` : null,
          prioridade,
          card_id: cardId || null,
          parceiro_id: parceiroId || null,
        });
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
      <div className="bg-hb-panel border border-hb-border w-full max-w-md flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-hb-border">
          <div className="flex items-center gap-2">
            <span className="block w-[3px] h-[14px] bg-hb-accent" />
            <h3 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              {editMode ? "Editar Tarefa" : "Nova Tarefa"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Banner de vínculo — quando aberto de um card/parceiro específico */}
          {!editMode && (cardTitle || parceiroNome) && (
            <div className="text-[10px] bg-hb-accent/10 border border-hb-accent/40 px-2.5 py-1.5 flex items-center gap-1.5 text-hb-accent">
              <span className="uppercase tracking-[0.14em] font-bold">Vinculado a</span>
              <span className="text-hb-text font-semibold truncate">{cardTitle || parceiroNome}</span>
            </div>
          )}

          <label className="block">
            <div className="text-[9px] uppercase text-hb-textDim mb-1" style={{ letterSpacing: "0.14em" }}>Título *</div>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvar(); } }}
              placeholder="Ex.: Ligar pro Marcos do projeto X"
              autoFocus
              className="hb-tarefa-input"
            />
          </label>

          <label className="block">
            <div className="text-[9px] uppercase text-hb-textDim mb-1" style={{ letterSpacing: "0.14em" }}>Descrição</div>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Notas, contexto, próximos passos…"
              rows={2}
              className="hb-tarefa-input resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
                <Calendar size={9} /> Data
              </div>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="hb-tarefa-input tabular"
              />
            </label>
            <label className="block">
              <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
                <Clock size={9} /> Hora
              </div>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="hb-tarefa-input tabular"
              />
            </label>
          </div>

          <div>
            <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
              <Flag size={9} /> Prioridade
            </div>
            <div className="flex gap-1">
              {(["baixa", "media", "alta"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrioridade(p)}
                  className={`flex-1 px-2 py-1.5 text-[10px] uppercase border transition ${
                    prioridade === p
                      ? p === "alta" ? "bg-hb-red/15 border-hb-red/60 text-hb-red"
                      : p === "baixa" ? "bg-hb-textDim/15 border-hb-textDim/60 text-hb-textDim"
                      : "bg-hb-amber/15 border-hb-amber/60 text-hb-amber"
                      : "border-hb-border text-hb-textDim hover:text-hb-text"
                  }`}
                  style={{ letterSpacing: "0.14em" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[10px] text-hb-red">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text transition"
            style={{ letterSpacing: "0.14em" }}
          >Cancelar</button>
          <button
            onClick={salvar}
            disabled={!podeSalvar}
            className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
            style={{ letterSpacing: "0.14em", fontWeight: 600 }}
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            {saving ? "Salvando" : editMode ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>

      <style>{`
        .hb-tarefa-input {
          width: 100%;
          background: rgb(var(--hb-bg) / 1);
          border: 1px solid rgb(var(--hb-border) / 1);
          padding: 6px 9px;
          font-size: 11px;
          color: rgb(var(--hb-text) / 1);
          outline: none;
          transition: border-color .15s;
        }
        .hb-tarefa-input::placeholder { color: rgb(var(--hb-textDim) / 0.7); }
        .hb-tarefa-input:focus { border-color: rgb(var(--hb-accent) / 1); }
      `}</style>
    </div>
  );
}
