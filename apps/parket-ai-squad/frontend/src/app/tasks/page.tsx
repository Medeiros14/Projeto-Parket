'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarClock, Plus, Trash2, XCircle, RefreshCw, AlertCircle } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Agent {
  id: string
  name: string
  group_id: string
}

interface ScheduledTask {
  id: string
  agent_id: string
  group_id: string
  title: string
  description: string
  due_at: string
  status: string
  action_type: string
  action_config: Record<string, string>
  recurrence: string
  sent_at: string | null
  created_at: string | null
}

interface NewTaskForm {
  agent_id: string
  group_id: string
  title: string
  description: string
  due_at: string
  action_type: string
  recurrence: string
  webhook_url: string
  webhook_method: string
  webhook_body: string
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245, 158, 11, 0.15)',  color: '#F59E0B', label: 'Pendente' },
  sent:      { bg: 'rgba(34, 197, 94, 0.15)',   color: '#22C55E', label: 'Enviado' },
  cancelled: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', label: 'Cancelado' },
  failed:    { bg: 'rgba(239, 68, 68, 0.15)',   color: '#EF4444', label: 'Falhou' },
}

const RECURRENCE_LABELS: Record<string, string> = {
  none:    'Nenhuma',
  daily:   'Diária',
  weekly:  'Semanal',
  monthly: 'Mensal',
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const defaultForm: NewTaskForm = {
  agent_id: '',
  group_id: '',
  title: '',
  description: '',
  due_at: '',
  action_type: 'reminder',
  recurrence: 'none',
  webhook_url: '',
  webhook_method: 'POST',
  webhook_body: '{}',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewTaskForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks/`),
        fetch(`${API_BASE}/api/agents/`),
      ])
      if (tasksRes.ok) setTasks(await tasksRes.json())
      if (agentsRes.ok) setAgents(await agentsRes.json())
    } catch (e) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const agentName = (id: string) => agents.find(a => a.id === id)?.name || id.slice(0, 8) + '...'

  const handleAgentChange = (agent_id: string) => {
    const agent = agents.find(a => a.id === agent_id)
    setForm(f => ({ ...f, agent_id, group_id: agent?.group_id || '' }))
  }

  const handleCreate = async () => {
    if (!form.agent_id || !form.title || !form.due_at) {
      setError('Preencha Agente, Título e Data/Hora')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        agent_id: form.agent_id,
        group_id: form.group_id,
        title: form.title,
        description: form.description,
        due_at: new Date(form.due_at).toISOString(),
        action_type: form.action_type,
        recurrence: form.recurrence,
        action_config: {},
      }
      if (form.action_type === 'webhook') {
        body.action_config = {
          url: form.webhook_url,
          method: form.webhook_method,
          body: form.webhook_body,
        }
      }
      const res = await fetch(`${API_BASE}/api/tasks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setShowModal(false)
      setForm(defaultForm)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar tarefa')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta tarefa?')) return
    await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta tarefa permanentemente?')) return
    await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', color: '#F5F5F5', padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(212, 175, 55, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarClock size={20} color="#D4AF37" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F5', margin: 0 }}>Tarefas Agendadas</h1>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Lembretes e webhooks automáticos</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{
              background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, fontSize: 13,
            }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={() => { setShowModal(true); setError('') }}
            style={{
              background: '#D4AF37', border: 'none', color: '#0F0F0F',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
            }}
          >
            <Plus size={15} /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['pending', 'sent', 'failed', 'cancelled'] as const).map(s => {
          const count = tasks.filter(t => t.status === s).length
          const style = STATUS_STYLES[s]
          return (
            <div key={s} style={{
              background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10,
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: style.color }}>{count}</span>
              <span style={{ fontSize: 12, color: '#666' }}>{style.label}</span>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#666' }}>Carregando...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <CalendarClock size={40} color="#333" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#666', margin: 0 }}>Nenhuma tarefa agendada</p>
            <p style={{ color: '#444', fontSize: 13, margin: '4px 0 0' }}>
              Crie uma tarefa ou peça ao agente para agendar algo no WhatsApp
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
                {['Título', 'Agente', 'Data/Hora', 'Status', 'Tipo', 'Recorrência', 'Ações'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => (
                <tr key={task.id} style={{
                  borderBottom: i < tasks.length - 1 ? '1px solid #222' : 'none',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#F5F5F5' }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        {task.description.slice(0, 60)}{task.description.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#A0A0A0' }}>
                    {agentName(task.agent_id)}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#A0A0A0', whiteSpace: 'nowrap' }}>
                    {formatDate(task.due_at)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={task.status} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#A0A0A0' }}>
                    {task.action_type === 'reminder' ? 'Lembrete' : 'Webhook'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#A0A0A0' }}>
                    {RECURRENCE_LABELS[task.recurrence] || task.recurrence}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(task.id)}
                          title="Cancelar"
                          style={{
                            background: 'rgba(100, 116, 139, 0.15)', border: '1px solid #333',
                            color: '#94A3B8', borderRadius: 6, padding: '5px 8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(task.id)}
                        title="Excluir"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #333',
                          color: '#EF4444', borderRadius: 6, padding: '5px 8px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 16,
            padding: 28, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nova Tarefa Agendada</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >×</button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444', fontSize: 13,
              }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Agente *
                </span>
                <select
                  value={form.agent_id}
                  onChange={e => handleAgentChange(e.target.value)}
                  style={{
                    background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                    borderRadius: 8, padding: '9px 12px', fontSize: 14,
                  }}
                >
                  <option value="">Selecionar agente...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Título *
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Reunião de equipe"
                  style={{
                    background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                    borderRadius: 8, padding: '9px 12px', fontSize: 14,
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detalhes opcionais..."
                  rows={3}
                  style={{
                    background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                    borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Data e Hora *
                </span>
                <input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
                  style={{
                    background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                    borderRadius: 8, padding: '9px 12px', fontSize: 14,
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Tipo
                  </span>
                  <select
                    value={form.action_type}
                    onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                    style={{
                      background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                      borderRadius: 8, padding: '9px 12px', fontSize: 14,
                    }}
                  >
                    <option value="reminder">Lembrete WhatsApp</option>
                    <option value="webhook">Webhook HTTP</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Recorrência
                  </span>
                  <select
                    value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
                    style={{
                      background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                      borderRadius: 8, padding: '9px 12px', fontSize: 14,
                    }}
                  >
                    <option value="none">Nenhuma</option>
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </label>
              </div>

              {form.action_type === 'webhook' && (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      URL do Webhook
                    </span>
                    <input
                      type="url"
                      value={form.webhook_url}
                      onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                      placeholder="https://..."
                      style={{
                        background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                        borderRadius: 8, padding: '9px 12px', fontSize: 14,
                      }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Método
                      </span>
                      <select
                        value={form.webhook_method}
                        onChange={e => setForm(f => ({ ...f, webhook_method: e.target.value }))}
                        style={{
                          background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                          borderRadius: 8, padding: '9px 12px', fontSize: 14,
                        }}
                      >
                        {['POST', 'GET', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Corpo (JSON)
                      </span>
                      <input
                        type="text"
                        value={form.webhook_body}
                        onChange={e => setForm(f => ({ ...f, webhook_body: e.target.value }))}
                        placeholder="{}"
                        style={{
                          background: '#111', border: '1px solid #2A2A2A', color: '#F5F5F5',
                          borderRadius: 8, padding: '9px 12px', fontSize: 14,
                        }}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0',
                  borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  background: saving ? '#8a7020' : '#D4AF37', border: 'none', color: '#0F0F0F',
                  borderRadius: 8, padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 700,
                }}
              >
                {saving ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
