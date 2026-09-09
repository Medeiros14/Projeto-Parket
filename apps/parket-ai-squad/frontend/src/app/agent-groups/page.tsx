'use client'

import { useEffect, useState } from 'react'
import { agentGroupsApi, agentsApi, AgentGroup, Agent } from '@/lib/api'
import {
  Users2, Plus, Trash2, RefreshCw, X,
  Crown, Eye, UserMinus, Send, Pencil, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface GroupMessage {
  id: string
  agent_id: string | null
  agent_name: string
  message_type: string
  content: string
  created_at: string
}

const ROLE_CONFIG = {
  lead:     { label: 'Líder',      color: 'var(--accent)',  icon: Crown  },
  member:   { label: 'Membro',     color: 'var(--blue)',   icon: Users2 },
  observer: { label: 'Observador', color: 'var(--text-muted)', icon: Eye },
}

const MSG_COLOR: Record<string, string> = {
  task:   'var(--accent)',
  output: 'var(--blue)',
  result: 'var(--green)',
  status: 'var(--purple)',
}

export default function AgentGroupsPage() {
  const [groups,   setGroups]   = useState<AgentGroup[]>([])
  const [agents,   setAgents]   = useState<Agent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<AgentGroup | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editCtx,    setEditCtx]    = useState(false)
  const [taskText,   setTaskText]   = useState('')
  const [sending,    setSending]    = useState(false)
  const [form, setForm] = useState({ name: '', description: '', shared_context: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [gs, as] = await Promise.all([agentGroupsApi.list(), agentsApi.list()])
      setGroups(gs)
      setAgents(as)
      if (selected) {
        const upd = gs.find(g => g.id === selected.id)
        if (upd) setSelected(upd)
      }
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }

  const loadMessages = async (id: string) => {
    try { setMessages(await agentGroupsApi.getMessages(id)) } catch {}
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected?.id])

  const createGroup = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const g = await agentGroupsApi.create(form)
      toast.success('Grupo criado')
      setShowCreate(false)
      setForm({ name: '', description: '', shared_context: '' })
      await load()
      setSelected(g)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erro')
    } finally { setSaving(false) }
  }

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`Remover grupo "${name}"?`)) return
    await agentGroupsApi.delete(id)
    toast.success('Grupo removido')
    if (selected?.id === id) setSelected(null)
    load()
  }

  const addAgent = async (groupId: string, agentId: string) => {
    try {
      await agentGroupsApi.addMember(groupId, agentId)
      toast.success('Agente adicionado')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Erro') }
  }

  const removeAgent = async (groupId: string, agentId: string) => {
    await agentGroupsApi.removeMember(groupId, agentId)
    toast.success('Agente removido')
    load()
  }

  const updateRole = async (groupId: string, agentId: string, role: string) => {
    await agentGroupsApi.updateRole(groupId, agentId, role)
    load()
  }

  const saveContext = async () => {
    if (!selected) return
    try {
      await agentGroupsApi.update(selected.id, { shared_context: selected.shared_context })
      toast.success('Contexto salvo')
      setEditCtx(false)
    } catch { toast.error('Erro ao salvar') }
  }

  const sendTask = async () => {
    if (!selected || !taskText.trim()) return
    setSending(true)
    try {
      await agentGroupsApi.postMessage(selected.id, taskText, 'task')
      setTaskText('')
      toast.success('Tarefa enviada')
      loadMessages(selected.id)
    } catch { toast.error('Erro') }
    finally { setSending(false) }
  }

  const memberIds = new Set(selected?.members?.map(m => m.agent_id) || [])
  const available = agents.filter(a => !memberIds.has(a.id))

  return (
    <div className="flex h-full" style={{ overflow: 'hidden' }}>

      {/* ── Sidebar list ───────────────────────────────── */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: 240, borderRight: '1px solid var(--border)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="section-title">Grupos</span>
          <button
            className="btn-icon"
            onClick={() => setShowCreate(true)}
            title="Novo grupo"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && (
            <div className="flex justify-center pt-8">
              <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
          {!loading && groups.length === 0 && (
            <div className="text-center pt-8 px-4">
              <Users2 size={24} className="mx-auto mb-2" style={{ color: 'var(--border-light)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum grupo criado</p>
              <button
                className="text-xs mt-2"
                style={{ color: 'var(--accent)' }}
                onClick={() => setShowCreate(true)}
              >
                + Criar grupo
              </button>
            </div>
          )}
          {groups.map(g => {
            const active = selected?.id === g.id
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(212,175,55,0.2)' : 'transparent'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {g.name}
                  </span>
                  <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {g.member_count}
                  </span>
                </div>
                {g.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {g.description}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center">
            <Users2 size={40} style={{ color: 'var(--border-light)', marginBottom: 12 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Selecione um grupo ou crie um novo
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-2xl">

            {/* Group title row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {selected.name}
                </h2>
                {selected.description && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {selected.description}
                  </p>
                )}
              </div>
              <button
                className="btn-icon"
                onClick={() => deleteGroup(selected.id, selected.name)}
                title="Remover grupo"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Shared context */}
            <div className="card">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: editCtx ? '1px solid var(--border)' : 'none' }}
              >
                <span className="section-title">Contexto Compartilhado</span>
                <button
                  className="btn-icon"
                  onClick={() => setEditCtx(!editCtx)}
                  title="Editar contexto"
                >
                  <Pencil size={12} style={{ color: editCtx ? 'var(--accent)' : undefined }} />
                </button>
              </div>
              {editCtx ? (
                <div className="p-4 space-y-3">
                  <textarea
                    className="input text-sm"
                    style={{ minHeight: 80, resize: 'vertical' }}
                    placeholder="Instruções compartilhadas por todos os agentes do grupo..."
                    value={selected.shared_context || ''}
                    onChange={e => setSelected(s => s ? { ...s, shared_context: e.target.value } : null)}
                  />
                  <div className="flex gap-2">
                    <button onClick={saveContext} className="btn-primary text-xs py-1.5">
                      <CheckCircle size={12} /> Salvar
                    </button>
                    <button onClick={() => setEditCtx(false)} className="btn-secondary text-xs py-1.5">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="px-4 py-3 text-sm italic" style={{ color: 'var(--text-muted)' }}>
                  {selected.shared_context || 'Nenhum contexto definido.'}
                </p>
              )}
            </div>

            {/* Members */}
            <div className="card">
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="section-title">
                  Agentes do Grupo ({selected.members?.length || 0})
                </span>
              </div>

              {(selected.members || []).length === 0 ? (
                <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nenhum agente adicionado.
                </p>
              ) : (
                (selected.members || []).map((m, i) => {
                  const rc = ROLE_CONFIG[m.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.member
                  return (
                    <div
                      key={m.agent_id}
                      className="table-row"
                      style={{ borderBottom: i < (selected.members?.length || 0) - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div className="icon-box icon-box-blue mr-3">
                        <Users2 size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {m.agent_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="badge"
                          style={{ background: `${rc.color}18`, color: rc.color, fontSize: 10 }}
                        >
                          {rc.label}
                        </span>
                        <select
                          value={m.role}
                          onChange={e => updateRole(selected.id, m.agent_id, e.target.value)}
                          className="text-xs rounded-md px-2 py-1"
                          style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <option value="lead">Líder</option>
                          <option value="member">Membro</option>
                          <option value="observer">Observador</option>
                        </select>
                        <button
                          className="btn-icon"
                          onClick={() => removeAgent(selected.id, m.agent_id)}
                          title="Remover"
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = '')}
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Add agent */}
              {available.length > 0 && (
                <div
                  className="px-4 py-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <select
                    className="input text-sm"
                    defaultValue=""
                    onChange={e => { if (e.target.value) { addAgent(selected.id, e.target.value); (e.target as HTMLSelectElement).value = '' } }}
                  >
                    <option value="">+ Adicionar agente ao grupo...</option>
                    {available.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Inter-agent communication */}
            <div className="card">
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="section-title">Comunicação Inter-Agentes</span>
              </div>

              {/* Message log */}
              <div className="p-3 space-y-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    Nenhuma mensagem
                  </p>
                ) : messages.map(msg => (
                  <div
                    key={msg.id}
                    className="rounded-lg p-3"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="badge"
                        style={{
                          background: `${MSG_COLOR[msg.message_type] || 'var(--text-muted)'}18`,
                          color: MSG_COLOR[msg.message_type] || 'var(--text-muted)',
                          fontSize: 10,
                        }}
                      >
                        {msg.message_type}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {msg.agent_name}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Send */}
              <div
                className="p-3 flex gap-2"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <textarea
                  className="input text-sm flex-1"
                  style={{ minHeight: 52, resize: 'none' }}
                  placeholder="Enviar tarefa ou instrução ao grupo... (Ctrl+Enter)"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendTask() }}
                />
                <button
                  onClick={sendTask}
                  disabled={sending || !taskText.trim()}
                  className="btn-primary self-end"
                >
                  {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Group Modal ─────────────────────────── */}
      {showCreate && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Novo Grupo de Agentes
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Defina um time colaborativo de agentes
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowCreate(false)}><X size={15} /></button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  className="input"
                  placeholder="Squad de Vendas, Time de Suporte..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input
                  className="input"
                  placeholder="Objetivo do grupo..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Contexto Compartilhado</label>
                <textarea
                  className="input text-sm"
                  style={{ minHeight: 72, resize: 'vertical' }}
                  placeholder="Instruções ou regras comuns a todos os agentes do grupo..."
                  value={form.shared_context}
                  onChange={e => setForm(f => ({ ...f, shared_context: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={createGroup}
                disabled={saving || !form.name.trim()}
              >
                {saving ? <><RefreshCw size={13} className="animate-spin" /> Criando...</> : <><Plus size={13} /> Criar Grupo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
