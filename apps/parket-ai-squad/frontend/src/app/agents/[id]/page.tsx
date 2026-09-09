'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { agentsApi, trainingApi, groupsApi, Agent, AgentMCP, AgentSkill, KnowledgeSource, WhatsAppGroup } from '@/lib/api'
import { Bot, ChevronLeft, Cpu, Zap, BookOpen, Plus, Trash2, Save, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

type Tab = 'general' | 'mcps' | 'skills' | 'training'

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [tab, setTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // General form
  const [form, setForm] = useState({
    name: '', description: '', instructions: '',
    group_id: '', group_name: '', language: 'pt-BR',
    reply_only_mentions: false,
  })

  // MCP form
  const [mcpForm, setMcpForm] = useState({
    name: '', description: '', server_url: '', command: '',
    mcp_type: 'http', env: '{}', headers: '{}'
  })

  // Skill form
  const [skillForm, setSkillForm] = useState({ name: '', description: '', skill_type: 'custom', config: '{}' })

  // Training text form
  const [trainingText, setTrainingText] = useState('')
  const [trainingSource, setTrainingSource] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [a, g, s] = await Promise.all([
        agentsApi.get(id),
        groupsApi.list(),
        trainingApi.listSources(id),
      ])
      setAgent(a)
      setGroups(g)
      setSources(s)
      setForm({
        name: a.name, description: a.description, instructions: a.instructions,
        group_id: a.group_id || '', group_name: a.group_name || '',
        language: a.language, reply_only_mentions: a.reply_only_mentions,
      })
    } catch {
      toast.error('Agente não encontrado')
      router.push('/agents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const saveGeneral = async () => {
    setSaving(true)
    try {
      const group = groups.find(g => g.id === form.group_id)
      await agentsApi.update(id, { ...form, group_name: group?.name || form.group_name })
      toast.success('Agente salvo!')
      load()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  const addMCP = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await agentsApi.addMCP(id, {
        name: mcpForm.name,
        description: mcpForm.description,
        server_url: mcpForm.server_url,
        command: mcpForm.command,
        mcp_type: mcpForm.mcp_type as 'http' | 'stdio',
        env: JSON.parse(mcpForm.env || '{}'),
        headers: JSON.parse(mcpForm.headers || '{}'),
      })
      toast.success('MCP adicionado!')
      setMcpForm({ name: '', description: '', server_url: '', command: '', mcp_type: 'http', env: '{}', headers: '{}' })
      load()
    } catch { toast.error('Erro ao adicionar MCP') }
  }

  const deleteMCP = async (mcpId: string) => {
    await agentsApi.deleteMCP(id, mcpId)
    toast.success('MCP removido')
    load()
  }

  const addSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await agentsApi.addSkill(id, {
        ...skillForm,
        config: JSON.parse(skillForm.config || '{}'),
      })
      toast.success('Skill adicionada!')
      setSkillForm({ name: '', description: '', skill_type: 'custom', config: '{}' })
      load()
    } catch { toast.error('Erro ao adicionar skill') }
  }

  const deleteSkill = async (skillId: string) => {
    await agentsApi.deleteSkill(id, skillId)
    toast.success('Skill removida')
    load()
  }

  const addTrainingText = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await trainingApi.addText(id, trainingText, trainingSource || 'manual')
      toast.success(`${r.chunks} chunks adicionados!`)
      setTrainingText('')
      setTrainingSource('')
      load()
    } catch { toast.error('Erro ao adicionar conhecimento') }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const r = await trainingApi.uploadFile(id, file)
      toast.success(`${r.chunks} chunks extraídos de "${file.name}"!`)
      load()
    } catch { toast.error('Erro ao processar arquivo') }
    finally { setUploadingFile(false); e.target.value = '' }
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>
  if (!agent) return null

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Geral', icon: <Bot size={14} /> },
    { id: 'mcps', label: `MCPs (${agent.mcps.length})`, icon: <Cpu size={14} /> },
    { id: 'skills', label: `Skills (${agent.skills.length})`, icon: <Zap size={14} /> },
    { id: 'training', label: `Treinamento (${sources.length})`, icon: <BookOpen size={14} /> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/agents" className="text-gray-500 hover:text-gray-300">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{agent.name}</h1>
          <p className="text-sm text-gray-500">{agent.group_name || 'Sem grupo vinculado'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {tab === 'general' && (
        <div className="card p-5 space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Idioma</label>
              <select className="input" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                <option value="pt-BR">Português (BR)</option>
                <option value="en-US">English (US)</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Grupo do WhatsApp</label>
            <select className="input" value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}>
              <option value="">Sem grupo</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Instruções (System Prompt)</label>
            <textarea
              className="input min-h-[180px] resize-y"
              value={form.instructions}
              onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
              placeholder="Defina o comportamento, tom e especialidade do agente..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="reply_mentions"
              checked={form.reply_only_mentions}
              onChange={e => setForm(p => ({ ...p, reply_only_mentions: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="reply_mentions" className="text-sm text-gray-300">Responder apenas quando mencionado</label>
          </div>
          <button onClick={saveGeneral} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* MCPs Tab */}
      {tab === 'mcps' && (
        <div className="space-y-4 max-w-2xl">
          <form onSubmit={addMCP} className="card p-4 space-y-3">
            <h3 className="font-medium text-white text-sm">Adicionar MCP Server</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" required value={mcpForm.name} onChange={e => setMcpForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Busca Web" />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={mcpForm.mcp_type} onChange={e => setMcpForm(p => ({ ...p, mcp_type: e.target.value }))}>
                  <option value="http">HTTP (remoto)</option>
                  <option value="stdio">Stdio (local)</option>
                </select>
              </div>
            </div>
            {mcpForm.mcp_type === 'http' ? (
              <div>
                <label className="label">URL do Servidor</label>
                <input className="input" value={mcpForm.server_url} onChange={e => setMcpForm(p => ({ ...p, server_url: e.target.value }))} placeholder="https://mcp.example.com" />
              </div>
            ) : (
              <div>
                <label className="label">Comando</label>
                <input className="input" value={mcpForm.command} onChange={e => setMcpForm(p => ({ ...p, command: e.target.value }))} placeholder="npx @example/mcp-server" />
              </div>
            )}
            <div>
              <label className="label">Descrição</label>
              <input className="input" value={mcpForm.description} onChange={e => setMcpForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-1"><Plus size={14} /> Adicionar</button>
          </form>

          <div className="space-y-2">
            {agent.mcps.map(mcp => (
              <div key={mcp.id} className="card p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{mcp.name}</div>
                  <div className="text-xs text-gray-500">{mcp.server_url || mcp.command || '—'}</div>
                  <span className={`badge text-xs ${mcp.mcp_type === 'http' ? 'badge-blue' : 'badge-purple'}`}>{mcp.mcp_type}</span>
                </div>
                <button onClick={() => deleteMCP(mcp.id)} className="text-gray-600 hover:text-red-400 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {agent.mcps.length === 0 && <p className="text-gray-500 text-sm">Nenhum MCP configurado.</p>}
          </div>
        </div>
      )}

      {/* Skills Tab */}
      {tab === 'skills' && (
        <div className="space-y-4 max-w-2xl">
          <form onSubmit={addSkill} className="card p-4 space-y-3">
            <h3 className="font-medium text-white text-sm">Adicionar Skill</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" required value={skillForm.name} onChange={e => setSkillForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Análise de Sentimento" />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={skillForm.skill_type} onChange={e => setSkillForm(p => ({ ...p, skill_type: e.target.value }))}>
                  <option value="custom">Custom</option>
                  <option value="summarize">Resumir</option>
                  <option value="translate">Traduzir</option>
                  <option value="analyze">Analisar</option>
                  <option value="generate">Gerar conteúdo</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea className="input" rows={3} value={skillForm.description} onChange={e => setSkillForm(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o que essa skill faz e quando deve ser usada..." />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-1"><Plus size={14} /> Adicionar</button>
          </form>

          <div className="space-y-2">
            {agent.skills.map(skill => (
              <div key={skill.id} className="card p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{skill.name}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{skill.description}</div>
                  <span className="badge badge-blue text-xs">{skill.skill_type}</span>
                </div>
                <button onClick={() => deleteSkill(skill.id)} className="text-gray-600 hover:text-red-400 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {agent.skills.length === 0 && <p className="text-gray-500 text-sm">Nenhuma skill configurada.</p>}
          </div>
        </div>
      )}

      {/* Training Tab */}
      {tab === 'training' && (
        <div className="space-y-4 max-w-2xl">
          {/* File upload */}
          <div className="card p-4">
            <h3 className="font-medium text-white text-sm mb-3">Upload de Arquivo</h3>
            <p className="text-xs text-gray-400 mb-3">Suporta PDF, DOCX, TXT, JSON, CSV</p>
            <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-lg p-6 cursor-pointer hover:border-indigo-600 transition-colors ${uploadingFile ? 'opacity-50' : ''}`}>
              <Upload size={20} className="text-gray-500" />
              <span className="text-sm text-gray-400">{uploadingFile ? 'Processando...' : 'Clique para enviar arquivo'}</span>
              <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.json,.csv,.md" onChange={handleFileUpload} disabled={uploadingFile} />
            </label>
          </div>

          {/* Text input */}
          <form onSubmit={addTrainingText} className="card p-4 space-y-3">
            <h3 className="font-medium text-white text-sm">Adicionar Texto</h3>
            <div>
              <label className="label">Nome da Fonte</label>
              <input className="input" value={trainingSource} onChange={e => setTrainingSource(e.target.value)} placeholder="Ex: FAQ, Manual, Política..." />
            </div>
            <div>
              <label className="label">Conteúdo *</label>
              <textarea className="input min-h-[150px] resize-y" required value={trainingText} onChange={e => setTrainingText(e.target.value)} placeholder="Cole aqui o conteúdo de treinamento..." />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-1"><Plus size={14} /> Adicionar</button>
          </form>

          {/* Sources list */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-300 text-sm">Fontes de Conhecimento</h3>
            {sources.map(s => (
              <div key={s.source_name} className="card p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{s.source_name}</div>
                  <div className="text-xs text-gray-500">{s.chunk_count} chunks · {s.source_type}</div>
                </div>
                <button
                  onClick={async () => { await trainingApi.deleteSource(id, s.source_name); load() }}
                  className="text-gray-600 hover:text-red-400 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sources.length === 0 && <p className="text-gray-500 text-sm">Nenhum conhecimento adicionado ainda.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
