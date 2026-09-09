export interface ToolCall {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id: string
  tool_name: string
  tool_args: Record<string, string>
  tool_call_error: boolean
  metrics: {
    time: number
  }
  created_at: number
}

export interface ReasoningSteps {
  title: string
  action?: string
  result: string
  reasoning: string
  confidence?: number
  next_action?: string
}
export interface ReasoningStepProps {
  index: number
  stepTitle: string
}
export interface ReasoningProps {
  reasoning: ReasoningSteps[]
}

export type ToolCallProps = {
  tools: ToolCall
}
interface ModelMessage {
  content: string | null
  context?: MessageContext[]
  created_at: number
  metrics?: {
    time: number
    prompt_tokens: number
    input_tokens: number
    completion_tokens: number
    output_tokens: number
  }
  name: string | null
  role: string
  tool_args?: unknown
  tool_call_id: string | null
  tool_calls: Array<{
    function: {
      arguments: string
      name: string
    }
    id: string
    type: string
  }> | null
}

export interface Model {
  name: string
  model: string
  provider: string
}

export interface Agent {
  agent_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

export interface Team {
  team_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

interface MessageContext {
  query: string
  docs?: Array<Record<string, object>>
  time?: number
}

export enum RunEvent {
  RunStarted = 'RunStarted',
  RunContent = 'RunContent',
  RunCompleted = 'RunCompleted',
  RunError = 'RunError',
  RunOutput = 'RunOutput',
  UpdatingMemory = 'UpdatingMemory',
  ToolCallStarted = 'ToolCallStarted',
  ToolCallCompleted = 'ToolCallCompleted',
  MemoryUpdateStarted = 'MemoryUpdateStarted',
  MemoryUpdateCompleted = 'MemoryUpdateCompleted',
  ReasoningStarted = 'ReasoningStarted',
  ReasoningStep = 'ReasoningStep',
  ReasoningCompleted = 'ReasoningCompleted',
  RunCancelled = 'RunCancelled',
  RunPaused = 'RunPaused',
  RunContinued = 'RunContinued',
  // Team Events
  TeamRunStarted = 'TeamRunStarted',
  TeamRunContent = 'TeamRunContent',
  TeamRunCompleted = 'TeamRunCompleted',
  TeamRunError = 'TeamRunError',
  TeamRunCancelled = 'TeamRunCancelled',
  TeamToolCallStarted = 'TeamToolCallStarted',
  TeamToolCallCompleted = 'TeamToolCallCompleted',
  TeamReasoningStarted = 'TeamReasoningStarted',
  TeamReasoningStep = 'TeamReasoningStep',
  TeamReasoningCompleted = 'TeamReasoningCompleted',
  TeamMemoryUpdateStarted = 'TeamMemoryUpdateStarted',
  TeamMemoryUpdateCompleted = 'TeamMemoryUpdateCompleted'
}

export interface ResponseAudio {
  id?: string
  content?: string
  transcript?: string
  channels?: number
  sample_rate?: number
}

export interface NewRunResponse {
  status: 'RUNNING' | 'PAUSED' | 'CANCELLED'
}

export interface RunResponseContent {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface RunResponse {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentExtraData {
  reasoning_steps?: ReasoningSteps[]
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface AgentExtraData {
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface ReasoningMessage {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id?: string
  tool_name?: string
  tool_args?: Record<string, string>
  tool_call_error?: boolean
  metrics?: {
    time: number
  }
  created_at?: number
}
export interface ChatMessage {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  streamingError?: boolean
  created_at: number
  tool_calls?: ToolCall[]
  extra_data?: {
    reasoning_steps?: ReasoningSteps[]
    reasoning_messages?: ReasoningMessage[]
    references?: ReferenceData[]
  }
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentDetails {
  id: string
  name?: string
  db_id?: string
  // Model
  model?: Model
}

export interface TeamDetails {
  id: string
  name?: string
  db_id?: string

  // Model
  model?: Model
}

export interface ImageData {
  revised_prompt: string
  url: string
}

export interface VideoData {
  id: number
  eta: number
  url: string
}

export interface AudioData {
  base64_audio?: string
  mime_type?: string
  url?: string
  id?: string
  content?: string
  channels?: number
  sample_rate?: number
}

export interface ReferenceData {
  query: string
  references: Reference[]
  time?: number
}

export interface Reference {
  content: string
  meta_data: {
    chunk: number
    chunk_size: number
  }
  name: string
}

export interface SessionEntry {
  session_id: string
  session_name: string
  created_at: number
  updated_at?: number
}

export interface Pagination {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface Sessions extends SessionEntry {
  data: SessionEntry[]
  meta: Pagination
}

export interface ChatEntry {
  message: {
    role: 'user' | 'system' | 'tool' | 'assistant'
    content: string
    created_at: number
  }
  response: {
    content: string
    tools?: ToolCall[]
    extra_data?: {
      reasoning_steps?: ReasoningSteps[]
      reasoning_messages?: ReasoningMessage[]
      references?: ReferenceData[]
    }
    images?: ImageData[]
    videos?: VideoData[]
    audio?: AudioData[]
    response_audio?: {
      transcript?: string
    }
    created_at: number
  }
}

// =====================================================================
// AgentOS 2.6.18 — full shapes mirrored from libs/agno/agno/os/**/schema.py
// =====================================================================

export interface PaginatedResponse<T> {
  data: T[]
  meta: Pagination
}

export interface ConfigManifest {
  display_name?: string
  description?: string
  icon?: string
  enabled?: boolean
  [k: string]: unknown
}

export interface ConfigResponse {
  os_id: string
  name?: string
  description?: string
  available_models?: string[]
  os_database?: string
  databases: string[]
  chat?: Record<string, unknown>
  manifest?: Record<string, ConfigManifest>
  session?: Record<string, unknown>
  metrics?: Record<string, unknown>
  memory?: Record<string, unknown>
  learning?: Record<string, unknown>
  knowledge?: Record<string, unknown>
  evals?: Record<string, unknown>
  traces?: Record<string, unknown>
  agents: AgentSummaryResponse[]
  teams: TeamSummaryResponse[]
  workflows: WorkflowSummaryResponse[]
  interfaces: { type: string; version?: string; route?: string }[]
}

export interface AgentSummaryResponse {
  id: string
  name?: string
  description?: string
  db_id?: string
  model?: Model
  metadata?: Record<string, unknown>
}

export interface TeamSummaryResponse extends AgentSummaryResponse {
  mode?: 'coordinate' | 'route' | 'broadcast' | 'tasks'
}

export interface WorkflowSummaryResponse {
  id: string
  name?: string
  description?: string
  db_id?: string
  is_factory?: boolean
  factory_input_schema?: Record<string, unknown>
  is_component?: boolean
  current_version?: number
  stage?: 'draft' | 'published'
}

export interface AgentResponse extends AgentSummaryResponse {
  role?: string
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: 'draft' | 'published'
  tools?: { tools?: unknown[]; tool_call_limit?: number; tool_choice?: string }
  sessions?: Record<string, unknown>
  knowledge?: Record<string, unknown>
  memory?: Record<string, unknown>
  reasoning?: Record<string, unknown>
  default_tools?: Record<string, boolean>
  system_message?: Record<string, unknown>
  extra_messages?: Record<string, unknown>
  response_settings?: Record<string, unknown>
  streaming?: { stream?: boolean; stream_events?: boolean }
  introduction?: string
  input_schema?: Record<string, unknown>
  factory_input_schema?: Record<string, unknown>
}

export interface TeamResponse extends AgentResponse {
  mode?: 'coordinate' | 'route' | 'broadcast' | 'tasks'
  members?: Array<{ id: string; name?: string; type?: 'agent' | 'team' }>
}

export interface WorkflowDetails {
  id: string
  name?: string
  description?: string
  db_id?: string
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: 'draft' | 'published'
}

export type WorkflowResponse = WorkflowDetails & {
  steps?: Array<{ name?: string; type?: string }>
  input_schema?: Record<string, unknown>
  factory_input_schema?: Record<string, unknown>
}

export interface SessionDetail {
  session_id: string
  session_name?: string
  session_state?: Record<string, unknown>
  created_at?: number
  updated_at?: number
  session_type?: 'agent' | 'team' | 'workflow'
  user_id?: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  session_summary?: string
  metrics?: Record<string, unknown>
  total_tokens?: number
  metadata?: Record<string, unknown>
  chat_history?: Array<Record<string, unknown>>
}

export interface RunSchema {
  run_id: string
  session_id: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'CANCELLED' | 'PAUSED'
  content?: string
  messages?: ModelMessage[]
  tools?: ToolCall[]
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
  created_at?: number
  updated_at?: number
  followups?: string[]
  metrics?: Record<string, unknown>
}

export interface Memory {
  memory_id: string
  user_id?: string
  agent_id?: string
  team_id?: string
  memory: string
  topics?: string[]
  metadata?: Record<string, unknown>
  created_at?: number
  updated_at?: number
}

export interface MemoryStats {
  user_id: string
  memory_count: number
  last_memory_updated_at?: number
}

export interface KnowledgeContent {
  id: string
  name?: string
  description?: string
  size?: number
  status?: 'processing' | 'completed' | 'failed'
  status_message?: string
  metadata?: Record<string, unknown>
  type?: string
  knowledge_id?: string
  created_at?: number
  updated_at?: number
}

export interface Schedule {
  id: string
  name?: string
  description?: string
  cron_expression?: string
  enabled?: boolean
  method?: string
  endpoint?: string
  timezone?: string
  timeout_seconds?: number
  last_run?: ScheduleRun
  next_run_at?: number
  created_at?: number
}

export interface ScheduleRun {
  schedule_id?: string
  run_id?: string
  triggered_at?: number
  completed_at?: number
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR'
  status_code?: number
  response_body_preview?: string
}

export interface EvalRun {
  eval_run_id: string
  name?: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  eval_type?: string
  status?: string
  result?: Record<string, unknown>
  created_at?: number
  updated_at?: number
}

export interface MetricsResponse {
  metrics: Array<DayAggregatedMetrics>
  totals?: Record<string, unknown>
}

export interface DayAggregatedMetrics {
  date: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  request_count?: number
  cost?: number
  by_model?: Record<string, Record<string, number>>
}

export interface TraceNode {
  trace_id: string
  span_id?: string
  parent_span_id?: string
  name?: string
  kind?: string
  status?: string
  start_time?: number
  end_time?: number
  duration_ms?: number
  attributes?: Record<string, unknown>
}

export interface TraceDetail extends TraceNode {
  children?: TraceNode[]
  events?: Array<Record<string, unknown>>
}
