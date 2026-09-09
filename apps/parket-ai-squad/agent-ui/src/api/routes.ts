// AgentOS 2.6.18 endpoint routes (raiz, sem prefixo /v1).
// Source of truth: libs/agno/agno/os/routers/**/router.py
// Mantém apenas rotas NATIVAS do Agno. Extensões Parket vivem em api/eas.ts.

export const APIRoutes = {
  // System / config
  Status: (b: string) => `${b}/health`,
  Info: (b: string) => `${b}/info`,
  Config: (b: string) => `${b}/config`,
  Models: (b: string) => `${b}/models`,

  // Agents
  GetAgents: (b: string) => `${b}/agents`,
  GetAgent: (b: string, id: string) => `${b}/agents/${id}`,
  AgentRun: (b: string, id: string) => `${b}/agents/${id}/runs`,
  AgentRunCancel: (b: string, id: string, rid: string) =>
    `${b}/agents/${id}/runs/${rid}/cancel`,
  AgentRunContinue: (b: string, id: string, rid: string) =>
    `${b}/agents/${id}/runs/${rid}/continue`,
  AgentRunResume: (b: string, id: string, rid: string) =>
    `${b}/agents/${id}/runs/${rid}/resume`,
  AgentRunDetail: (b: string, id: string, rid: string) =>
    `${b}/agents/${id}/runs/${rid}`,
  AgentRuns: (b: string, id: string) => `${b}/agents/${id}/runs`,

  // Teams
  GetTeams: (b: string) => `${b}/teams`,
  GetTeam: (b: string, id: string) => `${b}/teams/${id}`,
  TeamRun: (b: string, id: string) => `${b}/teams/${id}/runs`,
  TeamRunCancel: (b: string, id: string, rid: string) =>
    `${b}/teams/${id}/runs/${rid}/cancel`,
  TeamRunContinue: (b: string, id: string, rid: string) =>
    `${b}/teams/${id}/runs/${rid}/continue`,
  TeamRunResume: (b: string, id: string, rid: string) =>
    `${b}/teams/${id}/runs/${rid}/resume`,
  TeamRunDetail: (b: string, id: string, rid: string) =>
    `${b}/teams/${id}/runs/${rid}`,
  TeamRuns: (b: string, id: string) => `${b}/teams/${id}/runs`,

  // Workflows
  GetWorkflows: (b: string) => `${b}/workflows`,
  GetWorkflow: (b: string, id: string) => `${b}/workflows/${id}`,
  WorkflowRun: (b: string, id: string) => `${b}/workflows/${id}/runs`,
  WorkflowRunCancel: (b: string, id: string, rid: string) =>
    `${b}/workflows/${id}/runs/${rid}/cancel`,
  WorkflowRunContinue: (b: string, id: string, rid: string) =>
    `${b}/workflows/${id}/runs/${rid}/continue`,
  WorkflowRunResume: (b: string, id: string, rid: string) =>
    `${b}/workflows/${id}/runs/${rid}/resume`,
  WorkflowRunDetail: (b: string, id: string, rid: string) =>
    `${b}/workflows/${id}/runs/${rid}`,
  WorkflowRuns: (b: string, id: string) => `${b}/workflows/${id}/runs`,
  WorkflowsWS: (b: string) =>
    `${b.replace(/^http/, 'ws')}/workflows/ws`,

  // Sessions (compartilhado agent/team/workflow)
  GetSessions: (b: string) => `${b}/sessions`,
  CreateSession: (b: string) => `${b}/sessions`,
  GetSession: (b: string, sid: string) => `${b}/sessions/${sid}`,
  GetSessionRuns: (b: string, sid: string) => `${b}/sessions/${sid}/runs`,
  GetSessionRun: (b: string, sid: string, rid: string) =>
    `${b}/sessions/${sid}/runs/${rid}`,
  DeleteSession: (b: string, sid: string) => `${b}/sessions/${sid}`,
  DeleteSessionsBulk: (b: string) => `${b}/sessions`,
  RenameSession: (b: string, sid: string) => `${b}/sessions/${sid}/rename`,
  UpdateSession: (b: string, sid: string) => `${b}/sessions/${sid}`,

  // Memories
  GetMemories: (b: string) => `${b}/memories`,
  CreateMemory: (b: string) => `${b}/memories`,
  GetMemory: (b: string, mid: string) => `${b}/memories/${mid}`,
  UpdateMemory: (b: string, mid: string) => `${b}/memories/${mid}`,
  DeleteMemory: (b: string, mid: string) => `${b}/memories/${mid}`,
  DeleteMemoriesBulk: (b: string) => `${b}/memories`,
  MemoryTopics: (b: string) => `${b}/memory_topics`,
  UserMemoryStats: (b: string) => `${b}/user_memory_stats`,
  OptimizeMemories: (b: string) => `${b}/optimize-memories`,

  // Knowledge
  GetKnowledgeContent: (b: string) => `${b}/knowledge/content`,
  PostKnowledgeContent: (b: string) => `${b}/knowledge/content`,
  GetKnowledgeContentDetail: (b: string, cid: string) =>
    `${b}/knowledge/content/${cid}`,
  DeleteKnowledgeContent: (b: string, cid: string) =>
    `${b}/knowledge/content/${cid}`,
  PatchKnowledgeContent: (b: string, cid: string) =>
    `${b}/knowledge/content/${cid}`,
  KnowledgeContentStatus: (b: string, cid: string) =>
    `${b}/knowledge/content/${cid}/status`,
  KnowledgeSearch: (b: string) => `${b}/knowledge/search`,
  KnowledgeConfig: (b: string) => `${b}/knowledge/config`,
  KnowledgeSources: (b: string, kid: string) =>
    `${b}/knowledge/${kid}/sources`,
  KnowledgeRemoteContent: (b: string) => `${b}/knowledge/remote-content`,

  // Schedules
  GetSchedules: (b: string) => `${b}/schedules`,
  CreateSchedule: (b: string) => `${b}/schedules`,
  GetSchedule: (b: string, sid: string) => `${b}/schedules/${sid}`,
  UpdateSchedule: (b: string, sid: string) => `${b}/schedules/${sid}`,
  DeleteSchedule: (b: string, sid: string) => `${b}/schedules/${sid}`,
  EnableSchedule: (b: string, sid: string) => `${b}/schedules/${sid}/enable`,
  DisableSchedule: (b: string, sid: string) => `${b}/schedules/${sid}/disable`,
  TriggerSchedule: (b: string, sid: string) => `${b}/schedules/${sid}/trigger`,
  GetScheduleRuns: (b: string, sid: string) => `${b}/schedules/${sid}/runs`,

  // Evals
  GetEvalRuns: (b: string) => `${b}/eval-runs`,
  CreateEvalRun: (b: string) => `${b}/eval-runs`,
  GetEvalRun: (b: string, eid: string) => `${b}/eval-runs/${eid}`,
  UpdateEvalRun: (b: string, eid: string) => `${b}/eval-runs/${eid}`,
  DeleteEvalRunsBulk: (b: string) => `${b}/eval-runs`,

  // Metrics
  GetMetrics: (b: string) => `${b}/metrics`,
  RefreshMetrics: (b: string) => `${b}/metrics/refresh`,

  // Traces
  GetTraces: (b: string) => `${b}/traces`,
  GetTracesFilterSchema: (b: string) => `${b}/traces/filter-schema`,
  GetTrace: (b: string, tid: string) => `${b}/traces/${tid}`,
  GetTraceSessionStats: (b: string) => `${b}/trace_session_stats`,
  SearchTraces: (b: string) => `${b}/traces/search`,

  // Learnings
  GetLearnings: (b: string) => `${b}/learnings`,
  CreateLearning: (b: string) => `${b}/learnings`,
  GetLearning: (b: string, lid: string) => `${b}/learnings/${lid}`,
  UpdateLearning: (b: string, lid: string) => `${b}/learnings/${lid}`,
  DeleteLearning: (b: string, lid: string) => `${b}/learnings/${lid}`,
  GetLearningUsers: (b: string) => `${b}/learnings/users`,
  DeleteLearningUser: (b: string, uid: string) =>
    `${b}/learnings/users/${uid}`,

  // Approvals
  GetApprovals: (b: string) => `${b}/approvals`,
  GetApprovalsCount: (b: string) => `${b}/approvals/count`,
  GetApproval: (b: string, aid: string) => `${b}/approvals/${aid}`,
  GetApprovalStatus: (b: string, aid: string) =>
    `${b}/approvals/${aid}/status`,
  ResolveApproval: (b: string, aid: string) =>
    `${b}/approvals/${aid}/resolve`,
  DeleteApproval: (b: string, aid: string) => `${b}/approvals/${aid}`,

  // Databases (migrate)
  MigrateAllDatabases: (b: string) => `${b}/databases/all/migrate`,
  MigrateDatabase: (b: string, dbid: string) =>
    `${b}/databases/${dbid}/migrate`
}
