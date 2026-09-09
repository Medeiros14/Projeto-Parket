import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agente.parket.works'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// ---- Types ----

export interface AgentMCP {
  id: string; agent_id: string; name: string; description: string
  server_url?: string; command?: string; args: string[]
  env: Record<string, string>; headers: Record<string, string>
  mcp_type: 'http' | 'stdio'; is_active: boolean; created_at: string
}

export interface AgentSkill {
  id: string; agent_id: string; name: string; description: string
  skill_type: string; config: Record<string, unknown>
  is_active: boolean; created_at: string
}

export interface Agent {
  id: string; name: string; description: string; instructions: string
  group_id?: string; group_name?: string; is_active: boolean
  language: string; reply_only_mentions: boolean
  config: Record<string, unknown>; created_at: string; updated_at: string
  mcps: AgentMCP[]; skills: AgentSkill[]
}

export interface WhatsAppGroup {
  id: string; name: string; description: string; participants_count: number
}

export interface KanbanCard {
  id: string; column_id: string; agent_id?: string; title: string
  description: string; priority: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]; assignee?: string; due_date?: string; position: number
  conversation_id?: string; extra: Record<string, unknown>
  created_at: string; updated_at: string
}

export interface KanbanColumn {
  id: string; board_id: string; name: string; color: string
  position: number; wip_limit: number; cards: KanbanCard[]
}

export interface KanbanBoard {
  id: string; name: string; description: string; is_active: boolean
  created_at: string; columns: KanbanColumn[]
}

export interface KnowledgeSource {
  source_name: string; source_type: string; chunk_count: number; created_at: string
}

export type AIProvider = 'claude' | 'openai' | 'gemini'

export interface AIAccount {
  id: string
  provider: AIProvider
  label: string
  session_token: string   // masked in list responses
  extra: Record<string, string>
  is_active: boolean
  is_healthy: boolean
  token_count: number
  token_limit: number
  usage_pct: number
  last_used?: string
  last_error?: string
  consecutive_errors: number
  created_at: string
}

// ---- API Calls ----

export const agentsApi = {
  list: () => api.get<Agent[]>('/agents/').then(r => r.data),
  get: (id: string) => api.get<Agent>(`/agents/${id}`).then(r => r.data),
  create: (data: Partial<Agent>) => api.post<Agent>('/agents/', data).then(r => r.data),
  update: (id: string, data: Partial<Agent>) => api.patch(`/agents/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/agents/${id}`).then(r => r.data),
  addMCP: (agentId: string, data: Partial<AgentMCP>) =>
    api.post<AgentMCP>(`/agents/${agentId}/mcps`, data).then(r => r.data),
  deleteMCP: (agentId: string, mcpId: string) =>
    api.delete(`/agents/${agentId}/mcps/${mcpId}`).then(r => r.data),
  addSkill: (agentId: string, data: Partial<AgentSkill>) =>
    api.post<AgentSkill>(`/agents/${agentId}/skills`, data).then(r => r.data),
  deleteSkill: (agentId: string, skillId: string) =>
    api.delete(`/agents/${agentId}/skills/${skillId}`).then(r => r.data),
}

export const groupsApi = {
  list: () => api.get<WhatsAppGroup[]>('/groups/').then(r => r.data),
  status: () => api.get('/groups/connection').then(r => r.data),
  configureWebhook: (url: string) =>
    api.post('/groups/configure-webhook', { url }).then(r => r.data),
}

export const trainingApi = {
  listSources: (agentId: string) =>
    api.get<KnowledgeSource[]>(`/training/${agentId}`).then(r => r.data),
  addText: (agentId: string, text: string, sourceName: string) =>
    api.post(`/training/${agentId}/text`, { text, source_name: sourceName }).then(r => r.data),
  uploadFile: (agentId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/training/${agentId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  deleteSource: (agentId: string, sourceName: string) =>
    api.delete(`/training/${agentId}/source/${sourceName}`).then(r => r.data),
  clearAll: (agentId: string) =>
    api.delete(`/training/${agentId}/all`).then(r => r.data),
}

export const kanbanApi = {
  listBoards: () => api.get<KanbanBoard[]>('/kanban/boards').then(r => r.data),
  createBoard: (data: { name: string; description?: string }) =>
    api.post<KanbanBoard>('/kanban/boards', data).then(r => r.data),
  deleteBoard: (id: string) => api.delete(`/kanban/boards/${id}`).then(r => r.data),
  addColumn: (boardId: string, data: { name: string; color?: string; position?: number }) =>
    api.post(`/kanban/boards/${boardId}/columns`, data).then(r => r.data),
  createCard: (columnId: string, data: Partial<KanbanCard>) =>
    api.post<KanbanCard>(`/kanban/columns/${columnId}/cards`, data).then(r => r.data),
  updateCard: (cardId: string, data: Partial<KanbanCard>) =>
    api.patch(`/kanban/cards/${cardId}`, data).then(r => r.data),
  moveCard: (cardId: string, columnId: string, position: number) =>
    api.patch(`/kanban/cards/${cardId}/move`, { column_id: columnId, position }).then(r => r.data),
  deleteCard: (cardId: string) => api.delete(`/kanban/cards/${cardId}`).then(r => r.data),
}

export interface OAuthProvider {
  id: string
  opencode_id: string
  name: string
  connected: boolean
  expired: boolean
  auth_methods: { type: string; label?: string }[]
  has_oauth: boolean
}

export interface OAuthStartResult {
  url: string
  method: string        // "code" | "auto"
  instructions: string
  user_code: string     // for device/auto flow
  provider: string
  opencode_id: string
  method_index: number  // which method was actually used
}

export const accountsApi = {
  list: () => api.get<AIAccount[]>('/accounts/').then(r => r.data),
  add: (data: { provider: string; label: string; session_token: string; extra?: Record<string, string> }) =>
    api.post<AIAccount & { test: Record<string, unknown> }>('/accounts/', data).then(r => r.data),
  update: (id: string, data: Partial<AIAccount>) =>
    api.patch(`/accounts/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/accounts/${id}`).then(r => r.data),
  test: (id: string) => api.post(`/accounts/${id}/test`).then(r => r.data),
  reset: (id: string) => api.post(`/accounts/${id}/reset`).then(r => r.data),
  // OAuth
  listOAuthProviders: () => api.get<OAuthProvider[]>('/accounts/oauth/providers').then(r => r.data),
  startOAuth: (provider: string, methodIndex = 0) =>
    api.post<OAuthStartResult>('/accounts/oauth/start', { provider, method_index: methodIndex }).then(r => r.data),
  completeOAuth: (provider: string, code: string, label?: string, methodIndex = 0) =>
    api.post('/accounts/oauth/callback', { provider, code, label, method_index: methodIndex }).then(r => r.data),
  disconnectOAuth: (provider: string) =>
    api.delete(`/accounts/oauth/${provider}`).then(r => r.data),
  // Models
  listModels: (provider: string) =>
    api.get<{ provider: string; default: string; models: { id: string; label: string; context: number }[] }>(`/accounts/models/${provider}`).then(r => r.data),
  setModel: (accountId: string, model: string) =>
    api.patch(`/accounts/${accountId}/model`, { model }).then(r => r.data),
}

// ---- Lembretes (Reminders) ----

export interface Lembrete {
  card_id: string
  title: string
  data: string        // DD/MM/YYYY
  hora: string        // HH:MM
  observacao: string
  status: string      // agendado | notificado | concluido
  nome?: string
  celular?: string
  cidade?: string
  created_at?: string
}

export interface LembreteCreate {
  card_id: string
  data: string
  hora: string
  observacao?: string
}

export const lembretesApi = {
  list: (status?: string) =>
    api.get<Lembrete[]>('/lembretes/', { params: status ? { status } : {} }).then(r => r.data),
  create: (data: LembreteCreate) =>
    api.post<Lembrete>('/lembretes/', data).then(r => r.data),
  reagendar: (cardId: string, data: LembreteCreate) =>
    api.patch(`/lembretes/${cardId}/reagendar`, data).then(r => r.data),
  concluir: (cardId: string) =>
    api.patch(`/lembretes/${cardId}/concluir`).then(r => r.data),
}

export const systemApi = {
  health: () => api.get('/system/health').then(r => r.data),
  whatsappStatus: () => api.get('/system/whatsapp/status').then(r => r.data),
}

// ---- Agent Groups ----

export interface AgentGroupMember {
  id: string
  agent_id: string
  agent_name: string
  role: 'lead' | 'member' | 'observer'
  created_at: string
}

export interface AgentGroup {
  id: string
  name: string
  description?: string
  shared_context?: string
  is_active: boolean
  member_count: number
  members?: AgentGroupMember[]
  created_at: string
  updated_at: string
}

export const agentGroupsApi = {
  list: () => api.get<AgentGroup[]>('/agent-groups/').then(r => r.data),
  create: (data: { name: string; description?: string; shared_context?: string }) =>
    api.post<AgentGroup>('/agent-groups/', data).then(r => r.data),
  get: (id: string) => api.get<AgentGroup>(`/agent-groups/${id}`).then(r => r.data),
  update: (id: string, data: Partial<AgentGroup>) =>
    api.patch(`/agent-groups/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/agent-groups/${id}`).then(r => r.data),
  addMember: (groupId: string, agentId: string, role = 'member') =>
    api.post(`/agent-groups/${groupId}/members`, { agent_id: agentId, role }).then(r => r.data),
  removeMember: (groupId: string, agentId: string) =>
    api.delete(`/agent-groups/${groupId}/members/${agentId}`).then(r => r.data),
  updateRole: (groupId: string, agentId: string, role: string) =>
    api.patch(`/agent-groups/${groupId}/members/${agentId}/role`, { role }).then(r => r.data),
  getMessages: (groupId: string, limit = 50) =>
    api.get(`/agent-groups/${groupId}/messages?limit=${limit}`).then(r => r.data),
  postMessage: (groupId: string, content: string, messageType = 'task') =>
    api.post(`/agent-groups/${groupId}/messages`, { content, message_type: messageType }).then(r => r.data),
}
