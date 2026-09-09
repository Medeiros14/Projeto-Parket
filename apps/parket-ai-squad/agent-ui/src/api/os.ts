import { toast } from 'sonner'

import { APIRoutes } from './routes'

import type {
  AgentDetails,
  AgentResponse,
  ConfigResponse,
  EvalRun,
  KnowledgeContent,
  Memory,
  MemoryStats,
  MetricsResponse,
  Model,
  PaginatedResponse,
  RunSchema,
  Schedule,
  ScheduleRun,
  SessionDetail,
  SessionEntry,
  Sessions,
  TeamDetails,
  TeamResponse,
  TraceDetail,
  TraceNode,
  WorkflowDetails,
  WorkflowResponse
} from '@/types/os'

// =====================================================================
// HTTP helper
// =====================================================================

const createHeaders = (authToken?: string, json = true): HeadersInit => {
  const headers: HeadersInit = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  return headers
}

async function ok<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`${label}: ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

// =====================================================================
// System / config
// =====================================================================

export const getStatusAPI = async (base: string, authToken?: string): Promise<number> => {
  const res = await fetch(APIRoutes.Status(base), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  return res.status
}

export const getConfigAPI = async (base: string, authToken?: string): Promise<ConfigResponse | null> => {
  try {
    const res = await fetch(APIRoutes.Config(base), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export const getInfoAPI = async (base: string, authToken?: string) => {
  const res = await fetch(APIRoutes.Info(base), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const getModelsAPI = async (base: string, authToken?: string): Promise<Model[]> => {
  try {
    const res = await fetch(APIRoutes.Models(base), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// =====================================================================
// Agents
// =====================================================================

export const getAgentsAPI = async (base: string, authToken?: string): Promise<AgentDetails[]> => {
  try {
    const res = await fetch(APIRoutes.GetAgents(base), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) {
      toast.error(`Failed to fetch agents: ${res.statusText}`)
      return []
    }
    return res.json()
  } catch {
    toast.error('Error fetching agents')
    return []
  }
}

export const getAgentAPI = async (base: string, id: string, authToken?: string): Promise<AgentResponse | null> => {
  try {
    const res = await fetch(APIRoutes.GetAgent(base, id), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export const cancelAgentRunAPI = async (
  base: string,
  agentId: string,
  runId: string,
  sessionId?: string,
  authToken?: string
) => {
  const qs = new URLSearchParams()
  if (sessionId) qs.set('session_id', sessionId)
  const res = await fetch(
    `${APIRoutes.AgentRunCancel(base, agentId, runId)}?${qs}`,
    { method: 'POST', headers: createHeaders(authToken), credentials: 'include' }
  )
  return res.ok
}

// =====================================================================
// Teams
// =====================================================================

export const getTeamsAPI = async (base: string, authToken?: string): Promise<TeamDetails[]> => {
  try {
    const res = await fetch(APIRoutes.GetTeams(base), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) {
      toast.error(`Failed to fetch teams: ${res.statusText}`)
      return []
    }
    return res.json()
  } catch {
    toast.error('Error fetching teams')
    return []
  }
}

export const getTeamAPI = async (base: string, id: string, authToken?: string): Promise<TeamResponse | null> => {
  try {
    const res = await fetch(APIRoutes.GetTeam(base, id), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// =====================================================================
// Workflows
// =====================================================================

export const getWorkflowsAPI = async (base: string, authToken?: string): Promise<WorkflowDetails[]> => {
  try {
    const res = await fetch(APIRoutes.GetWorkflows(base), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export const getWorkflowAPI = async (base: string, id: string, authToken?: string): Promise<WorkflowResponse | null> => {
  try {
    const res = await fetch(APIRoutes.GetWorkflow(base, id), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export const runWorkflowAPI = async (
  base: string,
  id: string,
  payload: {
    message?: string
    stream?: boolean
    background?: boolean
    session_id?: string
    user_id?: string
    version?: number
    factory_input?: string
  },
  authToken?: string
) => {
  const fd = new FormData()
  fd.set('message', payload.message ?? '')
  fd.set('stream', String(payload.stream ?? false))
  fd.set('background', String(payload.background ?? false))
  if (payload.session_id) fd.set('session_id', payload.session_id)
  if (payload.user_id) fd.set('user_id', payload.user_id)
  if (payload.version != null) fd.set('version', String(payload.version))
  if (payload.factory_input) fd.set('factory_input', payload.factory_input)

  const res = await fetch(APIRoutes.WorkflowRun(base, id), {
    method: 'POST',
    body: fd,
    headers: createHeaders(authToken, false),
    credentials: 'include'
  })
  return res
}

export const getWorkflowRunsAPI = async (base: string, id: string, authToken?: string) => {
  const res = await fetch(APIRoutes.WorkflowRuns(base, id), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return []
  return res.json()
}

// =====================================================================
// Sessions
// =====================================================================

export const getAllSessionsAPI = async (
  base: string,
  type: 'agent' | 'team' | 'workflow',
  componentId: string,
  dbId?: string,
  opts: { limit?: number; page?: number } = {},
  authToken?: string
): Promise<Sessions | { data: [] }> => {
  try {
    const url = new URL(APIRoutes.GetSessions(base))
    url.searchParams.set('type', type)
    if (componentId) url.searchParams.set('component_id', componentId)
    if (dbId) url.searchParams.set('db_id', dbId)
    if (opts.limit) url.searchParams.set('limit', String(opts.limit))
    if (opts.page) url.searchParams.set('page', String(opts.page))

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken),
      credentials: 'include'
    })
    if (!res.ok) {
      if (res.status === 404) return { data: [] }
      throw new Error(`Failed to fetch sessions: ${res.statusText}`)
    }
    return res.json()
  } catch {
    return { data: [] }
  }
}

export const getSessionAPI = async (
  base: string,
  type: 'agent' | 'team' | 'workflow',
  sessionId: string,
  dbId?: string,
  authToken?: string
): Promise<SessionDetail | null> => {
  const qs = new URLSearchParams({ type })
  if (dbId) qs.set('db_id', dbId)
  const res = await fetch(`${APIRoutes.GetSession(base, sessionId)}?${qs}`, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const getSessionRunsAPI = async (
  base: string,
  sessionId: string,
  type: 'agent' | 'team' | 'workflow',
  dbId?: string,
  authToken?: string
): Promise<RunSchema[] | null> => {
  const qs = new URLSearchParams({ type })
  if (dbId) qs.set('db_id', dbId)
  const res = await fetch(`${APIRoutes.GetSessionRuns(base, sessionId)}?${qs}`, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const deleteSessionAPI = async (
  base: string,
  dbId: string,
  sessionId: string,
  authToken?: string
) => {
  const qs = new URLSearchParams()
  if (dbId) qs.append('db_id', dbId)
  return fetch(`${APIRoutes.DeleteSession(base, sessionId)}?${qs}`, {
    method: 'DELETE',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
}

export const renameSessionAPI = async (
  base: string,
  sessionId: string,
  name: string,
  authToken?: string
) => {
  return fetch(APIRoutes.RenameSession(base, sessionId), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include',
    body: JSON.stringify({ session_name: name })
  })
}

// Compat layer for upstream agent-ui: same name as the buggy upstream export.
// In the real backend, agent and team sessions share the same DELETE /sessions/{id}.
export const deleteTeamSessionAPI = deleteSessionAPI

// =====================================================================
// Memories
// =====================================================================

export const getMemoriesAPI = async (
  base: string,
  opts: { user_id?: string; limit?: number; page?: number; db_id?: string } = {},
  authToken?: string
): Promise<PaginatedResponse<Memory> | null> => {
  const url = new URL(APIRoutes.GetMemories(base))
  if (opts.user_id) url.searchParams.set('user_id', opts.user_id)
  if (opts.db_id) url.searchParams.set('db_id', opts.db_id)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))
  if (opts.page) url.searchParams.set('page', String(opts.page))
  const res = await fetch(url, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const getUserMemoryStatsAPI = async (
  base: string,
  authToken?: string
): Promise<MemoryStats[]> => {
  const res = await fetch(APIRoutes.UserMemoryStats(base), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return []
  return res.json()
}

export const deleteMemoryAPI = async (
  base: string,
  mid: string,
  authToken?: string
) =>
  fetch(APIRoutes.DeleteMemory(base, mid), {
    method: 'DELETE',
    headers: createHeaders(authToken),
    credentials: 'include'
  })

// =====================================================================
// Knowledge
// =====================================================================

export const getKnowledgeContentAPI = async (
  base: string,
  opts: { limit?: number; page?: number; db_id?: string } = {},
  authToken?: string
): Promise<PaginatedResponse<KnowledgeContent> | null> => {
  const url = new URL(APIRoutes.GetKnowledgeContent(base))
  if (opts.db_id) url.searchParams.set('db_id', opts.db_id)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))
  if (opts.page) url.searchParams.set('page', String(opts.page))
  const res = await fetch(url, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const getKnowledgeConfigAPI = async (base: string, authToken?: string) => {
  const res = await fetch(APIRoutes.KnowledgeConfig(base), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const knowledgeSearchAPI = async (
  base: string,
  payload: { query: string; limit?: number; db_id?: string; knowledge_id?: string },
  authToken?: string
) => {
  const res = await fetch(APIRoutes.KnowledgeSearch(base), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include',
    body: JSON.stringify(payload)
  })
  if (!res.ok) return null
  return res.json()
}

// =====================================================================
// Schedules
// =====================================================================

export const getSchedulesAPI = async (
  base: string,
  authToken?: string
): Promise<Schedule[]> => {
  const res = await fetch(APIRoutes.GetSchedules(base), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return []
  return res.json()
}

export const getScheduleRunsAPI = async (
  base: string,
  sid: string,
  authToken?: string
): Promise<ScheduleRun[]> => {
  const res = await fetch(APIRoutes.GetScheduleRuns(base, sid), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return []
  return res.json()
}

export const enableScheduleAPI = (base: string, sid: string, authToken?: string) =>
  fetch(APIRoutes.EnableSchedule(base, sid), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include'
  })

export const disableScheduleAPI = (base: string, sid: string, authToken?: string) =>
  fetch(APIRoutes.DisableSchedule(base, sid), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include'
  })

export const triggerScheduleAPI = (base: string, sid: string, authToken?: string) =>
  fetch(APIRoutes.TriggerSchedule(base, sid), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include'
  })

// =====================================================================
// Evals
// =====================================================================

export const getEvalRunsAPI = async (
  base: string,
  opts: { limit?: number; page?: number; db_id?: string } = {},
  authToken?: string
): Promise<PaginatedResponse<EvalRun> | null> => {
  const url = new URL(APIRoutes.GetEvalRuns(base))
  if (opts.db_id) url.searchParams.set('db_id', opts.db_id)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))
  if (opts.page) url.searchParams.set('page', String(opts.page))
  const res = await fetch(url, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

// =====================================================================
// Metrics
// =====================================================================

export const getMetricsAPI = async (
  base: string,
  opts: { start_date?: string; end_date?: string; db_id?: string } = {},
  authToken?: string
): Promise<MetricsResponse | null> => {
  const url = new URL(APIRoutes.GetMetrics(base))
  if (opts.db_id) url.searchParams.set('db_id', opts.db_id)
  if (opts.start_date) url.searchParams.set('start_date', opts.start_date)
  if (opts.end_date) url.searchParams.set('end_date', opts.end_date)
  const res = await fetch(url, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const refreshMetricsAPI = (base: string, authToken?: string) =>
  fetch(APIRoutes.RefreshMetrics(base), {
    method: 'POST',
    headers: createHeaders(authToken),
    credentials: 'include'
  })

// =====================================================================
// Traces
// =====================================================================

export const getTracesAPI = async (
  base: string,
  opts: { limit?: number; page?: number; db_id?: string } = {},
  authToken?: string
): Promise<PaginatedResponse<TraceNode> | null> => {
  const url = new URL(APIRoutes.GetTraces(base))
  if (opts.db_id) url.searchParams.set('db_id', opts.db_id)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))
  if (opts.page) url.searchParams.set('page', String(opts.page))
  const res = await fetch(url, {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}

export const getTraceAPI = async (
  base: string,
  tid: string,
  authToken?: string
): Promise<TraceDetail | null> => {
  const res = await fetch(APIRoutes.GetTrace(base, tid), {
    method: 'GET',
    headers: createHeaders(authToken),
    credentials: 'include'
  })
  if (!res.ok) return null
  return res.json()
}
