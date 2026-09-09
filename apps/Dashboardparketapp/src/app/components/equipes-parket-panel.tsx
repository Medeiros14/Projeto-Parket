import { useState } from "react";
import { useEquipesParket, type EquipeMembro } from "../hooks/useEquipesParket";
import { Phone, Plus, Trash2, UserCheck, UserX, Search, ChevronDown, ChevronRight, Edit2, X, Check } from "lucide-react";

type Props = { accentColor?: string; filtroCategoria?: string; titulo?: string };

export default function EquipesParketPanel({ accentColor = "#ef4444", filtroCategoria, titulo }: Props) {
  const { porCategoria, totalAtivos, loading, categorias, addMembro, updateMembro, removeMembro, toggleAtivo, CATEGORIAS_ORDEM } = useEquipesParket(filtroCategoria);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtrado = porCategoria.map(cat => ({
    ...cat, membros: cat.membros.filter(m => !busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || (m.telefone || "").includes(busca)),
  })).filter(cat => cat.membros.length > 0);

  function toggle(cat: string) { setExpandido(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next; }); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: accentColor }}>{titulo || "Gestão de Equipes"}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{totalAtivos} equipes ativas · {porCategoria.length} categorias</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setExpandido(new Set(filtrado.map(c => c.categoria)))} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Expandir tudo</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold text-black" style={{ background: accentColor }}><Plus size={12} /> Adicionar</button>
        </div>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
        <input placeholder="Buscar por nome ou telefone…" value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600" />
      </div>
      {loading ? <div className="text-center text-zinc-500 py-8 text-sm">Carregando equipes…</div> : (
        <div className="space-y-2">
          {filtrado.map(cat => {
            const isOpen = expandido.has(cat.categoria);
            const ativos = cat.membros.filter(m => m.ativo).length;
            return (
              <div key={cat.categoria} className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
                <button onClick={() => toggle(cat.categoria)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors">
                  {isOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                  <span className="text-sm font-semibold text-white">{cat.categoria}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${accentColor}20`, color: accentColor }}>{ativos} equipes</span>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-800">
                    {cat.membros.map(m => (
                      <MembroRow key={m.id} membro={m} accentColor={accentColor} isEditing={editingId === m.id}
                        onEdit={() => setEditingId(m.id)} onCancelEdit={() => setEditingId(null)}
                        onUpdate={async (changes) => { await updateMembro(m.id, changes); setEditingId(null); }}
                        onToggle={() => toggleAtivo(m.id, !m.ativo)}
                        onRemove={() => { if (confirm(`Remover ${m.nome}?`)) removeMembro(m.id); }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <AddMembroModal accentColor={accentColor} categorias={[...CATEGORIAS_ORDEM, ...categorias.filter(c => !CATEGORIAS_ORDEM.includes(c))]}
        onAdd={async (nome, telefone, categoria) => { await addMembro(nome, telefone || null, categoria); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}
    </div>
  );
}

function MembroRow({ membro: m, accentColor, isEditing, onEdit, onCancelEdit, onUpdate, onToggle, onRemove }: {
  membro: EquipeMembro; accentColor: string; isEditing: boolean; onEdit: () => void; onCancelEdit: () => void;
  onUpdate: (changes: Partial<Pick<EquipeMembro, "nome" | "telefone" | "categoria">>) => Promise<void>; onToggle: () => void; onRemove: () => void;
}) {
  const [nome, setNome] = useState(m.nome);
  const [tel, setTel] = useState(m.telefone || "");
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/30">
        <input value={nome} onChange={e => setNome(e.target.value)} className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-sm text-white outline-none" />
        <input value={tel} onChange={e => setTel(e.target.value)} className="w-36 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-sm text-white outline-none" />
        <button onClick={() => onUpdate({ nome, telefone: tel || null })} className="p-1 rounded hover:bg-zinc-700 text-green-400"><Check size={14} /></button>
        <button onClick={onCancelEdit} className="p-1 rounded hover:bg-zinc-700 text-zinc-400"><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors ${!m.ativo ? "opacity-40" : ""}`}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: m.ativo ? accentColor : "#555" }}>{m.nome.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">Eq. {m.nome} <span className="text-zinc-500 font-normal" style={{ fontSize: "0.6rem" }}>— {m.categoria}</span></div>
        {m.telefone && <a href={`https://wa.me/55${m.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-green-400 transition-colors" onClick={e => e.stopPropagation()}><Phone size={10} /> {m.telefone}</a>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white"><Edit2 size={12} /></button>
        <button onClick={onToggle} className="p-1 rounded hover:bg-zinc-700">{m.ativo ? <UserCheck size={12} className="text-green-400" /> : <UserX size={12} className="text-zinc-500" />}</button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function AddMembroModal({ accentColor, categorias, onAdd, onCancel }: {
  accentColor: string; categorias: string[]; onAdd: (nome: string, telefone: string | null, categoria: string) => Promise<void>; onCancel: () => void;
}) {
  const [nome, setNome] = useState(""); const [telefone, setTelefone] = useState(""); const [categoria, setCategoria] = useState(categorias[0] || "");
  const [novaCategoria, setNovaCategoria] = useState(""); const [saving, setSaving] = useState(false);
  async function handleSave() {
    const cat = novaCategoria.trim() || categoria; if (!nome.trim() || !cat) return;
    setSaving(true); try { await onAdd(nome.trim(), telefone.trim() || null, cat); } finally { setSaving(false); }
  }
  return (
    <div onClick={onCancel} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div onClick={e => e.stopPropagation()} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-[420px] shadow-2xl">
        <h3 className="text-base font-bold mb-4" style={{ color: accentColor }}>Adicionar Equipe</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-zinc-400 mb-1 block">Nome da Equipe / Responsável *</label>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none" placeholder="Ex: BEDEU, GERALDO…" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Telefone do Responsável (WhatsApp)</label>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none" placeholder="11 99999-9999" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Categoria de Serviço *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none">
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Ou criar nova categoria</label>
            <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none" placeholder="(opcional)" /></div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-300 border border-zinc-700 hover:bg-zinc-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nome.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50" style={{ background: accentColor }}>{saving ? "Salvando…" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}
