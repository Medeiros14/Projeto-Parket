'use client'

import { useEffect, useState } from 'react'
import { agentsApi, groupsApi, Agent, WhatsAppGroup } from '@/lib/api'
import { Bot, Plus, Trash2, Edit, MessageSquare, CheckCircle, XCircle, Cpu, Zap } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', instructions: '',
    group_id: '', group_name: '', language: 'pt-BR',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [a, g] = await Promise.all([agentsApi.list(), groupsApi.list()])
      setAgents(a)
      setGroups(g)
    } catch (e) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const group = groups.find(g => g.id === form.group_id)
      await agentsApi.create({ ...form, group_name: group?.name || form.group_name })
      toast.success('Agente criado!')
      setShowForm(false)
      setForm({ name: '', description: '', instructions: '', group_id: '', group_name: '', language: 'pt-BR' })
      load()
    } catch (e) {
      toast.error('Erro ao criar agente')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir agente "${name}"?`)) return
    try {
      await agentsApi.delete(id)
      toast.success('Agente excluído')
      load()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const handleToggle = async (agent: Agent) => {
    await agentsApi.update(agent.id, { is_active: !agent.is_active })
    load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agentes</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie o squad de agentes de IA</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo Agente
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white">Novo Agente</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nome *</label>
                <input
                  className="input" required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Agente de Vendas"
                />
              </div>
              <div>
                <label className="label">Grupo do WhatsApp</label>
                <select
                  className="input"
                  value={form.group_id}
                  onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}
                >
                  <option value="">Selecionar grupo...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Descrição</label>
              <input
                className="input"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Breve descrição do agente"
              />
            </div>
            <div>
              <label className="label">Instruções (System Prompt)</label>
              <textarea
                className="input min-h-[120px] resize-y"
                value={form.instructions}
                onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                placeholder="Você é um assistente especializado em... Responda sempre em português..."
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Criar Agente</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Agents Grid */}
      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bot size={48} className="mx-auto mb-4 opacity-30" />
          <p>Nenhum agente criado ainda.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">Criar primeiro agente</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div key={agent.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agent.is_active ? 'bg-indigo-900/50' : 'bg-gray-800'}`}>
                    <Bot size={18} className={agent.is_active ? 'text-indigo-400' : 'text-gray-600'} />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.language}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(agent)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    agent.is_active
                      ? 'border-green-700 text-green-400 hover:bg-green-900/20'
                      : 'border-gray-700 text-gray-500 hover:bg-gray-800'
                  }`}
                >
                  {agent.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              {agent.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{agent.description}</p>
              )}

              {agent.group_id && (
                <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 rounded-lg px-2 py-1">
                  <MessageSquare size={12} />
                  <span className="truncate">{agent.group_name || agent.group_id}</span>
                </div>
              )}

              <div className="flex gap-2">
                <span className="badge-purple text-xs">
                  <Cpu size={10} className="mr-1" />
                  {agent.mcps.length} MCP{agent.mcps.length !== 1 ? 's' : ''}
                </span>
                <span className="badge-blue text-xs">
                  <Zap size={10} className="mr-1" />
                  {agent.skills.length} Skill{agent.skills.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-800">
                <Link href={`/agents/${agent.id}`} className="btn-secondary flex-1 text-center text-xs py-1.5">
                  Editar
                </Link>
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
