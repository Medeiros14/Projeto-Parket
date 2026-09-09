// Extensões EAS Parket — endpoints custom em /eas/* que NÃO existem no AgentOS upstream.
// Cobre: auth, knowledge pack (KB markdown), work kanban, activities (Supabase log),
// agent overrides (hot-swap instructions), confirmations (legacy), schedules custom,
// runs normalized (events lazy-load), status geral.

import { easBase } from '@/lib/easApi'

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${easBase()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
    }
    throw new Error(`${path}: ${res.status}`)
  }
  return res.json()
}

async function jpost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${easBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

async function jdelete<T>(path: string): Promise<T> {
  const res = await fetch(`${easBase()}${path}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

// ---------- Auth ----------
export const easWhoami = () =>
  jget<{ authenticated: boolean; user: string | null }>('/eas/whoami')

export const easAuthStatus = () =>
  jget<Record<string, unknown>>('/eas/auth/status')

export const easStatus = () =>
  jget<Record<string, unknown>>('/eas/status')

// ---------- Knowledge pack (markdown injection) ----------
export const easKnowledgeList = () =>
  jget<{ squads_known: string[]; docs: Record<string, string[]> }>(
    '/eas/knowledge/list'
  )

export const easKnowledgePack = (squad: string, preview = 4000) =>
  jget<{
    squad: string
    docs_count: number
    docs: string[]
    token_estimate: number
    system_text_preview: string
  }>(`/eas/knowledge/pack?squad=${encodeURIComponent(squad)}&preview_chars=${preview}`)

// ---------- Work kanban ----------
export const easWorkTasks = (limit = 200) =>
  jget<{ ok: boolean; items: WorkTask[] }>(`/eas/work/tasks?limit=${limit}`)

export const easWorkFeed = (limit = 100) =>
  jget<{ ok: boolean; items: FeedItem[] }>(`/eas/work/feed?limit=${limit}`)

export const easAgentsActivity = () =>
  jget<{ ok: boolean; items: AgentActivity[] }>('/eas/work/agents-activity')

export interface WorkTask {
  id: string
  kind: 'session' | 'confirmation'
  agent_id?: string
  team_id?: string
  workflow_id?: string
  status: 'waiting' | 'doing' | 'done' | 'failed'
  title: string
  runs_count?: number
  tool_name?: string
  token?: string
  created_at?: number
  updated_at?: number
}

export interface FeedItem {
  kind: 'run' | 'confirmation' | 'handoff' | 'activity'
  subtype?: string
  owner?: string
  ref_id?: string
  summary?: string
  ts_unix?: number
}

export interface AgentActivity {
  id: string
  type: string
  sessions: number
  total_runs: number
  runs_24h: number
  runs_7d: number
  last_seen_unix: number
}

// ---------- Activities (claude_atividades) ----------
export const easActivities = (limit = 30, setor?: string) => {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (setor) qs.set('setor', setor)
  return jget<{ ok: boolean; items: Activity[] }>(`/eas/activities?${qs}`)
}

export interface Activity {
  id: string
  created_at: string
  titulo: string
  descricao: string
  setor: string
  categoria: string
  feita_por: string
}

// ---------- Runs normalized (events lazy-load) ----------
export const easRuns = (
  limit = 100,
  kind?: 'agent' | 'team' | 'workflow'
) => {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (kind) qs.set('kind', kind)
  return jget<{ ok: boolean; items: EasRunSession[] }>(`/eas/runs?${qs}`)
}

export const easRunDetail = (sessionId: string) =>
  jget<{ ok: boolean; session: EasRunSessionDetail }>(
    `/eas/runs/${encodeURIComponent(sessionId)}`
  )

export const easRunEvents = (
  sessionId: string,
  runId: string,
  afterIdx = -1,
  limit = 500
) =>
  jget<{
    ok: boolean
    items: { event_idx: number; event_type: string; created_at: number; data: unknown }[]
    next_after_idx: number
  }>(
    `/eas/runs/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/events?after_idx=${afterIdx}&limit=${limit}`
  )

export const easRunMemberResponses = (sessionId: string, runId: string) =>
  jget<{
    ok: boolean
    items: {
      response_idx: number
      agent_id: string
      agent_name: string
      parent_run_id: string
      created_at: number
      data: unknown
    }[]
  }>(
    `/eas/runs/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/member_responses`
  )

export interface EasRunSession {
  session_id: string
  session_type: 'agent' | 'team' | 'workflow'
  owner_id?: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  user_id?: string
  run_count: number
  summary?: string
  created_at: number
  updated_at?: number
}

export interface EasRunSessionDetail extends EasRunSession {
  runs: {
    run_id: string
    event_count: number
    member_response_count: number
    message_count: number
    tool_count: number
    status?: string
    content?: string
  }[]
}

// ---------- Agents config + overrides ----------
export const easAgentConfig = (agentId: string) =>
  jget<{
    ok: boolean
    id: string
    name: string
    model: { id: string; provider: string }
    instructions: string
    instructions_chars: number
    tools_count: number
    tools: { name: string; doc: string }[]
    squad_in_kb: string | null
    source_path_hint: string
    override_active: boolean
    override_meta?: {
      updated_at: string
      updated_by: string
      note: string | null
      chars: number
    } | null
  }>(`/eas/agents/${encodeURIComponent(agentId)}/config`)

export const easAgentOverride = (agentId: string) =>
  jget<{
    ok: boolean
    agent_id: string
    has_override: boolean
    base_instructions: string
    override: { instructions: string; note?: string; updated_at: string; updated_by?: string } | null
  }>(`/eas/agents/${encodeURIComponent(agentId)}/override`)

export const easAgentOverrideSet = (agentId: string, instructions: string, note?: string) =>
  jpost<{ ok: boolean; agent_id: string; chars: number }>(
    `/eas/agents/${encodeURIComponent(agentId)}/override`,
    { instructions, note }
  )

export const easAgentOverrideClear = (agentId: string) =>
  jdelete<{ ok: boolean; agent_id: string; rows: number }>(
    `/eas/agents/${encodeURIComponent(agentId)}/override`
  )

// ---------- Confirmations (legacy) ----------
export const easConfirmPending = () =>
  jget<{ pending: Confirmation[] }>('/eas/confirm/pending')

export interface Confirmation {
  token: string
  tool_name: string
  summary?: string
  requested_at: number
  agent_id?: string
}

// ---------- Schedules (EAS extension over native /schedules) ----------
export const easSchedules = () =>
  jget<{
    ok: boolean
    items: EasSchedule[]
    known_workflow_crons: Record<string, string>
  }>('/eas/schedules')

export const easSchedulesInit = () =>
  jpost<{ ok: boolean; items: { workflow: string; status: string; cron?: string }[] }>(
    '/eas/schedule/init'
  )

export interface EasSchedule {
  id: string
  name: string
  description?: string
  cron_expression: string
  enabled: boolean
  method: string
  endpoint: string
  last_run?: {
    triggered_at: number
    completed_at?: number
    status?: string
    status_code?: number
  }
}

// ---------- Poller (WhatsApp) ----------
export const easPollerStart = () =>
  jpost<{ ok: boolean; status: string }>('/eas/poller/start')

export const easPollerStop = () =>
  jpost<{ ok: boolean; status: string }>('/eas/poller/stop')
