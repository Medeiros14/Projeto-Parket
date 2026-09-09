/**
 * API dos painéis locais (Métricas / Memórias / Knowledge) — mesmas rotas
 * que o control plane oficial (os.agno.com) consome no AgentOS.
 */
import { toast } from 'sonner'

import { APIRoutes } from './routes'

const createHeaders = (authToken?: string): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  return headers
}

// ─── Métricas ────────────────────────────────────────────────
export type TokenMetrics = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  reasoning_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

export type ModelMetric = {
  count: number
  model_id: string
  model_provider: string
}

export type MetricsDay = {
  id: string
  date: string
  agent_runs_count: number
  agent_sessions_count: number
  team_runs_count: number
  team_sessions_count: number
  workflow_runs_count: number
  workflow_sessions_count: number
  users_count: number
  token_metrics: TokenMetrics
  model_metrics: ModelMetric[]
  updated_at: string
}

export type MetricsResponse = {
  metrics: MetricsDay[]
  updated_at: string | null
}

export const getMetricsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<MetricsResponse> => {
  try {
    const response = await fetch(APIRoutes.GetMetrics(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar métricas: ${response.statusText}`)
      return { metrics: [], updated_at: null }
    }
    return response.json()
  } catch {
    toast.error('Erro buscando métricas')
    return { metrics: [], updated_at: null }
  }
}

export const refreshMetricsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.RefreshMetrics(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken)
    })
    return response.ok
  } catch {
    return false
  }
}

// ─── Memórias ────────────────────────────────────────────────
export type UserMemory = {
  memory_id: string
  memory: string
  topics: string[] | null
  agent_id: string | null
  team_id: string | null
  user_id: string | null
  updated_at: string | null
}

export type MemoriesResponse = {
  data: UserMemory[]
  meta: {
    page: number
    limit: number
    total_pages: number
    total_count: number
  }
}

export type MemoriesQuery = {
  page?: number
  limit?: number
  user_id?: string
  agent_id?: string
  topics?: string
  search_content?: string
}

export const getMemoriesAPI = async (
  endpoint: string,
  authToken?: string,
  query: MemoriesQuery = {}
): Promise<MemoriesResponse> => {
  const empty: MemoriesResponse = {
    data: [],
    meta: { page: 1, limit: 20, total_pages: 0, total_count: 0 }
  }
  try {
    const url = new URL(APIRoutes.GetMemories(endpoint))
    url.searchParams.set('sort_by', 'updated_at')
    url.searchParams.set('sort_order', 'desc')
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    })
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar memórias: ${response.statusText}`)
      return empty
    }
    return response.json()
  } catch {
    toast.error('Erro buscando memórias')
    return empty
  }
}

export const getMemoryTopicsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<string[]> => {
  try {
    const response = await fetch(APIRoutes.GetMemoryTopics(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

export type MemoryInput = {
  memory: string
  user_id?: string | null
  topics?: string[] | null
}

export const createMemoryAPI = async (
  endpoint: string,
  input: MemoryInput,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.GetMemories(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken),
      body: JSON.stringify(input)
    })
    if (!response.ok) toast.error(`Falha ao criar memória: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro criando memória')
    return false
  }
}

export const updateMemoryAPI = async (
  endpoint: string,
  memoryId: string,
  input: MemoryInput,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Memory(endpoint, memoryId), {
      method: 'PATCH',
      headers: createHeaders(authToken),
      body: JSON.stringify(input)
    })
    if (!response.ok)
      toast.error(`Falha ao atualizar memória: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro atualizando memória')
    return false
  }
}

export const deleteMemoryAPI = async (
  endpoint: string,
  memoryId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Memory(endpoint, memoryId), {
      method: 'DELETE',
      headers: createHeaders(authToken)
    })
    if (!response.ok)
      toast.error(`Falha ao apagar memória: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro apagando memória')
    return false
  }
}

// ─── Knowledge ───────────────────────────────────────────────
export type KnowledgeContentItem = {
  id: string
  name: string | null
  description: string | null
  type: string | null
  size: number | null
  status: string | null
  status_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type KnowledgeContentResult =
  | { ok: true; data: KnowledgeContentItem[]; meta?: { total_count?: number } }
  | { ok: false; detail: string }

export const getKnowledgeContentAPI = async (
  endpoint: string,
  authToken?: string
): Promise<KnowledgeContentResult> => {
  try {
    const url = new URL(APIRoutes.KnowledgeContent(endpoint))
    url.searchParams.set('limit', '100')
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, detail: body?.detail || response.statusText }
    }
    return { ok: true, data: body?.data ?? [], meta: body?.meta }
  } catch {
    return { ok: false, detail: 'Erro de rede ao buscar knowledge' }
  }
}

export const uploadKnowledgeContentAPI = async (
  endpoint: string,
  input: { file?: File; url?: string; name?: string; description?: string },
  authToken?: string
): Promise<boolean> => {
  try {
    const form = new FormData()
    if (input.file) form.append('file', input.file)
    if (input.url) form.append('url', input.url)
    if (input.name) form.append('name', input.name)
    if (input.description) form.append('description', input.description)
    const headers: HeadersInit = {}
    if (authToken) (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`
    const response = await fetch(APIRoutes.KnowledgeContent(endpoint), {
      method: 'POST',
      headers,
      body: form
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha no upload: ${body?.detail || response.statusText}`)
    }
    return response.ok
  } catch {
    toast.error('Erro no upload de knowledge')
    return false
  }
}

export const deleteKnowledgeContentAPI = async (
  endpoint: string,
  contentId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.KnowledgeContentItem(endpoint, contentId),
      { method: 'DELETE', headers: createHeaders(authToken) }
    )
    if (!response.ok)
      toast.error(`Falha ao apagar conteúdo: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro apagando conteúdo')
    return false
  }
}

// ─── Meta comum (paginação) ──────────────────────────────────
export type PageMeta = {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

const emptyMeta: PageMeta = { page: 1, limit: 20, total_pages: 0, total_count: 0 }

// ─── Evals ───────────────────────────────────────────────────
export type EvalRun = {
  id: string
  name: string | null
  agent_id: string | null
  team_id: string | null
  workflow_id: string | null
  model_id: string | null
  model_provider: string | null
  evaluated_component_name: string | null
  eval_type: string | null
  eval_data: Record<string, unknown> | null
  eval_input: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type EvalRunsQuery = {
  page?: number
  limit?: number
  agent_id?: string
  eval_types?: string
}

export const getEvalRunsAPI = async (
  endpoint: string,
  authToken?: string,
  query: EvalRunsQuery = {}
): Promise<{ data: EvalRun[]; meta: PageMeta }> => {
  const empty = { data: [], meta: emptyMeta }
  try {
    const url = new URL(APIRoutes.GetEvalRuns(endpoint))
    url.searchParams.set('sort_by', 'created_at')
    url.searchParams.set('sort_order', 'desc')
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    })
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar evals: ${response.statusText}`)
      return empty
    }
    return response.json()
  } catch {
    toast.error('Erro buscando evals')
    return empty
  }
}

export const deleteEvalRunsAPI = async (
  endpoint: string,
  evalRunIds: string[],
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.GetEvalRuns(endpoint), {
      method: 'DELETE',
      headers: createHeaders(authToken),
      body: JSON.stringify({ eval_run_ids: evalRunIds })
    })
    if (!response.ok) toast.error(`Falha ao apagar eval: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro apagando eval')
    return false
  }
}

// ─── Schedules ───────────────────────────────────────────────
export type Schedule = {
  id: string
  name: string
  description: string | null
  method: string
  endpoint: string
  payload: Record<string, unknown> | null
  cron_expr: string
  timezone: string
  timeout_seconds: number
  max_retries: number
  retry_delay_seconds: number
  enabled: boolean
  next_run_at: number | null
  created_at?: number | null
  updated_at?: number | null
}

export type ScheduleInput = {
  name: string
  cron_expr: string
  endpoint: string
  method?: string
  description?: string | null
  payload?: Record<string, unknown> | null
  timezone?: string
}

export type ScheduleRun = {
  id: string
  schedule_id: string
  attempt: number
  triggered_at: number | null
  completed_at: number | null
  status: string
  status_code: number | null
  run_id: string | null
  session_id: string | null
  error: string | null
}

export const getSchedulesAPI = async (
  endpoint: string,
  authToken?: string
): Promise<{ data: Schedule[]; meta: PageMeta }> => {
  const empty = { data: [], meta: emptyMeta }
  try {
    const response = await fetch(APIRoutes.GetSchedules(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha ao buscar schedules: ${body?.detail || response.statusText}`)
      return empty
    }
    return response.json()
  } catch {
    toast.error('Erro buscando schedules')
    return empty
  }
}

export const createScheduleAPI = async (
  endpoint: string,
  input: ScheduleInput,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.GetSchedules(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken),
      body: JSON.stringify(input)
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha ao criar schedule: ${body?.detail || response.statusText}`)
    }
    return response.ok
  } catch {
    toast.error('Erro criando schedule')
    return false
  }
}

export const updateScheduleAPI = async (
  endpoint: string,
  scheduleId: string,
  input: Partial<ScheduleInput>,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Schedule(endpoint, scheduleId), {
      method: 'PATCH',
      headers: createHeaders(authToken),
      body: JSON.stringify(input)
    })
    if (!response.ok)
      toast.error(`Falha ao atualizar schedule: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro atualizando schedule')
    return false
  }
}

export const deleteScheduleAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Schedule(endpoint, scheduleId), {
      method: 'DELETE',
      headers: createHeaders(authToken)
    })
    if (!response.ok)
      toast.error(`Falha ao apagar schedule: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro apagando schedule')
    return false
  }
}

export const scheduleActionAPI = async (
  endpoint: string,
  scheduleId: string,
  action: 'enable' | 'disable' | 'trigger',
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.ScheduleAction(endpoint, scheduleId, action),
      { method: 'POST', headers: createHeaders(authToken) }
    )
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha (${action}): ${body?.detail || response.statusText}`)
    }
    return response.ok
  } catch {
    toast.error(`Erro na ação ${action}`)
    return false
  }
}

export const getScheduleRunsAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<ScheduleRun[]> => {
  try {
    const url = new URL(APIRoutes.ScheduleRuns(endpoint, scheduleId))
    url.searchParams.set('limit', '20')
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) return []
    const body = await response.json()
    return body?.data ?? []
  } catch {
    return []
  }
}

// ─── Learnings ───────────────────────────────────────────────
export type Learning = {
  learning_id: string
  learning_type: string | null
  namespace: string | null
  user_id: string | null
  agent_id: string | null
  team_id: string | null
  session_id: string | null
  entity_id: string | null
  entity_type: string | null
  content: Record<string, unknown> | string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type LearningsQuery = {
  page?: number
  limit?: number
  learning_type?: string
  user_id?: string
  agent_id?: string
}

export const getLearningsAPI = async (
  endpoint: string,
  authToken?: string,
  query: LearningsQuery = {}
): Promise<{ data: Learning[]; meta: PageMeta }> => {
  const empty = { data: [], meta: emptyMeta }
  try {
    const url = new URL(APIRoutes.GetLearnings(endpoint))
    url.searchParams.set('sort_by', 'updated_at')
    url.searchParams.set('sort_order', 'desc')
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    })
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar learnings: ${response.statusText}`)
      return empty
    }
    return response.json()
  } catch {
    toast.error('Erro buscando learnings')
    return empty
  }
}

export const deleteLearningAPI = async (
  endpoint: string,
  learningId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Learning(endpoint, learningId), {
      method: 'DELETE',
      headers: createHeaders(authToken)
    })
    if (!response.ok)
      toast.error(`Falha ao apagar learning: ${response.statusText}`)
    return response.ok
  } catch {
    toast.error('Erro apagando learning')
    return false
  }
}

// ─── Toolkits (Nível 2) ──────────────────────────────────────
export type ToolkitField = {
  name: string
  label: string
  secret: boolean
  required: boolean
  set: boolean
}

export type ToolkitEntry = {
  id: string
  label: string
  description: string
  requires_key: boolean
  fields: ToolkitField[]
  enabled: boolean
  agents: string[]
  last_error: string | null
}

export type ToolkitsResponse = {
  agents: string[]
  pending_restart: boolean
  toolkits: ToolkitEntry[]
}

export const getToolkitsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<ToolkitsResponse | null> => {
  try {
    const response = await fetch(APIRoutes.GetToolkits(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar toolkits: ${response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Erro buscando toolkits')
    return null
  }
}

export const updateToolkitAPI = async (
  endpoint: string,
  toolkitId: string,
  input: {
    enabled?: boolean
    agents?: string[]
    config?: Record<string, string>
  },
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.Toolkit(endpoint, toolkitId), {
      method: 'PUT',
      headers: createHeaders(authToken),
      body: JSON.stringify(input)
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha ao salvar: ${body?.detail || response.statusText}`)
    }
    return response.ok
  } catch {
    toast.error('Erro salvando toolkit')
    return false
  }
}

export type CatalogItem = {
  module: string
  classes: string[]
  description: string
  curated_id: string | null
  error: string | null
  status: 'curado' | 'disponivel' | 'requer_dependencia'
}

export type ToolkitCatalogResponse = {
  total: number
  counts: Record<string, number>
  items: CatalogItem[]
}

export const getToolkitCatalogAPI = async (
  endpoint: string,
  authToken?: string
): Promise<ToolkitCatalogResponse | null> => {
  try {
    const response = await fetch(APIRoutes.ToolkitCatalog(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar catálogo: ${response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Erro buscando catálogo')
    return null
  }
}

export const applyToolkitsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.ApplyToolkits(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha ao aplicar: ${body?.detail || response.statusText}`)
    }
    return response.ok
  } catch {
    toast.error('Erro aplicando mudanças')
    return false
  }
}

// ─── Workflows ───────────────────────────────────────────────
export type WorkflowSummary = {
  id: string
  name: string
  description: string | null
  db_id?: string
}

export type WorkflowSessionEntry = {
  session_id: string
  session_name: string | null
  created_at: string
  updated_at?: string
  user_id?: string | null
  workflow_id?: string
}

export type WorkflowStepResult = {
  step_name: string
  step_type?: string
  executor_name?: string
  executor_type?: string
  content?: string | null
  error?: string | null
  success?: boolean | null
}

export type WorkflowRunDetail = {
  run_id: string
  status: string
  content?: string | null
  created_at?: number
  step_results?: WorkflowStepResult[]
}

export const getWorkflowsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<WorkflowSummary[]> => {
  try {
    const response = await fetch(APIRoutes.GetWorkflows(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar workflows: ${response.statusText}`)
      return []
    }
    return response.json()
  } catch {
    toast.error('Erro buscando workflows')
    return []
  }
}

export const runWorkflowAPI = async (
  endpoint: string,
  workflowId: string,
  message: string,
  authToken?: string
): Promise<WorkflowRunDetail | null> => {
  try {
    const form = new FormData()
    form.append('message', message)
    form.append('stream', 'false')
    const headers: HeadersInit = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    const response = await fetch(APIRoutes.WorkflowRun(endpoint, workflowId), {
      method: 'POST',
      headers,
      body: form
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(`Falha ao rodar workflow: ${body?.detail || response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Erro rodando workflow')
    return null
  }
}

export const getWorkflowSessionsAPI = async (
  endpoint: string,
  workflowId: string,
  authToken?: string
): Promise<WorkflowSessionEntry[]> => {
  try {
    const url = `${APIRoutes.GetSessions(endpoint)}?type=workflow&component_id=${encodeURIComponent(workflowId)}&limit=20&sort_by=created_at&sort_order=desc`
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar execuções: ${response.statusText}`)
      return []
    }
    const body = await response.json()
    return Array.isArray(body) ? body : (body.data ?? [])
  } catch {
    toast.error('Erro buscando execuções')
    return []
  }
}

export const getWorkflowSessionRunsAPI = async (
  endpoint: string,
  sessionId: string,
  authToken?: string
): Promise<WorkflowRunDetail[]> => {
  try {
    const url = `${APIRoutes.GetSession(endpoint, sessionId)}?type=workflow`
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Falha ao buscar runs: ${response.statusText}`)
      return []
    }
    const body = await response.json()
    return Array.isArray(body) ? body : (body.runs ?? body.data ?? [])
  } catch {
    toast.error('Erro buscando runs')
    return []
  }
}
